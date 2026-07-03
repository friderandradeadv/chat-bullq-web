'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/features/inbox/hooks/use-socket';

async function fetchUnreadConversations(): Promise<number> {
  const { data } = await api.get('/conversations/unread-count');
  return data.data?.count ?? 0;
}

/**
 * Total de CONVERSAS com mensagem não lida do usuário — alimenta o badge de
 * "Conversas" (sidebar + aba mobile) e o badge do ÍCONE do app instalado (PWA).
 *
 * Fica ao vivo por socket (nova mensagem / marcar lida / marcar não lida) com
 * um debounce curto, e tem um refetch de segurança a cada 60s como rede.
 */
export function useUnreadConversations() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { on, onReconnect } = useSocket();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ['conversations', 'unread-count', activeOrgId],
    queryFn: fetchUnreadConversations,
    enabled: !!user && !!activeOrgId,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  // Refetch coalescido: vários eventos em sequência (rajada de mensagens) viram
  // um único refetch ~400ms depois.
  useEffect(() => {
    if (!user || !activeOrgId) return;
    const bump = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['conversations', 'unread-count', activeOrgId] });
      }, 400);
    };
    const offs = [
      on('message:new', bump),
      on('conversation:read', bump),
      on('conversation:unread', bump),
      on('conversation:updated', bump),
      onReconnect(bump),
    ];
    return () => {
      offs.forEach((off) => off?.());
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [on, onReconnect, qc, user, activeOrgId]);

  // Espelha a contagem no ÍCONE do app instalado (Badging API). Só funciona em
  // PWA instalado/navegador compatível — falha silenciosa no resto.
  const count = query.data ?? 0;
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (count > 0) nav.setAppBadge?.(count).catch(() => {});
      else nav.clearAppBadge?.().catch(() => {});
    } catch {
      /* Badging API indisponível — ignora */
    }
  }, [count]);

  return count;
}
