'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/features/inbox/hooks/use-socket';
import { notificationsService } from './notifications.service';

const KIND = 'payslip_updated';
const KEY = (orgId: string | null) => ['notifications', 'unread-count', KIND, orgId];

/**
 * Contador de movimentações do HOLERITE ainda não vistas pelo usuário — conta as
 * notificações não lidas do tipo `payslip_updated`. Alimenta a bolinha vermelha
 * em "Você" (Meu Espaço) e "Financeiro" (sidebar + barra inferior).
 *
 * A bolinha some quando a pessoa ABRE a aba Holerite (Meu Espaço → Financeiro),
 * que chama `markPayslipSeen()` para marcar essas notificações como lidas.
 * Fica vivo por socket (`notification:new`) com refetch de rede a cada 60s.
 */
export function usePayslipUnreadCount() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { on, onReconnect } = useSocket();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: KEY(activeOrgId),
    queryFn: () => notificationsService.unreadCount(KIND),
    enabled: !!user && !!activeOrgId,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user || !activeOrgId) return;
    const bump = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: KEY(activeOrgId) });
      }, 400);
    };
    const offs = [on('notification:new', bump), onReconnect(bump)];
    return () => {
      offs.forEach((off) => off?.());
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [on, onReconnect, qc, user, activeOrgId]);

  return query.data ?? 0;
}

/**
 * Marca como vistas todas as movimentações de holerite (zera a bolinha). Chamada
 * quando o usuário abre a aba Holerite. Otimista: zera o contador na hora.
 */
export function useMarkPayslipSeen() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const qc = useQueryClient();

  return async () => {
    qc.setQueryData(KEY(activeOrgId), 0);
    await notificationsService.markAllRead(KIND).catch(() => {
      qc.invalidateQueries({ queryKey: KEY(activeOrgId) });
    });
    // Reflete também na central de notificações (sino) e no seu contador geral.
    qc.invalidateQueries({ queryKey: ['notifications', activeOrgId] });
  };
}
