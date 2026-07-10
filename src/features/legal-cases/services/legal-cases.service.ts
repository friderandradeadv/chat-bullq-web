import { api } from '@/lib/api';

export type CaseStatus = 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED' | 'CLOSED';
export type PartyRole =
  | 'CLIENT'
  | 'OPPONENT'
  | 'THIRD_PARTY'
  | 'LAWYER'
  | 'WITNESS';

export interface UserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface PartyInput {
  id?: string;
  name: string;
  role: PartyRole;
  contactId?: string;
  document?: string;
  metadata?: Record<string, unknown>;
}

/** Detalhe do banco réu (REPB), guardado em Party.metadata. */
export interface BancoReuMeta {
  operacao?: string;
  saldoDevedor?: string;
  situacao?: string;
  obs?: string;
}

export interface ConversationRef {
  id: string;
  channelId: string;
  status: string;
}

export interface PartyDetail {
  id: string;
  name: string;
  role: PartyRole;
  document: string | null;
  contactId: string | null;
  metadata?: BancoReuMeta & Record<string, unknown>;
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    metadata?: { cadastro?: { cpf?: string | null; cnpj?: string | null; rg?: string | null; estadoCivil?: string | null; profissao?: string | null; endereco?: string | null } } | null;
    conversations: ConversationRef[];
  } | null;
}

export interface LegalTag {
  id: string; // id do vínculo (EntityTag) — usado pra remover
  tagId: string;
  tag: { id: string; name: string; color: string };
}

export interface CaseListItem {
  id: string;
  cnjNumber: string | null;
  internalCode: string | null;
  title: string;
  court: string | null;
  area: string | null;
  status: CaseStatus;
  value: string | null;
  responsible: UserRef | null;
  parties: { id: string; name: string; contactId: string | null }[];
  _count: { movements: number; deadlines: number };
  updatedAt: string;
  metadata?: { astrea?: { tags?: string[]; instanciaAtual?: string; raw?: Record<string, string> } } | null;
  legalTags: LegalTag[];
}

export interface MovementItem {
  id: string;
  date: string;
  description: string;
  source: string | null;
  createdAt: string;
}

export interface DeadlineRef {
  id: string;
  title: string;
  type: 'FATAL' | 'ORDINARY' | 'INTERNAL';
  status: string;
  dueDate: string;
  safeDate: string;
  assignedTo: UserRef | null;
}

export interface EventRef {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  assignedTo: UserRef | null;
}

export interface PublicationRef {
  id: string;
  publishedAt: string;
  rawContent: string;
  status: string;
  oab: string;
  classification: Record<string, unknown> | null;
}

export interface DocumentRef {
  id: string;
  name: string;
  category: string | null;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  url?: string | null;
}

export interface ContratoImpugnar {
  id: string;
  reu: string;
  doc: string | null;
  produto: string;
  valor: number | null;
}

export interface CaseDetail extends Omit<CaseListItem, 'parties' | '_count'> {
  jurisdiction: string | null;
  legalPhase: string | null;
  legalPhaseAt: string | null;
  distributedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  card: { id: string; pipelineId: string; stageId: string; title: string } | null;
  parties: PartyDetail[];
  movements: MovementItem[];
  deadlines: DeadlineRef[];
  events: EventRef[];
  publications: PublicationRef[];
  documents: DocumentRef[];
}

export interface CreateCaseInput {
  title: string;
  cnjNumber?: string;
  internalCode?: string;
  court?: string;
  jurisdiction?: string;
  area?: string;
  status?: CaseStatus;
  distributedAt?: string;
  value?: number;
  responsibleId?: string;
  parties?: PartyInput[];
}

export interface ListCasesQuery {
  status?: CaseStatus;
  responsibleId?: string;
  area?: string;
  search?: string;
  /** true → só processos com nº CNJ (ajuizados). Esconde leads/pré-judiciais. */
  hasCnj?: boolean;
}

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface KanbanPhase {
  key: string;
  label: string;
  status: CaseStatus;
  order: number;
  slaDias: number;
  fluxo: boolean;
  lane: 'pre' | 'judicial';
  custom?: boolean;
  count: number;
}

