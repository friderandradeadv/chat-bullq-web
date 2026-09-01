'use client';

import { useEffect, useMemo, useState, useRef} from 'react';
import { produtoColor, areaColor } from '@/features/legal-cases/lib/etiqueta-cores';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Scale, Copy, CalendarClock, Clock, Plus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard, type KanbanPhase } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { PhaseHeader, AddPhaseColumn, type KanbanBoardId } from '@/features/legal-cases/components/kanban-card-bits';
import { useKanbanBulk, KanbanBulkBar, KanbanColumnSelect, KanbanSelectBox, KanbanSelectTrigger, type KanbanBulk } from '@/features/legal-cases/components/kanban-bulk';
import { applyCardSort, kanbanCardKeys, loadPhaseSort, savePhaseSort, SORT_OPTIONS, type CardSort } from '@/features/legal-cases/lib/kanban-sort';
import { avisoOrdenacaoAtiva, cardAttr, colAttr, idsWithMove, persistCardOrder } from '@/features/legal-cases/lib/card-order';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { isTerminalPhase, terminalCardClass } from '@/features/legal-cases/lib/kanban-terminal';
import { usePhaseDrag, applyPhaseDrag } from '@/features/legal-cases/lib/phase-drag';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { phasesOfBoard, type Board } from '@/features/legal-cases/lib/phase-board';
import { useAuthStore } from '@/stores/auth-store';
import { matchesKanbanSearch } from '@/features/legal-cases/lib/kanban-search';
import { useCasesFilter, CasesFilterBanner } from '@/features/legal-cases/lib/use-cases-filter';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

function cleanProduto(s: string | null): string | null {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
}
const colProduto = (p: string | null): string => cleanProduto(p) || 'Sem produto';

export interface AdminBoardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  /** filtro dos cards que entram neste board (ex.: fase inss_admin, área Bancário…). */
  filter: (c: KanbanCard, preKeys: Set<string>) => boolean;
  /** texto quando não há nenhum card. */
  emptyHint?: string;
  /** colunas fixas por FASE (ex.: as 8 fases do pipe bancário). Sem isto, agrupa por produto. */
  columns?: { key: string; label: string }[];
  /** colunas derivadas das fases do endpoint (respeita rename/ordem/esconder/custom das Configurações). */
  columnsFromPhases?: (p: KanbanPhase) => boolean;
  /** trilha do board — escopa a busca no servidor (performance). Aceita a chave de um quadro CUSTOM (board_*). */
  lane?: 'pre' | 'judicial' | 'banco' | (string & {});
  /** habilita gerência de fases inline (renomear/excluir/criar) neste quadro — só sócios. */
  manageBoard?: KanbanBoardId;
  /** quadro cujas fases aparecem no seletor de mover da ficha do card (default 'banco'). */
  drawerBoard?: Board;
  /** botão "Novo caso" no cabeçalho (abre o dialog na página); ausente = sem botão. */
  onNewCard?: () => void;
  /** controle extra no cabeçalho, à esquerda da busca (ex.: o toggle Exequente ×
   *  Executado do quadro Execução & Repasse). O estado vive na página. */
  toolbar?: React.ReactNode;
}

/**
 * Board de leitura para uma trilha administrativa (INSS / bancária). Reaproveita
 * os cards do kanban jurídico, filtra pela trilha e agrupa por PRODUTO em colunas.
 * Cards clicáveis abrem a ficha (sem drag — a trilha não é uma fase movível).
 */
