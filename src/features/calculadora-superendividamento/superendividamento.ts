// Calculadora de SUPERENDIVIDAMENTO / mínimo existencial (Lei 14.181/2021, CDC
// art. 54-A). Réplica da "Análise Segmentada" do curso TABM (Módulo G).
//
// ⚠️ O percentual de comprometimento (35%) é a POSIÇÃO ADOTADA no método, NÃO um
// número pacificado em lei — vem da safezone (status 'pendente'), é editável e
// deve ser conferido. A lei fala em "mínimo existencial" (Decreto 11.150/22 é
// controverso). Use como triagem/estimativa, não como decisão jurídica fechada.

import { MINIMO_EXISTENCIAL } from '../calculadora-provisionamento/normas-repb';

export interface SuperendivInput {
  rendaBruta: number;
  descontos: number;      // descontos obrigatórios (INSS/IR)
  consignado: number;     // parcelas mensais consignadas
  naoConsignado: number;  // mensais: cartão, empréstimo pessoal, cheque especial
  outras: number;         // fora do plano, mas contam no cálculo: financ. imob/veicular, pensão, tributos
  comprometimentoPct?: number; // teto (default da safezone)
}

export interface SuperendivResultado {
  rendaLiquida: number;
  totalComprometido: number;
  pctComprometido: number;
  rendaLivre: number;           // pode ser negativa → reforça o pedido
  caracterizado: boolean;       // comprometimento acima do teto
  dividasNoPlano: number;       // dívidas de consumo (entram no plano)
  minimoExistencial: number;    // renda que a lei protege
  capacidadePlano: number;      // máximo que pode ir para o plano por mês
  thr: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularSuperendiv(i: SuperendivInput): SuperendivResultado {
  const thr = i.comprometimentoPct ?? MINIMO_EXISTENCIAL.valores.comprometimentoPct;
  const rendaLiquida = Math.max(0, r2((i.rendaBruta || 0) - (i.descontos || 0)));
  const totalComprometido = r2((i.consignado || 0) + (i.naoConsignado || 0) + (i.outras || 0));
  const pct = rendaLiquida > 0 ? totalComprometido / rendaLiquida : 0;
  return {
    rendaLiquida,
    totalComprometido,
    pctComprometido: pct,
    rendaLivre: r2(rendaLiquida - totalComprometido),
    caracterizado: pct > thr,
    dividasNoPlano: r2((i.consignado || 0) + (i.naoConsignado || 0)),
    minimoExistencial: r2(rendaLiquida * (1 - thr)),
    capacidadePlano: r2(rendaLiquida * thr),
    thr,
  };
}
