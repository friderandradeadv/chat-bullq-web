import { create } from 'zustand';

/**
 * Ponte entre o botão "pedir resposta do robô" (no painel do cliente) e a caixa
 * de mensagem (no rodapé do chat). O botão gera um RASCUNHO e joga aqui; o
 * chat-panel consome quando a conversa bate e preenche o compositor pra o
 * operador editar/enviar. Zera após consumir.
 */
interface ComposerDraftStore {
  pending: { conversationId: string; text: string } | null;
  setDraft: (conversationId: string, text: string) => void;
  clear: () => void;
}

export const useComposerDraftStore = create<ComposerDraftStore>((set) => ({
  pending: null,
  setDraft: (conversationId, text) => set({ pending: { conversationId, text } }),
  clear: () => set({ pending: null }),
}));
