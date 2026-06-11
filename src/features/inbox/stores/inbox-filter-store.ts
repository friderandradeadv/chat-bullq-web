import { create } from 'zustand';

export type InboxScope = 'ALL' | 'MINE';
export type InboxStatusTab = 'ALL' | 'OPEN' | 'PENDING' | 'BOT' | 'GROUPS';

/**
 * Shared filter state for the inbox. Lives in a store (not in ConversationList)
 * so the top toolbar (search + Responsável + Status + Mais filtros, full-width,
 * LíderHub style) and the conversation list can drive the same query.
 */
interface InboxFilterStore {
  search: string;
  scope: InboxScope;
  statusTab: InboxStatusTab;
  selectedChannelId: string | null;
  unreadOnly: boolean;
  archivedOnly: boolean;
  showGroups: boolean;
  selectedTagIds: string[];

  setSearch: (v: string) => void;
  setScope: (v: InboxScope) => void;
  setStatusTab: (v: InboxStatusTab) => void;
  setSelectedChannelId: (v: string | null) => void;
  setUnreadOnly: (v: boolean) => void;
  setArchivedOnly: (v: boolean) => void;
  setShowGroups: (v: boolean) => void;
  setSelectedTagIds: (v: string[]) => void;
  toggleTagId: (id: string) => void;
  clearFilters: () => void;
}

export const useInboxFilterStore = create<InboxFilterStore>((set) => ({
  search: '',
  scope: 'ALL',
  statusTab: 'ALL',
  selectedChannelId: null,
  unreadOnly: false,
  archivedOnly: false,
  showGroups: false,
  selectedTagIds: [],

  setSearch: (v) => set({ search: v }),
  setScope: (v) => set({ scope: v }),
  setStatusTab: (v) => set({ statusTab: v }),
  setSelectedChannelId: (v) => set({ selectedChannelId: v }),
  setUnreadOnly: (v) => set({ unreadOnly: v }),
  setArchivedOnly: (v) => set({ archivedOnly: v }),
  setShowGroups: (v) => set({ showGroups: v }),
  setSelectedTagIds: (v) => set({ selectedTagIds: v }),
  toggleTagId: (id) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.includes(id)
        ? s.selectedTagIds.filter((x) => x !== id)
        : [...s.selectedTagIds, id],
    })),
  clearFilters: () =>
    set({ unreadOnly: false, archivedOnly: false, showGroups: false, selectedTagIds: [] }),
}));
