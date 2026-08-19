import { api } from '@/lib/api';

/**
 * Linha do tempo do cliente — a história dele com o escritório numa sequência
 * só. O servidor cruza contrato, distribuição, andamentos, alvará e repasse,
 * que hoje vivem em quatro lugares diferentes do sistema.
 */

export type MarcoTipo =
  | 'contrato' | 'documento' | 'distribuicao' | 'andamento'
  | 'sentenca' | 'recurso' | 'alvara' | 'honorario' | 'repasse' | 'fase';

export interface Marco {
  data: string;
  tipo: MarcoTipo;
  titulo: string;
  detalhe?: string | null;
  /** Marcos que mudam o rumo do caso — ganham destaque visual. */
  destaque: boolean;
  caseId?: string | null;
  caseTitulo?: string | null;
  cnjNumber?: string | null;
  valor?: number | null;
  documentoId?: string | null;
}

/** Um processo (ou o relacionamento com o escritório) com os seus marcos. */
export interface GrupoTimeline {
  caseId: string | null;
  titulo: string;
  cnjNumber: string | null;
  area: string | null;
  marcos: Marco[];
}

export const clientTimelineService = {
  async get(
    partyId: string,
  ): Promise<{ cliente: string; marcos: Marco[]; grupos: GrupoTimeline[] }> {
    const { data } = await api.get(`/client-documents/timeline/${partyId}`);
    return data.data ?? data;
  },
};
