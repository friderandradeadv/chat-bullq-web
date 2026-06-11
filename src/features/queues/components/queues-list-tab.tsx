'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Layers,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { queuesService, type QueueSummary } from '../services/queues.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { toast } from 'sonner';

function QueueDetailRow({ queue }: { queue: QueueSummary }) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bull-queues', orgId] });
  };

  const pauseMut = useMutation({
    mutationFn: () =>
      queue.isPaused
        ? queuesService.resumeQueue(queue.name)
        : queuesService.pauseQueue(queue.name),
    onSuccess: () => {
      toast.success(queue.isPaused ? 'Fila retomada' : 'Fila pausada');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cleanCompletedMut = useMutation({
    mutationFn: () => queuesService.cleanQueue(queue.name, 'completed'),
    onSuccess: () => { toast.success('Jobs concluídos removidos'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cleanFailedMut = useMutation({
    mutationFn: () => queuesService.cleanQueue(queue.name, 'failed'),
    onSuccess: () => { toast.success('Jobs com falha removidos'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = queue.counts;
  const total = c.active + c.waiting + c.waitingChildren + c.delayed + c.completed + c.failed;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          type="button"
          className="shrink-0 text-zinc-400"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 shrink-0 text-zinc-400" />
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {queue.name}
            </span>
            {queue.isPaused && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                pausada
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {total} jobs
            {c.active > 0 && <span className="ml-2 text-blue-500">· {c.active} ativo</span>}
            {c.failed > 0 && <span className="ml-2 text-red-500">· {c.failed} com falha</span>}
          </p>
        </div>

        {/* Quick stats chips */}
        <div className="hidden items-center gap-2 sm:flex" onClick={(e) => e.stopPropagation()}>
          {[
            { label: 'ativo',      val: c.active,            cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
            { label: 'aguard.',    val: c.waiting,            cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
            { label: 'atrasado',   val: c.delayed,            cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
            { label: 'concluído',  val: c.completed,          cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
            { label: 'falhou',     val: c.failed,             cls: c.failed > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800/50' },
          ].map((item) => (
            <span key={item.label} className={`rounded-lg px-2 py-1 text-center text-[10px] ${item.cls}`}>
              <span className="block text-sm font-semibold tabular-nums leading-tight">{item.val}</span>
              <span className="block uppercase">{item.label}</span>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => pauseMut.mutate()}
            disabled={pauseMut.isPending}
            title={queue.isPaused ? 'Retomar fila' : 'Pausar fila'}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {queue.isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-xs text-zinc-500">
              Ações de manutenção para a fila <strong>{queue.name}</strong>
            </p>
            {c.completed > 0 && (
              <button
                onClick={() => cleanCompletedMut.mutate()}
                disabled={cleanCompletedMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <Trash2 className="size-3.5" />
                Limpar concluídos ({c.completed})
              </button>
            )}
            {c.failed > 0 && (
              <button
                onClick={() => cleanFailedMut.mutate()}
                disabled={cleanFailedMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                <AlertTriangle className="size-3.5" />
                Limpar falhas ({c.failed})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function QueuesListTab() {
  const orgId = useOrgId();

  const { data: queues = [], isLoading, refetch } = useQuery({
    queryKey: ['bull-queues', orgId],
    queryFn: () => queuesService.listQueues(),
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Filas</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {queues.length} {queues.length === 1 ? 'fila registrada' : 'filas registradas'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : queues.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <Layers className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-500">Nenhuma fila encontrada</p>
          <p className="mt-1 text-xs text-zinc-400">
            Verifique se o BullQ está configurado no backend.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queues.map((q) => (
            <QueueDetailRow key={q.name} queue={q} />
          ))}
        </div>
      )}
    </div>
  );
}
