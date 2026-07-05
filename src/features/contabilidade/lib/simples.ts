// Motor de apuração do Simples Nacional (LC 123/2006, tabelas LC 155/2016 vigentes desde 2018).
// Determinístico e público — serve para calcular e VALIDAR o DAS contra o que a Contabilizei gera.
// Advocacia (sociedade de advogados) é tributada pelo ANEXO IV (LC 123 art. 18 §5º-C).
// ⚠️ No Anexo IV o CPP (INSS patronal) NÃO está no DAS — é recolhido à parte sobre a folha.

export type AnexoId = 'III' | 'IV' | 'V';

export interface Faixa {
  ate: number;        // teto da faixa de RBT12 (R$)
  nominal: number;    // alíquota nominal (fração, ex.: 0.045 = 4,5%)
  deduzir: number;    // parcela a deduzir (R$)
}

// Cada tributo e seu % de repartição dentro da alíquota, por faixa.
// (Percentuais do Anexo IV; usados para o detalhamento do DAS.)
export interface Reparticao {
  irpj: number; csll: number; cofins: number; pisPasep: number; iss: number;
}

export const ANEXOS: Record<AnexoId, { nome: string; faixas: Faixa[]; reparticao: Reparticao[] }> = {
  // Serviços em geral — aplicável quando Fator R ≥ 28%.
  III: {
    nome: 'Anexo III — serviços (Fator R ≥ 28%)',
    faixas: [
      { ate: 180_000, nominal: 0.06, deduzir: 0 },
      { ate: 360_000, nominal: 0.112, deduzir: 9_360 },
      { ate: 720_000, nominal: 0.135, deduzir: 17_640 },
      { ate: 1_800_000, nominal: 0.16, deduzir: 35_640 },
      { ate: 3_600_000, nominal: 0.21, deduzir: 125_640 },
      { ate: 4_800_000, nominal: 0.33, deduzir: 648_000 },
    ],
    reparticao: [
      { irpj: 0.04, csll: 0.035, cofins: 0.1282, pisPasep: 0.0278, iss: 0.335 }, // + CPP embutido (restante)
      { irpj: 0.04, csll: 0.035, cofins: 0.1405, pisPasep: 0.0305, iss: 0.32 },
      { irpj: 0.04, csll: 0.035, cofins: 0.1364, pisPasep: 0.0296, iss: 0.325 },
      { irpj: 0.04, csll: 0.035, cofins: 0.1364, pisPasep: 0.0296, iss: 0.325 },
      { irpj: 0.04, csll: 0.035, cofins: 0.1409, pisPasep: 0.0306, iss: 0.335 },
      { irpj: 0.35, csll: 0.15, cofins: 0.1603, pisPasep: 0.0347, iss: 0 },
    ],
  },
  // ADVOCACIA e afins — sem Fator R; CPP recolhido fora do DAS.
  IV: {
    nome: 'Anexo IV — advocacia',
    faixas: [
      { ate: 180_000, nominal: 0.045, deduzir: 0 },
      { ate: 360_000, nominal: 0.09, deduzir: 8_100 },
      { ate: 720_000, nominal: 0.102, deduzir: 12_420 },
      { ate: 1_800_000, nominal: 0.14, deduzir: 39_780 },
      { ate: 3_600_000, nominal: 0.22, deduzir: 183_780 },
      { ate: 4_800_000, nominal: 0.33, deduzir: 828_000 },
    ],
    // Anexo IV: sem CPP no DAS. Soma dá 100%.
    // ⚠️ 1ª faixa VALIDADA com PDF real (Fev/2026: DAS 287,01 → IRPJ 53,96 / CSLL 43,63 /
    // COFINS 50,71 / PIS 10,99 / ISS 127,72). Faixas 2–6 são a tabela RFB, ainda não conferidas
    // com dado real — revalidar quando o faturamento passar de R$ 180 mil/ano.
    reparticao: [
      { irpj: 0.1880, csll: 0.1520, cofins: 0.1767, pisPasep: 0.0383, iss: 0.4450 },
      { irpj: 0.1980, csll: 0.1520, cofins: 0.2055, pisPasep: 0.0445, iss: 0.4000 },
      { irpj: 0.2080, csll: 0.1520, cofins: 0.1973, pisPasep: 0.0427, iss: 0.4000 },
      { irpj: 0.1780, csll: 0.1920, cofins: 0.1890, pisPasep: 0.0410, iss: 0.4000 },
      { irpj: 0.1880, csll: 0.1920, cofins: 0.1867, pisPasep: 0.0403, iss: 0.3930 },
      { irpj: 0.5350, csll: 0.2150, cofins: 0.2050, pisPasep: 0.0450, iss: 0 },
    ],
  },
  // Serviços — aplicável quando Fator R < 28%.
  V: {
    nome: 'Anexo V — serviços (Fator R < 28%)',
    faixas: [
      { ate: 180_000, nominal: 0.155, deduzir: 0 },
      { ate: 360_000, nominal: 0.18, deduzir: 4_500 },
      { ate: 720_000, nominal: 0.195, deduzir: 9_900 },
      { ate: 1_800_000, nominal: 0.205, deduzir: 17_100 },
      { ate: 3_600_000, nominal: 0.23, deduzir: 62_100 },
      { ate: 4_800_000, nominal: 0.305, deduzir: 540_000 },
    ],
    reparticao: [
      { irpj: 0.25, csll: 0.15, cofins: 0.141, pisPasep: 0.0305, iss: 0.14 },
      { irpj: 0.23, csll: 0.15, cofins: 0.141, pisPasep: 0.0305, iss: 0.17 },
      { irpj: 0.24, csll: 0.15, cofins: 0.1492, pisPasep: 0.0323, iss: 0.19 },
      { irpj: 0.21, csll: 0.15, cofins: 0.1574, pisPasep: 0.0341, iss: 0.21 },
      { irpj: 0.23, csll: 0.125, cofins: 0.1410, pisPasep: 0.0305, iss: 0.235 },
      { irpj: 0.355, csll: 0.155, cofins: 0.1603, pisPasep: 0.0347, iss: 0 },
    ],
  },
};

