import { api } from '@/lib/api';

// Mapeia a "fonte" da agenda (pt) para o entityType do backend (en).
export type ActivitySource = 'tarefa' | 'prazo' | 'evento';
export const ENTITY_TYPE: Record<ActivitySource, string> = {
  tarefa: 'task',
  prazo: 'deadline',
  evento: 'event',
};

export interface ActivityComment {
  id: string;
  entityType: string;
  entityId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface EntityTag {
  id: string;
  entityType: string;
  entityId: string;
  tagId: string;
  tag: { id: string; name: string; color: string };
}

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

export interface TagIndexEntry {
  entityType: string;
  entityId: string;
  tag: { id: string; name: string; color: string };
}

export const activitiesService = {
  async listComments(entityType: string, entityId: string): Promise<ActivityComment[]> {
    const { data } = await api.get(`/activities/${entityType}/${entityId}/comments`);
    return data.data ?? data;
  },
  async addComment(entityType: string, entityId: string, body: string, mentions?: string[]): Promise<ActivityComment> {
    const { data } = await api.post(`/activities/${entityType}/${entityId}/comments`, { body, mentions });
    return data.data ?? data;
  },
  async updateComment(commentId: string, body: string): Promise<ActivityComment> {
    const { data } = await api.put(`/activities/comments/${commentId}`, { body });
    return data.data ?? data;
  },
  async deleteComment(commentId: string): Promise<void> {
    await api.delete(`/activities/comments/${commentId}`);
  },

  async listTags(entityType: string, entityId: string): Promise<EntityTag[]> {
    const { data } = await api.get(`/activities/${entityType}/${entityId}/tags`);
    return data.data ?? data;
  },
  // Índice de todas as etiquetas das atividades da org (1 request p/ a agenda inteira).
  async tagsIndex(): Promise<TagIndexEntry[]> {
    const { data } = await api.get('/activities/tags-index');
    return data.data ?? data;
  },
  async attachTag(entityType: string, entityId: string, tagId: string): Promise<EntityTag> {
    const { data } = await api.post(`/activities/${entityType}/${entityId}/tags`, { tagId });
    return data.data ?? data;
  },
  async detachTag(entityTagId: string): Promise<void> {
    await api.delete(`/activities/tags/${entityTagId}`);
  },
  // Co-responsáveis (extras) — guardados em metadata.coResponsibleIds da atividade.
  async setCoResponsibles(entityType: string, entityId: string, userIds: string[]): Promise<{ coResponsibleIds: string[] }> {
    const { data } = await api.put(`/activities/${entityType}/${entityId}/co-responsibles`, { userIds });
    return data.data ?? data;
  },

  // Etiquetas do jurídico ficam isoladas das tags do atendimento (scope=legal).
  async listAvailableTags(): Promise<TagOption[]> {
    const { data } = await api.get('/tags', { params: { scope: 'legal' } });
    return data.data ?? data;
  },
  async createTag(name: string, color: string): Promise<TagOption> {
    const { data } = await api.post('/tags', { name, color, scope: 'legal' });
    return data.data ?? data;
  },
  // Ajusta a etiqueta jurídica globalmente (cor/nome) — reflete em todas as
  // atividades que a usam. Mesmo endpoint das tags do atendimento (PATCH /tags/:id).
  async updateTag(id: string, payload: { name?: string; color?: string }): Promise<TagOption> {
    const { data } = await api.patch(`/tags/${id}`, payload);
    return data.data ?? data;
  },
};
