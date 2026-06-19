'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { KanbanSquare, AlarmClock, Scale } from 'lucide-react';
import { toast } from 'sonner';
import {
  deadlinesService, type Deadline, type DeadlineStatus,
} from '@/features/deadlines/services/deadlines.service';

const COLUMNS: { key: DeadlineStatus; label: string; accent: string }[] = [
  { key: 'OPEN', label: 'Em aberto', accent: '#228BE6' },
  { key: 'DONE', label: 'Concluídos', accent: '#16a34a' },
  { key: 'EXPIRED', label: 'Vencidos', accent: '#dc2626' },
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const KEY = ['deadlines', 'kanban'];

export default function JuridicoKanbanPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () => deadlinesService.list({}),
  });

  const byCol = useMemo(() => {
    const map: Record<string, Deadline[]> = { OPEN: [], DONE: [], EXPIRED: [], CANCELLED: [] };
    for (const d of deadlines) (map[d.status] ??= []).push(d);
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    return map;
  }, [deadlines]);

  const active = deadlines.find((d) => d.id === activeId) ?? null;

  const move = async (d: Deadline, to: DeadlineStatus) => {
    if (d.status === to) return;
    qc.setQueryData<Deadline[]>(KEY, (old) =>
      (old ?? []).map((x) => (x.id === d.id ? { ...x, status: to } : x)),
    );
    try {
      if (to === 'DONE') await deadlinesService.complete(d.id, true);
      else await deadlinesService.update(d.id, { status: to });
      toast.success('Prazo movido');
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY }); // rollback
      toast.error(err?.response?.data?.message || 'Erro ao mover o prazo');
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as DeadlineStatus | undefined;
    const d = deadlines.find((x) => x.id === e.active.id);
    if (to && d && COLUMNS.some((c) => c.key === to)) move(d, to);
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <KanbanSquare className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Kanban de Prazos</h1>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">
        Arraste os prazos entre as colunas para mudar o status.
      </p>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="mt-5 grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column key={col.key} col={col} items={byCol[col.key] ?? []} loading={isLoading} />
          ))}
        </div>
        <DragOverlay>{active ? <Card d={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  col, items, loading,
}: {
  col: { key: DeadlineStatus; label: string; accent: string };
  items: Deadline[];
  loading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] flex-col rounded-xl border bg-white/60 p-3 transition-colors dark:bg-zinc-900/40 ${
        isOver ? 'border-[#228BE6] bg-[#228BE6]/5' : 'border-[#DEE2E6] dark:border-zinc-800'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{col.label}</h2>
        <span className="ml-auto rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
          {items.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {loading && <p className="text-xs text-zinc-400">Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
            Vazio
          </p>
        )}
        {items.map((d) => <Card key={d.id} d={d} />)}
      </div>
    </div>
  );
}

function Card({ d, overlay }: { d: Deadline; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: d.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const overdue = d.status === 'OPEN' && new Date(d.dueDate).getTime() < Date.now();
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-lg border border-[#DEE2E6] bg-white p-3 shadow-sm active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 ${
        isDragging && !overlay ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.title}</p>
        {d.type === 'FATAL' && (
          <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            fatal
          </span>
        )}
      </div>
      {d.case && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" /> {d.case.title}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-zinc-500'}`}>
          <AlarmClock className="h-3 w-3" /> {fmt(d.dueDate)}
        </span>
        {d.assignedTo && (
          <span className="truncate text-[11px] text-zinc-400">{d.assignedTo.name}</span>
        )}
      </div>
    </div>
  );
}
