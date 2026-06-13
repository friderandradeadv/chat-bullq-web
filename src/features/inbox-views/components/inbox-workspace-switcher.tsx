'use client';

/**
 * Seletor de workspace (área) do inbox — estilo LíderHub. Substitui o título
 * "Conversas" no topo da coluna: um único botão que mostra a área ATUAL e,
 * ao clicar, abre um dropdown pra ESCOLHER/ENTRAR em outra (Geral + áreas +
 * visualizações). Não é uma régua de filtros — é "em qual espaço você está".
 * Trocar seta `?view=<id>` (a ConversationList já busca por isso).
 */

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  Inbox,
  MessageSquare,
  Phone,
  Instagram,
  Mail,
  MailOpen,
  Send,
  Users,
  Tag,
  Star,
  Filter,
  Archive,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Check,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { inboxViewsService, type InboxView } from '../services/inbox-views.service';
import { InboxViewDialog } from './inbox-view-dialog';

const VIEW_ICON: Record<string, React.ElementType> = {
  Inbox,
  MessageSquare,
  Phone,
  Instagram,
  Mail,
  MailOpen,
  Send,
  Users,
  Tag,
  Star,
  Filter,
  Archive,
};

const ICON_COLOR: Record<string, string> = {
  default: 'text-zinc-500 dark:text-zinc-400',
  green: 'text-green-600 dark:text-green-400',
  pink: 'text-pink-600 dark:text-pink-400',
  violet: 'text-violet-600 dark:text-violet-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

function useViewCount(id: string): number {
  const { data } = useQuery({
    queryKey: ['inbox-view-count', id],
    queryFn: () =>
      inboxViewsService
        .getConversations(id, { limit: '1' })
        .then((r) => r.pagination?.total ?? 0)
        .catch(() => 0),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  return data ?? 0;
}

function CountBadge({ id, active }: { id: string; active?: boolean }) {
  const count = useViewCount(id);
  if (!count) return null;
  return (
    <span
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        active
          ? 'bg-primary text-white'
          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
      }`}
    >
      {count > 999 ? '999+' : count}
    </span>
  );
}

function ViewRow({
  view,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  view: InboxView;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = VIEW_ICON[view.icon ?? ''] ?? Filter;
  const color = ICON_COLOR[view.color ?? 'default'] ?? ICON_COLOR.default;
  const builtin = view.metadata?.builtin === true;
  return (
    <div
      className={`group flex items-center rounded-md ${
        active ? 'bg-primary/[0.06] dark:bg-primary/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px]"
      >
        <Icon className={`size-4 shrink-0 ${color}`} />
        <span className={`flex-1 truncate ${active ? 'font-medium text-primary' : 'text-zinc-700 dark:text-zinc-200'}`}>
          {view.name}
        </span>
        <CountBadge id={view.id} active={active} />
        {active && <Check className="size-3.5 shrink-0 text-primary" />}
      </button>
      {!builtin && (
        <div className="flex shrink-0 pr-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar área"
            className="flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Excluir área"
            className="flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function InboxWorkspaceSwitcher() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const activeViewId = searchParams.get('view');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InboxView | null>(null);

  const { data: views = [] } = useQuery({
    queryKey: ['inbox-views'],
    queryFn: () => inboxViewsService.list(),
    staleTime: 60_000,
  });

  const active = views.find((v) => v.id === activeViewId) || null;
  const areas = views.filter((v) => v.metadata?.builtin !== true);
  const builtins = views.filter((v) => v.metadata?.builtin === true);

  // Navegação DURA de propósito. `router.push` (e até window.history.pushState)
  // com mudança SÓ de query string é inconsistente no App Router do Next 16:
  // a 1ª navegação /inbox → ?view=X funciona, mas trocar de uma área pra outra
  // (ou voltar pra "Todas") vira no-op — o `useSearchParams` não reage e a área
  // "trava" (Matheus: "não consigo voltar pro escritório"). Recarregar já na
  // área certa é 100% confiável e combina com a ideia de "entrar no workspace".
  const go = (id: string | null) => {
    window.location.href = id ? `/inbox?view=${id}` : '/inbox';
  };

  const handleDelete = async (view: InboxView) => {
    if (!confirm(`Excluir a área "${view.name}"? As conversas não são apagadas — só esta visualização.`)) return;
    try {
      await inboxViewsService.remove(view.id);
      toast.success('Área removida');
      qc.invalidateQueries({ queryKey: ['inbox-views'] });
      if (activeViewId === view.id) window.location.href = '/inbox';
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir');
    }
  };

  const ActiveIcon = active ? VIEW_ICON[active.icon ?? ''] ?? Filter : LayoutGrid;
  const activeColor = active ? ICON_COLOR[active.color ?? 'default'] ?? ICON_COLOR.default : 'text-zinc-500 dark:text-zinc-400';

  const panelClass =
    'z-50 mt-1.5 w-72 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]';

  return (
    <Popover className="relative">
      <PopoverButton className="-ml-1 flex max-w-[220px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <ActiveIcon className={`size-[18px] shrink-0 ${active ? activeColor : 'text-primary'}`} />
        <span className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
          {active ? active.name : 'Workspaces'}
        </span>
        {active ? (
          <CountBadge id={active.id} />
        ) : (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            todas
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-zinc-400" />
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition className={panelClass}>
        {({ close }) => (
          <>
            <button
              type="button"
              onClick={() => {
                go(null);
                close();
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] ${
                !activeViewId
                  ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60'
              }`}
            >
              <LayoutGrid className="size-4 shrink-0" />
              <span className="flex-1">Todas as conversas</span>
              {!activeViewId && <Check className="size-3.5 text-primary" />}
            </button>

            {areas.length > 0 && (
              <>
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Áreas
                </p>
                {areas.map((v) => (
                  <ViewRow
                    key={v.id}
                    view={v}
                    active={activeViewId === v.id}
                    onSelect={() => {
                      go(v.id);
                      close();
                    }}
                    onEdit={() => {
                      setEditing(v);
                      close();
                    }}
                    onDelete={() => handleDelete(v)}
                  />
                ))}
              </>
            )}

            {builtins.length > 0 && (
              <>
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Visualizações
                </p>
                {builtins.map((v) => (
                  <ViewRow
                    key={v.id}
                    view={v}
                    active={activeViewId === v.id}
                    onSelect={() => {
                      go(v.id);
                      close();
                    }}
                    onEdit={() => undefined}
                    onDelete={() => undefined}
                  />
                ))}
              </>
            )}

            <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                close();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
            >
              <Plus className="size-4 shrink-0" />
              <span>Nova área</span>
            </button>
          </>
        )}
      </PopoverPanel>

      <InboxViewDialog
        open={creating}
        view={null}
        onClose={() => setCreating(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['inbox-views'] });
          setCreating(false);
        }}
      />
      <InboxViewDialog
        open={!!editing}
        view={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['inbox-views'] });
          setEditing(null);
        }}
      />
    </Popover>
  );
}
