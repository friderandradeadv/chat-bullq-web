import { api } from '@/lib/api';

export type IndiceCorrecao = 'INPC' | 'IPCA-E' | 'IPCA' | 'IGP-M';

export interface Modalidade {
  key: string;
  label: string;
  grupo: 'Pessoa física' | 'Pessoa jurídica' | 'Direcionado / outros';
  temSerie: boolean;
}

export interface TaxaMedia {
  taxa: number | null; // % a.m.
  mes?: string;
  fonte?: string;
  modalidade?: string;
  manual?: boolean;
  mensagem?: string;
}

export interface CalcularRevisionalInput {
  modalidade: string;
  valorLiberado: number;
  valorParcela: number;
  numeroParcelas: number;
  parcelasPagas?: number;
  dataContratacao: string; // YYYY-MM-DD
  dataBase: string; // YYYY-MM-DD
  taxaReferenciaManual?: number; // % a.m.
  multiplicadorAbusividade?: number;
  indiceCorrecao: IndiceCorrecao;
  corrigir?: boolean;
  dobro?: boolean;
  modulacaoStj?: boolean;
  jurosMora?: number;
  nomeCalculo?: string;
}

export interface LinhaRevisional {
  numero: number;
  data: string;
  parcelaContrato: number;
  parcelaRecalculada: number;
  diferenca: number;
  paga: boolean;
  valorRestituir: number;
  dobroAplicado: boolean;
  fatorCorrecao: number;
  valorCorrigido: number;
  jurosMoraPct: number;
  jurosMoraValor: number;
  valorAtualizado: number;
}

export interface ResultadoRevisional {
  nomeCalculo: string | null;
  modalidade: { key: string; label: string; grupo: string };
  taxas: {
    contratoMensalPct: number;
    contratoAnualPct: number;
    referenciaMensalPct: number;
    referenciaAnualPct: number;
    taxaMediaBacenPct: number | null;
    multiplicador: number;
    fonte: string;
    mes: string | null;
    abusivo: boolean;
    excedentePct: number | null;
  };
  config: {
    valorLiberado: number;
    valorParcela: number;
    numeroParcelas: number;
    parcelasPagas: number;
    dataContratacao: string;
    dataBase: string;
    indiceCorrecao: IndiceCorrecao;
    corrigir: boolean;
    dobro: boolean;
    modulacaoStj: boolean;
    jurosMora: number;
  };
  resumo: {
    parcelaContrato: number;
    parcelaRecalculada: number;
    diferencaParcela: number;
    totalContrato: number;
    totalRecalculado: number;
    economiaTotal: number;
    totalPagoAMais: number;
    restituicaoNominal: number;
    restituicaoCorrigida: number;
    restituicaoAtualizada: number;
  };
  linhas: LinhaRevisional[];
}


// ── Auditoria do contrato (upload do PDF) ──────────────────────────────────
export interface ExtracaoContrato {
  /** quem CONTRATOU o crédito — a parte, não o banco */
  cliente: string | null;
  banco: string | null;
  numeroContrato: string | null;
  modalidade: string | null;
  valorFinanciado: number | null;
  valorLiberadoLiquido: number | null;
  valorParcela: number | null;
  numeroParcelas: number | null;
  dataContratacao: string | null;
  primeiroVencimento: string | null;
  taxaMensalContratada: number | null;
  taxaAnualContratada: number | null;
  cetMensalContratado: number | null;
  cetAnualContratado: number | null;
  sistemaAmortizacao: 'price' | 'sac' | null;
  encargos: {
    iof: number | null; tac: number | null; cadastro: number | null;
    seguro: number | null; registro: number | null; avaliacao: number | null; outros: number | null;
  };
  encargosFinanciados: boolean | null;
  comissaoPermanencia: boolean | null;
  observacoes: string | null;
}

export interface DivergenciaTaxa {
  escritaPct: number;
  praticadaPct: number;
  diferencaPp: number;
  excedentePct: number;
}

export interface AuditoriaContrato {
  valorLiberadoLiquido: number;
  encargosTotais: number;
  carenciaDias: number;
  taxaPeriodicaMensalPct: number;
  taxaEfetivaMensalPct: number;
  cetMensalPct: number;
  cetAnualPct: number;
  divergenciaTaxa: DivergenciaTaxa | null;
  divergenciaCet: DivergenciaTaxa | null;
  capitalizacao: {
    mensalContratadaPct: number | null;
    anualContratadaPct: number | null;
    duodecuploPct: number | null;
    anualEquivalentePct: number | null;
    pactuada: boolean | null;
    praticada: boolean;
    fundamento: string;
  };
}

export interface IrregularidadeContrato {
  id: string;
  /** categoria que a UI do card conhece — pode repetir entre achados */
  tipo: string;
  /** rótulo curto e ÚNICO da rubrica (duas tarifas distintas têm o mesmo `tipo`) */
  rubrica?: string;
  valor: string;
  fundamento: string;
  confianca: 'alta' | 'media' | 'baixa';
  /** false = NÃO somar ao proveito: já está dentro do que cada rubrica devolve */
  somavel?: boolean;
}

export interface ExtracaoContratoResposta {
  extraido: ExtracaoContrato;
  auditoria: AuditoriaContrato | null;
  irregularidades: IrregularidadeContrato[];
  resumo: {
    totalCreditos: number;
    confianca: 'alta' | 'media' | 'baixa';
    via: 'texto' | 'visao';
    faltando: string[];
  };
}

export const calculadoraRevisionalService = {
  async listarModalidades(): Promise<Modalidade[]> {
    const { data } = await api.get('/calculadora-revisional/modalidades');
    return data.data ?? data;
  },

  async buscarTaxaMedia(modalidade: string, dataContratacao: string): Promise<TaxaMedia> {
    const { data } = await api.get('/calculadora-revisional/taxa-media', {
      params: { modalidade, data: dataContratacao },
    });
    return data.data ?? data;
  },

  async calcular(input: CalcularRevisionalInput): Promise<ResultadoRevisional> {
    const { data } = await api.post('/calculadora-revisional/calcular', input);
    return data.data ?? data;
  },

  /**
   * Sobe o PDF do contrato: a IA transcreve os campos e o backend audita
   * (taxa escrita × praticada, CET sobre o líquido, capitalização, tarifas).
   * Não grava nada — quem persiste é o card do banco réu no REPB.
   */
  async extrairContrato(pdfBase64: string, nome?: string): Promise<ExtracaoContratoResposta> {
    const { data } = await api.post(
      '/calculadora-revisional/extrair-contrato',
      { pdfBase64, nome },
      { timeout: 240_000 }, // PDF escaneado vai por visão: demora
    );
    return data.data ?? data;
  },
};
