'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  XCircle,
  RotateCcw,
  RefreshCw,
  PanelRightOpen,
  PanelRightClose,
  Copy,
  Check,
  MoreHorizontal,
  Search,
  ChevronLeft,
  IdCard,
} from 'lucide-react';
import { formatPhone } from '@/lib/brazil-states';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { ConversationAiToggle } from './conversation-ai-toggle';
import { AssignmentPopover } from './assignment-popover';
import { AgentPinPopover } from './agent-pin-popover';
import { PipelinePopover } from './pipeline-popover';
import { ArchiveModal } from './archive-modal';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService, type Conversation } from '../services/inbox.service';

interface ConversationHeaderProps {
  conversation: Conversation;
  onUpdate: () => void;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  onToggleSearch?: () => void;
  /** Celular: seta ◀ que fecha o chat e volta pra lista de conversas. */
  onBack?: () => void;
}

function HeaderAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'avatar'}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800"
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitials(name)}
    </div>
  );
}

/** Atalho no cabeçalho do chat pra FICHA DO CLIENTE (/clientes/[partyId]),
 *  em GUIA NOVA — o atendimento em curso não pode sumir da tela.
 *  Só aparece pra quem já é cliente do jurídico — o backend só devolve
 *  `clientePartyId` quando há processo fora do pré-judicial. Mesma query
 *  (e mesmo cache) do painel lateral, então não custa requisição extra. */
function ClientRecordButton({ contactId }: { contactId: string }) {
  const { data } = useQuery({
    queryKey: ['cases-by-contact', contactId],
    queryFn: () => legalCasesService.casesByContact(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  const partyId = data?.clientePartyId;
  if (!partyId) return null;
  return (
    <button
      type="button"
      onClick={() => window.open(`/clientes/${partyId}`, '_blank', 'noopener')}
      title="Abrir ficha do cliente em outra guia"
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <IdCard className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Ficha do cliente</span>
    </button>
  );
}

export function ConversationHeader({ conversation, onUpdate, panelOpen = true, onTogglePanel, onToggleSearch, onBack }: ConversationHeaderProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = conversation.contact.phone;
    if (!phone) return;
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await inboxService.syncConversation(conversation.id);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['messages', conversation.id] }),
        queryClient.refetchQueries({ queryKey: ['conversations'] }),
      ]);
      if (result.imported > 0) {
        toast.success(
          `${result.imported} ${result.imported === 1 ? 'mensagem nova' : 'mensagens novas'} sincronizada${result.imported === 1 ? '' : 's'}`,
        );
      } else {
        toast.success('Tudo em dia — nenhuma mensagem nova');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };
  const handleAction = async (action: () => Promise<any>, successMsg: string) => {
    setIsLoading(true);
    try {
      await action();
      toast.success(successMsg);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveConfirm = async (reason: string, nextResponsibleId: string | null) => {
    await inboxService.archive(conversation.id);
    if (nextResponsibleId) {
      await inboxService.assignTo(conversation.id, nextResponsibleId).catch(() => null);
    }
    toast.success('Conversa arquivada');
    setShowArchiveModal(false);
    onUpdate();
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  return (
    <>
    {showArchiveModal && (
      <ArchiveModal
        onConfirm={handleArchiveConfirm}
        onClose={() => setShowArchiveModal(false)}
      />
    )}
    <div className="flex h-[67px] items-center justify-between border-b border-zinc-200 bg-white px-3.5 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Contact info — name+avatar toggles the right panel; copy button is separate */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para conversas"
            title="Voltar"
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePanel}
          title={panelOpen ? 'Fechar painel do contato' : 'Abrir painel do contato'}
          className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
        >
          <HeaderAvatar
            name={conversation.contact.name}
            avatarUrl={conversation.contact.avatarUrl}
          />
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {conversation.contact.name || formatPhone(conversation.contact.phone) || 'Desconhecido'}
          </div>
        </button>
        {conversation.contact.phone && (
          <button
            type="button"
            onClick={handleCopyPhone}
            title="Copiar telefone"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
        <ClientRecordButton contactId={conversation.contact.id} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pl-2">
        {/* Buscar dentro da conversa */}
        {onToggleSearch && (
          <button
            onClick={onToggleSearch}
            title="Buscar nesta conversa"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
        {/* Always visible: sync */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title="Sincronizar mensagens"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
        {/* Always visible: Arquivar / Desarquivar */}
        {!conversation.isArchived ? (
          <button
            onClick={() => setShowArchiveModal(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Arquivar chat
          </button>
        ) : (
          <button
            onClick={() =>
              handleAction(
                () => inboxService.unarchive(conversation.id),
                'Conversa desarquivada',
              )
            }
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Desarquivar
          </button>
        )}

        {/* Overflow menu — secondary actions (LíderHub-clean header) */}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            title="Mais ações"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              moreOpen
                ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreOpen && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1.5 flex w-56 flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <p className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Atendimento
                </p>
                <ConversationAiToggle
                  conversation={conversation}
                  disabled={isLoading}
                  onChange={async (next) => {
                    await handleAction(
                      () => inboxService.toggleAi(conversation.id, next),
                      next === null
                        ? 'IA voltou pro padrão (segue config global)'
                        : next
                          ? 'IA forçada nesta conversa (sobrepõe global)'
                          : 'IA pausada nesta conversa',
                    );
                  }}
                  onEngage={async () => {
                    await handleAction(async () => {
                      const result = await inboxService.engageAi(conversation.id);
                      if (!result.engaged) {
                        throw new Error(
                          result.reason
                            ? `IA não pôde engajar: ${result.reason}`
                            : 'Não foi possível engajar a IA',
                        );
                      }
                      return result;
                    }, 'IA engajada — vai responder em segundos');
                  }}
                />
                <AgentPinPopover conversation={conversation} onChanged={onUpdate} />
                {conversation.status !== 'CLOSED' && (
                  <AssignmentPopover conversation={conversation} onChanged={onUpdate} />
                )}
                <PipelinePopover conversation={conversation} onChanged={onUpdate} />
                <div className="my-0.5 border-t border-zinc-100 dark:border-zinc-800" />
                {conversation.status !== 'CLOSED' ? (
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      handleAction(
                        () => inboxService.closeConversation(conversation.id),
                        'Conversa encerrada',
                      );
                    }}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Encerrar conversa
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      handleAction(
                        () => inboxService.reopenConversation(conversation.id),
                        'Conversa reaberta',
                      );
                    }}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reabrir conversa
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Panel toggle movido pra abinha flutuante na borda (ChatPanel) */}
      </div>
    </div>
    </>
  );
}
