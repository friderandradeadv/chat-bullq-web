'use client';

// Peças reutilizáveis dos kanbans jurídicos:
// - PhaseHeader: renomeia a fase clicando no título (só sócios).
// - ProdutoTags: edita o PRODUTO/ÁREA do processo (os badges coloridos do card:
//   RMC, BPC/LOAS, Previdenciário…) como etiquetas — chip com ✕ pra remover +
//   botão "+" pra adicionar (presets ou texto livre). Grava em Case.area; a área
//   jurídica (2º badge) é derivada disso no backend, então atualiza sozinha.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2, Check, Tag as TagIcon, MoreVertical, ArrowLeft, ArrowRight, ArrowDownUp, CheckSquare, ListChecks, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { SORT_OPTIONS, type CardSort } from '../lib/kanban-sort';
import type { PhaseDragHandle } from '../lib/phase-drag';
import { legalCasesService, type LegalTag } from '../services/legal-cases.service';
import { emLote } from './kanban-bulk';
import { tagsService } from '@/features/settings/services/tags.service';
import { ColorPicker } from '@/features/settings/components/color-picker';
import { chipTextColor } from '@/lib/avatar';

export function PhaseHeader({
  phase,
  canRename,
  onRename,
  onDelete,
  onMoveLeft,
  onMoveRight,
  sort,
  onSort,
  onSelect,
  drag,
  cardIds,
  phases,
}: {
  phase: { key: string; label: string; custom?: boolean };
  canRename: boolean;
  onRename: (key: string, label: string) => void;
  /** Sócios: excluir (fase própria) ou esconder (fase padrão) direto no board. */
  onDelete?: (phase: { key: string; label: string; custom?: boolean }) => void;
  /** Reordenar a fase no quadro — undefined quando já está no extremo. */
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  /** Ordenar os cards DENTRO da coluna (preferência de visualização do usuário). */
  sort?: CardSort;
  onSort?: (s: CardSort) => void;
  /** Liga o modo seleção em massa (igual ao chat). `todos` = já marca a fase inteira. */
  onSelect?: (todos: boolean) => void;
  /** Segurar o cabeçalho e arrastar a coluna pra outra posição (usePhaseDrag). */
  drag?: PhaseDragHandle;
  /** ids dos processos NESTA fase — o diálogo de excluir move antes de remover. */
  cardIds?: string[];
  /** fases deste quadro — destinos possíveis ao excluir uma fase com processos. */
  phases?: { key: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [text, setText] = useState(phase.label);
  useEffect(() => setText(phase.label), [phase.label]);

  // Sem permissão de renomear, sem ordenação e sem seleção → só o título (nada de menu).
  if (!canRename && !onSort && !onSelect) {
    return (
      <h2 className="truncate text-sm font-medium text-[#e11970]/90 dark:text-[#f06595]/75">
        {phase.label}
      </h2>
    );
  }

  const commit = () => {
    const t = text.trim();
    setEditing(false);
    if (t && t !== phase.label) onRename(phase.key, t);
    else setText(phase.label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setEditing(false); setText(phase.label); }
        }}
        className="w-full rounded border border-[#e11970] bg-white px-1 py-0.5 text-sm font-medium text-[#101820] outline-none dark:bg-zinc-800 dark:text-zinc-100"
      />
    );
  }

  return (
    // Com `drag`: segurar o cabeçalho e puxar move a COLUNA de lugar. O clique curto
    // continua abrindo o rename (o arraste só nasce depois de andar alguns px, e o
    // clique que vem depois de arrastar é bloqueado). `data-no-drag-scroll` impede
    // que o pan lateral do quadro (useDragScroll) roube o gesto.
    <div
      className={`group/ph relative flex min-w-0 flex-1 items-center gap-1 ${drag ? (drag.dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      {...(drag ? { onPointerDown: drag.onPointerDown, 'data-no-drag-scroll': true, style: { touchAction: 'none' } } : {})}
    >
      {drag && (
        <GripVertical
          className={`-ml-1 h-3.5 w-3.5 shrink-0 text-zinc-400 transition dark:text-zinc-600 ${drag.dragging ? 'opacity-100' : 'opacity-0 group-hover/ph:opacity-100'}`}
        />
      )}
      <h2
        onClick={canRename ? () => { if (drag?.blockedClick()) return; setEditing(true); } : undefined}
        title={canRename ? (drag ? 'Clique pra renomear · segure e arraste pra mover a fase' : 'Clique pra renomear a fase (só sócios)') : undefined}
        className={`min-w-0 truncate text-sm font-medium text-[#e11970]/90 dark:text-[#f06595]/75 ${canRename ? (drag ? 'hover:underline' : 'cursor-text hover:underline') : ''}`}
      >
        {phase.label}
      </h2>
      {/* ⋮ aparece ao passar o mouse na fase (estilo Pipefy) → abre opções */}
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        title="Opções da fase"
        className={`shrink-0 rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${menu ? 'opacity-100' : 'opacity-0 group-hover/ph:opacity-100'}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
          <div className="absolute left-0 top-6 z-30 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {/* Seleção em massa (qualquer usuário) — igual ao chat: liga o modo e
                depois você escolhe o que fazer na barra do rodapé. */}
            {onSelect && (
              <>
                <button
                  type="button"
                  onClick={() => { setMenu(false); onSelect(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <CheckSquare className="h-3.5 w-3.5 shrink-0" /> Selecionar cards
                </button>
                <button
                  type="button"
                  onClick={() => { setMenu(false); onSelect(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ListChecks className="h-3.5 w-3.5 shrink-0" /> Selecionar todos desta fase
                </button>
                {(canRename || onSort) && <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />}
              </>
            )}
            {/* Ações da fase — só sócios (OWNER/ADMIN) */}
            {canRename && (
              <button
                type="button"
                onClick={() => { setMenu(false); setEditing(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" /> Renomear fase
              </button>
            )}
            {canRename && onMoveLeft && (
              <button
                type="button"
                onClick={() => { setMenu(false); onMoveLeft(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" /> Mover para a esquerda
              </button>
            )}
            {canRename && onMoveRight && (
              <button
                type="button"
                onClick={() => { setMenu(false); onMoveRight(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Mover para a direita
              </button>
            )}
            {canRename && onDelete && (
              <button
                type="button"
                onClick={() => { setMenu(false); setExcluindo(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" /> Excluir fase
              </button>
            )}
            {/* Ordenar cards da coluna — disponível para qualquer usuário */}
            {onSort && (
              <>
                {canRename && <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />}
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  <ArrowDownUp className="h-3 w-3" /> Ordenar cards
                </div>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setMenu(false); onSort(o.id); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Check className={`h-3.5 w-3.5 shrink-0 text-[#e11970] ${(sort ?? 'manual') === o.id ? 'opacity-100' : 'opacity-0'}`} />
                    {o.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
      {excluindo && onDelete && (
        <ExcluirFaseDialog
          phase={phase}
          cardIds={cardIds ?? []}
          phases={phases ?? []}
          onConfirm={() => onDelete(phase)}
          onClose={() => setExcluindo(false)}
        />
      )}
    </div>
  );
}

/**
 * Excluir a fase pelo próprio quadro. Duas situações, e o texto diz qual é:
 *
 * • Fase PRÓPRIA (criada pelo escritório) → sai de vez da configuração.
 * • Fase PADRÃO (do sistema) → some do quadro; volta em Configurações › Fases.
 *   Não dá pra apagar de verdade: a chave dela vive no código e é o que liga
 *   DJEN, SLA e as automações.
 *
 * Se a fase tem processos, exige um DESTINO: os cards são movidos um a um
 * (PATCH :id/phase — nunca em massa no banco, pra cada card registrar a
 * movimentação) e só então a fase é removida. Sem isso, fase padrão escondida
 * deixaria processo sem coluna e fase própria nem deixaria excluir.
 */
export function ExcluirFaseDialog({
  phase,
  cardIds,
  phases,
  onConfirm,
  onClose,
}: {
  phase: { key: string; label: string; custom?: boolean };
  /** ids dos processos que estão nesta fase */
  cardIds: string[];
  /** destinos possíveis (as fases deste quadro) */
  phases: { key: string; label: string }[];
  /** remove a fase de fato (o board chama o service) */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const destinos = phases.filter((p) => p.key !== phase.key);
  const [destino, setDestino] = useState(destinos[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const total = cardIds.length;

  const excluir = async () => {
    if (total && !destino) { toast.error('Escolha para onde vão os processos.'); return; }
    setBusy(true);
    try {
      if (total) {
        const aviso = toast.loading(`Movendo ${total} processo(s)…`);
        const falhas = await emLote(cardIds, 4, (id) => legalCasesService.movePhase(id, destino));
        toast.dismiss(aviso);
        if (falhas.length) {
          toast.error(`${falhas.length} processo(s) não puderam ser movidos — a fase não foi excluída.`);
          setBusy(false);
          return;
        }
      }
      await onConfirm();
      onClose();
    } catch {
      // o board já avisa o erro na sua própria chamada
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={busy ? undefined : onClose} />
      <div className="relative w-[440px] max-w-[94vw] rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
        <button onClick={onClose} disabled={busy} className="absolute right-3 top-3 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        <h2 className="text-base font-bold text-[#101820] dark:text-zinc-100">Excluir a fase “{phase.label}”?</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {phase.custom
            ? 'Esta fase foi criada pelo escritório — ela sai de vez, para todo mundo.'
            : 'Esta é uma fase padrão do sistema: ela some do quadro para todo mundo, e você pode trazê-la de volta em Configurações › Fases.'}
        </p>

        {total > 0 && (
          <div className="mt-4">
            <p className="text-sm text-[#101820] dark:text-zinc-200">
              A fase tem <b>{total}</b> processo(s). Para onde eles vão?
            </p>
            <select
              value={destino}
              disabled={busy}
              onChange={(e) => setDestino(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] outline-none focus:border-[#4a90e2] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {destinos.length === 0 && <option value="">Não há outra fase neste quadro</option>}
              {destinos.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">
              Cada processo é movido individualmente e registra a movimentação, como se você arrastasse o card.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
          <button
            onClick={excluir}
            disabled={busy || (total > 0 && !destino)}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
          >
            {busy ? 'Excluindo…' : total > 0 ? `Mover ${total} e excluir` : 'Excluir fase'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Quadros com fases gerenciáveis inline (add/excluir). */
// Quadros base + qualquer quadro CUSTOM (chave board_*). `(string & {})` preserva
// o autocomplete dos base sem travar a atribuição de uma chave custom.
export type KanbanBoardId = 'pre' | 'banco' | 'plan' | 'repb' | 'repbc' | 'judicial' | (string & {});

/**
 * Coluna-fantasma "＋ Nova fase" no fim do board (estilo Pipefy). Só sócios veem
 * (o gate real é no backend). Cria a fase no FIM do quadro e chama `onAdded`.
 */
export function AddPhaseColumn({
  board,
  accent,
  onAdded,
}: {
  board: KanbanBoardId;
  accent: string;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const t = label.trim();
    if (!t) { setAdding(false); setLabel(''); return; }
    setBusy(true);
    try {
      await legalCasesService.addPhase(board, t);
      toast.success('Fase criada');
      setLabel(''); setAdding(false); onAdded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Só sócios podem criar fases');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex w-[240px] shrink-0 flex-col pt-1">
      {adding ? (
        <div className="rounded-xl border border-dashed p-2" style={{ borderColor: accent }}>
          <input
            autoFocus
            value={label}
            disabled={busy}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={create}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); create(); }
              else if (e.key === 'Escape') { setAdding(false); setLabel(''); }
            }}
            placeholder="Nome da fase e Enter…"
            className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm text-[#101820] outline-none dark:text-zinc-100"
            style={{ borderColor: accent }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          title="Adicionar fase neste quadro"
          className="flex h-10 items-center justify-center gap-1 rounded-xl border border-dashed border-[#cfd4da] text-sm font-medium text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:hover:text-zinc-300"
        >
          <Plus className="h-4 w-4" /> Nova fase
        </button>
      )}
    </div>
  );
}

// ── Produto/Área (etiquetas coloridas do card) ──
const PRODUTO_PRESETS = [
  'RMC', 'RCC', 'Revisional Consignado', 'Portabilidade', 'Contribuições',
  'Tarifas/Seguros', 'BPC/LOAS', 'BPC/LOAS - Doença', 'Auxílio-doença',
  'Aposentadoria por Idade', 'Aposentadoria por Invalidez', 'Trabalhista',
  'Consumidor', 'Cível', 'Família',
];

function produtoBg(p: string): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/TRABALH|RESCIS|FERIAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD|CONSUMID/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}

/** Case.area pode ser string simples OU JSON array (ex.: ["RMC","RCC"]). */
function parseProdutos(area: string | null): string[] {
  if (!area) return [];
  const t = area.trim();
  if (t.startsWith('[')) {
    try {
      const a = JSON.parse(t);
      if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* */ }
  }
  return [t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim()].filter(Boolean);
}

export function ProdutoTags({
  caseId,
  area,
  onChanged,
}: {
  caseId: string;
  area: string | null;
  onChanged: () => void;
}) {
  const list = parseProdutos(area);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      const value = next.length === 0 ? '' : next.length === 1 ? next[0] : JSON.stringify(next);
      await legalCasesService.update(caseId, { area: value } as any);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar produto/área');
    } finally {
      setBusy(false);
    }
  };
  const remove = (p: string) => save(list.filter((x) => x !== p));
  const add = (p: string) => {
    const v = p.trim();
    if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) save([...list, v]);
    setCustom('');
    setOpen(false);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {list.map((p) => {
        const col = produtoBg(p);
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{ background: col.bg, color: col.fg }}
          >
            {p}
            <button type="button" disabled={busy} title="Remover" onClick={() => remove(p)} className="hover:opacity-70">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}
      <div className="relative">
        <button
          type="button"
          title="Adicionar produto/área"
          onClick={() => setOpen((v) => !v)}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#e11970] dark:hover:bg-zinc-800"
        >
          <Plus className="h-3 w-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Produto / Área</p>
              <div className="px-2 pb-1">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(custom); } }}
                  placeholder="Digitar e Enter…"
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[#e11970] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {PRODUTO_PRESETS.filter((p) => !list.some((x) => x.toLowerCase() === p.toLowerCase())).map((p) => (
                <button
                  key={p}
                  disabled={busy}
                  onClick={() => add(p)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: produtoBg(p).bg }} />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{p}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Etiquetas jurídicas (Tags scope="legal") do processo ──
// No card: anexar/remover etiquetas + criar, renomear e mudar a cor ali mesmo.
// Reflete no pool de etiquetas do escritório (Configurações › Jurídico).
const DEFAULT_TAG_COLOR = '#3B82F6';

export function LegalTags({
  caseId,
  legalTags,
  onChanged,
}: {
  caseId: string;
  legalTags: LegalTag[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [novo, setNovo] = useState('');
  const [novaCor, setNovaCor] = useState(DEFAULT_TAG_COLOR);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState(DEFAULT_TAG_COLOR);

  const { data: pool = [] } = useQuery({
    queryKey: ['tags', 'legal'],
    queryFn: () => tagsService.list('legal'),
    enabled: open,
  });

  const attached = new Set(legalTags.map((t) => t.tagId));
  const refresh = () => { onChanged(); qc.invalidateQueries({ queryKey: ['tags', 'legal'] }); };

  const toggle = async (tagId: string) => {
    setBusy(true);
    try {
      if (attached.has(tagId)) await tagsService.removeFromCase(caseId, tagId);
      else await tagsService.addToCase(caseId, tagId);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao aplicar etiqueta');
    } finally { setBusy(false); }
  };
  const detach = async (tagId: string) => {
    setBusy(true);
    try { await tagsService.removeFromCase(caseId, tagId); refresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao remover etiqueta'); }
    finally { setBusy(false); }
  };
  const criar = async () => {
    const name = novo.trim();
    if (!name) return;
    setBusy(true);
    try {
      const tag = await tagsService.create({ name, color: novaCor, scope: 'legal' });
      await tagsService.addToCase(caseId, tag.id);
      setNovo(''); setNovaCor(DEFAULT_TAG_COLOR);
      refresh();
      toast.success('Etiqueta criada');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Só sócios podem criar etiquetas');
    } finally { setBusy(false); }
  };
  const startEdit = (id: string, nome: string, cor: string) => { setEditId(id); setEditNome(nome); setEditCor(cor); };
  const salvarEdit = async () => {
    if (!editId) return;
    setBusy(true);
    try {
      await tagsService.update(editId, { name: editNome.trim() || undefined, color: editCor });
      setEditId(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Só sócios podem editar etiquetas');
    } finally { setBusy(false); }
  };
  const excluir = async (id: string) => {
    if (!confirm('Excluir esta etiqueta de TODOS os processos?')) return;
    setBusy(true);
    try { await tagsService.remove(id); setEditId(null); refresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Só sócios podem excluir etiquetas'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {legalTags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: t.tag.color, color: chipTextColor(t.tag.color) }}
        >
          <TagIcon className="h-2.5 w-2.5 opacity-80" />
          {t.tag.name}
          <button type="button" disabled={busy} title="Remover etiqueta" onClick={() => detach(t.tagId)} className="hover:opacity-70">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="relative">
        <button
          type="button"
          title="Gerenciar etiquetas do processo"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:border-[#e11970] hover:text-[#e11970] dark:border-zinc-600"
        >
          <TagIcon className="h-2.5 w-2.5" /> Etiqueta
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setEditId(null); }} />
            <div className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Etiquetas do jurídico</p>
              {pool.length === 0 && <p className="px-3 py-1.5 text-xs text-zinc-400">Nenhuma etiqueta ainda — crie a primeira abaixo.</p>}
              {pool.map((tag) =>
                editId === tag.id ? (
                  <div key={tag.id} className="flex items-center gap-1.5 px-2 py-1.5">
                    <ColorPicker value={editCor} onChange={setEditCor} />
                    <input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvarEdit(); } }}
                      className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[#e11970] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button type="button" disabled={busy} onClick={salvarEdit} title="Salvar" className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={busy} onClick={() => excluir(tag.id)} title="Excluir etiqueta" className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div key={tag.id} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <button type="button" disabled={busy} onClick={() => toggle(tag.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${attached.has(tag.id) ? '' : 'border border-zinc-300 dark:border-zinc-600'}`} style={attached.has(tag.id) ? { background: tag.color } : undefined}>
                        {attached.has(tag.id) && <Check className="h-3 w-3" style={{ color: chipTextColor(tag.color) }} />}
                      </span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tag.color }} />
                      <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{tag.name}</span>
                    </button>
                    <button type="button" onClick={() => startEdit(tag.id, tag.name, tag.color)} title="Renomear / mudar cor" className="rounded p-1 text-zinc-300 opacity-0 hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700"><Pencil className="h-3 w-3" /></button>
                  </div>
                ),
              )}
              <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-100 px-2 pb-1 pt-2 dark:border-zinc-800">
                <ColorPicker value={novaCor} onChange={setNovaCor} />
                <input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); criar(); } }}
                  placeholder="Nova etiqueta…"
                  className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[#e11970] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button type="button" disabled={busy || !novo.trim()} onClick={criar} className="shrink-0 rounded-lg bg-[#e11970] px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40">Criar</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
