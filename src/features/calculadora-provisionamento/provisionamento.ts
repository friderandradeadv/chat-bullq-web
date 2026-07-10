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

import { PROVISAO } from './normas-repb';

export type Carteira = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type Instituicao = 'banco' | 'cooperativa' | 'fundo';

// Tabelas oficiais vêm da SAFEZONE versionada (normas-repb.ts) — mudou a lei,
// mexe lá; aqui é só a lógica de cálculo.
const ANEXO_I = PROVISAO.valores.anexoI;
const ANEXO_II = PROVISAO.valores.anexoII;

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
