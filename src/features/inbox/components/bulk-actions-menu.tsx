'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Tag as TagIcon,
  MessageSquare,
  User,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Check,
  Loader2,
  KanbanSquare,
  Archive,
  ArchiveRestore,
  Inbox as InboxIcon,
  Filter,
  Mail,
  MailOpen,
  X,
  UserCog,
  UserCheck,
  XCircle,
  RotateCcw,
  Bot,
  FolderPlus,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
import { tagsService, type Tag } from '@/features/settings/services/tags.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { membersService } from '@/features/settings/services/members.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useInboxFilterStore } from '../stores/inbox-filter-store';
import { pipelinesService } from '@/features/pipelines/services/pipelines.service';
import { inboxViewsService, type InboxView } from '@/features/inbox-views/services/inbox-views.service';
import { inboxService, type Conversation } from '../services/inbox.service';
import { aiAgentsService } from '@/features/ai-agents/services/ai-agents.service';

type View =
  | 'root'
  | 'tag-conversation'
  | 'tag-contact'
  | 'inbox-views'
  | 'pipeline'
  | 'assign'
  | 'ai'
  | 'contact-status';

interface BulkActionsMenuProps {
  conversationIds: string[];
  /** Loaded conversations — used to resolve contact ids for "tag no contato". */
  conversations: Conversation[];
  disabled?: boolean;
  /** Cria uma inbox NOVA com a seleção (handler do conversation-list). */
  onCreateInbox: () => void;
  /** Chamado após qualquer ação bem-sucedida (limpa a seleção). */
  onDone: () => void;
}

const MENU_MAX_HEIGHT = 380;

