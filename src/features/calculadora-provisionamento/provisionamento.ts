// Calculadora de PROVISIONAMENTO BANCÁRIO (REPB).
//
// Estima quanto o banco já provisionou (reservou como perda) sobre a dívida — o
// que dá a margem de acordo. Fonte: matriz do escritório ("Monitoramento de
// Provisionamento…​.xls", aba Listas / Anexo) = % de provisão por FAIXA DE ATRASO
// (em meses) × CARTEIRA (C1–C4, por tipo de garantia — Res. CMN 4.966/21). Quanto
// mais provisionado, mais o banco aceita descontar: dívida provisionada 70% →
// proposta ~30%; 100% → ~10% (platô), exceto cooperativas (máx 50%) e fundos
// garantidores (máx 30%), que negociam menos.

export type Carteira = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type Instituicao = 'banco' | 'cooperativa' | 'fundo';

// % de provisão por bucket de meses de atraso (índice 0 = "< 1 mês" … 21 = "≥ 21
// meses") × carteira [C1, C2, C3, C4]. Réplica exata da planilha do escritório.
const MATRIZ: [number, number, number, number][] = [
  [0.055, 0.300, 0.450, 0.350], // < 1 mês
  [0.100, 0.334, 0.487, 0.395], // 1
  [0.145, 0.368, 0.524, 0.440], // 2
  [0.190, 0.402, 0.561, 0.485], // 3
  [0.235, 0.436, 0.598, 0.530], // 4
  [0.280, 0.470, 0.635, 0.575], // 5
  [0.325, 0.504, 0.672, 0.620], // 6
  [0.370, 0.538, 0.709, 0.665], // 7
  [0.415, 0.572, 0.746, 0.710], // 8
  [0.460, 0.606, 0.783, 0.755], // 9
  [0.505, 0.640, 0.820, 0.800], // 10
  [0.550, 0.674, 0.857, 0.845], // 11
  [0.595, 0.708, 0.894, 0.890], // 12
  [0.640, 0.742, 0.931, 0.935], // 13
  [0.685, 0.776, 0.968, 0.980], // 14
  [0.730, 0.810, 1.000, 1.000], // 15
  [0.775, 0.844, 1.000, 1.000], // 16
  [0.820, 0.878, 1.000, 1.000], // 17
  [0.865, 0.912, 1.000, 1.000], // 18
  [0.910, 0.946, 1.000, 1.000], // 19
  [0.955, 0.980, 1.000, 1.000], // 20
  [1.000, 1.000, 1.000, 1.000], // ≥ 21
];

// Coluna da matriz por carteira. A matriz tem C1–C4 (por garantia). C5 (crédito
// pessoal/rotativo SEM garantia — o mais comum no REPB) usa a curva mais alta (C4).
const COL: Record<Carteira, number> = { C1: 0, C2: 1, C3: 2, C4: 3, C5: 3 };

export const CARTEIRAS: { id: Carteira; label: string }[] = [
  { id: 'C1', label: 'C1 — alienação fiduciária de imóvel / garantia da União' },
  { id: 'C2', label: 'C2 — arrendamento, hipoteca, penhor, alienação de móveis' },
  { id: 'C3', label: 'C3 — recebíveis, cessão/caução fiduciária de direitos' },
  { id: 'C4', label: 'C4 — capital de giro, câmbio, debêntures sem garantia' },
  { id: 'C5', label: 'C5 — crédito pessoal/CDC/rotativo SEM garantia' },
];

// Operação (produto) → carteira sugerida (o usuário pode trocar).
export const OPERACOES: { label: string; carteira: Carteira }[] = [
  { label: 'Cartão de crédito', carteira: 'C5' },
  { label: 'Cheque especial', carteira: 'C5' },
  { label: 'Empréstimo pessoal', carteira: 'C5' },
  { label: 'Crédito consignado', carteira: 'C5' },
  { label: 'CDC (crédito direto ao consumidor)', carteira: 'C5' },
  { label: 'Rotativo', carteira: 'C5' },
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

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Meses de atraso a partir da data do último pagamento (aprox. 30,44 dias/mês). */
export function mesesDesde(isoDate: string, hoje = new Date()): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + (isoDate.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return null;
  const dias = (hoje.getTime() - d.getTime()) / 86_400_000;
  return dias <= 0 ? 0 : dias / 30.4375;
}

export function estagio(meses: number): { n: 1 | 2 | 3; label: string } {
  const dias = meses * 30.4375;
  if (dias > 90) return { n: 3, label: 'Estágio 3 — ativo problemático (default > 90 dias)' };
  if (dias > 30) return { n: 2, label: 'Estágio 2 — risco aumentado (atraso > 30 dias)' };
  return { n: 1, label: 'Estágio 1 — crédito saudável' };
}

export interface ProvisaoResultado {
  meses: number;
  faixaLabel: string;
  estagio: { n: 1 | 2 | 3; label: string };
  provisaoBasePct: number;    // % da matriz (sem cap por instituição)
  provisaoAplicadaPct: number; // % após o teto da instituição
  valorProvisionado: number;
  propostaPct: number;        // % do saldo sugerido como acordo
  propostaAcordo: number;
  descontoValor: number;      // ganho do cliente (saldo − proposta)
  descontoPct: number;
}

const FAIXAS = (i: number) => (i === 0 ? '< 1 mês' : i >= 21 ? '≥ 21 meses' : `${i}–${i + 1} meses`);

export function calcularProvisao(input: {
  saldoDevedor: number;
  carteira: Carteira;
  meses: number;
  instituicao: Instituicao;
}): ProvisaoResultado {
  const saldo = Math.max(0, input.saldoDevedor || 0);
  const bucket = clamp(Math.floor(input.meses), 0, 21);
  const provisaoBasePct = MATRIZ[bucket][COL[input.carteira]];
  const cap = INSTITUICOES.find((x) => x.id === input.instituicao)?.cap ?? 1.0;
  const provisaoAplicadaPct = Math.min(provisaoBasePct, cap);
  const valorProvisionado = saldo * provisaoAplicadaPct;
  // O banco "já perdeu" a parte provisionada → aceita acordo próximo do residual.
  // Piso de 10% para banco (não zera); cooperativa/fundo já ficam altos pelo teto.
  const pisoBanco = input.instituicao === 'banco' ? 0.1 : 0;
  const propostaPct = Math.max(1 - provisaoAplicadaPct, pisoBanco);
  const propostaAcordo = saldo * propostaPct;
  const descontoValor = saldo - propostaAcordo;
  return {
    meses: input.meses,
    faixaLabel: FAIXAS(bucket),
    estagio: estagio(input.meses),
    provisaoBasePct,
    provisaoAplicadaPct,
    valorProvisionado,
    propostaPct,
    propostaAcordo,
    descontoValor,
    descontoPct: saldo > 0 ? descontoValor / saldo : 0,
  };
}
