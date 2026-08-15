'use client';

// Seleção e AÇÕES EM MASSA dos kanbans jurídicos — compartilhado por todos os
// quadros (pré-processual, judicial, planejamento, funil REPB, bancária e os
// quadros custom). Fluxo igual ao do chat: no ⋮ da fase você escolhe "Selecionar
// cards", as caixinhas aparecem, você vai marcando e a barra do rodapé diz o que
// fazer com a seleção. Peças:
//   - useKanbanBulk()        → estado da seleção + modo seleção (shift+clique = intervalo)
//   - <KanbanSelectBox/>     → caixinha no canto do card (não arrasta, não abre a ficha)
//   - <KanbanColumnSelect/>  → "selecionar todos" no cabeçalho da coluna (no modo seleção)
//   - <KanbanSelectTrigger/> → liga o modo onde não há menu ⋮ (INSS, colunas por produto)
//   - <KanbanBulkBar/>       → barra flutuante com as ações (mover fase, responsável,
//                              status, etiquetas, arquivar)
//
// "Mover para a fase" NÃO usa o /legal-cases/bulk: chama o mesmo PATCH
// :id/phase do arrastar, um card por vez (com paralelismo curto), pra preservar
// o que o backend faz na troca de fase (data da fase, histórico, selo "revisar
// fase", avisos). Um updateMany pularia tudo isso.
//
// Responsável / Status / Arquivar usam /legal-cases/bulk, que é OWNER/ADMIN no
// backend — por isso só aparecem para sócios (mesma trava da aba Processos).

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban, Check, CheckCircle2, CheckSquare, ChevronDown, Loader2, MoveRight, PauseCircle,
  Plus, Tag, Trash2, UserCog, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type CaseStatus, type KanbanCard, type KanbanData,
} from '@/features/legal-cases/services/legal-cases.service';
import { activitiesService } from '@/features/activities/services/activities.service';
import { membersService } from '@/features/settings/services/members.service';
import { usePermissions } from '@/hooks/use-permissions';
import { fireConfetti, shouldCelebrate } from '@/features/legal-cases/lib/kanban-terminal';

const ACCENT_PADRAO = '#e11970';

export interface KanbanBulk {
  ids: Set<string>;
  count: number;
  /** Modo seleção ligado pelo ⋮ da fase ("Selecionar cards"), como no chat. */
  selecting: boolean;
  /** Liga o modo seleção (caixinhas visíveis em todos os cards + barra na tela). */
  startSelecting: () => void;
  /** true no modo seleção OU com algo já selecionado. */
  active: boolean;
  has: (id: string) => boolean;
  /** Marca/desmarca um card. Com `shift` + `range` (ids da coluna, na ordem da tela) seleciona o intervalo. */
  toggle: (id: string, opts?: { range?: string[]; shift?: boolean }) => void;
  /** Liga/desliga um conjunto de uma vez (ex.: todos os cards de uma coluna). */
  setMany: (ids: string[], on: boolean) => void;
  /** Substitui a seleção inteira (usado pra manter só o que falhou). */
  replace: (ids: string[]) => void;
  clear: () => void;
}

