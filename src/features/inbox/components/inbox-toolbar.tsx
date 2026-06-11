'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  Search,
  X,
  ChevronDown,
  Users,
  User,
  Check,
  SlidersHorizontal,
  Inbox,
  MessageSquare,
  MailOpen,
  Archive,
} from 'lucide-react';
import { channelsService } from '@/features/channels/services/channels.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { ZappfyIcon, MetaIcon, InstagramIcon } from '@/components/ui/icons';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useAuthStore } from '@/stores/auth-store';
import { useInboxPreferences } from '../hooks/use-inbox-preferences';
import {
  useInboxFilterStore,
  type InboxScope,
  type InboxStatusTab,
} from '../stores/inbox-filter-store';

const channelIcons: Record<string, React.ElementType> = {
  WHATSAPP_ZAPPFY: ZappfyIcon,
  WHATSAPP_OFFICIAL: MetaIcon,
  INSTAGRAM: InstagramIcon,
};

const scopeOptions: { label: string; value: InboxScope; icon: React.ElementType }[] = [
  { label: 'Todas as conversas', value: 'ALL', icon: Users },
  { label: 'Minhas conversas', value: 'MINE', icon: User },
];

const statusOptions: { label: string; value: InboxStatusTab; color: string }[] = [
  { label: 'Todos', value: 'ALL', color: 'bg-zinc-400' },
  { label: 'IA', value: 'BOT', color: 'bg-violet-500' },
  { label: 'Ativos', value: 'OPEN', color: 'bg-emerald-500' },
  { label: 'Pendentes', value: 'PENDING', color: 'bg-amber-500' },
  { label: 'Grupos', value: 'GROUPS', color: 'bg-sky-500' },
];

