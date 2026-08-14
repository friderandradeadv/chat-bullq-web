import { api } from '@/lib/api';

/**
 * Filtra só PDFs (o backend não lê .docx) e corta em `max` (o multer aceita no
 * máx. 8). Devolve os arquivos prontos + quantos foram ignorados/cortados, para
 * a UI avisar. Evita o erro "Unexpected field - files" ao arrastar a pasta toda.
 */
export function prepararPdfs(
  files: File[] | FileList | null,
  max = 8,
): { arr: File[]; naoPdf: number; cortados: number } {
  const todos = files ? Array.from(files) : [];
  const pdfs = todos.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  return { arr: pdfs.slice(0, max), naoPdf: todos.length - pdfs.length, cortados: Math.max(0, pdfs.length - max) };
}

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
  /** restituição em dobro (CDC 42, §ún.)? — casos de consumo/RMC/RCC */
  dobro?: boolean | null;
  /** modulação do Tema 929 STJ (dobro só ≥ 30/03/2021)? */
  modulacaoStj?: boolean | null;
  /** tutela p/ suspender os descontos foi deferida? (false → descontos continuaram) */
  tutelaDeferida?: boolean | null;
  /** data em que a sentença foi proferida */
  dataSentenca?: string | null;
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

  // Lê a petição de cumprimento de sentença (PDF) e extrai o valor exequendo + nº dos autos.
  async extrairCumprimento(
    files: File[],
  ): Promise<{ valorCalculo: number | null; numeroCs: string | null; aviso?: string }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-cs/extrair-cumprimento', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },

  // Lê os documentos da Prestação de Contas (alvará + eventual sentença/contrato) e
  // sugere os valores da fase: valor bruto, % de honorários e sucumbência.
  async extrairAlvara(
    files: File[],
  ): Promise<{
    valorAlvara: number | null;
    honorariosPct: number | null;
    sucumbencia: 'Sim' | 'Não' | null;
    sucumbenciaModo: 'Valor fixo' | 'Percentual' | null;
    sucumbenciaPct: number | null;
    sucumbenciaBase: string | null;
    sucumbenciaBaseValor: number | null;
    valorSucumbencia: number | null;
    cliente: string | null;
    cnj: string | null;
    aviso?: string;
  }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post('/calculadora-cs/extrair-alvara', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return data.data ?? data;
  },

  // Correção monetária de um valor (ex.: valor da causa) de uma data até hoje.
  async corrigirValor(input: { valor: number; data: string; indice: string }): Promise<{
    valorCorrigido: number; fator: number; indice: string; de: string; ate: string;
  }> {
    const { data } = await api.post('/calculadora-cs/corrigir-valor', input);
    return data.data ?? data;
  },
};
