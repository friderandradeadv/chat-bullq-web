import { api } from '@/lib/api';

export type IndiceCorrecao = 'INPC' | 'IPCA-E' | 'IPCA' | 'IGP-M';
export type HonorariosTipo = 'FIXO' | 'PERCENTUAL';

export interface ParcelaInput {
  data: string; // YYYY-MM-DD
  valor: number;
  saque?: number;
  /** id do documento nos autos + página (extrato do órgão pagador) — trava C1 */
  fonte?: string;
}

/** Ocorrência da validação antiexcesso (C1–C11). */
export interface Ocorrencia {
  codigo: string;
  severidade: 'erro' | 'aviso';
  mensagem: string;
  campo?: string;
}

export type CenarioId = 'apenasConversao' | 'conversaoDobro' | 'restituicaoTotal';
export type SucumbenciaBase = 'principal' | 'valorCausa' | 'diferenca';

export interface CsInput {
  ativar: boolean;
  baseCenario?: CenarioId;
  principalManual?: number;
  sucumbencia?: {
    percentual: number;
    base: SucumbenciaBase;
    valorCausa?: number;
    atualizarValorCausa?: boolean;
    valorCausaData?: string;
  };
  multaMoratoria523?: boolean;
  honorarios523?: boolean;
}

export interface CalcularRmcInput {
  valorEmprestimo: number;
  taxaConversao: number; // % a.m.
  dobro: boolean;
  modulacaoStj?: boolean; // dobro só >= 30/03/2021 (EAREsp 676.608)
  indiceCorrecao: IndiceCorrecao;
  dataBase: string; // YYYY-MM-DD
  /** data da contratação impugnada — marco da trava antiexcesso C2 */
  dataContratacao?: string; // YYYY-MM-DD
  proRataDie?: boolean;
  jurosMora?: number;
  danosMorais?: number;
  honorariosTipo?: HonorariosTipo;
  honorariosValor?: number;
  nomeCalculo?: string;
  parcelas: ParcelaInput[];
  cs?: CsInput;
}

export interface LinhaEvolucao {
  numero: number;
  data: string;
  valorDebitado: number;
  saldoAnterior: number;
  juros: number;
  amortizacao: number;
  saque: number;
  saldoAtual: number;
  valorRestituir: number;
  dobroAplicado: boolean;
  fatorCorrecao: number;
  valorCorrigido: number;
  jurosMoraPct: number;
  jurosMoraValor: number;
  valorAtualizado: number;
}

export interface ResultadoCs {
  baseCenario: CenarioId;
  termoFinal: string;
  principal: number;
  sucumbencia: {
    percentual: number;
    base: SucumbenciaBase;
    valorCausa: number | null;
    valorCausaAtualizado: number | null;
    baseCalculo: number;
    valor: number;
  };
  multa523: { moratoria: number; honorarios: number; total: number };
  total: number;
}

export interface ResumoCenario {
  totalDebitado: number;
  somaNominalRestituir: number;
  saldoConversao: number;
  restituicao: number;
  danosMorais: number;
  honorarios: number;
  total: number;
}

export interface Cenario {
  id: CenarioId;
  titulo: string;
  descricao: string;
  linhas: LinhaEvolucao[];
  resumo: ResumoCenario;
}

export interface ResultadoRmc {
  nomeCalculo: string | null;
  config: {
    valorEmprestimo: number;
    taxaConversao: number;
    jurosMora: number;
    dobro: boolean;
    modulacaoStj: boolean;
    indiceCorrecao: IndiceCorrecao;
    dataBase: string;
    proRataDie: boolean;
  };
  cenarios: Cenario[];
  cs: ResultadoCs | null;
  /** ocorrências da validação antiexcesso (não-bloqueante no preview) */
  ocorrencias?: Ocorrencia[];
  linhas: LinhaEvolucao[];
  resumo: ResumoCenario;
}

export interface TaxaConsignado {
  taxa: number | null;
  mes?: string;
  modalidade?: string;
  fonte?: string;
  mensagem?: string;
}

export interface HiscreContrato {
  banco: string | null;
  tipo: string;
  contrato: string | null;
  parcelas: { data: string; valor: number }[];
}

export interface HiscreResultado {
  contratos: HiscreContrato[];
  aviso?: string;
}

export interface HisconContrato {
  banco: string | null;
  tipo: 'RMC' | 'RCC' | 'EMPRESTIMO' | string;
  contrato: string | null;
  dataInclusao: string | null;
  dataContratacao: string | null;
  valorEmprestimo: number | null;
  valorReservado: number | null;
  parcelasQtd: number | null;
  situacao: string | null;
}

export interface HisconResultado {
  contratos: HisconContrato[];
  aviso?: string;
}

/** Dados extraídos do PDF do próprio cálculo da inicial (relatório da calculadora). */
export interface CalculoExtraido {
  tipo: 'RMC' | 'RCC' | string | null;
  banco: string | null;
  contrato: string | null;
  valorEmprestimo: number | null;
  taxaConversao: number | null;
  dataContratacao: string | null;
  dataBase: string | null; // data-base ORIGINAL do cálculo da inicial
  indiceCorrecao: string | null;
  dobro: boolean | null;
  parcelas: { data: string; valor: number }[];
  observacoes: string | null;
}

export interface CalculoResultado {
  calculo: CalculoExtraido | null;
  aviso?: string;
}

export const calculadoraRmcService = {
  async calcular(input: CalcularRmcInput): Promise<ResultadoRmc> {
    const { data } = await api.post('/calculadora-rmc-rcc/calcular', input);
    return data.data ?? data;
  },

  async buscarTaxaConsignado(
    data: string,
    modalidade: 'INSS' | 'PUBLICO' = 'INSS',
  ): Promise<TaxaConsignado> {
    const { data: d } = await api.get('/calculadora-rmc-rcc/taxa-consignado', {
      params: { data, modalidade },
    });
    return d.data ?? d;
  },

  async extrairHiscre(file: File): Promise<HiscreResultado> {
    const fd = new FormData();
    fd.append('file', file);
    const { data: d } = await api.post('/calculadora-rmc-rcc/hiscre/extrair', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // HISCRE longo (anos de parcelas) → a IA pode passar de 2 min
    });
    return d.data ?? d;
  },

  async extrairHiscon(file: File): Promise<HisconResultado> {
    const fd = new FormData();
    fd.append('file', file);
    const { data: d } = await api.post('/calculadora-rmc-rcc/hiscon/extrair', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return d.data ?? d;
  },

  async extrairCalculo(file: File): Promise<CalculoResultado> {
    const fd = new FormData();
    fd.append('file', file);
    const { data: d } = await api.post('/calculadora-rmc-rcc/calculo/extrair', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // relatórios longos (anos de parcelas) → a IA pode demorar
    });
    return d.data ?? d;
  },
};
