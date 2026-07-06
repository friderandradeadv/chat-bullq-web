'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { SimpleTabBar } from '@/components/layout/simple-tab-bar';
import { useNavMode } from '@/stores/nav-mode-store';
import { LayoutList, PanelLeft } from 'lucide-react';
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

  // Modo da navegação (desktop): 'simples' esconde a sidebar e usa a barra
  // inferior (igual ao mobile). Hidrata do localStorage no cliente.
  const { modo, hydrated, hydrate, setModo } = useNavMode();
  useEffect(() => { hydrate(); }, [hydrate]);
  const simples = hydrated && modo === 'simples';

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
        hideDesktopSidebar={simples}
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
        <div className="relative isolate flex h-full flex-col">
          <ToolFailureBanner />
          {/* Busca global (estilo Astrea) — SÓ desktop. No mobile a navegação é
              a barra de abas inferior, então esta faixa não aparece (fim do
              empilhamento de 2 barras que dava cara de "web espremida"). */}
          {/* Barra superior estilo Trello: tom escuro do modo escuro (#1D2125). A
              classe `dark` faz TODOS os controles internos (busca, toggle, sino,
              tema) herdarem o estilo escuro/translúcido — casam com a barra. */}
          <div className="dark relative hidden h-11 shrink-0 items-center justify-center border-b border-white/10 bg-[#1D2125] px-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_0_rgba(0,0,0,0.25)] lg:flex">
            {/* Camadas de "vidro fosco" (o dark mode não tem wallpaper pra borrar,
                então simulamos a luz atravessando o vidro): realce no topo + leve
                brilho central. pointer-events-none pra não roubar clique dos controles. */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] via-white/[0.015] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-1/4 right-1/4 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_70%)]" />
            {/* Modo simples: a MARCA minimalista (FA. clara, clicável → Início) no
                canto superior esquerdo — versão clara pra contrastar na barra escura. */}
            {simples && (
              <Link href="/inicio" title="Início" className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
                <img src="/favicon-dark.png" alt="Início" className="h-8 w-8 object-contain" />
              </Link>
            )}
            <GlobalSearch />
            <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
              {/* Alternador Completo × Simples (simples = navegação na barra de baixo) */}
              <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md dark:bg-white/10 dark:ring-1 dark:ring-inset dark:ring-white/10">
                <button onClick={() => setModo('completo')} title="Menu lateral completo" className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${!simples ? 'bg-white text-zinc-800 shadow-sm dark:bg-white/20 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white'}`}><PanelLeft className="h-3.5 w-3.5" /> Completo</button>
                <button onClick={() => setModo('simples')} title="Atalhos na barra de baixo (como no celular)" className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${simples ? 'bg-white text-zinc-800 shadow-sm dark:bg-white/20 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white'}`}><LayoutList className="h-3.5 w-3.5" /> Simples</button>
              </div>
              <NotificationBell className="dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:backdrop-blur-md dark:hover:bg-white/20 dark:hover:text-white" />
              <ThemeToggle className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:bg-white/20 hover:text-white" />
            </div>
          </div>
          {/* Conteúdo — no mobile reserva espaço p/ a barra de abas (pb-tabbar). */}
          {/* pb-tabbar dá espaço pra barra de abas do mobile; no desktop tem que
              ZERAR — mas o utilitário custom .pb-tabbar vencia o lg:pb-0 na cascata
              (56px de padding sobravam no rodapé, "cortando" o kanban). O !important
              garante padding-bottom:0 no lg. */}
          <div className={`min-h-0 flex-1 pb-tabbar ${simples ? 'lg:pb-16' : 'lg:!pb-0'}`}>{children}</div>
        </div>
        <MobileTabBar />
        {/* Modo simples: barra de atalhos inferior também no desktop */}
        {simples && <SimpleTabBar />}
      </SidebarLayout>
    </NotificationCenterProvider>
  );
}
