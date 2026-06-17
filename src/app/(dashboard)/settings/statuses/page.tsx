'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  CircleDot,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  contactStatusesService,
  type ContactStatus,
} from '@/features/settings/services/contact-statuses.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { ColorPicker } from '@/features/settings/components/color-picker';
import { useOrgId } from '@/hooks/use-org-query-key';

const DEFAULT_COLOR = '#3B82F6';

/** Pill colorida preenchida (cor sólida + texto branco) — igual aos Contatos. */
function StatusPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

export default function SettingsStatusesPage() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  const [search, setSearch] = useState('');

  // Drawer (criar/editar)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ContactStatus | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: statuses, isLoading } = useQuery({
    queryKey: ['contact-statuses', orgId],
    queryFn: () => contactStatusesService.list(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: () => departmentsService.list(),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['contact-statuses'] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statuses ?? [];
    return (statuses ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    );
  }, [statuses, search]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(DEFAULT_COLOR);
    setDescription('');
    setDepartmentId('');
    setDrawerOpen(true);
  };

  const openEdit = (status: ContactStatus) => {
    setEditing(status);
    setName(status.name);
    setColor(status.color);
    setDescription(status.description ?? '');
    setDepartmentId(status.departmentId ?? '');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const finalName = name.trim();
    if (!finalName) return;
    const dup = (statuses ?? []).find(
      (s) =>
        s.id !== editing?.id &&
        s.name.toLowerCase() === finalName.toLowerCase(),
    );
    if (dup) {
      toast.error(`Status "${finalName}" já existe`);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await contactStatusesService.update(editing.id, {
          name: finalName,
          color,
          description: description.trim() || undefined,
          departmentId: departmentId || null,
        });
        toast.success('Status atualizado');
      } else {
        await contactStatusesService.create({
          name: finalName,
          color,
          description: description.trim() || undefined,
          departmentId: departmentId || undefined,
          sortOrder: statuses?.length ?? 0,
        });
        toast.success(`Status "${finalName}" criado`);
      }
      setDrawerOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (status: ContactStatus) => {
    const count = status._count?.contacts ?? 0;
    const warning =
      count > 0
        ? `Remover o status "${status.name}"? ${count} contato(s) ficarão sem status.`
        : `Remover o status "${status.name}"?`;
    if (!confirm(warning)) return;
    try {
      await contactStatusesService.remove(status.id);
      toast.success('Status removido');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  return (
    <div>
      {/* Header — estilo LíderHub */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Status
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gerencie os status dos seus contatos e defina fluxos de trabalho.
        </p>
        <button
          onClick={openCreate}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Criar Status
        </button>
      </div>

      {/* Busca */}
      <div className="relative mt-6">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar status..."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-zinc-300 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-950"
        />
      </div>

      {/* Tabela — estilo LíderHub */}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3 text-center">Contatos</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td colSpan={5} className="px-4 py-4">
                    <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                </tr>
              ))
            ) : !filtered.length ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <CircleDot className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
                    <p className="mt-3 text-sm text-zinc-500">
                      {search ? 'Nenhum status encontrado' : 'Nenhum status criado'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((status) => (
                <tr
                  key={status.id}
                  className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3.5">
                    <StatusPill name={status.name} color={status.color} />
                  </td>
                  <td className="max-w-[280px] px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
                    <span className="line-clamp-2">
                      {status.description || (
                        <span className="italic text-zinc-300 dark:text-zinc-600">
                          Sem conteúdo
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {status.department ? (
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${status.department.color}1a`,
                          color: status.department.color,
                          borderColor: `${status.department.color}40`,
                        }}
                      >
                        {status.department.name}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-300">
                    {status._count?.contacts ?? 0}
                  </td>
                  <td className="px-4 py-3.5">
                    <Popover className="relative">
                      <PopoverButton className="rounded-md p-1.5 text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
                        <MoreHorizontal className="h-4 w-4" />
                      </PopoverButton>
                      <PopoverPanel
                        anchor="bottom end"
                        transition
                        className="z-50 mt-1 w-36 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        {({ close }) => (
                          <>
                            <button
                              onClick={() => {
                                close();
                                openEdit(status);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => {
                                close();
                                handleDelete(status);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </button>
                          </>
                        )}
                      </PopoverPanel>
                    </Popover>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer lateral — Novo/Editar Status (estilo LíderHub) */}
      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-y-0 right-0 flex max-w-full">
          <DialogPanel className="flex h-full w-screen max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-950">
            <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
              <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {editing ? 'Editar Status' : 'Novo Status'}
              </DialogTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {editing
                  ? 'Atualize as informações do status'
                  : 'Crie um status para classificar seus contatos'}
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nome
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="Nome do status"
                    autoFocus
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                  />
                  <ColorPicker value={color} onChange={setColor} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Departamento
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                >
                  <option value="">Nenhum (todos)</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Preview
                </p>
                <StatusPill name={name.trim() || 'status'} color={color} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? 'Salvar alterações' : 'Criar Status'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
