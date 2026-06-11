'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { queuesService, type BullJob } from '../services/queues.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { toast } from 'sonner';

interface JobDetailDialogProps {
  queueName: string;
  job: BullJob;
  onClose: () => void;
}

function fmtTs(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR');
}

function fmtMs(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  active:            { label: 'Ativo',          icon: Loader2,       color: 'text-blue-500' },
  waiting:           { label: 'Aguardando',      icon: Clock,         color: 'text-zinc-500' },
  'waiting-children':{ label: 'Aguard. filhos',  icon: Clock,         color: 'text-violet-500' },
  delayed:           { label: 'Atrasado',         icon: Clock,         color: 'text-amber-500' },
  completed:         { label: 'Concluído',        icon: CheckCircle2,  color: 'text-emerald-500' },
  failed:            { label: 'Com falha',        icon: AlertTriangle, color: 'text-red-500' },
  paused:            { label: 'Pausado',          icon: Clock,         color: 'text-zinc-400' },
};

export function JobDetailDialog({ queueName, job, onClose }: JobDetailDialogProps) {
  const orgId = useOrgId();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bull-jobs', orgId, queueName] });
    qc.invalidateQueries({ queryKey: ['bull-queues', orgId] });
  };

  const retryMut = useMutation({
    mutationFn: () => queuesService.retryJob(queueName, job.id),
    onSuccess: () => { toast.success('Job reenviado'); invalidate(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => queuesService.removeJob(queueName, job.id),
    onSuccess: () => { toast.success('Job removido'); invalidate(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = STATUS_META[job.status] ?? STATUS_META.waiting;
  const StatusIcon = meta.icon;

  const duration =
    job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusIcon className={`size-4 shrink-0 ${meta.color} ${job.status === 'active' ? 'animate-spin' : ''}`} />
              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                {job.name}
              </span>
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-zinc-800">
                #{job.id}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Fila: <span className="font-medium">{queueName}</span> · {meta.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {/* Timings */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Criado em', value: fmtTs(job.timestamp) },
              { label: 'Processado', value: fmtTs(job.processedOn) },
              { label: 'Finalizado', value: fmtTs(job.finishedOn) },
              { label: 'Duração', value: fmtMs(duration) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{item.label}</p>
                <p className="mt-1 text-xs tabular-nums text-zinc-800 dark:text-zinc-200">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Attempts */}
          {(job.attemptsMade > 0 || job.opts.attempts) && (
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Tentativas</p>
              <p className="mt-1 text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
                {job.attemptsMade} / {(job.opts.attempts as number) ?? '∞'}
              </p>
            </div>
          )}

          {/* Error */}
          {job.failedReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                Motivo da falha
              </p>
              <p className="mt-1 text-xs text-red-800 dark:text-red-300">{job.failedReason}</p>
            </div>
          )}

          {/* Stacktrace */}
          {job.stacktrace?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Stack trace</p>
              <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-300 dark:bg-zinc-800">
                {job.stacktrace.join('\n')}
              </pre>
            </div>
          )}

          {/* Data */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Dados (input)</p>
            <pre className="mt-1 max-h-48 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-300 dark:bg-zinc-800">
              {JSON.stringify(job.data, null, 2)}
            </pre>
          </div>

          {/* Return value */}
          {job.returnvalue != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Retorno</p>
              <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-300 dark:bg-zinc-800">
                {JSON.stringify(job.returnvalue, null, 2)}
              </pre>
            </div>
          )}

          {/* Opts */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Opções</p>
            <pre className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-300 dark:bg-zinc-800">
              {JSON.stringify(job.opts, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          {job.status === 'failed' && (
            <button
              onClick={() => retryMut.mutate()}
              disabled={retryMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" />
              Retentar
            </button>
          )}
          <button
            onClick={() => removeMut.mutate()}
            disabled={removeMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            <Trash2 className="size-3.5" />
            Remover
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
