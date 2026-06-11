'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Cable,
  MessageSquare,
  Users,
  Columns3,
  Bot,
  BookOpen,
  AudioLines,
  Workflow,
  Zap,
  Puzzle,
  ClipboardList,
  Settings,
  LogOut,
  ChevronsUpDown,
  Building2,
  ChevronUp,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarFooter,
  SidebarSection,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
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

export function AppSidebar() {
  const { user, organizations, activeOrgId, setActiveOrg, logout } =
    useAuthStore();
  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const pathname = usePathname();

  const handleOrgSwitch = (orgId: string) => {
    setActiveOrg(orgId);
    window.location.reload();
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Dropdown>
          <DropdownButton className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/5 dark:text-white dark:hover:bg-white/5">
            <Avatar
              initials={activeOrg?.name?.slice(0, 2).toUpperCase()}
              className="size-6 bg-primary text-[10px] text-primary-foreground"
              square
            />
            <span className="min-w-0 flex-1 truncate">
              {activeOrg?.name ?? 'Organização'}
            </span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-zinc-500" />
          </DropdownButton>
          {organizations.length > 1 && (
            <DropdownMenu anchor="bottom start" className="min-w-56">
              {organizations.map((org) => (
                <DropdownItem
                  key={org.id}
                  onClick={() => handleOrgSwitch(org.id)}
                >
                  <Building2 />
                  <DropdownLabel>{org.name}</DropdownLabel>
                </DropdownItem>
              ))}
            </DropdownMenu>
          )}
        </Dropdown>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="/dashboard">
            <LayoutGrid className="size-5" />
            <SidebarLabel>Dashboard</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/conexoes">
            <Cable className="size-5" />
            <SidebarLabel>Conexões</SidebarLabel>
          </SidebarItem>
        </SidebarSection>

        <SidebarSection>
          <SidebarHeading>Atendimento</SidebarHeading>
          <SidebarItem href="/inbox">
            <MessageSquare className="size-5" />
            <SidebarLabel>Conversas</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/contacts">
            <Users className="size-5" />
            <SidebarLabel>Contatos</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/pipelines">
            <Columns3 className="size-5" />
            <SidebarLabel>Kanban</SidebarLabel>
          </SidebarItem>
        </SidebarSection>

        <SidebarSection>
          <SidebarHeading>Automações</SidebarHeading>
          <SidebarItem href="/ai-agents">
            <Bot className="size-5" />
            <SidebarLabel>Agentes</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/base-conhecimento">
            <BookOpen className="size-5" />
            <SidebarLabel>Base de Conhecimento</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/vozes">
            <AudioLines className="size-5" />
            <SidebarLabel>Vozes</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/chatbot">
            <Workflow className="size-5" />
            <SidebarLabel>Chatbot</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/automations">
            <Zap className="size-5" />
            <SidebarLabel>Automações</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/settings/integrations">
            <Puzzle className="size-5" />
            <SidebarLabel>Integrações</SidebarLabel>
          </SidebarItem>
        </SidebarSection>

        <SidebarSection>
          <SidebarItem href="/tarefas">
            <ClipboardList className="size-5" />
            <SidebarLabel>Tarefas</SidebarLabel>
          </SidebarItem>
          <SidebarItem
            href="/settings"
            current={
              pathname.startsWith('/settings') &&
              !pathname.startsWith('/settings/integrations')
            }
          >
            <Settings className="size-5" />
            <SidebarLabel>Configurações</SidebarLabel>
          </SidebarItem>
        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>

      <SidebarFooter>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
        <Dropdown>
          <DropdownButton className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-zinc-950/5 dark:hover:bg-white/5">
            <Avatar
              src={user?.avatarUrl}
              initials={user?.name?.slice(0, 2).toUpperCase()}
              className="size-10"
              square
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                {user?.name}
              </span>
              <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
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
