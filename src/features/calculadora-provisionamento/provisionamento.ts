// Calculadora de PROVISIONAMENTO BANCÁRIO (REPB) — Resolução BCB nº 352/2023.
//
// Estima quanto o banco JÁ provisionou (reservou como perda) sobre a dívida — o
// que dá a margem de acordo. Réplica FIEL dos anexos oficiais da Res. BCB 352
// (metodologia simplificada, S4/S5), agora com a coluna C5 (o `.xls` do escritório
// só tinha C1–C4). Duas tabelas, escolhidas pelo estágio do ativo:
//   • Ativo NÃO problemático (atraso ≤ 90 dias) → ANEXO II (perda esperada), por
//     FAIXA DE DIAS × carteira.
//   • Ativo problemático/inadimplido (atraso > 90 dias) → ANEXO I (perdas
//     incorridas), por MESES a partir do mês do inadimplemento × carteira.
// Quanto mais provisionado, mais o banco aceita descontar (o crédito "já morreu"
// na contabilidade dele). Tetos de acordo: cooperativas ~50%, fundos ~30%.

export type Carteira = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type Instituicao = 'banco' | 'cooperativa' | 'fundo';

// ── ANEXO I — Provisão para perdas incorridas (ativos inadimplidos) ──
// Linha 0 = "menor que um mês" (a partir do inadimplemento) … 21 = "≥ 21 meses".
// Colunas [C1, C2, C3, C4, C5], em %. Res. BCB 352, Anexo I (idêntico ao .xls + C5).
const ANEXO_I: [number, number, number, number, number][] = [
  [5.5, 30.0, 45.0, 35.0, 50.0],
  [10.0, 33.4, 48.7, 39.5, 53.4],
  [14.5, 36.8, 52.4, 44.0, 56.8],
  [19.0, 40.2, 56.1, 48.5, 60.2],
  [23.5, 43.6, 59.8, 53.0, 63.6],
  [28.0, 47.0, 63.5, 57.5, 67.0],
  [32.5, 50.4, 67.2, 62.0, 70.4],
  [37.0, 53.8, 70.9, 66.5, 73.8],
  [41.5, 57.2, 74.6, 71.0, 77.2],
  [46.0, 60.6, 78.3, 75.5, 80.6],
  [50.5, 64.0, 82.0, 80.0, 84.0],
  [55.0, 67.4, 85.7, 84.5, 87.4],
  [59.5, 70.8, 89.4, 89.0, 90.8],
  [64.0, 74.2, 93.1, 93.5, 94.2],
  [68.5, 77.6, 96.8, 98.0, 97.6],
  [73.0, 81.0, 100.0, 100.0, 100.0],
  [77.5, 84.4, 100.0, 100.0, 100.0],
  [82.0, 87.8, 100.0, 100.0, 100.0],
  [86.5, 91.2, 100.0, 100.0, 100.0],
  [91.0, 94.6, 100.0, 100.0, 100.0],
  [95.5, 98.0, 100.0, 100.0, 100.0],
  [100.0, 100.0, 100.0, 100.0, 100.0],
];

// ── ANEXO II — Provisão adicional para perda esperada (0–90 dias) ──
// Faixa de dias de atraso × carteira [C1, C2, C3, C4, C5], em %. Res. BCB 352, Anexo II.
const ANEXO_II: { maxDias: number; label: string; p: [number, number, number, number, number] }[] = [
  { maxDias: 14, label: '0 a 14 dias', p: [1.4, 1.4, 1.9, 1.9, 1.9] },
  { maxDias: 30, label: '15 a 30 dias', p: [3.5, 3.5, 3.5, 3.5, 7.5] },
  { maxDias: 60, label: '31 a 60 dias', p: [4.5, 6.0, 13.0, 13.0, 15.0] },
  { maxDias: 90, label: '61 a 90 dias', p: [5.0, 17.0, 32.0, 32.0, 38.0] },
];

const COL: Record<Carteira, number> = { C1: 0, C2: 1, C3: 2, C4: 3, C5: 4 };

export const CARTEIRAS: { id: Carteira; label: string }[] = [
  { id: 'C1', label: 'C1 — alienação fiduciária de imóvel / garantia da União' },
  { id: 'C2', label: 'C2 — hipoteca 1º grau, penhor, arrendamento mercantil' },
  { id: 'C3', label: 'C3 — garantias reais (não C1/C2), seguro de crédito' },
  { id: 'C4', label: 'C4 — capital de giro, debêntures sem garantia' },
  { id: 'C5', label: 'C5 — crédito pessoal, cheque especial, CDC, cartão (sem garantia)' },
];

