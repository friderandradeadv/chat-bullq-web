'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Forward, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '../services/inbox.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { avatarColor, avatarInitials } from '@/lib/avatar';

export function ForwardMessageModal({
  message,
  onClose,
}: {
  message: any;
  onClose: () => void;
}) {
  const orgId = useOrgId();
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const text: string = message?.content?.text ?? message?.content?.caption ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['conversations', orgId, 'forward-picker'],
    queryFn: () => inboxService.getConversations({ limit: '50' }),
    staleTime: 30_000,
  });

  const conversations = useMemo(() => {
    const list = data?.conversations ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      (c.contact.name || c.contact.phone || '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const forwardTo = async (conversationId: string) => {
    if (!text) {
      toast.error('Só dá pra encaminhar mensagens de texto por enquanto');
      return;
    }
    setSendingId(conversationId);
    try {
      await inboxService.sendMessage({
        conversationId,
        type: 'TEXT',
        content: { text },
      });
      toast.success('Mensagem encaminhada');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao encaminhar');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Encaminhar para…</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {text && (
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
            <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">“{text}”</p>
          </div>
        )}

        <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa…"
              className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Nenhuma conversa</p>
          ) : (
            conversations.map((c) => {
              const name = c.contact.name || c.contact.phone || 'Desconhecido';
              return (
                <button
                  key={c.id}
                  onClick={() => forwardTo(c.id)}
                  disabled={sendingId !== null}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800/60"
                >
                  {c.contact.avatarUrl ? (
                    <img src={c.contact.avatarUrl} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white" style={{ backgroundColor: avatarColor(c.contact.name) }}>
                      {avatarInitials(c.contact.name)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{name}</span>
                  {sendingId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Forward className="h-4 w-4 text-zinc-300" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
