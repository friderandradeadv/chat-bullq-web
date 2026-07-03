import { api } from '@/lib/api';

// Tipos de notificação do backend (enum NotificationType).
export type NotificationType =
  | 'NEW_MESSAGE'
  | 'CONVERSATION_ASSIGNED'
  | 'CONVERSATION_TRANSFERRED'
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'MENTION'
  | 'SYSTEM'
  | 'AI_TOOL_FAILURE';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationsPage {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const notificationsService = {
  async list(page = 1, limit = 20): Promise<NotificationsPage> {
    const { data } = await api.get('/notifications', { params: { page, limit } });
    return data.data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get('/notifications/unread-count');
    // O endpoint devolve o número puro (envelopado em { data }).
    return typeof data.data === 'number' ? data.data : (data.data?.count ?? 0);
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};

/** Destino de navegação de uma notificação, a partir do seu `data`. */
export function notificationHref(n: AppNotification): string {
  const d = n.data || {};
  if (d.url) return d.url as string;
  if (d.conversationId) return `/inbox?conversationId=${d.conversationId}`;
  if (d.caseId) return `/processos/${d.caseId}`;
  return '/inicio';
}
