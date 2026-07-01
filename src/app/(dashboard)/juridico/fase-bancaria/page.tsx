'use client';

import { Landmark } from 'lucide-react';
import { AdminBoard } from '@/features/legal-cases/components/admin-board';

// Fase Bancária (pré-judicial) — réplica FIEL do pipe "02. PRÉ-JUDICIAL" do Pipefy:
// as 8 fases como colunas, os cards nas fases reais. Investigação RMC/RCC × bancos
// (BACEN/consumidor.gov, coleta de contratos) antes do ajuizamento.
const COLUNAS = [
  { key: 'banco_novo_cliente', label: '01. Novo cliente' },
  { key: 'banco_investigativa', label: '02. Fase bancária investigativa' },
  { key: 'banco_acao_judicial', label: '02.1 Ação judicial' },
  { key: 'banco_conferir_doc', label: '03. Conferir documentação' },
  { key: 'banco_provisionamento', label: 'Em provisionamento' },
  { key: 'banco_analise_final', label: '04. Análise final' },
  { key: 'banco_concluido', label: 'Concluído' },
  { key: 'banco_inviavel', label: 'Inviável' },
];

export default function FaseBancariaPage() {
  return (
    <AdminBoard
      title="Fase Bancária (pré-judicial)"
      subtitle="Réplica do pipe 02. Pré-Judicial do Pipefy — investigação RMC/RCC × bancos antes do protocolo."
      icon={Landmark}
      accent="#228BE6"
      filter={(c) => c.phase.startsWith('banco_')}
      columns={COLUNAS}
    />
  );
}
