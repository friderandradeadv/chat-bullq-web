'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  X,
  SlidersHorizontal,
  Check,
  Loader2,
  ChevronDown,
  Inbox,
  Users,
  User,
  MailOpen,
  Archive,
  Tag as TagIcon,
  CheckSquare,
  Square,
  EllipsisVertical,
  Bot,
  MessageCircle,
  Clock,
  Phone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { inboxService, type Conversation } from '../services/inbox.service';
import {
  inboxViewsService,
  type InboxView,
} from '@/features/inbox-views/services/inbox-views.service';
import { channelsService } from '@/features/channels/services/channels.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useSocket } from '../hooks/use-socket';
import { useAuthStore } from '@/stores/auth-store';
import { useInboxPreferences } from '../hooks/use-inbox-preferences';
import { ConversationContextMenu } from './conversation-context-menu';
import { BulkActionsMenu } from './bulk-actions-menu';
import { getBrazilState, formatPhone } from '@/lib/brazil-states';
import { WhatsAppNewChatIcon } from '@/components/ui/icons';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { StateFlag } from '@/components/ui/state-flag';
import { NewConversationModal } from './new-conversation-modal';
import { useInboxFilterStore } from '../stores/inbox-filter-store';

function ListAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'avatar'}
        onError={() => setFailed(true)}
        className="h-9 w-9 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800"
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitials(name)}
    </div>
  );
}

type ScopeFilter = 'ALL' | 'MINE';
type StatusTab = 'ALL' | 'OPEN' | 'PENDING' | 'BOT' | 'GROUPS';

// Rótulos amigáveis (estilo WhatsApp) para a prévia da última mensagem quando
// ela não tem texto — em vez de mostrar o enum cru "[IMAGE]"/"[AUDIO]".
const MEDIA_PREVIEW_LABELS: Record<string, string> = {
  IMAGE: '📷 Foto',
  AUDIO: '🎤 Mensagem de voz',
  VIDEO: '🎥 Vídeo',
  DOCUMENT: '📄 Documento',
  STICKER: 'Figurinha',
  LOCATION: '📍 Localização',
  CONTACT: '👤 Contato',
  TEMPLATE: 'Mensagem',
  INTERACTIVE: 'Mensagem',
  REACTION: 'Reação',
};
function mediaPreviewLabel(type: string): string {
  return MEDIA_PREVIEW_LABELS[type] ?? 'Mensagem';
}

const scopeOptions: { label: string; value: ScopeFilter; icon: React.ElementType }[] = [
  { label: 'Todas as conversas', value: 'ALL', icon: Users },
  { label: 'Minhas conversas', value: 'MINE', icon: User },
];

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-400',
  OPEN: 'bg-emerald-400',
  BOT: 'bg-blue-400',
  WAITING: 'bg-violet-400',
  CLOSED: 'bg-zinc-300 dark:bg-zinc-600',
};

type ListFilter = 'unread' | 'archived' | 'groups';

const filterOptions: { label: string; value: ListFilter; icon: React.ElementType; description: string }[] = [
  {
    label: 'Não lidas',
    value: 'unread',
    icon: MailOpen,
    description: 'Apenas com mensagens novas',
  },
  {
    label: 'Arquivadas',
    value: 'archived',
    icon: Archive,
    description: 'Mostra a inbox arquivada',
  },
  {
    label: 'Grupos',
    value: 'groups',
    icon: Users,
    description: 'Inclui conversas de grupos. Desmarcado = esconde.',
  },
];

interface ConversationListProps {
  activeId: string | null;
  onSelect: (conversation: Conversation) => void;
  /**
   * When set, fetches conversations through the inbox view endpoint
   * (`/inbox-views/:id/conversations`) which applies the view's saved
   * filters server-side. The user's local filters (status/channel/scope)
   * still layer on top via query params.
   */
  viewId?: string | null;
}

