'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, X, Loader2, FlaskConical, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  aiAgentsService,
  CURATED_MODELS,
  DEPARTMENTS,
  type AgentMode,
  type AiAgent,
} from '@/features/ai-agents/services/ai-agents.service';
import { agentFoldersService } from '@/features/ai-agents/services/agent-folders.service';
import { channelsService } from '@/features/channels/services/channels.service';
import {
  PromptMentionEditor,
  type MentionGroup,
  type MentionItem,
  type MentionType,
} from '@/features/ai-agents/components/prompt-mention-editor';
import { AgentSkillsAndTools } from '@/features/ai-agents/components/agent-skills-tools';
import { AgentTestPanel } from '@/features/ai-agents/components/agent-test-panel';
import { PromptVersionsSection } from '@/features/ai-agents/components/prompt-versions-section';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { membersService } from '@/features/settings/services/members.service';
import { quickRepliesService } from '@/features/settings/services/quick-replies.service';
import { aiCatalogService } from '@/features/ai-agents/services/ai-catalog.service';
import { zapSignService } from '@/features/settings/services/zapsign.service';
import { useOrgId } from '@/hooks/use-org-query-key';

// Rótulo curto em PT-BR por tool (o chip continua sendo o NOME REAL — é o que
// o LLM enxerga). Tool fora do mapa cai no fallback (descrição do backend).
const TOOL_HINTS: Record<string, string> = {
  replyToConversation: 'Responder o cliente',
  transferToHuman: 'Transferir pra atendente humano (fila)',
  tagConversation: 'Aplicar etiqueta na conversa',
  listAvailableAgents: 'Listar agentes disponíveis',
  delegateToAgent: 'Delegar pra um especialista',
  handBackToOrchestrator: 'Devolver pro orquestrador',
  lookupOffering: 'Buscar preço/condições oficiais',
  checkBonusEligibility: 'Conferir elegibilidade de bônus',
  checkMembersAccess: 'Conferir acesso na área de membros',
  setContactStatus: 'Mudar status do contato no funil',
  setDepartment: 'Definir departamento da conversa',
  assignResponsible: 'Atribuir responsável',
  saveContactName: 'Salvar o nome do contato',
  sendQuickReply: 'Enviar mensagem rápida',
  notifyMember: 'Notificar um membro da equipe',
  disableAi: 'Desativar a IA na conversa',
  generateZapSignDocument: 'Gera contrato/documento via ZapSign',
};

// Variáveis da empresa (injetadas em runtime). Aparecem no menu @ em "Dados
// gerais" e viram chip. (Os valores reais vivem no backend; aqui é só o rótulo.)
const ORG_VARIABLE_LABELS = [
  'Nome do escritório',
  'Endereço do escritório',
  'OAB',
  'CNPJ',
  'Instagram',
  'Site',
  'email',
  'Data e hora atual',
  'Nome do contato',
];

// @menções herdadas do LíderHub que o BullQ ainda não tem como ENTIDADE.
// Reconhecidas só pra virar chip (NÃO entram no menu @) — sem isso, multi-
// palavra como `@Nome do escritório`/`@Desativar IA`/`@Selecione DOCUMENTOS…`
// ficariam texto cru. Casamento é "maior label primeiro", então não conflita.
const LIDERHUB_EXTRA_LABELS: MentionItem[] = (
  [
    // Tools que só existem no LíderHub (visual; mapeamento funcional é no prompt)
    ['Salvar Nome', 'tool'],
    ['Desativar IA', 'tool'],
    ['Ativar áudio', 'tool'],
    ['Base de conhecimento', 'tool'],
    ['Gerar resumo com IA', 'tool'],
    ['Preparar Kit', 'tool'],
    ['Calculadora', 'tool'],
    // Departamentos (caso o backend ainda não tenha)
    ['Comercial', 'departamento'],
    ['Pós-venda', 'departamento'],
    ['Jurídico', 'departamento'],
    // Status do funil herdados
    ['Recepção', 'status'],
    ['Proposta Aceita', 'status'],
    ['Fechamento Pendente', 'status'],
    // Responsáveis / membros conhecidos
    ['Maria Jullia Pepato Portela Kantarutt', 'responsavel'],
    ['Responsável legal', 'responsavel'],
    // Etiquetas herdadas
    ['INSS', 'etiqueta'],
    ['Servidor', 'etiqueta'],
    ['Honorários Iniciais', 'etiqueta'],
    ['Honorários no Êxito', 'etiqueta'],
    ['ZapSign', 'etiqueta'],
    // Mensagens rápidas (atalhos) usadas nos prompts do trabalhista/RMC
    ['boasvindas', 'mensagem'],
    ['boas-vindas', 'mensagem'],
    ['propostatrabalhista', 'mensagem'],
    ['serio', 'mensagem'],
    ['assinatura', 'mensagem'],
    ['contrib', 'mensagem'],
    ['hiscon', 'mensagem'],
    ['follow6-qualificado', 'mensagem'],
    // Templates ZapSign (documentos) — multi-palavra
    ['Selecione DOCUMENTOS - RMC | RCC', 'tool'],
    ['DOCUMENTOS - DIREITO SUPRIMIDO', 'tool'],
    ['RESCISÃO INDIRETA', 'tool'],
    ['RECONHECIMENTO VÍNCULO', 'tool'],
  ] as [string, MentionType][]
).map(([label, type]) => ({ label, type }));

