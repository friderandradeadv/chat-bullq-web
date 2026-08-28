import { api } from '@/lib/api';

export interface FinMes {
  key: string;
  label: string;
  receita: number;
  despesas: Record<string, number>;
  despesaTotal: number;
  resultado: number;
  acumulado: number;
  aporte?: number; // capital (Você/Pai) — entra no CAIXA REAL, não no faturamento
  acumuladoOperacional?: number; // resultado acumulado SEM aportes = quanto o escritório gerou/queimou
  projecao: boolean;
}
export interface FinCategoria { nome: string; total: number; cor: string }
export interface FinCliente { cliente: string; recebido: number; parcelas: number; ultima: number | null; total: number | null }

export type TxStatus = 'a_receber' | 'recebido' | 'a_pagar' | 'pago';
export type AcessoNivel = 'full' | 'cases' | 'none';
export interface Conta { id: string; nome: string; banco: string; cor?: string; saldoInicial?: number; ativa?: boolean; cartao?: boolean; fechamento?: number; vencimento?: number }
export interface ReconConta { saldoReal: number | null; saldoCalculado: number; diferenca: number | null; nLancamentos: number }
export type CadastroTipo = 'escritorio' | 'fornecedor' | 'socio' | 'cliente' | 'outro';
export interface FinCadastro { id: string; nome: string; tipo: CadastroTipo; doc?: string | null }
export interface SplitItem { tipo: 'escritorio' | 'socio' | 'associado'; userId?: string | null; nome: string; valor: number }
export interface RateioExito { bruto: number; cliente: number; sucumbencia: number; honorarios: number }
export interface FinAnexo { id: string; name: string; mime: string; size: number; key: string; url: string; uploadedById?: string | null; uploadedAt: string }
export interface PrestacaoDados {
  cliente: string; autos: string; reu: string;
  bruto: number; suc: number; hon: number; condenacao: number; liquido: number;
  valorCausa: number | null; sucPct: number | null; honPct: number | null; sucBaseTipo: string | null;
  caseId?: string | null;
  /** Execução PARCIAL: presente só quando o banco depositou menos que o executado e ainda
   *  falta receber. Vem de `case.metadata.execucao`, gravado no import do alvará. */
  execucao?: { totalExecutado: number; recebido: number; remanescente: number } | null;
  anexos: { key: string; url: string; mime: string; name: string }[];
}

