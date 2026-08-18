'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronUp,
  BookUser,
  Plug,
  Zap,
  MessageCircleHeart,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bot,
  BookOpen,
  AudioLines,
  Cable,
  KanbanSquare,
  Newspaper,
  Folder,
  CalendarCheck,
  LayoutList,
  Columns3,
  LayoutGrid,
  Gavel,
  Scale,
  Workflow,
  CircleDot,
  Tags,
  CircleDollarSign,
  Building2,
  UserCircle,
  Calculator,
  Users,
  BarChart3,
  Landmark,
  Banknote,
  Stethoscope,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';
import { usePendingTasksCount } from '@/features/notifications/use-pending-tasks-count';
import { usePayslipUnreadCount } from '@/features/notifications/use-payslip-notifications';
import { useRepassesPendentesCount } from '@/features/notifications/use-repasses-pendentes';
import { usePreUnseenCount } from '@/features/notifications/use-pre-unseen-count';
import { useDisconnectedChannels } from '@/features/notifications/use-disconnected-channels';
import { useAiCreditHealth } from '@/features/notifications/use-ai-credit-health';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/brand/logo';
import {
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarFooter,
  SidebarSection,
  SidebarSpacer,
} from '@/components/ui/sidebar';
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  DropdownDivider,
} from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';

// ─── Collapsible section header ───────────────────────────────────────────────

// Ponte pai→filhos: uma seção principal registra suas subabas e, ao minimizar,
// recolhe (e persiste fechadas) todas as que ficaram abertas.
type CollapseChild = () => void;
const SectionCollapseContext = createContext<{
  register: (fn: CollapseChild) => () => void;
} | null>(null);