/** Avatares prontos (DiceBear avataaars) pro agente — visual amigável. */
const AGENT_AVATAR_SEEDS = [
  'Aneka', 'Felix', 'Mia', 'Leo', 'Sasha', 'Nina',
  'Bruno', 'Lara', 'Theo', 'Cleo', 'Ravi', 'Yuki',
];
const avatarUrlForSeed = (seed: string) =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const orgId = useOrgId();
  const qc = useQueryClient();

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [responseDelaySeconds, setResponseDelaySeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelMode, setNewChannelMode] = useState<AgentMode>('AUTONOMOUS');
  const [showTest, setShowTest] = useState(false);
  const [creatingSub, setCreatingSub] = useState(false);

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
    setAvatarUrl(agent.avatarUrl ?? null);
    setResponseDelaySeconds(agent.responseDelaySeconds ?? 0);
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
  const { data: builtinTools } = useQuery({ queryKey: ['builtin-tools'], queryFn: () => aiCatalogService.listBuiltinTools() });
  const { data: customTools } = useQuery({ queryKey: ['custom-tools'], queryFn: () => aiCatalogService.listTools() });
  // Templates ZapSign → categoria "Zapsign" do menu @ (igual ao LíderHub).
  // retry:false porque getTemplates lança se a integração não estiver ativa.
  const { data: zapTemplates } = useQuery({ queryKey: ['zapsign-templates'], queryFn: () => zapSignService.getTemplates(), retry: false });

  // Tools disponíveis pro kind do agente (ORCHESTRATOR/WORKER). Chip = nome
  // real da tool (o LLM mapeia pelo nome); hint = rótulo curto PT-BR.
  const toolItems = useMemo(() => {
    const kind = agent?.kind;
    return (builtinTools ?? [])
      .filter((t) => !kind || t.kinds.includes(kind as 'ORCHESTRATOR' | 'WORKER'))
      .map((t) => ({
        type: 'tool' as const,
        label: t.name,
        hint: TOOL_HINTS[t.name] ?? t.description.slice(0, 60),
      }));
  }, [builtinTools, agent?.kind]);

  // Ordem/nomes espelham o menu @ do LíderHub. Categorias sem dados (ex: Zapsign
  // se a integração não estiver ativa, Custom Tools se a org não tiver) somem
  // sozinhas (o editor filtra grupos vazios).
  const mentionGroups: MentionGroup[] = useMemo(
    () => [
      { type: 'departamento', title: 'Departamento', items: (departments ?? []).map((d) => ({ type: 'departamento' as const, label: d.name })) },
      { type: 'status', title: 'Status', items: (statuses ?? []).map((s) => ({ type: 'status' as const, label: s.name })) },
      { type: 'etiqueta', title: 'Etiquetas', items: (tags ?? []).map((t) => ({ type: 'etiqueta' as const, label: t.name })) },
      { type: 'responsavel', title: 'Responsáveis', items: (members ?? []).map((m) => ({ type: 'responsavel' as const, label: m.user.name })) },
      { type: 'variavel', title: 'Dados gerais', items: ORG_VARIABLE_LABELS.map((label) => ({ type: 'variavel' as const, label })) },
      { type: 'tool', title: 'Ferramentas', items: toolItems },
      { type: 'customtool', title: 'Custom Tools', items: (customTools ?? []).map((t) => ({ type: 'customtool' as const, label: t.name, hint: t.description?.slice(0, 60) })) },
      { type: 'mensagem', title: 'Mensagens', items: (quickReplies ?? []).map((q) => ({ type: 'mensagem' as const, label: q.shortcut })) },
      { type: 'zapsign', title: 'Zapsign', items: (zapTemplates ?? []).map((t) => ({ type: 'zapsign' as const, label: t.name, hint: 'Gera contrato usando ZapSign' })) },
    ],
    [toolItems, statuses, tags, departments, members, quickReplies, customTools, zapTemplates],
  );

  // Labels só pra reconhecimento (viram chip, fora do menu): os herdados do
  // LíderHub + nomes dos agentes (refs de delegação como `@AG. 1 - Triagem`).
  const extraLabels: MentionItem[] = useMemo(
    () => [
      ...LIDERHUB_EXTRA_LABELS,
      ...(allAgents ?? []).map((a) => ({ type: 'responsavel' as const, label: a.name })),
    ],
    [allAgents],
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
        avatarUrl,
        responseDelaySeconds,
      } as any);
      toast.success('Agente salvo');
      refetch();
      // Invalida a LISTA também, senão os cards/nós seguem com o avatar antigo.
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // "Adicionar agente" no grupo (estilo LíderHub): cria um MEMBRO (subagente
  // WORKER) sob o agente inicial do grupo, INATIVO e sem canal (o backend não
  // auto-vincula subagentes), e abre o editor dele.
  const handleAddSubagent = async () => {
    if (!agent) return;
    const root =
      agent.parentAgentId
        ? (allAgents ?? []).find((a) => a.id === agent.parentAgentId) ?? agent
        : agent;
    setCreatingSub(true);
    try {
      const created = await aiAgentsService.create({
        name: 'Novo subagente',
        kind: 'WORKER',
        systemPrompt:
          'Você é um especialista. Descreva aqui o papel deste subagente e quando o agente inicial deve delegar pra ele.',
        parentAgentId: root.id,
        folderId: root.folderId ?? null,
        isActive: false,
        modelId: agent.modelId,
      });
      toast.success('Subagente criado');
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      router.push(`/ai-agents/${created.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao criar subagente');
    } finally {
      setCreatingSub(false);
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
          onClick={() => setShowTest(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          title="Testar agente numa conversa de teste"
        >
          <FlaskConical className="h-4 w-4" /> Testar
        </button>
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

      {showTest && agent && (
        <AgentTestPanel
          agentId={agent.id}
          agentName={name || agent.name}
          systemPrompt={systemPrompt}
          modelId={modelId}
          temperature={temperature}
          onClose={() => setShowTest(false)}
        />
      )}

      {/* Corpo: grupo de agentes (esq) + prompt (centro) + config (dir) */}
      <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[250px_1fr_340px]">
        {/* Grupo: AGENTE INICIAL + MEMBROS (subagentes) — estilo LíderHub */}
        <AgentGroupPanel
          agent={agent}
          allAgents={allAgents ?? []}
          creating={creatingSub}
          onAdd={handleAddSubagent}
          onOpen={(aid) => router.push(`/ai-agents/${aid}`)}
        />

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
            extraLabels={extraLabels}
          />
          <CapacityMeter chars={systemPrompt.length} />
          <PromptVersionsSection
            agentId={agent.id}
            currentSystemPrompt={systemPrompt}
            currentOperationalContext={operationalContext}
            onRestore={(p, oc) => {
              setSystemPrompt(p);
              setOperationalContext(oc);
            }}
          />
        </section>

        {/* Config lateral */}
        <aside className="space-y-4">
          <Field label="Avatar">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-[9px] font-medium text-zinc-500 ${!avatarUrl ? 'border-primary ring-2 ring-primary/30' : 'border-zinc-300 dark:border-zinc-600'}`}
                title="Sem avatar (iniciais)"
              >
                Padrão
              </button>
              {AGENT_AVATAR_SEEDS.map((seed) => {
                const url = avatarUrlForSeed(seed);
                const active = avatarUrl === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`h-9 w-9 overflow-hidden rounded-full border bg-white ${active ? 'border-primary ring-2 ring-primary/30' : 'border-zinc-200 dark:border-zinc-700'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full" />
                  </button>
                );
              })}
            </div>
          </Field>

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

          <Field label="Tempo de resposta (segundos)">
            <>
              <input
                type="number"
                min={0}
                max={60}
                value={responseDelaySeconds}
                onChange={(e) =>
                  setResponseDelaySeconds(
                    Math.min(60, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
                className="input"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Atraso antes de responder — deixa o atendimento mais humano. 0 = instantâneo.
              </p>
            </>
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

          <AgentSkillsAndTools agentId={agent.id} agentKind={agent.kind} />
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

/** Painel do GRUPO (estilo LíderHub): AGENTE INICIAL (orquestrador raiz) +
 *  MEMBROS (subagentes), navegável, com "Adicionar agente" pra criar membro. */
function AgentGroupPanel({
  agent,
  allAgents,
  creating,
  onAdd,
  onOpen,
}: {
  agent: AiAgent;
  allAgents: AiAgent[];
  creating: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  // Raiz do grupo = o pai (se este for membro) ou o próprio (se for o inicial).
  const root = agent.parentAgentId
    ? allAgents.find((a) => a.id === agent.parentAgentId) ?? agent
    : agent;
  const members = allAgents
    .filter((a) => a.parentAgentId === root.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const Row = ({ a }: { a: AiAgent }) => {
    const current = a.id === agent.id;
    const initials =
      a.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'AG';
    return (
      <button
        type="button"
        onClick={() => !current && onOpen(a.id)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
          current
            ? 'bg-primary/10 ring-1 ring-primary/30'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-[11px] font-semibold text-white">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{a.name}</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            <span className="text-[11px] text-zinc-400">{a.kind === 'ORCHESTRATOR' ? 'Agente inicial' : 'Membro'}</span>
          </span>
        </span>
      </button>
    );
  };

  return (
    <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Agente inicial</p>
        <Row a={root} />
      </div>
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Membros ({members.length})</p>
        {members.length === 0 ? (
          <p className="px-2.5 py-1 text-xs italic text-zinc-400">Sem membros ainda.</p>
        ) : (
          <div className="space-y-0.5">
            {members.map((m) => (
              <Row key={m.id} a={m} />
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={creating}
        className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-2.5 text-left text-sm text-zinc-600 hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        </span>
        <span className="flex flex-col">
          <span className="font-medium">Adicionar agente</span>
          <span className="text-[11px] text-zinc-400">Criar novo neste grupo</span>
        </span>
      </button>
    </aside>
  );
}

// Limite de capacidade do system prompt de UM agente, em caracteres.
// NÃO é o limite de contexto do modelo (Claude tem ~200k tokens) — é um
// guardrail de QUALIDADE: prompt muito longo dilui instruções e aumenta
// alucinação. Calibrado pro Claude (Sonnet/Haiku/Opus): ~20k chars ≈ ~5k
// tokens. Um subagente focado fica no verde; só um prompt realmente
// sobrecarregado chega no vermelho ("divida em subagentes").
// (LíderHub usa ~5k chars, mas no Claude isso deixaria todo agente sério
//  no vermelho — alarme falso constante. Por isso NÃO copiamos o número.)
const CAPACITY_LIMIT = 20000;

/** Nível de capacidade do agente: chars do system prompt / limite, com cor e
 *  alerta de sobrecarga (sinal pra dividir em subagentes — estratégia da Fase 4). */
function CapacityMeter({ chars }: { chars: number }) {
  const pct = Math.min(chars / CAPACITY_LIMIT, 1);
  const level =
    pct < 0.6 ? 'ok' : pct < 0.85 ? 'medio' : 'alto';
  const barColor =
    level === 'ok' ? 'bg-emerald-500' : level === 'medio' ? 'bg-amber-500' : 'bg-red-500';
  const textColor =
    level === 'ok' ? 'text-zinc-500' : level === 'medio' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={textColor}>
          {level === 'ok' && 'Capacidade saudável'}
          {level === 'medio' && '⚠️ Prompt ficando extenso'}
          {level === 'alto' && '🚨 Prompt sobrecarregado — divida em subagentes pra evitar alucinação'}
        </span>
        <span className={`font-mono ${textColor}`}>
          {chars.toLocaleString('pt-BR')} / {CAPACITY_LIMIT.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
