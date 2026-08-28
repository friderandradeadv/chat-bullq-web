'use client';

import { useAuthStore } from '@/stores/auth-store';
import type { PartnershipInfo } from '@/stores/auth-store';
import { lerPreview } from './use-partner-preview';

/**
 * A parceria (subhub) que TRAVA o usuário na organização ativa, ou `null`.
 *
 * Quem não é parceiro externo recebe `null` e o app se comporta como sempre —
 * é o caminho de quase todo mundo. Sócio que participa de uma parceria tem
 * `locked: false` e também cai aqui como `null`: ele vê o hub inteiro.
 *
 * Isto é APARÊNCIA. A trava de verdade é do servidor (OrgGuard + o recorte em
 * cada listagem); esconder um item de menu nunca protegeu nada sozinho.
 */
export function usePartnerLock(): PartnershipInfo | null {
  const { organizations, activeOrgId } = useAuthStore();
  const org = organizations.find((o) => o.id === activeOrgId);
  const real = org?.partnerships?.find((p) => p.locked) ?? null;
  if (real) return real;

  // Sócio pré-visualizando ("ver como parceiro"). A casca vem daqui; o corte
  // dos DADOS é do servidor, pelo cabeçalho `x-preview-partnership`.
  const prev = lerPreview();
  if (!prev) return null;
  return { ...prev, role: 'PARTNER', locked: true, preview: true };
}

/** Todas as parcerias do usuário na org ativa (inclusive as sem trava). */
export function useMinhasParcerias(): PartnershipInfo[] {
  const { organizations, activeOrgId } = useAuthStore();
  const org = organizations.find((o) => o.id === activeOrgId);
  return org?.partnerships ?? [];
}
