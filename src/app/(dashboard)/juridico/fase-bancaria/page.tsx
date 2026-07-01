'use client';

import { Landmark } from 'lucide-react';
import { AdminBoard } from '@/features/legal-cases/components/admin-board';

// Fase Bancária Investigativa — etapa pré-judicial dos casos bancários (RMC/RCC ×
// bancos): descobrir quais ações cabem e contra quais bancos, antes de protocolar.
// Mostra os cases de área Bancário que ainda estão na lane pré-processual,
// agrupados por produto (RMC, RCC, revisional, portabilidade…).
export default function FaseBancariaPage() {
  return (
    <AdminBoard
      title="Fase Bancária Investigativa"
      subtitle="Investigação pré-judicial: descobrir quais ações (RMC/RCC) cabem e contra quais bancos."
      icon={Landmark}
      accent="#228BE6"
      filter={(c, preKeys) => c.areaJuridica === 'Bancário' && preKeys.has(c.phase)}
      emptyHint="Nenhum caso bancário na fase pré-judicial no momento. Cards de RMC/RCC criados no intake (contrato → card) aparecem aqui enquanto estiverem na investigação, antes do protocolo."
    />
  );
}
