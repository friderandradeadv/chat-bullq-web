'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { usePreSeenStore } from '@/stores/pre-seen-store';

async function fetchPreUnseen(since: string | null): Promise<number> {
  const { data } = await api.get('/legal-cases/pre-unseen-count', {
    params: since ? { since } : undefined,
  });
  return data.data?.count ?? 0;
}

/**
 * Nº de clientes NOVOS no board Pré-Processual que o usuário ainda não viu (entraram
 * na fase depois da última vez que ele abriu o quadro). Alimenta o badge da barra
 * inferior ("Jurídico") e do item "Pré-Processual" na sidebar. Some ao abrir o board.
 *
 * A queryKey inclui o marcador `lastSeenAt`: quando o board chama `markSeen()`, o
 * marcador avança para agora, a chave muda e o contador cai para 0 automaticamente.
 */
export function usePreUnseenCount() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const { lastSeenAt, hydrated, hydrate } = usePreSeenStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const query = useQuery({
    queryKey: ['legal-cases', 'pre-unseen-count', activeOrgId, lastSeenAt],
    queryFn: () => fetchPreUnseen(lastSeenAt),
    enabled: !!user && !!activeOrgId && hydrated,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  return query.data ?? 0;
}
