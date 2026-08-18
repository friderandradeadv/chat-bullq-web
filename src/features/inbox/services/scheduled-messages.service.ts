import { api } from '@/lib/api';

export type ScheduledMessageStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'CANCELED'
  | 'FAILED';

/** Arquivo que vai junto com a agendada (hoje: o PDF da prestação de contas). */
export interface ScheduledAnexo {
  nome: string;
  /** caminho relativo à base da API (ex.: /uploads/prestacao/...) */
  url: string;
}

export interface ScheduledMessage {
  id: string;
  conversationId: string;
  channelId: string;
  type: string;
  content: { text?: string };
  /** Resolvido pelo backend: vazio = a mensagem vai sem anexo. */
  anexos?: ScheduledAnexo[];
  scheduledAt: string;
  status: ScheduledMessageStatus;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
}

/** URL completa pra abrir/baixar o anexo (a API serve o /uploads). */
export function scheduledAnexoHref(a: ScheduledAnexo): string {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '');
  return a.url.startsWith('http') ? a.url : `${base}${a.url}`;
}

export const scheduledMessagesService = {
  async list(conversationId?: string): Promise<ScheduledMessage[]> {
    const { data } = await api.get('/scheduled-messages', {
      params: conversationId ? { conversationId } : undefined,
    });
    return data.data;
  },

  async create(payload: {
    conversationId: string;
    text: string;
    scheduledAt: string;
  }): Promise<ScheduledMessage> {
    const { data } = await api.post('/scheduled-messages', {
      conversationId: payload.conversationId,
      content: { text: payload.text },
      scheduledAt: payload.scheduledAt,
    });
    return data.data;
  },

  async update(
    id: string,
    payload: { text?: string; scheduledAt?: string },
  ): Promise<ScheduledMessage> {
    const body: Record<string, unknown> = {};
    if (payload.text !== undefined) body.content = { text: payload.text };
    if (payload.scheduledAt !== undefined) body.scheduledAt = payload.scheduledAt;
    const { data } = await api.patch(`/scheduled-messages/${id}`, body);
    return data.data;
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/scheduled-messages/${id}`);
  },
};