/** URL absoluta do anexo (a base da API já termina em /api/v1). */
export function anexoHref(a: FinAnexo): string {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '');
  return `${base}${a.url}`;
}
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
  subtipo?: 'inicial' | 'exito' | null;
  valor: number;
  party: string | null;
  pagador?: string | null;
  recebedor?: string | null;
  status?: TxStatus;
  split?: SplitItem[] | null;
  rateio?: RateioExito | null;
  responsavelId?: string | null;
  responsavel?: string | null;
  conta?: string | null;
  parcela?: string | null;
  manual?: boolean;
  fonteImport?: string | null; // 'extrato' | 'asaas' | 'mercadopago' — veio de import (não é lançamento manual)
  faturaDe?: string | null; // id do cartão de origem (débito que migrou pra conta ao pagar a fatura)
  area?: string | null; // vertical direta do lançamento (centro de custos)
  rateioVerticais?: { area: string; valor: number; label?: string }[] | null; // rateio de despesa entre verticais
  contribuintes?: { userId?: string | null; nome: string; valor: number }[] | null; // contribuição pessoal (quem ajudou a pagar) — informativo, independente do rateio por vertical
  anexos?: FinAnexo[] | null; // boletos/DARF/comprovantes anexados a uma conta a pagar
  caseId?: string | null; // processo vinculado (êxito/alvará/repasse) — interliga com a ficha do cliente
  contactId?: string | null; // cliente vinculado (cadastro)
  obs?: string | null; // observação livre do lançamento (ex.: "repasse via depósito judicial")
  verticais?: string[]; // verticais que o lançamento toca (centro de custos) — vazio = comum/escritório
  vertical?: string | null; // vertical resolvida do lançamento (visão Meu Espaço — p/ filtro das entradas)
  mine?: boolean; // no espelho do livro-razão: true = lançamento seu (casos/custeio); false = movimentação da vertical/transferência que aparece por paridade
  // fatia DESTA pessoa numa despesa rateada (Meu Espaço) — conforme os % do RH (custosPessoa)
  minhaFatiaRateio?: { valor: number; itens: { area: string; label: string | null; base: number; pct: number; valor: number }[] } | null;
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
    caixaContas?: number; // CAIXA REAL = dinheiro nas contas (saldo API ou saldoInicial+movimentos). saldoAtual = saldo calculado (com aportes).
    saldoOperacional?: number; aporteAcumulado?: number; // operacional (sem aportes) × aportes acumulados
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
  cadastros?: FinCadastro[]; // pagadores/recebedores cadastrados (escritório + fornecedores/sócios)
  saldosReais?: Record<string, number>; // saldo real por conta (ASAAS via API, ou âncora do extrato)
  // Reconciliação por conta: saldo real (banco) × saldo calculado pelo livro-razão.
  reconciliacao?: Record<string, { saldoReal: number | null; saldoCalculado: number; diferenca: number | null; nLancamentos: number }>;
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
  casos?: { caseId: string; autor: string | null; reu: string | null; area: string | null; produto: string | null; fase: string | null; cnj: string | null; projeta?: boolean; valorCausa: number; realizacao: number; condenacaoEstimada: number; firmPct: number; escritorioValor: number; minhaPct?: number; liquido: number; exito: number | null }[];
  projecaoCasos?: { pctExito: number; escritorioPadrao: number; fatorRealizacao: number; isSocio?: boolean; brutoEmProcesso: number; condenacaoEstimada: number; escritorioEmProcesso: number; liquidoProvavel: number; nComValor: number; nEstimados?: number; estimado?: boolean; divisao?: { quem: string; eu: boolean; escritorio: boolean; valor: number; pct: number }[] };
  cs?: { prestacao: number; cumprimento: number; cumprimentoNosso?: number; itens: { caseId: string; cliente: string; tipo: string; valor: number; nosso?: number }[] };
  area?: { nome: string; nCasos: number; lancamentos: FinTransacao[]; nLancamentos: number; cs: { prestacao: number; cumprimento: number; cumprimentoNosso: number; itens: { caseId: string; cliente: string; tipo: string; valor: number; nosso?: number }[] }; serie: { mes: string; valor: number }[]; recebido: number; aReceber: number };
  crescimento?: FinCrescimento;
  verticalPnL?: FinVerticalPnL;                 // P&L por vertical (admin/full)
  resultadoVertical?: VerticalPnL | null;       // P&L da vertical do advogado (visão limitada)
  minhaArea?: string | null;
  // FASE B: minha participação = % do RESULTADO da vertical
  minhaVertical?: { itens: { area: string; receita: number; despesa: number; resultado: number; pct: number; minhaParte: number }[]; totalParte: number; configurada: boolean };
  overheadCriterio?: string;
  holerite?: HoleriteMes[];                     // folha do mês (Meu Espaço)
  // Saídas PADRÃO da(s) vertical(is) em que a pessoa atua (custos compartilhados: agência, anúncios). Selecionável no front.
  saidasVerticais?: { area: string; total: number; lancamentos: { data: string; categoria: string; fornecedor: string; valor: number; mes: string; comum?: boolean }[]; porMes: { mes: string; valor: number }[] }[];
}

