'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FlaskConical,
  Loader2,
  Bot,
  Pencil,
  PackageX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrgId } from '@/hooks/use-org-query-key';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { aiAgentsService, type AiAgent } from '../../services/ai-agents.service';
import { agentFoldersService } from '../../services/agent-folders.service';
import { AgentTestPanel } from '../agent-test-panel';
import {
  buildTemplateVMs,
  templateSubtitle,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateVM,
} from './template-helpers';
import { TemplateCard } from './template-card';

function MiniAvatar({ agent }: { agent: AiAgent }) {
  if (agent.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={agent.avatarUrl} alt={agent.name} className="h-7 w-7 rounded-full object-cover" />;
  }
  return (
    <div
      style={{ backgroundColor: avatarColor(agent.name) }}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
    >
      {avatarInitials(agent.name)}
    </div>
  );
}

export function TemplatesMarketplace() {
  const orgId = useOrgId();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const selectedId = params.get('t');

  const [category, setCategory] = useState<TemplateCategory>('Todas');
  const [installing, setInstalling] = useState(false);
  const [testAgent, setTestAgent] = useState<AiAgent | null>(null);
  const [editing, setEditing] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [catDraft, setCatDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: folders } = useQuery({
    queryKey: ['agent-folders', orgId],
    queryFn: () => agentFoldersService.list(),
  });
  const { data: agents } = useQuery({
    queryKey: ['ai-agents', orgId],
    queryFn: () => aiAgentsService.list(),
  });

  const all = useMemo(() => buildTemplateVMs(folders, agents), [folders, agents]);

  const filtered = useMemo(
    () => (category === 'Todas' ? all : all.filter((t) => t.folder.category === category)),
    [all, category],
  );

  const selected: TemplateVM | undefined = useMemo(() => {
    if (selectedId) {
      const hit = all.find((t) => t.folder.id === selectedId);
      if (hit) return hit;
    }
    return filtered[0] ?? all[0];
  }, [all, filtered, selectedId]);

  const select = (id: string) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set('t', id);
    router.replace(`/ai-agents/templates?${p.toString()}`);
  };

  const install = async (vm: TemplateVM) => {
    setInstalling(true);
    try {
      const res = await agentFoldersService.clone(vm.folder.id);
      toast.success(`Template instalado: "${res.folder.name}" (${res.agents} agentes, inativos)`);
      queryClient.invalidateQueries({ queryKey: ['agent-folders'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      router.push('/ai-agents');
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Erro ao instalar template');
      toast.error(msg);
    } finally {
      setInstalling(false);
    }
  };

  const startEdit = (vm: TemplateVM) => {
    setDescDraft(vm.folder.description ?? '');
    setCatDraft(vm.folder.category ?? '');
    setEditing(true);
  };

  const saveEdit = async (vm: TemplateVM) => {
    setSavingEdit(true);
    try {
      await agentFoldersService.update(vm.folder.id, {
        description: descDraft.trim() || null,
        category: catDraft.trim() || null,
      });
      toast.success('Template atualizado');
      queryClient.invalidateQueries({ queryKey: ['agent-folders'] });
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingEdit(false);
    }
  };

  const unpublish = async (vm: TemplateVM) => {
    if (!confirm(`Remover "${vm.folder.name}" dos templates? Ela volta para Pastas.`)) return;
    try {
      await agentFoldersService.update(vm.folder.id, { isTemplate: false });
      toast.success('Template removido da vitrine');
      queryClient.invalidateQueries({ queryKey: ['agent-folders'] });
      router.push('/ai-agents');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const orchestrator = selected?.agents.find((a) => a.kind === 'ORCHESTRATOR') ?? selected?.agents[0];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <button
          onClick={() => router.push('/ai-agents')}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Templates</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Comece rapidamente com templates prontos.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Esquerda: categorias + grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
            {TEMPLATE_CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Bot className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-500">
                  Nenhum template nesta categoria
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((vm) => (
                  <TemplateCard key={vm.folder.id} vm={vm} onClick={() => select(vm.folder.id)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Direita: detalhe */}
        {selected && (
          <aside className="hidden w-96 flex-shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800 lg:flex">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Frider Andrade
                  </span>
                  <BadgeCheck className="h-3 w-3 text-primary" fill="currentColor" stroke="white" />
                </div>
                <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {selected.folder.name}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => (editing ? setEditing(false) : startEdit(selected))}
                  title="Editar template"
                  className={`rounded-lg p-2 transition-colors ${
                    editing
                      ? 'bg-primary/10 text-primary'
                      : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => install(selected)}
                  disabled={installing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Usar template
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {editing ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Descrição</label>
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={2}
                    placeholder="Subtítulo do card (ex.: Pipeline completo de RMC/RCC)"
                    className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <label className="mb-1 mt-2 block text-[11px] font-medium text-zinc-500">Categoria</label>
                  <select
                    value={catDraft}
                    onChange={(e) => setCatDraft(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Sem categoria</option>
                    {TEMPLATE_CATEGORIES.filter((c) => c !== 'Todas').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => unpublish(selected)}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-rose-600 hover:underline"
                    >
                      <PackageX className="h-3.5 w-3.5" /> Remover dos templates
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="rounded-md px-2.5 py-1 text-[12px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(selected)}
                        disabled={savingEdit}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {templateSubtitle(selected)}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                    <span>{selected.agents.length} agente{selected.agents.length === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span>{selected.folder.useCount} {selected.folder.useCount === 1 ? 'uso' : 'usos'}</span>
                    {selected.folder.category && (
                      <>
                        <span>·</span>
                        <span>{selected.folder.category}</span>
                      </>
                    )}
                  </div>
                </>
              )}

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Agentes do template
              </h3>
              <div className="space-y-1.5">
                {selected.agents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2.5 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                  >
                    <MiniAvatar agent={a} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {a.name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {a.kind === 'ORCHESTRATOR' ? 'Orquestrador' : 'Worker'}
                      </p>
                    </div>
                  </div>
                ))}
                {selected.agents.length === 0 && (
                  <p className="text-xs text-zinc-400">Este template ainda não tem agentes.</p>
                )}
              </div>
            </div>

            {orchestrator && (
              <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Inicie uma conversa de teste — veja como o agente inicial responderia.
                </p>
                <button
                  onClick={() => setTestAgent(orchestrator)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Testar {orchestrator.name}
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {testAgent && (
        <AgentTestPanel
          agentId={testAgent.id}
          agentName={testAgent.name}
          systemPrompt={testAgent.systemPrompt ?? ''}
          modelId={testAgent.modelId}
          temperature={testAgent.temperature ?? 0.6}
          onClose={() => setTestAgent(null)}
        />
      )}
    </div>
  );
}