export function InboxToolbar() {
  const orgId = useOrgId();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { update: updatePrefs } = useInboxPreferences();

  const search = useInboxFilterStore((s) => s.search);
  const setSearch = useInboxFilterStore((s) => s.setSearch);
  const scope = useInboxFilterStore((s) => s.scope);
  const setScope = useInboxFilterStore((s) => s.setScope);
  const statusTab = useInboxFilterStore((s) => s.statusTab);
  const setStatusTab = useInboxFilterStore((s) => s.setStatusTab);
  const selectedChannelId = useInboxFilterStore((s) => s.selectedChannelId);
  const setSelectedChannelId = useInboxFilterStore((s) => s.setSelectedChannelId);
  const unreadOnly = useInboxFilterStore((s) => s.unreadOnly);
  const setUnreadOnly = useInboxFilterStore((s) => s.setUnreadOnly);
  const archivedOnly = useInboxFilterStore((s) => s.archivedOnly);
  const setArchivedOnly = useInboxFilterStore((s) => s.setArchivedOnly);
  const showGroups = useInboxFilterStore((s) => s.showGroups);
  const setShowGroups = useInboxFilterStore((s) => s.setShowGroups);
  const selectedTagIds = useInboxFilterStore((s) => s.selectedTagIds);
  const setSelectedTagIds = useInboxFilterStore((s) => s.setSelectedTagIds);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: () => tagsService.list(),
  });

  // Local search text with debounce → store.
  const [text, setText] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onSearch = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(v), 300);
  };

  const [tagSearch, setTagSearch] = useState('');
  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, tagSearch]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  const moreCount =
    (unreadOnly ? 1 : 0) +
    (archivedOnly ? 1 : 0) +
    (showGroups ? 1 : 0) +
    selectedTagIds.length +
    (selectedChannelId ? 1 : 0);

  const handleScope = (v: InboxScope) => {
    setScope(v);
    updatePrefs({ scope: v });
  };
  const handleChannel = (v: string | null) => {
    setSelectedChannelId(v);
    updatePrefs({ selectedChannelId: v });
  };
  const toggleUnread = () => {
    const n = !unreadOnly;
    setUnreadOnly(n);
    updatePrefs({ unreadOnly: n });
  };
  const toggleArchived = () => {
    const n = !archivedOnly;
    setArchivedOnly(n);
    updatePrefs({ archivedOnly: n });
  };
  const toggleGroups = () => {
    const n = !showGroups;
    setShowGroups(n);
    updatePrefs({ showGroups: n });
  };
  const toggleTag = (id: string) => {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((x) => x !== id)
      : [...selectedTagIds, id];
    setSelectedTagIds(next);
    updatePrefs({ tagIds: next });
  };
  const clearMore = () => {
    setUnreadOnly(false);
    setArchivedOnly(false);
    setShowGroups(false);
    setSelectedTagIds([]);
    setSelectedChannelId(null);
    updatePrefs({ unreadOnly: false, archivedOnly: false, showGroups: false, tagIds: [], selectedChannelId: null });
  };

  const currentScope = scopeOptions.find((o) => o.value === scope) ?? scopeOptions[0];
  const currentStatus = statusOptions.find((o) => o.value === statusTab) ?? statusOptions[0];
  const ScopeIcon = currentScope.icon;

  const pillBase =
    'flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium outline-none transition-colors';
  const pillIdle =
    'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';
  const pillActive = 'border-primary/40 bg-primary/[0.06] text-primary dark:bg-primary/10';

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Search — left */}
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Pesquisar conversas..."
          className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-8 text-[13px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {text && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Responsável */}
      <Popover className="relative">
        <PopoverButton className={`${pillBase} ${scope !== 'ALL' ? pillActive : pillIdle}`}>
          <ScopeIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Responsável</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          transition
          className="z-50 mt-1.5 min-w-48 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
        >
          {({ close }) => (
            <>
              {scopeOptions.map((o) => {
                const Icon = o.icon;
                const isActive = scope === o.value;
                const disabled = o.value === 'MINE' && !currentUserId;
                return (
                  <button
                    key={o.value}
                    disabled={disabled}
                    onClick={() => { handleScope(o.value); close(); }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                        : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{o.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </>
          )}
        </PopoverPanel>
      </Popover>

      {/* Status */}
      <Popover className="relative">
        <PopoverButton className={`${pillBase} ${statusTab !== 'ALL' ? pillActive : pillIdle}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${currentStatus.color}`} />
          <span className="hidden sm:inline">Status</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          transition
          className="z-50 mt-1.5 min-w-44 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
        >
          {({ close }) => (
            <>
              {statusOptions.map((o) => {
                const isActive = statusTab === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => { setStatusTab(o.value); close(); }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      isActive
                        ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                        : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${o.color}`} />
                    <span className="flex-1">{o.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </>
          )}
        </PopoverPanel>
      </Popover>

      {/* Mais filtros */}
      <Popover className="relative">
        <PopoverButton className={`${pillBase} ${moreCount > 0 ? pillActive : pillIdle}`}>
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Mais filtros</span>
          {moreCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {moreCount}
            </span>
          )}
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          transition
          className="z-50 mt-1.5 w-64 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
        >
          {/* Channel */}
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Canal</p>
          <button
            onClick={() => handleChannel(null)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
              !selectedChannelId ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Inbox className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Todos os canais</span>
            {!selectedChannelId && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {channels.map((ch) => {
            const Icon = channelIcons[ch.type] || MessageSquare;
            const isActive = selectedChannelId === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => handleChannel(ch.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  isActive ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{ch.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}

          <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Filtros</p>
          {[
            { label: 'Não lidas', icon: MailOpen, active: unreadOnly, toggle: toggleUnread },
            { label: 'Arquivadas', icon: Archive, active: archivedOnly, toggle: toggleArchived },
            { label: 'Incluir grupos', icon: Users, active: showGroups, toggle: toggleGroups },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.label}
                onClick={f.toggle}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  f.active ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${f.active ? 'border-primary bg-primary text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {f.active && <Check className="h-2.5 w-2.5" />}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{f.label}</span>
              </button>
            );
          })}

          {tags.length > 0 && (
            <>
              <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Tags</p>
              <div className="px-1.5 pb-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape' && tagSearch) { e.stopPropagation(); setTagSearch(''); } }}
                    placeholder="Buscar tag..."
                    className="w-full rounded-md border-0 bg-zinc-100/80 py-1 pl-7 pr-2 text-[12px] outline-none ring-1 ring-transparent focus:bg-white focus:ring-primary/30 dark:bg-zinc-800/60 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto scrollbar-thin">
                {filteredTags.map((tag) => {
                  const isActive = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                        isActive ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isActive ? 'border-primary bg-primary text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                        {isActive && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 truncate">{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {moreCount > 0 && (
            <>
              <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <button
                onClick={clearMore}
                className="flex w-full items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800/60"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            </>
          )}
        </PopoverPanel>
      </Popover>
    </div>
  );
}