// Personalização de fases (org.settings.kanbanPhases).
export interface PhaseCustom { key: string; label: string; lane: 'pre' | 'judicial'; status?: string; slaDias?: number }
export interface PhaseConfig { labels?: Record<string, string>; order?: Record<string, number>; hidden?: string[]; custom?: PhaseCustom[] }
export interface PhaseDefault { key: string; label: string; order: number; lane: 'pre' | 'judicial'; status: string }
export interface PhaseConfigResponse {
  defaults: PhaseDefault[];
  config: PhaseConfig;
  resolved: { key: string; label: string; lane: 'pre' | 'judicial'; order: number; custom: boolean }[];
}
export interface KanbanCard {
  id: string;
  title: string;
  cnj: string | null;
  produto: string | null; // 1ª etiqueta (RMC/BPC-LOAS…)
  areaJuridica: string | null; // 2ª etiqueta (Bancário/Previdenciário…)
  vencemos: string | null; // 'Sim' | 'Não' | 'Parcial' | resultado da sentença → badge
  inssResultado: string | null; // 'deferido' | 'recurso' | 'indeferido' — abas do board do INSS
  tags: { id: string; name: string; color: string }[];
  court: string | null;
  value: number | null;
  status: CaseStatus;
  phase: string;
  slaDias: number;
  dataProtocolo: string | null;
  diasNoProcesso: number | null; // 1º relógio
  diasNaFase: number | null; // 2º relógio
  legalPhaseAt: string | null;
  responsible: UserRef | null;
  client: string | null;
  opponent: string | null;
  proximoPrazo: { id: string; title: string; dueDate: string; type: string } | null;
  ultimoAndamento: { date: string; description: string } | null;
  createdAt: string;
  updatedAt: string;
}
export interface KanbanData {
  phases: KanbanPhase[];
  cards: KanbanCard[];
  // Fotos dos responsáveis DEDUPLICADAS (1 entrada por usuário, não por card): as
  // fotos são data URIs base64 (~14 KB) e repeti-las por card inchava a resposta.
  // O service backfill preenche card.responsible.avatarUrl a partir deste mapa.
  avatars?: Record<string, string | null>;
}

export interface RecursoRow {
  cliente: string | null;
  adversa: string | null;
  processo: string | null;
  numero: string | null;
  recorrente: string | null;
  especie: string | null;
  julgamento: string | null;
  tese: string | null;
  caseId: string | null;
}
export interface ContratoRow {
  cliente: string | null;
  honorarios: string | null;
  dataAssinatura: string | null;
  contratoUrl: string | null;
}

export interface OpponentRow {
  name: string;
  document: string | null;
  casesCount: number;
  totalValue: number;
  areas: string[];
  contactId: string | null;
  avatarUrl: string | null;
  processos: { id: string; cnj: string | null; area: string | null; value: number; cliente: string | null }[];
}

export interface JuriRow {
  id: string;
  cliente: string;
  temProcesso: boolean; // tem nº CNJ (ação ajuizada). false = lead/pré-processual
  area: string;
  assunto: string;
  tribunal: string | null;
  sistema: string;
  fase: string;
  faseLabel: string;
  faseOrder: number;
  lane: 'pre' | 'judicial';
  status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED' | 'CLOSED';
  value: number;
  exito: number | null; // % de êxito estimado
  limbo?: boolean; // execução frustrada (ex.: Contribuições — associações sumiram)
  resultado: 'favoravel' | 'perdido' | 'extinto' | 'encerrado' | 'andamento' | 'limbo';
  resultadoMotivo?: string; // motivo do desfecho (improcedência, extinção, acordo…) lido dos andamentos
  predatoria?: boolean; // flag de advocacia predatória / NUMOPEDE nos andamentos/intimações
  recursoNegado?: boolean; // RESP/RE não conhecido / inadmitido
  emendaInicial?: boolean; // intimação para emendar a inicial (sinal de inicial frágil)
  nMov?: number; // nº de sinais analisados (andamentos + publicações + tarefas)
  honorarios: string | null;
  responsavel: string | null;
  mes: string | null; // YYYY-MM
  ano: number | null;
}
export interface JurimetriaData {
  geradoEm: string;
  rows: JuriRow[];
}

