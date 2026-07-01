'use client';

import { Stethoscope } from 'lucide-react';
import { AdminBoard } from '@/features/legal-cases/components/admin-board';

// Fase administrativa do INSS — processos na etapa "PROCESSO ADMINISTRATIVO - INSS"
// (fase inss_admin), agrupados por produto (BPC/LOAS, aposentadoria, auxílio…).
export default function InssAdministrativoPage() {
  return (
    <AdminBoard
      title="INSS — Administrativo"
      subtitle="Requerimentos e recursos na esfera administrativa do INSS, antes do ajuizamento."
      icon={Stethoscope}
      accent="#7048e8"
      filter={(c) => c.phase === 'inss_admin'}
      emptyHint="Nenhum processo na fase administrativa do INSS. Quando um card entrar na etapa PROCESSO ADMINISTRATIVO - INSS, ele aparece aqui."
    />
  );
}
