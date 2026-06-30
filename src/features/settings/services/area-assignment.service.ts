import { api } from '@/lib/api';

/**
 * Atribuição automática de NOVOS CLIENTES por ÁREA jurídica. Persistido em
 * `organization.settings.areaAssignment` ({ área: userId }). Quando um card
 * nasce sem responsável (ex.: contrato assinado), o backend usa esse mapa pela
 * área pra já atribuir ao advogado certo.
 */
export const LEGAL_AREAS = [
  'Bancário',
  'Previdenciário',
  'Trabalhista',
  'Consumidor',
  'Cível',
] as const;

export type AreaAssignment = Record<string, string>; // área → userId

function extract(org: unknown): AreaAssignment {
  const settings = (org as { settings?: { areaAssignment?: AreaAssignment } } | null)?.settings;
  return settings?.areaAssignment ?? {};
}

export const areaAssignmentService = {
  async get(): Promise<AreaAssignment> {
    const { data } = await api.get('/organizations/current');
    return extract(data.data ?? data);
  },
  async update(areaAssignment: AreaAssignment): Promise<AreaAssignment> {
    const { data } = await api.patch('/organizations/current', { areaAssignment });
    return extract(data.data ?? data) || areaAssignment;
  },
};
