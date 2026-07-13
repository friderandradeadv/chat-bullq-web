'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import {
  aiUsageService,
  type AiCreditHealth,
} from '@/features/settings/services/ai-usage.service';

/**
 * Saúde do saldo da IA (Anthropic). Alimenta a bolinha da aba "Uso da IA" e o
 * badge da Config — MESMA lógica do alerta de conexão caída. Poll de 60s.
 *
 * - `alert` = true quando está AMARELO (perto do fim, <20%) ou VERMELHO (zerou/
 *   erro real da API). É o que acende a bolinha.
 * - `status='unset'` (nenhuma recarga registrada) NÃO alerta — só depois que o
 *   usuário registra o saldo é que o amarelo passa a valer; o vermelho por erro
 *   real ('empty') acende mesmo sem recarga registrada.
 */
export function useAiCreditHealth() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['ai-usage', 'credit-health', activeOrgId],
    queryFn: () => aiUsageService.creditHealth(),
    enabled: !!user && !!activeOrgId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const health: AiCreditHealth | undefined = query.data;
  const status = health?.status ?? 'ok';
  const alert = status === 'low' || status === 'empty';

  return { health, status, alert, isLoading: query.isLoading };
}