/** Estado da seleção em massa de um quadro. */
export function useKanbanBulk(): KanbanBulk {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
  // Âncora do shift+clique (último card clicado).
  const lastRef = useRef<string | null>(null);

  const toggle = useCallback((id: string, opts?: { range?: string[]; shift?: boolean }) => {
    setIds((prev) => {
      const next = new Set(prev);
      const last = lastRef.current;
      const range = opts?.range;
      if (opts?.shift && last && last !== id && range?.length) {
        const a = range.indexOf(last);
        const b = range.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [i, j] = a < b ? [a, b] : [b, a];
          const ligar = !next.has(id);
          for (let k = i; k <= j; k++) {
            if (ligar) next.add(range[k]);
            else next.delete(range[k]);
          }
          lastRef.current = id;
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastRef.current = id;
      return next;
    });
  }, []);

  const setMany = useCallback((list: string[], on: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      for (const id of list) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const replace = useCallback((list: string[]) => setIds(new Set(list)), []);
  // "Limpar" sai do modo seleção também — é o mesmo botão de fechar a barra.
  const clear = useCallback(() => { lastRef.current = null; setIds(new Set()); setSelecting(false); }, []);
  const startSelecting = useCallback(() => setSelecting(true), []);
  const has = useCallback((id: string) => ids.has(id), [ids]);

  // Identidade estável enquanto a seleção não muda — o Card do quadro judicial é
  // React.memo (centenas de cards) e um objeto novo a cada render mataria o memo.
  return useMemo(
    () => ({
      ids, count: ids.size, selecting, startSelecting,
      active: selecting || ids.size > 0,
      has, toggle, setMany, replace, clear,
    }),
    [ids, selecting, startSelecting, has, toggle, setMany, replace, clear],
  );
}

/** Caixinha de seleção no canto do card. Fica invisível até passar o mouse
 *  (ou até haver seleção ativa) pra não poluir o quadro no uso normal. */
export function KanbanSelectBox({
  bulk, id, colIds, accent = ACCENT_PADRAO,
}: {
  bulk: KanbanBulk;
  id: string;
  /** Ids da coluna, na ordem exibida — habilita o shift+clique por intervalo. */
  colIds?: string[];
  accent?: string;
}) {
  const selecionado = bulk.has(id);
  return (
    <span
      role="checkbox"
      aria-checked={selecionado}
      aria-label={selecionado ? 'Remover da seleção' : 'Selecionar'}
      title={selecionado ? 'Remover da seleção' : 'Selecionar (shift = intervalo)'}
      // stopPropagation nos dois: o pointerdown é o que inicia o arrastar do
      // dnd-kit e o click é o que abre a ficha do processo. Sem preventDefault —
      // no touch ele engoliria o clique seguinte.
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); bulk.toggle(id, { range: colIds, shift: e.shiftKey }); }}
      className={`absolute right-1.5 top-1.5 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border shadow-sm transition-opacity ${
        selecionado ? 'border-transparent opacity-100' : 'border-[#cfe0ed] bg-white dark:border-zinc-600 dark:bg-[#1E2226]'
      } ${selecionado || bulk.active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      style={selecionado ? { background: accent, borderColor: accent } : undefined}
    >
      {selecionado && <Check className="h-3.5 w-3.5 text-white" />}
    </span>
  );
}

/** "Selecionar todos" da coluna — só aparece no modo seleção, ao lado da contagem. */
export function KanbanColumnSelect({
  bulk, ids, accent = ACCENT_PADRAO,
}: {
  bulk: KanbanBulk;
  ids: string[];
  accent?: string;
}) {
  if (!bulk.active || !ids.length) return null;
  const todos = ids.every((id) => bulk.has(id));
  const alguns = !todos && ids.some((id) => bulk.has(id));
  return (
    <button
      type="button"
      onClick={() => bulk.setMany(ids, !todos)}
      title={todos ? 'Desmarcar todos desta fase' : 'Selecionar todos desta fase'}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        todos || alguns ? 'border-transparent' : 'border-[#c3ccd5] hover:border-zinc-500 dark:border-zinc-600'
      }`}
      style={todos || alguns ? { background: accent, borderColor: accent } : undefined}
    >
      {todos && <Check className="h-3 w-3 text-white" />}
      {alguns && <span className="h-0.5 w-2 rounded bg-white" />}
    </button>
  );
}

/** Atalho pra LIGAR o modo seleção em cabeçalhos que não têm o menu ⋮ (ex.: INSS,
 *  cujas colunas são o resultado do requerimento, não fases). */
export function KanbanSelectTrigger({ bulk, accent = ACCENT_PADRAO }: { bulk: KanbanBulk; accent?: string }) {
  if (bulk.active) return null;
  return (
    <button
      type="button"
      onClick={bulk.startSelecting}
      title="Selecionar cards"
      className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-zinc-100 group-hover/col:opacity-100 dark:hover:bg-zinc-800"
      style={{ color: accent }}
    >
      <CheckSquare className="h-3.5 w-3.5" />
    </button>
  );
}

/** Roda uma ação por card com paralelismo curto; devolve os que falharam. */
async function emLote<T>(itens: T[], limite: number, fn: (item: T) => Promise<unknown>): Promise<T[]> {
  const falhas: T[] = [];
  let i = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (i < itens.length) {
      const item = itens[i++];
      try { await fn(item); } catch { falhas.push(item); }
    }
  });
  await Promise.all(trabalhadores);
  return falhas;
}

export interface BulkPhaseOption {
  key: string;
  label: string;
  /** usado só pro confete ao mover em massa pra uma fase de desfecho positivo. */
  terminal?: boolean;
  status?: string;
}

