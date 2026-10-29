import { api } from '@/lib/api';

export type PapelAgenda = 'escritorio' | 'pessoal' | 'leitura';

export interface AgendaEscolhida {
  id: string;
  summary: string;
  papel: PapelAgenda;
  color?: string | null;
}

export interface ContaGoogle {
  id: string;
  googleEmail: string;
  calendars: AgendaEscolhida[];
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface AgendaDisponivel {
  id: string;
  summary: string;
  color: string | null;
  podeEscrever: boolean;
  primaria: boolean;
}

export interface EventoGoogle {
  id: string;
  contaId: string;
  donoId: string;
  calendarId: string;
  agenda: string;
  papel: PapelAgenda;
  cor: string | null;
  titulo: string;
  local: string | null;
  inicio: string;
  fim: string | null;
  diaInteiro: boolean;
  oculto: boolean;
  link: string | null;
}

export interface DestinoGoogle {
  calendarId: string;
  summary: string;
  email: string;
  color: string | null;
  papel: PapelAgenda | null;
}

const un = <T,>(data: any): T => (data?.data ?? data) as T;
const BASE = '/integrations/google-agenda';

export const googleAgendaService = {
  async contas(): Promise<ContaGoogle[]> {
    const { data } = await api.get(`${BASE}/contas`);
    return un(data);
  },
  async conectar(): Promise<{ url: string }> {
    const { data } = await api.post(`${BASE}/conectar`);
    return un(data);
  },
  async agendas(contaId: string): Promise<AgendaDisponivel[]> {
    const { data } = await api.get(`${BASE}/contas/${contaId}/agendas`);
    return un(data);
  },
  async salvarAgendas(contaId: string, calendars: AgendaEscolhida[]): Promise<ContaGoogle[]> {
    const { data } = await api.put(`${BASE}/contas/${contaId}/agendas`, { calendars });
    return un(data);
  },
  async desconectar(contaId: string): Promise<void> {
    await api.delete(`${BASE}/contas/${contaId}`);
  },
  async destinos(): Promise<DestinoGoogle[]> {
    const { data } = await api.get(`${BASE}/destinos`);
    return un(data);
  },
  async eventos(from: string, to: string): Promise<{ eventos: EventoGoogle[]; erros: string[] }> {
    const { data } = await api.get(`${BASE}/eventos`, { params: { from, to } });
    return un(data);
  },
};
