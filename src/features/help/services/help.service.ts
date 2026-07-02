import { api } from '@/lib/api';

export interface HelpTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpEnvelope {
  data?: { reply?: string };
  reply?: string;
}

export const helpService = {
  /** Manda o histórico e recebe a orientação do Assistente de Ajuda. */
  async chat(messages: HelpTurn[]): Promise<{ reply: string }> {
    // A IA pode levar alguns segundos — sobe o timeout acima dos 15s globais.
    const { data } = await api.post<HelpEnvelope>(
      '/help/chat',
      { messages },
      { timeout: 90_000 },
    );
    const reply = data?.data?.reply ?? data?.reply;
    return { reply: reply || 'Não recebi uma resposta legível — tenta de novo.' };
  },
};
