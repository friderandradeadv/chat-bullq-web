'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderInput,
  Copy,
  PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import {
  aiAgentsService,
  type AiAgent,
} from '../services/ai-agents.service';
import {
  agentFoldersService,
  type AgentFolder,
} from '../services/agent-folders.service';
import { AgentAvatar } from './agent-avatar';
import { useOrgId } from '@/hooks/use-org-query-key';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maxUpdatedAt(agents: AiAgent[], fallback?: string): string | undefined {
  if (agents.length === 0) return fallback;
  return agents.reduce(
    (acc, a) => (a.updatedAt > acc ? a.updatedAt : acc),
    agents[0].updatedAt,
  );
}

export function AgentsFolderView({
  agents,
  onEdit,
  onToggleActive,
}: {
  agents: AiAgent[];
  onEdit: (a: AiAgent) => void;
  onToggleActive: (a: AiAgent) => void;
}) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['__none__']));
  const [hideEmpty, setHideEmpty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} agente(s)? Essa ação é irreversível.`)) return;
    let ok = 0;
    for (const id of ids) {
      try {
        await aiAgentsService.remove(id);
        ok++;
      } catch {
        /* segue mesmo se um falhar */
      }
    }
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    toast.success(`${ok} de ${ids.length} agente(s) excluído(s)`);
  };

  const { data: folders } = useQuery({
    queryKey: ['agent-folders', orgId],
    queryFn: () => agentFoldersService.list(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['agent-folders'] });
    queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
  };

  // Agrupa agentes por folderId.
  const byFolder = useMemo(() => {
    const map = new Map<string, AiAgent[]>();
    for (const a of agents) {
      const key = a.folderId ?? '__none__';
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return map;
  }, [agents]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await agentFoldersService.create({ name, sortOrder: folders?.length ?? 0 });
      toast.success('Pasta criada');
      setNewName('');
      setCreating(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar pasta');
    }
  };

  const saveRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return setRenaming(null);
    try {
      await agentFoldersService.update(id, { name });
      setRenaming(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao renomear');
    }
  };

  const deleteFolder = async (f: AgentFolder) => {
    if (
      !confirm(
        `Excluir a pasta "${f.name}"? Os agentes dela voltam para "Sem pasta".`,
      )
    )
      return;
    try {
      await agentFoldersService.remove(f.id);
      toast.success('Pasta excluída');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  // "Usar como modelo": clona a pasta + todos os agentes (inativos), pra
  // partir de um pipeline pronto. Base da biblioteca de templates.
  const [cloningId, setCloningId] = useState<string | null>(null);
  const cloneFolder = async (f: AgentFolder) => {
    setCloningId(f.id);
    try {
      const res = await agentFoldersService.clone(f.id);
      toast.success(`Modelo instalado: "${res.folder.name}" (${res.agents} agentes)`);
      refresh();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Erro ao usar o modelo');
      toast.error(msg);
    } finally {
      setCloningId(null);
    }
  };

  const moveAgent = async (agent: AiAgent, folderId: string | null) => {
    try {
      await aiAgentsService.update(agent.id, { folderId });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mover');
    }
  };

  // "Publicar como template": a pasta vira modelo instalável (vai pra vitrine
  // "Templates de Agentes" e sai do PASTAS). Reversível no marketplace.
  const publishAsTemplate = async (f: AgentFolder) => {
    try {
      await agentFoldersService.update(f.id, { isTemplate: true });
      toast.success(`"${f.name}" publicada como template`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao publicar template');
    }
  };

  // PASTAS = só pastas de trabalho (templates aparecem na vitrine, não aqui).
  // Ordena por sortOrder; "Sem pasta" entra à parte mais abaixo.
  const orderedFolders = useMemo(
    () =>
      [...(folders ?? [])]
        .filter((f) => !f.isTemplate)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [folders],
  );
  const noneAgents = byFolder.get('__none__') ?? [];

  const rows: Array<{ folder: AgentFolder | null; agents: AiAgent[] }> = [
    ...orderedFolders.map((f) => ({
      folder: f,
      agents: byFolder.get(f.id) ?? [],
    })),
    { folder: null, agents: noneAgents },
  ];

  const visibleRows = hideEmpty
    ? rows.filter((r) => r.agents.length > 0 || r.folder === null)
    : rows;

  return (
    <div className="px-6 py-4">
      {/* Barra de ações em massa — só aparece quando há agentes selecionados */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium text-primary">
            {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Limpar
            </button>
            <button
              onClick={bulkDelete}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" /> Apagar selecionados
            </button>
          </div>
        </div>
      )}

      {/* Barra de ações da seção PASTAS */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Pastas
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Ocultar pastas vazias
          </label>
        </div>
        {creating ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Nome da pasta"
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={createFolder}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            >
              Criar
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="rounded-md px-2 py-1 text-xs text-zinc-500"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Nova pasta
          </button>
        )}
      </div>

      {/* Cabeçalho da tabela */}
      <div className="flex items-center border-b border-zinc-200 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
        <span className="flex-1">Nome</span>
        <span className="w-44 text-right">Última edição</span>
        <span className="w-8" />
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {visibleRows.map(({ folder, agents: group }) => {
          const key = folder?.id ?? '__none__';
          const isOpen = expanded.has(key);
          const lastEdit = maxUpdatedAt(group, folder?.updatedAt);
          return (
            <div key={key}>
              {/* Linha da pasta */}
              <div className="group flex items-center px-2 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <button
                  onClick={() => toggle(key)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
                    style={
                      folder?.color
                        ? { backgroundColor: `${folder.color}1a`, color: folder.color }
                        : undefined
                    }
                  >
                    <Folder
                      className={`h-4 w-4 ${folder?.color ? '' : 'text-zinc-400'}`}
                    />
                  </span>
                  {renaming === key && folder ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(folder.id);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onBlur={() => saveRename(folder.id)}
                      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  ) : (
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {folder ? folder.name : 'Sem pasta'}
                    </span>
                  )}
                  <span className="ml-1 text-xs text-zinc-400">
                    {group.length} {group.length === 1 ? 'agente' : 'agentes'}
                  </span>
                </button>
                <span className="w-44 text-right text-xs text-zinc-400">
                  {fmtDate(lastEdit)}
                </span>
                <div className="flex w-8 justify-end">
                  {folder && (
                    <Menu as="div" className="relative">
                      <MenuButton
                        onClick={(e) => e.stopPropagation()}
                        className="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 group-hover:opacity-100 dark:hover:bg-zinc-700"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </MenuButton>
                      <MenuItems className="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-lg border border-zinc-200 bg-white py-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900">
                        <MenuItem>
                          <button
                            onClick={() => {
                              setRenaming(key);
                              setRenameValue(folder.name);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Renomear
                          </button>
                        </MenuItem>
                        <MenuItem>
                          <button
                            onClick={() => cloneFolder(folder)}
                            disabled={cloningId === folder.id}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <Copy className="h-3.5 w-3.5" /> Usar como modelo
                          </button>
                        </MenuItem>
                        <MenuItem>
                          <button
                            onClick={() => publishAsTemplate(folder)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <PackagePlus className="h-3.5 w-3.5" /> Publicar como template
                          </button>
                        </MenuItem>
                        <MenuItem>
                          <button
                            onClick={() => deleteFolder(folder)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </Menu>
                  )}
                </div>
              </div>

              {/* Agentes da pasta */}
              {isOpen && (
                <div className="pb-1 pl-8">
                  {group.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-zinc-400">
                      Pasta vazia.
                    </p>
                  ) : (
                    group.map((a) => (
                      <AgentRow
                        key={a.id}
                        agent={a}
                        folders={orderedFolders}
                        selected={selected.has(a.id)}
                        onToggleSelect={toggleSelect}
                        onEdit={onEdit}
                        onToggleActive={onToggleActive}
                        onMove={moveAgent}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  folders,
  selected,
  onToggleSelect,
  onEdit,
  onToggleActive,
  onMove,
}: {
  agent: AiAgent;
  folders: AgentFolder[];
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (a: AiAgent) => void;
  onToggleActive: (a: AiAgent) => void;
  onMove: (a: AiAgent, folderId: string | null) => void;
}) {
  const isOrchestrator = agent.kind === 'ORCHESTRATOR';
  return (
    <div className={`group/row flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${selected ? 'bg-primary/5' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(agent.id)}
        onClick={(e) => e.stopPropagation()}
        title="Selecionar"
        className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 dark:border-zinc-600"
      />
      <button
        onClick={() => onEdit(agent)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <AgentAvatar agent={agent} size="sm" rounded="rounded-md" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {agent.name}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${
                isOrchestrator
                  ? 'bg-primary/10 text-primary'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {isOrchestrator ? 'Orquestrador' : 'Worker'}
            </span>
          </span>
          <span className="block truncate text-[11px] text-zinc-400">
            {agent.modelId}
          </span>
        </span>
      </button>

      {/* Liga/desliga — switch óbvio (patcha isActive na hora) */}
      <button
        onClick={() => onToggleActive(agent)}
        title={
          agent.isActive
            ? 'Ligado — clique para desligar'
            : 'Desligado — clique para ligar'
        }
        className="flex flex-shrink-0 items-center gap-1.5"
      >
        <span
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
            agent.isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
              agent.isActive ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </span>
        <span
          className={`w-[52px] text-left text-[10px] font-medium ${
            agent.isActive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-400'
          }`}
        >
          {agent.isActive ? 'Ligado' : 'Desligado'}
        </span>
      </button>

      {/* Mover para pasta */}
      <Menu as="div" className="relative flex-shrink-0">
        <MenuButton className="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 group-hover/row:opacity-100 dark:hover:bg-zinc-700">
          <FolderInput className="h-4 w-4" />
        </MenuButton>
        <MenuItems className="absolute right-0 z-20 mt-1 max-h-64 w-48 origin-top-right overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase text-zinc-400">
            Mover para
          </p>
          {folders.map((f) => (
            <MenuItem key={f.id}>
              <button
                onClick={() => onMove(agent, f.id)}
                disabled={agent.folderId === f.id}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Folder className="h-3.5 w-3.5 text-zinc-400" /> {f.name}
              </button>
            </MenuItem>
          ))}
          <MenuItem>
            <button
              onClick={() => onMove(agent, null)}
              disabled={!agent.folderId}
              className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              Sem pasta
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>
  );
}
