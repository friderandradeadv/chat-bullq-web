import { api } from '@/lib/api';

export interface CopilotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotReply {
  reply: string;
  actions: string[];
}

/** A API global embrulha em `{ data, meta }`; aceitamos os dois formatos. */
interface CopilotEnvelope {
  data?: CopilotReply;
  reply?: string;
  actions?: string[];
}

export const adminCopilotService = {
  /** Manda o histórico inteiro e recebe a resposta do copiloto. */
  async chat(messages: CopilotTurn[]): Promise<CopilotReply> {
    // ⚠️ O `api` tem timeout GLOBAL de 15s — curto demais pro Copiloto, que faz
    // um loop de ferramentas (diagnóstico + IA) e costuma levar mais que isso.
    // Sem sobrescrever, o front abortava em 15s e a tela ficava "pensando" sem
    // nunca concluir. O backend já se limita a ~110s, então 120s aqui cobre.
    const { data } = await api.post<CopilotEnvelope>(
      '/admin-copilot/chat',
      { messages },
      { timeout: 120_000 },
    );
    // ⚠️ A API embrulha TODA resposta em `{ data, meta }` (ResponseInterceptor
    // global). Sem desembrulhar, `reply` vinha undefined e a bolha aparecia
    // VAZIA — era o "responde mas não mostra nada". `data.data ?? data` cobre
    // os dois formatos (igual ao resto dos services).
    const reply = data?.data ?? (data as unknown as CopilotReply);
    return {
      reply: reply?.reply || 'Não recebi uma resposta legível — tenta de novo.',
      actions: reply?.actions ?? [],
    };
  },
};
