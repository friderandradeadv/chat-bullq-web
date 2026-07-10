// Motor de PERDA ESPERADA — PE = PD × LGD × EAD (Res. CMN 4.966/2021, metodologia
// COMPLETA, bancos S1–S3). Complementa a calculadora de Provisionamento (Anexo,
// metodologia SIMPLIFICADA S4/S5): os bancões usam modelos internos de PD/LGD; o
// número aqui é uma ESTIMATIVA para argumentação/negociação, não o valor exato
// que o banco lançou (esse só o banco tem). Inclui o ajuste PROSPECTIVO em 3
// cenários (a norma exige considerar PIB/desemprego/inflação/juros).
//
//  • PD  = probabilidade de default (0..1). Ilustração do ARRASTO: se M de N
//          operações do cliente estão em default, o portfólio inteiro é
//          arrastado ao estágio 3 → PD tende a 100% para a carteira.
//  • LGD = perda dada a inadimplência (0..1) — quanto o banco NÃO recupera.
//  • EAD = exposição no default (R$) — saldo contábil bruto (+ limites não usados).

export interface PEInput {
  ead: number;   // exposição total (R$)
  pd: number;    // 0..1
  lgd: number;   // 0..1
  fatorOtimista?: number;   // multiplicador da PD no cenário bom (default 0.8)
  fatorPessimista?: number; // multiplicador da PD no cenário ruim (default 1.2)
}
export interface PEResultado {
  peModerado: number;
  peOtimista: number;
  pePessimista: number;
  pctModerado: number; // PE / EAD
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clampf = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function calcularPE(i: PEInput): PEResultado {
  const ead = Math.max(0, i.ead || 0);
  const pd = clampf(i.pd || 0, 0, 1);
  const lgd = clampf(i.lgd || 0, 0, 1);
  const fo = i.fatorOtimista ?? 0.8;
  const fp = i.fatorPessimista ?? 1.2;
  const base = pd * lgd * ead;
  return {
    peModerado: r2(base),
    peOtimista: r2(clampf(pd * fo, 0, 1) * lgd * ead),
    pePessimista: r2(clampf(pd * fp, 0, 1) * lgd * ead),
    pctModerado: ead > 0 ? base / ead : 0,
  };
}

/** PD ilustrativa do arrasto: operações em default ÷ total de operações. */
export function pdArrasto(totalOperacoes: number, emDefault: number): number {
  return totalOperacoes > 0 ? clampf(emDefault / totalOperacoes, 0, 1) : 0;
}

// Diagnóstico FRAME (Workshop TABM) — os 5 pilares.
export const FRAME: { letra: string; titulo: string; guia: string }[] = [
  { letra: 'F', titulo: 'Fato Gerador', guia: 'A origem da dívida: qual contrato, legalidade (transparência/boa-fé), porte do banco (S1–S5), tempo de relacionamento.' },
  { letra: 'R', titulo: 'Risco', guia: 'A perda esperada e os gatilhos de provisão de 100% (recuperação judicial, falência, decisão que afeta o pagamento).' },
  { letra: 'A', titulo: 'Análise de capacidade', guia: 'A condição real de pagamento do cliente (PF: renda; PJ: DRE + balanço).' },
  { letra: 'M', titulo: 'Movimento estratégico', guia: 'A ação a tomar: auditoria de relacionamento via BACEN, malote, revisional como pressão.' },
  { letra: 'E', titulo: 'Execução', guia: 'Protocolo e negociação com base nos dados técnicos (o dossiê na mesa).' },
];

// Porte do banco → metodologia aplicável.
export const PORTES: { id: string; label: string; metodologia: 'completa' | 'simplificada' }[] = [
  { id: 'S1', label: 'S1 — grandes bancos (Itaú, Bradesco, Santander, BB, Caixa)', metodologia: 'completa' },
  { id: 'S2', label: 'S2 — bancos grandes', metodologia: 'completa' },
  { id: 'S3', label: 'S3 — bancos médios', metodologia: 'completa' },
  { id: 'S4', label: 'S4 — instituições menores', metodologia: 'simplificada' },
  { id: 'S5', label: 'S5 — cooperativas / financeiras pequenas', metodologia: 'simplificada' },
];
