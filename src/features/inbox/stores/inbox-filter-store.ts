import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** "Meus clientes": filtra pelas conversas cujo CLIENTE tem processo do qual
   *  VOCÊ é o advogado responsável (Case.responsibleId), independente de quem
   *  responde a conversa (robô/humano). Aditivo, não mexe no filtro de cima. */
  meusClientesOnly: boolean;

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
  setMeusClientesOnly: (v: boolean) => void;
  toggleTagId: (id: string) => void;
  clearFilters: () => void;
}

export const useInboxFilterStore = create<InboxFilterStore>()(
  persist(
    (set) => ({
  search: '',
  scope: 'ALL',
  // Abre nas conversas ATIVAS (não nas pendentes/todas) por padrão.
  statusTab: 'OPEN',
  selectedChannelId: null,
  unreadOnly: false,
  archivedOnly: false,
  showGroups: false,
  selectedTagIds: [],
  selectedStatusIds: [],
  selectedAssigneeIds: [],
  meusClientesOnly: false,

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
  setMeusClientesOnly: (v) => set({ meusClientesOnly: v }),
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
      meusClientesOnly: false,
    }),
  }),
    {
      name: 'inbox-filter',
      // Persiste SÓ o "Meus clientes" — o resto dos filtros continua efêmero.
      partialize: (s) => ({ meusClientesOnly: s.meusClientesOnly }),
    },
  ),
);
