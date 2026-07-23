'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { TrendingUp, Search, RefreshCw, X, LayoutGrid, List, Copy, CalendarClock, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase,
} from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { CasesListView } from '@/features/legal-cases/components/cases-list-view';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { PhaseHeader, AddPhaseColumn } from '@/features/legal-cases/components/kanban-card-bits';
import { applyCardSort, kanbanCardKeys, loadPhaseSort, savePhaseSort, type CardSort } from '@/features/legal-cases/lib/kanban-sort';
import { fireConfetti, isTerminalPhase, shouldCelebrate, terminalCardClass } from '@/features/legal-cases/lib/kanban-terminal';
import { useAuthStore } from '@/stores/auth-store';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { matchesKanbanSearch } from '@/features/legal-cases/lib/kanban-search';

const KEY = ['legal-cases', 'kanban', 'plan'];
const ACCENT = '#12B886'; // teal — trilha de planejamento previdenciário

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

export default function PlanejamentoPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  // Abre direto a ficha quando vier ?case=<id> (link "Ver no Kanban" do chat).
  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);

  const [search, setSearch] = useState('');
  const [resp, setResp] = useState('');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [novo, setNovo] = useState(false);
  const dragScroll = useDragScroll();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban({ lane: 'plan' }), refetchInterval: 60_000 });
  const phases = (data?.phases ?? []).filter((p) => p.key.startsWith('plan_')).sort((a, b) => a.order - b.order);
  const cards = data?.cards ?? [];

  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const planKeys = new Set(phases.map((p) => p.key));
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (!planKeys.has(c.phase)) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (!matchesKanbanSearch(c, search, [c.title, c.client])) return false;
      return true;
    });
  }, [cards, search, resp, phases]);

  const byPhase = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of filtered) (map[c.phase] ??= []).push(c);
    return map;
  }, [filtered]);

  const active = cards.find((c) => c.id === activeId) ?? null;

  // Só sócios (OWNER/ADMIN) renomeiam as fases — igual aos demais quadros.
  const activeOrg = useAuthStore((s) => s.organizations.find((o) => o.id === s.activeOrgId));
  const canRename = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';
  const renamePhase = async (key: string, label: string) => {
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, phases: old.phases.map((p) => (p.key === key ? { ...p, label } : p)) } : old,
    );
    try {
      await legalCasesService.renamePhaseLabel(key, label);
      toast.success('Fase renomeada');
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(err?.response?.data?.message || 'Só sócios podem renomear fases');
    }
  };
  const deletePhase = async (phase: KanbanPhase) => {
    const msg = phase.custom
      ? `Excluir a fase "${phase.label}"? Só é possível se não houver processos nela.`
      : `Esconder a fase "${phase.label}" do quadro? Os processos nela continuam existindo — você reexibe em Configurações › Fases.`;
    if (!confirm(msg)) return;
    try {
      const res = await legalCasesService.deletePhase(phase.key);
      toast.success(res.mode === 'hidden' ? 'Fase escondida' : 'Fase excluída');
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao remover fase');
    }
  };

  const move = async (card: KanbanCard, to: string) => {
    if (card.phase === to) return;
    if (shouldCelebrate(phases.find((p) => p.key === to))) fireConfetti();
    qc.setQueryData<KanbanData>(KEY, (old) => old ? { ...old, cards: old.cards.map((x) => x.id === card.id ? { ...x, phase: to } : x) } : old);
    try { await legalCasesService.movePhase(card.id, to); qc.invalidateQueries({ queryKey: KEY }); }
    catch { qc.invalidateQueries({ queryKey: KEY }); toast.error('Erro ao mover'); }
  };
  const reorderPhaseCol = async (phase: KanbanPhase, dir: 'left' | 'right') => {
    const i = phases.findIndex((p) => p.key === phase.key);
    const nb = phases[dir === 'left' ? i - 1 : i + 1];
    if (!nb) return;
    try { await legalCasesService.reorderPhase(phase.key, nb.key); qc.invalidateQueries({ queryKey: KEY }); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Só sócios podem reordenar fases'); }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    const card = cards.find((x) => x.id === e.active.id);
    if (to && card && planKeys.has(to)) move(card, to);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#fafafa] dark:bg-zinc-950 text-[#101820] dark:text-zinc-200 max-lg:overflow-y-auto lg:!pt-12">
      <div className="shrink-0 border-b border-[#dbeaf5] dark:border-zinc-800 px-4 py-2 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Planejamento Previdenciário</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{filtered.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
          <span className="hidden truncate text-xs text-zinc-400 2xl:inline">· do fechamento do contrato até a entrega do planejamento — o card sobe automático ao assinar o contrato</span>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, CPF…"
              className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <select value={resp} onChange={(e) => setResp(e.target.value)} className="h-9 max-w-[200px] rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="">Todos os responsáveis</option>
            {resps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => setNovo(true)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#005efc] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`} style={view === 'kanban' ? { background: ACCENT } : undefined}><LayoutGrid className="h-4 w-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`} style={view === 'lista' ? { background: ACCENT } : undefined}><List className="h-4 w-4" /> Lista</button>
          </div>
        </div>
      </div>

      {view === 'lista' ? (
        <CasesListView byPhase={byPhase} phases={phases} onOpen={setOpenCaseId} accent={ACCENT} />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
          <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
            {isLoading && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
            {!isLoading && phases.map((phase, i) => (
              <Column key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} onOpen={setOpenCaseId} canRename={canRename} onRename={renamePhase} onDelete={deletePhase} onMoveLeft={canRename && i > 0 ? () => reorderPhaseCol(phase, 'left') : undefined} onMoveRight={canRename && i < phases.length - 1 ? () => reorderPhaseCol(phase, 'right') : undefined} />
            ))}
            {!isLoading && canRename && <AddPhaseColumn board="plan" accent={ACCENT} onAdded={() => qc.invalidateQueries({ queryKey: KEY })} />}
          </div>
          <DragOverlay>{active ? <Card c={active} /> : null}</DragOverlay>
        </DndContext>
      )}

      {/* Só as fases do Planejamento no seletor de mover (nunca de outro quadro). */}
      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={phases} onClose={() => setOpenCaseId(null)} />}
      {novo && <NovoCasoDialog targetPhase="plan_novo_cliente" phases={phases} onClose={() => setNovo(false)} onCreated={() => { setNovo(false); qc.invalidateQueries({ queryKey: KEY }); }} />}
    </div>
  );
}

