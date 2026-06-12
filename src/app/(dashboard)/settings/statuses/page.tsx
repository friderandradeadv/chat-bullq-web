'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, CircleDot, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  contactStatusesService,
  type ContactStatus,
} from '@/features/settings/services/contact-statuses.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { useOrgId } from '@/hooks/use-org-query-key';

const PRESET_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280'];

const SUGGESTIONS = ['Novo lead', 'Em atendimento', 'Qualificado', 'Proposta enviada', 'Cliente', 'Perdido'];

export default function SettingsStatusesPage() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newDescription, setNewDescription] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');

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

  const handleCreate = async (name?: string) => {
    const finalName = (name ?? newName).trim();
    if (!finalName) return;
    if (statuses?.some((s) => s.name.toLowerCase() === finalName.toLowerCase())) {
      toast.error(`Status "${finalName}" já existe`);
      return;
    }
    setCreating(true);
    try {
      await contactStatusesService.create({
        name: finalName,
        color: name ? PRESET_COLORS[(statuses?.length ?? 0) % PRESET_COLORS.length] : newColor,
        description: newDescription.trim() || undefined,
        departmentId: newDepartmentId || undefined,
        sortOrder: statuses?.length ?? 0,
      });
      setNewName('');
      setNewDescription('');
      toast.success(`Status "${finalName}" criado`);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao criar status');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await contactStatusesService.update(id, {
        name: editName.trim(),
        color: editColor,
        description: editDescription.trim() || undefined,
        departmentId: editDepartmentId || null,
      });
      setEditingId(null);
      toast.success('Status atualizado');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao atualizar');
    }
  };

  const handleDelete = async (status: ContactStatus) => {
    const count = status._count?.contacts ?? 0;
    const warning = count > 0
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

  const startEdit = (status: ContactStatus) => {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color);
    setEditDescription(status.description ?? '');
    setEditDepartmentId(status.departmentId ?? '');
  };

  const existingNames = new Set((statuses ?? []).map((s) => s.name.toLowerCase()));
  const missingSuggestions = SUGGESTIONS.filter((s) => !existingNames.has(s.toLowerCase()));

  return (
    <div>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Status
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Crie status personalizados para classificar seus contatos no funil
          (ex: Novo lead, Qualificado, Cliente).
        </p>
      </div>

      {/* Create form */}
      <div className="mt-6 space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome do status
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Ex: Novo lead, Cliente..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Cor
            </label>
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-8 w-8 rounded-md transition-transform ${newColor === c ? 'scale-110 ring-2 ring-zinc-400 ring-offset-1' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => handleCreate()}
            disabled={!newName.trim() || creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar
          </button>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Descrição (opcional)
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Quando usar este status..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Departamento (opcional)
            </label>
            <select
              value={newDepartmentId}
              onChange={(e) => setNewDepartmentId(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Todos</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick-add suggestions */}
      {missingSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Sugestões:</span>
          {missingSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleCreate(s)}
              disabled={creating}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50 dark:border-zinc-700"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))
        ) : !statuses?.length ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CircleDot className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">Nenhum status criado</p>
          </div>
        ) : (
          statuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {editingId === status.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(status.id)}
                    className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`h-6 w-6 rounded ${editColor === c ? 'ring-2 ring-zinc-400 ring-offset-1' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Descrição..."
                    className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <select
                    value={editDepartmentId}
                    onChange={(e) => setEditDepartmentId(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Todos</option>
                    {(departments ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdate(status.id)}
                    className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {status.name}
                        </span>
                        {status.department && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${status.department.color}1a`,
                              color: status.department.color,
                            }}
                          >
                            {status.department.name}
                          </span>
                        )}
                        {(status._count?.contacts ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            <Users className="h-2.5 w-2.5" />
                            {status._count!.contacts}
                          </span>
                        )}
                      </div>
                      {status.description && (
                        <span className="text-xs text-zinc-400">
                          {status.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(status)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(status)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
