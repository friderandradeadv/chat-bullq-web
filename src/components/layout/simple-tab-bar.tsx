'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';
import { usePendingTasksCount } from '@/features/notifications/use-pending-tasks-count';
import { usePayslipUnreadCount } from '@/features/notifications/use-payslip-notifications';
import { usePreUnseenCount } from '@/features/notifications/use-pre-unseen-count';
import { useRepbNewLeadsCount } from '@/features/notifications/use-repb-new-leads-count';
import { useDisconnectedChannels } from '@/features/notifications/use-disconnected-channels';
import { useAiCreditHealth } from '@/features/notifications/use-ai-credit-health';
import { useRepassesPendentesCount } from '@/features/notifications/use-repasses-pendentes';
import { useContasVencendo } from '@/features/notifications/use-vencimentos-hoje';
import { useMobileNav } from '@/components/ui/sidebar-layout';
import { useNavMode, barItemById, DEFAULT_SIMPLE_BAR } from '@/stores/nav-mode-store';
import { useDockSafeArea } from '@/components/layout/use-dock-safe-area';
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  DropdownDivider,
} from '@/components/ui/dropdown';
import { UserCircle, Settings, LogOut } from 'lucide-react';

// Barra de atalhos do MODO SIMPLES (desktop) — mesma pegada da barra de baixo do
// mobile, mas com os atalhos que o usuário escolhe (editável nas Configurações).
// O item 'menu' abre o menu lateral completo (drawer). Só no desktop (lg:flex).

// tone: vermelho é o padrão (algo atrasado/pendente); laranja é o "atenção hoje",
// usado quando a bolinha do Financeiro só tem conta vencendo no próprio dia.
function Badge({ count, tone = 'red' }: { count: number; tone?: 'red' | 'orange' }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -right-2 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#15181A]',
        tone === 'orange' ? 'bg-orange-500' : 'bg-red-500',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function SimpleTabBar() {
  const pathname = usePathname();
  const unread = useUnreadConversations();
  const pendingTasks = usePendingTasksCount();
  const payslipUnread = usePayslipUnreadCount();
  const preUnseen = usePreUnseenCount();
  const repbNew = useRepbNewLeadsCount();
  const disconnected = useDisconnectedChannels();
  const { alert: creditAlert } = useAiCreditHealth();
  const repassesPend = useRepassesPendentesCount();
  const contas = useContasVencendo();
  const nav = useMobileNav();
  const { barItems, hydrated } = useNavMode();
  const { user, organizations, activeOrgId, logout } = useAuthStore();
  // Mede o quanto o Dock do macOS cobre o rodapé e publica em `--dock-safe`.
  useDockSafeArea();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const iniciais = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  // O item "Espaço" mostra a foto do usuário (dinâmico) — como clicar no perfil.
  const avatarEl = (active: boolean) =>
    user?.avatarUrl
      ? <img src={user.avatarUrl} alt="" className={`h-5 w-5 rounded-full object-cover ${active ? 'ring-2 ring-primary' : ''}`} />
      : <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 ${active ? 'ring-2 ring-primary' : ''}`}>{iniciais}</span>;

  const isActive = (href: string) => (href === '/inicio' ? pathname === href : pathname.startsWith(href));
  const linkCls = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors',
      active ? 'text-primary' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
    );

  const items = (hydrated ? barItems : DEFAULT_SIMPLE_BAR)
    .map(barItemById)
    .filter((it): it is NonNullable<typeof it> => !!it && (!it.adminOnly || isAdmin));

  return (
    <nav
      aria-label="Atalhos"
      // paddingBottom = altura coberta pelo Dock: o fundo desce até bottom-0
      // (atrás do Dock), mas a fileira de atalhos sobe pra ficar sempre visível.
      style={{ paddingBottom: 'var(--dock-safe, 0px)' }}
      className="fixed inset-x-0 bottom-0 z-30 hidden items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#15181A]/95 lg:flex"
    >
      {items.map((it) => {
        const Icon = it.icon;
        // Contagem do badge por atalho: conversas (não lidas), agenda (tarefas a
        // concluir hoje), financeiro (holerite + repasses + contas vencendo/vencidas),
        // espaço (movimentações do holerite).
        const count =
          it.id === 'conversas' ? unread :
          it.id === 'agenda' ? pendingTasks :
          it.id === 'pre-processual' ? preUnseen :
          it.id === 'repb' ? repbNew :
          it.id === 'config' ? disconnected + (creditAlert ? 1 : 0) :
          it.id === 'financeiro' ? payslipUnread + repassesPend + contas.count :
          it.id === 'espaco' ? payslipUnread : 0;
        // Financeiro fica LARANJA só quando tudo que a bolinha mostra vence hoje;
        // qualquer atraso (conta vencida, holerite, repasse) a põe em vermelho.
        const tone: 'red' | 'orange' =
          it.id === 'financeiro' && contas.vencidas + payslipUnread + repassesPend === 0 ? 'orange' : 'red';
        const baseIcon = it.id === 'espaco' ? avatarEl(isActive('/escritorio')) : <Icon className="h-5 w-5" />;
        const iconEl = <span className="relative">{baseIcon}<Badge count={count} tone={tone} /></span>;
        if (it.action === 'menu') {
          return (
            <button key={it.id} type="button" onClick={() => nav?.openSidebar()} className={linkCls(false)}>
              {iconEl}<span>{it.label}</span>
            </button>
          );
        }
        // "Você": em vez de navegar, abre um menu (perfil, configurações, sair)
        // — como o avatar nas redes sociais. Menu abre PRA CIMA (top end) pra
        // não sair da tela nem cair atrás do Dock.
        if (it.id === 'espaco') {
          return (
            <Dropdown key={it.id}>
              <DropdownButton className={linkCls(isActive('/escritorio'))}>
                {iconEl}<span>{it.label}</span>
              </DropdownButton>
              <DropdownMenu anchor="top end" className="mb-1 min-w-56">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  {avatarEl(false)}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{user?.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{user?.email}</span>
                  </span>
                </div>
                <DropdownDivider />
                <DropdownItem href="/escritorio">
                  <UserCircle />
                  <DropdownLabel>Meu Espaço</DropdownLabel>
                </DropdownItem>
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
          );
        }
        return (
          <Link key={it.id} href={it.href!} className={linkCls(isActive(it.href!))}>
            {iconEl}<span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
