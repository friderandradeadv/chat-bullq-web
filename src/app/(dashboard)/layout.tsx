'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Navbar, NavbarSection, NavbarSpacer } from '@/components/ui/navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuthStore } from '@/stores/auth-store';
import { authService } from '@/features/auth/services/auth.service';
import { usePermissionsSync } from '@/features/settings/hooks/use-permissions-sync';
import { ToolFailureBanner } from '@/features/ai-agents/components/tool-failure-banner';
import { GlobalSearch } from '@/components/layout/global-search';

// Bloquear o pai também bloqueia o filho (ex.: sem "Jurídico" → sem Análise/Cálculos).
const MODULE_PARENT: Record<string, string> = { analise: 'juridico', calculos: 'juridico' };

/** Mapeia a rota atual para o módulo gateável (ou null = sempre liberado). Do mais específico p/ o geral. */
function moduleForPath(p: string): string | null {
  if (/^\/juridico\/(recursos|jurimetria)/.test(p)) return 'analise';
  if (/^\/juridico\/calculos/.test(p)) return 'calculos';
  if (/^\/(juridico|processos|agenda|caixa-djen|clientes)/.test(p)) return 'juridico';
  if (/^\/(ai-agents|follow-ups|base-conhecimento|vozes|automations)/.test(p)) return 'automacoes';
  if (/^\/contabilidade/.test(p)) return 'contabilidade';
  if (/^\/financeiro/.test(p)) return 'financeiro';
  if (/^\/tarefas/.test(p)) return 'tarefas';
  if (/^\/escritorio/.test(p)) return 'meu_espaco';
  if (/^\/(dashboard|inbox|contacts|kanban|conexoes)/.test(p)) return 'atendimento';
  if (/^\/settings\/perfil/.test(p)) return null; // perfil é sempre acessível
  if (/^\/settings/.test(p)) return 'configuracoes';
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setAuth, activeOrgId, setActiveOrg, organizations } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  usePermissionsSync();

  // ── Trava por módulo: redireciona quem não tem acesso à área da rota atual.
  // OWNER/ADMIN têm restrictedModules vazio (vêm assim da API) → nunca barra.
  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  useEffect(() => {
    if (isLoading || !activeOrg) return;
    const isAdmin = activeOrg.role === 'OWNER' || activeOrg.role === 'ADMIN';
    const mod = moduleForPath(pathname);
    // Contabilidade é exclusiva de administradores (associados não têm acesso).
    if (mod === 'contabilidade' && !isAdmin) { router.replace('/financeiro'); return; }
    const restricted = activeOrg.restrictedModules ?? [];
    if (restricted.length === 0) return;
    if (mod && (restricted.includes(mod) || (MODULE_PARENT[mod] && restricted.includes(MODULE_PARENT[mod])))) {
      router.replace(restricted.includes('atendimento') ? '/settings/perfil' : '/dashboard');
    }
  }, [pathname, activeOrg, isLoading, router]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (user) {
      setIsLoading(false);
      return;
    }

    authService
      .getMe()
      .then((data) => {
        setAuth(data.user, data.organizations);
        // Ensure activeOrgId is set (setAuth handles this, but double-check)
        const currentOrgId = localStorage.getItem('active_org_id');
        if (!currentOrgId && data.organizations.length > 0) {
          setActiveOrg(data.organizations[0].id);
        }
        setIsLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.replace('/login');
      });
  }, [router, user, setAuth, setActiveOrg]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarLayout
      sidebar={<AppSidebar />}
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection><></></NavbarSection>
        </Navbar>
      }
    >
      <div className="flex h-full flex-col">
        <ToolFailureBanner />
        {/* Barra de busca global central (estilo Astrea) — em cima de todas as telas. */}
        <div className="flex h-11 shrink-0 items-center justify-center border-b border-zinc-200 px-4 dark:border-white/5">
          <GlobalSearch />
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </SidebarLayout>
  );
}
