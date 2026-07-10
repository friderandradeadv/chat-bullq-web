// ─────────────────────────────────────────────────────────────────────────
// SAFEZONE REPB — fonte ÚNICA e VERSIONADA de tudo que é LEI/NÚMERO no módulo.
// Mudou a norma? Mexe SÓ aqui. Cada bloco carrega { fonte, vigencia, status }.
//
//   status: 'validado' — conferido contra a fonte oficial (pode virar regra).
//           'pendente' — veio do método/curso (Tutor IA) e AINDA precisa ser
//                        conferido no texto oficial antes de virar fundamento.
//
// Regra de vigência: quando a norma mudar, NÃO apague a tabela antiga — crie uma
// nova versão com a `vigencia` nova; o cálculo escolhe a vigente na data do caso,
// para os cálculos antigos continuarem reproduzíveis (defensabilidade jurídica).
// ─────────────────────────────────────────────────────────────────────────

export type StatusNorma = 'validado' | 'pendente';

export interface BlocoNorma<T> {
  fonte: string;
  vigencia: string; // ISO — a partir de quando vale
  versao: number;
  status: StatusNorma;
  valores: T;
}

// ── Provisão — Resolução BCB 352/2023 (metodologia simplificada, S4/S5) ──
// VALIDADO: conferido célula a célula no texto da Res. 352 E na imagem do
// ANEXOS.pdf do escritório. Colunas [C1, C2, C3, C4, C5], em %.

// Anexo I — perdas incorridas (inadimplido > 90 dias), por meses a partir do
// mês do inadimplemento. Linha 0 = "< 1 mês" … 21 = "≥ 21 meses".
const ANEXO_I_VALORES: [number, number, number, number, number][] = [
  [5.5, 30.0, 45.0, 35.0, 50.0], [10.0, 33.4, 48.7, 39.5, 53.4], [14.5, 36.8, 52.4, 44.0, 56.8],
  [19.0, 40.2, 56.1, 48.5, 60.2], [23.5, 43.6, 59.8, 53.0, 63.6], [28.0, 47.0, 63.5, 57.5, 67.0],
  [32.5, 50.4, 67.2, 62.0, 70.4], [37.0, 53.8, 70.9, 66.5, 73.8], [41.5, 57.2, 74.6, 71.0, 77.2],
  [46.0, 60.6, 78.3, 75.5, 80.6], [50.5, 64.0, 82.0, 80.0, 84.0], [55.0, 67.4, 85.7, 84.5, 87.4],
  [59.5, 70.8, 89.4, 89.0, 90.8], [64.0, 74.2, 93.1, 93.5, 94.2], [68.5, 77.6, 96.8, 98.0, 97.6],
  [73.0, 81.0, 100.0, 100.0, 100.0], [77.5, 84.4, 100.0, 100.0, 100.0], [82.0, 87.8, 100.0, 100.0, 100.0],
  [86.5, 91.2, 100.0, 100.0, 100.0], [91.0, 94.6, 100.0, 100.0, 100.0], [95.5, 98.0, 100.0, 100.0, 100.0],
  [100.0, 100.0, 100.0, 100.0, 100.0],
];

// Anexo II — provisão adicional / perda esperada (0–90 dias), por faixa de dias.
const ANEXO_II_VALORES: { maxDias: number; label: string; p: [number, number, number, number, number] }[] = [
  { maxDias: 14, label: '0 a 14 dias', p: [1.4, 1.4, 1.9, 1.9, 1.9] },
  { maxDias: 30, label: '15 a 30 dias', p: [3.5, 3.5, 3.5, 3.5, 7.5] },
  { maxDias: 60, label: '31 a 60 dias', p: [4.5, 6.0, 13.0, 13.0, 15.0] },
  { maxDias: 90, label: '61 a 90 dias', p: [5.0, 17.0, 32.0, 32.0, 38.0] },
];

export const PROVISAO: BlocoNorma<{ anexoI: typeof ANEXO_I_VALORES; anexoII: typeof ANEXO_II_VALORES }> = {
  fonte: 'Resolução BCB nº 352/2023, Anexos I e II',
  vigencia: '2025-01-01',
  versao: 1,
  status: 'validado',
  valores: { anexoI: ANEXO_I_VALORES, anexoII: ANEXO_II_VALORES },
};

// Golden values — se alguém editar as tabelas e quebrar um número, `validarNormas`
// acusa. (Rode em teste/dev; não dispara em produção pra não poluir o console.)
export const GOLDEN_PROVISAO: { desc: string; ok: boolean }[] = [
  { desc: 'Anexo I · <1mês · C5 = 50%', ok: ANEXO_I_VALORES[0][4] === 50.0 },
  { desc: 'Anexo I · 15–16m · C3 = 100%', ok: ANEXO_I_VALORES[15][2] === 100.0 },
  { desc: 'Anexo II · 61–90d · C5 = 38%', ok: ANEXO_II_VALORES[3].p[4] === 38.0 },
  { desc: 'Anexo II · 15–30d · C5 = 7,5%', ok: ANEXO_II_VALORES[1].p[4] === 7.5 },
];
export function validarNormas(): { ok: boolean; falhas: string[] } {
  const falhas = GOLDEN_PROVISAO.filter((g) => !g.ok).map((g) => g.desc);
  return { ok: falhas.length === 0, falhas };
}

