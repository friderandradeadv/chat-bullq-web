'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ConversationList } from '@/features/inbox/components/conversation-list';
import { InboxToolbar } from '@/features/inbox/components/inbox-toolbar';
import { ChatPanel } from '@/features/inbox/components/chat-panel';
import { ContactDetailsPanel } from '@/features/inbox/components/contact-details-panel';
import { inboxService, type Conversation } from '@/features/inbox/services/inbox.service';

export default function InboxPage() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get('view');
  const deepLinkConvId = searchParams.get('conversationId');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const queryClient = useQueryClient();

  // Switching inbox view should clear the open conversation.
  useEffect(() => {
    setActiveConversation(null);
  }, [viewId]);

  // Deep-link from elsewhere: resolve conversationId query param once.
  useEffect(() => {
    if (!deepLinkConvId) return;
    if (activeConversation?.id === deepLinkConvId) return;
    let cancelled = false;
    inboxService
      .getConversation(deepLinkConvId)
      .then((conv) => {
        if (!cancelled) setActiveConversation(conv);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkConvId]);

  // Keep the active conversation object in sync with the backend.
  const { data: freshActive } = useQuery({
    queryKey: ['conversation', activeConversation?.id],
    queryFn: () => inboxService.getConversation(activeConversation!.id),
    enabled: !!activeConversation?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (freshActive && freshActive.id === activeConversation?.id) {
      setActiveConversation(freshActive);
    }
  }, [freshActive, activeConversation?.id]);

  const handleConversationUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    // "Intervir" muda o status (BOT→OPEN) e pausa a IA, então os badges das
    // abas precisam ser recontados junto — senão o número fica defasado.
    queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
    if (activeConversation) {
      queryClient.invalidateQueries({
        queryKey: ['messages', activeConversation.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation', activeConversation.id],
      });
    }
  }, [queryClient, activeConversation]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Full-width top toolbar — search + Responsável + Status + Mais filtros (LíderHub style) */}
      <InboxToolbar />

      <div className="flex min-h-0 flex-1 overflow-x-auto">
        <ConversationList
          activeId={activeConversation?.id || null}
          onSelect={setActiveConversation}
          viewId={viewId}
        />

        {activeConversation ? (
        <>
          <ChatPanel
            key={activeConversation.id}
            conversation={activeConversation}
            onConversationUpdate={handleConversationUpdate}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
          />
          {panelOpen && (
            <ContactDetailsPanel
              key={`panel-${activeConversation.id}`}
              conversation={activeConversation}
            />
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <MessageSquare className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            Chat BullQ
          </h2>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Selecione uma conversa para começar
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
