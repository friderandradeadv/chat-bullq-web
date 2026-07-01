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
export interface Rh {
  etapas: Etapa[];
  candidatos: Candidato[];
  vaga: string;        // descrição/formulário da vaga aberta
  canEdit: boolean;
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
