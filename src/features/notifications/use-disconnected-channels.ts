'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

async function fetchDisconnectedCount(): Promise<number> {
  const { data } = await api.get('/channels/connection-health');
  return data.data?.disconnected ?? 0;
}

/**
 * Quantas conexões WhatsApp da org estão CAÍDAS agora. Alimenta a bolinha
 * vermelha da aba "Configurações" (barra de atalhos) — a pessoa clica e vai
 * religar o QR. Poll de 60s; zera sozinho quando o watchdog vê a reconexão.
 */
export function useDisconnectedChannels() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['channels', 'connection-health', activeOrgId],
    queryFn: fetchDisconnectedCount,
    enabled: !!user && !!activeOrgId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return query.data ?? 0;
}
