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

export const activitiesService = {
  async listComments(entityType: string, entityId: string): Promise<ActivityComment[]> {
    const { data } = await api.get(`/activities/${entityType}/${entityId}/comments`);
    return data.data ?? data;
  },
  async addComment(entityType: string, entityId: string, body: string): Promise<ActivityComment> {
    const { data } = await api.post(`/activities/${entityType}/${entityId}/comments`, { body });
    return data.data ?? data;
  },
  async deleteComment(commentId: string): Promise<void> {
    await api.delete(`/activities/comments/${commentId}`);
  },

  async listTags(entityType: string, entityId: string): Promise<EntityTag[]> {
    const { data } = await api.get(`/activities/${entityType}/${entityId}/tags`);
    return data.data ?? data;
  },
  async attachTag(entityType: string, entityId: string, tagId: string): Promise<EntityTag> {
    const { data } = await api.post(`/activities/${entityType}/${entityId}/tags`, { tagId });
    return data.data ?? data;
  },
  async detachTag(entityTagId: string): Promise<void> {
    await api.delete(`/activities/tags/${entityTagId}`);
  },

  async listAvailableTags(): Promise<TagOption[]> {
    const { data } = await api.get('/tags');
    return data.data ?? data;
  },
};
