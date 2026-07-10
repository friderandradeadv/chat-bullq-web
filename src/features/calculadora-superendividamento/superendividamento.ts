// Calculadora de SUPERENDIVIDAMENTO / mínimo existencial (Lei 14.181/2021, CDC
// art. 54-A). Réplica da "Análise Segmentada" do curso TABM (Módulo G).
//
// ⚠️ Dois conceitos DISTINTOS (não confundir):
//  • Comprometimento da renda (heurística de TRIAGEM — o método TABM usa ~35%):
//    dívidas ÷ renda líquida. Só SINALIZA superendividamento; não é o mínimo legal.
//  • Mínimo existencial (VALOR FIXO da lei): R$ 600 pelo Decreto 11.567/2023 (que
//    alterou o 11.150/22, antes 25% do mínimo = R$ 303). ⚠️ contestado no STF
//    (ADPF 1006). É o piso que o plano de pagamento deve preservar.
// Ambos vêm da safezone e são editáveis. Triagem/estimativa, não decisão fechada.

import { MINIMO_EXISTENCIAL } from '../calculadora-provisionamento/normas-repb';

export interface SuperendivInput {
  rendaBruta: number;
  descontos: number;      // descontos obrigatórios (INSS/IR)
  consignado: number;     // parcelas mensais consignadas
  naoConsignado: number;  // mensais: cartão, empréstimo pessoal, cheque especial
  outras: number;         // fora do plano, mas contam no cálculo: financ. imob/veicular, pensão, tributos
  comprometimentoTriagem?: number; // % de triagem (default da safezone)
  minimoExistencialValor?: number; // R$ fixo (default da safezone)
}

export interface SuperendivResultado {
  rendaLiquida: number;
  totalComprometido: number;
  pctComprometido: number;
  rendaLivre: number;             // renda líquida − dívidas (pode ser negativa)
  caracterizado: boolean;         // comprometimento acima do limiar de triagem
  dividasNoPlano: number;         // dívidas de consumo (entram no plano)
  minimoExistencial: number;      // VALOR fixo protegido por lei (R$)
  disponivelAcimaMinimo: number;  // renda líquida − mínimo existencial (teto do plano)
  thr: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularSuperendiv(i: SuperendivInput): SuperendivResultado {
  const thr = i.comprometimentoTriagem ?? MINIMO_EXISTENCIAL.valores.comprometimentoTriagem;
  const minEx = i.minimoExistencialValor ?? MINIMO_EXISTENCIAL.valores.valorFixo;
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
    minimoExistencial: r2(minEx),
    disponivelAcimaMinimo: Math.max(0, r2(rendaLiquida - minEx)),
    thr,
  };
}