export interface HoleriteMes {
  mes: string;
  entradas: { cliente: string; valor: number; data: string; area?: string; pct?: number; resultado?: number }[];
  entradaTot: number;
  saidas: { label: string; valor: number; area?: string; linha?: string | null; base?: number; pct?: number; data?: string }[];
  saidaTot: number;
  retiradas: { desc: string; valor: number; data: string }[];
  retiradaTot: number;
  // Contribuição PESSOAL (informativa) — quanto ela cobriu do próprio bolso em despesas
  // este mês. NÃO entra no líquido (não é reembolso, não abate nada) — só exibição.
  contribuicoes?: { desc: string; valor: number; data: string }[];
  contribuicaoTot?: number;
  liquido: number;
}

export interface VerticalCusto { label: string; valor: number }
export interface VerticalMes { mes: string; label: string; entradas: number; inicial: number; exito: number; diretas: number; comum?: number; resultado: number }
export interface VerticalPnL { area: string; nCasos: number; entradas: number; inicial?: number; exito?: number; diretas: number; comum?: number; custos?: VerticalCusto[]; overhead: number; saidas: number; resultado: number; projetado: number; margem: number | null; porMes?: VerticalMes[] }
export interface VerticalBucketMes { mes: string; label: string; valor: number }
export interface FinVerticalPnL {
  verticais: VerticalPnL[];
  comum?: { total: number; porMes: VerticalBucketMes[] };     // custos do escritório (não rateados)
  pessoas?: { total: number; porMes: VerticalBucketMes[] };   // pró-labore/retiradas
  consolidado?: { entradas: number; diretas: number; comum: number; pessoas: number; resultado: number };
  overheadTotal: number; nCasosTotal: number; criterio: string;
}
export interface FinVerticalArea { area: string; receita: number; despesa: number; resultado: number }
export interface FinCrescimento {
  carteira: { brutoCausas: number; condenacaoEstimada: number; honorariosEscritorio: number; nComValor: number; nCasos: number; porArea: { area: string; valor: number }[] };
  verticalArea?: FinVerticalArea[];
  base: { clientesTotal: number; casosTotal: number; serie: { mes: string; novosCasos: number; novosClientes: number; casosAcum: number; clientesAcum: number }[] };
  recorrente: { ativasN: number; saldoDevedor: number; parcelaMensal: number };
  recebiveisCS: number;
  caixaAtual: number;
  receita: { r12m: number; media: number; ult3Media: number; ant3Media: number; cresc3: number };
}

export interface CrescimentoCarteira {
  desde: string; // 'AAAA-MM'
  serie: { mes: string; novos: number; estimados: number; acum: number; momPct: number | null }[];
  resumo: {
    totalProcessos: number;
    comDataDistribuicao: number;
    estimadosPorCnj: number;
    estimadosNaCurva: number;
    preProcessuais: number;
    baseHerdada: number;
    carteiraJan2024: number;
    carteiraHoje: number;
    crescimentoTotalPct: number | null;
    cagrMensalPct: number | null;
    mediaNovosMes: number;
    melhorMes: { mes: string; novos: number } | null;
    clientesTotal: number;
  };
}

export interface Parcela { num: number; vencimento: string; valor: number; status: 'aberta' | 'paga' | 'cancelada'; dataPagamento?: string | null; txId?: string | null; atrasada?: boolean }
export interface Cobranca {
  id: string; cliente: string; descricao?: string;
  valorTotal: number; nParcelas: number; valorParcela: number;
  diaVencimento: number; dataInicio: string;
  responsavelId?: string | null; responsavel?: string | null; conta?: string | null;
  status: 'ativa' | 'quitada' | 'cancelada'; criadoEm: string;
  parcelas: Parcela[];
  asaasId?: string | null; fonte?: string | null;
  // enriquecidos pelo backend
  pago: number; saldoDevedor: number; pagas: number; nAtrasadas: number; valorAtrasado: number;
  proximaParcela: Parcela | null; statusCalc: 'em_dia' | 'atrasada' | 'quitada' | 'cancelada';
}
export interface AddCobrancaInput { cliente: string; descricao?: string; valorTotal: number; nParcelas: number; dataInicio: string; responsavelId?: string; responsavel?: string; conta?: string }

