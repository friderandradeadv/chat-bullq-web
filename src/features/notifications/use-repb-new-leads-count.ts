'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useRepbSeenStore } from '@/stores/repb-seen-store';

async function fetchRepbNewLeads(since: string | null): Promise<number> {
  const { data } = await api.get('/legal-cases/repb-new-leads-count', {
    params: since ? { since } : undefined,
  });
  return data.data?.count ?? 0;
}

/**
 * Nº de NOVOS LEADS no funil REPB (coluna repbc_novos_leads) atribuídos ao usuário
 * responsável (ex.: a Kauani) que entraram na fase depois da última vez que ele abriu
 * o funil. Alimenta o badge (bolinha vermelha) do item "REPB" na barra inferior.
 * Some ao abrir o funil.
 *
 * A queryKey inclui o marcador `lastSeenAt`: quando o board chama `markSeen()`, o
 * marcador avança para agora, a chave muda e o contador cai para 0 automaticamente.
 * Espelha usePreUnseenCount.
 */
export function useRepbNewLeadsCount() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const { lastSeenAt, hydrated, hydrate } = useRepbSeenStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const query = useQuery({
    queryKey: ['legal-cases', 'repb-new-leads-count', activeOrgId, lastSeenAt],
    queryFn: () => fetchRepbNewLeads(lastSeenAt),
    enabled: !!user && !!activeOrgId && hydrated,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  return query.data ?? 0;
}
