import { api } from '@/lib/api';

export interface FinMes {
  key: string;
  label: string;
  receita: number;
  despesas: Record<string, number>;
  despesaTotal: number;
  resultado: number;
  acumulado: number;
  projecao: boolean;
}
export interface FinCategoria { nome: string; total: number; cor: string }
export interface FinCliente { cliente: string; recebido: number; parcelas: number; ultima: number | null; total: number | null }

export type TxStatus = 'a_receber' | 'recebido' | 'a_pagar' | 'pago';
export type AcessoNivel = 'full' | 'cases' | 'none';
export interface Conta { id: string; nome: string; banco: string; cor?: string; saldoInicial?: number; ativa?: boolean }
export interface SplitItem { tipo: 'escritorio' | 'socio' | 'associado'; userId?: string | null; nome: string; valor: number }
export interface FinTransacao {
  id?: string;
  serieId?: string | null;
  parcelaNum?: number | null;
  parcelaTot?: number | null;
  data: string;
  vencimento?: string | null;
  dataPagamento?: string | null;
  mes: string;
  tipo: string;
  categoria: string;
  valor: number;
  party: string | null;
  pagador?: string | null;
  recebedor?: string | null;
  status?: TxStatus;
  split?: SplitItem[] | null;
  responsavelId?: string | null;
  responsavel?: string | null;
  conta?: string | null;
  parcela?: string | null;
  manual?: boolean;
}
export interface FinInsight { nivel: 'critico' | 'alerta' | 'ok' | 'info'; titulo: string; texto: string }

export interface FinDashboard {
  vazio: boolean;
  geradoEm: string | null;
  fonte?: string | null;
  mesAtual: string | null;
  meses: FinMes[];
  categorias: FinCategoria[];
  despesaTotalGeral?: number;
  kpis: {
    receitaMes: number; despesaMes: number; resultadoMes: number; saldoAtual: number; mesAtualLabel: string;
    receita12m: number; despesa12m: number; resultado12m: number; margem12m: number;
    receitaMedia: number; despesaMediaMensal: number; custoFixoMensal: number;
    mesesNoVermelho: number; totalMesesRealizados: number;
    melhorMes: { label: string; resultado: number } | null;
    piorMes: { label: string; resultado: number } | null;
    maiorReceita: { label: string; receita: number } | null;
  } | null;
  projecao: {
    custoFixoMensal: number; despesaMediaMensal: number; receitaCarteira: number; receitaProx: number; receitaFinalProj: number;
    ticketMedio: number; resultadoProjMedio: number; novaReceitaEquilibrio: number; clientesEquilibrio: number;
    mesesProjetados: number; acumuladoFinalProj: number;
  } | null;
  insights: FinInsight[];
  topClientes: FinCliente[];
  transacoes: FinTransacao[];
  resumoLancamentos?: { total: number; receitas: number; despesas: number; saldo: number };
  categoriasConhecidas?: string[];
  contas?: Conta[];
  acessoMembros?: Record<string, AcessoNivel>;
  // controle de acesso por membro
  nivel?: AcessoNivel;
  limited?: boolean;
  semAcesso?: boolean;
  meuNome?: string;
  resumo?: { recebido: number; aReceber: number; minhaParte: number; nClientes: number; nCasos?: number; nLancamentos: number };
  // visão limitada (advogado) — dados pessoais
  clientes?: { nome: string; recebido: number; n: number; ultimo: string | null }[];
  serie?: { mes: string; valor: number }[];
  melhorMes?: { mes: string; valor: number } | null;
  casos?: { caseId: string; autor: string | null; reu: string | null; area: string | null; produto: string | null; fase: string | null; cnj: string | null; valorCausa: number; realizacao: number; condenacaoEstimada: number; firmPct: number; escritorioValor: number; minhaPct?: number; liquido: number; exito: number | null }[];
  projecaoCasos?: { pctExito: number; escritorioPadrao: number; fatorRealizacao: number; isSocio?: boolean; brutoEmProcesso: number; condenacaoEstimada: number; escritorioEmProcesso: number; liquidoProvavel: number; nComValor: number; divisao?: { quem: string; eu: boolean; escritorio: boolean; valor: number; pct: number }[] };
  cs?: { prestacao: number; cumprimento: number; itens: { caseId: string; cliente: string; tipo: string; valor: number }[] };
}

export interface Parcela { num: number; vencimento: string; valor: number; status: 'aberta' | 'paga' | 'cancelada'; dataPagamento?: string | null; txId?: string | null; atrasada?: boolean }
export interface Cobranca {
  id: string; cliente: string; descricao?: string;
  valorTotal: number; nParcelas: number; valorParcela: number;
  diaVencimento: number; dataInicio: string;
  responsavelId?: string | null; responsavel?: string | null; conta?: string | null;
  status: 'ativa' | 'quitada' | 'cancelada'; criadoEm: string;
  parcelas: Parcela[];
  // enriquecidos pelo backend
  pago: number; saldoDevedor: number; pagas: number; nAtrasadas: number; valorAtrasado: number;
  proximaParcela: Parcela | null; statusCalc: 'em_dia' | 'atrasada' | 'quitada' | 'cancelada';
}
export interface AddCobrancaInput { cliente: string; descricao?: string; valorTotal: number; nParcelas: number; dataInicio: string; responsavelId?: string; responsavel?: string; conta?: string }

