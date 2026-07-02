import { api } from '@/lib/api';

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  description?: string | null;
  _count?: { contacts: number; conversations: number };
}

export const tagsService = {
  // scope: 'inbox' (atendimento, padrão) | 'legal' (etiquetas do jurídico).
  async list(scope?: 'inbox' | 'legal'): Promise<Tag[]> {
    const { data } = await api.get(`/tags${scope ? `?scope=${scope}` : ''}`);
    return data.data;
  },
  async create(payload: { name: string; color?: string; description?: string; scope?: 'inbox' | 'legal' }): Promise<Tag> {
    const { data } = await api.post('/tags', payload);
    return data.data;
  },
  async update(id: string, payload: { name?: string; color?: string; description?: string }): Promise<Tag> {
    const { data } = await api.patch(`/tags/${id}`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/tags/${id}`);
  },
  async addToConversation(conversationId: string, tagId: string): Promise<void> {
    await api.post(`/tags/conversation/${conversationId}/tag/${tagId}`);
  },
  async removeFromConversation(conversationId: string, tagId: string): Promise<void> {
    await api.delete(`/tags/conversation/${conversationId}/tag/${tagId}`);
  },
  async addToContact(contactId: string, tagId: string): Promise<void> {
    await api.post(`/tags/contact/${contactId}/tag/${tagId}`);
  },
  async removeFromContact(contactId: string, tagId: string): Promise<void> {
    await api.delete(`/tags/contact/${contactId}/tag/${tagId}`);
  },
  // Processos (jurídico): anexar/remover etiqueta num card.
  async addToCase(caseId: string, tagId: string): Promise<void> {
    await api.post(`/tags/case/${caseId}/tag/${tagId}`);
  },
  async removeFromCase(caseId: string, tagId: string): Promise<void> {
    await api.delete(`/tags/case/${caseId}/tag/${tagId}`);
  },
};
