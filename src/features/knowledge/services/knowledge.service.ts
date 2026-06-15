import { api } from '@/lib/api';

export type DocStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface KnowledgeDocSummary {
  id: string;
  title: string;
  sourceType: string; // 'text' | 'file'
  fileName?: string | null;
  status: DocStatus;
  chunkCount: number;
  error?: string | null;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocDetail extends KnowledgeDocSummary {
  mimeType?: string | null;
  content: string;
}

function unwrap<T>(data: any): T {
  return (data?.data ?? data) as T;
}

export interface CreateDocInput {
  title: string;
  content: string;
  sourceType?: 'text' | 'file';
  fileName?: string;
  mimeType?: string;
  agentIds?: string[];
}

export const knowledgeService = {
  async list(): Promise<KnowledgeDocSummary[]> {
    const { data } = await api.get('/knowledge-documents');
    return unwrap<KnowledgeDocSummary[]>(data);
  },

  async get(id: string): Promise<KnowledgeDocDetail> {
    const { data } = await api.get(`/knowledge-documents/${id}`);
    return unwrap<KnowledgeDocDetail>(data);
  },

  async create(input: CreateDocInput): Promise<KnowledgeDocDetail> {
    const { data } = await api.post('/knowledge-documents', input);
    return unwrap<KnowledgeDocDetail>(data);
  },

  async update(id: string, input: { title?: string; content?: string }): Promise<void> {
    await api.patch(`/knowledge-documents/${id}`, input);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/knowledge-documents/${id}`);
  },

  async reindex(id: string): Promise<void> {
    await api.post(`/knowledge-documents/${id}/reindex`);
  },

  async setAgents(id: string, agentIds: string[]): Promise<void> {
    await api.post(`/knowledge-documents/${id}/agents`, { agentIds });
  },
};
