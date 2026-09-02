import { api } from '@/lib/api';

/** Dados do contato do Comercial cruzados com o cliente do Jurídico. */
export interface ClientContact {
  id: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  avatarUrl?: string | null;
  status: { id: string; name: string; color: string } | null;
  tags: { id: string; name: string; color: string }[];
  conversationId: string | null;
  /** 'contato' = Party.contactId (confirmado); 'nome' = só o nome bateu (frágil). */
  vinculo?: 'contato' | 'nome';
}

export interface ClientRow {
  name: string;
  /** party representativa → /clientes/[partyId] */
  partyId: string;
  /** todas as parties CLIENT do cliente (a ficha resolve por qualquer uma — o link da aba Processos usa o partyId daquele processo) */
  partyIds: string[];
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
  /**
   * Edita a ficha do cliente. Grava no contato do Comercial quando existe (é a
   * ficha viva, que o chat também lê) e na party quando não há contato.
   */
  async atualizar(partyId: string, dados: Record<string, string | null>): Promise<{ ok: boolean; nome: string }> {
    const { data } = await api.patch(`/client-documents/cliente/${partyId}`, dados);
    return data.data ?? data;
  },

  /** "Excluir cliente" = arquivar os processos das parties informadas (lixeira). */
  async archive(partyIds: string[]): Promise<{ ok: boolean; count: number }> {
    const { data } = await api.post('/legal-cases/clients/archive', { partyIds });
    return data.data ?? data;
  },
};
