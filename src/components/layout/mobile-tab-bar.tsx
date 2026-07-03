'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, MessageSquare, Scale, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileNav } from '@/components/ui/sidebar-layout';
import { useNotificationCenter } from '@/features/notifications/notification-center';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';

// Barra de abas inferior — só no mobile (lg:hidden). Dá a navegação principal
// com toque de app nativo; respeita a barra de gestos do iPhone (pb-safe).

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0d0d0d]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const nav = useMobileNav();
  const { toggle, unreadCount } = useNotificationCenter();
  const unreadConversations = useUnreadConversations();

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
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-zinc-200 bg-white/95 pb-safe backdrop-blur-md dark:border-white/10 dark:bg-[#0d0d0d]/95 lg:hidden"
    >
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
        href="/juridico"
        className={linkCls(isActive(['/juridico', '/processos', '/agenda', '/caixa-djen', '/clientes']))}
      >
        <Scale className="h-5 w-5" />
        <span>Jurídico</span>
      </Link>

      <button type="button" onClick={toggle} className={linkCls(false)}>
        <span className="relative">
          <Bell className="h-5 w-5" />
          <Badge count={unreadCount} />
        </span>
        <span>Avisos</span>
      </button>

      <button type="button" onClick={() => nav?.openSidebar()} className={linkCls(false)}>
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
