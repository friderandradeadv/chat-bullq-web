'use client';

import { InssBoard } from '@/features/legal-cases/components/inss-board';

// Fase administrativa do INSS — processos na etapa "PROCESSO ADMINISTRATIVO -
// INSS" (fase inss_admin), com abas por resultado do requerimento (em análise /
// deferido / em recurso / indeferido) e, no indeferimento, o atalho para entrar
// com a ação judicial.
export default function InssAdministrativoPage() {
  return <InssBoard />;
}
