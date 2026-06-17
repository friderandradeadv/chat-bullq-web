'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Plus, Search, X, Scale } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type CaseListItem,
  type CaseStatus,
  type CreateCaseInput,
} from '@/features/legal-cases/services/legal-cases.service';

const STATUS_LABEL: Record<CaseStatus, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

const STATUS_STYLE: Record<CaseStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ARCHIVED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export default function ProcessosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [creating, setCreating] = useState(false);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['legal-cases', { search, status: statusFilter }],
    queryFn: () =>
      legalCasesService.list({
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <FolderOpen className="h-5 w-5 text-primary" />
            Processos
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Casos, partes, andamentos e prazos — ligados às conversas do cliente
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo processo
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, CNJ ou código interno…"
            className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="mt-6 flex-1 overflow-y-auto">
        {isLoading && <p className="text-sm text-zinc-400">Carregando…</p>}

        {!isLoading && cases.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 p-10 text-center dark:border-zinc-800">
            <Scale className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Nenhum processo encontrado
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cases.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      </div>

      {creating && (
        <CreateCaseDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['legal-cases'] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CaseCard({ c }: { c: CaseListItem }) {
  const client = c.parties[0];
  return (
    <Link
      href={`/processos/${c.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {c.title}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}>
          {STATUS_LABEL[c.status]}
        </span>
      </div>
      {c.cnjNumber && (
        <p className="mt-1 font-mono text-xs text-zinc-500">{c.cnjNumber}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        {client && <span>👤 {client.name}</span>}
        {c.area && <span>{c.area}</span>}
        <span>{c._count.movements} andamentos</span>
        {c._count.deadlines > 0 && (
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {c._count.deadlines} prazo(s)
          </span>
        )}
      </div>
    </Link>
  );
}

function CreateCaseDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateCaseInput>({ title: '' });
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Informe o título do processo');
      return;
    }
    setSaving(true);
    try {
      await legalCasesService.create({
        ...form,
        parties: clientName.trim()
          ? [{ name: clientName.trim(), role: 'CLIENT' }]
          : undefined,
      });
      toast.success('Processo criado');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar processo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Novo processo
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Título *">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="Ex.: Ação de cobrança — Cliente x Banco"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº CNJ">
              <input
                value={form.cnjNumber ?? ''}
                onChange={(e) => setForm({ ...form, cnjNumber: e.target.value })}
                className={inputCls}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </Field>
            <Field label="Código interno">
              <input
                value={form.internalCode ?? ''}
                onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área">
              <input
                value={form.area ?? ''}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className={inputCls}
                placeholder="cível, trabalhista, RMC…"
              />
            </Field>
            <Field label="Vara / Tribunal">
              <input
                value={form.court ?? ''}
                onChange={(e) => setForm({ ...form, court: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Cliente (parte)">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={inputCls}
              placeholder="Nome do cliente"
            />
          </Field>
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
            {saving ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const inputCls =
  'h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
