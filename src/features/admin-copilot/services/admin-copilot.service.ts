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
    // ⚠️ O `api` tem timeout GLOBAL de 15s — curto demais pro Copiloto, que faz
    // um loop de ferramentas (diagnóstico + IA) e costuma levar mais que isso.
    // Sem sobrescrever, o front abortava em 15s e a tela ficava "pensando" sem
    // nunca concluir. O backend já se limita a ~110s, então 120s aqui cobre.
    const { data } = await api.post<CopilotReply>(
      '/admin-copilot/chat',
      { messages },
      { timeout: 120_000 },
    );
    return data;
  },
};
