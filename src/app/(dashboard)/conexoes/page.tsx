'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cable,
  Plus,
  BookOpen,
  Columns3,
  Search,
  MoreHorizontal,
  Settings as SettingsIcon,
  ExternalLink,
  Check,
  Pencil,
  X,
} from 'lucide-react';
import { channelsService, type Channel } from '@/features/channels/services/channels.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { membersService } from '@/features/settings/services/members.service';
import { ZappfyIcon, MetaIcon, InstagramIcon, WhatsAppIcon } from '@/components/ui/icons';
import { useOrgId } from '@/hooks/use-org-query-key';

const channelIcons: Record<string, React.ElementType> = {
  WHATSAPP_ZAPPFY: ZappfyIcon,
  WHATSAPP_EVOLUTION: WhatsAppIcon,
  WHATSAPP_OFFICIAL: MetaIcon,
  INSTAGRAM: InstagramIcon,
};

const channelLabels: Record<string, string> = {
  WHATSAPP_ZAPPFY: 'WhatsApp',
  WHATSAPP_EVOLUTION: 'WhatsApp (Evolution)',
  WHATSAPP_OFFICIAL: 'WhatsApp Oficial',
  INSTAGRAM: 'Instagram',
};

/** Telefone do canal, best-effort (config pode trazer de formas diferentes). */
function channelPhone(ch: Channel): string | null {
  const cfg = (ch.config ?? {}) as Record<string, any>;
  const raw =
    (ch as any).phoneNumber ??
    cfg.phoneNumber ??
    cfg.phone ??
    cfg.number ??
    cfg.instance?.owner ??
    null;
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return String(raw);
}

type ColKey = 'defaultStatus' | 'department' | 'responsible';

export default function ConexoesPage() {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: () => departmentsService.list(),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => membersService.list(),
  });

  const [editing, setEditing] = useState<Channel | null>(null);
  const [search, setSearch] = useState('');
  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    defaultStatus: true,
    department: true,
    responsible: true,
  });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const colsBtnRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => {
      const phone = channelPhone(c) ?? '';
      return (
        c.name.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        (channelLabels[c.type] ?? c.type).toLowerCase().includes(q)
      );
    });
  }, [channels, search]);

  const colDefs: { key: ColKey; label: string }[] = [
    { key: 'defaultStatus', label: 'Status padrão' },
    { key: 'department', label: 'Departamento' },
    { key: 'responsible', label: 'Responsável' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conexões</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie suas conexões com canais de comunicação.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://docs.liderhub.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <BookOpen className="h-4 w-4" /> Docs <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <Link
            href="/settings/channels"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Plus className="h-4 w-4" /> Nova Conexão
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar conexões..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="relative">
          <button
            ref={colsBtnRef}
            onClick={() => setColsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Columns3 className="h-4 w-4" /> Colunas
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColsOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {colDefs.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCols((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {c.label}
                    {cols[c.key] && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th className="px-4 py-3">Conexão</th>
              {cols.defaultStatus && <th className="px-4 py-3">Status padrão</th>}
              {cols.department && <th className="px-4 py-3">Departamento</th>}
              {cols.responsible && <th className="px-4 py-3">Responsável</th>}
              <th className="px-4 py-3">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12">
                  <div className="flex flex-col items-center text-center">
                    <Cable className="h-9 w-9 text-zinc-200 dark:text-zinc-700" />
                    <p className="mt-3 text-sm text-zinc-500">
                      {channels.length === 0
                        ? 'Nenhuma conexão configurada'
                        : 'Nenhuma conexão encontrada'}
                    </p>
                    {channels.length === 0 && (
                      <Link
                        href="/settings/channels"
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Conectar um canal →
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((ch) => {
                const Icon = channelIcons[ch.type] ?? Cable;
                const phone = channelPhone(ch);
                return (
                  <tr
                    key={ch.id}
                    className="bg-white transition-colors hover:bg-zinc-50 dark:bg-transparent dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {ch.name}
                          </p>
                          <p className="truncate text-xs text-zinc-400">
                            {phone ?? channelLabels[ch.type] ?? ch.type}
                          </p>
                        </div>
                      </div>
                    </td>
                    {cols.defaultStatus && <td className="px-4 py-3 text-zinc-400">—</td>}
                    {cols.department && (
                      <td className="px-4 py-3">
                        {ch.department ? (
                          <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: ch.department.color }}
                            />
                            {ch.department.name}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    )}
                    {cols.responsible && (
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                        {ch.defaultAssignee ? (
                          ch.defaultAssignee.name
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          ch.isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            ch.isActive ? 'bg-emerald-500' : 'bg-zinc-400'
                          }`}
                        />
                        {ch.isActive ? 'Conectado' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative flex justify-end">
                        <button
                          onClick={() => setMenuFor(menuFor === ch.id ? null : ch.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuFor === ch.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-9 z-20 w-52 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                              <button
                                onClick={() => {
                                  setMenuFor(null);
                                  setEditing(ch);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar área/responsável
                              </button>
                              <Link
                                href="/settings/channels"
                                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <SettingsIcon className="h-3.5 w-3.5" /> Gerenciar conexão
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!isLoading && channels.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {filtered.length} {filtered.length === 1 ? 'conexão' : 'conexões'}
          </span>
          <span className="flex items-center gap-2">
            Itens por página
            <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">
              10
            </span>
          </span>
        </div>
      )}

      {editing && (
        <EditRoutingModal
          channel={editing}
          departments={departments}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['channels', orgId] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** Modal que vincula uma conexão a uma Área (workspace) + Responsável padrão. */
function EditRoutingModal({
  channel,
  departments,
  members,
  onClose,
  onSaved,
}: {
  channel: Channel;
  departments: { id: string; name: string; color: string }[];
  members: { userId: string; assignable?: boolean; user: { name: string } }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [departmentId, setDepartmentId] = useState(channel.departmentId ?? '');
  const [assigneeId, setAssigneeId] = useState(channel.defaultAssigneeId ?? '');

  const save = useMutation({
    mutationFn: () =>
      channelsService.update(channel.id, {
        departmentId: departmentId || null,
        defaultAssigneeId: assigneeId || null,
      }),
    onSuccess: onSaved,
  });

  const selectableMembers = members.filter((m) => m.assignable !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Área da conexão
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {channel.name} — toda conversa que entrar por este número cai nesta frente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Departamento (frente)
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">— Sem área (fila geral) —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Responsável padrão (opcional)
        </label>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">— Só robô / fila da área —</option>
          {selectableMembers.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>

        {save.isError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Não deu pra salvar. Tente de novo.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
