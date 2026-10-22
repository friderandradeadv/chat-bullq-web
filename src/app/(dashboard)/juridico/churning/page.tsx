'use client';

import { ChurningBoard } from '@/features/legal-cases/components/churning-board';

// Quadro das ofertas de reciclagem de contratos (churning): o que o hub mediu
// no HISCON de cada cliente e ainda não virou ação, com colunas pelo estado da
// oferta. A mensagem ao cliente continua saindo de dentro do card.
export default function ChurningPage() {
  return <ChurningBoard />;
}
