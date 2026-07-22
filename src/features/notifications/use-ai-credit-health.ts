'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import {
  aiUsageService,
  type AiCreditHealth,
} from '@/features/settings/services/ai-usage.service';

/**
 * Saúde do saldo da IA (Anthropic + quota do Gemini). Alimenta a bolinha da
 * aba "Uso da IA" e o badge da Config — MESMA lógica do alerta de conexão
 * caída. Poll de 60s.
 *
 * - `alert` = true quando o Anthropic está AMARELO (perto do fim, <20%) ou
 *   VERMELHO (zerou/erro real da API), OU quando o Gemini bateu em quota
 *   (`geminiExhausted`). É o que acende a bolinha.
 * - `status='unset'` (nenhuma recarga registrada) NÃO alerta sozinho — só
 *   depois que o usuário registra o saldo é que o amarelo passa a valer; o
 *   vermelho por erro real ('empty') acende mesmo sem recarga registrada.
 * - Gemini não tem "saldo declarado" (Google não vende crédito pré-pago do
 *   mesmo jeito) — só o erro real de quota, que já acende sozinho.
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
  const alert = status === 'low' || status === 'empty' || !!health?.geminiExhausted;

  return { health, status, alert, isLoading: query.isLoading };
}
