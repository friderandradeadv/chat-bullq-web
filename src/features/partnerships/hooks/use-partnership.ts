'use client';

import { useAuthStore } from '@/stores/auth-store';
import type { PartnershipInfo } from '@/stores/auth-store';

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
  return org?.partnerships?.find((p) => p.locked) ?? null;
}

/** Todas as parcerias do usuário na org ativa (inclusive as sem trava). */
export function useMinhasParcerias(): PartnershipInfo[] {
  const { organizations, activeOrgId } = useAuthStore();
  const org = organizations.find((o) => o.id === activeOrgId);
  return org?.partnerships ?? [];
}
