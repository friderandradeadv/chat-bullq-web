'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';
import { usePendingTasksCount } from '@/features/notifications/use-pending-tasks-count';
import { usePayslipUnreadCount } from '@/features/notifications/use-payslip-notifications';
import { usePreUnseenCount } from '@/features/notifications/use-pre-unseen-count';
import { useDisconnectedChannels } from '@/features/notifications/use-disconnected-channels';
import { useAiCreditHealth } from '@/features/notifications/use-ai-credit-health';
import { useRepassesPendentesCount } from '@/features/notifications/use-repasses-pendentes';
import { useMobileNav } from '@/components/ui/sidebar-layout';
import { useNavMode, barItemById, DEFAULT_SIMPLE_BAR } from '@/stores/nav-mode-store';

// Barra de atalhos do MODO SIMPLES (desktop) — mesma pegada da barra de baixo do
// mobile, mas com os atalhos que o usuário escolhe (editável nas Configurações).
// O item 'menu' abre o menu lateral completo (drawer). Só no desktop (lg:flex).

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#15181A]">
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
  const disconnected = useDisconnectedChannels();
  const { alert: creditAlert } = useAiCreditHealth();
  const repassesPend = useRepassesPendentesCount();
  const nav = useMobileNav();
  const { barItems, hydrated } = useNavMode();
  const { user, organizations, activeOrgId } = useAuthStore();
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
      className="fixed inset-x-0 bottom-0 z-30 hidden items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#15181A]/95 lg:flex"
    >
      {items.map((it) => {
        const Icon = it.icon;
        // Contagem do badge por atalho: conversas (não lidas), agenda (tarefas a
        // concluir hoje), financeiro/espaço (movimentações do holerite).
        const count =
          it.id === 'conversas' ? unread :
          it.id === 'agenda' ? pendingTasks :
          it.id === 'pre-processual' ? preUnseen :
          it.id === 'config' ? disconnected + (creditAlert ? 1 : 0) :
          it.id === 'financeiro' ? payslipUnread + repassesPend :
          it.id === 'espaco' ? payslipUnread : 0;
        const baseIcon = it.id === 'espaco' ? avatarEl(isActive('/escritorio')) : <Icon className="h-5 w-5" />;
        const iconEl = <span className="relative">{baseIcon}<Badge count={count} /></span>;
        if (it.action === 'menu') {
          return (
            <button key={it.id} type="button" onClick={() => nav?.openSidebar()} className={linkCls(false)}>
              {iconEl}<span>{it.label}</span>
            </button>
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
