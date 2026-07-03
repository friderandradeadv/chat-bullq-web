'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ConversationList } from '@/features/inbox/components/conversation-list';
import { InboxToolbar } from '@/features/inbox/components/inbox-toolbar';
import { ChatPanel } from '@/features/inbox/components/chat-panel';
import { ContactDetailsPanel } from '@/features/inbox/components/contact-details-panel';
import { inboxService, type Conversation } from '@/features/inbox/services/inbox.service';
import { useInboxFilterStore } from '@/features/inbox/stores/inbox-filter-store';

export default function InboxPage() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get('view');
  const deepLinkConvId = searchParams.get('conversationId');
  const deepLinkSearch = searchParams.get('search');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  // No desktop o painel de detalhes vem aberto (layout de 3 colunas). No celular
  // ele começa fechado — senão o overlay taparia o chat assim que a conversa abre.
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setPanelOpen(true);
    }
  }, []);
  const queryClient = useQueryClient();
  const archivedOnly = useInboxFilterStore((s) => s.archivedOnly);
  const setSearch = useInboxFilterStore((s) => s.setSearch);
  const setStatusTab = useInboxFilterStore((s) => s.setStatusTab);

  // Deep-link da aba Contatos ("abrir conversa"): pré-preenche a busca e mostra
  // TODAS as conversas (não só as ativas) pra o contato aparecer na lista.
  useEffect(() => {
    if (!deepLinkSearch) return;
    setSearch(deepLinkSearch);
    setStatusTab('ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkSearch]);
  // Última leitura sincronizada (id + estado de arquivo) — usada para detectar a
  // transição "arquivou a conversa aberta" e fechar a página, igual ao LíderHub.
  const lastSyncedRef = useRef<{ id: string; archived: boolean } | null>(null);

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
    if (!freshActive || freshActive.id !== activeConversation?.id) return;
    const nowArchived = !!freshActive.isArchived;
    const last = lastSyncedRef.current;
    lastSyncedRef.current = { id: freshActive.id, archived: nowArchived };

    // Arquivar (ou desarquivar) a conversa aberta a tira da visão atual —
    // fecha a página, igual ao LíderHub. Só dispara numa transição real da
    // MESMA conversa (não no carregamento inicial nem em deep-link já arquivado).
    if (
      last &&
      last.id === freshActive.id &&
      last.archived !== nowArchived &&
      nowArchived !== archivedOnly
    ) {
      setActiveConversation(null);
      return;
    }
    setActiveConversation(freshActive);
  }, [freshActive, activeConversation?.id, archivedOnly]);

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
      {/* Full-width top toolbar — search + Responsável + Status + Mais filtros (LíderHub style).
          No celular, ao abrir uma conversa a barra some pra dar a tela toda ao chat. */}
      <div className={activeConversation ? 'max-lg:hidden' : ''}>
        <InboxToolbar />
      </div>

      <div className="flex min-h-0 flex-1 lg:overflow-x-auto">
        <ConversationList
          activeId={activeConversation?.id || null}
          onSelect={setActiveConversation}
          viewId={viewId}
          hiddenOnMobile={!!activeConversation}
        />

        {activeConversation ? (
        <>
          <ChatPanel
            key={activeConversation.id}
            conversation={activeConversation}
            onConversationUpdate={handleConversationUpdate}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            onBack={() => setActiveConversation(null)}
          />
          {panelOpen && (
            /* Desktop: 3ª coluna inline. Celular: overlay em tela cheia por cima do chat. */
            <div className="max-lg:fixed max-lg:inset-0 max-lg:z-40 flex max-lg:bg-white lg:contents dark:max-lg:bg-zinc-950">
              <ContactDetailsPanel
                key={`panel-${activeConversation.id}`}
                conversation={activeConversation}
                onCloseMobile={() => setPanelOpen(false)}
              />
            </div>
          )}
        </>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-zinc-50 lg:flex dark:bg-zinc-900/50">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <MessageSquare className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            Chat Frider Andrade
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
