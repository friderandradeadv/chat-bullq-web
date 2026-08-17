import { api } from '@/lib/api';

export interface Etapa { id: string; nome: string; cor?: string }
export interface Candidato {
  id: string;
  nome: string;
  etapaId: string;
  cargo?: string;      // vaga pretendida
  email?: string;
  telefone?: string;
  notas?: string;      // anotações do avaliador
  curriculo?: string;  // link ou observação
  nota?: number;       // 0-10 (prova/entrevista)
  criadoEm?: string;
}
export interface Documento { id: string; nome: string; url?: string }

// ─── Ciclo de vida do colaborador (contratação → promoção → contrato → desligamento) ───
// Tudo mora dentro da ficha (org.settings.rh.fichas[userId]), que o backend grava
// como JSON livre — nenhum campo novo de schema é necessário.

export type TipoEvento = 'contratacao' | 'promocao' | 'contrato' | 'desligamento' | 'readmissao';
/** Uma linha do histórico funcional. Nunca é editada nem apagada — o arquivo é a memória do RH. */
export interface EventoRh {
  id: string;
  tipo: TipoEvento;
  data: string;           // dd/mm/aaaa — quando o fato aconteceu
  titulo: string;         // ex.: "Promovido a Advogado Associado"
  de?: string;            // situação anterior (cargo, papel, contrato…)
  para?: string;          // situação nova
  obs?: string;
  registradoPor?: string; // nome de quem registrou
  registradoEm?: string;  // ISO — quando foi registrado no Hub
}

export type MotivoDesligamento =
  | 'sem_justa_causa' | 'pedido_demissao' | 'justa_causa' | 'acordo_484a'
  | 'fim_contrato' | 'fim_estagio' | 'distrato_associacao'
  | 'aposentadoria' | 'falecimento' | 'outro';

export const MOTIVO_LABEL: Record<MotivoDesligamento, string> = {
  sem_justa_causa: 'Dispensa sem justa causa',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Dispensa por justa causa',
  acordo_484a: 'Acordo (art. 484-A da CLT)',
  fim_contrato: 'Término do contrato',
  fim_estagio: 'Término do estágio',
  distrato_associacao: 'Distrato de associação',
  aposentadoria: 'Aposentadoria',
  falecimento: 'Falecimento',
  outro: 'Outro',
};

export type AvisoPrevio = 'trabalhado' | 'indenizado' | 'dispensado' | 'nao_aplica';
export const AVISO_LABEL: Record<AvisoPrevio, string> = {
  trabalhado: 'Trabalhado',
  indenizado: 'Indenizado',
  dispensado: 'Dispensado',
  nao_aplica: 'Não se aplica',
};

/** Presença deste bloco na ficha = pessoa desligada (vai para o arquivo). */
export interface Desligamento {
  data: string;                  // dd/mm/aaaa — data do desligamento
  ultimoDia?: string;            // dd/mm/aaaa — último dia trabalhado
  motivo: MotivoDesligamento;
  detalhe?: string;              // relato interno do sócio
  avisoPrevio?: AvisoPrevio;
  cargoNaSaida?: string;         // congelado no ato (o cargo pode ser renomeado depois)
  papelNaSaida?: string;         // OWNER / ADMIN / AGENT
  elegivelRecontratacao?: boolean;
  documentos?: Documento[];      // TRCT, termo de rescisão, distrato, quitação…
  acessoBloqueado?: boolean;     // login desativado no ato do desligamento
  registradoPor?: string;
  registradoEm?: string;         // ISO
  /** Quem corrigiu o dossiê depois do ato (o registro original não é apagado). */
  retificadoPor?: string;
  retificadoEm?: string;         // ISO
}

/** Contratação registrada antes de o convidado aceitar o convite (ainda sem userId). */
export interface PreAdmissao {
  email: string;
  role: string;                  // AGENT / ADMIN
  cargoId?: string;
  atuacao?: string[];
  honorariosPct?: number;
  acessoFin?: string;
  criadoEm?: string;             // ISO
}

// Ficha de RH (dados sensíveis do colaborador — só sócios veem/editam).
export interface Ficha {
  telefone?: string;
  endereco?: string;
  cpf?: string;
  rg?: string;
  nascimento?: string;    // data de nascimento
  estadoCivil?: string;
  admissao?: string;      // data de admissão/associação
  contrato?: string;      // tipo de contrato + link/obs
  documentos?: Documento[]; // RG, CPF, contrato, comprovantes… (links do Drive)
  obs?: string;           // observações internas de RH
  historico?: EventoRh[];        // linha do tempo funcional (append-only)
  desligamento?: Desligamento | null; // preenchido = arquivado
  /** Só nas fichas-rascunho `pre:<email>` — some quando o convite é aceito. */
  preAdmissao?: PreAdmissao;
}

/** Chave da ficha-rascunho de quem foi contratado mas ainda não aceitou o convite. */
export const preKey = (email: string) => `pre:${email.trim().toLowerCase()}`;
export const isPreKey = (k: string) => k.startsWith('pre:');

export interface Rh {
  etapas: Etapa[];
  candidatos: Candidato[];
  fichas?: Record<string, Ficha>; // por userId (ou `pre:<email>` enquanto o convite não é aceito)
  vaga: string;        // descrição/formulário da vaga aberta
  canEdit: boolean;
  restrito?: boolean;  // true = usuário não é sócio (sem acesso ao RH)
}

// Campos que a IA consegue preencher a partir de um documento cadastral.
export type FichaExtraida = Pick<Ficha, 'cpf' | 'rg' | 'nascimento' | 'estadoCivil' | 'endereco' | 'telefone'> & { nome?: string };

// Aniversariante (visível a todos no Início do Hub) — só dia/mês + nome/foto, sem ano.
export interface Aniversariante {
  userId: string;
  name: string;
  avatarUrl: string | null;
  dia: number;
  mes: number;
  diasAte: number; // 0 = hoje
}

export const rhService = {
  async get(): Promise<Rh> {
    const { data } = await api.get('/organizations/rh');
    return data.data ?? data;
  },
  async save(input: Partial<Rh>): Promise<Rh> {
    const { data } = await api.patch('/organizations/rh', input);
    return data.data ?? data;
  },
  // Extrai dados cadastrais de um documento (PDF/imagem/Word) com IA.
  async extrairFicha(input: { base64: string; mime: string; nomeArquivo: string }): Promise<FichaExtraida> {
    const { data } = await api.post('/organizations/rh/extrair-ficha', input);
    return data.data ?? data;
  },
  /**
   * Apaga do servidor o arquivo de um documento que saiu da ficha.
   * Chamar SÓ DEPOIS de gravar a ficha sem ele — a API recusa apagar arquivo
   * ainda referenciado em algum cadastro ou numa conversa, e a referência antiga
   * contaria. `removido:false` não é erro: o documento saiu, o arquivo é que ficou.
   */
  async excluirDocumento(url: string): Promise<{ removido: boolean; motivo?: string; detalhe?: string }> {
    const { data } = await api.post('/organizations/rh/documentos/excluir', { url });
    return data.data ?? data;
  },
  // Aniversariantes do escritório (hoje + próximos 15 dias) — todos os membros veem.
  async aniversarios(): Promise<{ aniversariantes: Aniversariante[] }> {
    const { data } = await api.get('/organizations/rh/aniversarios');
    return data.data ?? data;
  },
};
