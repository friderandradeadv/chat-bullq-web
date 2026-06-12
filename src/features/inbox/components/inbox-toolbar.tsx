'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  Search,
  X,
  ChevronDown,
  Users,
  User,
  UserX,
  Check,
  SlidersHorizontal,
  Inbox,
  MessageSquare,
  MailOpen,
  Archive,
  Tag as TagIcon,
  Bell,
  Settings,
  LogOut,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { channelsService } from '@/features/channels/services/channels.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { membersService } from '@/features/settings/services/members.service';
import {
  notificationsSettingsService,
  type Notification,
} from '@/features/settings/services/notifications.service';
import { ZappfyIcon, MetaIcon, InstagramIcon } from '@/components/ui/icons';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useAuthStore } from '@/stores/auth-store';
import { useInboxPreferences } from '../hooks/use-inbox-preferences';
import { useInboxFilterStore, UNASSIGNED } from '../stores/inbox-filter-store';

const channelIcons: Record<string, React.ElementType> = {
  WHATSAPP_ZAPPFY: ZappfyIcon,
  WHATSAPP_OFFICIAL: MetaIcon,
  INSTAGRAM: InstagramIcon,
};

const checkboxClass = (active: boolean) =>
  `flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
    active
      ? 'border-primary bg-primary text-white'
      : 'border-zinc-300 dark:border-zinc-600'
  }`;

const itemClass = (active: boolean) =>
  `flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
    active
      ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
      : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
  }`;

