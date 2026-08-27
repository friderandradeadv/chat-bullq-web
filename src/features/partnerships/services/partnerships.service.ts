import { api } from '@/lib/api';

export interface PartnershipMember {
  id: string;
  userOrganizationId: string;
  userId: string | null;
  nome: string | null;
  email: string | null;
  orgRole: string | null;
  role: 'PARTNER' | 'INTERNAL';
  pct: number | null;
}

export interface Partnership {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  areas: string[];
  boards: string[];
  departmentIds: string[];
  partnerPct: number;
  active: boolean;
  startedAt: string | null;
  endedAt: string | null;
  nCasos: number;
  membros: PartnershipMember[];
}

export interface PartnershipCaseRow {
  caseId: string;
  addedAt: string;
  title: string;
  cnj: string | null;
  area: string | null;
  fase: string | null;
  status: string;
  valor: number | null;
  responsavel: string | null;
  cliente: string | null;
  reu: string | null;
}

export interface AcertoParceria {
  parceria: { id: string; nome: string; cor: string; partnerPct: number; areas: string[] };
  resumo: {
    recebido: number;
    aReceber: number;
    custosDiretos: number;
    aPagar: number;
    liquido: number;
    doParceiro: number;
    doEscritorio: number;
    nCasos: number;
    nLancamentos: number;
  };
  serie: { mes: string; valor: number }[];
  porCaso: { caseId: string; cliente: string; recebido: number; custo: number; liquido: number }[];
  lancamentos: {
    id?: string;
    data: string;
    mes: string;
    categoria: string;
    descricao: string | null;
    valor: number;
    status: string | null;
    caseId: string | null;
    cliente: string | null;
  }[];
  geradoEm: string | null;
}

const unwrap = <T,>(data: any): T => (data?.data ?? data) as T;

export const partnershipsService = {
  async list(): Promise<Partnership[]> {
    const { data } = await api.get('/partnerships');
    return unwrap<Partnership[]>(data);
  },
  async get(id: string): Promise<Partnership> {
    const { data } = await api.get(`/partnerships/${id}`);
    return unwrap<Partnership>(data);
  },
  async create(body: Partial<Partnership>): Promise<Partnership> {
    const { data } = await api.post('/partnerships', body);
    return unwrap<Partnership>(data);
  },
  async update(id: string, body: Partial<Partnership>): Promise<Partnership> {
    const { data } = await api.patch(`/partnerships/${id}`, body);
    return unwrap<Partnership>(data);
  },
  async encerrar(id: string): Promise<void> {
    await api.delete(`/partnerships/${id}`);
  },
  async addMember(
    id: string,
    body: { userId: string; role?: 'PARTNER' | 'INTERNAL'; pct?: number },
  ): Promise<Partnership> {
    const { data } = await api.post(`/partnerships/${id}/membros`, body);
    return unwrap<Partnership>(data);
  },
  async removeMember(id: string, memberId: string): Promise<Partnership> {
    const { data } = await api.delete(`/partnerships/${id}/membros/${memberId}`);
    return unwrap<Partnership>(data);
  },
  async casos(id: string): Promise<PartnershipCaseRow[]> {
    const { data } = await api.get(`/partnerships/${id}/casos`);
    return unwrap<PartnershipCaseRow[]>(data);
  },
  async marcarCasos(
    id: string,
    caseIds: string[],
  ): Promise<{ adicionados: number; ignorados: number; conflitos: { caseId: string; parceria: string }[] }> {
    const { data } = await api.post(`/partnerships/${id}/casos`, { caseIds });
    return unwrap(data);
  },
  async desmarcarCasos(id: string, caseIds: string[]): Promise<{ removidos: number }> {
    const { data } = await api.delete(`/partnerships/${id}/casos`, { data: { caseIds } });
    return unwrap(data);
  },
  async acerto(partnershipId: string): Promise<AcertoParceria> {
    const { data } = await api.get('/financeiro/parceria', { params: { partnershipId } });
    return unwrap<AcertoParceria>(data);
  },
};
