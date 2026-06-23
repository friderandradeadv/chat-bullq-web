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
export interface FinTransacao { id?: string; data: string; mes: string; tipo: string; categoria: string; valor: number; party: string | null; parcela?: string | null; manual?: boolean }
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
}

export interface AddTransacaoInput { data: string; tipo: 'receita' | 'despesa'; categoria: string; valor: number; party?: string }

export const financeiroService = {
  async dashboard(): Promise<FinDashboard> {
    const { data } = await api.get('/financeiro/dashboard');
    return data.data ?? data;
  },
  async addTransacao(input: AddTransacaoInput): Promise<FinTransacao> {
    const { data } = await api.post('/financeiro/transacoes', input);
    return data.data ?? data;
  },
  async removeTransacao(id: string): Promise<{ removidos: number }> {
    const { data } = await api.delete(`/financeiro/transacoes/${id}`);
    return data.data ?? data;
  },
};
