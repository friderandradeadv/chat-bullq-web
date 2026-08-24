// Academia Frider — biblioteca de treinamento do escritório.
// O conteúdo é estático (arquivos em content/) de propósito: não depende de
// banco, de migration nem de deploy da API — só do build do web.

/** Onde o vídeo da aula mora. */
export type Video =
  /** Arquivo no Google Drive do escritório (embed /preview — exige login com a conta do escritório). */
  | { fonte: 'drive'; id: string; duracao?: string }
  /**
   * URL direta de um mp4 (hospedado em /api/v1/uploads/assets). Toca no player
   * nativo, o que permite LEGENDA — coisa que o embed do Drive não permite.
   *
   * `legendas` é a URL de um arquivo .vtt. Como o vídeo vem de outro domínio
   * (api.friderandrade.com.br) que não o do hub, a faixa de legenda só carrega
   * com `crossOrigin="anonymous"` no <video> E com CORS liberado no /uploads —
   * as duas coisas já estão de pé. Sem uma delas, o vídeo toca e a legenda
   * some silenciosamente.
   */
  | { fonte: 'url'; url: string; legendas?: string; duracao?: string };

export interface Aula {
  id: string;
  titulo: string;
  /** Uma linha: o que a pessoa sai sabendo. */
  resumo: string;
  /** Tempo estimado de leitura + vídeo, em minutos. */
  minutos: number;
  /** Vídeo da aula. Ausente = "vídeo em produção" (o manual escrito já vale sozinho). */
  video?: Video;
  /** Pasta do acervo antigo no Drive, quando existe gravação legada sobre o tema. */
  acervo?: { titulo: string; url: string };
  /** Manual escrito da aula, em markdown leve (ver ManualRender). */
  manual: string;
  /** O que a pessoa tem que conseguir fazer sozinha ao fim da aula. */
  checklist?: string[];
  /** Prompt pronto para gerar o vídeo desta aula no NotebookLM (visível só para sócios). */
  promptVideo?: string;
}

export interface Trilha {
  id: string;
  titulo: string;
  subtitulo: string;
  /** Chave do ícone lucide — resolvida na página (content/ fica livre de React). */
  icone: string;
  cor: string;
  /** Para quem é a trilha. */
  publico: string;
  aulas: Aula[];
}
