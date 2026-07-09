'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

async function fetchPendingTasksCount(): Promise<number> {
  const { data } = await api.get('/tasks/pending-count');
  return data.data?.count ?? 0;
}

/**
 * Total de compromissos de HOJE do usuário (prazos+tarefas+eventos em aberto com
 * vencimento HOJE — SEM atrasados). Alimenta o badge vermelho do item "Agenda".
 * Some quando não sobra nada pendente hoje.
 *
 * Fica vivo por dois caminhos: (1) refetch de rede a cada 60s; (2) a Agenda
 * invalida a queryKey ['tasks','pending-count'] no seu refetchAll sempre que uma
 * tarefa é concluída/criada/reaberta — então a bolinha cai na hora.
 */
export function usePendingTasksCount() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['tasks', 'pending-count', activeOrgId],
    queryFn: fetchPendingTasksCount,
    enabled: !!user && !!activeOrgId,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  return query.data ?? 0;
}
