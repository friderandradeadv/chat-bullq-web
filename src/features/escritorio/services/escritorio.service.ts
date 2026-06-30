import { api } from '@/lib/api';

export interface Cargo {
  id: string;
  nome: string;
  descricao: string;
  parentId?: string | null; // cargo acima na hierarquia (organograma em árvore)
  divisaoHonorarios?: string; // sensível — só sócios recebem do backend
  modulos?: string[]; // módulos do Hub que este cargo pode acessar (undefined = todos)
}
export interface Cultura { missao: string; visao: string; valores: string[]; cultura: string }
export interface Manual { id: string; titulo: string; conteudo: string }
export interface OnboardingItem { id: string; texto: string }
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
}

export interface Escritorio {
  cultura: Cultura;
  cargos: Cargo[];
  pessoas: Record<string, PessoaInfo>; // userId -> { cargoId, bio }
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
};
