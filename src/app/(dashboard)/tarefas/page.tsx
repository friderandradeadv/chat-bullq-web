'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogPanel } from '@headlessui/react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, X, Loader2, Calendar, Trash2, User as UserIcon,
} from 'lucide-react';
import {
  tasksService, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS,
  type Task, type TaskStatus, type TaskPriority,
} from '@/features/tasks/services/tasks.service';
import { membersService } from '@/features/settings/services/members.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useAuthStore } from '@/stores/auth-store';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { cn } from '@/lib/utils';

const COLUMNS: TaskStatus[] = ['TODO', 'DOING', 'DONE'];
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  LOW: '#a1a1aa', MEDIUM: '#f59e0b', HIGH: '#ef4444',
};

interface MemberLite { id: string; name: string; avatarUrl: string | null; }

export default function TarefasPage() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  const me = useAuthStore((s) => s.user);
  const [mineOnly, setMineOnly] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', orgId],
    queryFn: () => tasksService.list(),
    refetchInterval: 30_000,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => membersService.list(),
  });

  // userId → {name, avatar} pra mostrar o responsável
  const memberMap = useMemo(() => {
    const m = new Map<string, MemberLite>();
    for (const mem of members as any[]) {
      const u = mem.user;
      if (u?.id) m.set(u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null });
    }
    return m;
  }, [members]);

  const visible = mineOnly && me ? tasks.filter((t) => t.assigneeId === me.id) : tasks;
  const byStatus = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
    for (const t of visible) g[t.status]?.push(t);
    return g;
  }, [visible]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id as string;
    const toStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === toStatus || !COLUMNS.includes(toStatus)) return;

    qc.setQueryData<Task[]>(['tasks', orgId], (prev) =>
      prev ? prev.map((t) => (t.id === taskId ? { ...t, status: toStatus } : t)) : prev);
    try {
      await tasksService.update(taskId, { status: toStatus });
      qc.invalidateQueries({ queryKey: ['tasks', orgId] });
    } catch {
      toast.error('Erro ao mover a tarefa');
      qc.invalidateQueries({ queryKey: ['tasks', orgId] });
    }
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" />
          </span>
          Tarefas
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMineOnly((v) => !v)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              mineOnly
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
            )}
          >
            {mineOnly ? 'Minhas tarefas' : 'Todas'}
          </button>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nova tarefa
          </button>
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Carregando tarefas…</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => {
            const t = tasks.find((x) => x.id === e.active.id);
            if (t) setActiveTask(t);
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-3 overflow-x-auto p-4 min-h-0">
            {COLUMNS.map((col) => (
              <Column
                key={col}
                status={col}
                tasks={byStatus[col]}
                memberMap={memberMap}
                onCardClick={(t) => setEditing(t)}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <Card task={activeTask} memberMap={memberMap} dragging /> : null}</DragOverlay>
        </DndContext>
      )}

      {editing && (
        <TaskDialog
          task={editing === 'new' ? null : editing}
          members={members as any[]}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['tasks', orgId] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Column({
  status, tasks, memberMap, onCardClick,
}: {
  status: TaskStatus; tasks: Task[]; memberMap: Map<string, MemberLite>; onCardClick: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-80 shrink-0 flex-col rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{TASK_STATUS_LABELS[status]}</span>
        <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto rounded-lg px-2 pb-2 min-h-[120px] transition-colors',
          isOver && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/30',
        )}
      >
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-zinc-400">Nenhuma tarefa</p>
        ) : (
          tasks.map((t) => <Card key={t.id} task={t} memberMap={memberMap} onClick={() => onCardClick(t)} />)
        )}
      </div>
    </div>
  );
}

function Card({
  task, memberMap, onClick, dragging,
}: {
  task: Task; memberMap: Map<string, MemberLite>; onClick?: () => void; dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const assignee = task.assigneeId ? memberMap.get(task.assigneeId) : null;
  const overdue = task.dueAt && task.status !== 'DONE' && new Date(task.dueAt).getTime() < Date.now();
  const done = task.status === 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'cursor-grab rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800',
        (isDragging || dragging) && 'opacity-60 shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} title={`Prioridade: ${TASK_PRIORITY_LABELS[task.priority]}`} />
        <p className={cn('flex-1 text-[13px] font-medium text-zinc-900 dark:text-zinc-100', done && 'text-zinc-400 line-through dark:text-zinc-500')}>
          {task.title}
        </p>
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 pl-4 text-[11px] text-zinc-400">{task.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2 pl-4">
        {task.dueAt && (
          <span className={cn('inline-flex items-center gap-1 text-[10px]', overdue ? 'font-medium text-red-500' : 'text-zinc-400')}>
            <Calendar className="h-2.5 w-2.5" />
            {new Date(task.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
        <span className="ml-auto">
          {assignee ? (
            assignee.avatarUrl ? (
              <img src={assignee.avatarUrl} alt={assignee.name} title={assignee.name} className="h-5 w-5 rounded-full object-cover ring-1 ring-black/5" />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-semibold text-white ring-1 ring-black/5" style={{ backgroundColor: avatarColor(assignee.name) }} title={assignee.name}>
                {avatarInitials(assignee.name)}
              </span>
            )
          ) : (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-700 dark:text-zinc-500" title="Sem responsável">
              <UserIcon className="h-3 w-3" />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function TaskDialog({
  task, members, onClose, onSaved,
}: {
  task: Task | null; members: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error('Dê um título à tarefa.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || null,
        dueAt: dueAt ? new Date(dueAt + 'T12:00:00').toISOString() : null,
      };
      if (task) await tasksService.update(task.id, payload);
      else await tasksService.create(payload);
      toast.success(task ? 'Tarefa atualizada' : 'Tarefa criada');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!task || !confirm('Excluir esta tarefa?')) return;
    setDeleting(true);
    try { await tasksService.remove(task.id); toast.success('Tarefa excluída'); onSaved(); }
    catch { toast.error('Erro ao excluir'); } finally { setDeleting(false); }
  };

  const inputCls = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{task ? 'Editar tarefa' : 'Nova tarefa'}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3 p-5">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" className={inputCls} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes (opcional)" rows={3} className={`${inputCls} resize-none`} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500">Prioridade</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500">Prazo</span>
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${inputCls} dark:[color-scheme:dark]`} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-zinc-500">Responsável</span>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
                <option value="">Sem responsável</option>
                {members.map((m) => (
                  <option key={m.user?.id} value={m.user?.id}>{m.user?.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            {task ? (
              <button onClick={del} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
              <button onClick={save} disabled={saving || !title.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {task ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
