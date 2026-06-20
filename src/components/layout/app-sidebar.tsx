'use client';

import { useEffect, useState } from 'react';
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
  ClipboardList,
  Cable,
  KanbanSquare,
  Newspaper,
  Folder,
  CalendarCheck,
  LayoutList,
  Columns3,
  Sun,
  Moon,
  CircleDot,
  Tags,
  Wallet,
  Calculator,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
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

function NavSection({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const storageKey = `nav-section:${label}`;
  const [open, setOpen] = useState(defaultOpen);
  // Restaura o que o usuário deixou aberto/fechado (persistido por seção).
  // Lê no efeito (não no init) pra não dar mismatch de hidratação SSR.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === '1');
    } catch {
      /* localStorage indisponível — mantém o default */
    }
  }, [storageKey]);
  const toggle = () =>
    setOpen((p) => {
      const next = !p;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* ignora */
      }
      return next;
    });
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
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
}

// ─── Simple nav link ──────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
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
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Sidebar>
      {/* Marca do escritório — centralizada, caixa justa na logo */}
      <SidebarHeader className="items-center py-4">
        <Link href="/dashboard" className="block">
          <Logo size="sm" />
        </Link>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          {/* COMERCIAL — BullQ / WhatsApp (com Automações como subaba dentro) */}
          <NavSection label="Comercial">
            <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem href="/inbox" icon={MessageSquare} label="Conversas" />
            <NavItem href="/contacts" icon={BookUser} label="Contatos" />
            <NavItem href="/kanban" icon={KanbanSquare} label="Kanban" />
            <NavItem href="/settings/quick-replies" icon={Zap} label="Mensagens rápidas" />
            <NavItem href="/settings/statuses" icon={CircleDot} label="Status" />
            <NavItem href="/settings/tags" icon={Tags} label="Etiquetas" />
            <NavItem href="/conexoes" icon={Cable} label="Conexões" />

            {/* Automações — subaba dentro de Comercial */}
            <div className="mt-1.5 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
              <NavSection label="Automações" defaultOpen={false}>
                <NavItem href="/ai-agents" icon={Bot} label="Agentes" />
                <NavItem href="/follow-ups" icon={MessageCircleHeart} label="Follow-ups" />
                <NavItem href="/base-conhecimento" icon={BookOpen} label="Base de Conhecimento" />
                <NavItem href="/vozes" icon={AudioLines} label="Vozes" />
                <NavItem href="/automations" icon={Zap} label="Automações" />
                <NavItem href="/settings/integrations" icon={Plug} label="Integrações" />
              </NavSection>
            </div>
          </NavSection>

          {/* JURÍDICO — Prazos removido (= Agenda/Tarefas); Caixa DJEN → Publicações */}
          <div className="mt-3">
            <NavSection label="Jurídico">
              <NavItem href="/juridico" icon={LayoutList} label="Dashboard" />
              <NavItem href="/juridico/kanban" icon={Columns3} label="Kanban de processos" />
              <NavItem href="/agenda" icon={CalendarCheck} label="Agenda" />
              <NavItem href="/processos" icon={Folder} label="Processos" />
              <NavItem href="/caixa-djen" icon={Newspaper} label="Publicações" />
              <NavItem href="/clientes" icon={Users} label="Clientes" />
            </NavSection>
          </div>

          {/* ADMINISTRATIVO — Financeiro, Contabilidade, etc. */}
          <div className="mt-3">
            <NavSection label="Administrativo" defaultOpen={false}>
              <NavItem href="/financeiro" icon={Wallet} label="Financeiro" />
              <NavItem href="/contabilidade" icon={Calculator} label="Contabilidade" />
            </NavSection>
          </div>

          {/* Tarefas + Configurações */}
          <div className="mt-3 flex flex-col gap-0.5">
            <NavItem href="/tarefas" icon={ClipboardList} label="Tarefas" />
            <NavItem href="/settings" icon={Settings} label="Configurações" />
          </div>
        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>

      <SidebarFooter>
        {/* Alternador de tema (claro/escuro) */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 text-left">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
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
