import { api } from '@/lib/api';

export type IndiceCorrecao = 'INPC' | 'IPCA-E' | 'IPCA' | 'IGP-M' | 'SELIC';
export type HonorariosBase = 'debitos' | 'diferenca' | 'fixa';

export interface ItemCsInput {
  tipo?: string;
  descricao: string;
  data: string; // YYYY-MM-DD
  valor: number;
  incideJuros?: boolean;
}

export interface HonorariosCsInput {
  percentual: number;
  base: HonorariosBase;
  quantiaFixa?: number;
  atualizarQuantia?: boolean;
  quantiaData?: string;
}

export interface CalcularCsInput {
  nomeCalculo?: string;
  indiceCorrecao: IndiceCorrecao;
  termoFinal: string;
  proRataDie?: boolean;
  jurosMora?: number;
  jurosCapitalizado?: boolean;
  jurosInicial?: string; // 'vencimento' | YYYY-MM-DD
  multaPct?: number;
  honorarios?: HonorariosCsInput;
  multaMoratoria523?: boolean;
  honorarios523?: boolean;
  debitos: ItemCsInput[];
  creditos?: ItemCsInput[];
}

export interface LinhaCs {
  tipo: string;
  descricao: string;
  data: string;
  valor: number;
  fator: number;
  corrigido: number;
  jurosPct: number;
  juros: number;
  total: number;
}

export interface ResultadoCs {
  nomeCalculo: string | null;
  config: {
    indiceCorrecao: IndiceCorrecao;
    termoFinal: string;
    proRataDie: boolean;
    jurosMora: number;
    jurosCapitalizado: boolean;
    jurosInicial: string;
    multaPct: number;
    honorarios: HonorariosCsInput | null;
    multaMoratoria523: boolean;
    honorarios523: boolean;
  };
  debitos: LinhaCs[];
  creditos: LinhaCs[];
  honorariosBase: number;
  totais: {
    debitosCorrigido: number;
    creditosCorrigido: number;
    principal: number;
    jurosMora: number;
    multa: number;
    honorarios: number;
    multa523Moratoria: number;
    multa523Honorarios: number;
    multa523Total: number;
    totalGeral: number;
  };
}

export interface ExtracaoSentenca {
  nomeCalculo?: string;
  debitos: { descricao: string; data: string; valor: number }[];
  indiceCorrecao: IndiceCorrecao;
  jurosMora?: number;
  jurosInicial?: string;
  honorarios?: { percentual: number; base: HonorariosBase };
  aplicarMulta523?: boolean;
  valorCausa?: number | null;
  observacoes?: string;
}

export const calculadoraCsService = {
  async calcular(input: CalcularCsInput): Promise<ResultadoCs> {
    const { data } = await api.post('/calculadora-cs/calcular', input);
    return data.data ?? data;
  },

  async extrairSentenca(
    files: File[],
  ): Promise<{ extracao: ExtracaoSentenca | null; aviso?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-cs/extrair-sentenca', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // leitura + IA de sentença longa pode passar de 2 min
    });
    return data.data ?? data;
  },
};
