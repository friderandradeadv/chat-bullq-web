'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ChevronDown, Search, UserPlus, X, Check, User, Loader2, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService, type Conversation } from '../services/inbox.service';
import {
  membersService,
  type Member,
} from '@/features/settings/services/members.service';
import {
  aiAgentsService,
  type AiAgent,
} from '@/features/ai-agents/services/ai-agents.service';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  conversation: Conversation;
  onChanged?: () => void;
  /**
   * 'chip' (padrão) — botão compacto cinza usado no header/toolbar.
   * 'card' — card full-width (avatar + nome + chevron) p/ a seção
   * "Atendimento" do painel do contato. Clicar abre a troca de responsável.
   */
  variant?: 'chip' | 'card';
}

function MemberAvatar({
  name,
  avatarUrl,
  size = 24,
}: {
  name: string | null;
  avatarUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '??').slice(0, 2).toUpperCase();
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ''}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800"
    >
      {initials}
    </div>
  );
}

export function AssignmentPopover({
  conversation,
  onChanged,
  variant = 'chip',
}: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    staleTime: 60_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => aiAgentsService.list(),
    staleTime: 60_000,
  });

  // Etiquetas do contato + da conversa — o robô só aparece se atende a área do
  // contato (ou se não tem etiqueta nenhuma = atende todo mundo).
  const ctxTagIds = useMemo(() => {
    const fromContact = conversation.contact?.tags?.map((t) => t.tag.id) ?? [];
    const fromConv = conversation.tags?.map((t) => t.tag.id) ?? [];
    return new Set([...fromContact, ...fromConv]);
  }, [conversation.contact?.tags, conversation.tags]);

  // Robôs candidatos: TODOS os robôs ativos top-level (não subagentes).
  // Antes filtrávamos pela área (tag do robô × tag da conversa), mas isso
  // escondia robôs de área específica (ex.: Camila RMC/RCC) em conversas ainda
  // SEM etiqueta — e aí não dava pra pô-la como responsável. Como a org tem
  // poucos robôs top-level, mostramos todos; a busca por nome refina.
  const robots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => a.isActive && !a.parentAgentId)
      .filter((a) => (q ? a.name.toLowerCase().includes(q) : true));
  }, [agents, ctxTagIds, search]);

  const currentRobot = useMemo(() => {
    // Responsável é humano OU robô, nunca os dois. Se há responsável HUMANO,
    // ele SEMPRE vence — mesmo que a conversa ainda carregue um robô responsável
    // antigo (assignedAgentId) por drift de dados de um handoff antigo.
    if (conversation.assignedToId) return null;
    // Robô responsável FIXO (assignedAgentId) tem prioridade. Se não há robô
    // nem humano atribuído, mostra o robô que está ATENDENDO agora
    // (activeAgentId) — assim o "Atendimento" reflete quem está trabalhando na
    // conversa, em vez de "Não atribuído" enquanto a IA responde.
    if (conversation.assignedAgentId) {
      return agents.find((a) => a.id === conversation.assignedAgentId) ?? null;
    }
    if (conversation.activeAgentId) {
      return agents.find((a) => a.id === conversation.activeAgentId) ?? null;
    }
    return null;
  }, [
    agents,
    conversation.assignedAgentId,
    conversation.assignedToId,
    conversation.activeAgentId,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => m.user.isActive)
      // Esconde perfil Admin / logins duplicados (assignable=false) das atribuições do chat.
      .filter((m) => m.assignable !== false)
      .filter((m) =>
        q
          ? m.user.name.toLowerCase().includes(q) ||
            m.user.email.toLowerCase().includes(q)
          : true,
      );
  }, [members, search]);

  const currentAssignee = useMemo(() => {
    if (!conversation.assignedToId) return null;
    return (
      members.find((m) => m.user.id === conversation.assignedToId) ?? null
    );
  }, [members, conversation.assignedToId]);

  const handleAssign = async (
    userId: string | null,
    label: string,
    closeFn: () => void,
  ) => {
    setBusy(true);
    try {
      await inboxService.assignTo(conversation.id, userId);
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      onChanged?.();
      closeFn();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atribuir');
    } finally {
      setBusy(false);
    }
  };

  // Define um ROBÔ como responsável (ou null pra remover). O backend força a IA
  // ON nessa conversa → ele passa a responder. Exclusivo com responsável humano.
  const handleAssignAgent = async (
    agentId: string | null,
    label: string,
    closeFn: () => void,
  ) => {
    setBusy(true);
    try {
      await inboxService.assignAgent(conversation.id, agentId);
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      onChanged?.();
      closeFn();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao definir o robô');
    } finally {
      setBusy(false);
    }
  };

  // Fallback: o popover de membros nem sempre encontra o assignee na lista
  // (ex.: membro desativado), mas a conversa já traz assignedTo embutido.
  const humanName =
    currentAssignee?.user.name ?? conversation.assignedTo?.name ?? null;
  const humanAvatar =
    currentAssignee?.user.avatarUrl ??
    conversation.assignedTo?.avatarUrl ??
    null;
  const robotName = currentRobot?.name ?? conversation.assignedAgent?.name ?? null;
  const robotAvatar =
    currentRobot?.avatarUrl ?? conversation.assignedAgent?.avatarUrl ?? null;

  // Responsável é humano OU robô, nunca os dois. O HUMANO sempre vence — o robô
  // só aparece como responsável quando não há ninguém atribuído. Isso conserta o
  // caso em que a conversa carrega um robô responsável antigo (assignedAgentId)
  // por drift, escondendo o humano de fato responsável (ex.: transferência p/ Maju).
  const assigneeIsRobot = !humanName && !!robotName;
  const assigneeName = humanName ?? robotName;
  const assigneeAvatar = assigneeIsRobot ? robotAvatar : humanAvatar;

  return (
    <Popover className="relative">
      {variant === 'card' ? (
        <PopoverButton
          className="group flex w-full items-center gap-2.5 rounded-lg bg-zinc-50 px-3 py-2 text-left transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          disabled={busy}
          title="Clique para trocar o responsável"
        >
          {assigneeName ? (
            <>
              {assigneeIsRobot ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                  <Bot className="h-4 w-4" />
                </div>
              ) : (
                <MemberAvatar name={assigneeName} avatarUrl={assigneeAvatar} size={28} />
              )}
              <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                {assigneeName}
                {assigneeIsRobot && (
                  <span className="ml-1 text-[10px] font-normal text-purple-500">robô</span>
                )}
              </span>
            </>
          ) : (
            <>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserPlus className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 text-sm italic text-zinc-400">Não atribuído</span>
            </>
          )}
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-data-[open]:rotate-180" />
          )}
        </PopoverButton>
      ) : (
        <PopoverButton
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          disabled={busy}
        >
          {assigneeName ? (
            <>
              {assigneeIsRobot ? (
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                  <Bot className="h-3 w-3" />
                </div>
              ) : (
                <MemberAvatar name={assigneeName} avatarUrl={assigneeAvatar} size={18} />
              )}
              <span className="max-w-[120px] truncate">{assigneeName}</span>
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              <span>Atribuir</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        </PopoverButton>
      )}

      <PopoverPanel
        anchor="bottom end"
        transition
        className="z-50 mt-1.5 w-64 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
      >
        {({ close }) => (
          <>
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar membro ou robô…"
                  className="w-full rounded-md border border-zinc-200 bg-white py-1 pl-7 pr-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {currentUser && (
                <button
                  onClick={() =>
                    handleAssign(
                      currentUser.id,
                      'Conversa atribuída a você',
                      close,
                    )
                  }
                  disabled={busy || conversation.assignedToId === currentUser.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-40 dark:hover:bg-zinc-800/60"
                >
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Atribuir a mim
                  </span>
                </button>
              )}

              {conversation.assignedToId && (
                <button
                  onClick={() => handleAssign(null, 'Atribuição removida', close)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Remover atribuição</span>
                </button>
              )}

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-[11px] text-zinc-400">
                  Nenhum membro encontrado
                </p>
              )}
              {filtered.map((m: Member) => {
                const isMe = m.user.id === currentUser?.id;
                const isCurrent = m.user.id === conversation.assignedToId;
                return (
                  <button
                    key={m.user.id}
                    onClick={() =>
                      handleAssign(
                        m.user.id,
                        `Conversa atribuída a ${m.user.name}`,
                        close,
                      )
                    }
                    disabled={busy || isCurrent}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                      isCurrent
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <MemberAvatar
                      name={m.user.name}
                      avatarUrl={m.user.avatarUrl}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {m.user.name}
                        {isMe && (
                          <span className="ml-1 text-[10px] font-normal text-zinc-400">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-zinc-500">
                        {m.role.toLowerCase()}
                      </p>
                    </div>
                    {isCurrent && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}

              {(robots.length > 0 || conversation.assignedAgentId) && (
                <>
                  <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                  <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-purple-400">
                    Robôs (IA)
                  </p>

                  {conversation.assignedAgentId && (
                    <button
                      onClick={() =>
                        handleAssignAgent(null, 'Robô removido', close)
                      }
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Remover robô</span>
                    </button>
                  )}

                  {robots.map((a: AiAgent) => {
                    const isCurrent = a.id === conversation.assignedAgentId;
                    return (
                      <button
                        key={a.id}
                        onClick={() =>
                          handleAssignAgent(
                            a.id,
                            `${a.name} assumiu a conversa`,
                            close,
                          )
                        }
                        disabled={busy || isCurrent}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                          isCurrent
                            ? 'bg-purple-50 dark:bg-purple-900/20'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {a.name}
                          </p>
                          <p className="truncate text-[10px] text-purple-500">
                            responde automaticamente
                          </p>
                        </div>
                        {isCurrent && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
