'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Columns3, AlarmClock, Scale, User, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase,
} from '@/features/legal-cases/services/legal-cases.service';

const KEY = ['legal-cases', 'kanban'];

const STATUS_ACCENT: Record<string, string> = {
  ACTIVE: '#228BE6', SUSPENDED: '#f59e0b', CLOSED: '#16a34a', ARCHIVED: '#71717a',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function FaseJudicialKanbanPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [resp, setResp] = useState('');
  const [showArquivados, setShowArquivados] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: KEY,
    queryFn: () => legalCasesService.kanban({}),
    refetchInterval: 30_000, // vivo: reflete os movimentos automáticos do DJEN
  });

  const phases = data?.phases ?? [];
  const cards = data?.cards ?? [];

  // opções de filtro derivadas dos cards
  const areas = useMemo(
    () => Array.from(new Set(cards.map((c) => c.area).filter(Boolean))).sort() as string[],
    [cards],
  );
  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (area && c.area !== area) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (q) {
        const hay = `${c.title} ${c.cnj ?? ''} ${c.client ?? ''} ${c.opponent ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, search, area, resp]);

  const byPhase = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of filtered) (map[c.phase] ??= []).push(c);
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const ap = a.proximoPrazo?.dueDate ? new Date(a.proximoPrazo.dueDate).getTime() : Infinity;
        const bp = b.proximoPrazo?.dueDate ? new Date(b.proximoPrazo.dueDate).getTime() : Infinity;
        return ap - bp;
      });
    }
    return map;
  }, [filtered]);

  const visiblePhases = useMemo(
    () => phases.filter((p) => showArquivados || (p.key !== 'arquivado' && p.key !== 'abandonado')),
    [phases, showArquivados],
  );

  const active = cards.find((c) => c.id === activeId) ?? null;

  const move = async (card: KanbanCard, toPhase: string) => {
    if (card.phase === toPhase) return;
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === card.id ? { ...x, phase: toPhase } : x)) } : old,
    );
    try {
      await legalCasesService.movePhase(card.id, toPhase);
      const label = phases.find((p) => p.key === toPhase)?.label ?? toPhase;
      toast.success(`Processo movido para "${label}"`);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY }); // rollback
      toast.error(err?.response?.data?.message || 'Erro ao mover o processo');
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    const card = cards.find((x) => x.id === e.active.id);
    if (to && card && phases.some((p) => p.key === to)) move(card, to);
  };

  const total = filtered.length;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      {/* Cabeçalho */}
      <div className="shrink-0 border-b border-[#DEE2E6] dark:border-zinc-800 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Columns3 className="h-5 w-5 text-[#228BE6]" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Fase Judicial</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
            {total} processos
          </span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Arraste os processos entre as fases. O quadro se move sozinho conforme as publicações do DJEN.
        </p>

        {/* Filtros */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, réu, CNJ…"
              className="h-9 w-64 rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="">Todos os responsáveis</option>
            {resps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showArquivados} onChange={(e) => setShowArquivados(e.target.checked)} className="accent-[#228BE6]" />
            Mostrar arquivados/abandonados
          </label>
        </div>
      </div>

      {/* Board horizontal */}
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {isLoading && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
          {!isLoading && visiblePhases.map((phase) => (
            <Column key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} />
          ))}
        </div>
        <DragOverlay>{active ? <Card c={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ phase, items }: { phase: KanbanPhase; items: KanbanCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const accent = STATUS_ACCENT[phase.status] ?? '#228BE6';
  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        <h2 className="truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200">{phase.label}</h2>
        <span className="ml-auto rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded-xl border p-2 transition-colors ${
          isOver ? 'border-[#228BE6] bg-[#228BE6]/5' : 'border-[#DEE2E6] bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/30'
        }`}
      >
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-200 py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">
            Vazio
          </p>
        )}
        {items.map((c) => <Card key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function Card({ c, overlay }: { c: KanbanCard; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const overdue = c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const titulo = c.client && c.opponent ? `${c.client} × ${c.opponent}` : c.title;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-lg border border-[#DEE2E6] bg-white p-2.5 shadow-sm active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 ${
        isDragging && !overlay ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{titulo}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {c.area && (
          <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1971c2] dark:text-[#74c0fc]">
            {c.area}
          </span>
        )}
        {c.value != null && c.value > 0 && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</span>
        )}
      </div>
      {c.cnj && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-zinc-400">
          <Scale className="h-3 w-3 shrink-0" /> {c.cnj}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {c.proximoPrazo ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-600' : 'text-zinc-500'}`}>
            <AlarmClock className="h-3 w-3" /> {fmtDate(c.proximoPrazo.dueDate)}
            {c.proximoPrazo.type === 'FATAL' && <span className="font-bold text-red-600">!</span>}
          </span>
        ) : <span />}
        {c.responsible && (
          <span className="inline-flex items-center gap-1 truncate text-[11px] text-zinc-400">
            <User className="h-3 w-3 shrink-0" />
            {c.responsible.name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}
