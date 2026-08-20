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

export interface FaseNoDrive {
  chave: string;
  rotulo: string;
  /** Nome real da pasta no Drive (pode ser de geração antiga). */
  pasta: string;
  /** Trilha a partir da pasta do cliente, incluindo a própria fase. */
  caminho: string[];
}

export interface DestinoDaPeca {
  fase: string;
  caminho: string[];
  letra: string;
  data: string;
  /** `c) 20.08.2026` — a subpasta que será criada. */
  pasta: string;
  destino: string[];
}

export interface ArquivarPorAtividade {
  partyId: string;
  cliente: string;
  processo: string | null;
  /** Ação do DJEN, quando a atividade veio de publicação. */
  acao: string | null;
  faseSugerida: string;
  fases: FaseNoDrive[];
  /** Trilhas das fases que casam com a ação — mais de uma quando há RMC e RCC. */
  sugeridas: string[][];
  /** Já calculado quando não há dúvida de pasta; null quando a tela precisa perguntar. */
  destino: DestinoDaPeca | null;
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

  // ─── Escrita: a pasta do cliente é editável daqui ─────────────────────────

  async criarPasta(partyId: string, caminho: string[], nome: string) {
    const { data } = await api.post(`/client-documents/drive/${partyId}/pasta`, {
      caminho: caminho.join('/'),
      nome,
    });
    return data.data ?? data;
  },

  async enviar(partyId: string, caminho: string[], arquivos: File[]) {
    const form = new FormData();
    form.append('caminho', caminho.join('/'));
    arquivos.forEach((f) => form.append('files', f));
    const { data } = await api.post(`/client-documents/drive/${partyId}/enviar`, form, {
      timeout: 180_000, // o Drive é lento com arquivo grande, e o advogado espera olhando
    });
    return data.data ?? data;
  },

  /** Manda para a LIXEIRA do Drive (30 dias para desfazer), nunca apaga de vez. */
  async excluir(partyId: string, caminho: string[], itemId: string, confirmar = false) {
    const { data } = await api.delete(`/client-documents/drive/${partyId}/item/${itemId}`, {
      params: {
        ...(caminho.length ? { caminho: caminho.join('/') } : {}),
        ...(confirmar ? { confirmar: 'true' } : {}),
      },
    });
    return data.data ?? data;
  },

  /** As fases que ESTE cliente tem — não a lista teórica das nove. */
  async fases(partyId: string): Promise<FaseNoDrive[]> {
    const { data } = await api.get(`/client-documents/drive/${partyId}/fases`, {
      timeout: 60_000, // varre a árvore do cliente no Drive
    });
    return data.data ?? data;
  },

  /** Onde a peça de hoje cairia, sem escrever nada — é o que a tela mostra antes. */
  async destino(partyId: string, caminho: string[], data?: string): Promise<DestinoDaPeca> {
    const r = await api.get(`/client-documents/drive/${partyId}/destino`, {
      params: { caminho: caminho.join('/'), ...(data ? { data } : {}) },
      timeout: 45_000,
    });
    return r.data.data ?? r.data;
  },

  /**
   * De onde arquivar a peça de uma tarefa/prazo: cliente, fases e destino.
   * É o que fecha o vão entre a Agenda e a pasta — o painel não precisa saber
   * de qual cliente é o processo nem que fases ele tem.
   */
  async porAtividade(
    entityType: 'task' | 'deadline',
    entityId: string,
  ): Promise<ArquivarPorAtividade> {
    const { data } = await api.get(`/client-documents/drive/atividade/${entityType}/${entityId}`, {
      timeout: 60_000,
    });
    return data.data ?? data;
  },

  /** Arquiva a peça protocolada: cria `<letra>) <data>` e sobe os PDFs numerados. */
  async arquivar(partyId: string, caminho: string[], arquivos: File[], data?: string) {
    const form = new FormData();
    form.append('caminho', caminho.join('/'));
    if (data) form.append('data', data);
    arquivos.forEach((f) => form.append('files', f));
    const r = await api.post(`/client-documents/drive/${partyId}/arquivar`, form, {
      timeout: 180_000,
    });
    return r.data.data ?? r.data;
  },
};