export function ConversationList({ activeId, onSelect, viewId }: ConversationListProps) {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const { on, onReconnect } = useSocket();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const {
    preferences: savedPrefs,
    isLoaded: prefsLoaded,
    update: updatePrefs,
  } = useInboxPreferences();
  // Filter state lives in a shared store so the full-width top toolbar
  // (search + Responsável + Status + Mais filtros, LíderHub style) and this
  // list drive the same query.
  const search = useInboxFilterStore((s) => s.search);
  const scope = useInboxFilterStore((s) => s.scope);
  const statusTab = useInboxFilterStore((s) => s.statusTab);
  const selectedChannelId = useInboxFilterStore((s) => s.selectedChannelId);
  const selectedTagIds = useInboxFilterStore((s) => s.selectedTagIds);
  const selectedStatusIds = useInboxFilterStore((s) => s.selectedStatusIds);
  const selectedAssigneeIds = useInboxFilterStore((s) => s.selectedAssigneeIds);
  const unreadOnly = useInboxFilterStore((s) => s.unreadOnly);
  const archivedOnly = useInboxFilterStore((s) => s.archivedOnly);
  const showGroups = useInboxFilterStore((s) => s.showGroups);
  const setStatusTab = useInboxFilterStore((s) => s.setStatusTab);
  const setScope = useInboxFilterStore((s) => s.setScope);
  const setSelectedChannelId = useInboxFilterStore((s) => s.setSelectedChannelId);
  const setUnreadOnly = useInboxFilterStore((s) => s.setUnreadOnly);
  const setArchivedOnly = useInboxFilterStore((s) => s.setArchivedOnly);
  const setShowGroups = useInboxFilterStore((s) => s.setShowGroups);
  const setSelectedTagIds = useInboxFilterStore((s) => s.setSelectedTagIds);
  const setSelectedStatusIds = useInboxFilterStore((s) => s.setSelectedStatusIds);
  const setSelectedAssigneeIds = useInboxFilterStore((s) => s.setSelectedAssigneeIds);
  const setSearch = useInboxFilterStore((s) => s.setSearch);
  const debouncedSearch = search;
  const activeFilterCount =
    (unreadOnly ? 1 : 0) +
    (archivedOnly ? 1 : 0) +
    (showGroups ? 1 : 0) +
    selectedTagIds.length +
    selectedStatusIds.length +
    selectedAssigneeIds.length;
  const hydratedRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    conversation: Conversation;
    position: { x: number; y: number };
  } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Hydrate state from saved preferences once they load
  useEffect(() => {
    if (!prefsLoaded || hydratedRef.current) return;
    hydratedRef.current = true;
    if (savedPrefs.scope === 'MINE' || savedPrefs.scope === 'ALL') {
      setScope(savedPrefs.scope);
    }
    if (typeof savedPrefs.unreadOnly === 'boolean') {
      setUnreadOnly(savedPrefs.unreadOnly);
    }
    if (typeof savedPrefs.archivedOnly === 'boolean') {
      setArchivedOnly(savedPrefs.archivedOnly);
    }
    if (typeof savedPrefs.showGroups === 'boolean') {
      setShowGroups(savedPrefs.showGroups);
    }
    if (savedPrefs.selectedChannelId !== undefined) {
      setSelectedChannelId(savedPrefs.selectedChannelId ?? null);
    }
    if (Array.isArray(savedPrefs.tagIds)) {
      setSelectedTagIds(savedPrefs.tagIds);
    }
    if (Array.isArray(savedPrefs.contactStatusIds)) {
      setSelectedStatusIds(savedPrefs.contactStatusIds);
    }
    if (Array.isArray(savedPrefs.assigneeIds)) {
      setSelectedAssigneeIds(savedPrefs.assigneeIds);
    }
  }, [prefsLoaded, savedPrefs]);

  // Arquivadas quick-row toggle (the only filter still rendered inside the
  // list; everything else moved to the top toolbar).
  const toggleArchived = () => {
    const next = !archivedOnly;
    setArchivedOnly(next);
    updatePrefs({ archivedOnly: next });
  };

  const clearAllFilters = () => {
    setUnreadOnly(false);
    setArchivedOnly(false);
    setShowGroups(false);
    setSelectedTagIds([]);
    setSelectedStatusIds([]);
    setSelectedAssigneeIds([]);
    setSearch('');
    updatePrefs({
      unreadOnly: false,
      archivedOnly: false,
      showGroups: false,
      tagIds: [],
      contactStatusIds: [],
      assigneeIds: [],
    });
  };

  const tagsKey = useMemo(
    () => [...selectedTagIds].sort().join(','),
    [selectedTagIds],
  );
  const statusesKey = useMemo(
    () => [...selectedStatusIds].sort().join(','),
    [selectedStatusIds],
  );
  const assigneesKey = useMemo(
    () => [...selectedAssigneeIds].sort().join(','),
    [selectedAssigneeIds],
  );
  const filterKey = `${unreadOnly ? 'u' : ''}|${archivedOnly ? 'a' : ''}|${showGroups ? 'g' : ''}|t:${tagsKey}|cs:${statusesKey}|as:${assigneesKey}`;

  const handleAccept = useCallback(
    async (e: React.MouseEvent, conversationId: string) => {
      e.stopPropagation();
      if (acceptingId) return;
      setAcceptingId(conversationId);
      try {
        await inboxService.assignToMe(conversationId);
        queryClient.invalidateQueries({ queryKey: ['conversations', orgId] });
        queryClient.invalidateQueries({ queryKey: ['conversation-counts', orgId] });
        toast.success('Conversa aceita');
      } catch {
        toast.error('Erro ao aceitar conversa');
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptingId, orgId, queryClient],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: () => tagsService.list(),
  });

  const { data: statusCounts } = useQuery({
    queryKey: ['conversation-counts', orgId],
    queryFn: () => inboxService.getStatusCounts(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Título da aba com a contagem de pendentes, igual LíderHub: "(12) Chat | Frider Andrade"
  useEffect(() => {
    const pending = statusCounts?.['PENDING'] ?? 0;
    document.title = pending > 0 ? `(${pending}) Chat | Frider Andrade` : 'Chat | Frider Andrade';
    return () => {
      document.title = 'Chat | Frider Andrade';
    };
  }, [statusCounts]);

  // Drop selected tag ids that no longer exist (tag deleted in another tab).
  // Avoid sending stale ids to the backend — they'd just match nothing.
  useEffect(() => {
    if (!tags.length || !selectedTagIds.length) return;
    const valid = new Set(tags.map((t) => t.id));
    const filtered = selectedTagIds.filter((id) => valid.has(id));
    if (filtered.length !== selectedTagIds.length) {
      setSelectedTagIds(filtered);
      updatePrefs({ tagIds: filtered });
    }
  }, [tags, selectedTagIds, updatePrefs]);

  // Reset scroll when filters/search change
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [filterKey, debouncedSearch, selectedChannelId, scope, showGroups, tagsKey, statusTab]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', orgId, viewId ?? null, filterKey, debouncedSearch, selectedChannelId, scope, statusTab, currentUserId],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string> = { limit: '30', page: String(pageParam) };
      if (statusTab !== 'ALL' && statusTab !== 'GROUPS') params.status = statusTab;
      if (unreadOnly) params.unread = 'true';
      // archived: dentro de view, só passa quando user explicitamente
      // ativou (override). Fora de view, passa sempre o estado atual.
      if (viewId) {
        if (archivedOnly) params.archived = 'only';
      } else {
        params.archived = archivedOnly ? 'only' : 'exclude';
      }
      // groups: a tab "Grupos" força only; fora dela, esconde grupos por padrão
      if (statusTab === 'GROUPS') {
        params.groups = 'only';
      } else if (viewId) {
        if (showGroups) params.groups = 'only';
      } else {
        if (!showGroups) params.groups = 'exclude';
      }
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedChannelId) params.channelId = selectedChannelId;
      if (selectedTagIds.length > 0) params.tagIds = selectedTagIds.join(',');
      if (selectedStatusIds.length > 0) params.contactStatusIds = selectedStatusIds.join(',');
      // Multi-responsável vence o scope; "Minhas" continua sendo o atalho.
      if (selectedAssigneeIds.length > 0) {
        params.assignedToIds = selectedAssigneeIds.join(',');
      } else if (scope === 'MINE' && currentUserId) {
        params.assignedToId = currentUserId;
      }
      if (viewId) {
        return inboxViewsService.getConversations(viewId, params);
      }
      return inboxService.getConversations(params);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    // Realtime (message:new / conversation:updated) drives updates — keep a
    // slow safety-net poll to cover transient socket drops.
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const conversations = useMemo(
    () => data?.pages.flatMap((p) => p.conversations) || [],
    [data],
  );

  // Total count from the paginated response — same value across pages
  // (it's the count(where) from Postgres). Used to show "Não lidas (N)"
  // in the active filter chip.
  const totalCount = data?.pages?.[0]?.pagination?.total ?? 0;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: scrollContainerRef.current, rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
    setSelectionMode(false);
  }, []);

  const handleConversationClick = useCallback(
    (conv: Conversation, index: number, e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (lastClickedIndex !== null && conversations.length > 0) {
            const start = Math.min(lastClickedIndex, index);
            const end = Math.max(lastClickedIndex, index);
            for (let i = start; i <= end; i++) {
              next.add(conversations[i].id);
            }
          } else {
            next.add(conv.id);
          }
          return next;
        });
        setLastClickedIndex(index);
        return;
      }

      // In selection mode: click toggles selection, never opens the conversation.
      if (selectionMode) {
        toggleSelect(conv.id, index);
        return;
      }

      if (selectedIds.size > 0) {
        clearSelection();
      }
      onSelect(conv);
      setLastClickedIndex(index);

      // Mark as read on click. Optimistic: zero the local counter
      // immediately so the badge disappears before the API roundtrip;
      // backend then emits conversation:read via socket which becomes
      // a no-op for this user (counter is already 0) but syncs other
      // tabs/devices logged into the same account.
      if ((conv.unreadCount ?? 0) > 0) {
        const lastMsgId = conv.messages?.[0]?.id;

        // When the current list filters by "unread only" — either via the
        // local toggle on the main inbox or via a saved view that pins
        // unreadOnly — the conversation we just opened is no longer a
        // member of the filtered set. Optimistically drop it from the
        // cached pages so the user sees it leave immediately, instead of
        // waiting for the next refetch.
        let dropFromList = false;
        if (viewId) {
          const cachedViews = queryClient.getQueryData<InboxView[]>([
            'inbox-views',
          ]);
          dropFromList =
            cachedViews?.find((v) => v.id === viewId)?.filters?.unreadOnly ===
            true;
        } else {
          dropFromList = unreadOnly;
        }

        queryClient.setQueriesData<any>(
          { queryKey: ['conversations'] },
          (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((p: any) => ({
                ...p,
                conversations: dropFromList
                  ? p.conversations.filter(
                      (c: Conversation) => c.id !== conv.id,
                    )
                  : p.conversations.map((c: Conversation) =>
                      c.id === conv.id ? { ...c, unreadCount: 0 } : c,
                    ),
                // Keep `total` honest when dropping — the unread badge in
                // the sidebar reads from it and would otherwise be stale.
                ...(dropFromList && p.pagination
                  ? {
                      pagination: {
                        ...p.pagination,
                        total: Math.max(0, (p.pagination.total ?? 1) - 1),
                      },
                    }
                  : {}),
              })),
            };
          },
        );
        inboxService.markAsRead(conv.id, lastMsgId).catch(() => {
          // Server rejected — refetch to roll back.
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });
      }
    },
    [
      lastClickedIndex,
      conversations,
      selectedIds.size,
      selectionMode,
      clearSelection,
      onSelect,
      queryClient,
      orgId,
      viewId,
      unreadOnly,
    ],
  );

  const toggleSelect = useCallback((id: string, index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastClickedIndex(index);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  }, [conversations]);

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient]);

  // Quick "Arquivar" right in the selection bar (the menu has it too, but at
  // the bottom). Also refreshes the counts so the "Arquivados" badge bumps.
  const handleQuickArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      await inboxService.bulkArchive(ids);
      toast.success(
        `${ids.length} conversa${ids.length > 1 ? 's' : ''} arquivada${ids.length > 1 ? 's' : ''}`,
      );
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao arquivar conversas');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, clearSelection, queryClient]);

  // Realtime: refresh list on inbound messages, imported conversations, or
  // state transitions (assign/close/reopen/transfer).
  useEffect(() => {
    const unsubNew = on('message:new', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubImported = on('conversation:imported', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubUpdated = on('conversation:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    // When the same user reads a conversation in another tab/device, zero
    // the badge here too without a full refetch.
    const unsubRead = on('conversation:read', (payload: any) => {
      const id = payload?.conversationId;
      if (!id) return;
      queryClient.setQueriesData<any>(
        { queryKey: ['conversations'] },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((p: any) => ({
              ...p,
              conversations: p.conversations.map((c: Conversation) =>
                c.id === id ? { ...c, unreadCount: 0 } : c,
              ),
            })),
          };
        },
      );
    });
    // Mirror of conversation:read for the "mark as unread" action — keeps
    // other tabs/devices for the same user in sync with the new badge.
    const unsubUnread = on('conversation:unread', (payload: any) => {
      const id = payload?.conversationId;
      if (!id) return;
      const count = Number(payload?.unreadCount) || 1;
      queryClient.setQueriesData<any>(
        { queryKey: ['conversations'] },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((p: any) => ({
              ...p,
              conversations: p.conversations.map((c: Conversation) =>
                c.id === id ? { ...c, unreadCount: count } : c,
              ),
            })),
          };
        },
      );
      // Refetch so the conversation re-enters an "unread only" view it
      // had previously dropped from.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    // Reconnect: any events that fired while we were offline are gone, so
    // sync the list from scratch when the socket comes back.
    const unsubReconnect = onReconnect(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-views'] });
    });
    return () => {
      unsubNew?.();
      unsubImported?.();
      unsubUpdated?.();
      unsubRead?.();
      unsubUnread?.();
      unsubReconnect?.();
    };
  }, [on, onReconnect, queryClient]);

  // Bulk: pin the selected conversations into a brand-new inbox view.
  // Asks for the inbox name with a quick prompt (no full dialog overhead),
  // creates the view with conversationIds=selected, then navigates to it.
  const router = useRouter();
  const handleCreateInboxFromSelection = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const defaultName = `Seleção ${new Date().toLocaleDateString('pt-BR')}`;
    const name = window.prompt(
      `Nome da nova inbox (com as ${ids.length} conversas selecionadas):`,
      defaultName,
    );
    if (!name || !name.trim()) return;
    setBulkLoading(true);
    try {
      const view = await inboxViewsService.create({
        name: name.trim(),
        icon: 'Star',
        color: 'amber',
        filters: { conversationIds: ids },
      });
      toast.success(`Inbox "${view.name}" criada com ${ids.length} conversas`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['inbox-views'] });
      router.push(`/inbox?view=${view.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao criar inbox');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, clearSelection, queryClient, router]);

  const getLastMessagePreview = (conv: Conversation) => {
    const last = conv.messages[0];
    if (!last) return 'Sem mensagens';
    const prefix = last.direction === 'OUTBOUND' ? 'Você: ' : '';
    const rt = (last as any).metadata?.replyTo;
    const storyPrefix = rt?.story
      ? rt.story.kind === 'mention'
        ? '📸 Mencionou no story · '
        : '📸 Respondeu seu story · '
      : rt?.ad
        ? '📢 Respondeu ao anúncio · '
        : '';
    return prefix + storyPrefix + (last.content?.text || mediaPreviewLabel(last.type));
  };

  const formatTime = (date: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 24) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // LíderHub-style tabs: the ACTIVE tab adopts its own semantic colour
  // (icon + label + underline), not a single brand colour. `badge` = pill bg,
  // `activeText` = colour when selected, `activeBorder` = underline colour.
  const statusTabs: {
    label: string;
    value: StatusTab;
    icon: React.ElementType;
    badge: string;
    activeText: string;
    activeBorder: string;
  }[] = [
    { label: 'AI', value: 'BOT', icon: Bot, badge: 'bg-violet-500', activeText: 'text-violet-600 dark:text-violet-400', activeBorder: 'border-violet-500' },
    { label: 'Ativos', value: 'OPEN', icon: MessageCircle, badge: 'bg-emerald-500', activeText: 'text-emerald-600 dark:text-emerald-400', activeBorder: 'border-emerald-500' },
    { label: 'Pendentes', value: 'PENDING', icon: Clock, badge: 'bg-amber-500', activeText: 'text-amber-600 dark:text-amber-500', activeBorder: 'border-amber-500' },
    { label: 'Grupos', value: 'GROUPS', icon: Users, badge: 'bg-sky-500', activeText: 'text-sky-600 dark:text-sky-400', activeBorder: 'border-sky-500' },
  ];

  const archivedCount = statusCounts?.['ARCHIVED'] ?? 0;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Cabeçalho "Conversas" — título + ⋮ menu + nova conversa (estilo LíderHub:
          tira essas ações da linha das abas pra elas ficarem limpas e largas). */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-3.5 py-3 dark:border-zinc-800">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Conversas</h2>
        <div className="flex items-center gap-0.5">
          {/* Menu (3 pontos) — Selecionar conversas */}
          <div className="relative">
            <button
              title="Mais opções"
              onClick={() => setListMenuOpen((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                listMenuOpen || selectionMode
                  ? 'bg-primary/10 text-primary'
                  : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <EllipsisVertical className="h-[18px] w-[18px]" />
            </button>
            {listMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setListMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <button
                    onClick={() => { setSelectionMode(true); setListMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                  >
                    <CheckSquare className="h-4 w-4 shrink-0 text-zinc-400" />
                    Selecionar conversas
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Nova conversa — ícone "nova conversa" do WhatsApp (balão + lápis) */}
          <button
            title="Nova conversa"
            onClick={() => setNewConvOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-500"
          >
            <WhatsAppNewChatIcon className="h-[19px] w-[19px]" />
          </button>
        </div>
      </div>

      {/* Status tabs — AI / Ativos / Pendentes / Grupos (linha limpa e larga, igual
          LíderHub). Com os Arquivados abertos, a linha inteira fica esmaecida e
          nenhuma aba aparece selecionada (igual LíderHub). */}
      <div
        className={`flex items-stretch transition-opacity duration-200 ${
          archivedOnly ? 'opacity-40' : 'opacity-100'
        }`}
      >
        {statusTabs.map((tab) => {
          const isActive = statusTab === tab.value && !archivedOnly;
          const count = statusCounts?.[tab.value] ?? 0;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => {
                // Clicar numa aba enquanto os Arquivados estão abertos fecha-os.
                if (archivedOnly) {
                  setArchivedOnly(false);
                  updatePrefs({ archivedOnly: false });
                }
                setStatusTab(isActive ? 'ALL' : tab.value);
              }}
              className={`flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-normal transition-colors ${
                isActive
                  ? 'text-zinc-900 dark:text-zinc-100 bg-zinc-100/30 dark:bg-zinc-900/40'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-muted/30 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {/* ícone + badge de contagem */}
              <span className="relative">
                <Icon className={`h-[22px] w-[22px] ${isActive ? tab.activeText : ''}`} strokeWidth={1.75} />
                <span className={`absolute -right-2 -top-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-zinc-950 ${count > 0 ? tab.badge : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                  {count > 99 ? '99+' : count}
                </span>
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Arquivados — abre/fecha a lista de arquivadas inline (igual LíderHub):
          mostra a contagem, gira o chevron e destaca a linha quando aberto. */}
      <button
        onClick={toggleArchived}
        title={archivedOnly ? 'Fechar arquivados' : 'Ver conversas arquivadas'}
        className={`flex w-full items-center gap-2.5 border-t border-zinc-200/80 px-4 py-1.5 text-xs transition-colors dark:border-zinc-800 ${
          archivedOnly
            ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
            : 'bg-zinc-50/60 text-zinc-500/80 opacity-90 hover:bg-zinc-100/60 hover:text-zinc-700 dark:bg-zinc-900/20 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-300'
        }`}
      >
        <Archive className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Arquivados</span>
        {archivedCount > 0 && (
          <span
            className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums transition-colors ${
              archivedOnly
                ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {archivedCount > 999 ? '999+' : archivedCount}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            archivedOnly ? 'rotate-180' : ''
          }`}
        />
      </button>


      {/* Bulk action bar */}
      {(selectionMode || selectedIds.size > 0) && (
        <div className="flex items-center gap-1.5 border-t border-b border-zinc-200/80 bg-primary/4 px-3 py-1.5 dark:border-zinc-800 dark:bg-primary/10">
          <button
            onClick={clearSelection}
            title="Sair da seleção"
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* Select-all checkbox */}
          <button
            onClick={selectedIds.size === conversations.length ? clearSelection : selectAll}
            title={selectedIds.size === conversations.length ? 'Desmarcar todas' : 'Selecionar todas'}
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-primary"
          >
            {selectedIds.size === conversations.length && conversations.length > 0 ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">
            {selectedIds.size > 0
              ? `${selectedIds.size} selecionada${selectedIds.size > 1 ? 's' : ''}`
              : 'Clique nas conversas'}
          </span>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
          <button
            onClick={selectAll}
            className="text-[11px] text-primary hover:underline"
          >
            Todas
          </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleQuickArchive}
              disabled={bulkLoading}
              title="Arquivar selecionadas"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          {selectedIds.size > 0 && (
            <BulkActionsMenu
              conversationIds={Array.from(selectedIds)}
              conversations={conversations}
              disabled={bulkLoading}
              onCreateInbox={handleCreateInboxFromSelection}
              onDone={clearSelection}
            />
          )}
        </div>
      )}

      {/* Divider */}
      {!(selectionMode || selectedIds.size > 0) && (
        <div className="mx-3 border-t border-zinc-100 dark:border-zinc-800/60" />
      )}

      {/* Conversation list */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto scrollbar-thin ${
          archivedOnly ? 'animate-archived-reveal' : ''
        }`}
      >
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-3 py-2">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
              <div className="flex-1 space-y-2 pt-0.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-3 w-36 animate-pulse rounded bg-zinc-50 dark:bg-zinc-800/60" />
              </div>
            </div>
          ))
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <MessageSquare className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-zinc-400 dark:text-zinc-500">
              Nenhuma conversa encontrada
            </p>
            {(activeFilterCount > 0 || search) && (
              <button
                onClick={clearAllFilters}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {conversations.map((conv, index) => {
              const isActive = conv.id === activeId;
              const isSelected = selectedIds.has(conv.id);
              const inSelectionMode = selectionMode || selectedIds.size > 0;
              return (
                <button
                  key={conv.id}
                  onClick={(e) => handleConversationClick(conv, index, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      conversation: conv,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  className={`group flex w-full gap-3 px-3 py-2 text-left transition-colors duration-100 border-l-2 ${
                    isSelected
                      ? 'bg-primary/[0.06] dark:bg-primary/10 border-l-primary'
                      : isActive
                        ? 'bg-primary/[0.06] dark:bg-primary/10 border-l-primary'
                        : 'border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  {/* ── Avatar with contact-status ring + checkbox overlay ── */}
                  {(() => {
                    const contactStatus = conv.contact.status;
                    const ringColor = contactStatus?.color;
                    return (
                      <div className="group/avatar relative shrink-0">
                        <div className={`${inSelectionMode || isSelected ? 'invisible' : 'group-hover/avatar:invisible'}`}>
                          <div
                            className="rounded-full"
                            title={contactStatus ? `Status: ${contactStatus.name}` : undefined}
                            style={ringColor ? { border: `2.5px solid ${ringColor}` } : undefined}
                          >
                            <ListAvatar name={conv.contact.name} avatarUrl={conv.contact.avatarUrl} />
                          </div>
                        </div>
                        <div
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(conv.id, index); }}
                          className={`absolute inset-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary text-white opacity-100'
                              : inSelectionMode
                                ? 'border-zinc-300 bg-zinc-100 text-transparent hover:border-primary/50 dark:border-zinc-600 dark:bg-zinc-800'
                                : 'border-zinc-300 bg-white text-transparent opacity-0 hover:border-primary/50 group-hover/avatar:opacity-100 dark:border-zinc-600 dark:bg-zinc-900'
                          }`}
                          title={isSelected ? 'Desmarcar' : 'Selecionar'}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Content ── */}
                  {(() => {
                    const unread = conv.unreadCount ?? 0;
                    const hasUnread = unread > 0;
                    const lastMsg = conv.messages[0];
                    // Dedupe: a mesma tag pode estar na conversa E no contato —
                    // mostrar um chip só.
                    const allTags = [
                      ...new Map(
                        [...(conv.tags ?? []), ...(conv.contact.tags ?? [])].map(
                          (t) => [t.tag.id, t],
                        ),
                      ).values(),
                    ];
                    return (
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        {/* Row 1 — name + timestamp + dots */}
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`flex-1 truncate text-sm ${hasUnread ? 'font-bold text-zinc-900 dark:text-zinc-50' : 'font-semibold ' + (isActive || isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-200')}`}>
                            {conv.contact.name || conv.contact.phone || 'Desconhecido'}
                          </span>
                          <span className={`shrink-0 text-xs tabular-nums ${hasUnread ? 'font-semibold text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            {formatTime(lastMsg?.createdAt ?? conv.lastMessageAt)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenu({ conversation: conv, position: { x: e.clientX, y: e.clientY } });
                            }}
                            title="Ações"
                            className="invisible shrink-0 group-hover:visible flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                          >
                            <EllipsisVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Row 2 — tick + preview */}
                        <div className="mt-1 flex items-center gap-0.5 min-w-0">
                          {lastMsg?.direction === 'OUTBOUND' && (
                            <Check className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                          )}
                          <p className={`flex-1 truncate text-[12px] ${hasUnread ? 'font-medium text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {getLastMessagePreview(conv)}
                          </p>
                        </div>

                        {/* Row 3 — chips à esquerda (truncam/clipam) + badge e
                            Aceitar SEMPRE alinhados à direita, sem quebrar */}
                        <div className="mt-2 flex items-center gap-1 min-w-0">
                          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                          {/* Brazilian state from DDD */}
                          {(() => {
                            if (conv.isGroup) return null;
                            const st = getBrazilState(conv.contact.phone);
                            if (!st) return null;
                            return (
                              <span
                                title={st.name}
                                className="flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                              >
                                <StateFlag uf={st.uf} className="h-2.5 w-4 shrink-0 rounded-[1px] object-cover ring-1 ring-black/10" />
                                {st.uf}
                              </span>
                            );
                          })()}
                          {/* Tag chips */}
                          {allTags.slice(0, 2).map((t) => (
                            <span
                              key={t.tag.id}
                              title={t.tag.name}
                              className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium"
                              style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: t.tag.color }} />
                              <span className="max-w-[48px] truncate">{t.tag.name}</span>
                            </span>
                          ))}
                          {allTags.length > 2 && (
                            <span className="shrink-0 text-[10px] text-zinc-400">+{allTags.length - 2}</span>
                          )}
                          {/* Conexão — nome da conexão (ex.: "RMC") que recebeu */}
                          {conv.channel.name ? (
                            <span
                              title={`Conexão: ${conv.channel.name}${conv.channel.phoneNumber ? ` · ${formatPhone(conv.channel.phoneNumber)}` : ''}`}
                              className="flex shrink-0 items-center gap-0.5 rounded bg-zinc-50 px-1 py-px text-[10px] font-medium text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500"
                            >
                              <Phone className="h-2.5 w-2.5 shrink-0" />
                              <span className="max-w-[70px] truncate">{conv.channel.name}</span>
                            </span>
                          ) : null}
                          {/* Assignee pill — gradient (LíderHub style) */}
                          {conv.assignedTo ? (
                            <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gradient-to-r from-sky-100 to-indigo-100 px-1.5 py-px text-[10px] font-medium text-sky-700 ring-1 ring-sky-500/15 dark:from-sky-900/30 dark:to-indigo-900/30 dark:text-sky-300 dark:ring-sky-400/15">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-[90px]">{conv.assignedTo.name}</span>
                            </span>
                          ) : null}
                          </div>
                          {/* Unread badge */}
                          {hasUnread && (
                            <span className="shrink-0 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold leading-none text-white">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                          {/* Accept pending */}
                          {conv.status === 'PENDING' && (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleAccept(e, conv.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAccept(e as unknown as React.MouseEvent, conv.id)}
                              className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-[3px] text-[10px] font-semibold text-white transition-opacity hover:bg-primary/80"
                            >
                              {acceptingId === conv.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Aceitar'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </button>
              );
            })}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            )}
          </>
        )}
      </div>

      {contextMenu && (
        <ConversationContextMenu
          conversation={contextMenu.conversation}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onSelect={() => {
            const id = contextMenu.conversation.id;
            setSelectionMode(true);
            setSelectedIds((prev) => new Set(prev).add(id));
          }}
        />
      )}

      {newConvOpen && (
        <NewConversationModal
          onClose={() => setNewConvOpen(false)}
          onCreated={(conv) => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            onSelect(conv);
          }}
        />
      )}
    </div>
  );
}
