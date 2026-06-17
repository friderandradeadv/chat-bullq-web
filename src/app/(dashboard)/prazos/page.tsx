'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deadlinesService,
  type Deadline,
  type DeadlineStatus,
  type PrazoPreview,
} from '@/features/deadlines/services/deadlines.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inputCls, Field } from '../processos/page';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function urgencyStyle(safeDate: string): string {
  const d = daysUntil(safeDate);
  if (d < 0) return 'border-l-red-600';
  if (d <= 1) return 'border-l-red-500';
  if (d <= 3) return 'border-l-amber-500';
  if (d <= 7) return 'border-l-yellow-400';
  return 'border-l-zinc-300 dark:border-l-zinc-700';
}

export default function PrazosPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<DeadlineStatus>('OPEN');
  const [creating, setCreating] = useState(false);

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ['deadlines', { status }],
    queryFn: () => deadlinesService.list({ status }),
  });

  const sorted = useMemo(
    () => [...deadlines].sort((a, b) => +new Date(a.safeDate) - +new Date(b.safeDate)),
    [deadlines],
  );

  const complete = async (d: Deadline) => {
    const confirmFatal = d.type === 'FATAL';
    if (confirmFatal && !confirm(`Prazo FATAL "${d.title}". Confirmar como cumprido?`)) return;
    try {
      await deadlinesService.complete(d.id, confirmFatal);
      toast.success('Prazo concluído');
      qc.invalidateQueries({ queryKey: ['deadlines'] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  const cancel = async (d: Deadline) => {
    if (!confirm(`Cancelar o prazo "${d.title}"?`)) return;
    try {
      await deadlinesService.cancel(d.id);
      toast.success('Prazo cancelado');
      qc.invalidateQueries({ queryKey: ['deadlines'] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f5f6f8] p-6 text-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Clock className="h-5 w-5 text-primary" />
            Prazos
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Data fatal + prazo de segurança (CPC 219/224) · alertas D-7/D-3/D-1/D-0
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo prazo
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        {(['OPEN', 'DONE', 'EXPIRED', 'CANCELLED'] as DeadlineStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === s
                ? 'bg-primary text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {{ OPEN: 'Abertos', DONE: 'Cumpridos', EXPIRED: 'Vencidos', CANCELLED: 'Cancelados' }[s]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1 space-y-2 overflow-y-auto">
        {isLoading && <p className="text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhum prazo.</p>
        )}
        {sorted.map((d) => {
          const du = daysUntil(d.safeDate);
          return (
            <div
              key={d.id}
              className={`flex items-center justify-between rounded-lg border border-l-4 border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${urgencyStyle(d.safeDate)}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {d.title}
                  {d.type === 'FATAL' && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      FATAL
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {d.case?.title ?? '—'}
                  {d.case?.cnjNumber ? ` · ${d.case.cnjNumber}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Fatal {fmt(d.dueDate)} · segurança {fmt(d.safeDate)}
                  {d.status === 'OPEN' && (
                    <span className={du < 0 ? ' font-semibold text-red-600' : du <= 3 ? ' font-semibold text-amber-600' : ''}>
                      {' '}
                      ({du < 0 ? `${Math.abs(du)}d atrasado` : `faltam ${du}d`})
                    </span>
                  )}
                </p>
              </div>
              {d.status === 'OPEN' && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => complete(d)}
                    title="Concluir"
                    className="rounded-md p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => cancel(d)}
                    title="Cancelar"
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateDeadlineDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['deadlines'] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateDeadlineDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'FATAL' | 'ORDINARY' | 'INTERNAL'>('ORDINARY');
  const [dias, setDias] = useState(15);
  const [disponibilizacao, setDisp] = useState(new Date().toISOString().slice(0, 10));
  const [dobro, setDobro] = useState(false);
  const [preview, setPreview] = useState<PrazoPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: cases = [] } = useQuery({
    queryKey: ['legal-cases', 'select'],
    queryFn: () => legalCasesService.list({ status: 'ACTIVE' }),
  });

  const doPreview = async () => {
    try {
      const p = await deadlinesService.preview({ dias, disponibilizacao, dobro });
      setPreview(p);
    } catch (err: any) {
      toast.error(err?.message || 'Erro no cálculo');
    }
  };

  const submit = async () => {
    if (!caseId) return toast.error('Selecione o processo');
    if (!title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      await deadlinesService.create({
        caseId,
        title: title.trim(),
        type,
        dias,
        disponibilizacao,
        dobro,
      });
      toast.success('Prazo criado');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Novo prazo</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Processo *">
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={inputCls}>
              <option value="">Selecione…</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.cnjNumber ? `(${c.cnjNumber})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Contestação" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls}>
                <option value="ORDINARY">Comum</option>
                <option value="FATAL">Fatal</option>
                <option value="INTERNAL">Interno</option>
              </select>
            </Field>
            <Field label="Dias úteis">
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Disponibilização">
              <input type="date" value={disponibilizacao} onChange={(e) => setDisp(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={dobro} onChange={(e) => setDobro(e.target.checked)} />
            Prazo em dobro (CPC 183/186/229)
          </label>

          <button
            onClick={doPreview}
            className="w-full rounded-md border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Calcular prazo
          </button>

          {preview && (
            <div className="rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                Data fatal: {fmt(preview.dataFatal)}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Prazo de segurança: {fmt(preview.prazoSeguranca)}
              </p>
              <p className="mt-1 flex items-start gap-1 text-xs text-zinc-500">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {preview.modo}
                {preview.dobro ? ' · em dobro' : ''}
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Criar prazo'}
          </button>
        </div>
      </div>
    </div>
  );
}
