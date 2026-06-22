import { api } from '@/lib/api';

export type ParteRecorrente = 'CLIENTE' | 'ADVERSA';
export type JulgamentoRecurso = 'AGUARDANDO' | 'PROVIDO' | 'NAO_PROVIDO' | 'PARCIAL';

export interface Recurso {
  id: string;
  caseId: string;
  clienteNome: string | null;
  parteAdversa: string | null;
  cnjNumber: string | null;
  numeroRecurso: string | null;
  parteRecorrente: ParteRecorrente | null;
  especie: string | null;
  julgamento: JulgamentoRecurso;
  motivo: string | null;
  ementa: string | null;
  grau: string | null;
  publicationId: string | null;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; title: string; cnjNumber: string | null } | null;
}

export interface EspecieStat {
  nome: string;
  total: number;
  aguardando: number;
  decididos: number;
  favoraveis: number;
  taxa: number | null;
}

export interface RecursoStats {
  total: number;
  aguardando: number;
  decididos: number;
  favoraveis: number;
  desfavoraveis: number;
  taxaExito: number;
  porJulgamento: Record<JulgamentoRecurso, number>;
  porEspecie: EspecieStat[];
  porBanco: EspecieStat[];
  melhoresTeses: {
    especie: string | null;
    cliente: string | null;
    parteRecorrente: ParteRecorrente | null;
    julgamento: JulgamentoRecurso;
    cnj: string | null;
    ementa: string | null;
  }[];
  gargalos: {
    especiesBaixoExito: { nome: string; taxa: number | null; decididos: number }[];
    bancosBaixoExito: { nome: string; taxa: number | null; decididos: number }[];
    maisAguardando: { nome: string; aguardando: number }[];
  };
}

export interface CreateRecursoInput {
  caseId: string;
  especie?: string;
  parteRecorrente?: ParteRecorrente;
  julgamento?: JulgamentoRecurso;
  numeroRecurso?: string;
  ementa?: string;
  grau?: string;
  clienteNome?: string;
  parteAdversa?: string;
  cnjNumber?: string;
}

export type UpdateRecursoInput = Partial<Omit<CreateRecursoInput, 'caseId'>>;

export interface ListRecursosQuery {
  caseId?: string;
  julgamento?: JulgamentoRecurso;
}

export const JULGAMENTO_LABEL: Record<JulgamentoRecurso, string> = {
  AGUARDANDO: 'Aguardando decisão',
  PROVIDO: 'Provido',
  NAO_PROVIDO: 'Não provido',
  PARCIAL: 'Parcialmente provido',
};

export const PARTE_RECORRENTE_LABEL: Record<ParteRecorrente, string> = {
  CLIENTE: 'Cliente (nós)',
  ADVERSA: 'Parte adversa',
};

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const recursosService = {
  async list(query: ListRecursosQuery = {}): Promise<Recurso[]> {
    const { data } = await api.get(`/recursos${qs(query)}`);
    return data.data ?? data;
  },
  async stats(): Promise<RecursoStats> {
    const { data } = await api.get('/recursos/stats');
    return data.data ?? data;
  },
  async create(input: CreateRecursoInput): Promise<Recurso> {
    const { data } = await api.post('/recursos', input);
    return data.data ?? data;
  },
  async update(id: string, input: UpdateRecursoInput): Promise<Recurso> {
    const { data } = await api.patch(`/recursos/${id}`, input);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/recursos/${id}`);
  },
};
