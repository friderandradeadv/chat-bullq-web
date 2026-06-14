import { api } from '@/lib/api';

export interface AgentFolder {
  id: string;
  organizationId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderInput {
  name: string;
  color?: string | null;
  sortOrder?: number;
}

export const agentFoldersService = {
  async list(): Promise<AgentFolder[]> {
    const { data } = await api.get('/agent-folders');
    return data.data ?? data;
  },

  async create(input: CreateFolderInput): Promise<AgentFolder> {
    const { data } = await api.post('/agent-folders', input);
    return data.data ?? data;
  },

  async update(
    id: string,
    input: Partial<CreateFolderInput>,
  ): Promise<AgentFolder> {
    const { data } = await api.patch(`/agent-folders/${id}`, input);
    return data.data ?? data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/agent-folders/${id}`);
  },

  /** Clona a pasta como modelo (nova pasta + cópias dos agentes, inativos). */
  async clone(id: string, name?: string): Promise<{ folder: AgentFolder; agents: number }> {
    const { data } = await api.post(`/agent-folders/${id}/clone`, name ? { name } : {});
    return data.data ?? data;
  },
};
