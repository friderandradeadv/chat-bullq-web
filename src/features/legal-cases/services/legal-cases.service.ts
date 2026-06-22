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
  count: number;
}
export interface KanbanCard {
  id: string;
  title: string;
  cnj: string | null;
  produto: string | null; // 1ª etiqueta (RMC/BPC-LOAS…)
  areaJuridica: string | null; // 2ª etiqueta (Bancário/Previdenciário…)
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
  updatedAt: string;
}
export interface KanbanData {
  phases: KanbanPhase[];
  cards: KanbanCard[];
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

export const legalCasesService = {
  async list(query: ListCasesQuery = {}): Promise<CaseListItem[]> {
    const { data } = await api.get(`/legal-cases${qs(query)}`);
    return data.data ?? data;
  },
  async kanban(
    query: { responsibleId?: string; area?: string; search?: string } = {},
  ): Promise<KanbanData> {
    const { data } = await api.get(`/legal-cases/kanban${qs(query)}`);
    return data.data ?? data;
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
  async movePhase(id: string, phase: string): Promise<{ ok: boolean; phase: string }> {
    const { data } = await api.patch(`/legal-cases/${id}/phase`, { phase });
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
  ): Promise<{ ok: boolean; phase: string }> {
    const { data } = await api.patch(`/legal-cases/${id}/protocolar`, input);
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
  async addParty(caseId: string, input: PartyInput): Promise<PartyDetail> {
    const { data } = await api.post(`/legal-cases/${caseId}/parties`, input);
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
};
