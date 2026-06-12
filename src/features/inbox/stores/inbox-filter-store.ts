import { create } from 'zustand';

export type InboxScope = 'ALL' | 'MINE';
export type InboxStatusTab = 'ALL' | 'OPEN' | 'PENDING' | 'BOT' | 'GROUPS';

/** Sentinela do filtro de responsável — conversas sem ninguém atribuído. */
export const UNASSIGNED = 'none';

/**
 * Shared filter state for the inbox. Lives in a store (not in ConversationList)
 * so the top toolbar (search + Responsável + Status + Etiquetas + Mais filtros,
 * full-width, LíderHub style) and the conversation list can drive the same query.
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
  /** Status do contato (Classes > Status). OR — qualquer um casa. */
  selectedStatusIds: string[];
  /** Responsáveis específicos (ids de user) + UNASSIGNED. OR. Quando
   *  preenchido, vence o scope ALL/MINE. */
  selectedAssigneeIds: string[];

  setSearch: (v: string) => void;
  setScope: (v: InboxScope) => void;
  setStatusTab: (v: InboxStatusTab) => void;
  setSelectedChannelId: (v: string | null) => void;
  setUnreadOnly: (v: boolean) => void;
  setArchivedOnly: (v: boolean) => void;
  setShowGroups: (v: boolean) => void;
  setSelectedTagIds: (v: string[]) => void;
  setSelectedStatusIds: (v: string[]) => void;
  setSelectedAssigneeIds: (v: string[]) => void;
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
  selectedStatusIds: [],
  selectedAssigneeIds: [],

  setSearch: (v) => set({ search: v }),
  setScope: (v) => set({ scope: v }),
  setStatusTab: (v) => set({ statusTab: v }),
  setSelectedChannelId: (v) => set({ selectedChannelId: v }),
  setUnreadOnly: (v) => set({ unreadOnly: v }),
  setArchivedOnly: (v) => set({ archivedOnly: v }),
  setShowGroups: (v) => set({ showGroups: v }),
  setSelectedTagIds: (v) => set({ selectedTagIds: v }),
  setSelectedStatusIds: (v) => set({ selectedStatusIds: v }),
  setSelectedAssigneeIds: (v) => set({ selectedAssigneeIds: v }),
  toggleTagId: (id) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.includes(id)
        ? s.selectedTagIds.filter((x) => x !== id)
        : [...s.selectedTagIds, id],
    })),
  clearFilters: () =>
    set({
      unreadOnly: false,
      archivedOnly: false,
      showGroups: false,
      selectedTagIds: [],
      selectedStatusIds: [],
      selectedAssigneeIds: [],
    }),
}));