/** Barra flutuante com as ações em massa. Some quando não há nada selecionado. */
export function KanbanBulkBar({
  bulk, cards, phases, queryKey, accent = ACCENT_PADRAO,
}: {
  bulk: KanbanBulk;
  /** Cards visíveis do quadro (a ação só age no que está na tela). */
  cards: KanbanCard[];
  /** Fases DESTE quadro — nunca as de outro (transferência entre quadros é por ação). */
  phases: BulkPhaseOption[];
  /** queryKey do quadro, pra atualizar/invalidar o cache depois da ação. */
  queryKey: readonly unknown[];
  accent?: string;
}) {
  const qc = useQueryClient();
  const { canDeleteCases } = usePermissions();
  const [busy, setBusy] = useState(false);

  const selecionados = useMemo(() => cards.filter((c) => bulk.has(c.id)), [cards, bulk]);
  const total = selecionados.length;

  const { data: membros = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    enabled: canDeleteCases,
  });
  const atribuiveis = membros.filter((m) => m.user.isActive && m.assignable !== false);
  const { data: etiquetas = [] } = useQuery({
    queryKey: ['tags-available'],
    queryFn: () => activitiesService.listAvailableTags(),
  });

  // Só some quando o modo seleção está desligado E nada está marcado.
  if (!bulk.active) return null;
  const vazio = total === 0;

  const recarregar = () => qc.invalidateQueries({ queryKey: queryKey as unknown[] });

  // ── Mover de fase (o pedido principal): um PATCH :id/phase por card. ──
  const mover = async (key: string) => {
    const alvo = phases.find((p) => p.key === key);
    const lista = selecionados.filter((c) => c.phase !== key);
    if (!lista.length) { toast.info('Os processos selecionados já estão nessa fase.'); return; }
    if (!confirm(`Mover ${lista.length} processo(s) para "${alvo?.label ?? key}"?`)) return;
    setBusy(true);
    const aviso = toast.loading(`Movendo ${lista.length} processo(s)…`);
    // Otimista: os cards pulam de coluna na hora (o refetch reconcilia).
    const idsMovidos = new Set(lista.map((c) => c.id));
    qc.setQueryData<KanbanData>(queryKey as unknown[], (old) =>
      old ? { ...old, cards: old.cards.map((c) => (idsMovidos.has(c.id) ? { ...c, phase: key } : c)) } : old,
    );
    const falhas = await emLote(lista, 4, (c) => legalCasesService.movePhase(c.id, key));
    toast.dismiss(aviso);
    if (falhas.length) {
      toast.error(`${lista.length - falhas.length} movido(s); ${falhas.length} falhou(ram) — seguem selecionados.`);
      bulk.replace(falhas.map((c) => c.id));
    } else {
      toast.success(`${lista.length} processo(s) movido(s) para "${alvo?.label ?? key}"`);
      if (shouldCelebrate(alvo)) fireConfetti();
      bulk.clear();
    }
    recarregar();
    setBusy(false);
  };

  // ── Responsável / status / arquivar: /legal-cases/bulk (só sócios). ──
  const rodarBulk = async (
    action: 'delete' | 'status' | 'responsible',
    extra?: { status?: CaseStatus; responsibleId?: string },
    mensagem?: string,
  ) => {
    const ids = selecionados.map((c) => c.id);
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await legalCasesService.bulk({ ids, action, ...extra });
      toast.success(mensagem ?? `${r.count} processo(s) atualizado(s).`);
      bulk.clear();
      recarregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao aplicar a ação');
    } finally {
      setBusy(false);
    }
  };

  const arquivar = () => {
    if (!confirm(`Arquivar ${total} processo(s)? Vão para a lixeira (status Arquivado) e podem ser recuperados.`)) return;
    rodarBulk('delete', undefined, `${total} processo(s) arquivado(s).`);
  };

  // ── Etiquetas: usa as etiquetas que JÁ existem (nunca cria etiqueta nova). ──
  const etiquetar = async (tagId: string, modo: 'add' | 'remove') => {
    const tag = etiquetas.find((t) => t.id === tagId);
    setBusy(true);
    const aviso = toast.loading(modo === 'add' ? 'Aplicando etiqueta…' : 'Removendo etiqueta…');
    const falhas = await emLote(selecionados, 4, async (c) => {
      const tem = (c.tags ?? []).some((t) => t.id === tagId);
      if (modo === 'add') {
        if (tem) return;
        await activitiesService.attachTag('case', c.id, tagId);
      } else {
        if (!tem) return;
        // O card só traz o id da ETIQUETA; o vínculo (EntityTag) vem daqui.
        const vinculos = await activitiesService.listTags('case', c.id);
        const vinculo = vinculos.find((v) => v.tagId === tagId);
        if (vinculo) await activitiesService.detachTag(vinculo.id);
      }
    });
    toast.dismiss(aviso);
    if (falhas.length) toast.error(`${falhas.length} processo(s) não receberam a alteração da etiqueta.`);
    else toast.success(modo === 'add' ? `Etiqueta "${tag?.name ?? ''}" aplicada.` : `Etiqueta "${tag?.name ?? ''}" removida.`);
    recarregar();
    setBusy(false);
  };

  return (
    // Acima da barra inferior de navegação (fixa, 3.5rem + safe-area).
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-[#cfe0ed] bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(16,24,32,.18)] backdrop-blur dark:border-zinc-700 dark:bg-[#15181A]/95">
        <span className="mr-1 text-sm font-semibold" style={{ color: vazio ? undefined : accent }}>
          {busy && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
          {vazio
            ? <span className="text-zinc-500 dark:text-zinc-400">Clique nos cards para selecionar <span className="text-zinc-400">(shift = intervalo)</span></span>
            : `${total} selecionado${total > 1 ? 's' : ''}`}
        </span>

        <BulkMenu label="Mover para a fase" icon={<MoveRight className="h-4 w-4" />} disabled={busy || vazio} accent={accent}>
          {(close) => (
            <>
              {phases.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma fase neste quadro.</p>}
              {phases.map((p) => (
                <BulkItem key={p.key} onClick={() => { close(); mover(p.key); }}>{p.label}</BulkItem>
              ))}
            </>
          )}
        </BulkMenu>

        <BulkMenu label="Etiquetas" icon={<Tag className="h-4 w-4" />} disabled={busy || vazio} accent={accent}>
          {(close) => (
            <>
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Adicionar a todos</p>
              {etiquetas.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta cadastrada.</p>}
              {etiquetas.map((t) => (
                <BulkItem key={`add-${t.id}`} onClick={() => { close(); etiquetar(t.id, 'add'); }}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><Plus className="h-3 w-3" />{t.name}</span>
                </BulkItem>
              ))}
              {etiquetas.length > 0 && (
                <>
                  <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                  <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Remover de todos</p>
                  {etiquetas.map((t) => (
                    <BulkItem key={`rm-${t.id}`} onClick={() => { close(); etiquetar(t.id, 'remove'); }}>
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><X className="h-3 w-3" />{t.name}</span>
                    </BulkItem>
                  ))}
                </>
              )}
            </>
          )}
        </BulkMenu>

        {/* Responsável, status e arquivar são de sócio (o /bulk é OWNER/ADMIN). */}
        {canDeleteCases && (
          <>
            <BulkMenu label="Responsável" icon={<UserCog className="h-4 w-4" />} disabled={busy || vazio} accent={accent}>
              {(close) => (
                <>
                  <BulkItem onClick={() => { close(); rodarBulk('responsible', { responsibleId: '' }, 'Responsável removido.'); }}>
                    <span className="text-zinc-500">Sem responsável</span>
                  </BulkItem>
                  {atribuiveis.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhum membro.</p>}
                  {atribuiveis.map((m) => (
                    <BulkItem key={m.userId} onClick={() => { close(); rodarBulk('responsible', { responsibleId: m.userId }, `Responsável: ${m.user.name}.`); }}>
                      {m.user.name}
                    </BulkItem>
                  ))}
                </>
              )}
            </BulkMenu>

            <BulkMenu label="Status" icon={<CheckCircle2 className="h-4 w-4" />} disabled={busy || vazio} accent={accent}>
              {(close) => (
                <>
                  <BulkItem onClick={() => { close(); rodarBulk('status', { status: 'ACTIVE' }); }}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ativo
                  </BulkItem>
                  <BulkItem onClick={() => { close(); rodarBulk('status', { status: 'SUSPENDED' }); }}>
                    <PauseCircle className="h-4 w-4 text-amber-500" /> Suspenso
                  </BulkItem>
                  <BulkItem onClick={() => { close(); rodarBulk('status', { status: 'CLOSED' }); }}>
                    <Ban className="h-4 w-4 text-zinc-500" /> Encerrado
                  </BulkItem>
                </>
              )}
            </BulkMenu>

            <button
              onClick={arquivar}
              disabled={busy || vazio}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" /> Arquivar
            </button>
          </>
        )}

        <button
          onClick={bulk.clear}
          disabled={busy}
          title="Sair da seleção"
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" /> {vazio ? 'Cancelar' : 'Limpar'}
        </button>
      </div>
    </div>
  );
}

function BulkMenu({
  label, icon, disabled, accent, children,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  accent: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cfe0ed] px-3 text-sm font-medium text-[#101820] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        style={open ? { borderColor: accent, color: accent } : undefined}
      >
        {icon} {label} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Abre pra CIMA: a barra vive no rodapé da tela. */}
          <div className="absolute bottom-11 left-0 z-50 max-h-[60vh] w-64 overflow-y-auto rounded-lg border border-[#cfe0ed] bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function BulkItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#101820] hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
