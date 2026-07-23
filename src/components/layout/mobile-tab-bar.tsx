'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, MessageSquare, CalendarCheck, CircleDollarSign, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useMobileNav } from '@/components/ui/sidebar-layout';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';
import { usePendingTasksCount } from '@/features/notifications/use-pending-tasks-count';
import { usePayslipUnreadCount } from '@/features/notifications/use-payslip-notifications';
import { usePreUnseenCount } from '@/features/notifications/use-pre-unseen-count';
import { useDisconnectedChannels } from '@/features/notifications/use-disconnected-channels';
import { useAiCreditHealth } from '@/features/notifications/use-ai-credit-health';

// Barra de abas inferior — só no mobile (lg:hidden). Dá a navegação principal
// com toque de app nativo; respeita a barra de gestos do iPhone (pb-safe).
// As notificações (sino) ficam no topo, canto superior direito (não aqui).

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#15181A]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const nav = useMobileNav();
  const unreadConversations = useUnreadConversations();
  const pendingTasks = usePendingTasksCount();
  const payslipUnread = usePayslipUnreadCount();
  const preUnseen = usePreUnseenCount();
  const disconnected = useDisconnectedChannels();
  const { alert: creditAlert } = useAiCreditHealth();
  const { user, organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const iniciais = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => (p === '/inicio' ? pathname === p : pathname.startsWith(p)));

  const linkCls = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium transition-colors',
      active
        ? 'text-primary'
        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
    );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-zinc-200 bg-white/95 pb-safe backdrop-blur-md dark:border-white/10 dark:bg-[#15181A]/95 lg:hidden"
    >
      <button type="button" onClick={() => nav?.openSidebar()} className={linkCls(false)}>
        <span className="relative">
          <Menu className="h-5 w-5" />
          <Badge count={disconnected + (creditAlert ? 1 : 0)} />
        </span>
        <span>Menu</span>
      </button>

      <Link href="/inicio" className={linkCls(isActive(['/inicio']))}>
        <Sparkles className="h-5 w-5" />
        <span>Início</span>
      </Link>

      <Link href="/inbox" className={linkCls(isActive(['/inbox']))}>
        <span className="relative">
          <MessageSquare className="h-5 w-5" />
          <Badge count={unreadConversations} />
        </span>
        <span>Conversas</span>
      </Link>

      <Link
        href="/agenda"
        className={linkCls(isActive(['/agenda', '/juridico', '/processos', '/caixa-djen', '/clientes']))}
      >
        <span className="relative">
          <CalendarCheck className="h-5 w-5" />
          <Badge count={pendingTasks + preUnseen} />
        </span>
        <span>Agenda</span>
      </Link>

      {isAdmin && (
        <Link href="/financeiro" className={linkCls(isActive(['/financeiro']))}>
          <span className="relative">
            <CircleDollarSign className="h-5 w-5" />
            <Badge count={payslipUnread} />
          </span>
          <span>Financeiro</span>
        </Link>
      )}

      <Link href="/escritorio" className={linkCls(isActive(['/escritorio']))}>
        <span className="relative">
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" className={`h-5 w-5 rounded-full object-cover ${isActive(['/escritorio']) ? 'ring-2 ring-primary' : ''}`} />
            : <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 ${isActive(['/escritorio']) ? 'ring-2 ring-primary' : ''}`}>{iniciais}</span>}
          <Badge count={payslipUnread} />
        </span>
        <span>Você</span>
      </Link>
    </nav>
  );
}
