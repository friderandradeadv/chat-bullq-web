import { api } from '@/lib/api';

export type IndiceCorrecao = 'INPC' | 'IPCA-E' | 'IPCA' | 'IGP-M';
export type HonorariosTipo = 'FIXO' | 'PERCENTUAL';

export interface ParcelaInput {
  data: string; // YYYY-MM-DD
  valor: number;
  saque?: number;
}

export interface CalcularRmcInput {
  valorEmprestimo: number;
  taxaConversao: number; // % a.m.
  dobro: boolean;
  indiceCorrecao: IndiceCorrecao;
  dataBase: string; // YYYY-MM-DD
  proRataDie?: boolean;
  jurosMora?: number;
  danosMorais?: number;
  honorariosTipo?: HonorariosTipo;
  honorariosValor?: number;
  nomeCalculo?: string;
  parcelas: ParcelaInput[];
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
  fatorCorrecao: number;
  valorAtualizado: number;
}

export interface ResultadoRmc {
  nomeCalculo: string | null;
  config: {
    valorEmprestimo: number;
    taxaConversao: number;
    dobro: boolean;
    indiceCorrecao: IndiceCorrecao;
    dataBase: string;
    proRataDie: boolean;
  };
  linhas: LinhaEvolucao[];
  resumo: {
    totalDebitado: number;
    somaNominalRestituir: number;
    restituicao: number;
    danosMorais: number;
    honorarios: number;
    total: number;
  };
}

export const calculadoraRmcService = {
  async calcular(input: CalcularRmcInput): Promise<ResultadoRmc> {
    const { data } = await api.post('/calculadora-rmc-rcc/calcular', input);
    return data.data ?? data;
  },
};
