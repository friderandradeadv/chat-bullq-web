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

/** Mapeia a rota atual para o módulo gateável (ou null = sempre liberado). */
function moduleForPath(p: string): string | null {
  if (/^\/(juridico|processos|agenda|caixa-djen)/.test(p)) return 'juridico';
  if (/^\/(ai-agents|follow-ups|base-conhecimento|vozes|automations)/.test(p)) return 'automacoes';
  if (/^\/(financeiro|contabilidade)/.test(p)) return 'financeiro';
  if (/^\/tarefas/.test(p)) return 'tarefas';
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
    const restricted = activeOrg.restrictedModules ?? [];
    if (restricted.length === 0) return;
    const mod = moduleForPath(pathname);
    if (mod && restricted.includes(mod)) {
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
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </SidebarLayout>
  );
}
