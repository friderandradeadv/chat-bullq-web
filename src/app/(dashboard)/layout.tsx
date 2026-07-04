'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { Logo } from '@/components/brand/logo';
import { useAuthStore } from '@/stores/auth-store';
import { authService } from '@/features/auth/services/auth.service';
import { usePermissionsSync } from '@/features/settings/hooks/use-permissions-sync';
import { ToolFailureBanner } from '@/features/ai-agents/components/tool-failure-banner';
import { GlobalSearch } from '@/components/layout/global-search';
import { ThemeToggle } from '@/features/auth/components/theme-toggle';
import {
  NotificationCenterProvider,
  NotificationBell,
} from '@/features/notifications/notification-center';

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
  if (/^\/settings\/?$/.test(p)) return null; // índice /settings: a página resolve por papel (associado → perfil). Sem isto o guard bloqueava o associado ANTES do redirect e jogava pra /dashboard.
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

  const bellBtnCls =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    // Provider ENVOLVE o SidebarLayout: assim o sino (no app bar do topo, que o
    // SidebarLayout renderiza) e o painel de notificações compartilham o contexto.
    <NotificationCenterProvider>
      <SidebarLayout
        sidebar={<AppSidebar />}
        navbar={
          // Marca centralizada na tela toda (o SidebarLayout posiciona no centro).
          <Link href="/inicio" className="block">
            <Logo size="sm" />
          </Link>
        }
        navbarRight={
          // Canto superior direito do mobile: sino de notificações + tema.
          <>
            <NotificationBell />
            <ThemeToggle className={bellBtnCls} />
          </>
        }
      >
        <div className="flex h-full flex-col">
          <ToolFailureBanner />
          {/* Busca global (estilo Astrea) — SÓ desktop. No mobile a navegação é
              a barra de abas inferior, então esta faixa não aparece (fim do
              empilhamento de 2 barras que dava cara de "web espremida"). */}
          <div className="relative hidden h-11 shrink-0 items-center justify-center border-b border-zinc-200 px-4 dark:border-white/5 lg:flex">
            <GlobalSearch />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <NotificationBell />
              <ThemeToggle className={bellBtnCls} />
            </div>
          </div>
          {/* Conteúdo — no mobile reserva espaço p/ a barra de abas (pb-tabbar). */}
          {/* pb-tabbar dá espaço pra barra de abas do mobile; no desktop tem que
              ZERAR — mas o utilitário custom .pb-tabbar vencia o lg:pb-0 na cascata
              (56px de padding sobravam no rodapé, "cortando" o kanban). O !important
              garante padding-bottom:0 no lg. */}
          <div className="min-h-0 flex-1 pb-tabbar lg:!pb-0">{children}</div>
        </div>
        <MobileTabBar />
      </SidebarLayout>
    </NotificationCenterProvider>
  );
}
