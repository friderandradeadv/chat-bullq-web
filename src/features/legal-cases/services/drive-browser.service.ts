import { api } from '@/lib/api';

/**
 * Pasta do cliente no Google Drive, ao vivo. Complementa o índice: o índice
 * conta e cruza (contadores, linha do tempo, deduplicação), este mostra a pasta
 * como ela está AGORA — documento que a equipe subiu há um minuto aparece aqui
 * sem ninguém rodar importação.
 */

export interface ItemDrive {
  id: string;
  nome: string;
  pasta: boolean;
  mimeType: string;
  tamanho: number | null;
  modificadoEm: string | null;
  categoria: string | null;
}

export interface PastaDrive {
  cliente: string;
  caminho: string[];
  folderId: string;
  webViewLink: string;
  itens: ItemDrive[];
}

export const driveBrowserService = {
  async listar(partyId: string, caminho: string[] = []): Promise<PastaDrive> {
    const { data } = await api.get(`/client-documents/drive/${partyId}`, {
      params: caminho.length ? { caminho: caminho.join('/') } : {},
      timeout: 45_000, // cada nível da árvore é uma chamada ao Drive
    });
    return data.data ?? data;
  },

  /** Baixa pelo proxy autenticado e devolve um object URL para abrir. */
  async abrir(partyId: string, caminho: string[], fileId: string): Promise<string> {
    const { data } = await api.get(`/client-documents/drive/${partyId}/arquivo/${fileId}`, {
      params: caminho.length ? { caminho: caminho.join('/') } : {},
      responseType: 'blob',
      timeout: 60_000,
    });
    return URL.createObjectURL(data as Blob);
  },
};
