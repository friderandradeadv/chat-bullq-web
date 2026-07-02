import { useAuthStore } from '@/stores/auth-store';

/**
 * Permissões por papel na organização ativa.
 *
 * OWNER/ADMIN = "sócios": acesso e gestão totais.
 * AGENT = "associado": trabalha só no que é dele; não apaga nem altera
 * configurações/financeiro/membros.
 *
 * A regra é SEMPRE reforçada no backend — este hook serve para esconder
 * botões/ações que o associado não pode executar (evita 403 e sabotagem).
 */
export function usePermissions() {
  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role ?? null;
  const isSocio = role === 'OWNER' || role === 'ADMIN';
  return {
    role,
    isSocio,
    isOwner: role === 'OWNER',
    /** pode apagar/arquivar processos, clientes, documentos, ações em massa */
    canDeleteCases: isSocio,
    /** pode lançar/editar/excluir no financeiro */
    canManageFinance: isSocio,
    /** pode gerir membros, papéis e configurações da organização */
    canManageOrg: isSocio,
  };
}
