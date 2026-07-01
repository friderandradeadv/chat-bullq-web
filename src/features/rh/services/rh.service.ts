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
}
export interface Rh {
  etapas: Etapa[];
  candidatos: Candidato[];
  fichas?: Record<string, Ficha>; // por userId
  vaga: string;        // descrição/formulário da vaga aberta
  canEdit: boolean;
  restrito?: boolean;  // true = usuário não é sócio (sem acesso ao RH)
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
};
