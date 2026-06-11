import { api } from '@/lib/api';

export interface ZapSignStatus {
  connected: boolean;
  updatedAt: string | null;
}

export interface ZapSignInput {
  variable: string;
  label?: string;
  input_type?: string;
  help_text?: string;
  required?: boolean;
  order?: number;
}

export interface ZapSignTemplate {
  id: string;
  token: string;
  name: string;
  templateType: string;
  inputs: ZapSignInput[];
  signers: Array<{ name?: string }>;
}

export interface ZapSignDocument {
  id: string;
  name: string;
  status: 'pending' | 'signed' | 'refused' | 'expired';
  signingUrl: string | null;
  zapSignToken: string;
  createdAt: string;
  /** Só no retorno de createDocument: indica se o link foi enviado ao cliente. */
  sentToClient?: boolean;
}

export const zapSignService = {
  async getStatus(): Promise<ZapSignStatus> {
    const { data } = await api.get('/zapsign/status');
    return data.data;
  },

  async connect(apiToken: string): Promise<{ id: string; isActive: boolean }> {
    const { data } = await api.post('/zapsign/connect', { apiToken });
    return data.data;
  },

  async disconnect(): Promise<void> {
    await api.delete('/zapsign/disconnect');
  },

  async getTemplates(): Promise<ZapSignTemplate[]> {
    const { data } = await api.get('/zapsign/templates');
    return data.data;
  },

  async syncTemplates(): Promise<{ synced: number }> {
    const { data } = await api.post('/zapsign/sync');
    return data.data;
  },

  async createDocument(
    conversationId: string,
    payload: {
      templateToken: string;
      variables: Record<string, string>;
      signerName?: string;
      signerPhone?: string;
      signerEmail?: string;
    },
  ): Promise<ZapSignDocument> {
    const { data } = await api.post(
      `/zapsign/conversations/${conversationId}/documents`,
      payload,
    );
    return data.data;
  },

  async getConversationDocuments(conversationId: string): Promise<ZapSignDocument[]> {
    const { data } = await api.get(`/zapsign/conversations/${conversationId}/documents`);
    return data.data;
  },

  /** Extrai com IA os valores dos campos do template a partir da conversa. */
  async extractWithAI(
    conversationId: string,
    templateToken: string,
  ): Promise<{ variables: Record<string, string>; signerName: string }> {
    const { data } = await api.post(
      `/zapsign/conversations/${conversationId}/extract`,
      { templateToken },
    );
    return data.data ?? data;
  },
};
