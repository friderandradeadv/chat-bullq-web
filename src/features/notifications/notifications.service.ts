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

  async unreadCount(kind?: string): Promise<number> {
    const { data } = await api.get('/notifications/unread-count', {
      params: kind ? { kind } : undefined,
    });
    // O endpoint devolve o número puro (envelopado em { data }).
    return typeof data.data === 'number' ? data.data : (data.data?.count ?? 0);
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  /** Marca lidas todas as notificações (ou só as de um `kind`, ex.: 'payslip_updated'). */
  async markAllRead(kind?: string): Promise<void> {
    await api.patch('/notifications/read-all', undefined, {
      params: kind ? { kind } : undefined,
    });
  },
};

/** Remove o papel entre parênteses do nome da parte ("Fulano (Executado)" → "Fulano"). */
function limparParte(parte?: string | null): string {
  return (parte || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Nome da parte a partir do corpo da notificação do sentinela Projudi.
 *  Corpo: "<cnj> (<parte>) — expedida ..." (a captura greedy pega parênteses aninhados
 *  do próprio papel, ex.: "Alceu (Executado)"; limparParte tira o papel depois). */
function parteDoCorpo(body?: string): string {
  const m = (body || '').match(/\((.+)\)\s*—\s*expedida/);
  return limparParte(m?.[1]);
}

/** Destino de navegação de uma notificação, a partir do seu `data`. */
export function notificationHref(n: AppNotification): string {
  const d = n.data || {};
  if (d.url) return d.url as string;
  if (d.conversationId) return `/inbox?conversationId=${d.conversationId}`;
  if (d.caseId) return `/processos/${d.caseId}`;
  // Sentinela Projudi de processo FORA do hub: ainda não existe card (por isso
  // não há caseId). Em vez de cair no início, leva à aba Processos com o cadastro
  // já aberto e o nº CNJ preenchido. A parte (do data ou extraída do corpo) vai
  // junto pra pré-selecionar o processo PRINCIPAL — apensou, herdou tudo.
  if (d.kind === 'projudi_sentinela' && d.cnj) {
    const parte = limparParte(d.parte as string | undefined) || parteDoCorpo(n.body);
    const q = new URLSearchParams({ cadastrarCnj: String(d.cnj) });
    if (parte) q.set('parte', parte);
    return `/processos?${q.toString()}`;
  }
  return '/inicio';
}