export function AdminBoard({ title, subtitle, icon: Icon, accent, filter, emptyHint, columns: colDefs, columnsFromPhases, lane, manageBoard, drawerBoard, onNewCard, toolbar }: AdminBoardProps) {
  // queryKey por lane (mesma convenção dos demais boards) — evita colisão de cache.
  const KEY = ['legal-cases', 'kanban', lane ?? 'all'];
  const qc = useQueryClient();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Seleção em massa (caixinha no card + barra de ações no rodapé).
  const bulk = useKanbanBulk();
  const dragScroll = useDragScroll();

  // Gerência de fases inline (só sócios) — mesma capacidade dos demais quadros.
  const activeOrg = useAuthStore((s) => s.organizations.find((o) => o.id === s.activeOrgId));
  const canManage = !!manageBoard && (activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN');
  const renamePhase = async (key: string, label: string) => {
    try { await legalCasesService.renamePhaseLabel(key, label); toast.success('Fase renomeada'); qc.invalidateQueries({ queryKey: KEY }); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Só sócios podem renomear fases'); }
  };
  const deletePhase = async (phase: { key: string; label: string; custom?: boolean }) => {
    // Confirmação (e a saída dos processos) já vieram do ExcluirFaseDialog.
    try {
      const res = await legalCasesService.deletePhase(phase.key);
      toast.success(res.mode === 'hidden' ? 'Fase removida do quadro — volta em Configurações › Fases' : 'Fase excluída');
      qc.invalidateQueries({ queryKey: KEY });
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao remover fase'); }
  };
  const reorderPhaseCol = async (key: string, dir: 'left' | 'right') => {
    const i = columns.findIndex((c) => c.key === key);
    const nb = columns[dir === 'left' ? i - 1 : i + 1];
    if (!nb?.key) return;
    try { await legalCasesService.reorderPhase(key, nb.key); qc.invalidateQueries({ queryKey: KEY }); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Só sócios podem reordenar fases'); }
  };
  // Arrastar a COLUNA (segurar o cabeçalho da fase e soltar na posição nova).
  const phaseDrag = usePhaseDrag({
    enabled: canManage,
    accent,
    scrollRef: dragScroll.ref,
    onDrop: (k, alvo, onde) => applyPhaseDrag(qc, KEY, k, alvo, onde),
  });
  // Ordenação dos cards por coluna (preferência de visualização, no localStorage).
  const [sorts, setSorts] = useState<Record<string, CardSort>>({});
  const sortOf = (key: string): CardSort => sorts[key] ?? loadPhaseSort(key);
  const setSortFor = (key: string, s: CardSort) => { setSorts((p) => ({ ...p, [key]: s })); savePhaseSort(key, s); };

  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);

  // Recorte "só os processos deste cliente" (?cases=… vindo do chat).
  const casesFilter = useCasesFilter();

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban(lane ? { lane } : {}), refetchInterval: 60_000 });
  const preKeys = useMemo(() => new Set((data?.phases ?? []).filter((p) => p.lane === 'pre').map((p) => p.key)), [data]);

  const filtered = useMemo(() => {
    return (data?.cards ?? []).filter((c) => {
      if (!filter(c, preKeys)) return false;
      if (!matchesKanbanSearch(c, search, [c.title, c.client, c.opponent])) return false;
      if (!casesFilter.matchesCasesFilter(c.id)) return false;
      return true;
    });
  }, [data, search, filter, preKeys, casesFilter.caseIds]);

  const columns = useMemo<{ nome: string; cards: KanbanCard[]; key?: string; custom?: boolean }[]>(() => {
    // Colunas derivadas das fases do endpoint (respeita Configurações › Fases).
    if (columnsFromPhases) {
      const phs = (data?.phases ?? []).filter(columnsFromPhases).sort((a, b) => a.order - b.order);
      if (phs.length) return phs.map((p) => ({ nome: p.label, key: p.key, custom: !!p.custom, cards: filtered.filter((c) => c.phase === p.key) }));
      // fallback (API ainda sem as fases): usa as colunas estáticas se houver.
    }
    // Colunas fixas por FASE (pipe fiel): mantém a ordem e mostra até as vazias.
    if (colDefs) return colDefs.map((cd) => ({ nome: cd.label, key: cd.key, cards: filtered.filter((c) => c.phase === cd.key) }));
    // Senão, agrupa por produto (INSS, bancária por área).
    const map = new Map<string, KanbanCard[]>();
    for (const c of filtered) {
      const k = colProduto(c.produto);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return Array.from(map, ([nome, cards]) => ({ nome, cards })).sort((a, b) => b.cards.length - a.cards.length);
  }, [filtered, colDefs, columnsFromPhases, data]);

  // Destinos do "mover em massa": só colunas que são FASE deste quadro (o
  // agrupamento por produto não tem `key` e não é destino possível).
  const bulkPhases = columns
    .filter((c) => !!c.key)
    .map((c) => {
      const p = data?.phases?.find((ph) => ph.key === c.key);
      return { key: c.key!, label: c.nome, terminal: p?.terminal, status: p?.status };
    });

  // ARRASTE DO CARD — dnd-kit, o MESMO dos outros quadros (Judicial, Pré,
  // Planejamento, Funil). Antes daqui havia um arraste caseiro de ponteiro que
  // só reordenava dentro da coluna e não tinha overlay: o card não "vinha
  // junto", e em coluna vazia não havia retorno nenhum. Reescrever à mão o que
  // o dnd-kit já faz foi o erro; agora o comportamento é o mesmo do resto do
  // hub — card flutuando, coluna alvo destacada, clique preservado.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCard = (data?.cards ?? []).find((c) => c.id === activeId) ?? null;

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const destino = e.over?.id as string | undefined;
    const card = (data?.cards ?? []).find((c) => c.id === e.active.id);
    if (!destino || !card) return;

    // ── troca de FASE ──────────────────────────────────────────────────────
    if (card.phase !== destino) {
      const alvo = (data?.phases ?? []).find((p) => p.key === destino);
      // Mesmo endpoint do seletor da ficha — registra o movimento, ajusta o
      // status e reclassifica —, mas SEM avisar o cliente: `movePhase` só avisa
      // com `avisarCliente: true`, e arrastar não é escolha deliberada.
      legalCasesService
        .movePhase(card.id, destino)
        .then(() => {
          toast.success(`Movido para ${alvo?.label ?? destino}`);
          qc.invalidateQueries({ queryKey: KEY });
        })
        .catch((err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(msg || 'Não consegui mover o card de fase.');
          qc.invalidateQueries({ queryKey: KEY });
        });
      return;
    }

    // ── mesma coluna: só ORDEM ────────────────────────────────────────────
    // O aviso de ordenação ativa vale só aqui: uma regra de ordenação
    // reordenaria tudo de novo, mas não impede o card de mudar de fase.
    const sort = sortOf(destino);
    if (sort !== 'manual') {
      avisoOrdenacaoAtiva(SORT_OPTIONS.find((o) => o.id === sort)?.label ?? sort);
    }
  };

  return (
    // lg:!pt-12 encolhe o respiro global do topo (o `.under-bar > *` põe 3.75rem;
    // 3rem basta pra passar a barra de vidro) e o cabeçalho vira UMA linha —
    // o quadro sobe e os cards ganham altura, sem esmagar nada.
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#fafafa] text-[#101820] dark:bg-zinc-950 dark:text-zinc-200 max-lg:overflow-y-auto lg:!pt-12">
      {casesFilter.caseIds && (
        <CasesFilterBanner
          cliente={casesFilter.cliente}
          total={filtered.length}
          onClear={casesFilter.clear}
        />
      )}
      <div className="shrink-0 border-b border-[#dbeaf5] px-4 py-2 lg:px-6 dark:border-zinc-800">
        {/* Título + dica + busca na MESMA linha (quebra se faltar espaço) */}
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" style={{ color: accent }} />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{filtered.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
          <span className="hidden truncate text-xs text-zinc-400 2xl:inline">· {subtitle}</span>
          {toolbar && <div className="ml-auto flex items-center">{toolbar}</div>}
          <div className={`relative ${toolbar ? '' : 'ml-auto'}`}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, banco, CPF…"
              className="h-9 w-60 rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          {onNewCard && (
            <button onClick={onNewCard} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white" style={{ background: accent }}>
              <Plus className="h-4 w-4" /> Novo caso
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-6 text-sm text-zinc-400">Carregando…</p>
      ) : !colDefs && !columnsFromPhases && filtered.length === 0 ? (
        <div className="px-6 py-10">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {emptyHint ?? 'Nenhum card nesta trilha ainda.'}
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
          {columns.map((col, i) => {
            const sortedCards = col.key ? applyCardSort(col.cards, sortOf(col.key), kanbanCardKeys, data?.cardOrder?.[col.key]) : col.cards;
            const colTerminal = isTerminalPhase(col.key ? data?.phases?.find((p) => p.key === col.key) : null);
            return (
            <div key={col.key ?? col.nome} ref={col.key ? phaseDrag.columnRef(col.key) : undefined}
              style={col.key ? phaseDrag.columnStyle(col.key) : undefined}
              className="group/col flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border border-[#dcdfe5] bg-[#f2f2f2] transition-shadow dark:border-transparent dark:bg-black/55">
              <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
                {col.key ? (
                  <PhaseHeader
                    phase={{ key: col.key, label: col.nome, custom: col.custom }}
                    canRename={canManage}
                    onRename={renamePhase}
                    onDelete={deletePhase}
                    drag={phaseDrag.handle(col.key)}
                    cardIds={sortedCards.map((c) => c.id)}
                    phases={columns.filter((c) => !!c.key).map((c) => ({ key: c.key!, label: c.nome }))}
                    onMoveLeft={canManage && i > 0 && columns[i - 1]?.key ? () => reorderPhaseCol(col.key!, 'left') : undefined}
                    onMoveRight={canManage && i < columns.length - 1 && columns[i + 1]?.key ? () => reorderPhaseCol(col.key!, 'right') : undefined}
                    sort={sortOf(col.key)}
                    onSort={(s) => setSortFor(col.key!, s)}
                    onSelect={(todos) => { bulk.startSelecting(); if (todos) bulk.setMany(sortedCards.map((c) => c.id), true); }}
                  />
                ) : (
                  <>
                    <h2 className="truncate text-sm font-medium" style={{ color: accent }}>{col.nome}</h2>
                    <KanbanSelectTrigger bulk={bulk} accent={accent} />
                  </>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <KanbanColumnSelect bulk={bulk} ids={sortedCards.map((c) => c.id)} accent={accent} />
                  <span className="rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{col.cards.length}</span>
                </span>
              </div>
              <ColunaDrop phaseKey={col.key} accent={accent} attrs={col.key ? colAttr(col.key) : {}}>
                {/* Coluna VAZIA sob o cursor: sem isto o arraste para cá não dá
                    retorno nenhum — a marca de queda se apoia num card vizinho,
                    e aqui não existe vizinho. Num pipeline a maioria das colunas
                    está vazia, então este era o caso comum, não a exceção. */}
                {sortedCards.length === 0 && <VazioOuSoltarAqui phaseKey={col.key} accent={accent} />}
                {sortedCards.map((c) => <AdminCard key={c.id} c={c} terminal={colTerminal} bulk={bulk} colIds={sortedCards.map((x) => x.id)} accent={accent} onOpen={setOpenCaseId} />)}
              </ColunaDrop>
            </div>
            );
          })}
          {canManage && manageBoard && <AddPhaseColumn board={manageBoard} accent={accent} onAdded={() => qc.invalidateQueries({ queryKey: KEY })} />}
        </div>
        {/* O card que o usuário está segurando: é ISTO que dá a sensação de
            "estar sendo arrastado" (Trello/Pipefy). Vive fora do fluxo das
            colunas, então não empurra layout nem some ao trocar de coluna. */}
        <DragOverlay>{activeCard ? <AdminCard c={activeCard} accent={accent} onOpen={() => {}} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <KanbanBulkBar bulk={bulk} cards={filtered} phases={bulkPhases} queryKey={KEY} accent={accent} />

      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={phasesOfBoard(data?.phases ?? [], drawerBoard ?? 'banco')} onClose={() => setOpenCaseId(null)} />}
    </div>
  );
}

/**
 * Corpo da coluna = área de SOLTURA do dnd-kit. Precisa ser componente próprio
 * porque `useDroppable` é hook e as colunas nascem dentro de um `.map`.
 * O anel na cor do quadro mostra ONDE o card vai cair — e aqui cair na coluna
 * errada muda a FASE do processo, não só a posição na lista.
 */
function ColunaDrop({ phaseKey, accent, attrs, children }: {
  phaseKey?: string; accent: string; attrs: Record<string, unknown>; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phaseKey ?? '__sem_fase__', disabled: !phaseKey });
  return (
    <div
      ref={setNodeRef}
      {...attrs}
      style={isOver && phaseKey ? { boxShadow: `inset 0 0 0 2px ${accent}`, borderRadius: 12 } : undefined}
      className="flex flex-col gap-2.5 px-2.5 pb-2.5 transition-shadow lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      {children}
    </div>
  );
}

/** Coluna vazia: sem card vizinho não há onde desenhar a marca de queda, e num
 *  pipeline a maioria das colunas está vazia — este é o caso comum. */
function VazioOuSoltarAqui({ phaseKey, accent }: { phaseKey?: string; accent: string }) {
  const { isOver } = useDroppable({ id: phaseKey ? `${phaseKey}__vazio` : '__sem_fase_vazio__', disabled: true });
  void isOver;
  return (
    <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">
      Vazio
    </p>
  );
}

function AdminCard({ c, terminal, bulk, colIds, accent, onOpen, overlay }: { c: KanbanCard; terminal?: boolean; bulk?: KanbanBulk; colIds?: string[]; accent?: string; overlay?: boolean;
  onOpen: (id: string) => void }) {
  // `overlay` = a cópia que voa junto com o cursor (DragOverlay). Ela não é
  // arrastável nem clicável: é só a imagem do card em trânsito.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id, disabled: overlay });
  const down = useRef<{ x: number; y: number } | null>(null);
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  return (
    // <div role=button> (não <button>): a caixinha de seleção é um controle
    // dentro do card, e controle dentro de <button> é HTML inválido.
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      {...(overlay ? { role: 'presentation' } : cardAttr(c.id))}
      onPointerDownCapture={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        if (overlay) return;
        const d = down.current;
        if (d && Math.abs(e.clientX - d.x) < 6 && Math.abs(e.clientY - d.y) < 6) onOpen(c.id);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(c.id); } }}
      className={`group relative w-full touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${
        isDragging && !overlay ? 'opacity-40' : 'cursor-pointer'
      } ${overlay ? 'rotate-2 shadow-lg' : ''} ${terminal && !overlay ? terminalCardClass : ''}`}
      style={{
        ...(bulk?.has(c.id) && accent ? { boxShadow: `0 0 0 2px ${accent}` } : undefined),
        // O card original acompanha o ponteiro por transform; a cópia do
        // DragOverlay é posicionada pelo próprio dnd-kit.
        ...(transform && !overlay ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
      }}>
      {bulk && <KanbanSelectBox bulk={bulk} id={c.id} colIds={colIds} accent={accent} />}
      {/* pr-5 reserva o canto da caixinha de seleção */}
      <div className="-ml-1 flex flex-wrap items-center gap-1 pr-5">
        {c.produto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{cleanProduto(c.produto)}</span>}
        {c.areaJuridica && (() => { const a = areaColor(c.areaJuridica); return (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: a.bg, color: a.fg }}>{c.areaJuridica}</span>
        ); })()}
        {/* Etiquetas (EntityTag/Astrea) NÃO vão na face do card — só na ficha (fix 406b46f). */}
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" /><span className="truncate">{c.cnj}</span>
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº do processo copiado'); }} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></span>
        </p>
      )}
      {/* APENSO fundido neste card (o cumprimento autuado em apartado): um processo,
          um card — mas o número dos autos do apenso fica à vista, porque é NELE que
          se peticiona, e o valor executado costuma estar lá, não no valor da causa. */}
      {(c.apensos ?? []).map((ap) => (
        <p key={ap.id} className="mt-1 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500" title="Processo apensado (mesmo processo, autos próprios)">
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{ap.cnj ?? 'apenso sem nº'}</span>
          {ap.cnj && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(ap.cnj!); toast.success('Nº dos autos apensados copiado'); }} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></span>
          )}
          {ap.value != null && ap.value > 0 && <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(ap.value)}</span>}
        </p>
      ))}
      {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
      {c.proximoPrazo && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400" title="Tempo na fase atual"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
        {c.responsible && (c.responsible.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.responsible.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
          : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>)}
      </div>
    </div>
  );
}
