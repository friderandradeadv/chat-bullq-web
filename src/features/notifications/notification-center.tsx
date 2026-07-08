'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  X,
  CheckCheck,
  MessageSquare,
  Users,
  ArrowRightLeft,
  AlertTriangle,
  AtSign,
  Cog,
  FileSignature,
  CircleDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from './use-notifications';
import {
  notificationHref,
  type AppNotification,
  type NotificationType,
} from './notifications.service';

// ── Contexto: abre/fecha o painel de qualquer lugar (sino no topo, aba mobile).
interface NotificationCenterCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  unreadCount: number;
}
const Ctx = createContext<NotificationCenterCtx | null>(null);

export function useNotificationCenter() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotificationCenter fora do provider');
  return ctx;
}

const ICONS: Record<NotificationType, React.ElementType> = {
  NEW_MESSAGE: MessageSquare,
  CONVERSATION_ASSIGNED: Users,
  CONVERSATION_TRANSFERRED: ArrowRightLeft,
  SLA_WARNING: AlertTriangle,
  SLA_BREACH: AlertTriangle,
  MENTION: AtSign,
  SYSTEM: Cog,
  AI_TOOL_FAILURE: AlertTriangle,
};

function iconFor(n: AppNotification): React.ElementType {
  // Contrato (assinado/gerado) vem como SYSTEM com data.kind — usa ícone próprio.
  const kind = n.data?.kind;
  if (kind === 'contract_signed' || kind === 'contract_generated') return FileSignature;
  if (kind === 'payslip_updated') return CircleDollarSign;
  return ICONS[n.type] ?? Cog;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const onItemClick = (n: AppNotification) => {
    if (!n.isRead) void markRead(n.id);
    setOpen(false);
    router.push(notificationHref(n));
  };

  return (
    <Ctx.Provider value={{ open, setOpen, toggle, unreadCount }}>
      {children}

      {open && (
        <>
          {/* Backdrop — no mobile escurece; no desktop é invisível mas fecha ao clicar fora. */}
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Notificações"
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden bg-white shadow-xl ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10',
              // Mobile: bottom sheet acima da barra de abas, respeitando a safe-area.
              'inset-x-0 bottom-0 max-h-[75svh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
              // Desktop: dropdown no canto superior direito.
              'lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-14 lg:max-h-[70vh] lg:w-96 lg:rounded-xl lg:pb-0',
            )}
          >
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Notificações
                </h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Marcar lidas</span>
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
                  Carregando…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-500">Nada por aqui</p>
                  <p className="text-xs text-zinc-400">
                    Avisos de conversas atribuídas, contratos e prazos aparecem aqui.
                  </p>
                </div>
              ) : (
                <ul>
                  {notifications.map((n) => {
                    const Icon = iconFor(n);
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => onItemClick(n)}
                          className={cn(
                            'flex w-full items-start gap-3 border-b border-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5',
                            !n.isRead && 'bg-primary/5 dark:bg-primary/10',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                              n.isRead
                                ? 'bg-zinc-100 text-zinc-400 dark:bg-white/5'
                                : 'bg-primary/15 text-primary',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  'truncate text-sm',
                                  n.isRead
                                    ? 'font-medium text-zinc-600 dark:text-zinc-300'
                                    : 'font-semibold text-zinc-900 dark:text-white',
                                )}
                              >
                                {n.title}
                              </span>
                              <span className="shrink-0 text-[11px] text-zinc-400">
                                {timeAgo(n.createdAt)}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500 dark:text-zinc-400">
                              {n.body}
                            </span>
                          </span>
                          {!n.isRead && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}

/** Sino do topo (desktop) — botão com badge que abre o painel. */
export function NotificationBell({ className }: { className?: string }) {
  const { toggle, unreadCount } = useNotificationCenter();
  return (
    <button
      onClick={toggle}
      aria-label="Notificações"
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className,
      )}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
