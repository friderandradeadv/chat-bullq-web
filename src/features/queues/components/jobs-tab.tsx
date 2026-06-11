'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Layers,
} from 'lucide-react';
import {
  queuesService,
  type JobStatus,
  type BullJob,
} from '../services/queues.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { JobDetailDialog } from './job-detail-dialog';
import { toast } from 'sonner';

const STATUS_OPTIONS: Array<{ value: JobStatus | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'waiting', label: 'Aguardando' },
  { value: 'delayed', label: 'Atrasado' },
  { value: 'completed', label: 'Concluído' },
  { value: 'failed', label: 'Com falha' },
  { value: 'paused', label: 'Pausado' },
];

const STATUS_META: Record<JobStatus, { icon: React.ElementType; color: string; bg: string }> = {
  active:             { icon: Loader2,       color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  waiting:            { icon: Clock,         color: 'text-zinc-600 dark:text-zinc-400',    bg: 'bg-zinc-100 dark:bg-zinc-800/50' },
  'waiting-children': { icon: Clock,         color: 'text-violet-700 dark:text-violet-400',bg: 'bg-violet-50 dark:bg-violet-900/20' },
  delayed:            { icon: Clock,         color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  completed:          { icon: CheckCircle2,  color: 'text-emerald-700 dark:text-emerald-400',bg:'bg-emerald-50 dark:bg-emerald-900/20'},
  failed:             { icon: AlertTriangle, color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20' },
  paused:             { icon: Clock,         color: 'text-zinc-500 dark:text-zinc-500',    bg: 'bg-zinc-100 dark:bg-zinc-800/50' },
};

const PAGE_SIZE = 25;

function fmtTs(ts: number | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return 'agora';
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}min atrás`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR');
}

export function JobsTab() {
  const orgId = useOrgId();
  const qc = useQueryClient();

  const [selectedQueue, setSelectedQueue] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [page, setPage] = useState(0);
  const [selectedJob, setSelectedJob] = useState<BullJob | null>(null);

  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const { data: queues = [] } = useQuery({
    queryKey: ['bull-queues', orgId],
    queryFn: () => queuesService.listQueues(),
    refetchInterval: 10_000,
  });

  const queueName = selectedQueue || queues[0]?.name || '';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bull-jobs', orgId, queueName, statusFilter, page],
    queryFn: () =>
      queueName
        ? queuesService.listJobs(queueName, {
            status: statusFilter || undefined,
            start,
            end,
          })
        : Promise.resolve({ jobs: [], total: 0 }),
    enabled: !!queueName,
    refetchInterval: 5000,
  });

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const retryAllMut = useMutation({
    mutationFn: async () => {
      if (!queueName) return;
      await queuesService.cleanQueue(queueName, 'failed');
    },
    onSuccess: () => {
      toast.success('Jobs com falha limpos');
      qc.invalidateQueries({ queryKey: ['bull-jobs', orgId, queueName] });
      qc.invalidateQueries({ queryKey: ['bull-queues', orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
          Jobs
        </h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Queue selector */}
        <div className="relative">
          <Layers className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <select
            value={selectedQueue}
            onChange={(e) => { setSelectedQueue(e.target.value); setPage(0); }}
            className="rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {queues.map((q) => (
              <option key={q.name} value={q.name}>{q.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as JobStatus | ''); setPage(0); }}
            className="rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {statusFilter === 'failed' && jobs.length > 0 && (
          <button
            onClick={() => retryAllMut.mutate()}
            disabled={retryAllMut.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            Limpar todos com falha
          </button>
        )}
      </div>

      {/* Table */}
      {!queueName ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400">Nenhuma fila disponível</p>
        </div>
      ) : isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500">Nenhum job encontrado</p>
          <p className="mt-1 text-xs text-zinc-400">
            {statusFilter ? `Status: ${statusFilter}` : 'Fila vazia'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-2.5 text-left font-semibold">ID</th>
                <th className="px-4 py-2.5 text-left font-semibold">Nome</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tentativas</th>
                <th className="px-4 py-2.5 text-left font-semibold">Criado</th>
                <th className="px-4 py-2.5 text-left font-semibold">Finalizado</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const sm = STATUS_META[job.status] ?? STATUS_META.waiting;
                const Icon = sm.icon;
                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="cursor-pointer border-b border-zinc-100 bg-white transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] text-zinc-500">{String(job.id).slice(0, 16)}{String(job.id).length > 16 ? '…' : ''}</code>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      {job.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${sm.bg} ${sm.color}`}>
                        <Icon className={`size-3 ${job.status === 'active' ? 'animate-spin' : ''}`} />
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-zinc-500">
                      {job.attemptsMade}
                      {job.opts.attempts ? ` / ${job.opts.attempts}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {fmtTs(job.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {fmtTs(job.finishedOn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{total} jobs · página {page + 1} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {selectedJob && (
        <JobDetailDialog
          queueName={queueName}
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
