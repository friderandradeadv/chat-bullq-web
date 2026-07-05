'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, MessageSquare, CalendarCheck, Workflow, Columns3, Calculator, CircleDollarSign, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadConversations } from '@/features/notifications/use-unread-conversations';

// Barra de atalhos do MODO SIMPLES (desktop) — mesma pegada da barra de baixo do
// mobile, mas com os atalhos que o escritório mais usa. Só aparece no desktop
// (lg:flex); no mobile quem manda é a MobileTabBar. O sino/tema ficam no topo.

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0d0d0d]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function SimpleTabBar() {
  const pathname = usePathname();
  const unread = useUnreadConversations();
  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const active = (p: string) => (p === '/inicio' ? pathname === p : pathname.startsWith(p));
  const linkCls = (a: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors',
      a ? 'text-primary' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
    );

  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-30 hidden items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#0d0d0d]/95 lg:flex"
    >
      <Link href="/inicio" className={linkCls(active('/inicio'))}>
        <Sparkles className="h-5 w-5" /><span>Início</span>
      </Link>
      <Link href="/inbox" className={linkCls(active('/inbox'))}>
        <span className="relative"><MessageSquare className="h-5 w-5" /><Badge count={unread} /></span><span>Conversas</span>
      </Link>
      <Link href="/agenda" className={linkCls(active('/agenda'))}>
        <CalendarCheck className="h-5 w-5" /><span>Agenda</span>
      </Link>
      <Link href="/juridico/pre-processual" className={linkCls(active('/juridico/pre-processual'))}>
        <Workflow className="h-5 w-5" /><span>Pré-Processual</span>
      </Link>
      <Link href="/juridico/kanban" className={linkCls(active('/juridico/kanban'))}>
        <Columns3 className="h-5 w-5" /><span>Fase Judicial</span>
      </Link>
      <Link href="/juridico/calculos" className={linkCls(active('/juridico/calculos'))}>
        <Calculator className="h-5 w-5" /><span>Cálculos</span>
      </Link>
      {isAdmin && (
        <Link href="/financeiro" className={linkCls(active('/financeiro'))}>
          <CircleDollarSign className="h-5 w-5" /><span>Financeiro</span>
        </Link>
      )}
      <Link href="/escritorio" className={linkCls(active('/escritorio'))}>
        <UserCircle className="h-5 w-5" /><span>Espaço</span>
      </Link>
    </nav>
  );
}
