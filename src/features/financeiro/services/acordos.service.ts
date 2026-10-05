import { api } from '@/lib/api';

/**
 * ACORDO do processo — o terceiro caminho do dinheiro, ao lado do cumprimento de
 * sentença e da prestação de contas, e o único que vem PARCELADO.
 *
 * O servidor é a fonte da conta: o painel manda os termos (valor, parcelas, dia de
 * vencimento, divisão, parceiros) e recebe de volta o cronograma e a divisão já
 * calculados. Nada de recalcular aqui — duas contas para o mesmo acordo dariam dois
 * números, e o que vale é o que entra no livro-razão.
 */

export interface AcordoParcela {
  num: number;
  vencimento: string;            // DD/MM/YYYY
  valor: number;
  status: 'aberta' | 'recebida' | 'cancelada';
  entrada?: boolean;
  dataPagamento?: string | null;
  txId?: string | null;          // lançamento do honorário — é dele que sai a prestação de contas
  txIdCliente?: string | null;
  txIdRepasse?: string | null;
  txIdReembolso?: string | null;
  obs?: string | null;
}

export interface AcordoRepasse {
  tipo: 'parceiro' | 'socio' | 'associado';
  nome: string;
  userId?: string | null;
  pct?: number | null;
  valor?: number | null;
  partnershipId?: string | null;
}

export interface Acordo {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  valorTotal: number;
  forma: 'avista' | 'parcelado';
  nParcelas: number;
  diaVencimento: number | null;
  dataPrimeira: string;
  entrada: number;
  dataEntrada?: string | null;
  tipo: 'judicial' | 'extrajudicial';
  homologado: 'Sim' | 'Não' | 'Aguardando' | null;
  dataHomologacao?: string | null;
  dataAcordo?: string | null;
  pagador?: string | null;
  obrigacoes?: string | null;
  multaAtraso?: number | null;
  vencimentoAntecipado?: boolean;
  obs?: string | null;
  honorariosPct: number | null;
  honorarios: number;
  sucumbencia: number;
  reembolsoEscritorio: number;
  retencoes: number;
  clienteRecebeuDireto?: boolean;
  conta?: string | null;
  parceria?: { id: string; nome: string; partnerPct: number } | null;
  repasses: AcordoRepasse[];
  parcelas: AcordoParcela[];
  cancelado?: boolean;
  canceladoMotivo?: string | null;
}

export interface AcordoDivisao {
  bruto: number;
  proveito: number;
  honorariosPct: number;
  honorarios: number;
  sucumbencia: number;
  reembolsoEscritorio: number;
  retencoes: number;
  clienteBruto: number;
  clienteLiquido: number;
  nosso: number;
  repasses: Array<AcordoRepasse & { valorCalculado: number }>;
  escritorio: number;
  /** Art. 50 do CED: o escritório não pode ficar com mais que o cliente. */
  excedeCliente: boolean;
}

export interface AcordoEstado {
  recebido: number;
  aReceber: number;
  atrasado: number;
  nParcelasTotal: number;
  nRecebidas: number;
  nAtrasadas: number;
  proximaParcela: AcordoParcela | null;
  status: 'ativo' | 'inadimplente' | 'quitado' | 'cancelado';
}

export interface AcordoPainel {
  caseId: string;
  cliente: string | null;
  reu: string | null;
  cnj: string | null;
  area: string | null;
  fase: string | null;
  faseLabel: string | null;
  acordo: Acordo | null;
  divisao: AcordoDivisao | null;
  estado: AcordoEstado | null;
  contexto: {
    honorariosPctSugerido: number;
    parceria: { id: string; nome: string; partnerPct: number; membros: Array<{ nome: string; userId: string | null; pct: number | null }> } | null;
    splitSugerido: Array<{ tipo: 'socio'; userId: string; nome: string; pct: number }>;
    contas: Array<{ id: string; nome: string }>;
    podeLancar: boolean;
  };
  movido?: boolean;
}

