import { api } from '@/lib/api';

export type ScheduledMessageStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'CANCELED'
  | 'FAILED';

export interface ScheduledMessage {
  id: string;
  conversationId: string;
  channelId: string;
  type: string;
  content: { text?: string };
  scheduledAt: string;
  status: ScheduledMessageStatus;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
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
