import { api } from '@/lib/api';

export type EventKind = 'audiencia' | 'reuniao' | 'pericia' | 'tarefa' | 'outro';

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
  metadata?: { completedAt?: string | null; coResponsibleIds?: string[] } & Record<string, unknown>;
}

export interface CreateEventInput {
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt?: string;
  location?: string;
  caseId?: string;
  assignedToId?: string;
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
  async update(id: string, input: Partial<CreateEventInput> & { completedAt?: string | null }): Promise<CalendarEvent> {
    const { data } = await api.patch(`/calendar/${id}`, input);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/calendar/${id}`);
  },
};
