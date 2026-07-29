import { api } from '@/lib/api';

export type { prepararPdfs } from '@/features/calculadora-cs/services/calculadora-cs.service';

export type Modalidade =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'justa_causa'
  | 'acordo_484a'
  | 'fim_contrato'
  | 'rescisao_indireta';

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  sem_justa_causa: 'Dispensa sem justa causa',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Dispensa por justa causa',
  acordo_484a: 'Acordo (art. 484-A da CLT)',
  fim_contrato: 'Fim de contrato por prazo determinado',
  rescisao_indireta: 'Rescisão indireta (art. 483 da CLT)',
};

export type Incidencia = 'FGTS' | 'ContribuicaoSocial' | 'IRRF';

export interface FeriasVencidasInput {
  periodoAquisitivo: string;
  dobra?: boolean;
  avos?: number;
}

export interface VerbaExtraInput {
  chave: string;
  nome?: string;
  base?: number;
  divisor?: number;
  multiplicador?: number;
  quantidade?: number;
  dobra?: boolean;
  valorDireto?: number;
  incidencias?: Incidencia[];
  obs?: string;
  estimativa?: boolean;
  fonte?: string;
  formula?: string;
}

export interface EncargosInput {
  aliquota_patronal?: number;
  aliquota_sat?: number;
  fonte_sat?: string;
  fap?: number;
  cnae_reu?: string;
  competencia_referencia?: string;
  fundamento_patronal?: string;
  aviso?: string;
}

export interface CalcularRescisaoInput {
  identificacao?: Record<string, string>;
  admissao: string;
  desligamento: string;
  modalidade: Modalidade;
  maiorRemuneracao: number;
  ultimaRemuneracao?: number;
  salarioBase?: number;
  cargaHoraria?: number;
  salarioMinimo?: number;
  projetarAviso?: boolean;
  diasSaldoSalario?: number;
  avos13?: number;
  avosFeriasProp?: number;
  feriasVencidas?: FeriasVencidasInput[];
  historicoSalarial?: [string, string][];
  fgtsDepositado?: number;
  semExtratoFgts?: boolean;
  incluirMulta477?: boolean;
  incluirMulta467?: boolean;
  liquidoTrctZero?: boolean;
  verbasExtras?: VerbaExtraInput[];
  pagoPorVerba?: Record<string, number>;
  honorariosPercentual?: number;
  encargos?: EncargosInput;
  correcao?: { aplicar?: boolean; indice?: string; fonteSerie?: string };
  criteriosExtras?: string[];
  dataLiquidacao?: string;
  dataAjuizamento?: string;
  municipio?: string;
  uf?: string;
}

export interface LinhaVerba {
  periodo: string;
  base: string;
  divisor: string;
  multiplicador: string;
  quantidade: string;
  dobra: string;
  devido: number;
  pago: number;
}

export interface VerbaOut {
  nome: string;
  inc: string;
  incidencias: Incidencia[];
  formula: string;
  obs: string;
  estimativa: boolean;
  fonte?: string;
  linhas: LinhaVerba[];
  devido: number;
  pago: number;
  diferenca: number;
}

export interface ResultadoRescisao {
  identificacao: Record<string, string>;
  dados_calculo: Record<string, string>;
  historico_salarial: [string, string][];
  ferias: string[][];
  verbas: VerbaOut[];
  criterios: string[];
  honorarios_percentual: number;
  encargos: Record<string, unknown> | null;
  totais: {
    bruto: number;
    honorarios: number;
    encargosPrevidenciarios: number;
    totalDevido: number;
  };
  comparativoModalidades: { modalidade: Modalidade; label: string; total: number; atual: boolean }[];
  aviso: { avisoDias: number; dataProjetada: string; multaFgtsPercent: number };
  alertas: string[];
  pendencias: string[];
  fechamentoOk: boolean;
}

export const calculadoraRescisaoService = {
  async calcular(input: CalcularRescisaoInput): Promise<ResultadoRescisao> {
    const { data } = await api.post('/calculadora-rescisao/calcular', input);
    return data.data ?? data;
  },

  async extrairTrct(files: File[]): Promise<{ extracao: Record<string, unknown>; metodo?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-rescisao/extrair-trct', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },

  async extrairHolerite(files: File[]): Promise<{ extracao: Record<string, unknown>; metodo?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-rescisao/extrair-holerite', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },

  async extrairFgts(files: File[]): Promise<{ extracao: Record<string, unknown>; alertas?: string[]; metodo?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-rescisao/extrair-fgts', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },

  // Genérico: qualquer documento (conversa, print, foto, PDF) → pré-preenche o formulário.
  async extrairDocumento(files: File[]): Promise<{ extracao: Record<string, unknown>; metodo?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-rescisao/extrair-documento', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },
};
