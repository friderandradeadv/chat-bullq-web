import { api } from '@/lib/api';

export type DistributionRule = 'ROUND_ROBIN' | 'LEAST_BUSY' | 'MANUAL';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isDefault: boolean;
  distributionRule: DistributionRule;
}

export interface CreateDepartmentPayload {
  name: string;
  description?: string;
  color?: string;
  distributionRule?: DistributionRule;
  isDefault?: boolean;
}

export const departmentsService = {
  async list(): Promise<Department[]> {
    const { data } = await api.get('/departments');
    return data.data ?? data;
  },
  async create(payload: CreateDepartmentPayload): Promise<Department> {
    const { data } = await api.post('/departments', payload);
    return data.data ?? data;
  },
  async update(
    id: string,
    payload: Partial<CreateDepartmentPayload>,
  ): Promise<Department> {
    const { data } = await api.patch(`/departments/${id}`, payload);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },
};