export function InboxToolbar() {
  const orgId = useOrgId();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { update: updatePrefs } = useInboxPreferences();

  // Badge do sino — contagem de notificações não lidas (poll leve).
  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ['notifications-unread', orgId],
    queryFn: () => notificationsSettingsService.getUnreadCount(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const search = useInboxFilterStore((s) => s.search);
  const setSearch = useInboxFilterStore((s) => s.setSearch);
  const scope = useInboxFilterStore((s) => s.scope);
  const setScope = useInboxFilterStore((s) => s.setScope);
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
  const selectedStatusIds = useInboxFilterStore((s) => s.selectedStatusIds);
  const setSelectedStatusIds = useInboxFilterStore((s) => s.setSelectedStatusIds);
  const selectedAssigneeIds = useInboxFilterStore((s) => s.selectedAssigneeIds);
  const setSelectedAssigneeIds = useInboxFilterStore((s) => s.setSelectedAssigneeIds);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: () => tagsService.list(),
  });
  const { data: contactStatuses = [] } = useQuery({
    queryKey: ['contact-statuses', orgId],
    queryFn: () => contactStatusesService.list(),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => membersService.list(),
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

  const [statusSearch, setStatusSearch] = useState('');
  const filteredStatuses = useMemo(() => {
    const q = statusSearch.trim().toLowerCase();
    return q
      ? contactStatuses.filter((s) => s.name.toLowerCase().includes(q))
      : contactStatuses;
  }, [contactStatuses, statusSearch]);

  const moreCount =
    (unreadOnly ? 1 : 0) +
    (archivedOnly ? 1 : 0) +
    (showGroups ? 1 : 0) +
    (selectedChannelId ? 1 : 0);

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
  const toggleStatus = (id: string) => {
    const next = selectedStatusIds.includes(id)
      ? selectedStatusIds.filter((x) => x !== id)
      : [...selectedStatusIds, id];
    setSelectedStatusIds(next);
    updatePrefs({ contactStatusIds: next });
  };
  const clearStatuses = () => {
    setSelectedStatusIds([]);
    updatePrefs({ contactStatusIds: [] });
  };
  const clearTags = () => {
    setSelectedTagIds([]);
    updatePrefs({ tagIds: [] });
  };
  // Responsável: "Todas"/"Minhas" são atalhos exclusivos; marcar membros (ou
  // "Sem responsável") vira multi-select e força scope ALL pra não conflitar.
  const selectAllScope = () => {
    setScope('ALL');
    setSelectedAssigneeIds([]);
    updatePrefs({ scope: 'ALL', assigneeIds: [] });
  };
  const selectMineScope = () => {
    setScope('MINE');
    setSelectedAssigneeIds([]);
    updatePrefs({ scope: 'MINE', assigneeIds: [] });
  };
  const toggleAssignee = (userId: string) => {
    const next = selectedAssigneeIds.includes(userId)
      ? selectedAssigneeIds.filter((x) => x !== userId)
      : [...selectedAssigneeIds, userId];
    setSelectedAssigneeIds(next);
    if (scope !== 'ALL') setScope('ALL');
    updatePrefs({ assigneeIds: next, scope: 'ALL' });
  };
  const clearMore = () => {
    setUnreadOnly(false);
    setArchivedOnly(false);
    setShowGroups(false);
    setSelectedChannelId(null);
    updatePrefs({
      unreadOnly: false,
      archivedOnly: false,
      showGroups: false,
      selectedChannelId: null,
    });
  };

  const assigneeActive = scope === 'MINE' || selectedAssigneeIds.length > 0;
  const selectedStatusObjs = contactStatuses.filter((s) =>
    selectedStatusIds.includes(s.id),
  );

  const pillBase =
    'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium outline-none transition-colors';
  const pillIdle =
    'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';
  const pillActive = 'border-primary/40 bg-primary/[0.06] text-primary dark:bg-primary/10';

  const panelClass =
    'z-50 mt-1.5 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]';

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Search — borderless ocupando a esquerda (estilo LíderHub) */}
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Pesquisar conversas..."
          className="w-full border-0 bg-transparent py-2 pl-8 pr-8 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
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

      {/* Responsável — Todas/Minhas + multi-select de membros + sem responsável */}
      <Popover className="relative">
        <PopoverButton className={`${pillBase} ${assigneeActive ? pillActive : pillIdle}`}>
          {scope === 'MINE' ? (
            <User className="h-4 w-4 shrink-0" />
          ) : (
            <Users className="h-4 w-4 shrink-0" />
          )}
          <span className="hidden sm:inline">Responsável</span>
          {selectedAssigneeIds.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {selectedAssigneeIds.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </PopoverButton>
        <PopoverPanel anchor="bottom end" transition className={`${panelClass} w-60`}>
          {({ close }) => (
            <>
              <button
                onClick={() => { selectAllScope(); close(); }}
                className={itemClass(scope === 'ALL' && selectedAssigneeIds.length === 0)}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1">Todas as conversas</span>
                {scope === 'ALL' && selectedAssigneeIds.length === 0 && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
              <button
                disabled={!currentUserId}
                onClick={() => { selectMineScope(); close(); }}
                className={`${itemClass(scope === 'MINE')} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="flex-1">Minhas conversas</span>
                {scope === 'MINE' && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>

              <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Membros
              </p>
              <button
                onClick={() => toggleAssignee(UNASSIGNED)}
                className={itemClass(selectedAssigneeIds.includes(UNASSIGNED))}
              >
                <span className={checkboxClass(selectedAssigneeIds.includes(UNASSIGNED))}>
                  {selectedAssigneeIds.includes(UNASSIGNED) && <Check className="h-2.5 w-2.5" />}
                </span>
                <UserX className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="flex-1">Sem responsável</span>
              </button>
              <div className="max-h-52 overflow-y-auto scrollbar-thin">
                {members.map((m) => {
                  const isActive = selectedAssigneeIds.includes(m.user.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleAssignee(m.user.id)}
                      className={itemClass(isActive)}
                    >
                      <span className={checkboxClass(isActive)}>
                        {isActive && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="flex-1 truncate">
                        {m.user.name}
                        {m.user.id === currentUserId ? ' (você)' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </PopoverPanel>
      </Popover>

      {/* Status — status do contato (Classes > Status), multi-select */}
      <Popover className="relative">
        <PopoverButton
          className={`${pillBase} ${selectedStatusIds.length > 0 ? pillActive : pillIdle}`}
        >
          {selectedStatusObjs.length > 0 ? (
            <span className="flex shrink-0 -space-x-1">
              {selectedStatusObjs.slice(0, 3).map((s) => (
                <span
                  key={s.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white dark:ring-zinc-950"
                  style={{ backgroundColor: s.color }}
                />
              ))}
            </span>
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
          )}
          <span className="hidden sm:inline">Status</span>
          {selectedStatusIds.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {selectedStatusIds.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </PopoverButton>
        <PopoverPanel anchor="bottom end" transition className={`${panelClass} w-60`}>
          <button
            onClick={clearStatuses}
            className={itemClass(selectedStatusIds.length === 0)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
            <span className="flex-1">Todos</span>
            {selectedStatusIds.length === 0 && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          <button
            onClick={() => toggleStatus(UNASSIGNED)}
            className={itemClass(selectedStatusIds.includes(UNASSIGNED))}
          >
            <span className={checkboxClass(selectedStatusIds.includes(UNASSIGNED))}>
              {selectedStatusIds.includes(UNASSIGNED) && <Check className="h-2.5 w-2.5" />}
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-zinc-400" />
            <span className="flex-1">Sem status</span>
          </button>
          {contactStatuses.length > 6 && (
            <div className="px-1.5 pb-1 pt-0.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                <input
                  value={statusSearch}
                  onChange={(e) => setStatusSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape' && statusSearch) { e.stopPropagation(); setStatusSearch(''); } }}
                  placeholder="Buscar status..."
                  className="w-full rounded-md border-0 bg-zinc-100/80 py-1 pl-7 pr-2 text-[12px] outline-none ring-1 ring-transparent focus:bg-white focus:ring-primary/30 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {filteredStatuses.map((s) => {
              const isActive = selectedStatusIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStatus(s.id)}
                  title={s.description ?? undefined}
                  className={itemClass(isActive)}
                >
                  <span className={checkboxClass(isActive)}>
                    {isActive && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                </button>
              );
            })}
            {filteredStatuses.length === 0 && (
              <p className="px-2.5 py-2 text-center text-[12px] text-zinc-400">
                Nenhum status encontrado
              </p>
            )}
          </div>
        </PopoverPanel>
      </Popover>

      {/* Etiquetas — multi-select com busca */}
      <Popover className="relative">
        <PopoverButton
          className={`${pillBase} ${selectedTagIds.length > 0 ? pillActive : pillIdle}`}
        >
          <TagIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Etiquetas</span>
          {selectedTagIds.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {selectedTagIds.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </PopoverButton>
        <PopoverPanel anchor="bottom end" transition className={`${panelClass} w-60`}>
          <button onClick={clearTags} className={itemClass(selectedTagIds.length === 0)}>
            <TagIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Todas</span>
            {selectedTagIds.length === 0 && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          <div className="px-1.5 pb-1 pt-0.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
              <input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && tagSearch) { e.stopPropagation(); setTagSearch(''); } }}
                placeholder="Buscar etiqueta..."
                className="w-full rounded-md border-0 bg-zinc-100/80 py-1 pl-7 pr-2 text-[12px] outline-none ring-1 ring-transparent focus:bg-white focus:ring-primary/30 dark:bg-zinc-800/60 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {filteredTags.map((tag) => {
              const isActive = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={itemClass(isActive)}
                >
                  <span className={checkboxClass(isActive)}>
                    {isActive && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 truncate">{tag.name}</span>
                </button>
              );
            })}
            {filteredTags.length === 0 && (
              <p className="px-2.5 py-2 text-center text-[12px] text-zinc-400">
                Nenhuma etiqueta encontrada
              </p>
            )}
          </div>
        </PopoverPanel>
      </Popover>

      {/* Mais filtros — canal + toggles */}
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
        <PopoverPanel anchor="bottom end" transition className={`${panelClass} w-64`}>
          {/* Channel */}
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Canal</p>
          <button onClick={() => handleChannel(null)} className={itemClass(!selectedChannelId)}>
            <Inbox className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Todos os canais</span>
            {!selectedChannelId && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {channels.map((ch) => {
            const Icon = channelIcons[ch.type] || MessageSquare;
            const isActive = selectedChannelId === ch.id;
            return (
              <button key={ch.id} onClick={() => handleChannel(ch.id)} className={itemClass(isActive)}>
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
              <button key={f.label} onClick={f.toggle} className={itemClass(f.active)}>
                <span className={checkboxClass(f.active)}>
                  {f.active && <Check className="h-2.5 w-2.5" />}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{f.label}</span>
              </button>
            );
          })}

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

      {/* Divisor + sino + avatar (topo direito, estilo LíderHub) */}
      <div className="mx-1 h-6 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />

      {/* Sino de notificações */}
      <Popover className="relative shrink-0">
        <PopoverButton
          title="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unreadNotifs > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-[4px] text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-zinc-950">
              {unreadNotifs > 99 ? '99+' : unreadNotifs}
            </span>
          )}
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          transition
          className="z-50 mt-1.5 w-[380px] rounded-xl border border-zinc-200/80 bg-white shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
        >
          <NotificationsPanel />
        </PopoverPanel>
      </Popover>

      {/* Avatar do usuário */}
      <Popover className="relative shrink-0">
        <PopoverButton className="outline-none" title={user?.name ?? 'Perfil'}>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? 'avatar'}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200 transition-opacity hover:opacity-85 dark:ring-zinc-700"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: avatarColor(user?.name ?? null) }}
            >
              {avatarInitials(user?.name ?? null)}
            </span>
          )}
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          transition
          className="z-50 mt-1.5 w-60 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
        >
          {({ close }) => (
            <>
              <div className="px-3 py-2">
                <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {user?.name ?? 'Usuário'}
                </p>
                {user?.email && (
                  <p className="truncate text-[11px] text-zinc-400">{user.email}</p>
                )}
              </div>
              <div className="mx-2 border-t border-zinc-100 dark:border-zinc-800" />
              <button
                onClick={() => { close(); router.push('/settings/general'); }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
                Configurações
              </button>
              <button
                onClick={() => { close(); logout(); }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sair
              </button>
            </>
          )}
        </PopoverPanel>
      </Popover>
    </div>
  );
}

/**
 * Painel do sino — monta (e busca) só quando o popover abre. Layout espelha o
 * LíderHub: header "Notificações", itens com bolinha azul de não-lida +
 * tempo relativo, footer com "marcar todas como lidas".
 */
function NotificationsPanel() {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications-list', orgId],
    queryFn: () => notificationsSettingsService.list(1, 12),
  });
  const notifications = data?.notifications ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications-list', orgId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread', orgId] });
  };

  const handleRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await notificationsSettingsService.markRead(n.id);
      invalidate();
    } catch {
      // silencioso — o badge corrige no próximo poll
    }
  };

  const handleReadAll = async () => {
    try {
      await notificationsSettingsService.markAllRead();
      invalidate();
    } catch {
      // idem
    }
  };

  return (
    <div className="flex max-h-[480px] flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
          Notificações
        </h3>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleReadAll}
            title="Marcar todas como lidas"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar lidas
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <Bell className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-[13px] text-zinc-400">Nenhuma notificação</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleRead(n)}
              className={`flex w-full items-start gap-3 border-b border-zinc-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${
                n.isRead ? 'opacity-70' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug text-zinc-800 dark:text-zinc-100">
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-zinc-500 dark:text-zinc-400">
                    {n.body}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                <span className="text-[10.5px] text-zinc-400">
                  {relativeTime(n.createdAt)}
                </span>
                {!n.isRead && <span className="h-2 w-2 rounded-full bg-sky-500" />}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function relativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  return `há ${d}d`;
}
