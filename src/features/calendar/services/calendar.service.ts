import { api } from '@/lib/api';

export type EventKind = 'audiencia' | 'reuniao' | 'pericia' | 'tarefa' | 'atendimento' | 'outro';

// ── Agenda de atendimentos ──────────────────────────────────────────────
export interface DisponibilidadeConfig {
  enabled: boolean;
  slotMinutes: number;
  dias: Record<string, [string, string][]>; // { seg: [["09:00","12:00"]], ... }
}
export interface AtendimentoSlot { start: string; end: string }
export const DIAS_SEMANA: { key: string; label: string }[] = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça' }, { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' }, { key: 'sex', label: 'Sexta' }, { key: 'sab', label: 'Sábado' }, { key: 'dom', label: 'Domingo' },
];

export interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  caseId: string | null;
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
  case: { id: string; title: string; cnjNumber: string | null } | null;
  createdAt?: string | null;
  metadata?: {
    completedAt?: string | null;
    coResponsibleIds?: string[];
    /** Antecedências dos lembretes, em MINUTOS (ex.: [1440, 60]). */
    reminders?: number[];
  } & Record<string, unknown>;
}

export interface CreateEventInput {
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt?: string;
  location?: string;
  caseId?: string;
  assignedToId?: string;
  /** Antecedências dos lembretes, em MINUTOS. Omitir = padrão (1 dia + 1 hora). */
  reminders?: number[];
}

export interface ListEventsQuery {
  from?: string;
  to?: string;
  caseId?: string;
  assignedToId?: string;
  kind?: EventKind;
}

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const calendarService = {
  async list(query: ListEventsQuery = {}): Promise<CalendarEvent[]> {
    const { data } = await api.get(`/calendar${qs(query)}`);
    return data.data ?? data;
  },
  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const { data } = await api.post('/calendar', input);
    return data.data ?? data;
  },
  async update(id: string, input: Omit<Partial<CreateEventInput>, 'endsAt'> & { completedAt?: string | null; /** null = tira o horário de término. */ endsAt?: string | null }): Promise<CalendarEvent> {
    const { data } = await api.patch(`/calendar/${id}`, input);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/calendar/${id}`);
  },

  // ── Atendimentos ──
  async getDisponibilidade(userId?: string): Promise<DisponibilidadeConfig> {
    const { data } = await api.get(`/calendar/atendimento/disponibilidade${userId ? `?userId=${userId}` : ''}`);
    return data.data ?? data;
  },
  async setDisponibilidade(input: { userId?: string; enabled?: boolean; slotMinutes?: number; dias?: Record<string, [string, string][]> }): Promise<DisponibilidadeConfig> {
    const { data } = await api.put('/calendar/atendimento/disponibilidade', input);
    return data.data ?? data;
  },
  async slots(query: { userId: string; from?: string; to?: string; durationMin?: number }): Promise<AtendimentoSlot[]> {
    const { data } = await api.get(`/calendar/atendimento/slots${qs(query)}`);
    return data.data ?? data;
  },
  async agendarAtendimento(input: { userId: string; startsAt: string; durationMin?: number; title?: string; nome?: string; telefone?: string; caseId?: string; obs?: string }): Promise<CalendarEvent> {
    const { data } = await api.post('/calendar/atendimento', input);
    return data.data ?? data;
  },
};