export interface AddTransacaoInput {
  data: string; tipo: 'receita' | 'despesa'; categoria: string; subtipo?: 'inicial' | 'exito'; valor: number;
  party?: string; pagador?: string; recebedor?: string;
  vencimento?: string; dataPagamento?: string; competencia?: string;
  status?: TxStatus; parcelas?: number; intervalo?: 'mensal' | 'anual'; split?: SplitItem[];
  rateio?: RateioExito | null;
  responsavelId?: string; responsavel?: string; conta?: string; area?: string;
  rateioVerticais?: { area: string; valor: number; label?: string }[] | null;
  contribuintes?: { userId?: string; nome: string; valor: number }[] | null;
  caseId?: string; contactId?: string;
}
export interface UpdateTransacaoInput {
  data?: string; vencimento?: string; dataPagamento?: string; competencia?: string;
  tipo?: 'receita' | 'despesa'; categoria?: string; subtipo?: 'inicial' | 'exito'; valor?: number;
  pagador?: string; recebedor?: string; status?: TxStatus; split?: SplitItem[];
  rateio?: RateioExito | null;
  responsavelId?: string; responsavel?: string; conta?: string; area?: string;
  rateioVerticais?: { area: string; valor: number; label?: string }[] | null;
  contribuintes?: { userId?: string; nome: string; valor: number }[] | null;
  escopo?: 'uma' | 'proximas';
}