/** Recebíveis de Cumprimento de Sentença (valores preenchidos no card do processo). */
export interface CsBase { caseId: string; title: string; cliente: string | null; cnj: string | null; area: string | null; responsavel: string | null; valorCausa: number | null; legalPhaseAt: string | null }
export interface CsCumprimento extends CsBase { fase: 'cumprimento'; protocolado: boolean; valorCalculo: number; numeroCs: string | null }
export interface CsPrestacao extends CsBase { fase: 'prestacao_contas'; valorAlvara: number; honorariosNossos: number; sucumbencia: number; valorCliente: number; aReceberNosso: number }
export interface CsFavoravel extends CsBase { fase: 'sentenca_favoravel' | 'transito'; resultado: string | null; exito: number | null; estimado: number | null; manualEstimado?: boolean }
export interface CsRepb extends CsBase { fase: 'repb_concluido' | 'repb_acordo'; concluido: boolean; dividaOriginal: number; valorAcordo: number; desconto: number; honorariosNossos: number; aReceberNosso: number }
export interface CumprimentoFinanceiro {
  prestacao: CsPrestacao[];
  cumprimento: CsCumprimento[];
  favoraveis: CsFavoravel[];
  repb?: CsRepb[];
  totais: { nPrestacao: number; aReceberPrestacao: number; nCumprimento: number; brutoEmCumprimento: number; nossoEmCumprimento: number; nFavoraveis: number; estimadoFavoraveis: number; nRepb?: number; aReceberRepb?: number; acordadoRepb?: number };
}

/** Processo do cliente — usado no painel lateral do chat. */
export interface ClientCaseRow {
  id: string;
  cnjNumber: string | null;
  title: string;
  area: string | null;
  produto: string | null;
  legalPhase: string | null;
  faseLabel: string | null;
  lane: 'pre' | 'judicial';
  status: string;
  value: number | null;
  court: string | null;
  responsavel: string | null;
  responsavelId: string | null;
  legalPhaseAt: string | null;
}

