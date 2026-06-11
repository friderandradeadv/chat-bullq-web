'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Building2, Check, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  departmentsService,
  type Department,
  type DistributionRule,
} from '@/features/settings/services/departments.service';
import { useOrgId } from '@/hooks/use-org-query-key';

const RULE_LABELS: Record<DistributionRule, string> = {
  ROUND_ROBIN: 'Rodízio (round-robin)',
  LEAST_BUSY: 'Menos ocupado',
  MANUAL: 'Manual',
};

const RULES: DistributionRule[] = ['ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL'];

const SUGGESTIONS = ['Jurídico', 'Comercial', 'Financeiro', 'Suporte', 'Atendimento'];

export default function SettingsDepartmentsPage() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  const [newName, setNewName] = useState('');
  const [newRule, setNewRule] = useState<DistributionRule>('ROUND_ROBIN');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRule, setEditRule] = useState<DistributionRule>('ROUND_ROBIN');

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: () => departmentsService.list(),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['departments'] });

  const handleCreate = async (name?: string) => {
    const finalName = (name ?? newName).trim();
    if (!finalName) return;
    if (
      departments?.some(
        (d) => d.name.toLowerCase() === finalName.toLowerCase(),
      )
    ) {
      toast.error(`Departamento "${finalName}" já existe`);
      return;
    }
    setCreating(true);
    try {
      await departmentsService.create({
        name: finalName,
        distributionRule: name ? 'ROUND_ROBIN' : newRule,
      });
      setNewName('');
      toast.success(`Departamento "${finalName}" criado`);
      refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? 'Erro ao criar departamento',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await departmentsService.update(id, {
        name: editName.trim(),
        distributionRule: editRule,
      });
      setEditingId(null);
      toast.success('Departamento atualizado');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao atualizar');
    }
  };

  const handleDelete = async (dept: Department) => {
    if (dept.isDefault) {
      toast.error('Não é possível remover o departamento padrão');
      return;
    }
    if (!confirm(`Remover o departamento "${dept.name}"?`)) return;
    try {
      await departmentsService.remove(dept.id);
      toast.success('Departamento removido');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditRule(dept.distributionRule);
  };

  const existingNames = new Set(
    (departments ?? []).map((d) => d.name.toLowerCase()),
  );
  const missingSuggestions = SUGGESTIONS.filter(
    (s) => !existingNames.has(s.toLowerCase()),
  );

  return (
    <div>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Departamentos
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Separe o atendimento por setor (ex: Jurídico, Comercial) e defina como
          as conversas são distribuídas entre os membros.
        </p>
      </div>

      {/* Create form */}
      <div className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nome do departamento
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Ex: Jurídico, Comercial..."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Distribuição
          </label>
          <select
            value={newRule}
            onChange={(e) => setNewRule(e.target.value as DistributionRule)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {RULES.map((r) => (
              <option key={r} value={r}>
                {RULE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => handleCreate()}
          disabled={!newName.trim() || creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
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
        ) : !departments?.length ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Building2 className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">
              Nenhum departamento criado
            </p>
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {editingId === dept.id ? (
                <div className="flex flex-1 items-center gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(dept.id)}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <select
                    value={editRule}
                    onChange={(e) =>
                      setEditRule(e.target.value as DistributionRule)
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {RULES.map((r) => (
                      <option key={r} value={r}>
                        {RULE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdate(dept.id)}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Check className="h-3 w-3" /> Salvar
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {dept.name}
                        </span>
                        {dept.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            <Star className="h-2.5 w-2.5" /> Padrão
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {RULE_LABELS[dept.distributionRule]}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(dept)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      disabled={dept.isDefault}
                      title={
                        dept.isDefault
                          ? 'O departamento padrão não pode ser removido'
                          : 'Remover'
                      }
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-900/20"
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
