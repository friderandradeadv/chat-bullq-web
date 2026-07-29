'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Search, UserPlus, ArrowLeft, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService, type Conversation } from '../services/inbox.service';
import { channelsService } from '@/features/channels/services/channels.service';
import { contactsService } from '@/features/contacts/services/contacts.service';
import { useOrgId } from '@/hooks/use-org-query-key';

/**
 * Nova conversa estilo WhatsApp: abre na lista de CONTATOS (buscável) pra
 * escolher quem chamar, ou "Novo contato" pra digitar um número novo.
 */
export function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}) {
  const orgId = useOrgId();
  const [channelId, setChannelId] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'contacts' | 'new'>('contacts');
  const [phone, setPhone] = useState('');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });
  useEffect(() => {
    if (!channelId && channels.length > 0) {
      setChannelId(channels.find((c) => c.isActive)?.id ?? channels[0].id);
    }
  }, [channels, channelId]);

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts-newconv', search],
    queryFn: () =>
      contactsService.list({ limit: '60', ...(search.trim() ? { search: search.trim() } : {}) }),
    enabled: mode === 'contacts',
  });
  const contacts = (contactsData?.contacts ?? []).filter((c) => c.phone);

  const start = async (targetPhone: string | null, key: string) => {
    if (!channelId) {
      toast.error('Selecione um canal');
      return;
    }
    if (!targetPhone || targetPhone.replace(/\D/g, '').length < 8) {
      toast.error('Número inválido');
      return;
    }
    setLoadingKey(key);
    try {
      const conv = await inboxService.startConversation(channelId, targetPhone);
      toast.success('Conversa iniciada');
      onCreated(conv);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao iniciar conversa';
      toast.error(msg);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          {mode === 'new' ? (
            <button onClick={() => setMode('contacts')} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <h3 className="flex-1 text-base font-bold text-zinc-900 dark:text-zinc-100">
            {mode === 'new' ? 'Novo contato' : 'Nova conversa'}
          </h3>
          {channels.length > 1 && (
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              title="Canal de envio"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'contacts' ? (
          <>
            {/* Busca */}
            <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
              <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  placeholder="Buscar contato…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              <button
                onClick={() => setMode('new')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="h-5 w-5" />
                </span>
                <span className="font-medium text-primary">Novo contato</span>
              </button>

              {contactsLoading ? (
                <div className="flex items-center justify-center py-8 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : contacts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">
                  Nenhum contato encontrado.
                </p>
              ) : (
                contacts.map((c) => {
                  const initials =
                    (c.name ?? c.phone ?? '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
                  const busy = loadingKey === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => start(c.phone, c.id)}
                      disabled={!!loadingKey}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800/60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-400 to-zinc-500 text-sm font-semibold text-white">
                        {initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {c.name || c.phone}
                        </span>
                        {c.name && <span className="block truncate text-xs text-zinc-400">{c.phone}</span>}
                      </span>
                      {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Novo contato — digitar número */
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Número (com DDD)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && start(phone, 'new')}
                autoFocus
                placeholder="Ex: (11) 91234-5678 ou +1 415 555 1234"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Número do Brasil: só o DDD + número (o +55 é adicionado automaticamente).
                Cliente de outro país: comece com <span className="font-medium">+</span> e o código do país
                (ex.: <span className="font-mono">+1</span> EUA, <span className="font-mono">+351</span> Portugal).
                Mensagens a quem nunca te chamou podem esbarrar na janela de 24h do WhatsApp.
              </p>
            </div>
            <button
              onClick={() => start(phone, 'new')}
              disabled={loadingKey === 'new'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loadingKey === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Iniciar conversa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
