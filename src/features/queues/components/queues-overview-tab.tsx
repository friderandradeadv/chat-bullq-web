'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Pause,
  Play,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { queuesService, type QueueSummary } from '../services/queues.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { toast } from 'sonner';

function totalJobs(q: QueueSummary) {
  const c = q.counts;
  return c.active + c.waiting + c.waitingChildren + c.delayed + c.completed + c.failed;
}

function StatusBadge({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className={`rounded-lg px-2.5 py-1.5 text-center ${color}`}>
      <p className="text-lg font-semibold tabular-nums">{count}</p>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
    </div>
  );
}

function QueueRow({ queue, onAction }: { queue: QueueSummary; onAction: () => void }) {
  const qc = useQueryClient();
  const orgId = useOrgId();

  const pauseMut = useMutation({
    mutationFn: () =>
      queue.isPaused
        ? queuesService.resumeQueue(queue.name)
        : queuesService.pauseQueue(queue.name),
    onSuccess: () => {
      toast.success(queue.isPaused ? 'Fila retomada' : 'Fila pausada');
      qc.invalidateQueries({ queryKey: ['bull-queues', orgId] });
      onAction();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cleanMut = useMutation({
    mutationFn: () => queuesService.cleanQueue(queue.name, 'failed'),
    onSuccess: () => {
      toast.success('Jobs com falha removidos');
      qc.invalidateQueries({ queryKey: ['bull-queues', orgId] });
      onAction();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = queue.counts;
  const total = totalJobs(queue);
  const failPct = total > 0 ? Math.round((c.failed / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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
            {total} jobs total
            {c.failed > 0 && (
              <span className="ml-2 text-red-500">· {failPct}% falhas</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => pauseMut.mutate()}
            disabled={pauseMut.isPending}
            title={queue.isPaused ? 'Retomar' : 'Pausar'}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {queue.isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          {c.failed > 0 && (
            <button
              onClick={() => cleanMut.mutate()}
              disabled={cleanMut.isPending}
              title="Limpar jobs com falha"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatusBadge
          count={c.active}
          label="Ativo"
          color="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
        />
        <StatusBadge
          count={c.waiting}
          label="Aguard."
          color="bg-zinc-50 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400"
        />
        <StatusBadge
          count={c.delayed}
          label="Atrasado"
          color="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
        />
        <StatusBadge
          count={c.completed}
          label="Concluído"
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
        />
        <StatusBadge
          count={c.failed}
          label="Falhou"
          color={
            c.failed > 0
              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800/50'
          }
        />
        <StatusBadge
          count={c.waitingChildren}
          label="Aguard. filho"
          color="bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400"
        />
      </div>

      {c.failed > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full bg-red-500" style={{ width: `${failPct}%` }} />
        </div>
      )}
    </div>
  );
}

export function QueuesOverviewTab() {
  const orgId = useOrgId();

  const { data: queues = [], isLoading, refetch } = useQuery({
    queryKey: ['bull-queues', orgId],
    queryFn: () => queuesService.listQueues(),
    refetchInterval: 5000,
  });

  const totalActive = queues.reduce((s, q) => s + q.counts.active, 0);
  const totalWaiting = queues.reduce((s, q) => s + q.counts.waiting + q.counts.waitingChildren, 0);
  const totalFailed = queues.reduce((s, q) => s + q.counts.failed, 0);
  const totalCompleted = queues.reduce((s, q) => s + q.counts.completed, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Visão geral
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {queues.length} {queues.length === 1 ? 'fila' : 'filas'} · atualiza a cada 5s
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

      {totalFailed > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-700 dark:bg-red-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              {totalFailed} {totalFailed === 1 ? 'job com falha' : 'jobs com falha'} nas filas
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">
              Acesse a aba Jobs para inspecionar e retentar individualmente.
            </p>
          </div>
        </div>
      )}

      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Ativo</p>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {isLoading ? '…' : totalActive}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">em processamento agora</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Aguardando</p>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {isLoading ? '…' : totalWaiting}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">na fila para processar</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Concluídos</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {isLoading ? '…' : totalCompleted}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">finalizados com sucesso</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Com falha</p>
            <AlertTriangle className={`h-4 w-4 ${totalFailed > 0 ? 'text-red-500' : 'text-zinc-400'}`} />
          </div>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${totalFailed > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {isLoading ? '…' : totalFailed}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">precisam de atenção</p>
        </div>
      </div>

      {/* Per-queue breakdown */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : queues.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <Layers className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-500">Nenhuma fila encontrada</p>
          <p className="mt-1 text-xs text-zinc-400">
            Verifique se a API do BullQ está configurada em{' '}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">NEXT_PUBLIC_API_URL</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queues.map((q) => (
            <QueueRow key={q.name} queue={q} onAction={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
