'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

async function fetchRepassesCount(): Promise<number> {
  const { data } = await api.get('/financeiro/repasses-pendentes');
  const d = data.data ?? data;
  return d?.count ?? 0;
}

/**
 * Nº de repasses de honorários PENDENTES (rateio definido no lançamento, ainda não
 * pago ao advogado). Alimenta a bolinha vermelha do item "Financeiro" para que o
 * OWNER/ADMIN saiba que há valores a repassar sem precisar abrir a tela.
 * Só consulta para admin/sócio (o endpoint é OWNER/ADMIN). Cai na hora após um
 * repasse porque a tela invalida a queryKey ['financeiro', ...].
 */
export function useRepassesPendentesCount() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const query = useQuery({
    queryKey: ['financeiro', 'repasses-pendentes', activeOrgId],
    queryFn: fetchRepassesCount,
    enabled: !!user && !!activeOrgId && isAdmin,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  return query.data ?? 0;
}
