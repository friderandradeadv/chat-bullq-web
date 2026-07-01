import { api } from '@/lib/api';

export interface CopilotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotReply {
  reply: string;
  actions: string[];
}

export const adminCopilotService = {
  /** Manda o histórico inteiro e recebe a resposta do copiloto. */
  async chat(messages: CopilotTurn[]): Promise<CopilotReply> {
    const { data } = await api.post<CopilotReply>('/admin-copilot/chat', {
      messages,
    });
    return data;
  },
};
