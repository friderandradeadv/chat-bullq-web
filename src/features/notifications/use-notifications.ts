'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/features/inbox/hooks/use-socket';
import {
  notificationsService,
  notificationHref,
  type AppNotification,
} from './notifications.service';

const KEY = (orgId: string | null) => ['notifications', orgId];

/**
 * Central de notificações do app (sino). Lista as notificações do usuário,
 * mantém o contador de não lidas ao vivo por socket (`notification:new`),
 * mostra um toast clicável quando chega uma nova e expõe marcar-lida.
 */
export function useNotifications() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const router = useRouter();
  const { on } = useSocket();

  const query = useQuery({
    queryKey: KEY(activeOrgId),
    queryFn: () => notificationsService.list(1, 20),
    enabled: !!user && !!activeOrgId,
    refetchInterval: 120_000,
    staleTime: 30_000,
  });

  // Chegou notificação em tempo real → injeta no topo da lista, incrementa o
  // contador e mostra um toast clicável que leva ao destino.
  useEffect(() => {
    if (!user || !activeOrgId) return;
    const off = on('notification:new', (n: AppNotification) => {
      qc.setQueryData(KEY(activeOrgId), (prev: any) => {
        if (!prev) return prev;
        const already = prev.notifications?.some((x: AppNotification) => x.id === n.id);
        if (already) return prev;
        return {
          ...prev,
          notifications: [{ ...n, isRead: false }, ...(prev.notifications || [])].slice(0, 20),
          unreadCount: (prev.unreadCount || 0) + 1,
        };
      });
      // Se a lista ainda não foi carregada, garante o refetch.
      qc.invalidateQueries({ queryKey: KEY(activeOrgId) });
      toast(n.title, {
        description: n.body,
        action: {
          label: 'Ver',
          onClick: () => router.push(notificationHref(n)),
        },
      });
    });
    return () => off?.();
  }, [on, qc, user, activeOrgId, router]);

  const markRead = useCallback(
    async (id: string) => {
      // Otimista: zera na hora.
      qc.setQueryData(KEY(activeOrgId), (prev: any) => {
        if (!prev) return prev;
        const wasUnread = prev.notifications?.find(
          (x: AppNotification) => x.id === id && !x.isRead,
        );
        return {
          ...prev,
          notifications: prev.notifications.map((x: AppNotification) =>
            x.id === id ? { ...x, isRead: true } : x,
          ),
          unreadCount: Math.max(0, (prev.unreadCount || 0) - (wasUnread ? 1 : 0)),
        };
      });
      await notificationsService.markRead(id).catch(() => {
        qc.invalidateQueries({ queryKey: KEY(activeOrgId) });
      });
    },
    [qc, activeOrgId],
  );

  const markAllRead = useCallback(async () => {
    qc.setQueryData(KEY(activeOrgId), (prev: any) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((x: AppNotification) => ({
              ...x,
              isRead: true,
            })),
            unreadCount: 0,
          }
        : prev,
    );
    await notificationsService.markAllRead().catch(() => {
      qc.invalidateQueries({ queryKey: KEY(activeOrgId) });
    });
  }, [qc, activeOrgId]);

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
}