export interface RepassePendenteItem { txId: string; userId: string; nome: string; valor: number; mes: string; data: string; origem: string; area: string | null }
export interface RepassesPendentes {
  count: number; total: number;
  itens: RepassePendenteItem[];
  porPessoa: { userId: string; nome: string; total: number; count: number }[];
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
  // Financeiro de uma vertical inteira (todos os casos da área) — visão do dono.
  async vertical(area: string): Promise<FinDashboard> {
    const { data } = await api.get('/financeiro/vertical', { params: { area } });
    return data.data ?? data;
  },
  async addTransacao(input: AddTransacaoInput): Promise<{ criados: number; transacoes: FinTransacao[] }> {
    const { data } = await api.post('/financeiro/transacoes', input);
    return data.data ?? data;
  },
  // Lança o honorário de êxito (prestação/cumprimento) do card, vinculado ao processo,
  // com rateio sugerido, como "a receber" — pronto pro sócio conferir e realizar.
  async lancarHonorarioCaso(caseId: string): Promise<{ ok: boolean; valor: number; area: string | null; split: unknown[] | null; transacao: FinTransacao | null }> {
    const { data } = await api.post('/financeiro/lancar-honorario-caso', { caseId });
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
  async repassesPendentes(userId?: string): Promise<RepassesPendentes> {
    const { data } = await api.get('/financeiro/repasses-pendentes', { params: userId ? { userId } : undefined });
    return data.data ?? data;
  },
  async lerConta(base64: string, mime: string, categorias?: string[]): Promise<{ valor: number | null; vencimento: string | null; fornecedor: string | null; categoria: string | null; descricao: string | null; tipoDoc: string | null }> {
    const { data } = await api.post('/financeiro/ler-conta', { base64, mime, categorias }, { timeout: 120000 });
    return data.data ?? data;
  },
  async uploadAnexos(txId: string, files: File[]): Promise<FinAnexo[]> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post(`/financeiro/transacoes/${txId}/anexos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return data.data ?? data;
  },
  async removeAnexo(txId: string, anexoId: string): Promise<FinAnexo[]> {
    const { data } = await api.delete(`/financeiro/transacoes/${txId}/anexos/${anexoId}`);
    return data.data ?? data;
  },
  async repassar(txId: string, userId?: string): Promise<{ repassados: number; total: number }> {
    const { data } = await api.post(`/financeiro/transacoes/${txId}/repassar`, userId ? { userId } : {});
    return data.data ?? data;
  },
  async listContas(): Promise<Conta[]> {
    const { data } = await api.get('/financeiro/contas');
    return data.data ?? data;
  },
  async addConta(input: { nome: string; banco?: string; cor?: string; saldoInicial?: number; cartao?: boolean; fechamento?: number; vencimento?: number }): Promise<Conta> {
    const { data } = await api.post('/financeiro/contas', input);
    return data.data ?? data;
  },
  async pagarFatura(input: { cartaoId: string; contaPagamentoId: string; data: string; txIds?: string[]; categoria?: string }): Promise<{ pago: number; baixados: number }> {
    const { data } = await api.post('/financeiro/fatura/pagar', input);
    return data.data ?? data;
  },
  async reabrirFatura(input: { cartaoId: string; txIds?: string[] }): Promise<{ reabertos: number }> {
    const { data } = await api.post('/financeiro/fatura/reabrir', input);
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
  async criarCobrancaAsaas(input: {
    name: string; cpfCnpj: string; email?: string; phone?: string;
    value: number; dueDate: string;
    billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
    description?: string; parcelas?: number; contactId?: string; caseId?: string;
  }): Promise<{
    ok: boolean; paymentId: string; value: number; dueDate: string; billingType: string;
    invoiceUrl: string | null; bankSlipUrl: string | null;
    pix: { payload?: string; encodedImage?: string } | null;
  }> {
    const { data } = await api.post('/financeiro/integracao/asaas/cobrar', input);
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
  async lerExtratoPdf(base64: string): Promise<{ texto: string }> {
    const { data } = await api.post('/financeiro/extrato/ler-pdf', { base64 }, { timeout: 180000 });
    return data.data ?? data;
  },
  async classificarExtrato(itens: { descricao: string; valor: number }[]): Promise<{ i: number; tipo: 'receita' | 'despesa'; categoria: string; party: string }[]> {
    const { data } = await api.post('/financeiro/conciliacao/classificar', { itens }, { timeout: 180000 });
    return data.data ?? data;
  },
  async extrairExtrato(texto: string): Promise<{ data: string; valor: number; descricao: string }[]> {
    const { data } = await api.post('/financeiro/conciliacao/extrair', { texto }, { timeout: 180000 });
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
  async getPrevisoes(): Promise<FinPrevisoes> {
    const { data } = await api.get('/financeiro/previsoes');
    return data.data ?? data;
  },
  async getSocioConfig(): Promise<SocioConfig> {
    const { data } = await api.get('/financeiro/socio-config');
    return data.data ?? data;
  },
  async getCrescimentoCarteira(): Promise<CrescimentoCarteira> {
    const { data } = await api.get('/crescimento/carteira');
    return data.data ?? data;
  },
  async setSocioConfig(payload: Partial<SocioConfig>): Promise<{ ok: boolean } & SocioConfig> {
    const { data } = await api.patch('/financeiro/socio-config', payload);
    return data.data ?? data;
  },
  // ── Custos diretos por vertical (agência, anúncios…) ──
  async getCustosPessoa(): Promise<{ custosPessoa: Record<string, { area: string; label?: string; pct: number }[]> }> {
    const { data } = await api.get('/financeiro/custos-pessoa');
    return data.data ?? data;
  },
  async setCustosPessoa(custosPessoa: Record<string, { area: string; label?: string; pct: number }[]>): Promise<{ ok: boolean }> {
    const { data } = await api.patch('/financeiro/custos-pessoa', { custosPessoa });
    return data.data ?? data;
  },
  // ── Participação por vertical (Fase B) ──
  async getRemunVertical(): Promise<{ remunVertical: Record<string, { area: string; pct: number }[]> }> {
    const { data } = await api.get('/financeiro/remun-vertical');
    return data.data ?? data;
  },
  async setRemunVertical(remunVertical: Record<string, { area: string; pct: number }[]>): Promise<{ ok: boolean }> {
    const { data } = await api.patch('/financeiro/remun-vertical', { remunVertical });
    return data.data ?? data;
  },
  // ── Cadastro de pagadores/recebedores ──
  async getCadastros(): Promise<FinCadastro[]> {
    const { data } = await api.get('/financeiro/cadastros');
    return data.data ?? data;
  },
  async addCadastro(input: { nome: string; tipo?: CadastroTipo; doc?: string | null }): Promise<{ ok: boolean; cadastro?: FinCadastro }> {
    const { data } = await api.post('/financeiro/cadastros', input);
    return data.data ?? data;
  },
  async updateCadastro(id: string, input: { nome?: string; tipo?: CadastroTipo; doc?: string | null }): Promise<{ ok: boolean }> {
    const { data } = await api.patch(`/financeiro/cadastros/${id}`, input);
    return data.data ?? data;
  },
  async removeCadastro(id: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/financeiro/cadastros/${id}`);
    return data.data ?? data;
  },
  async getVerticalCustos(): Promise<{ verticalCustos: Record<string, VerticalCusto[]> }> {
    const { data } = await api.get('/financeiro/vertical-custos');
    return data.data ?? data;
  },
  async setVerticalCustos(verticalCustos: Record<string, VerticalCusto[]>): Promise<{ ok: boolean; verticalCustos: Record<string, VerticalCusto[]> }> {
    const { data } = await api.patch('/financeiro/vertical-custos', { verticalCustos });
    return data.data ?? data;
  },
  // ── Integração ASAAS (extrato → caixa) ──
  async asaasStatus(): Promise<{ configurado: boolean; ambiente: string }> {
    const { data } = await api.get('/financeiro/integracao/asaas/status');
    return data.data ?? data;
  },
  async asaasPreview(): Promise<AsaasPreview> {
    // Sincronização do ASAAS é pesada (busca muitos pagamentos na API deles). Timeout amplo.
    const { data } = await api.get('/financeiro/integracao/asaas/preview', { timeout: 180000 });
    return data.data ?? data;
  },
  async asaasImportar(): Promise<AsaasPreview> {
    const { data } = await api.post('/financeiro/integracao/asaas/importar', {}, { timeout: 180000 });
    return data.data ?? data;
  },
  // ── Importar extrato (PDF/CSV/OFX) como lançamentos, com dedup ──
  async prestacaoContasPdf(txId: string): Promise<{ pdfBase64: string; nome: string }> {
    const { data } = await api.get(`/financeiro/prestacao-contas/${txId}/pdf`);
    return data.data ?? data;
  },
  async prestacaoDados(txId: string): Promise<PrestacaoDados> {
    const { data } = await api.get(`/financeiro/prestacao-contas/${txId}/dados`);
    return data.data ?? data;
  },
  /**
   * Avisa o cliente no WhatsApp: ganhamos a ação, o alvará foi depositado, manda a
   * prestação de contas em PDF e pede os dados bancários pro repasse. Manda o PDF
   * renderizado AQUI (layout oficial) — sem ele o servidor gera o fallback.
   * Fora da janela de 24h vai como template HSM com o PDF anexado no header.
   */
  async enviarPrestacaoAoCliente(txId: string, pdfBase64?: string): Promise<{ enviado: boolean; motivo?: string; pdfUrl?: string }> {
    const { data } = await api.post(`/financeiro/prestacao-contas/${txId}/enviar-cliente`, { pdfBase64 }, { timeout: 120000 });
    return data.data ?? data;
  },
  // Prepara a prévia (não envia): guarda o PDF, monta o texto sugerido e devolve a conversa do cliente.
  // Se o cliente não tiver contato/conversa, devolve { precisaVincularContato } pro web abrir o picker.
  async prepararPrestacaoRevisao(txId: string, pdfBase64?: string): Promise<{ conversationId: string; texto: string; pdfUrl: string; pdfNome: string } | { precisaVincularContato: true; caseId: string; clienteNome: string | null; motivo: string } | { precisaCadastrarConta: true; caseId: string; clienteNome: string | null; motivo: string }> {
    const { data } = await api.post(`/financeiro/prestacao-contas/${txId}/preparar-revisao`, { pdfBase64 }, { timeout: 120000 });
    return data.data ?? data;
  },
  // Vincula um contato (WhatsApp) à parte CLIENTE do processo — picker no envio da prestação.
  async vincularContatoCliente(caseId: string, contactId: string): Promise<{ ok: boolean; motivo?: string }> {
    const { data } = await api.patch(`/legal-cases/${caseId}/cliente/contato`, { contactId });
    return data.data ?? data;
  },
  // Cadastra a conta do cliente para o repasse (a mensagem CONFIRMA os 4 últimos dígitos, não pede).
  async definirContaCliente(caseId: string, dto: { banco?: string; agencia?: string; conta?: string; tipo?: string; pix?: string }): Promise<{ ok: boolean; comoApareceNaMensagem?: string | null }> {
    const { data } = await api.patch(`/legal-cases/${caseId}/cliente/dados-bancarios`, dto);
    return data.data ?? data;
  },
  // Lê o rascunho preparado (o chat mostra a barra de revisão com o texto + PDF).
  async prestacaoRascunho(txId: string): Promise<{ texto: string; pdfUrl: string; pdfNome: string; conversationId: string; agendarAt: string | null; enviadaEm: string | null } | null> {
    const { data } = await api.get(`/financeiro/prestacao-contas/${txId}/rascunho`);
    return data.data ?? data;
  },
  // Aprova o rascunho: envia agora (envio especializado) ou agenda para uma hora futura.
  async aprovarPrestacao(txId: string, body: { texto?: string; agendarAt?: string }): Promise<{ enviado?: boolean; agendado?: boolean; quando?: string; motivo?: string }> {
    const { data } = await api.post(`/financeiro/prestacao-contas/${txId}/aprovar`, body, { timeout: 120000 });
    return data.data ?? data;
  },
  async rateioSugerido(caseId: string, vertical?: string): Promise<{ vertical: string; responsavelId: string | null; split: Array<{ tipo: 'socio'; userId: string; nome: string; pct: number }> }> {
    const { data } = await api.get('/financeiro/rateio-sugerido', { params: { caseId, ...(vertical ? { vertical } : {}) } });
    return data.data ?? data;
  },
  async conferirExtrato(conta: string | null, linhas: { data: string; valor: number; descricao: string }[]): Promise<ExtratoConferencia> {
    // Extrato grande roda dedup + classificação por IA das despesas → pode passar dos 15s padrão.
    const { data } = await api.post('/financeiro/extrato/importar', { conta, linhas, commit: false }, { timeout: 180000 });
    return data.data ?? data;
  },
  async importarExtratoLinhas(conta: string | null, linhas: { data: string; valor: number; descricao: string; area?: string | null; rateioVerticais?: { area: string; valor: number; label?: string }[]; contribuintes?: { userId?: string; nome: string; valor: number }[]; caseId?: string | null; contactId?: string | null; clienteNome?: string | null; exito?: { bruto: number; cliente: number; sucumbencia: number; honorarios: number; valorCausa?: number; sucumbenciaPct?: number; honorariosPct?: number; sucumbenciaBase?: string; parcial?: boolean; totalExecutado?: number; anexos?: { name: string; mime: string; base64: string }[]; verbas?: { label: string; valor: number; natureza: 'proveito' | 'reembolso_cliente' | 'reembolso_escritorio' | 'sucumbencia_nossa' }[]; deducoesCliente?: { label: string; valor: number; tipo: 'sucumbencia_contraria' | 'despesa_reembolsavel' | 'outro'; cnjIncidente?: string }[]; grupoId?: string; beneficiarioAlvara?: 'cliente' | 'escritorio'; unificar?: boolean } | null; liquidarTxId?: string | null }[], saldoFinal?: number | null): Promise<{ importados: number; duplicados: number; baixados?: number; total: number; reconciliacao?: ReconConta | null }> {
    const { data } = await api.post('/financeiro/extrato/importar', { conta, linhas, commit: true, ...(saldoFinal != null && Number.isFinite(saldoFinal) ? { saldoFinal } : {}) }, { timeout: 180000 });
    return data.data ?? data;
  },
  // Fixa (ou limpa, com saldo=null) o saldo REAL de uma conta e devolve a diferença vs. o razão.
  async setSaldoRealConta(id: string, saldo: number | null): Promise<{ ok: boolean; contaId: string } & ReconConta> {
    const { data } = await api.patch(`/financeiro/contas/${id}/saldo-real`, { saldo });
    return data.data ?? data;
  },
  // ── Cobranças (vendas a prazo) do ASAAS ──
  async asaasCobrancas(commit: boolean): Promise<{ configurado: boolean; novas: number; atualizadas: number; total?: number; forbidden?: boolean }> {
    const { data } = await api.post('/financeiro/integracao/asaas/cobrancas', { commit }, { timeout: 180000 });
    return data.data ?? data;
  },
  // ── Resumo financeiro de um cliente (ficha em Processos) ──
  async clienteResumo(nome: string, contactId?: string | null): Promise<ClienteResumo> {
    const { data } = await api.get('/financeiro/cliente', { params: { nome, ...(contactId ? { contactId } : {}) } });
    return data.data ?? data;
  },
};

