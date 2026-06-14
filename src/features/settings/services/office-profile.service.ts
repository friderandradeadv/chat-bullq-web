import { api } from '@/lib/api';

/**
 * Dados gerais do escritório (tela "Geral", igual ao LíderHub). Persistido em
 * `organization.settings.officeProfile`. Alimenta as @variáveis do prompt dos
 * agentes (@Nome do escritório, @CNPJ, @OAB, @Endereço, @Instagram, @Site,
 * @Responsável) — resolvidas em runtime pelo backend.
 */
export interface OfficeProfile {
  /** Nome da empresa/workspace (ex.: "TRABALHISTA - Frider Andrade"). */
  empresa?: string;
  /** Nome do escritório/marca (→ @Nome do escritório). */
  escritorio?: string;
  /** Advogado responsável (→ @Responsável). */
  responsavel?: string;
  /** CNPJ (→ @CNPJ). */
  cnpj?: string;
  /** OAB (→ @OAB). */
  oab?: string;
  /** Endereço (→ @Endereço / @Endereço do escritório). */
  endereco?: string;
  /** Instagram (→ @Instagram). */
  instagram?: string;
  /** Facebook (→ @Facebook). */
  facebook?: string;
  /** Site (→ @Site). */
  site?: string;
}

function extractProfile(org: unknown): OfficeProfile {
  const settings = (org as { settings?: { officeProfile?: OfficeProfile } } | null)?.settings;
  return settings?.officeProfile ?? {};
}

export const officeProfileService = {
  async get(): Promise<OfficeProfile> {
    const { data } = await api.get('/organizations/current');
    return extractProfile(data.data ?? data);
  },

  async update(officeProfile: OfficeProfile): Promise<OfficeProfile> {
    const { data } = await api.patch('/organizations/current', { officeProfile });
    return extractProfile(data.data ?? data) || officeProfile;
  },
};

/** Campos da tela "Geral" — ordem/labels/placeholders idênticos ao LíderHub. */
export const OFFICE_PROFILE_FIELDS: Array<{
  key: keyof OfficeProfile;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { key: 'empresa', label: 'Empresa', placeholder: 'Ex: Minha Empresa' },
  { key: 'escritorio', label: 'Nome do escritório', placeholder: 'Ex: Silva & Associados', hint: 'Vira a variável @Nome do escritório' },
  { key: 'responsavel', label: 'Advogado responsável', placeholder: 'Ex: João da Silva', hint: 'Vira a variável @Responsável' },
  { key: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', hint: 'Vira a variável @CNPJ' },
  { key: 'oab', label: 'OAB', placeholder: 'Ex: OAB/SP 123456', hint: 'Vira a variável @OAB' },
  { key: 'endereco', label: 'Endereço', placeholder: 'Rua, número, bairro, cidade - UF', hint: 'Vira a variável @Endereço' },
  { key: 'instagram', label: 'Instagram', placeholder: '@usuario', hint: 'Vira a variável @Instagram' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...', hint: 'Vira a variável @Facebook' },
  { key: 'site', label: 'Site', placeholder: 'https://...', hint: 'Vira a variável @Site' },
];
