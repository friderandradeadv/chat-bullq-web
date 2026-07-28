'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import {
  aiUsageService,
  type AiCreditHealth,
} from '@/features/settings/services/ai-usage.service';

/**
 * Saúde da IA — hoje os agentes rodam no Google (Gemini), que não tem crédito
 * pré-pago: o único sinal de saúde é a quota (erro 429 RESOURCE_EXHAUSTED).
 * Alimenta a bolinha da aba "Uso da IA" e o badge da Config — MESMA lógica do
 * alerta de conexão caída. Poll de 60s.
 *
 * - `alert` = true quando o Gemini bateu em quota (`geminiExhausted`). É o que
 *   acende a bolinha (vermelha).
 * - `status` fica só como compat com o tipo antigo — não dirige mais o alerta.
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
  const alert = !!health?.geminiExhausted;

  return { health, status, alert, isLoading: query.isLoading };
}
