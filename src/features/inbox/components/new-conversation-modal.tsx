'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, PenLine, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService, type Conversation } from '../services/inbox.service';
import { channelsService } from '@/features/channels/services/channels.service';
import { useOrgId } from '@/hooks/use-org-query-key';

export function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}) {
  const orgId = useOrgId();
  const [channelId, setChannelId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });

  // Default to the first active channel.
  useEffect(() => {
    if (!channelId && channels.length > 0) {
      setChannelId(channels.find((c) => c.isActive)?.id ?? channels[0].id);
    }
  }, [channels, channelId]);

  const start = async () => {
    if (!channelId) {
      toast.error('Selecione um canal');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe DDD + número');
      return;
    }
    setLoading(true);
    try {
      const conv = await inboxService.startConversation(channelId, phone);
      toast.success('Conversa iniciada');
      onCreated(conv);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao iniciar conversa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Nova conversa</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Canal</label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {channels.length === 0 && <option value="">Nenhum canal</option>}
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Número (com DDD)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              placeholder="Ex: (11) 91234-5678"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              O Brasil (+55) é adicionado automaticamente. Mensagens a quem nunca te chamou
              podem esbarrar na janela de 24h do WhatsApp.
            </p>
          </div>
        </div>

        <button
          onClick={start}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          Iniciar conversa
        </button>
      </div>
    </div>
  );
}
