import { api } from '@/lib/api';

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  channels: { id: string; channelId: string; externalId: string; channel: { id: string; type: string; name: string } }[];
  tags: { tag: { id: string; name: string; color: string } }[];
  status?: { id: string; name: string; color: string } | null;
  /** Responsável humano (atendente) pelo contato. */
  assignedTo?: { id: string; name: string; avatarUrl: string | null } | null;
  /** Responsável ROBÔ (agente de IA) pelo contato — alternativa ao humano. */
  assignedAgent?: { id: string; name: string; avatarUrl: string | null } | null;
  conversations?: any[];
  _count?: { conversations: number };
  createdAt: string;
  updatedAt?: string;
}

export interface FunnelCard {
  id: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  statusId: string;
  updatedAt: string;
  tags: { id: string; name: string; color: string }[];
  conversationId: string | null;
}
export interface FunnelColumn {
  id: string;
  name: string;
  color: string;
  count: number;
}
export interface FunnelBoard {
  columns: FunnelColumn[];
  cards: Record<string, FunnelCard[]>;
}

export const contactsService = {
  async funnelBoard(departmentId?: string): Promise<FunnelBoard> {
    const { data } = await api.get('/contacts/funnel-board', {
      params: departmentId ? { departmentId } : {},
    });
    return data.data;
  },

  async list(params?: Record<string, string>): Promise<{
    contacts: Contact[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { data } = await api.get('/contacts', { params });
    return data.data;
  },

  async getById(id: string): Promise<Contact> {
    const { data } = await api.get(`/contacts/${id}`);
    return data.data;
  },

  async update(id: string, payload: Partial<Contact>): Promise<Contact> {
    const { data } = await api.patch(`/contacts/${id}`, payload);
    return data.data;
  },

  /** Define/troca o responsável HUMANO. Setar um humano limpa o robô (backend). */
  async assignResponsible(id: string, assignedToId: string | null): Promise<Contact> {
    const { data } = await api.patch(`/contacts/${id}`, { assignedToId });
    return data.data;
  },

  /** Define/troca o responsável ROBÔ (agente de IA). Setar um robô limpa o humano (backend). */
  async assignAgent(id: string, assignedAgentId: string | null): Promise<Contact> {
    const { data } = await api.patch(`/contacts/${id}`, { assignedAgentId });
    return data.data;
  },

  /** Remove o responsável — limpa humano E robô. */
  async clearResponsible(id: string): Promise<Contact> {
    const { data } = await api.patch(`/contacts/${id}`, { assignedToId: null, assignedAgentId: null });
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
  },
};
