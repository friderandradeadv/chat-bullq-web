import { api } from '@/lib/api';

export type PublicationStatus = 'NEW' | 'CLASSIFIED' | 'LINKED' | 'DISMISSED';

export interface DjenClassification {
  tipoComunicacao?: string;
  diasUteis?: number;
  fatal?: boolean;
  label?: string;
  urgency?: 'alta' | 'media' | 'baixa';
  oab?: string;
  tribunal?: string;
  action?: string;
  prazoFatal?: string | null;
  prazoSeguranca?: string | null;
}

export interface Publication {
  id: string;
  oab: string;
  source: string;
  externalId: string | null;
  publishedAt: string;
  rawContent: string;
  status: PublicationStatus;
  caseId: string | null;
  classification: DjenClassification | null;
  case: {
    id: string;
    title: string;
    cnjNumber: string | null;
    court?: string | null;
    responsible?: { id: string; name: string } | null;
  } | null;
  createdAt: string;
  /** computados no backend */
  processoCnj?: string | null;
  tribunal?: string | null;
  uf?: string | null;
  orgaoJulgador?: string | null;
}

export type PublicationGroup = 'nao_tratada' | 'tratada' | 'descartada' | 'all';

export interface PublicationsStats {
  naoTratadosHoje: number;
  tratadosHoje: number;
  descartadasHoje: number;
  naoTratadosTotal: number;
  serie: { date: string; count: number }[];
}

export interface ScanSummary {
  organizationId: string;
  novas: number;
  duplicadas: number;
  vinculadas: number;
  prazosCriados: number;
  erros: number;
}

export interface ListPublicationsQuery {
  status?: PublicationStatus;
  unlinked?: boolean;
  group?: PublicationGroup;
  q?: string;
  uf?: string;
}

function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const djenService = {
  async list(query: ListPublicationsQuery = {}): Promise<Publication[]> {
    const { data } = await api.get(`/djen/publications${qs(query)}`);
    return data.data ?? data;
  },
  async stats(): Promise<PublicationsStats> {
    const { data } = await api.get('/djen/publications/stats');
    return data.data ?? data;
  },
  async link(publicationId: string, caseId: string): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/djen/publications/${publicationId}/link`, { caseId });
    return data.data ?? data;
  },
  async dismiss(publicationId: string): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/djen/publications/${publicationId}/dismiss`, {});
    return data.data ?? data;
  },
  async addPrazo(publicationId: string): Promise<{ ok: boolean; prazoFatal: string; prazoSeguranca: string }> {
    const { data } = await api.post(`/djen/publications/${publicationId}/prazo`, {});
    return data.data ?? data;
  },
  async bulk(ids: string[], action: 'dismiss' | 'gravar_historico'): Promise<{ ok: boolean; afetadas?: number; gravadas?: number; semProcesso?: number }> {
    const { data } = await api.post('/djen/publications/bulk', { ids, action });
    return data.data ?? data;
  },
  async run(input: { inicio?: string; fim?: string } = {}): Promise<ScanSummary> {
    const { data } = await api.post('/djen/run', input);
    return data.data ?? data;
  },
};
