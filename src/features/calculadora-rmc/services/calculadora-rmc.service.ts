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

/** Entrada pronta de cálculo, montada a partir dos descontos do próprio HISCON. */
export interface EntradaCalculadora {
  tipo: 'RMC' | 'RCC';
  banco: string;
  contrato: string;
  valorEmprestimo: number | null;
  dataContratacao: string | null;
  parcelas: { data: string; valor: number; fonte: string }[];
  competencias: number;
  totalDescontado: number;
  pronta: boolean;
  faltando: string[];
  taxaConsultarEm: string | null;
}

export type VereditoAcao = 'AJUIZAR' | 'REPOSICIONAR_TESE' | 'NAO_AJUIZAR' | 'INDICIO_FRACO';

export interface AcaoSugerida {
  grupo: string;
  instituicoes: string[];
  averbacoes: number;
  dentroDoPrazo: number;
  decaidos: number;
  cartoesAtivos: number;
  indicios: { id: string; titulo: string; n: number }[];
  teses: string[];
  veredito: VereditoAcao;
  porque: string;
  proximoPasso: string;
}

export interface PlanoAcao {
  acoes: AcaoSugerida[];
  resumo: {
    reus: number;
    aAjuizar: number;
    aReposicionar: number;
    aDescartar: number;
    indicioFraco: number;
    contratosDentroDoPrazo: number;
    contratosDecaidos: number;
  };
  diagnostico: string[];
}


/** Um réu, já agrupado por conglomerado. */
export interface ReuGrupo {
  grupoNome: string;
  contratos: number;
  instituicoes: { codigo: string | null; nome: string; contratos: number; cadastrado: boolean }[];
}

/** Trava do escritório: o que precisa ser decidido antes de ajuizar. */
export interface Gate {
  id: string;
  nivel: 'BLOQUEIO' | 'ALERTA' | 'INFORMATIVO';
  titulo: string;
  fundamento?: string;
  descricao?: string;
  acao?: string;
}

/** Indício calculado por regra sobre os contratos. */
export interface Indicio {
  id: string;
  titulo: string;
  categoria: string;
  contratos: string[];
  bancos: string[];
  evidencia: string;
}

/** Contexto dos gates. Tudo opcional: sem o dado, o gate diz que não avaliou. */
export interface ContextoHiscon {
  uf?: string;
  fase?: 'conhecimento' | 'cumprimento';
  valorPretendido?: number;
  salarioMinimo?: number;
  precisaGrafotecnica?: boolean;
  comarcaTemJuizado?: boolean;
}

export interface HisconResultado {
  contratos: HisconContrato[];
  /** Só quando a leitura foi pela geometria do PDF. */
  entradasCalculadora?: EntradaCalculadora[];
  planoAcao?: PlanoAcao;
  reus?: { reus: ReuGrupo[]; totalGrupos: number; totalInstituicoes: number; avisos: string[] };
  /** `avaliarGates` devolve o ENVELOPE, não a lista: `{ gates, bloqueios, alertas }`. */
  gates?: { gates: Gate[]; bloqueios: number; alertas: number };
  indicios?: { indicios: Indicio[]; consolidado?: Record<string, unknown> };
  metodo?: 'coordenadas' | 'ia';
  avisos?: string[];
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

  async extrairHiscon(file: File, ctx?: ContextoHiscon): Promise<HisconResultado> {
    const fd = new FormData();
    fd.append('file', file);
    // O contexto vai por query: são os dados dos gates do escritório, e sem eles
    // o gate de foro responde "não avaliado" em vez de chutar.
    const params = Object.fromEntries(
      Object.entries(ctx ?? {}).filter(([, v]) => v !== undefined && v !== ''),
    );
    const { data: d } = await api.post('/calculadora-rmc-rcc/hiscon/extrair', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
      timeout: 300000,
    });
    return d.data ?? d;
  },

  /** Laudo técnico em PDF. O servidor relê o HISCON: o payload não vai do
   *  navegador, para o documento não sair de dado que a tela pôde alterar. */
  async gerarLaudoHiscon(file: File, ctx?: ContextoHiscon & { cliente?: string }): Promise<Blob> {
    const fd = new FormData();
    fd.append('file', file);
    const params = Object.fromEntries(
      Object.entries(ctx ?? {}).filter(([, v]) => v !== undefined && v !== ''),
    );
    const { data } = await api.post('/calculadora-rmc-rcc/hiscon/laudo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
      responseType: 'blob',
      timeout: 300000,
    });
    return data as Blob;
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