function Column({ phase, items, onOpen, canRename, onRename, onDelete, onMoveLeft, onMoveRight }: { phase: KanbanPhase; items: KanbanCard[]; onOpen: (id: string) => void; canRename: boolean; onRename: (key: string, label: string) => void; onDelete: (phase: KanbanPhase) => void; onMoveLeft?: () => void; onMoveRight?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const [sort, setSort] = useState<CardSort>(() => loadPhaseSort(phase.key));
  const sorted = useMemo(() => applyCardSort(items, sort, kanbanCardKeys), [items, sort]);
  return (
    <div className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#12B886] bg-[#12B886]/5 dark:bg-[#12B886]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <PhaseHeader phase={phase} canRename={canRename} onRename={onRename} onDelete={() => onDelete(phase)} onMoveLeft={onMoveLeft} onMoveRight={onMoveRight} sort={sort} onSort={(s) => { setSort(s); savePhaseSort(phase.key, s); }} />
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {sorted.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {sorted.map((c) => <Card key={c.id} c={c} terminal={isTerminalPhase(phase)} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function Card({ c, terminal, onOpen }: { c: KanbanCard; terminal?: boolean; onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => onOpen?.(c.id)}
      className={`relative cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging ? 'opacity-40' : ''} ${terminal ? terminalCardClass : ''}`}>
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: ACCENT, color: '#fff' }}>Planejamento</span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <span className="truncate">{c.cnj}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº copiado'); }} onPointerDown={(e) => e.stopPropagation()} title="Copiar" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></button>
        </p>
      )}
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
