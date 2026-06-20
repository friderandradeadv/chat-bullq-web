import { api } from '@/lib/api';

/** Dados do contato do Comercial cruzados com o cliente do Jurídico. */
export interface ClientContact {
  id: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: { id: string; name: string; color: string } | null;
  tags: { id: string; name: string; color: string }[];
  conversationId: string | null;
}

export interface ClientRow {
  name: string;
  /** party representativa → /clientes/[partyId] */
  partyId: string;
  document: string | null;
  cases: number;
  /** processos com nº CNJ (monitorados no DJEN) */
  monitorados: number;
  /** contato do Comercial cruzado (por vínculo ou por nome); null se não há */
  contact: ClientContact | null;
}

export const clientsService = {
  async list(): Promise<ClientRow[]> {
    const { data } = await api.get('/legal-cases/clients');
    return data.data ?? data;
  },
};