export interface ApuracaoInput {
  receitaMes: number;   // faturamento da competência (R$)
  rbt12: number;        // receita bruta acumulada dos últimos 12 meses (R$)
  anexo: AnexoId;
}

export interface ApuracaoResult {
  anexo: AnexoId;
  faixa: number;              // 1..6
  aliquotaNominal: number;    // fração
  parcelaDeduzir: number;     // R$
  aliquotaEfetiva: number;    // fração
  das: number;                // R$ do mês
  tributos: { codigo: string; nome: string; valor: number }[];
  avisos: string[];
}

// ── INSS sobre pró-labore (DARF Unificado, recolhido TODO mês, à parte do DAS) ──
// Anexo IV: patronal (20%) fica FORA do DAS e sai aqui. Validado com Fev/2026:
// pró-labore R$ 1.621,00 → 11% = 178,31 (cód. 1099) + 20% = 324,20 (cód. 1138) = 502,51.
export const TETO_INSS_2026 = 8_475.55;

export interface InssProlaboreResult {
  base: number;
  segurado: number;   // 11% — cód. 1099
  patronal: number;   // 20% — cód. 1138
  total: number;
  itens: { codigo: string; nome: string; aliquota: number; valor: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularInssProlabore(proLabore: number, teto = TETO_INSS_2026): InssProlaboreResult {
  const base = Math.min(Math.max(proLabore, 0), teto);
  const segurado = round2(base * 0.11);
  const patronal = round2(base * 0.20);
  return {
    base,
    segurado,
    patronal,
    total: round2(segurado + patronal),
    itens: [
      { codigo: '1099', nome: 'CP Segurado (contribuinte individual)', aliquota: 0.11, valor: segurado },
      { codigo: '1138', nome: 'CP Patronal (empresa)', aliquota: 0.20, valor: patronal },
    ],
  };
}

/** Fator R = folha (pró-labore + salários + encargos) dos últimos 12m ÷ receita 12m. */
export function fatorR(folha12: number, receita12: number): number {
  if (receita12 <= 0) return 0;
  return folha12 / receita12;
}

/** ≥ 28% → Anexo III; < 28% → Anexo V. (Não se aplica à advocacia/Anexo IV.) */
export function anexoPorFatorR(folha12: number, receita12: number): AnexoId {
  return fatorR(folha12, receita12) >= 0.28 ? 'III' : 'V';
}

function faixaIndex(faixas: Faixa[], rbt12: number): number {
  const i = faixas.findIndex((f) => rbt12 <= f.ate);
  return i === -1 ? faixas.length - 1 : i;
}

export function apurar({ receitaMes, rbt12, anexo }: ApuracaoInput): ApuracaoResult {
  const cfg = ANEXOS[anexo];
  const avisos: string[] = [];
  const base = Math.max(rbt12, 0);
  const idx = faixaIndex(cfg.faixas, base);
  const faixa = cfg.faixas[idx];

  // Alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12
  const aliquotaEfetiva = base > 0 ? Math.max((base * faixa.nominal - faixa.deduzir) / base, 0) : faixa.nominal;
  const das = receitaMes * aliquotaEfetiva;

  const rep = cfg.reparticao[idx];
  // Códigos de receita da Receita (confirmados no PDF do PGDAS-D, comp. Fev/2026).
  const tributos = [
    { codigo: '1001', nome: 'IRPJ', valor: das * rep.irpj },
    { codigo: '1002', nome: 'CSLL', valor: das * rep.csll },
    { codigo: '1004', nome: 'COFINS', valor: das * rep.cofins },
    { codigo: '1005', nome: 'PIS/Pasep', valor: das * rep.pisPasep },
    { codigo: '1010', nome: 'ISS', valor: das * rep.iss },
  ];
  const cppFrac = 1 - (rep.irpj + rep.csll + rep.cofins + rep.pisPasep + rep.iss);
  if (cppFrac > 0.0001) tributos.push({ codigo: '1003', nome: 'CPP (INSS)', valor: das * cppFrac });

  if (base > 4_800_000) avisos.push('RBT12 acima do teto do Simples (R$ 4,8 mi) — verificar exclusão/sublimite de ICMS/ISS.');
  if (anexo === 'IV') avisos.push('Anexo IV: INSS patronal (CPP) é recolhido em guia separada sobre a folha, fora do DAS.');
  if (base > 3_600_000) avisos.push('Acima de R$ 3,6 mi: ISS/ICMS podem sair do DAS por sublimite estadual/municipal.');

  return {
    anexo,
    faixa: idx + 1,
    aliquotaNominal: faixa.nominal,
    parcelaDeduzir: faixa.deduzir,
    aliquotaEfetiva,
    das,
    tributos,
    avisos,
  };
}
