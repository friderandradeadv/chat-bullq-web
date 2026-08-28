import { api } from '@/lib/api';

export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  agentStatus: string;
  joinedAt: string;
  /** Módulos que este membro NÃO pode acessar (denylist). */
  restrictedModules?: string[];
  /** false = não aparece nos seletores de responsável (perfil admin, login duplicado). */
  assignable?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

export const membersService = {
  async list(): Promise<Member[]> {
    const { data } = await api.get('/organizations/members');
    return data.data;
  },
  async invite(payload: {
    email: string;
    role?: string;
    /** Convite de PARCEIRO: ao aceitar, já entra travado no recorte da parceria. */
    partnershipId?: string;
  }): Promise<any> {
    const { data } = await api.post('/organizations/members/invite', payload);
    return data.data;
  },
  async updateRole(memberId: string, role: string): Promise<any> {
    const { data } = await api.patch(`/organizations/members/${memberId}/role`, { role });
    return data.data;
  },
  async updateModules(memberId: string, restrictedModules: string[]): Promise<any> {
    const { data } = await api.patch(`/organizations/members/${memberId}/modules`, { restrictedModules });
    return data.data;
  },
  async remove(memberId: string): Promise<void> {
    await api.delete(`/organizations/members/${memberId}`);
  },
  async updateName(memberId: string, name: string): Promise<void> {
    await api.patch(`/organizations/members/${memberId}/name`, { name });
  },
  async setActive(memberId: string, active: boolean): Promise<void> {
    await api.patch(`/organizations/members/${memberId}/active`, { active });
  },
  /** Mostra/esconde o membro nos seletores de responsável (perfil admin, login duplicado). */
  async setAssignable(memberId: string, assignable: boolean): Promise<void> {
    await api.patch(`/organizations/members/${memberId}/assignable`, { assignable });
  },
};