export interface AcordoResumo {
  caseId: string;
  title: string;
  cliente: string | null;
  reu: string | null;
  cnj: string | null;
  area: string | null;
  responsavel: string | null;
  fase: string | null;
  faseLabel: string | null;
  valorTotal: number;
  forma: 'avista' | 'parcelado';
  nParcelas: number;
  homologado: Acordo['homologado'];
  parceriaNome: string | null;
  nosso: number;
  escritorio: number;
  repasseParceiros: number;
  clienteLiquido: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  nAtrasadas: number;
  nossoAReceber: number;
  proximoVencimento: string | null;
  proximoValor: number | null;
  status: AcordoEstado['status'];
}

export interface AcordoTotais {
  n: number;
  nAtivos: number;
  nQuitados: number;
  nInadimplentes: number;
  acordado: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  nossoAReceber: number;
  repasseParceiros: number;
}

export interface SalvarAcordoInput {
  valorTotal: number;
  forma?: 'avista' | 'parcelado';
  nParcelas?: number;
  diaVencimento?: number | null;
  dataPrimeira?: string;
  entrada?: number;
  dataEntrada?: string | null;
  tipo?: 'judicial' | 'extrajudicial';
  homologado?: 'Sim' | 'Não' | 'Aguardando' | null;
  dataHomologacao?: string | null;
  dataAcordo?: string | null;
  pagador?: string | null;
  obrigacoes?: string | null;
  multaAtraso?: number | null;
  vencimentoAntecipado?: boolean;
  obs?: string | null;
  honorariosPct?: number | null;
  honorarios?: number;
  sucumbencia?: number;
  reembolsoEscritorio?: number;
  retencoes?: number;
  clienteRecebeuDireto?: boolean;
  conta?: string | null;
  repasses?: AcordoRepasse[];
  mover?: boolean;
}

const unwrap = <T,>(data: any): T => (data?.data ?? data) as T;

export const acordosService = {
  /** Acordos do escritório inteiro — aba CS do Financeiro. */
  async listar(): Promise<{ acordos: AcordoResumo[]; totais: AcordoTotais }> {
    const { data } = await api.get('/financeiro/acordos');
    return unwrap(data);
  },
  /** Acordo de um processo + contexto para preencher (painel do card). */
  async painel(caseId: string): Promise<AcordoPainel> {
    const { data } = await api.get(`/financeiro/acordos/${caseId}`);
    return unwrap(data);
  },
  async salvar(caseId: string, dto: SalvarAcordoInput): Promise<AcordoPainel> {
    const { data } = await api.put(`/financeiro/acordos/${caseId}`, dto);
    return unwrap(data);
  },
  /** Parcela recebida: lança no razão (honorário + parte do cliente + repasse a pagar). */
  async receberParcela(
    caseId: string,
    num: number,
    dto: { dataPagamento?: string; valor?: number; conta?: string | null; obs?: string | null },
  ): Promise<{ ok: boolean; parcela: AcordoParcela; estado: AcordoEstado; quitado: boolean; lancamentos: { txIdNosso: string | null; txIdCliente: string | null; txIdRepasse: string | null; txIdReembolso: string | null } }> {
    const { data } = await api.post(`/financeiro/acordos/${caseId}/parcelas/${num}/receber`, dto);
    return unwrap(data);
  },
  async estornarParcela(caseId: string, num: number): Promise<{ ok: boolean; removidos: number; estado: AcordoEstado }> {
    const { data } = await api.post(`/financeiro/acordos/${caseId}/parcelas/${num}/estornar`, {});
    return unwrap(data);
  },
  async cancelar(caseId: string, motivo?: string | null): Promise<{ ok: boolean; estado: AcordoEstado }> {
    const { data } = await api.post(`/financeiro/acordos/${caseId}/cancelar`, { motivo: motivo ?? null });
    return unwrap(data);
  },
  async excluir(caseId: string): Promise<{ ok: boolean; removido: boolean }> {
    const { data } = await api.delete(`/financeiro/acordos/${caseId}`);
    return unwrap(data);
  },
};
