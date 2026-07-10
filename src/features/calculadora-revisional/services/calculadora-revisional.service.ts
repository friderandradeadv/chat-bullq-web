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
};