export interface AddTransacaoInput {
  data: string; tipo: 'receita' | 'despesa'; categoria: string; valor: number;
  party?: string; pagador?: string; recebedor?: string;
  vencimento?: string; dataPagamento?: string;
  status?: TxStatus; parcelas?: number; intervalo?: 'mensal' | 'anual'; split?: SplitItem[];
  responsavelId?: string; responsavel?: string; conta?: string;
}
export interface UpdateTransacaoInput {
  data?: string; vencimento?: string; dataPagamento?: string;
  tipo?: 'receita' | 'despesa'; categoria?: string; valor?: number;
  pagador?: string; recebedor?: string; status?: TxStatus; split?: SplitItem[];
  responsavelId?: string; responsavel?: string; conta?: string;
  escopo?: 'uma' | 'proximas';
}

export const financeiroService = {
  async dashboard(): Promise<FinDashboard> {
    const { data } = await api.get('/financeiro/dashboard');
    return data.data ?? data;
  },
  async meuFinanceiro(alvoUserId?: string): Promise<FinDashboard> {
    const { data } = await api.get('/financeiro/meu', { params: alvoUserId ? { userId: alvoUserId } : undefined });
    return data.data ?? data;
  },
  async addTransacao(input: AddTransacaoInput): Promise<{ criados: number; transacoes: FinTransacao[] }> {
    const { data } = await api.post('/financeiro/transacoes', input);
    return data.data ?? data;
  },
  async updateTransacao(id: string, input: UpdateTransacaoInput): Promise<{ atualizados: number }> {
    const { data } = await api.patch(`/financeiro/transacoes/${id}`, input);
    return data.data ?? data;
  },
  async removeTransacao(id: string, escopo: 'uma' | 'proximas' = 'uma'): Promise<{ removidos: number }> {
    const { data } = await api.delete(`/financeiro/transacoes/${id}`, { params: { escopo } });
    return data.data ?? data;
  },
  async listContas(): Promise<Conta[]> {
    const { data } = await api.get('/financeiro/contas');
    return data.data ?? data;
  },
  async addConta(input: { nome: string; banco?: string; cor?: string; saldoInicial?: number }): Promise<Conta> {
    const { data } = await api.post('/financeiro/contas', input);
    return data.data ?? data;
  },
  async updateConta(id: string, input: Partial<Conta>): Promise<{ ok: boolean }> {
    const { data } = await api.patch(`/financeiro/contas/${id}`, input);
    return data.data ?? data;
  },
  async removeConta(id: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/financeiro/contas/${id}`);
    return data.data ?? data;
  },
  async getAcesso(): Promise<Record<string, AcessoNivel>> {
    const { data } = await api.get('/financeiro/acesso');
    return data.data ?? data;
  },
  async setAcesso(userId: string, nivel: AcessoNivel): Promise<{ ok: boolean }> {
    const { data } = await api.patch(`/financeiro/acesso/${userId}`, { nivel });
    return data.data ?? data;
  },
  async listCobrancas(): Promise<Cobranca[]> {
    const { data } = await api.get('/financeiro/cobrancas');
    return data.data ?? data;
  },
  async addCobranca(input: AddCobrancaInput): Promise<Cobranca> {
    const { data } = await api.post('/financeiro/cobrancas', input);
    return data.data ?? data;
  },
  async removeCobranca(id: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/financeiro/cobrancas/${id}`);
    return data.data ?? data;
  },
  async pagarParcela(id: string, num: number, dataPagamento?: string): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/financeiro/cobrancas/${id}/parcelas/${num}/pagar`, { dataPagamento });
    return data.data ?? data;
  },
  async desfazerParcela(id: string, num: number): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/financeiro/cobrancas/${id}/parcelas/${num}/desfazer`, {});
    return data.data ?? data;
  },
  async classificarExtrato(itens: { descricao: string; valor: number }[]): Promise<{ i: number; tipo: 'receita' | 'despesa'; categoria: string; party: string }[]> {
    const { data } = await api.post('/financeiro/conciliacao/classificar', { itens });
    return data.data ?? data;
  },
  async getHonorariosPct(): Promise<Record<string, number>> {
    const { data } = await api.get('/financeiro/honorarios-pct');
    return data.data ?? data;
  },
  async setHonorariosPct(userId: string, pct: number): Promise<{ ok: boolean }> {
    const { data } = await api.patch(`/financeiro/honorarios-pct/${userId}`, { pct });
    return data.data ?? data;
  },
  async getEscritorioPct(): Promise<{ padrao: number }> {
    const { data } = await api.get('/financeiro/escritorio-pct');
    return data.data ?? data;
  },
  async setEscritorioPct(pct: number): Promise<{ ok: boolean; padrao: number }> {
    const { data } = await api.patch('/financeiro/escritorio-pct', { pct });
    return data.data ?? data;
  },
  async getFatorRealizacao(): Promise<{ fator: number }> {
    const { data } = await api.get('/financeiro/fator-realizacao');
    return data.data ?? data;
  },
  async setFatorRealizacao(pct: number): Promise<{ ok: boolean; fator: number }> {
    const { data } = await api.patch('/financeiro/fator-realizacao', { pct });
    return data.data ?? data;
  },
};
