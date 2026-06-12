import { api } from '@/lib/api';

export interface QuickReplyAttachment {
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  url: string;
  fileName?: string;
  caption?: string;
}

export interface QuickReply {
  id: string;
  organizationId: string;
  shortcut: string;
  title: string;
  content: string;
  attachments: QuickReplyAttachment[];
}

export interface QuickReplyPayload {
  shortcut: string;
  title: string;
  content: string;
  attachments?: QuickReplyAttachment[];
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: { shortcut: string; error: string }[];
}

export const quickRepliesService = {
  async list(): Promise<QuickReply[]> {
    const { data } = await api.get('/quick-replies');
    return data.data ?? data;
  },
  async create(payload: QuickReplyPayload): Promise<QuickReply> {
    const { data } = await api.post('/quick-replies', payload);
    return data.data ?? data;
  },
  async update(id: string, payload: Partial<QuickReplyPayload>): Promise<QuickReply> {
    const { data } = await api.patch(`/quick-replies/${id}`, payload);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/quick-replies/${id}`);
  },
  /** Importação em massa idempotente (cria novos, atualiza shortcuts existentes). */
  async importMany(items: QuickReplyPayload[]): Promise<ImportResult> {
    const { data } = await api.post('/quick-replies/import', { items });
    return data.data ?? data;
  },
};
