'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  aiAgentsService,
  CURATED_MODELS,
  DEPARTMENTS,
  type AgentMode,
} from '@/features/ai-agents/services/ai-agents.service';
import { agentFoldersService } from '@/features/ai-agents/services/agent-folders.service';
import { channelsService } from '@/features/channels/services/channels.service';
import {
  PromptMentionEditor,
  type MentionGroup,
} from '@/features/ai-agents/components/prompt-mention-editor';
import { AgentSkillsAndTools } from '@/features/ai-agents/components/agent-skills-tools';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { membersService } from '@/features/settings/services/members.service';
import { quickRepliesService } from '@/features/settings/services/quick-replies.service';
import { useOrgId } from '@/hooks/use-org-query-key';

// Ferramentas builtin que não têm um grupo próprio (status/etiqueta/etc.).
const TOOL_MENTIONS = [
  'Salvar nome',
  'Transferir para humano',
  'Delegar para especialista',
  'Notificar responsável',
];

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const orgId = useOrgId();

  const { data: agent, isLoading, refetch } = useQuery({
    queryKey: ['ai-agent', id],
    queryFn: () => aiAgentsService.findOne(id),
    enabled: !!id,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelId, setModelId] = useState('anthropic/claude-sonnet-4-6');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [parentAgentId, setParentAgentId] = useState('');
  const [department, setDepartment] = useState('');
  const [squad, setSquad] = useState('');
  const [folderId, setFolderId] = useState('');
  const [operationalContext, setOperationalContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelMode, setNewChannelMode] = useState<AgentMode>('AUTONOMOUS');

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setDescription(agent.description ?? '');
    setModelId(agent.modelId);
    setSystemPrompt(agent.systemPrompt);
    setTemperature(agent.temperature);
    setParentAgentId(agent.parentAgentId ?? '');
    setDepartment(agent.department ?? '');
    setSquad(agent.squad ?? '');
    setFolderId(agent.folderId ?? '');
    setOperationalContext(agent.operationalContext ?? '');
  }, [agent]);

  // ── dados que alimentam o menu @ ──────────────────────────────
  const { data: statuses } = useQuery({ queryKey: ['contact-statuses'], queryFn: () => contactStatusesService.list() });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: () => tagsService.list() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsService.list() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const { data: quickReplies } = useQuery({ queryKey: ['quick-replies'], queryFn: () => quickRepliesService.list() });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => channelsService.list() });
  const { data: folders } = useQuery({ queryKey: ['agent-folders'], queryFn: () => agentFoldersService.list() });
  const { data: allAgents } = useQuery({ queryKey: ['ai-agents', orgId], queryFn: () => aiAgentsService.list() });

  const mentionGroups: MentionGroup[] = useMemo(
    () => [
      { type: 'tool', title: 'Ferramentas', items: TOOL_MENTIONS.map((l) => ({ type: 'tool' as const, label: l })) },
      { type: 'status', title: 'Status do funil', items: (statuses ?? []).map((s) => ({ type: 'status' as const, label: s.name })) },
      { type: 'etiqueta', title: 'Etiquetas', items: (tags ?? []).map((t) => ({ type: 'etiqueta' as const, label: t.name })) },
      { type: 'departamento', title: 'Departamentos', items: (departments ?? []).map((d) => ({ type: 'departamento' as const, label: d.name })) },
      { type: 'responsavel', title: 'Responsáveis', items: (members ?? []).map((m) => ({ type: 'responsavel' as const, label: m.user.name })) },
      { type: 'mensagem', title: 'Mensagens rápidas', items: (quickReplies ?? []).map((q) => ({ type: 'mensagem' as const, label: q.shortcut })) },
    ],
    [statuses, tags, departments, members, quickReplies],
  );

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await aiAgentsService.update(agent.id, {
        name,
        description,
        modelId,
        systemPrompt,
        temperature,
        parentAgentId: parentAgentId || null,
        department: department || null,
        squad: squad.trim() || null,
        folderId: folderId || null,
        operationalContext: operationalContext.trim() || null,
      } as any);
      toast.success('Agente salvo');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (!confirm(`Excluir "${agent.name}"? Essa ação é irreversível.`)) return;
    try {
      await aiAgentsService.remove(agent.id);
      toast.success('Agente excluído');
      router.push('/ai-agents?tab=agents');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir');
    }
  };

  const handleAddChannel = async () => {
    if (!agent || !newChannelId) return;
    try {
      await aiAgentsService.assignChannel(agent.id, { channelId: newChannelId, mode: newChannelMode });
      toast.success('Canal vinculado');
      setShowAddChannel(false);
      setNewChannelId('');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao vincular canal');
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!agent) return;
    try {
      await aiAgentsService.unassignChannel(agent.id, channelId);
      toast.success('Canal removido');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao desvincular');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="ml-2 text-sm">Carregando agente…</span>
      </div>
    );
  }
  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
        <p className="text-sm">Agente não encontrado.</p>
        <button onClick={() => router.push('/ai-agents?tab=agents')} className="text-sm text-primary hover:underline">
          ← Voltar para Agentes
        </button>
      </div>
    );
  }

  const availableChannels = (channels ?? []).filter(
    (c) => !agent.channels?.some((ac) => ac.channelId === c.id),
  );
  const isActive = (agent.channels ?? []).length > 0 && agent.isActive;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          onClick={() => router.push('/ai-agents?tab=agents')}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-zinc-900 outline-none hover:border-zinc-200 focus:border-primary/50 focus:bg-white dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus:bg-zinc-900"
        />
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isActive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
        <button
          onClick={handleDelete}
          className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          title="Excluir agente"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-md bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </header>

      {/* Corpo: prompt (esquerda) + config (direita) */}
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
        {/* Prompt */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Instruções Gerais
            </h2>
            <span className="text-[11px] text-zinc-400">
              Digite <kbd className="rounded bg-zinc-200 px-1 font-mono dark:bg-zinc-700">@</kbd> para inserir ferramentas, status, etiquetas…
            </span>
          </div>
          <PromptMentionEditor
            value={systemPrompt}
            onChange={setSystemPrompt}
            groups={mentionGroups}
          />
        </section>

        {/* Config lateral */}
        <aside className="space-y-4">
          <Field label="Descrição">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Modelo">
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="input">
              {CURATED_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label} — {m.badge}</option>
              ))}
              {!CURATED_MODELS.some((m) => m.id === modelId) && (
                <option value={modelId}>{modelId} (custom)</option>
              )}
            </select>
          </Field>

          <Field label={`Criatividade (${temperature.toFixed(2)})`}>
            <input type="range" min="0" max="1.5" step="0.05" value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full" />
          </Field>

          <Field label="Pasta">
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input">
              <option value="">— Sem pasta —</option>
              {(folders ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Organograma</p>
            <div className="mt-2 space-y-2">
              <Field label="Reporta a (chefe direto)">
                <select value={parentAgentId} onChange={(e) => setParentAgentId(e.target.value)} className="input">
                  <option value="">— Raiz / sem chefe —</option>
                  {(allAgents ?? []).filter((a) => a.id !== agent.id).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.kind === 'ORCHESTRATOR' ? ' (Orquestrador)' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Departamento (organograma)">
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input">
                  <option value="">— Não definido —</option>
                  {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </Field>
              <Field label="Squad ágil">
                <input value={squad} onChange={(e) => setSquad(e.target.value)} placeholder="Ex: Inbound B2C" className="input" />
              </Field>
            </div>
          </div>

          <Field label="Contexto operacional do dia">
            <textarea
              value={operationalContext}
              onChange={(e) => setOperationalContext(e.target.value)}
              rows={4}
              maxLength={8000}
              placeholder="Memória viva injetada no prompt (campanha do dia, oferta, aviso)…"
              className="input"
            />
          </Field>

          {/* Canais */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Canais</h4>
              {!showAddChannel && availableChannels.length > 0 && (
                <button onClick={() => setShowAddChannel(true)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300">
                  <Plus className="h-3 w-3" /> Vincular
                </button>
              )}
            </div>
            {showAddChannel && (
              <div className="mt-2 flex items-center gap-2">
                <select value={newChannelId} onChange={(e) => setNewChannelId(e.target.value)} className="input flex-1 text-xs">
                  <option value="">Selecione…</option>
                  {availableChannels.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <button onClick={handleAddChannel} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">OK</button>
                <button onClick={() => setShowAddChannel(false)} className="rounded p-1 text-zinc-400"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="mt-2 space-y-1.5">
              {(agent.channels ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.channel.name}<span className="ml-1.5 text-[10px] text-zinc-400">{c.mode.toLowerCase()}</span></span>
                  <button onClick={() => handleRemoveChannel(c.channelId)} className="rounded p-0.5 text-zinc-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {(agent.channels ?? []).length === 0 && (
                <p className="text-[11px] text-zinc-500">Nenhum canal — o agente não responde ninguém ainda.</p>
              )}
            </div>
          </div>

          <AgentSkillsAndTools agentId={agent.id} />
        </aside>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(212 212 216);
          background: white;
          padding: 0.45rem 0.6rem;
          font-size: 0.8rem;
          color: rgb(24 24 27);
        }
        :global(.dark) .input {
          border-color: rgb(63 63 70);
          background: rgb(39 39 42);
          color: rgb(244 244 245);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