// ── Estágios de risco (Res. 4.966/2021) ──
export const ESTAGIOS: BlocoNorma<{ s1: string; s2: string; s3: string }> = {
  fonte: 'Res. CMN 4.966/2021 (modelo de perda esperada)',
  vigencia: '2025-01-01', versao: 1, status: 'pendente', // critério literal do "> 30 dias" a conferir
  valores: { s1: 'em dia / ≤ 30 dias — perda esperada 12 meses', s2: '> 30 dias — aumento significativo de risco', s3: '> 90 dias — ativo problemático (default)' },
};

// ── Prazos operacionais (a validar na fonte antes de automatizar) ──
export const PRAZOS: BlocoNorma<Record<string, { dias: number; uteis?: boolean; nota: string }>> = {
  fonte: 'Método TABM + normas citadas', vigencia: '2025-01-01', versao: 1, status: 'pendente',
  valores: {
    default_inadimplemento: { dias: 90, nota: 'marco do default / perda incorrida (Anexo II 4966)' },
    superendiv_primeira_parcela: { dias: 180, nota: '1ª parcela do plano de superendividamento' },
    busca_apreensao_purgar: { dias: 5, nota: 'purgar a mora após a liminar (DL 911/69)' },
    busca_apreensao_contestar: { dias: 15, nota: 'contestar a busca e apreensão' },
    embargos_execucao: { dias: 15, uteis: true, nota: 'embargos à execução (CPC 914 e ss.)' },
  },
};

// ── Mínimo existencial / superendividamento ──
// ⚠️ 35% é a posição ADOTADA no curso, NÃO um percentual pacificado em lei.
// A lei fala em "mínimo existencial" (Lei 14.181/21; Decreto 11.150/22 controverso).
// Parâmetro editável na calculadora; status 'pendente' até validar.
export const MINIMO_EXISTENCIAL: BlocoNorma<{ comprometimentoPct: number }> = {
  fonte: 'Lei 14.181/2021 (CDC art. 54-A) + posição do método TABM',
  vigencia: '2025-01-01', versao: 1, status: 'pendente',
  valores: { comprometimentoPct: 0.35 },
};

// ── Registro de referências legais citadas no método (para fundamentar peças) ──
// Cada uma precisa bater com o texto oficial antes de virar fundamento gravado.
export interface RefLegal { id: string; label: string; tema: string; status: StatusNorma }
export const REFERENCIAS: RefLegal[] = [
  { id: 'res_4966', label: 'Res. CMN 4.966/2021', tema: 'perda esperada (substitui a 2.682)', status: 'validado' },
  { id: 'res_352', label: 'Res. BCB 352/2023', tema: 'metodologia + Anexos I/II de provisão', status: 'validado' },
  { id: 'res_309', label: 'Res. BCB 309/2023', tema: 'metodologia simplificada (S4/S5), prazos', status: 'pendente' },
  { id: 'res_2682', label: 'Res. CMN 2.682/1999', tema: 'regime antigo (referência histórica)', status: 'pendente' },
  { id: 'res_3919', label: 'Res. CMN 3.919/2010', tema: 'tarifas bancárias', status: 'pendente' },
  { id: 'lei_14181', label: 'Lei 14.181/2021', tema: 'superendividamento (altera o CDC)', status: 'pendente' },
  { id: 'cdc_54a', label: 'CDC art. 54-A', tema: 'conceito de superendividamento / mínimo existencial', status: 'pendente' },
  { id: 'cdc_42', label: 'CDC art. 42 § único', tema: 'repetição do indébito em dobro', status: 'pendente' },
  { id: 'cdc_6v', label: 'CDC art. 6º, V', tema: 'revisão de cláusulas / modificação', status: 'pendente' },
  { id: 'sum_530', label: 'Súmula 530 STJ', tema: 'taxa média de mercado (juros)', status: 'pendente' },
  { id: 'sum_72', label: 'Súmula 72 STJ', tema: 'busca e apreensão / comprovação da mora', status: 'pendente' },
  { id: 'tema_28', label: 'Tema 28 STJ', tema: 'afastamento/descaracterização da mora', status: 'pendente' },
  { id: 'aresp_676608', label: 'AgRg no AREsp 676.608', tema: 'repetição em dobro independe de má-fé', status: 'pendente' },
  { id: 'dl_911', label: 'DL 911/1969', tema: 'busca e apreensão (alienação fiduciária)', status: 'pendente' },
  { id: 'lei_10931', label: 'Lei 10.931/2004', tema: 'CCB — cédula de crédito bancário', status: 'pendente' },
  { id: 'cpc_914', label: 'CPC art. 914 e ss.', tema: 'embargos à execução', status: 'pendente' },
  { id: 'cc_205', label: 'CC art. 205', tema: 'prescrição decenal (revisional)', status: 'pendente' },
];
