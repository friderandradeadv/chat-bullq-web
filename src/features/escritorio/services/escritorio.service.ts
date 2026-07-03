import { api } from '@/lib/api';

export interface Cargo {
  id: string;
  nome: string;
  descricao: string;
  parentId?: string | null; // cargo acima na hierarquia (organograma em árvore)
  divisaoHonorarios?: string; // sensível — só sócios recebem do backend
  modulos?: string[]; // módulos do Hub que este cargo pode acessar (undefined = todos)
  // Detalhe do cargo (Plano de Carreira) — tudo opcional, renderizado em seções:
  vertical?: string;       // trilha: Sociedade / Advocacia / Estágio / Back Office
  resumo?: string;         // 1 linha do que é o cargo
  selecao?: string[];      // como entra (currículo, prova, entrevista, labor day…)
  atribuicoes?: string[];  // o que faz no dia a dia
  horario?: string;        // jornada
  duracao?: string;        // tempo no cargo / o que vem depois
  remuneracao?: string[];  // CLT/bolsa + benefícios (back office / estágio)
  honorarios?: string[];   // percentuais de honorários (associados / sócios)
  custoFirma?: string;     // cota / contribuição com a estrutura
  progride?: string;       // de onde vem · pra onde vai
}
// Documento institucional do escritório (regimento interno, estatuto…) — PDF/arquivo
// hospedado (URL pública do /messages/uploads/media) que todos visualizam.
export interface DocInstitucional { id: string; titulo: string; url: string; mime?: string }
export interface Cultura {
  missao: string;
  visao: string;
  valores: string[];
  cultura: string;         // "como trabalhamos" / princípios do dia a dia (texto livre)
  manifesto?: string;      // quem somos / o que queremos (headline forte da cultura)
  rotina?: string;         // como é vivida a rotina aqui (um item por linha)
  documentos?: DocInstitucional[]; // regimento interno, estatuto, etc. (persiste dentro de cultura)
}
export interface Manual { id: string; titulo: string; conteudo: string }
export interface OnboardingItem { id: string; texto: string }
// Vertical = área de atuação do escritório (Previdenciário, Bancário RMC/RCC, etc.).
export interface Vertical { id: string; nome: string; titular?: string; regra?: string; descricao?: string }
export interface PessoaInfo {
  cargoId?: string;
  bio?: string;            // perfil pessoal (a própria pessoa escreve)
  fotoUrl?: string;        // foto de perfil (URL); fallback = avatar/iniciais
  frase?: string;          // lema / frase pessoal
  contratadaDesde?: string; // data de contratação (texto livre)
  conoscoDesde?: string;   // "está conosco desde" (texto livre)
  oab?: string;            // nº da OAB (se advogado)
  casos?: number;          // casos que cuida
  vidas?: number;          // vidas que muda
  destaque?: string;       // reconhecimento/motivação (o sócio escreve)
  financeiro?: string[];   // condições financeiras pessoais (do contrato): percentuais, custos…
  atuacao?: string[];      // verticais/áreas em que a pessoa atua (nomes)
  sexo?: 'F' | 'M';        // para flexionar cargo/textos no feminino/masculino
  contratoUrl?: string;    // contrato assinado (PDF) que o sócio sobe; a pessoa visualiza
  contratoNome?: string;   // nome do arquivo do contrato (para exibir)
}

export interface Escritorio {
  cultura: Cultura;
  cargos: Cargo[];
  pessoas: Record<string, PessoaInfo>; // userId -> { cargoId, bio }
  verticais?: Vertical[];  // áreas de atuação + titularidade
  manuais: Manual[];
  onboarding: OnboardingItem[];
  canEdit: boolean; // true para sócios (OWNER/ADMIN)
}

export const escritorioService = {
  async get(): Promise<Escritorio> {
    const { data } = await api.get('/organizations/escritorio');
    return data.data ?? data;
  },
  async save(input: Partial<Escritorio>): Promise<Escritorio> {
    const { data } = await api.patch('/organizations/escritorio', input);
    return data.data ?? data;
  },
  // Cada pessoa edita o próprio perfil (foto, frase, bio, OAB) — não precisa ser sócio.
  async saveMeuPerfil(patch: Partial<PessoaInfo>): Promise<{ ok: boolean }> {
    const { data } = await api.patch('/organizations/escritorio/meu-perfil', patch);
    return data.data ?? data;
  },
  // Extrai dados de um advogado de um documento (PDF/imagem/Word) com IA.
  async extrairPerfil(input: { base64: string; mime: string; nomeArquivo: string }): Promise<Partial<PessoaInfo> & { nome?: string; resumo?: string }> {
    const { data } = await api.post('/organizations/escritorio/extrair-perfil', input);
    return data.data ?? data;
  },
};