export const legalCasesService = {
  async list(query: ListCasesQuery = {}): Promise<CaseListItem[]> {
    const { data } = await api.get(`/legal-cases${qs(query)}`);
    return data.data ?? data;
  },
  async kanban(
    query: { responsibleId?: string; area?: string; search?: string; lane?: 'pre' | 'judicial' | 'banco' | 'plan' | 'repb' } = {},
  ): Promise<KanbanData> {
    const { data } = await api.get(`/legal-cases/kanban${qs(query)}`);
    const kb: KanbanData = data.data ?? data;
    // Backfill da foto do responsável a partir do mapa deduplicado (avatars) — o
    // card lê card.responsible.avatarUrl, então todos os quadros ganham a foto de
    // volta sem mexer no render. Sem o mapa, o card cai nas iniciais (como antes).
    const avatars = kb.avatars;
    if (avatars && Array.isArray(kb.cards)) {
      for (const c of kb.cards) {
        if (c.responsible && c.responsible.avatarUrl == null) {
          c.responsible.avatarUrl = avatars[c.responsible.id] ?? null;
        }
      }
    }
    return kb;
  },
  async opponents(): Promise<OpponentRow[]> {
    const { data } = await api.get('/legal-cases/opponents');
    return data.data ?? data;
  },
  async recursos(): Promise<RecursoRow[]> {
    const { data } = await api.get('/legal-cases/recursos');
    return data.data ?? data;
  },
  async contratos(): Promise<ContratoRow[]> {
    const { data } = await api.get('/legal-cases/contratos');
    return data.data ?? data;
  },
  async casesByContact(contactId: string): Promise<{ cases: ClientCaseRow[] }> {
    const { data } = await api.get(`/legal-cases/by-contact/${contactId}`);
    return data.data ?? data;
  },
  async jurimetria(): Promise<JurimetriaData> {
    const { data } = await api.get('/legal-cases/jurimetria');
    return data.data ?? data;
  },
  async cumprimentoFinanceiro(): Promise<CumprimentoFinanceiro> {
    const { data } = await api.get('/legal-cases/cumprimento-financeiro');
    return data.data ?? data;
  },
  async movePhase(id: string, phase: string): Promise<{ ok: boolean; phase: string }> {
    const { data } = await api.patch(`/legal-cases/${id}/phase`, { phase });
    return data.data ?? data;
  },
  // Registrar recurso a partir de um prazo: conclui o prazo, move o card p/ RECURSO
  // e cria/preenche o registro na aba Recursos (espécie/quem recorreu/motivo).
  async registrarRecurso(input: {
    deadlineId: string;
    especie?: string;
    parteRecorrente?: 'CLIENTE' | 'ADVERSA';
    motivo?: string;
    confirmFatal?: boolean;
  }): Promise<{ ok: boolean; phase: string; recursoId: string | null; aviso?: { enviado: boolean; motivo?: string } | null }> {
    const { data } = await api.post('/legal-cases/recurso/registrar', input);
    return data.data ?? data;
  },
  // Verifica se o cliente do card já tem ação em curso (nome/CPF, fonte DJEN/Escavador).
  // Grava o resultado em metadata.acoesExistentes e deixa nota interna. Usar ANTES de montar a inicial.
  async verificarAcoesExistentes(id: string): Promise<{
    encontrou: boolean;
    confianca: 'alta' | 'media' | 'nenhuma';
    fonte: string;
    acoes: Array<{ numeroProcesso: string; tribunal: string; orgao: string; tipo: string; data: string; temCpf: boolean }>;
    totalBruto: number;
  }> {
    const { data } = await api.post(`/legal-cases/${id}/verificar-acoes`);
    return data.data ?? data;
  },
  // IA lê a sentença do prazo e sugere o motivo do recurso (1-2 frases).
  async sugerirMotivoRecurso(deadlineId: string): Promise<{ motivo: string }> {
    const { data } = await api.post('/legal-cases/recurso/sugerir-motivo', { deadlineId });
    return data.data ?? data;
  },
  // Kanban vivo: conclui um prazo (nossa petição) e avança o card para targetPhase.
  async avancarPrazo(input: { deadlineId: string; targetPhase: string; confirmFatal?: boolean }): Promise<{ ok: boolean; phase: string; aviso?: { enviado: boolean; motivo?: string } | null }> {
    const { data } = await api.post('/legal-cases/prazo/avancar', input);
    return data.data ?? data;
  },
  // Kanban vivo com preenchimento: avança (por prazo OU botão no card) e grava os
  // campos da fase (cumprimento/prestação/trânsito) — que alimentam Financeiro/Meu Espaço.
  async avancarFaseComCampos(input: { deadlineId?: string; caseId?: string; targetPhase: string; campos?: Record<string, unknown>; confirmFatal?: boolean }): Promise<{ ok: boolean; phase: string; aviso?: { enviado: boolean; motivo?: string } | null }> {
    const { data } = await api.post('/legal-cases/fase/avancar-com-campos', input);
    return data.data ?? data;
  },
  // Sugere os campos de uma fase a partir do cálculo/valor/resultado do processo.
  async avancoSugestao(caseId: string, phase: string): Promise<{ campos: Record<string, unknown>; honorariosPct?: number }> {
    const { data } = await api.get(`/legal-cases/${caseId}/avanco-sugestao`, { params: { phase } });
    return data.data ?? data;
  },
  async updateChecklist(id: string, items: Record<string, boolean>): Promise<{ ok: boolean; checklist: Record<string, boolean> }> {
    const { data } = await api.patch(`/legal-cases/${id}/checklist`, { items });
    return data.data ?? data;
  },
  async saveFaseField(id: string, phase: string, key: string, value: unknown): Promise<{ ok: boolean }> {
    const { data } = await api.patch(`/legal-cases/${id}/fase-field`, { phase, key, value });
    return data.data ?? data;
  },
  async protocolar(
    id: string,
    input: { cnj?: string; value?: number; dataProtocolo?: string; court?: string; jurisdiction?: string },
  ): Promise<{ ok: boolean; phase: string; aviso?: { enviado: boolean; motivo?: string } }> {
    const { data } = await api.patch(`/legal-cases/${id}/protocolar`, input);
    return data.data ?? data;
  },
  // Renomeia uma fase do kanban (só OWNER — o backend valida o papel).
  async renamePhaseLabel(key: string, label: string): Promise<{ key: string; label: string }> {
    const { data } = await api.patch(`/legal-cases/phases/${key}/label`, { label });
    return data.data ?? data;
  },
  // Personalização de fases (renomear/reordenar/esconder/adicionar).
  async getPhaseConfig(): Promise<PhaseConfigResponse> {
    const { data } = await api.get('/legal-cases/phases/config');
    return data.data ?? data;
  },
  async savePhaseConfig(config: PhaseConfig): Promise<PhaseConfigResponse> {
    const { data } = await api.patch('/legal-cases/phases/config', config);
    return data.data ?? data;
  },
  // Criar/excluir fase inline no kanban (só sócios — gate no backend).
  async addPhase(board: 'pre' | 'banco' | 'plan' | 'repb' | 'judicial', label: string): Promise<PhaseConfigResponse> {
    const { data } = await api.post('/legal-cases/phases', { board, label });
    return data.data ?? data;
  },
  async deletePhase(key: string): Promise<PhaseConfigResponse & { mode?: 'deleted' | 'hidden' }> {
    const { data } = await api.delete(`/legal-cases/phases/${key}`);
    return data.data ?? data;
  },
  async get(id: string): Promise<CaseDetail> {
    const { data } = await api.get(`/legal-cases/${id}`);
    return data.data ?? data;
  },
  async create(input: CreateCaseInput): Promise<CaseDetail> {
    const { data } = await api.post('/legal-cases', input);
    return data.data ?? data;
  },
  async update(id: string, input: Partial<CreateCaseInput>): Promise<CaseDetail> {
    const { data } = await api.patch(`/legal-cases/${id}`, input);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/legal-cases/${id}`);
  },
  /** Ações em massa na aba Processos (seleção). 'delete' = arquivar (lixeira). */
  async bulk(payload: {
    ids: string[];
    action: 'delete' | 'status' | 'responsible';
    status?: CaseStatus;
    responsibleId?: string;
  }): Promise<{ ok: boolean; count: number }> {
    const { data } = await api.post('/legal-cases/bulk', payload);
    return data.data ?? data;
  },
  async resumoAtendimento(id: string): Promise<{ resumo: string; geradoEm: string }> {
    const { data } = await api.post(`/legal-cases/${id}/resumo-atendimento`);
    return data.data ?? data;
  },
  async addParty(caseId: string, input: PartyInput): Promise<PartyDetail> {
    const { data } = await api.post(`/legal-cases/${caseId}/parties`, input);
    return data.data ?? data;
  },
  async updateParty(partyId: string, input: Partial<PartyInput>): Promise<PartyDetail> {
    const { data } = await api.patch(`/legal-cases/parties/${partyId}`, input);
    return data.data ?? data;
  },
  async removeParty(partyId: string): Promise<void> {
    await api.delete(`/legal-cases/parties/${partyId}`);
  },
  async addMovement(
    caseId: string,
    input: { date: string; description: string },
  ): Promise<MovementItem> {
    const { data } = await api.post(`/legal-cases/${caseId}/movements`, input);
    return data.data ?? data;
  },
  async saveContratos(
    id: string,
    contratos: { id?: string; reu: string; doc?: string | null; produto: string; valor?: number | null }[],
  ): Promise<{ ok: boolean; contratos: ContratoImpugnar[] }> {
    const { data } = await api.patch(`/legal-cases/${id}/contratos`, { contratos });
    return data.data ?? data;
  },
  async sugerirContratos(id: string): Promise<{ contratos: ContratoImpugnar[] }> {
    const { data } = await api.post(`/legal-cases/${id}/contratos/sugerir`);
    return data.data ?? data;
  },
  /** IA sugere polo passivo/produto/área/valor da conversa (intake genérico, não-RMC). */
  async sugerirDadosCaso(id: string): Promise<{
    reu: string | null;
    documentoReu: string | null;
    produto: string | null;
    area: string | null;
    valorCausa: number | null;
    resumo: string | null;
  }> {
    const { data } = await api.post(`/legal-cases/${id}/sugerir-dados`);
    return data.data ?? data;
  },
  /** Upload de HISCON (PDF base64) → IA extrai os contratos RMC/RCC ativos. */
  async uploadHiscon(id: string, pdfBase64: string): Promise<{ contratos: ContratoImpugnar[]; contratosCount: number }> {
    const { data } = await api.post(`/legal-cases/${id}/contratos/hiscon`, { pdfBase64 });
    return data.data ?? data;
  },
  /** Upload de HISCRE (PDF base64) → IA extrai consignações RMC/RCC (complementar; mescla pra revisão). */
  async uploadHiscre(id: string, pdfBase64: string): Promise<{ contratos: ContratoImpugnar[]; contratosCount: number }> {
    const { data } = await api.post(`/legal-cases/${id}/contratos/hiscre`, { pdfBase64 });
    return data.data ?? data;
  },
  /** Desmembra o intake em N cards (1 por banco réu) → fase-destino escolhida. */
  async gerarIniciais(
    id: string,
    destino?: 'info_faltantes' | 'montar_inicial',
  ): Promise<{ ok: boolean; criados: number; filhos: { id: string; title: string; reu: string; produto: string }[] }> {
    const { data } = await api.post(`/legal-cases/${id}/gerar-iniciais`, destino ? { destino } : {});
    return data.data ?? data;
  },
  /** Upload do JG (PDF base64) → IA extrai líquido/anual para a justiça gratuita. */
  async uploadJg(id: string, pdfBase64: string): Promise<{ ok: boolean; jg: { liquido: number | null; anual: number | null; media: number | null } }> {
    const { data } = await api.post(`/legal-cases/${id}/jg`, { pdfBase64 });
    return data.data ?? data;
  },
  /** Gera a petição inicial de RMC/RCC (base no timbrado preenchida) → .docx base64. */
  async gerarInicial(
    id: string,
    produto?: string,
  ): Promise<{ base: string; fileName: string; valorCausa: number; documentId: string; docxBase64: string }> {
    const { data } = await api.post(`/legal-cases/${id}/inicial/gerar${produto ? `?produto=${encodeURIComponent(produto)}` : ''}`);
    return data.data ?? data;
  },
  /** Gera por IA uma peça (réplica/especificação de provas/recurso) sobre o timbrado → .docx base64. */
  async gerarPeca(
    id: string,
    payload: {
      tipo: 'replica' | 'especificacao' | 'recurso' | 'superendividamento' | 'parecer';
      produto?: string;
      docBase64?: string;
      docNome?: string;
      docsBase64?: string[];
      docsNomes?: string[];
      instrucoes?: string;
    },
  ): Promise<{ tipo: string; label: string; fileName: string; documentId: string; docxBase64: string }> {
    // A IA lê os documentos (podem ser vários/grandes) e redige a peça inteira —
    // leva 1–2 min. O `api` tem timeout GLOBAL de 15s (curto demais): sem
    // sobrescrever, o navegador abortava e mostrava "Erro" mesmo com a peça já
    // gerada e anexada no backend. 240s cobre com folga.
    const { data } = await api.post(`/legal-cases/${id}/peca/gerar`, payload, { timeout: 240_000 });
    return data.data ?? data;
  },
  /** Salva no processo o cálculo de RMC/RCC escolhido (e define o valor da causa). */
  async salvarCalculo(
    id: string,
    payload: {
      cenario: string;
      cenarioTitulo?: string;
      total: number;
      resumo?: Record<string, any>;
      config?: Record<string, any>;
      metodoLabel?: string;
      linhas?: any[];
      definirValorCausa?: boolean;
    },
  ): Promise<{ ok: boolean; calculo: any }> {
    const { data } = await api.post(`/legal-cases/${id}/calculo`, payload);
    return data.data ?? data;
  },
  /** Remove (soft-delete) um anexo do card. */
  async removeDocument(id: string, docId: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/legal-cases/${id}/documents/${docId}`);
    return data.data ?? data;
  },
  /** Sobe os anexos do card para a pasta do cliente no Google Drive. */
  async uploadDocsToDrive(id: string): Promise<{ ok: boolean; uploaded: number; webViewLink: string }> {
    const { data } = await api.post(`/legal-cases/${id}/drive/upload`);
    return data.data ?? data;
  },
  async organizarPastaInicial(id: string): Promise<{
    ok: boolean;
    pastaBanco: string;
    webViewLink: string;
    copiados: string[];
    enviados: string[];
    incluirRenuncia: boolean;
  }> {
    const { data } = await api.post(`/legal-cases/${id}/drive/organizar-inicial`);
    return data.data ?? data;
  },
  async sugerirCadastroCliente(id: string): Promise<{
    ok: boolean;
    cadastro: Record<string, string>;
    preenchidos: string[];
  }> {
    const { data } = await api.post(`/legal-cases/${id}/cadastro/sugerir`);
    return data.data ?? data;
  },
};
