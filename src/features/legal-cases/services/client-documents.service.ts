import { api } from '@/lib/api';

/**
 * Documentos do cliente (contrato de honorários, procuração, hipossuficiência,
 * RG/CNH/comprovante) que vivem no Google Drive e aparecem na ficha do hub.
 *
 * O arquivo NÃO fica duplicado no hub: a API baixa do Drive na hora e devolve o
 * stream. Como a autenticação é por Bearer no localStorage, `window.open` direto
 * na URL não funcionaria (não leva o header) — por isso baixamos por axios e
 * abrimos um object URL, mesmo caminho da prestação de contas em PDF.
 */

export type CategoriaDocumento =
  | 'CONTRATO'
  | 'PROCURACAO'
  | 'HIPOSSUFICIENCIA'
  | 'RENUNCIA'
  | 'RESIDENCIA'
  | 'PESSOAL'
  | 'KIT'
  | 'PROCESSO'
  | 'OUTRO';

export interface ClientDocument {
  id: string;
  categoria: CategoriaDocumento;
  nome: string;
  mimeType: string | null;
  tamanho: number | null;
  drivePath: string | null;
  driveWebViewLink: string | null;
  origem: 'DRIVE_IMPORT' | 'ZAPSIGN' | string;
  assinadoEm: string | null;
  atualizadoEm: string;
  caseId: string | null;
  /**
   * Outras pastas do Drive com a MESMA peça. A árvore é por produto (01. RMC,
   * 02. RCC…) e o kit assinado foi copiado para cada uma — a ficha mostra uma
   * linha só e lista aqui onde mais o arquivo está.
   */
  tambemEm: string[];
}

/** Progresso da varredura em massa (roda em segundo plano, leva dezenas de minutos). */
export interface ImportacaoEmCurso {
  rodando: boolean;
  iniciadaEm: string;
  terminadaEm: string | null;
  totalPastas: number;
  parcial: ImportarResultado;
  erroFatal: string | null;
}

export interface ImportarResultado {
  pastasVarridas: number;
  clientesComDocumento: number;
  indexados: number;
  atualizados: number;
  semCorrespondencia: string[];
  homonimos: string[];
  erros: string[];
}

export const CATEGORIA_LABEL: Record<string, string> = {
  CONTRATO: 'Contrato de honorários',
  PROCURACAO: 'Procuração',
  HIPOSSUFICIENCIA: 'Declaração de hipossuficiência',
  RENUNCIA: 'Declaração de renúncia',
  RESIDENCIA: 'Comprovante de residência',
  PESSOAL: 'Documento pessoal',
  KIT: 'Contrato completo (kit assinado)',
  PROCESSO: 'Documento do processo',
  OUTRO: 'Documento',
};

export const clientDocumentsService = {
  async list(params: {
    partyId?: string;
    contactId?: string;
    cliente?: string;
    documento?: string;
  }): Promise<ClientDocument[]> {
    const { data } = await api.get('/client-documents', { params });
    return data.data ?? data;
  },

  /** Baixa o arquivo pelo proxy autenticado e devolve um object URL pra abrir. */
  async abrir(id: string): Promise<{ url: string; revoke: () => void }> {
    const { data } = await api.get(`/client-documents/${id}/arquivo`, {
      responseType: 'blob',
      timeout: 60_000, // PDF de kit assinado passa fácil dos 15s padrão
    });
    const url = URL.createObjectURL(data as Blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  },

  /**
   * Varre o Drive e indexa os documentos. Na ficha usamos sempre
   * `apenasCliente` — a varredura completa das 261 pastas é lenta demais para
   * uma requisição HTTP e roda pelo script `importar-documentos-drive.ts`.
   */
  async importar(params: {
    apenasCliente?: string;
    incluirProcesso?: boolean;
  }): Promise<ImportarResultado> {
    const { data } = await api.post('/client-documents/importar-drive', params, {
      timeout: 180_000,
    });
    return data.data ?? data;
  },

  /**
   * Dispara a varredura de TODOS os clientes. Volta na hora: o trabalho roda em
   * segundo plano na API e avisa no sino ao terminar.
   */
  async importarTudo(params: { incluirProcesso?: boolean } = {}): Promise<ImportacaoEmCurso> {
    const { data } = await api.post('/client-documents/importar-drive-tudo', params);
    return data.data ?? data;
  },

  /** Progresso da varredura em massa. null se nunca rodou. */
  async importarStatus(): Promise<ImportacaoEmCurso | null> {
    const { data } = await api.get('/client-documents/importar-status');
    return data.data ?? data ?? null;
  },

  /** Tira da ficha. O arquivo continua no Drive. */
  async remover(id: string): Promise<{ ok: boolean; aviso: string }> {
    const { data } = await api.delete(`/client-documents/${id}`);
    return data.data ?? data;
  },
};
