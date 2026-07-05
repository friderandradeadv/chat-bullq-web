// Dados REAIS capturados do painel Contabilizei (05/07/2026, somente leitura).
// Formato = snapshot de IMPORTAÇÃO do backend ({ empresa, competencias }), então serve
// tanto para (a) prefill do modal de importação quanto (b) fallback local do painel
// enquanto o backend não estiver deployado/populado.

import type { EmpresaContabil, CompetenciaInput } from '../services/contabilidade.service';

export const EMPRESA: EmpresaContabil = {
  razaoSocial: 'FRIDER ANDRADE - SOCIEDADE INDIVIDUAL DE ADVOCACIA',
  cnpj: '61.516.888/0001-04',
  inscricaoMunicipal: '322020',
  regime: 'Simples Nacional',
  anexo: 'IV',
  cnae: '6911-7/01',
  itemServico: '17.13 — Advocacia',
  municipioISS: 'Maringá/PR',
  aliquotaISS: 0.02,
  socio: 'Matheus Frider Andrade',
  proLabore: 1621,
};

// Série real por competência (dez/2025 → mai/2026). Só fev/2026 teve receita (1 nota).
export const COMPETENCIAS: CompetenciaInput[] = [
  {
    comp: '2025-12', receita: 0,
    guias: [{ tipo: 'DARF_UNIFICADO', valor: 470.58, status: 'CALCULANDO' }],
  },
  {
    comp: '2026-01', receita: 0,
    guias: [
      { tipo: 'DARF_UNIFICADO', valor: 502.51, status: 'PAGO', vencimento: '2026-02-20' },
      { tipo: 'TAXA_FISCALIZACAO', valor: 429.83, status: 'PAGO' },
    ],
  },
  {
    comp: '2026-02', receita: 6377.94,
    notas: [{ numero: '2', valorServico: 6377.94, anexo: 4, situacao: 'PROCESSADO_SUCESSO' }],
    guias: [
      { tipo: 'DAS', valor: 287.01, status: 'PAGO', vencimento: '2026-03-20' },
      { tipo: 'DARF_UNIFICADO', valor: 502.51, status: 'PAGO', vencimento: '2026-03-20' },
    ],
    declaracoes: [
      { tipo: 'PGDAS', situacao: 'TRANSMITIDO' },
      { tipo: 'DCTFWEB', situacao: 'TRANSMITIDO' },
    ],
  },
  { comp: '2026-03', receita: 0, guias: [{ tipo: 'DARF_UNIFICADO', valor: 502.51, status: 'PAGO', vencimento: '2026-04-20' }] },
  { comp: '2026-04', receita: 0, guias: [{ tipo: 'DARF_UNIFICADO', valor: 502.51, status: 'PAGO', vencimento: '2026-05-20' }] },
  { comp: '2026-05', receita: 0, guias: [{ tipo: 'DARF_UNIFICADO', valor: 502.51, status: 'PAGO', vencimento: '2026-06-19' }] },
];

export const SNAPSHOT_CAPTURA = { empresa: EMPRESA, competencias: COMPETENCIAS };

// Declaração anual (DEFIS) — exibição no front (o backend foca a apuração mensal).
export const DECLARACOES_ANUAIS = [{ ano: 2026, tipo: 'DEFIS' as const, situacao: 'TRANSMITIDO' }];

export const GUIA_LABEL: Record<string, string> = {
  DAS: 'DAS — Simples Nacional',
  DARF_UNIFICADO: 'DARF Unificado — INSS s/ pró-labore',
  TAXA_FISCALIZACAO: 'Taxa de Fiscalização',
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const compLabel = (comp: string) => {
  const [ano, mes] = comp.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
};
