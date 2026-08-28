import { create } from 'zustand';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone?: string | null;
}

/**
 * Parceria (subhub) de que o usuário participa. `locked` = ele é PARCEIRO
 * externo: o app inteiro passa a mostrar só o recorte. Isto aqui é APARÊNCIA —
 * a trava de verdade é do servidor (OrgGuard + escopo em cada listagem). Nunca
 * tratar a ausência do flag como permissão.
 */
export interface PartnershipInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  areas: string[];
  boards: string[];
  partnerPct: number;
  role: 'PARTNER' | 'INTERNAL';
  locked: boolean;
  /** `true` = sócio pré-visualizando, não parceiro de verdade. */
  preview?: boolean;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  // 'ALL' for OWNER/ADMIN. Array of channel IDs for AGENT (deny-by-default).
  accessibleChannelIds: 'ALL' | string[];
  // Módulos que ESTE usuário não pode acessar (denylist). Vazio/ausente = tudo.
  restrictedModules?: string[];
  partnerships?: PartnershipInfo[];
}

interface AuthState {
  user: AuthUser | null;
  organizations: OrgInfo[];
  activeOrgId: string | null;
  setAuth: (user: AuthUser, orgs: OrgInfo[]) => void;
  setActiveOrg: (orgId: string) => void;
  applyChannelPermissionUpdate: (channelId: string, granted: boolean) => void;
  setUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organizations: [],
  activeOrgId: typeof window !== 'undefined' ? localStorage.getItem('active_org_id') : null,

  setAuth: (user, organizations) => {
    const stored = localStorage.getItem('active_org_id');
    // Use stored org if it's still in the user's org list, otherwise pick first
    const validStored = stored && organizations.some((o) => o.id === stored) ? stored : null;
    const activeOrgId = validStored || organizations[0]?.id || null;
    if (activeOrgId) localStorage.setItem('active_org_id', activeOrgId);
    set({ user, organizations, activeOrgId });
  },

  setUser: (patch) =>
    set((state) => ({ user: state.user ? { ...state.user, ...patch } : null })),

  setActiveOrg: (orgId) => {
    localStorage.setItem('active_org_id', orgId);
    set({ activeOrgId: orgId });
  },

  applyChannelPermissionUpdate: (channelId, granted) => {
    set((state) => ({
      organizations: state.organizations.map((org) => {
        if (org.id !== state.activeOrgId) return org;
        if (org.accessibleChannelIds === 'ALL') return org;
        const set = new Set(org.accessibleChannelIds);
        if (granted) set.add(channelId);
        else set.delete(channelId);
        return { ...org, accessibleChannelIds: [...set] };
      }),
    }));
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('active_org_id');
    set({ user: null, organizations: [], activeOrgId: null });
    window.location.href = '/login';
  },
}));
