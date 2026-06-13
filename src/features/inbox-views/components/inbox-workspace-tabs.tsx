'use client';

/**
 * Toggle de "workspaces" do inbox (estilo LíderHub). Uma barra horizontal no
 * topo do /inbox com: "Geral" (sem filtro) + uma aba por área (RMC, Trabalhista,
 * Bancário…) + "Nova área". Cada aba é uma InboxView salva (filtro por
 * etiqueta/canal/status). Trocar de aba seta `?view=<id>` — a ConversationList
 * já busca por isso. Mostra a contagem de conversas por área pra você saber
 * onde tem volume sem precisar abrir.
 */

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const pillBase =
  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium outline-none transition-colors';
const pillActive = 'bg-primary/[0.08] text-primary dark:bg-primary/15';
const pillIdle =
  'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70';

function ViewTab({
  view,
  active,
  onEdit,
  onDelete,
}: {
  view: InboxView;
  active: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const Icon = VIEW_ICON[view.icon ?? ''] ?? Filter;
  const color = ICON_COLOR[view.color ?? 'default'] ?? ICON_COLOR.default;
  const isBuiltin = view.metadata?.builtin === true;

  // Contagem de conversas da área (total que casa com os filtros da view) —
  // pra saber onde tem volume sem abrir. Poll leve.
  const { data: count = 0 } = useQuery({
    queryKey: ['inbox-view-count', view.id],
    queryFn: () =>
      inboxViewsService
        .getConversations(view.id, { limit: '1' })
        .then((r) => r.pagination?.total ?? 0)
        .catch(() => 0),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => router.push(`/inbox?view=${view.id}`)}
        className={`${pillBase} ${active ? pillActive : pillIdle}`}
        title={view.name}
      >
        <Icon className={`size-4 shrink-0 ${active ? '' : color}`} />
        <span className="max-w-[140px] truncate">{view.name}</span>
        {count > 0 && (
          <span
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
              active
                ? 'bg-primary text-white'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
            }`}
          >
            {count > 999 ? '999+' : count}
          </span>
        )}
      </button>
      {active && !isBuiltin && (
        <div className="ml-0.5 flex items-center">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar área"
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Excluir área"
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function InboxWorkspaceTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const activeViewId = searchParams.get('view');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InboxView | null>(null);

  const { data: views = [] } = useQuery({
    queryKey: ['inbox-views'],
    queryFn: () => inboxViewsService.list(),
    staleTime: 60_000,
  });

  const handleDelete = async (view: InboxView) => {
    if (!confirm(`Excluir a área "${view.name}"? As conversas não são apagadas — só esta visualização.`)) return;
    try {
      await inboxViewsService.remove(view.id);
      toast.success('Área removida');
      qc.invalidateQueries({ queryKey: ['inbox-views'] });
      if (activeViewId === view.id) router.push('/inbox');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 scrollbar-thin dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => router.push('/inbox')}
        className={`${pillBase} ${!activeViewId ? pillActive : pillIdle}`}
      >
        <Inbox className="size-4 shrink-0" />
        <span>Geral</span>
      </button>

      {views.map((v) => (
        <ViewTab
          key={v.id}
          view={v}
          active={activeViewId === v.id}
          onEdit={() => setEditing(v)}
          onDelete={() => handleDelete(v)}
        />
      ))}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
      >
        <Plus className="size-4 shrink-0" />
        <span>Nova área</span>
      </button>

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
    </div>
  );
}
