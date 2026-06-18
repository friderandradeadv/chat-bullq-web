'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  X,
  Star,
  Rss,
  Printer,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type CaseListItem,
  type CaseStatus,
  type CreateCaseInput,
} from '@/features/legal-cases/services/legal-cases.service';

// ─── Estilo "cara do Astrea" (tema claro, azul Astrea) ───────────────
// Componentes próprios; replica o look (não os ativos da Aurum).
export const ASTREA_BLUE = '#228BE6';

const STATUS_LABEL: Record<CaseStatus, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

// Tags coloridas estilo Astrea (pílulas com cor por categoria).
const TAG_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
];
function tagColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

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
    <div className="flex h-full flex-col bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-normal text-zinc-700">Processos e casos</h1>
        <div className="flex items-center gap-2">
          <IconBtn title="Imprimir">
            <Printer className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Exportar">
            <FileDown className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Atualizar" onClick={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })}>
            <RefreshCw className="h-4 w-4" />
          </IconBtn>
          <button
            onClick={() => setCreating(true)}
            title="Novo processo"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm"
            style={{ backgroundColor: ASTREA_BLUE }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 pt-5">
        <div className="relative max-w-2xl flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite algo para pesquisar"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6]"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium uppercase tracking-wide text-zinc-600 outline-none"
        >
          <option value="">Ativos</option>
          {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <p className="px-6 pt-3 text-sm text-zinc-500">
        {cases.length} processo(s) e caso(s)
      </p>

      {/* Tabela */}
      <div className="mt-2 flex-1 overflow-y-auto px-6 pb-6">
        <div className="overflow-hidden rounded-lg border border-[#DEE2E6] bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-xs font-bold uppercase tracking-wide text-[#6C757D]">
                <th className="px-3 py-4">Título</th>
                <th className="px-3 py-4">Cliente / Pasta</th>
                <th className="px-3 py-4">Ação / Foro</th>
                <th className="px-3 py-4 whitespace-nowrap">Últ. mov.</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && cases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Nenhum processo encontrado
                  </td>
                </tr>
              )}
              {cases.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
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

function CaseRow({ c }: { c: CaseListItem }) {
  const client = c.parties[0];
  const tags = [c.area, STATUS_LABEL[c.status]].filter(Boolean) as string[];
  return (
    <tr className="group border-b border-[#DEE2E6] last:border-0 hover:bg-[#f0f7fd]">
      <td className="px-3 py-4 align-top">
        <div className="flex items-start gap-2">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 group-hover:text-amber-400" />
          <Rss className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <Link
              href={`/processos/${c.id}`}
              className="text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline"
            >
              {c.title}
            </Link>
            <p className="mt-0.5 text-xs text-zinc-400">
              Processo {STATUS_LABEL[c.status].toLowerCase()}
              {c.cnjNumber ? (
                <>
                  {' · '}
                  <span className="font-mono text-[#228BE6]">{c.cnjNumber}</span>
                </>
              ) : null}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tagColor(t)}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 align-top text-sm text-zinc-600">
        {client?.name ?? '—'}
      </td>
      <td className="px-3 py-4 align-top">
        <p className="text-sm text-zinc-700">{c.area ?? '—'}</p>
        {c.court && <p className="text-xs text-zinc-400">{c.court}</p>}
      </td>
      <td className="px-3 py-4 align-top whitespace-nowrap text-sm text-zinc-500">
        {fmtDate(c.updatedAt)}
      </td>
    </tr>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
    >
      {children}
    </button>
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 text-zinc-800 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-700">Novo processo</h2>
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
              placeholder="Ex.: Cliente x Banco — Cumprimento de sentença"
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
            <Field label="Ação / Área">
              <input
                value={form.area ?? ''}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className={inputCls}
                placeholder="cível, trabalhista, RMC…"
              />
            </Field>
            <Field label="Vara / Foro">
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: ASTREA_BLUE }}
          >
            {saving ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reaproveitados pelas outras telas jurídicas (estilo claro Astrea).
export const inputCls =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-[#228BE6]';

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