export function BulkActionsMenu({
  conversationIds,
  conversations,
  disabled,
  onCreateInbox,
  onDone,
}: BulkActionsMenuProps) {
  const qc = useQueryClient();
  const orgId = useOrgId();
  const archivedOnly = useInboxFilterStore((s) => s.archivedOnly);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('root');
  // `busy` holds the id/key of the running action (for per-item spinners).
  const [busy, setBusy] = useState<string | null>(null);

  const count = conversationIds.length;

  const contactIds = useMemo(() => {
    const set = new Set<string>();
    for (const id of conversationIds) {
      const c = conversations.find((x) => x.id === id);
      if (c?.contact?.id) set.add(c.contact.id);
    }
    return Array.from(set);
  }, [conversationIds, conversations]);

  // Submenu data — lazy-loaded only when the matching submenu opens.
  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: () => tagsService.list(),
    enabled: open && (view === 'tag-conversation' || view === 'tag-contact'),
  });
  const { data: contactStatuses = [], isLoading: statusesLoading } = useQuery({
    queryKey: ['contact-statuses'],
    queryFn: () => contactStatusesService.list(),
    enabled: open && view === 'contact-status',
  });
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['pipelines', orgId],
    queryFn: () => pipelinesService.list(),
    enabled: open && view === 'pipeline',
  });
  const { data: inboxViewsRaw = [], isLoading: inboxViewsLoading } = useQuery({
    queryKey: ['inbox-views', orgId],
    queryFn: () => inboxViewsService.list(),
    enabled: open && view === 'inbox-views',
  });
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    enabled: open && view === 'assign',
  });
  const { data: aiAgents = [] } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => aiAgentsService.list(),
    enabled: open && view === 'assign',
  });
  // Robôs atribuíveis: ativos e top-level (não subagentes). Poucos na org, então
  // listamos todos — inclui a Camila (RMC/RCC) pra dar pra pôr como responsável.
  const assignableRobots = useMemo(
    () => aiAgents.filter((a) => a.isActive && !a.parentAgentId),
    [aiAgents],
  );

  const inboxViews = useMemo(
    () => inboxViewsRaw.filter((v) => v.metadata?.builtin !== true),
    [inboxViewsRaw],
  );

  // Reset to the root view whenever the menu is closed.
  useEffect(() => {
    if (!open) setView('root');
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
    qc.invalidateQueries({ queryKey: ['conversation-counts'] });
  };

  /** Runs a bulk operation with a spinner, toast and selection cleanup. */
  const run = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      invalidate();
      toast.success(msg);
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro na ação em massa');
    } finally {
      setBusy(null);
    }
  };

  const plural = (n: number) => (n > 1 ? 's' : '');

  // --- Bulk operations (compose single-item endpoints with Promise.all) ---

  const tagAll = (tag: Tag, target: 'conversation' | 'contact') =>
    run(
      `tag-${tag.id}`,
      async () => {
        if (target === 'conversation') {
          await Promise.all(
            conversationIds.map((id) => tagsService.addToConversation(id, tag.id)),
          );
        } else {
          await Promise.all(
            contactIds.map((cid) => tagsService.addToContact(cid, tag.id)),
          );
        }
      },
      `Tag "${tag.name}" aplicada a ${count} conversa${plural(count)}`,
    );

  const addToInboxView = (v: InboxView) =>
    run(
      `view-${v.id}`,
      async () => {
        const current = v.filters?.conversationIds ?? [];
        const next = Array.from(new Set([...current, ...conversationIds]));
        await inboxViewsService.update(v.id, {
          filters: { ...v.filters, conversationIds: next },
        });
        qc.invalidateQueries({ queryKey: ['inbox-views'] });
      },
      `${count} adicionada${plural(count)} a "${v.name}"`,
    );

  const addToPipeline = (pipelineId: string, name: string) =>
    run(
      `pipe-${pipelineId}`,
      async () => {
        await Promise.all(
          conversationIds.map((id) =>
            pipelinesService.createCard(pipelineId, { conversationId: id }),
          ),
        );
        qc.invalidateQueries({ queryKey: ['pipeline-board', pipelineId] });
      },
      `${count} adicionada${plural(count)} ao pipeline "${name}"`,
    );

  const assignAll = (userId: string | null, name?: string) =>
    run(
      `assign-${userId ?? 'none'}`,
      async () => {
        await Promise.all(
          conversationIds.map((id) => inboxService.assignTo(id, userId)),
        );
      },
      userId
        ? `Responsável de ${count} conversa${plural(count)} → ${name}`
        : `Responsável removido de ${count} conversa${plural(count)}`,
    );

  /** Define um ROBÔ (IA) como responsável de todas as conversas selecionadas. */
  const assignAgentAll = (agentId: string, name: string) =>
    run(
      `assign-agent-${agentId}`,
      async () => {
        await Promise.all(
          conversationIds.map((id) => inboxService.assignAgent(id, agentId)),
        );
      },
      `Robô responsável de ${count} conversa${plural(count)} → ${name}`,
    );

  /** Muda o STATUS do funil (Recepção, RMC/RCC, …) dos contatos selecionados. */
  const setStatusAll = (statusId: string | null, name: string) =>
    run(
      `status-${statusId ?? 'none'}`,
      async () => {
        await Promise.all(
          contactIds.map((cid) =>
            contactStatusesService.setContactStatus(cid, statusId),
          ),
        );
      },
      statusId
        ? `Status de ${count} conversa${plural(count)} → ${name}`
        : `Status removido de ${count} conversa${plural(count)}`,
    );

  const markUnreadAll = () =>
    run(
      'unread',
      async () => {
        await Promise.all(conversationIds.map((id) => inboxService.markAsUnread(id)));
      },
      `${count} marcada${plural(count)} como não-lida${plural(count)}`,
    );

  const markReadAll = () =>
    run(
      'read',
      async () => {
        await Promise.all(conversationIds.map((id) => inboxService.markAsRead(id)));
      },
      `${count} marcada${plural(count)} como lida${plural(count)}`,
    );

  const archiveAll = () =>
    run('archive', () => inboxService.bulkArchive(conversationIds), `${count} arquivada${plural(count)}`);
  const unarchiveAll = () =>
    run('unarchive', () => inboxService.bulkUnarchive(conversationIds), `${count} desarquivada${plural(count)}`);
  const assumeAll = () =>
    run('assume', () => inboxService.bulkAssignToMe(conversationIds), `${count} assumida${plural(count)}`);
  const closeAll = () =>
    run('close', () => inboxService.bulkClose(conversationIds), `${count} fechada${plural(count)}`);
  const reopenAll = () =>
    run('reopen', () => inboxService.bulkReopen(conversationIds), `${count} reaberta${plural(count)}`);
  const setAiAll = (enabled: boolean | null, label: string) =>
    run(`ai-${label}`, () => inboxService.bulkSetAi(conversationIds, enabled), `IA ${label} em ${count} conversa${plural(count)}`);
  const engageAiAll = () =>
    run('ai-engage', () => inboxService.bulkEngageAi(conversationIds), `IA acionada em ${count} conversa${plural(count)}`);

  // --- Reusable bits -------------------------------------------------------

  const sectionLabel = (text: string) => (
    <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
      {text}
    </div>
  );
  const divider = <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />;
  const itemClass =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-800/60';
  const backButton = (label: string) => (
    <>
      <button
        onClick={() => setView('root')}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-50 dark:text-zinc-500 dark:hover:bg-zinc-800/60"
      >
        <ArrowLeft className="h-3 w-3" />
        {label}
      </button>
      {divider}
    </>
  );
  const submenuScroll = 'overflow-y-auto scrollbar-thin';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || count === 0}
        title="Ações em massa"
        className={`flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-50 ${
          open
            ? 'bg-primary/10 text-primary'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
        }`}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Ações
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={ref}
            style={{ maxHeight: MENU_MAX_HEIGHT }}
            className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            role="menu"
          >
            {view === 'root' && (
              <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 8 }}>
                {sectionLabel('Atribuir tag')}
                <button onClick={() => setView('tag-conversation')} className={itemClass}>
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Na conversa</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={() => setView('tag-contact')} className={itemClass}>
                  <User className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">No contato</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {divider}
                {sectionLabel('Organizar')}
                <button onClick={() => setView('inbox-views')} className={itemClass}>
                  <InboxIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Adicionar a inbox</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={() => setView('pipeline')} className={itemClass}>
                  <KanbanSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Adicionar a pipeline</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={() => setView('contact-status')} className={itemClass}>
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Alterar status</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={() => setView('assign')} className={itemClass}>
                  <UserCog className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Alterar responsável</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={() => { setOpen(false); onCreateInbox(); }} className={itemClass}>
                  <FolderPlus className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Criar inbox da seleção</span>
                </button>

                {divider}
                <button onClick={markUnreadAll} disabled={busy === 'unread'} className={itemClass}>
                  {busy === 'unread' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                  <span className="flex-1">Marcar como não-lida</span>
                </button>
                <button onClick={markReadAll} disabled={busy === 'read'} className={itemClass}>
                  {busy === 'read' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <MailOpen className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                  <span className="flex-1">Marcar como lida</span>
                </button>

                {divider}
                {sectionLabel('Status')}
                <button onClick={assumeAll} disabled={busy === 'assume'} className={itemClass}>
                  {busy === 'assume' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <UserCheck className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                  <span className="flex-1">Assumir conversas</span>
                </button>
                <button onClick={() => setView('ai')} className={itemClass}>
                  <Bot className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Inteligência artificial</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button onClick={closeAll} disabled={busy === 'close'} className={itemClass}>
                  {busy === 'close' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                  <span className="flex-1">Fechar conversas</span>
                </button>
                <button onClick={reopenAll} disabled={busy === 'reopen'} className={itemClass}>
                  {busy === 'reopen' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <RotateCcw className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                  <span className="flex-1">Reabrir conversas</span>
                </button>

                {divider}
                {archivedOnly ? (
                  <button onClick={unarchiveAll} disabled={busy === 'unarchive'} className={itemClass}>
                    {busy === 'unarchive' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <ArchiveRestore className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    <span className="flex-1">Desarquivar</span>
                  </button>
                ) : (
                  <button onClick={archiveAll} disabled={busy === 'archive'} className={itemClass}>
                    {busy === 'archive' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" /> : <Archive className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />}
                    <span className="flex-1">Arquivar</span>
                  </button>
                )}
              </div>
            )}

            {(view === 'tag-conversation' || view === 'tag-contact') && (
              <>
                {backButton(view === 'tag-conversation' ? 'Tag na conversa' : 'Tag no contato')}
                <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 80 }}>
                  {tagsLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /></div>
                  ) : tags.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center">
                      <TagIcon className="h-5 w-5 text-zinc-300 dark:text-zinc-700" />
                      <p className="mt-1.5 text-[11px] text-zinc-400">Nenhuma tag</p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">Crie em Configurações › Tags</p>
                    </div>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => tagAll(tag, view === 'tag-conversation' ? 'conversation' : 'contact')}
                        disabled={busy === `tag-${tag.id}`}
                        className={itemClass}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 truncate">{tag.name}</span>
                        {busy === `tag-${tag.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {view === 'inbox-views' && (
              <>
                {backButton('Adicionar a inbox')}
                <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 80 }}>
                  {inboxViewsLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /></div>
                  ) : inboxViews.length === 0 ? (
                    <div className="flex flex-col items-center px-3 py-4 text-center">
                      <InboxIcon className="h-5 w-5 text-zinc-300 dark:text-zinc-700" />
                      <p className="mt-1.5 text-[11px] text-zinc-400">Nenhuma inbox personalizada</p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">Use "Criar inbox da seleção"</p>
                    </div>
                  ) : (
                    inboxViews.map((v) => (
                      <button key={v.id} onClick={() => addToInboxView(v)} disabled={busy === `view-${v.id}`} className={itemClass}>
                        <Filter className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                        <span className="flex-1 truncate">{v.name}</span>
                        {busy === `view-${v.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {view === 'pipeline' && (
              <>
                {backButton('Adicionar a pipeline')}
                <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 80 }}>
                  {pipelinesLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /></div>
                  ) : pipelines.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center">
                      <KanbanSquare className="h-5 w-5 text-zinc-300 dark:text-zinc-700" />
                      <p className="mt-1.5 text-[11px] text-zinc-400">Nenhum pipeline</p>
                    </div>
                  ) : (
                    pipelines.map((p) => (
                      <button key={p.id} onClick={() => addToPipeline(p.id, p.name)} disabled={busy === `pipe-${p.id}`} className={itemClass}>
                        <KanbanSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {busy === `pipe-${p.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {view === 'contact-status' && (
              <>
                {backButton('Alterar status')}
                <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 80 }}>
                  <button onClick={() => setStatusAll(null, '')} disabled={busy === 'status-none'} className={`${itemClass} text-zinc-500 dark:text-zinc-400`}>
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">Remover status</span>
                    {busy === 'status-none' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  </button>
                  {statusesLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /></div>
                  ) : contactStatuses.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-zinc-400">Nenhum status</p>
                  ) : (
                    contactStatuses.map((s) => (
                      <button key={s.id} onClick={() => setStatusAll(s.id, s.name)} disabled={busy === `status-${s.id}`} className={itemClass}>
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 truncate">{s.name}</span>
                        {busy === `status-${s.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {view === 'assign' && (
              <>
                {backButton('Alterar responsável')}
                <div className={submenuScroll} style={{ maxHeight: MENU_MAX_HEIGHT - 80 }}>
                  <button onClick={() => assignAll(null)} disabled={busy === 'assign-none'} className={`${itemClass} text-zinc-500 dark:text-zinc-400`}>
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">Remover responsável</span>
                    {busy === 'assign-none' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  </button>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /></div>
                  ) : members.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-zinc-400">Nenhum membro</p>
                  ) : (
                    members.filter((m) => m.assignable !== false).map((m) => (
                      <button key={m.user.id} onClick={() => assignAll(m.user.id, m.user.name)} disabled={busy === `assign-${m.user.id}`} className={itemClass}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {(m.user.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate">{m.user.name}</span>
                        {busy === `assign-${m.user.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      </button>
                    ))
                  )}
                  {assignableRobots.length > 0 && (
                    <>
                      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Robôs (IA)
                      </p>
                      {assignableRobots.map((a) => (
                        <button key={a.id} onClick={() => assignAgentAll(a.id, a.name)} disabled={busy === `assign-agent-${a.id}`} className={itemClass}>
                          <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                          <span className="flex-1 truncate">{a.name}</span>
                          {busy === `assign-agent-${a.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}

            {view === 'ai' && (
              <>
                {backButton('Inteligência artificial')}
                <button onClick={() => setAiAll(true, 'ativada')} disabled={busy === 'ai-ativada'} className={itemClass}>
                  <Bot className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="flex-1">Ativar IA</span>
                  {busy === 'ai-ativada' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                </button>
                <button onClick={() => setAiAll(false, 'pausada')} disabled={busy === 'ai-pausada'} className={itemClass}>
                  <Bot className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="flex-1">Pausar IA</span>
                  {busy === 'ai-pausada' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                </button>
                <button onClick={() => setAiAll(null, 'automática')} disabled={busy === 'ai-automática'} className={itemClass}>
                  <Bot className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="flex-1">Automático (padrão)</span>
                  {busy === 'ai-automática' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                </button>
                {divider}
                <button onClick={engageAiAll} disabled={busy === 'ai-engage'} className={itemClass}>
                  <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1">Acionar IA agora</span>
                  {busy === 'ai-engage' && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