export interface ClienteResumo {
  nome: string;
  recebido: number; aReceber: number; ultimoPagamento: string | null;
  nLancamentos: number; saldoCobrancas: number;
  cobrancas: { id: string; descricao?: string; valorTotal: number; saldoDevedor: number; pagas: number; nParcelas: number; statusCalc: string; proximaParcela: { num: number; vencimento: string; valor: number } | null; fonte?: string | null }[];
}

export interface ExtratoLinhaConf { data: string; valor: number; descricao: string; externalId: string; duplicado: boolean; revisar?: boolean; baixaPendente?: boolean; liquidaId?: string | null; motivo: string | null; verticalSugerida?: string; verticalDetectada?: string | null }
export interface ExtratoConferencia { conferido: boolean; total: number; novos: number; duplicados: number; baixarPendentes?: number; revisar?: number; linhas: ExtratoLinhaConf[] }

export interface AsaasPreview {
  configurado: boolean;
  total?: number; novos?: number; atualizados?: number; removidos?: number;
  aReceber?: number; recebido?: number; despesas?: number; saldo?: number | null;
  forbidden?: boolean;
}

/** Previsões da carteira (sócios/admin): valor de causa × probabilidade de êxito. */
export interface FinPrevAg { key: string; n: number; valor: number; esperado: number; exitoMedio: number | null; taxa: number | null }
export interface FinPrevisoes {
  semAcesso?: boolean;
  valorTotal: number; recuperacaoEsperada: number; exitoMedio: number | null;
  favoraveis: number; perdidos: number; extintos?: number; encerrados?: number; emAndamento: number;
  perdidoValor?: number; taxaReal: number | null;
  provaveis: { n: number; valor: number }; ganhosProjetados: number;
  limbo?: { n: number; valor: number; esperado: number; pct: number };
  nCasos: number; nComValor: number;
  porArea: FinPrevAg[]; porTese: FinPrevAg[];
}

/** Divisão dos honorários por DONO do caso: socioSplit[donoUserId][área|'default'][destino: userId|'escritorio'] = %. */
export interface SocioConfig {
  socios: Record<string, boolean>;
  socioSplit: Record<string, Record<string, Record<string, number>>>;
}