// Operação (produto) → carteira sugerida (o usuário pode trocar).
export const OPERACOES: { label: string; carteira: Carteira }[] = [
  { label: 'Cartão de crédito', carteira: 'C5' },
  { label: 'Cheque especial / rotativo', carteira: 'C5' },
  { label: 'Empréstimo pessoal', carteira: 'C5' },
  { label: 'Crédito consignado', carteira: 'C5' },
  { label: 'CDC (crédito direto ao consumidor)', carteira: 'C5' },
  { label: 'Capital de giro', carteira: 'C4' },
  { label: 'CCB (cédula de crédito bancário)', carteira: 'C4' },
  { label: 'Refinanciamento', carteira: 'C5' },
  { label: 'Financiamento de veículo', carteira: 'C2' },
  { label: 'Financiamento imobiliário', carteira: 'C1' },
];

export const INSTITUICOES: { id: Instituicao; label: string; cap: number }[] = [
  { id: 'banco', label: 'Banco (Itaú, Bradesco, Santander…)', cap: 1.0 },
  { id: 'cooperativa', label: 'Cooperativa (Sicoob, Sicredi, Unicred…)', cap: 0.5 },
  { id: 'fundo', label: 'Fundo garantidor', cap: 0.3 },
];

const DIA_MS = 86_400_000;
const MES_DIAS = 30.4375;

/** Dias de atraso a partir da data do último pagamento. */
export function diasDesde(isoDate: string, hoje = new Date()): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + (isoDate.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.floor((hoje.getTime() - d.getTime()) / DIA_MS);
  return dias < 0 ? 0 : dias;
}

export function estagio(dias: number): { n: 1 | 2 | 3; label: string } {
  if (dias > 90) return { n: 3, label: 'Estágio 3 — ativo problemático (inadimplido > 90 dias)' };
  if (dias > 30) return { n: 2, label: 'Estágio 2 — risco aumentado (atraso > 30 dias)' };
  return { n: 1, label: 'Estágio 1 — crédito saudável (atraso ≤ 30 dias)' };
}

export interface ProvisaoResultado {
  dias: number;
  faixaLabel: string;
  anexo: 'I' | 'II';
  estagio: { n: 1 | 2 | 3; label: string };
  provisaoBasePct: number;    // % da tabela (sem cap por instituição)
  provisaoAplicadaPct: number; // % após o teto da instituição
  valorProvisionado: number;   // saldo × % (aos centavos)
  propostaPct: number;
  propostaAcordo: number;
  descontoValor: number;
  descontoPct: number;
}

/** % de provisão oficial (Res. BCB 352) por dias de atraso × carteira. */
export function provisaoOficial(dias: number, carteira: Carteira): { pct: number; anexo: 'I' | 'II'; faixa: string } {
  const col = COL[carteira];
  if (dias <= 90) {
    const faixa = ANEXO_II.find((f) => dias <= f.maxDias) ?? ANEXO_II[ANEXO_II.length - 1];
    return { pct: faixa.p[col] / 100, anexo: 'II', faixa: `Anexo II · ${faixa.label}` };
  }
  // Ativo problemático: meses contados A PARTIR do inadimplemento (dia 91 = mês 0).
  const meses = Math.floor((dias - 90) / MES_DIAS);
  const bucket = Math.max(0, Math.min(21, meses));
  const label = bucket === 0 ? 'menor que 1 mês' : bucket >= 21 ? '≥ 21 meses' : `${bucket}–${bucket + 1} meses`;
  return { pct: ANEXO_I[bucket][col] / 100, anexo: 'I', faixa: `Anexo I · ${label} do inadimplemento` };
}

export function calcularProvisao(input: {
  saldoDevedor: number;
  carteira: Carteira;
  dias: number;
  instituicao: Instituicao;
}): ProvisaoResultado {
  const saldo = Math.max(0, input.saldoDevedor || 0);
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const { pct, anexo, faixa } = provisaoOficial(input.dias, input.carteira);
  const cap = INSTITUICOES.find((x) => x.id === input.instituicao)?.cap ?? 1.0;
  const provisaoAplicadaPct = Math.min(pct, cap);
  const valorProvisionado = r2(saldo * provisaoAplicadaPct);
  // O banco "já perdeu" a parte provisionada → aceita acordo perto do residual.
  // Piso de 10% para banco (não zera); cooperativa/fundo já ficam altos pelo teto.
  const pisoBanco = input.instituicao === 'banco' ? 0.1 : 0;
  const propostaPct = Math.max(1 - provisaoAplicadaPct, pisoBanco);
  const propostaAcordo = r2(saldo * propostaPct);
  const descontoValor = r2(saldo - propostaAcordo);
  return {
    dias: input.dias,
    faixaLabel: faixa,
    anexo,
    estagio: estagio(input.dias),
    provisaoBasePct: pct,
    provisaoAplicadaPct,
    valorProvisionado,
    propostaPct,
    propostaAcordo,
    descontoValor,
    descontoPct: saldo > 0 ? descontoValor / saldo : 0,
  };
}
