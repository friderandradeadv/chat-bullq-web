import { api } from '@/lib/api';

export type DeadlineType = 'FATAL' | 'ORDINARY' | 'INTERNAL';
export type DeadlineStatus = 'OPEN' | 'DONE' | 'EXPIRED' | 'CANCELLED';

export interface Deadline {
  id: string;
  caseId: string;
  title: string;
  type: DeadlineType;
  status: DeadlineStatus;
  dueDate: string;
  safeDate: string;
  triggerDate: string | null;
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
  case: { id: string; title: string; cnjNumber: string | null } | null;
  createdAt: string;
  metadata?: {
    djen?: { descricao?: string; tipoPublicacao?: string; prazoFatal?: string; prazoSeguranca?: string; recorte?: string; faseMovida?: { de: string; para: string }; dispositivo?: string };
  } & Record<string, any>;
}

export interface CreateDeadlineInput {
  caseId: string;
  title: string;
  type?: DeadlineType;
  assignedToId?: string;
  // modo explícito
  dueDate?: string;
  safeDate?: string;
  // modo calculado
  dias?: number;
  publicacao?: string;
  disponibilizacao?: string;
  inicio?: string;
  dobro?: boolean;
  corridos?: boolean;
  bufferDiasUteis?: number;
  triggerDate?: string;
  status?: DeadlineStatus; // permite reabrir (OPEN) / reordenar status via update
}

export interface PreviewPrazoInput {
  dias: number;
  publicacao?: string;
  disponibilizacao?: string;
  inicio?: string;
  dobro?: boolean;
  corridos?: boolean;
  bufferDiasUteis?: number;
}

export interface PrazoPreview {
  dataFatal: string;
  prazoSeguranca: string;
  inicioContagem: string;
  dias: number;
  modo: string;
  dobro: boolean;
  passos: string[];
}

export interface ListDeadlinesQuery {
  status?: DeadlineStatus;
  assignedToId?: string;
  caseId?: string;
  withinDays?: number;
}

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const deadlinesService = {
  async list(query: ListDeadlinesQuery = {}): Promise<Deadline[]> {
    const { data } = await api.get(`/deadlines${qs(query)}`);
    return data.data ?? data;
  },
  async preview(input: PreviewPrazoInput): Promise<PrazoPreview> {
    const { data } = await api.post('/deadlines/preview', input);
    return data.data ?? data;
  },
  async create(input: CreateDeadlineInput): Promise<Deadline> {
    const { data } = await api.post('/deadlines', input);
    return data.data ?? data;
  },
  async update(id: string, input: Partial<CreateDeadlineInput>): Promise<Deadline> {
    const { data } = await api.patch(`/deadlines/${id}`, input);
    return data.data ?? data;
  },
  async complete(id: string, confirmFatal = false): Promise<Deadline> {
    const { data } = await api.post(`/deadlines/${id}/complete`, { confirmFatal });
    return data.data ?? data;
  },
  async cancel(id: string): Promise<void> {
    await api.delete(`/deadlines/${id}`);
  },
};