function NavSection({
  label,
  defaultOpen = true,
  storageKey: storageKeyProp,
  variant = 'section',
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  storageKey?: string;
  variant?: 'section' | 'sub';
  children: React.ReactNode;
}) {
  const storageKey = `nav-section:${storageKeyProp ?? label}`;
  const [open, setOpen] = useState(defaultOpen);
  // Restaura o que o usuário deixou aberto/fechado (persistido por seção).
  // Lê no efeito (não no init) pra não dar mismatch de hidratação SSR.
  useEffect(() => {
    // Só as SEÇÕES principais lembram o estado (localStorage). As subabas são
    // EFÊMERAS: ao fechar a mãe elas desmontam e, ao reabrir, voltam fechadas.
    if (variant !== 'section') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === '1');
    } catch {
      /* localStorage indisponível — mantém o default */
    }
  }, [storageKey, variant]);

  const setOpenPersist = (next: boolean) => {
    setOpen(next);
    if (variant !== 'section') return; // subaba não persiste
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      /* ignora */
    }
  };

  // Registro das subabas-filhas (só usado quando esta é uma seção principal).
  const childrenRegistry = useRef(new Set<CollapseChild>());
  const ctxRef = useRef({
    register: (fn: CollapseChild) => {
      childrenRegistry.current.add(fn);
      return () => childrenRegistry.current.delete(fn);
    },
  });
  const parentCtx = useContext(SectionCollapseContext);

  // Sub: registra-se no pai para ser recolhida quando o pai minimizar.
  useEffect(() => {
    if (variant !== 'sub' || !parentCtx) return;
    return parentCtx.register(() => setOpenPersist(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, parentCtx, storageKey]);

  const toggle = () => {
    const next = !open;
    setOpenPersist(next);
    // Ao fechar uma seção principal, recolhe as subabas que ficaram abertas.
    if (!next && variant === 'section') {
      childrenRegistry.current.forEach((fn) => fn());
    }
  };

  const body = (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={toggle}
        className={
          variant === 'section'
            ? 'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors'
            : 'flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors'
        }
      >
        {label}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );

  // Seção principal: expõe o registro para as subabas se auto-recolherem.
  if (variant === 'section') {
    return <SectionCollapseContext.Provider value={ctxRef.current}>{body}</SectionCollapseContext.Provider>;
  }
  return body;
}

// ─── Simple nav link ──────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  badgeTone = 'default',
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  badgeTone?: 'default' | 'danger';
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-white/10 dark:text-white'
          : 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white',
            badgeTone === 'danger' ? 'bg-red-500' : 'bg-primary',
          )}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AppSidebar() {
  const { user, organizations, activeOrgId, logout } = useAuthStore();
  const orgRole = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const unreadConversations = useUnreadConversations();
  const pendingTasks = usePendingTasksCount();
  const payslipUnread = usePayslipUnreadCount();
  const preUnseen = usePreUnseenCount();
  const disconnectedChannels = useDisconnectedChannels();
  const { alert: creditAlert } = useAiCreditHealth();
  const repassesPend = useRepassesPendentesCount();

  return (
    <Sidebar>
      {/* Marca do escritório — clicar no logo leva ao Início (Hub) */}
      <SidebarHeader className="items-center py-4">
        <Link href="/inicio" className="block">
          <Logo size="sm" />
        </Link>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          {/* INÍCIO — item avulso no topo (Hub de boas-vindas), fora das seções */}
          <div className="mb-1 border-b border-zinc-200/70 pb-2 dark:border-zinc-800">
            <NavItem href="/inicio" icon={Sparkles} label="Início" />
            {/* Conquistas — depoimentos dos clientes + placar do escritório.
                Fica junto do Início (o cartão de lá aponta pra cá), fora das
                seções: é do escritório inteiro, não de uma área. */}
            <NavItem href="/conquistas" icon={Heart} label="Conquistas" />
          </div>

          {/* COMERCIAL — BullQ / WhatsApp (Cadastros/Ajustes/Automações em subabas) */}
          <NavSection label="Comercial">
            {/* Geral — subaba (fluxo do dia a dia) */}
            <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
              <NavSection label="Geral" storageKey="Geral-comercial" variant="sub" defaultOpen={false}>
                <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <NavItem href="/inbox" icon={MessageSquare} label="Conversas" badge={unreadConversations} />
              </NavSection>
            </div>

            {/* Cadastros — subaba (base do comercial) */}
            <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
              <NavSection label="Cadastros" storageKey="Cadastros-comercial" variant="sub" defaultOpen={false}>
                <NavItem href="/kanban" icon={KanbanSquare} label="Kanban" />
                <NavItem href="/contacts" icon={BookUser} label="Contatos" />
              </NavSection>
            </div>

            {/* Ajustes — subaba dentro de Comercial (config do atendimento) */}
            <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
              <NavSection label="Ajustes" variant="sub" defaultOpen={false}>
                <NavItem href="/settings/quick-replies" icon={Zap} label="Mensagens rápidas" />
                <NavItem href="/settings/statuses" icon={CircleDot} label="Status" />
                <NavItem href="/settings/tags" icon={Tags} label="Etiquetas" />
                <NavItem href="/conexoes" icon={Cable} label="Conexões" badge={disconnectedChannels} badgeTone="danger" />
              </NavSection>
            </div>

            {/* Automações — subaba dentro de Comercial */}
            <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
              <NavSection label="Automações" variant="sub" defaultOpen={false}>
                <NavItem href="/ai-agents" icon={Bot} label="Agentes" />
                <NavItem href="/follow-ups" icon={MessageCircleHeart} label="Follow-ups" />
                <NavItem href="/base-conhecimento" icon={BookOpen} label="Base de Conhecimento" />
                <NavItem href="/vozes" icon={AudioLines} label="Vozes" />
                <NavItem href="/automations" icon={Zap} label="Automações" />
                <NavItem href="/settings/integrations" icon={Plug} label="Integrações" />
              </NavSection>
            </div>
          </NavSection>

          {/* JURÍDICO — fluxo do dia no topo; Kanbans/Análise/Cadastros em subabas */}
          <div className="mt-3">
            <NavSection label="Jurídico">
              {/* Geral — subaba (fluxo do dia a dia) */}
              <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                <NavSection label="Geral" storageKey="Geral-juridico" variant="sub" defaultOpen={false}>
                  <NavItem href="/juridico" icon={LayoutList} label="Dashboard" />
                  <NavItem href="/agenda" icon={CalendarCheck} label="Agenda" badge={pendingTasks} />
                  <NavItem href="/caixa-djen" icon={Newspaper} label="Publicações" />
                  <NavItem href="/processos" icon={Folder} label="Processos" />
                </NavSection>
              </div>

              {/* Kanbans — subaba (fluxos por fase) */}
              <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                <NavSection label="Kanbans" variant="sub" defaultOpen={false}>
                  <NavItem href="/juridico/pre-processual" icon={Workflow} label="Pré-Processual" badge={preUnseen} />
                  <NavItem href="/juridico/fase-bancaria" icon={Landmark} label="Fase Bancária Investigativa" />
                  <NavItem href="/juridico/repb" icon={Banknote} label="REPB — Reestruturação de Passivo" />
                  <NavItem href="/juridico/kanban" icon={Columns3} label="Fase Judicial" />
                  <NavItem href="/juridico/board/execucao" icon={Gavel} label="Execução & Repasse" />
                  <NavItem href="/juridico/planejamento" icon={TrendingUp} label="Planejamento Previdenciário" />
                  <NavItem href="/juridico/inss-administrativo" icon={Stethoscope} label="INSS Administrativo" />
                  <NavItem href="/juridico/quadros" icon={LayoutGrid} label="Quadros personalizados" />
                </NavSection>
              </div>

              {/* Análise — subaba (consulta / inteligência) */}
              <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                <NavSection label="Análise" variant="sub" defaultOpen={false}>
                  <NavItem href="/juridico/recursos" icon={Scale} label="Recursos" />
                  <NavItem href="/juridico/jurimetria" icon={BarChart3} label="Jurimetria" />
                </NavSection>
              </div>

              {/* Cálculos — subaba (calculadoras jurídicas) */}
              <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                <NavSection label="Cálculos" variant="sub" defaultOpen={false}>
                  <NavItem href="/juridico/calculos" icon={Calculator} label="Calculadoras" />
                </NavSection>
              </div>

              {/* Cadastros — subaba (base) */}
              <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                <NavSection label="Cadastros" storageKey="Cadastros-juridico" variant="sub" defaultOpen={false}>
                  <NavItem href="/clientes" icon={Users} label="Clientes" />
                  <NavItem href="/juridico/partes-adversas" icon={Gavel} label="Parte Adversa" />
                </NavSection>
              </div>
            </NavSection>
          </div>

          {/* ADMINISTRATIVO — só administradores/sócios. Associados NÃO veem
              nada aqui (Financeiro saiu da sidebar deles a pedido do Matheus). */}
          {isAdmin && (
            <div className="mt-3">
              <NavSection label="Administrativo" defaultOpen={false}>
                <NavItem href="/financeiro" icon={CircleDollarSign} label="Financeiro" badge={payslipUnread + repassesPend} badgeTone={repassesPend > 0 ? 'danger' : 'default'} />
                <NavItem href="/rh" icon={Users} label="RH & Seleção" />
                <NavItem href="/contabilidade" icon={Calculator} label="Contabilidade" />
              </NavSection>
            </div>
          )}

        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>

      <SidebarFooter>
        {/* Copiloto — assistente admin, sempre à vista no rodapé (só sócio/admin) */}
        {isAdmin && (
          <div className="mb-1">
            <NavItem href="/copiloto" icon={Bot} label="Copiloto" />
          </div>
        )}
        {/* Ajuda — assistente que ensina a usar o BullQ, aberto a todos os usuários */}
        <div className="mb-1">
          <NavItem href="/ajuda" icon={HelpCircle} label="Ajuda" />
        </div>
        {/* Meu Espaço — fixa, acima de Configurações (perfil, organograma, cargos, cultura, manuais) */}
        <div className="mb-1">
          <NavItem href="/escritorio" icon={UserCircle} label="Meu Espaço" badge={payslipUnread} />
        </div>
        {/* Configurações — fixa logo abaixo do alternador de tema */}
        <div className="mb-1">
          <NavItem href="/settings" icon={Settings} label="Configurações" badge={disconnectedChannels + (creditAlert ? 1 : 0)} badgeTone="danger" />
        </div>
        <Dropdown>
          <DropdownButton className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-zinc-950/5 dark:hover:bg-white/5">
            <Avatar
              src={user?.avatarUrl}
              initials={user?.name?.slice(0, 2).toUpperCase()}
              className="size-8"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm/5 font-medium text-zinc-900 dark:text-white">
                {user?.name}
              </span>
              <span className="block truncate text-xs/5 font-normal text-zinc-500">
                {user?.email}
              </span>
            </span>
            <ChevronUp className="ml-auto size-4 shrink-0 text-zinc-500" />
          </DropdownButton>
          <DropdownMenu anchor="top start" className="min-w-56">
            <DropdownItem href="/settings">
              <Settings />
              <DropdownLabel>Configurações</DropdownLabel>
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem onClick={logout}>
              <LogOut />
              <DropdownLabel>Sair</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </SidebarFooter>
    </Sidebar>
  );
}
