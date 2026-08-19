import { api } from '@/lib/api';

export type DepoimentoStatus = 'SUGESTAO' | 'APROVADO' | 'DESCARTADO';
export type DepoimentoOrigem = 'CHAT' | 'IA' | 'MANUAL' | 'GOOGLE';

export interface Depoimento {
  id: string;
  clienteNome: string;
  contactId: string | null;
  partyId: string | null;
  caseId: string | null;
  cnjNumber: string | null;
  area: string | null;
  caso: string | null;
  impacto: string | null;
  resultado: string | null;
  valorRecuperado: number | null;
  mensagem: string;
  mensagemEm: string | null;
  midiaUrl: string | null;
  midiaTipo: string | null;
  /** Foto própria (avaliação do Google, cadastro à mão) — vence o avatar do contato. */
  fotoUrl: string | null;
  origem: DepoimentoOrigem;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  status: DepoimentoStatus;
  destaque: boolean;
  autorizadoDivulgacao: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; name: string | null; avatarUrl: string | null; phone: string | null } | null;
  case?: { id: string; title: string; cnjNumber: string | null; area: string | null; legalPhase: string | null } | null;
  registradoPor?: { id: string; name: string } | null;
}

export interface DepoimentoStats {
  total: number;
  /** Ações com desfecho favorável (vitória conta como história, mesmo sem mensagem). */
  vitorias: number;
  sugestoes: number;
  vidas: number;
  noMes: number;
  /** Soma dos valores citados pelos próprios clientes nos depoimentos. */
  valorCitado: number;
  /** Soma do que já foi repassado aos clientes na prestação de contas. */
  repassadoAosClientes: number;
  porArea: { nome: string; total: number }[];
}

export interface VarreduraResult {
  analisadas: number;
  candidatos: number;
  criados: number;
  /** true = o Gemini confirmou/extraiu; false = só a peneira de palavras. */
  ia: boolean;
  audiosTranscritos: number;
  /** > 0 = ainda há áudio pra transcrever — vale outra rodada. */
  audiosPendentes: number;
  /** true = sobrou trabalho (áudio na fila ou candidato não analisado). */
  maisPorFazer?: boolean;
  depoimentos: Depoimento[];
}

export interface CreateDepoimentoInput {
  clienteNome: string;
  mensagem: string;
  contactId?: string;
  caseId?: string;
  cnjNumber?: string;
  area?: string;
  caso?: string;
  impacto?: string;
  resultado?: string;
  valorRecuperado?: number;
  mensagemEm?: string;
  status?: DepoimentoStatus;
  destaque?: boolean;
  autorizadoDivulgacao?: boolean;
}

export type UpdateDepoimentoInput = Partial<CreateDepoimentoInput> & { caseId?: string | null };

export interface ListDepoimentosQuery {
  status?: DepoimentoStatus | 'TODOS';
  area?: string;
  q?: string;
  caseId?: string;
  contactId?: string;
  destaque?: '1';
}

export const ORIGEM_LABEL: Record<DepoimentoOrigem, string> = {
  CHAT: 'achado no chat',
  IA: 'achado pela IA',
  MANUAL: 'cadastrado à mão',
  GOOGLE: '★ avaliação no Google',
};

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const depoimentosService = {
  async list(query: ListDepoimentosQuery = {}): Promise<Depoimento[]> {
    const { data } = await api.get(`/depoimentos${qs(query)}`);
    return data.data ?? data;
  },
  async stats(): Promise<DepoimentoStats> {
    const { data } = await api.get('/depoimentos/stats');
    return data.data ?? data;
  },
  /** Busca no WhatsApp a foto de quem está no mural sem avatar. */
  async buscarFotos(): Promise<{ tentados: number; comFoto: number; semCanal: number; nomes: string[] }> {
    const { data } = await api.post('/depoimentos/fotos', {}, { timeout: 120_000 });
    return data.data ?? data;
  },
  async varrer(
    input: { dias?: number; limite?: number; transcrever?: number; usarIa?: boolean } = {},
  ): Promise<VarreduraResult> {
    // A varredura é DELIBERADAMENTE longa (transcreve áudio, chama a IA). O
    // timeout global do cliente é 15s — bom pro resto do app, fatal aqui: o
    // navegador abortava antes de o servidor responder. Timeout próprio, com
    // folga sobre o orçamento de tempo do backend.
    const { data } = await api.post('/depoimentos/varrer', input, { timeout: 180_000 });
    return data.data ?? data;
  },
  async create(input: CreateDepoimentoInput): Promise<Depoimento> {
    const { data } = await api.post('/depoimentos', input);
    return data.data ?? data;
  },
  async update(id: string, input: UpdateDepoimentoInput): Promise<Depoimento> {
    const { data } = await api.patch(`/depoimentos/${id}`, input);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/depoimentos/${id}`);
  },
};
