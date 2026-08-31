'use client';

import { Fragment, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Clock, AlertCircle, ExternalLink, Reply, Trash2, X, Ban, StickyNote, Bot, Hand, Loader2, Copy, Star, Forward, Smile, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Info, Paperclip, Eye, EyeOff, Pencil, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { PrestacaoApprovalBar } from './prestacao-approval-bar';
import { inboxService, type Conversation, type Message } from '../services/inbox.service';
import { scheduledMessagesService } from '../services/scheduled-messages.service';
import { ScheduledMessagesBar } from './scheduled-messages-bar';
import { ChatInput, type ChatInputHandle } from './chat-input';
import { useComposerDraftStore } from '../stores/composer-draft-store';
import { ConversationSummaryModal } from './conversation-summary-modal';
import { ForwardMessageModal } from './forward-message-modal';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { ConversationHeader } from './conversation-header';
import { StoryReplyCard } from './story-reply-card';
import { AudioMessagePlayer } from './audio-message-player';
import {
  MediaImage,
  MediaVideo,
  MediaDocument,
  MediaSticker,
  MediaLocation,
  MediaContact,
} from './media-bubbles';
import type { PickedContact } from './contact-picker-modal';
import { useSocket } from '../hooks/use-socket';
import { useAuthStore } from '@/stores/auth-store';
import { PendingActionsList } from '../pending-actions/pending-actions-list';
import { formatPhone } from '@/lib/brazil-states';
import { useOrgId } from '@/hooks/use-org-query-key';
import {
  quickRepliesService,
  type QuickReplyAttachment,
} from '@/features/settings/services/quick-replies.service';
import { aiAgentsService } from '@/features/ai-agents/services/ai-agents.service';

interface ChatPanelProps {
  conversation: Conversation;
  onConversationUpdate: () => void;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  /** Volta pra lista de conversas no celular (seta ◀ no cabeçalho). */
  onBack?: () => void;
}

const statusIcons: Record<string, React.ElementType> = {
  QUEUED: Clock,
  SENT: Check,
  DELIVERED: CheckCheck,
  READ: CheckCheck,
  FAILED: AlertCircle,
};

/**
 * Banner de aviso quando a conversa está fora da "janela de atendimento"
 * do WhatsApp (24h sem mensagem do cliente). Sem template aprovado, qualquer
 * mensagem livre é rejeitada pelo provider com `failed_reason: Re-engagement
 * message`.
 *
 * Heurística client-side: olha as últimas mensagens já carregadas e procura
 * a última INBOUND. Se nenhuma encontrada nos buffer atual, OU se ela é mais
 * velha que 24h, mostra o banner. Não 100% preciso (paginação pode esconder
 * inbound antiga) mas resolve >95% dos casos sem precisar de campo novo no
 * backend.
 */
function EngagementWindowBanner({
  channelType,
  messages,
}: {
  channelType: string;
  messages: Message[];
}) {
  // Janela 24h é regra rígida APENAS do WhatsApp Cloud API oficial (Meta).
  // Canais Zappfy/Uazapi (WHATSAPP_ZAPPFY) não têm essa restrição — banner
  // ali confunde mais que ajuda.
  if (channelType !== 'WHATSAPP_OFFICIAL') return null;
  if (messages.length === 0) return null;

  const lastInbound = [...messages]
    .reverse()
    .find((m) => m.direction === 'INBOUND');
  if (!lastInbound) return null;

  const ageMs = Date.now() - new Date(lastInbound.createdAt).getTime();
  const ageHours = ageMs / (60 * 60 * 1000);
  if (ageHours < 24) return null;

  const ageLabel =
    ageHours < 48
      ? `${Math.floor(ageHours)}h`
      : `${Math.floor(ageHours / 24)} dias`;

  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 leading-relaxed">
        <strong>Janela de 24h expirada</strong> — última mensagem do cliente
        foi há {ageLabel}. WhatsApp só aceita{' '}
        <strong>templates aprovados</strong> agora. Mensagem de texto livre
        vai falhar com erro <code className="font-mono text-[11px]">Re-engagement message</code>.
        Peça pro cliente mandar qualquer mensagem pra reabrir a janela, ou
        use o menu <strong>＋ → Enviar template</strong> no compositor.
      </div>
    </div>
  );
}

/**
 * Tooltip humano pra cada status. Especial pra FAILED com motivo conhecido
 * — operador entende que precisa de template em vez de relê o erro do
 * provider em inglês ("Re-engagement message").
 */
function statusTooltip(status: string, failedReason?: string | null): string {
  switch (status) {
    case 'QUEUED':
      return 'Enviando…';
    case 'SENT':
      return 'Enviado pro provedor';
    case 'DELIVERED':
      return 'Entregue ao destinatário';
    case 'READ':
      return 'Lida';
    case 'FAILED':
      if (failedReason && /re-?engagement/i.test(failedReason)) {
        return 'Falhou: cliente sem mensagem há mais de 24h. Use um template aprovado pra reabrir a conversa.';
      }
      if (failedReason) return `Falhou: ${failedReason}`;
      return 'Falhou ao enviar';
    default:
      return status;
  }
}

/**
 * Bloqueio de CONTA na Meta (WABA banida/restrita, número banido). Reenviar
 * nunca vai funcionar — nem texto, nem template — então o botão some e fica só
 * a explicação. Casa com os motivos que a API grava a partir do `health_status`.
 */
function isAccountBlocked(failedReason?: string | null): boolean {
  if (!failedReason) return false;
  return /banid|bloque|141014|131031|accountquality/i.test(failedReason);
}

/**
 * Motivo da falha em uma linha, visível na conversa (antes só existia no
 * tooltip — e uma bolha vermelha muda faz o atendente reenviar a mesma
 * mensagem à toa).
 */
function failureText(failedReason?: string | null): string {
  if (!failedReason) return 'Falhou ao enviar.';
  if (/re-?engagement/i.test(failedReason)) {
    return 'Não entregue: o cliente não escreve há mais de 24h. Use um template aprovado (menu ＋ → Enviar template) para reabrir a conversa.';
  }
  return failedReason;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const IG_CDN_HOSTS = /(lookaside\.fbsbx\.com|cdninstagram\.com|fbcdn\.net)/i;

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function LinkPreviewCard({ url, isOutbound }: { url: string; isOutbound: boolean }) {
  const [imgOk, setImgOk] = useState(IG_CDN_HOSTS.test(url));
  const host = safeHostname(url);

  if (imgOk) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt="Mídia compartilhada"
          className="max-h-64 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
          onError={() => setImgOk(false)}
        />
        <span
          className={`mt-1 block text-[10px] ${
            isOutbound ? 'opacity-80' : 'text-zinc-400'
          }`}
        >
          {host}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
        isOutbound
          ? 'border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15'
          : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800'
      }`}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate font-medium">{host}</span>
    </a>
  );
}

function matchSingleUrl(text: string): string | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^(https?:\/\/\S+)$/i);
  return m ? m[1] : null;
}

// Formatação estilo WhatsApp: *negrito*  _itálico_  ~tachado~  ```monoespaçado```
// (delimitador só vale colado ao conteúdo, sem espaço logo após a abertura nem
// antes do fechamento — igual ao WhatsApp; espaço adjacente = texto literal)
const WA_TOKEN_REGEX = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

function renderWhatsappFormatting(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(WA_TOKEN_REGEX.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    const token = m[0];
    const key = `${keyPrefix}-f${i++}`;
    const mono = token.startsWith('```');
    const inner = mono ? token.slice(3, -3) : token.slice(1, -1);
    // espaço logo após a abertura ou antes do fechamento → não formata (igual WhatsApp)
    if (!mono && (/^\s/.test(inner) || /\s$/.test(inner))) {
      nodes.push(token);
    } else if (mono) {
      nodes.push(
        <code key={key} className="rounded bg-black/10 px-1 font-mono text-[0.85em] dark:bg-white/10">
          {inner}
        </code>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderWhatsappFormatting(inner, key)}
        </strong>,
      );
    } else if (token.startsWith('_')) {
      nodes.push(<em key={key}>{renderWhatsappFormatting(inner, key)}</em>);
    } else {
      nodes.push(<del key={key}>{renderWhatsappFormatting(inner, key)}</del>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderInlineTextWithLinks(text: string, isOutbound: boolean) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 wrap-break-word ${
            isOutbound ? 'text-emerald-700 dark:text-emerald-200' : 'text-primary'
          }`}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{renderWhatsappFormatting(part, String(i))}</Fragment>;
  });
}

function MessageText({
  text,
  isOutbound,
  className = '',
}: {
  text: string;
  isOutbound: boolean;
  className?: string;
}) {
  const onlyUrl = matchSingleUrl(text);
  if (onlyUrl) {
    return <LinkPreviewCard url={onlyUrl} isOutbound={isOutbound} />;
  }
  return (
    <p className={`whitespace-pre-wrap wrap-break-word text-sm ${className}`}>
      {renderInlineTextWithLinks(text, isOutbound)}
    </p>
  );
}

interface TemplateButtonShape {
  type?: string;
  title?: string;
  url?: string;
  payload?: string;
}

interface TemplateElementShape {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  defaultActionUrl?: string;
  buttons?: TemplateButtonShape[];
}

function TemplateButtonRow({
  buttons,
  isOutbound,
}: {
  buttons: TemplateButtonShape[];
  isOutbound: boolean;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {buttons.map((btn, i) => {
        const label = btn.title || btn.url || btn.payload || 'Botão';
        const baseClass = `block rounded-md border px-3 py-1.5 text-center text-xs font-medium transition-colors ${
          isOutbound
            ? 'border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15'
            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800'
        }`;
        if (btn.url) {
          return (
            <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" className={baseClass}>
              {label}
            </a>
          );
        }
        return (
          <span
            key={i}
            className={`${baseClass} cursor-default opacity-80`}
            title={btn.payload || btn.type || ''}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function TemplateMessage({
  content,
  isOutbound,
}: {
  content: Record<string, any>;
  isOutbound: boolean;
}) {
  const tpl = (content?.template ?? {}) as {
    templateType?: string;
    text?: string;
    buttons?: TemplateButtonShape[];
    elements?: TemplateElementShape[];
    /** Anexo do HEADER do template (ex.: PDF da prestação de contas). O cliente
     *  recebe pelo próprio template; sem isto aqui a equipe não via o anexo e
     *  concluía que a mensagem tinha ido sem ele. */
    headerDocument?: { link?: string; filename?: string };
  };
  const doc = tpl.headerDocument?.link ? tpl.headerDocument : null;
  // A prévia do backend já começa com "📎 arquivo.pdf" para os canais que só têm
  // texto; com o cartão abaixo isso duplicaria, então tiramos da bolha.
  const rawText = tpl.text || content?.text;
  const headerText = doc && typeof rawText === 'string'
    ? rawText.replace(/^📎[^\n]*\n+/, '')
    : rawText;
  const elements = tpl.elements ?? [];
  const buttons = tpl.buttons ?? [];

  return (
    <div className="space-y-2">
      {doc && (
        <a
          href={doc.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
            isOutbound
              ? 'border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15'
              : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800'
          }`}
        >
          <Paperclip className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate text-xs font-medium">{doc.filename || 'Documento'}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </a>
      )}
      {headerText && <MessageText text={headerText} isOutbound={isOutbound} />}

      {elements.map((el, i) => (
        <div
          key={i}
          className={`overflow-hidden rounded-lg border ${
            isOutbound
              ? 'border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10'
              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60'
          }`}
        >
          {el.imageUrl && (
            <a
              href={el.defaultActionUrl || el.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={el.imageUrl}
                alt={el.title || 'Template'}
                className="max-h-48 w-full object-cover"
              />
            </a>
          )}
          {(el.title || el.subtitle) && (
            <div className="px-3 py-2">
              {el.title && <p className="text-sm font-medium">{el.title}</p>}
              {el.subtitle && (
                <p className="mt-0.5 text-xs opacity-75">{el.subtitle}</p>
              )}
            </div>
          )}
          {el.buttons && el.buttons.length > 0 && (
            <div className="px-3 pb-2">
              <TemplateButtonRow buttons={el.buttons} isOutbound={isOutbound} />
            </div>
          )}
        </div>
      ))}

      {buttons.length > 0 && <TemplateButtonRow buttons={buttons} isOutbound={isOutbound} />}

      {!headerText && elements.length === 0 && buttons.length === 0 && (
        <p className="text-sm italic opacity-70">[Template]</p>
      )}
    </div>
  );
}

function ContactAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-10 w-10 text-sm';
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'avatar'}
        onError={() => setFailed(true)}
        className={`${dim} shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-700`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitials(name)}
    </div>
  );
}

export function ChatPanel({ conversation, onConversationUpdate, panelOpen, onTogglePanel, onBack }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { on, emit, onReconnect } = useSocket();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => inboxService.getMessages(conversation.id),
    // Defenses against socket gaps: refetch when the tab regains focus
    // and on browser-level reconnect. Realtime is the happy path; these
    // catch the case where a `message:new` was missed.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  const messages = data?.messages || [];

  // Internal notes (fonte única: tabela InternalNote). Mesmas notas da aba
  // "Notas" do painel — aqui são injetadas no timeline do chat como cards
  // âmbar. Compartilham a query key ['notes', id], então adicionar/excluir
  // nota num lugar reflete no outro.
  const { data: notesData = [] } = useQuery({
    queryKey: ['notes', conversation.id],
    queryFn: () => inboxService.getNotes(conversation.id),
    staleTime: 15_000,
  });

  // Logs internos (atribuição, status, IA, arquivamento) — timeline LíderHub.
  const { data: auditData = [] } = useQuery({
    queryKey: ['audit-logs', conversation.id],
    queryFn: () => inboxService.getAuditLogs(conversation.id),
    staleTime: 15_000,
  });

  // Minimizar os registros de sistema no chat (atribuição/status/IA/arquivamento)
  // pra a conversa não ficar lotada. Preferência persistida por usuário.
  const [hideLogs, setHideLogs] = useState(
    // Default: logs do sistema MINIMIZADOS (chat limpo, "não fica lotado").
    // Só mostra se o usuário pediu explicitamente (preferência '0').
    () =>
      typeof window === 'undefined' ||
      localStorage.getItem('chat-hide-logs') !== '0',
  );
  const toggleHideLogs = () => {
    setHideLogs((v) => {
      const next = !v;
      try { localStorage.setItem('chat-hide-logs', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Mensagens rápidas da org — popup "/" no compositor (estilo LíderHub).
  const orgId = useOrgId();
  const { data: quickReplies = [] } = useQuery({
    queryKey: ['quick-replies', orgId],
    queryFn: () => quickRepliesService.list(),
    staleTime: 60_000,
  });

  // Mapa agentId→agente pra estampar a FOTO do agente de IA nas bolhas que ele
  // enviou (a mensagem da IA carrega metadata.aiAgentId, mas não a foto).
  const { data: agents = [] } = useQuery({
    queryKey: ['ai-agents', orgId],
    queryFn: () => aiAgentsService.list(),
    staleTime: 300_000,
  });
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  // ─── Busca dentro da conversa ───────────────────────────────────────────
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const convSearchInputRef = useRef<HTMLInputElement>(null);

  const matchIds = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages
      .filter((m) => {
        const c = (m.content ?? {}) as Record<string, any>;
        const t = String(c.text ?? c.caption ?? '').toLowerCase();
        return t.includes(q);
      })
      .map((m) => m.id);
  }, [messages, convSearch]);

  // Reset índice quando a busca muda.
  useEffect(() => {
    setMatchIdx(0);
  }, [convSearch]);

  // Rola até o match atual.
  useEffect(() => {
    if (matchIds.length === 0) return;
    const id = matchIds[Math.min(matchIdx, matchIds.length - 1)];
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchIdx, matchIds]);

  const currentMatchId = matchIds.length > 0 ? matchIds[Math.min(matchIdx, matchIds.length - 1)] : null;

  const gotoMatch = (dir: 1 | -1) => {
    if (matchIds.length === 0) return;
    setMatchIdx((i) => (i + dir + matchIds.length) % matchIds.length);
  };

  const toggleConvSearch = () => {
    setConvSearchOpen((v) => {
      const next = !v;
      if (!next) setConvSearch('');
      else setTimeout(() => convSearchInputRef.current?.focus(), 50);
      return next;
    });
  };

  useEffect(() => {
    emit('join:conversation', { conversationId: conversation.id });
    return () => {
      emit('leave:conversation', { conversationId: conversation.id });
    };
  }, [conversation.id, emit]);

  useEffect(() => {
    const unsubNew = on('message:new', (payload: any) => {
      const msg = payload.message;
      if (!msg) return;
      const convId = payload.conversationId ?? msg.conversationId;
      if (convId !== conversation.id) return;

      // Merge into the current cache. If there's no cache yet (initial
      // fetch still in flight, or cache evicted) we DON'T discard the
      // event — we invalidate so the refetch picks the new message up.
      const existingCache = queryClient.getQueryData<{ messages: Message[] }>([
        'messages',
        conversation.id,
      ]);
      if (!existingCache) {
        queryClient.invalidateQueries({
          queryKey: ['messages', conversation.id],
        });
      } else {
        queryClient.setQueryData<{ messages: Message[] }>(
          ['messages', conversation.id],
          (prev) => {
            if (!prev) return prev;
            const existing = prev.messages || [];
            // Dedup by id (authoritative) or by externalId when present.
            const match = existing.findIndex(
              (m) =>
                m.id === msg.id ||
                (msg.externalId && m.externalId && m.externalId === msg.externalId),
            );
            if (match !== -1) {
              const merged = [...existing];
              merged[match] = { ...existing[match], ...msg };
              return { ...prev, messages: merged };
            }
            return { ...prev, messages: [...existing, msg] };
          },
        );
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubStatus = on('message:status', (payload: any) => {
      if (payload.conversationId !== conversation.id) return;
      const ids: string[] = payload.messageIds ?? (payload.messageId ? [payload.messageId] : []);
      if (ids.length === 0) return;
      queryClient.setQueryData<{ messages: Message[] } | undefined>(
        ['messages', conversation.id],
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              ids.includes(m.id) ? { ...m, status: payload.status } : m,
            ),
          };
        },
      );
    });
    // Reconnect: any messages that arrived during the offline window are
    // gone from this client's perspective (socket misses events while
    // disconnected). Refetch the open conversation's messages on every
    // reconnect, plus the conversation list, so the user comes back to a
    // correct view without having to F5.
    const unsubReconnect = onReconnect(() => {
      queryClient.invalidateQueries({
        queryKey: ['messages', conversation.id],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    // Watchdog/admin revogou uma mensagem — pinta a bolha como "deletada"
    // pra todo mundo que tá com a conversa aberta, sem refresh.
    const unsubRevoked = on('message:revoked', (payload: any) => {
      if (payload?.conversationId !== conversation.id) return;
      if (!payload?.messageId) return;
      queryClient.setQueryData<{ messages: Message[] } | undefined>(
        ['messages', conversation.id],
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === payload.messageId
                ? {
                    ...m,
                    revokedAt: payload.revokedAt,
                    revokedBy: payload.revokedBy,
                    revokeSucceededRemote: payload.succeededRemote,
                  }
                : m,
            ),
          };
        },
      );
    });
    return () => {
      unsubNew?.();
      unsubStatus?.();
      unsubReconnect?.();
      unsubRevoked?.();
    };
  }, [conversation.id, on, onReconnect, queryClient]);

  const handleRevoke = useCallback(
    async (msg: Message) => {
      const ok = window.confirm(
        'Deletar essa mensagem pra todos? ' +
          'Em WhatsApp via Zappfy a mensagem some no app do cliente. ' +
          'Em WhatsApp Cloud API e Instagram, ela some apenas no Chat Frider Andrade ' +
          '(limitação da Meta — o cliente continua vendo no app dele).',
      );
      if (!ok) return;
      try {
        const result = await inboxService.revokeMessage(msg.id);
        if (result.succeededRemote) {
          toast.success('Mensagem deletada pra todos');
        } else {
          toast.warning(
            'Mensagem deletada só no Chat Frider Andrade. ' +
              'O cliente ainda vê a mensagem no app dele (limitação do canal).',
          );
        }
        // Otimista: marca local enquanto o realtime não chega
        queryClient.setQueryData<{ messages: Message[] } | undefined>(
          ['messages', conversation.id],
          (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === msg.id
                  ? {
                      ...m,
                      revokedAt: result.revokedAt,
                      revokedBy: result.revokedBy,
                      revokeSucceededRemote: result.succeededRemote,
                    }
                  : m,
              ),
            };
          },
        );
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            'Erro ao deletar mensagem',
        );
      }
    },
    [conversation.id, queryClient],
  );

  // Edição de mensagem enviada (janela ~15 min do WhatsApp).
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const startEditMessage = useCallback((msg: Message) => {
    setEditing({ id: msg.id, text: (msg.content as any)?.text ?? '' });
  }, []);
  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) { toast.error('A mensagem não pode ficar vazia.'); return; }
    setSavingEdit(true);
    try {
      const result = await inboxService.editMessage(editing.id, text);
      queryClient.setQueryData<{ messages: Message[] } | undefined>(
        ['messages', conversation.id],
        (prev) => prev ? {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === editing.id
              ? { ...m, content: { ...(m.content as any), text: result.text }, metadata: { ...(m.metadata as any), edited: true } }
              : m,
          ),
        } : prev,
      );
      setEditing(null);
      toast.success('Mensagem editada');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erro ao editar mensagem');
    } finally {
      setSavingEdit(false);
    }
  }, [editing, conversation.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reply state — quando setado, próxima msg enviada vai com replyToMessageId
  // e a UI mostra a barra "respondendo a..." acima do input. Reseta ao
  // trocar de conversa (via key prop do ChatPanel) ou ao mandar a msg.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const startReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);
  const cancelReply = useCallback(() => setReplyingTo(null), []);

  // Respondeu numa conversa ARQUIVADA → desarquiva na hora ("voltei a falar com
  // o cliente"). O backend já desarquiva no envio, mas fazemos o flip otimista
  // aqui pra sair de "Arquivados" sem esperar o socket/refetch, e chamamos o
  // /unarchive como garantia. Pula a intervenção pontual (oneOff), igual ao back.
  const ensureUnarchivedOnSend = () => {
    const oneOff = pontual && !isMine;
    if (oneOff || !conversation.isArchived) return;
    queryClient.setQueryData<Conversation>(
      ['conversation', conversation.id],
      (old) => (old ? { ...old, isArchived: false, archivedAt: null } : old),
    );
    queryClient.setQueriesData<any>({ queryKey: ['conversations'] }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) => ({
          ...p,
          conversations: p.conversations.map((c: Conversation) =>
            c.id === conversation.id
              ? { ...c, isArchived: false, archivedAt: null }
              : c,
          ),
        })),
      };
    });
    inboxService.unarchive(conversation.id).catch(() => undefined);
  };

  // Insere a mensagem recém-enviada (retorno do POST) direto no cache, na hora.
  // Antes o envio dependia 100% do eco `message:new` do socket pra aparecer —
  // quando esse evento não chegava (socket instável), a bolha "sumia" até o
  // refetch/F5. Aqui garantimos que a própria mensagem enviada aparece na hora,
  // independente do socket. O handler de `message:new` deduplica por id/externalId,
  // então o eco só atualiza a bolha (status), não duplica.
  const insertSentMessage = useCallback(
    (created: Message | undefined | null) => {
      if (!created?.id) return;
      const cache = queryClient.getQueryData<{ messages: Message[] }>([
        'messages',
        conversation.id,
      ]);
      if (!cache) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
        return;
      }
      queryClient.setQueryData<{ messages: Message[] } | undefined>(
        ['messages', conversation.id],
        (prev) => {
          if (!prev) return prev;
          const existing = prev.messages || [];
          const match = existing.findIndex(
            (m) =>
              m.id === created.id ||
              (created.externalId && m.externalId && m.externalId === created.externalId),
          );
          if (match !== -1) {
            const merged = [...existing];
            merged[match] = { ...existing[match], ...created };
            return { ...prev, messages: merged };
          }
          return { ...prev, messages: [...existing, created] };
        },
      );
    },
    [queryClient, conversation.id],
  );

  const handleSend = async (text: string) => {
    const replyToMessageId = replyingTo?.id;
    try {
      const created = await inboxService.sendMessage({
        conversationId: conversation.id,
        type: 'TEXT',
        content: { text },
        replyToMessageId,
        // Intervenção pontual: manda sem assumir a conversa nem pausar a IA.
        ...(pontual && !isMine ? { oneOff: true } : {}),
      });
      insertSentMessage(created);
      ensureUnarchivedOnSend();
      setReplyingTo(null);
    } catch (err) {
      // Fallback: if send fails before the socket event arrives, force a refresh.
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  // Reenviar uma mensagem que FALHOU: dispara um envio NOVO com o mesmo
  // conteúdo (texto ou mídia por URL) — a original fica no histórico como
  // registro da falha. Se a causa persistir (ex.: janela de 24h), a nova
  // também falha e o motivo aparece no tooltip dela.
  const handleResend = async (msg: Message) => {
    if (resendingId) return;
    setResendingId(msg.id);
    try {
      const created = await inboxService.sendMessage({
        conversationId: conversation.id,
        type: msg.type,
        content: msg.content ?? {},
        ...(pontual && !isMine ? { oneOff: true } : {}),
      });
      insertSentMessage(created);
      ensureUnarchivedOnSend();
      toast.success('Mensagem reenviada — ela entra como uma nova mensagem no fim da conversa.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erro ao reenviar a mensagem');
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    } finally {
      setResendingId(null);
    }
  };

  const handleSendAudio = async (blob: Blob) => {
    try {
      const created = await inboxService.sendAudioMessage(conversation.id, blob);
      insertSentMessage(created);
      ensureUnarchivedOnSend();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  const handleSendMedia = async (file: File, caption?: string) => {
    try {
      const created = await inboxService.sendMediaMessage(conversation.id, file, caption);
      insertSentMessage(created);
      ensureUnarchivedOnSend();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  // Cartão(ões) de contato (vCard). Cada contato vira uma mensagem CONTACT —
  // o adapter do canal (Uazapi / Evolution / Cloud API) monta o formato nativo.
  const handleSendContact = async (contacts: PickedContact[]) => {
    try {
      for (const c of contacts) {
        const created = await inboxService.sendMessage({
          conversationId: conversation.id,
          type: 'CONTACT',
          content: { contact: { name: c.name, phone: c.phone } },
          ...(pontual && !isMine ? { oneOff: true } : {}),
        });
        insertSentMessage(created);
      }
      ensureUnarchivedOnSend();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  // Template HSM aprovado — reabre a janela de 24h no Cloud API.
  const handleSendTemplate = async (payload: {
    name: string;
    language: string;
    parameters: string[];
    previewText: string;
  }) => {
    try {
      const created = await inboxService.sendTemplate({
        conversationId: conversation.id,
        ...payload,
      });
      insertSentMessage(created);
      ensureUnarchivedOnSend();
      toast.success('Template enviado');
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  // Mídia por URL (anexo de mensagem rápida) — o provider baixa da URL,
  // mesmo caminho do envio do vídeo tutorial do ZapSign no backend.
  const handleSendRemoteAttachment = async (
    att: QuickReplyAttachment,
    caption?: string,
  ) => {
    try {
      const created = await inboxService.sendMessage({
        conversationId: conversation.id,
        type: att.type,
        content: {
          mediaUrl: att.url,
          ...(att.fileName ? { fileName: att.fileName } : {}),
          ...(caption ? { caption } : {}),
        },
        ...(pontual && !isMine ? { oneOff: true } : {}),
      });
      insertSentMessage(created);
      ensureUnarchivedOnSend();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      throw err;
    }
  };

  // ─── Arrastar e soltar arquivos no chat (drag & drop) ───────────────────
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Rascunho do robô ("pedir resposta do robô") → cai na caixa de mensagem.
  const draftPending = useComposerDraftStore((s) => s.pending);
  const clearDraft = useComposerDraftStore((s) => s.clear);
  useEffect(() => {
    if (draftPending && draftPending.conversationId === conversation.id) {
      chatInputRef.current?.setText(draftPending.text);
      clearDraft();
    }
  }, [draftPending, conversation.id, clearDraft]);

  // PRÉVIA DA PRESTAÇÃO: veio do Financeiro com ?prestacao=<txId> — mostra a BARRA de aprovação
  // (texto editável + PDF) acima do compositor. O envio é o ESPECIALIZADO (template fora de 24h +
  // registro probatório); aqui é só a revisão humana antes de disparar.
  const searchParams = useSearchParams();
  const prestacaoTx = searchParams.get('prestacao');
  const prestacaoAgendar = !!searchParams.get('agendar');
  const [prestacaoDismissed, setPrestacaoDismissed] = useState<string | null>(null);
  const showPrestacaoBar = !!prestacaoTx && prestacaoDismissed !== prestacaoTx;
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (hasFiles(e)) e.preventDefault();
  };
  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (conversation.status === 'CLOSED') {
      toast.error('Conversa encerrada — reabra para enviar.');
      return;
    }
    // Empilha no preview do compositor — só envia quando confirmar.
    chatInputRef.current?.addFiles(Array.from(e.dataTransfer.files));
  };

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [msgMenu, setMsgMenu] = useState<{ msg: any; x: number; y: number } | null>(null);

  const [forwardMsg, setForwardMsg] = useState<any | null>(null);

  const copyMessageText = (m: any) => {
    const t = m?.content?.text ?? m?.content?.caption ?? '';
    if (t) {
      navigator.clipboard.writeText(t).then(() => toast.success('Mensagem copiada'));
    } else {
      toast.info('Mensagem sem texto para copiar');
    }
  };

  const handleFavorite = async (m: any) => {
    try {
      await inboxService.toggleFavorite(m.id);
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      toast.success(m.metadata?.favorited ? 'Removida dos favoritos' : 'Mensagem favoritada');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao favoritar');
    }
  };

  const handleSendInternal = async (text: string) => {
    // Nota interna = InternalNote (fonte única). Aparece na aba Notas e,
    // via merge no timeline, também no chat.
    await inboxService.createNote(conversation.id, text);
    queryClient.invalidateQueries({ queryKey: ['notes', conversation.id] });
  };

  // --- Intervenção na conversa (paridade LíderHub) -------------------------
  // A barra de intervenção aparece quando a conversa NÃO é minha — está com
  // outro atendente OU a IA está conduzindo. "Intervenção pontual" só libera o
  // compositor (sem reatribuir nem pausar IA). "Intervir na conversa" assume de
  // vez (assignToMe) e pausa a IA (aiEnabled=false), igual ao LíderHub.
  const [pontual, setPontual] = useState(false);
  const [intervening, setIntervening] = useState(false);
  // Some o estado pontual ao trocar de conversa — senão "vaza" pra próxima.
  useEffect(() => setPontual(false), [conversation.id]);

  const isMine = !!user && conversation.assignedToId === user.id;
  const hasOtherAssignee =
    !!conversation.assignedToId && conversation.assignedToId !== user?.id;
  const isUnassigned = !conversation.assignedToId;
  const aiConducting = conversation.aiEnabled !== false;
  // Precisa intervir quando a conversa NÃO é minha: sem responsável,
  // com outro responsável, ou com a IA conduzindo.
  const needsIntervention =
    conversation.status !== 'CLOSED' &&
    !isMine &&
    (hasOtherAssignee || aiConducting || isUnassigned);

  const handleIntervir = async () => {
    setIntervening(true);
    try {
      await inboxService.assignToMe(conversation.id);
      if (conversation.aiEnabled !== false) {
        await inboxService.toggleAi(conversation.id, false);
      }
      onConversationUpdate();
      setPontual(false);
      toast.success('Você assumiu a conversa. IA pausada.');
    } catch {
      toast.error('Não foi possível assumir a conversa.');
    } finally {
      setIntervening(false);
    }
  };

  // Hora embaixo de cada bolha. Se a msg não for de hoje, prefixa com
  // a data curta ("DD/MM 16:58") pra não precisar caçar o separador
  // rolando o histórico inteiro.
  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    const showYear = d.getFullYear() !== now.getFullYear();
    const datePart = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      ...(showYear ? { year: '2-digit' } : {}),
    });
    return `${datePart} ${time}`;
  };

  // Separador de data no estilo WhatsApp: agrupa mensagens por dia.
  // "Hoje" / "Ontem" / dia da semana (últimos 7 dias) / "25 de maio" /
  // "25/05/2024" quando o ano é diferente.
  const formatDateSeparator = (date: string) => {
    const d = new Date(date);
    const startOfDay = (x: Date) =>
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const now = new Date();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (dayDiff === 0) return 'Hoje';
    if (dayDiff === 1) return 'Ontem';
    if (dayDiff > 1 && dayDiff < 7) {
      const w = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    }
    return d.toLocaleDateString('pt-BR');
  };

  return (
    // min-h-0 é load-bearing: sem ele, o scroll-container interno cresce
    // pelo conteúdo (default min-height de flex children) e empurra o
    // ChatInput pra fora do painel — quebra dramaticamente quando o pai
    // é um modal com altura fixa.
    <div
      className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col lg:min-w-[400px]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de arrastar-e-soltar arquivos */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 m-3 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Paperclip className="h-9 w-9" />
            <p className="text-base font-semibold">Solte os arquivos aqui para enviar</p>
          </div>
        </div>
      )}
      {/* Abinha flutuante na borda direita pra abrir/fechar o painel do contato
          (estilo igual ao toggle da sidebar esquerda). */}
      {onTogglePanel && (
        <button
          onClick={onTogglePanel}
          title={panelOpen ? 'Fechar painel' : 'Abrir painel'}
          className="group absolute right-0 top-1/2 z-30 hidden h-12 w-5 -translate-y-1/2 items-center justify-center rounded-l-md bg-zinc-100 text-zinc-500 opacity-60 ring-1 ring-zinc-200 transition-all duration-200 hover:bg-zinc-200 hover:text-zinc-900 hover:opacity-100 lg:flex dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          {panelOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      )}
      <ConversationHeader
        conversation={conversation}
        onUpdate={onConversationUpdate}
        panelOpen={panelOpen}
        onTogglePanel={onTogglePanel}
        onToggleSearch={toggleConvSearch}
        onBack={onBack}
      />

      {/* Barra de busca dentro da conversa */}
      {convSearchOpen && (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              ref={convSearchInputRef}
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') gotoMatch(e.shiftKey ? -1 : 1);
                if (e.key === 'Escape') toggleConvSearch();
              }}
              placeholder="Buscar nesta conversa…"
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <span className="min-w-[52px] text-center text-[12px] tabular-nums text-zinc-400">
            {convSearch.trim() ? `${matchIds.length ? matchIdx + 1 : 0}/${matchIds.length}` : ''}
          </span>
          <button
            onClick={() => gotoMatch(-1)}
            disabled={matchIds.length === 0}
            title="Anterior"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => gotoMatch(1)}
            disabled={matchIds.length === 0}
            title="Próximo"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={toggleConvSearch}
            title="Fechar busca"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PendingActionsList conversationId={conversation.id} />

      <EngagementWindowBanner
        channelType={conversation.channel.type}
        messages={messages}
      />

      <ScheduledMessagesBar conversationId={conversation.id} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#ece5dd] px-6 py-5 dark:bg-zinc-900">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-2.5">
            {auditData.length > 0 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={toggleHideLogs}
                  title={hideLogs ? 'Mostrar registros do sistema' : 'Ocultar registros do sistema'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10.5px] font-medium text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  {hideLogs ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {hideLogs ? `Mostrar registros (${auditData.length})` : 'Ocultar registros'}
                </button>
              </div>
            )}
            {(() => {
              const reactionMap = new Map<string, string[]>();
              for (const msg of messages) {
                if (msg.type === 'REACTION' && msg.content?.reaction) {
                  const targetId = msg.content.reaction.targetMessageId;
                  if (targetId) {
                    const existing = reactionMap.get(targetId) || [];
                    existing.push(msg.content.reaction.emoji);
                    reactionMap.set(targetId, existing);
                  }
                }
              }
              // Injeta as notas internas no timeline como pseudo-mensagens
              // (reaproveita o render âmbar do branch isInternal), ordenadas
              // junto com as mensagens por createdAt.
              const noteMessages = (notesData as Array<{ id: string; content: string; createdAt: string; authorName?: string }>).map((n) => ({
                id: `note-${n.id}`,
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: { text: n.content },
                status: 'SENT',
                senderName: n.authorName ?? 'Equipe',
                createdAt: n.createdAt,
                metadata: { isInternal: true, noteId: n.id },
              }));
              // Logs internos viram pseudo-mensagens "de sistema" (pílula central).
              const auditMessages = (auditData as Array<{ id: string; label: string; createdAt: string }>).map((a) => ({
                id: `audit-${a.id}`,
                conversationId: conversation.id,
                direction: 'SYSTEM',
                type: 'SYSTEM',
                content: { text: a.label },
                status: 'SENT',
                createdAt: a.createdAt,
                metadata: { isSystem: true },
              }));
              const visibleMessages = ([
                ...messages.filter((m) => m.type !== 'REACTION'),
                ...noteMessages,
                ...(hideLogs ? [] : auditMessages),
              ] as any[]).sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              );
              let lastDateKey = '';
              return visibleMessages.map((msg, _msgIdx) => {
                const isOutbound = msg.direction === 'OUTBOUND';
                const isSearchMatch = matchIds.includes(msg.id);
                const isCurrentMatch = currentMatchId === msg.id;
                const StatusIcon = statusIcons[msg.status] || Clock;
                const reactions = reactionMap.get(msg.externalId || '') || [];
                const isRevoked = !!msg.revokedAt;
                const msgDate = new Date(msg.createdAt);
                const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;
                const showDateSeparator = dateKey !== lastDateKey;
                lastDateKey = dateKey;
                const isInternal = !!(msg.metadata as Record<string, any>)?.isInternal;
                const isSystem = !!(msg.metadata as Record<string, any>)?.isSystem;
                // Mostrar o nome do remetente só na 1ª msg de uma sequência do
                // mesmo autor/direção (evita repetir o nome quando manda várias
                // seguidas). Reinicia após separador de data ou troca de autor.
                const _prevMsg = _msgIdx > 0 ? visibleMessages[_msgIdx - 1] : undefined;
                const _senderKey = (m: any) =>
                  m?.sender?.id ?? m?.metadata?.aiAgentId ?? m?.senderId ?? (m?.direction === 'OUTBOUND' ? 'me' : 'them');
                const sameSenderAsPrev =
                  !showDateSeparator &&
                  !!_prevMsg &&
                  _prevMsg.direction === msg.direction &&
                  !(_prevMsg.metadata as Record<string, any>)?.isInternal &&
                  !(_prevMsg.metadata as Record<string, any>)?.isSystem &&
                  _senderKey(_prevMsg) === _senderKey(msg);
                const dateSeparator = showDateSeparator ? (
                  <div className="flex justify-center pb-1 pt-3 first:pt-0">
                    <span className="rounded-full bg-zinc-200/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                ) : null;

                // Log interno — pílula central discreta (atribuição, status, IA…).
                if (isSystem) {
                  return (
                    <Fragment key={msg.id}>
                      {dateSeparator}
                      <div className="flex justify-center px-2 py-1">
                        <span className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-zinc-200/60 px-3 py-1 text-center text-[11px] text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                          <Info className="h-3 w-3 shrink-0 opacity-70" />
                          <span>
                            {msg.content?.text}
                            <span className="ml-1 opacity-60">· {formatTime(msg.createdAt)}</span>
                          </span>
                        </span>
                      </div>
                    </Fragment>
                  );
                }

                // Internal note — só a equipe vê, renderiza como card âmbar central.
                if (isInternal) {
                  const noteText =
                    typeof msg.content?.text === 'string' ? msg.content.text : '';
                  return (
                    <Fragment key={msg.id}>
                      {dateSeparator}
                      <div className="flex justify-center px-2 py-1.5">
                        <div className="w-full max-w-[80%] rounded-lg border-l-[3px] border-amber-300 bg-amber-50/70 px-3.5 py-2.5 text-[13px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/10 dark:text-amber-100">
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <StickyNote className="h-3 w-3" /> Nota interna · só a equipe vê
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{noteText}</p>
                          <p className="mt-1 text-right text-[10px] text-amber-500/70">
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={msg.id}>
                  {dateSeparator}
                  <div
                    id={`msg-${msg.id}`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMsgMenu({ msg, x: e.clientX, y: e.clientY });
                    }}
                    className={`group flex items-end gap-2 rounded-lg px-1 py-0.5 transition-colors ${isOutbound ? 'justify-end' : 'justify-start'} ${
                      isCurrentMatch
                        ? 'bg-amber-200/70 ring-2 ring-amber-400 dark:bg-amber-500/25'
                        : isSearchMatch
                          ? 'bg-amber-100/60 dark:bg-amber-500/10'
                          : ''
                    }`}
                  >
                    {/* Botão "Responder" no hover. Aparece do lado de
                        FORA da bolha — esquerda quando outbound (msg
                        nossa, espaço à direita da bolha), direita quando
                        inbound (msg do cliente, espaço à esquerda).
                        Reactions e bolhas curtas mantêm o botão visível.
                        Mensagens já revogadas não mostram ações. */}
                    {isOutbound && !isRevoked && (
                      <div className="flex items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startReply(msg)}
                          className="rounded-full bg-white p-1.5 text-zinc-400 shadow-sm ring-1 ring-zinc-200 hover:text-zinc-700 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:text-zinc-100"
                          title="Responder"
                          aria-label="Responder esta mensagem"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        {/* Editar mensagem enviada — visível ao passar o mouse (além do
                            botão direito). Só texto, não-nota, e dentro da janela de ~15min
                            do WhatsApp (depois disso o próprio WhatsApp bloqueia a edição). */}
                        {msg.type === 'TEXT' &&
                          !msg.metadata?.isInternal &&
                          Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000 && (
                            <button
                              type="button"
                              onClick={() => startEditMessage(msg)}
                              className="rounded-full bg-white p-1.5 text-zinc-400 shadow-sm ring-1 ring-zinc-200 hover:text-[#228BE6] dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:text-[#228BE6]"
                              title="Editar (até 15 min do envio)"
                              aria-label="Editar esta mensagem"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => handleRevoke(msg)}
                          className="rounded-full bg-white p-1.5 text-zinc-400 shadow-sm ring-1 ring-zinc-200 hover:text-red-600 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:text-red-400"
                          title="Deletar pra todos"
                          aria-label="Deletar mensagem pra todos"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {!isOutbound && (
                      <ContactAvatar
                        size="sm"
                        name={
                          conversation.isGroup && msg.senderName
                            ? msg.senderName
                            : conversation.contact.name
                        }
                        avatarUrl={
                          conversation.isGroup ? null : conversation.contact.avatarUrl
                        }
                      />
                    )}
                    <div className="relative max-w-[75%]">
                      {conversation.isGroup && !isOutbound && msg.senderName && (
                        <p className="mb-0.5 ml-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                          {msg.senderName}
                        </p>
                      )}
                      {isOutbound && !sameSenderAsPrev && (() => {
                        const aiId = msg.metadata?.aiAgentId as string | undefined;
                        const agent = aiId ? agentMap.get(aiId) : null;
                        if (agent) {
                          return (
                            <div className="mb-0.5 mr-1 flex items-center justify-end gap-1.5">
                              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{agent.name}</span>
                              {agent.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={agent.avatarUrl} alt="" className="h-4 w-4 rounded-full bg-white object-cover" />
                              ) : (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-300 text-[8px] font-semibold text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
                                  {agent.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                          );
                        }
                        const humanName = msg.sender?.name || (msg.senderId && msg.senderId === user?.id ? user?.name : null);
                        return humanName ? (
                          <p className="mb-0.5 mr-1 text-right text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                            {humanName}
                          </p>
                        ) : null;
                      })()}
                      {msg.metadata?.replyTo?.story && (
                        <StoryReplyCard
                          story={msg.metadata.replyTo.story}
                          isOutbound={isOutbound}
                        />
                      )}
                      {msg.metadata?.replyTo?.ad && (
                        <div
                          className={`mb-1 rounded-xl border px-3 py-2 text-xs ${
                            isOutbound
                              ? 'border-black/10 bg-black/5 text-zinc-600 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400'
                          }`}
                        >
                          <p className="text-[10px] uppercase tracking-wider opacity-70">
                            Respondeu ao anúncio
                          </p>
                          {msg.metadata.replyTo.ad.title && (
                            <p className="mt-0.5 font-medium">
                              {msg.metadata.replyTo.ad.title}
                            </p>
                          )}
                        </div>
                      )}
                      {/* Quote box: aparece quando a msg respondeu outra
                          mensagem (reply nativo do WhatsApp/Cloud API ou
                          fallback do Instagram que persistimos via
                          metadata.replyTo). Click scrolla até a msg
                          original quando a temos no histórico carregado. */}
                      {msg.metadata?.replyTo &&
                        (msg.metadata.replyTo.previewText ||
                          msg.metadata.replyTo.senderName) && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = msg.metadata?.replyTo?.messageId;
                              if (!targetId) return;
                              const el = document.getElementById(
                                `msg-${targetId}`,
                              );
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-2', 'ring-primary');
                                setTimeout(
                                  () =>
                                    el.classList.remove('ring-2', 'ring-primary'),
                                  1500,
                                );
                              }
                            }}
                            className={`mb-1 block w-full rounded-md border-l-2 border-emerald-600 px-2 py-1 text-left text-xs ${
                              isOutbound
                                ? 'bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-black/20 dark:text-zinc-200'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {msg.metadata.replyTo.senderName && (
                              <p className="text-[10px] font-semibold opacity-80">
                                {msg.metadata.replyTo.senderName}
                              </p>
                            )}
                            {msg.metadata.replyTo.previewText && (
                              <p className="mt-0.5 truncate">
                                {msg.metadata.replyTo.previewText}
                              </p>
                            )}
                          </button>
                        )}
                      {isRevoked ? (
                        <div
                          className={`flex items-center gap-2 rounded-2xl border border-dashed px-4 py-2.5 italic ${
                            isOutbound
                              ? 'rounded-br-md border-primary/40 bg-primary/5 text-primary/70'
                              : 'rounded-bl-md border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-500'
                          }`}
                          title={
                            msg.revokeSucceededRemote
                              ? 'Mensagem deletada pra todos (provider confirmou).'
                              : 'Deletada apenas no Chat Frider Andrade — o cliente ainda pode estar vendo no app dele.'
                          }
                        >
                          <Ban className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-sm">
                            Mensagem deletada
                            {msg.revokeSucceededRemote === false ? ' (só aqui)' : ''}
                          </span>
                          <span className="ml-auto text-[10px] opacity-70">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      ) : msg.type === 'AUDIO' ? (
                        <>
                          <AudioMessagePlayer
                            message={msg}
                            isOutbound={isOutbound}
                            onTranscribed={() => {
                              queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
                            }}
                          />
                          <div
                            className={`mt-1 flex items-center gap-1 px-1 text-[10px] ${
                              isOutbound ? 'justify-end text-zinc-400' : 'text-zinc-400'
                            }`}
                          >
                            <span>{formatTime(msg.createdAt)}</span>
                            {isOutbound && (
                              <span title={statusTooltip(msg.status, msg.failedReason)}>
                                <StatusIcon
                                  className={`h-3 w-3 ${
                                    msg.status === 'FAILED'
                                      ? 'text-red-500'
                                      : msg.status === 'READ'
                                        ? 'text-sky-600 dark:text-sky-300'
                                        : ''
                                  }`}
                                />
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                            isOutbound
                              ? 'rounded-br-md bg-[#d9fdd3] text-zinc-800 dark:bg-[#005c4b] dark:text-zinc-50'
                              : 'rounded-bl-md bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                          }`}
                        >
                          <div className={msg.type === 'TEXT' && !(editing && editing.id === msg.id) ? 'flex flex-wrap items-end justify-end gap-x-2 gap-y-0.5' : ''}>
                          <div className={msg.type === 'TEXT' && !(editing && editing.id === msg.id) ? 'min-w-0' : 'contents'}>
                          {msg.type === 'TEXT' ? (
                            editing && editing.id === msg.id ? (
                              <div className="flex flex-col gap-1.5">
                                <textarea
                                  value={editing.text}
                                  onChange={(e) => setEditing({ id: msg.id, text: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                    if (e.key === 'Escape') setEditing(null);
                                  }}
                                  autoFocus
                                  rows={2}
                                  className="w-full min-w-[220px] resize-none rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-primary dark:border-white/15 dark:bg-black/20 dark:text-zinc-100"
                                />
                                <div className="flex items-center justify-end gap-2 text-[11px]">
                                  <button onClick={() => setEditing(null)} className="rounded px-2 py-0.5 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                                  <button onClick={handleSaveEdit} disabled={savingEdit} className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-0.5 font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                                    {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />} Salvar
                                  </button>
                                </div>
                              </div>
                            ) : /^\[Undecryptable\]|^\[Unsupported message type\]|n[ãa]o foi poss[ií]vel descriptografar/i.test(msg.content?.text || '') ? (
                              <p className="flex items-center gap-1.5 text-sm italic text-zinc-500 dark:text-zinc-400">
                                <Ban className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                Mensagem criptografada não pôde ser carregada — abra o WhatsApp no celular para vê-la.
                              </p>
                            ) : (
                              <MessageText
                                text={msg.content?.text || ''}
                                isOutbound={isOutbound}
                              />
                            )
                          ) : msg.type === 'IMAGE' ? (
                            <MediaImage message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'VIDEO' ? (
                            <MediaVideo message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'DOCUMENT' ? (
                            <MediaDocument message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'STICKER' ? (
                            <MediaSticker message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'LOCATION' ? (
                            <MediaLocation message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'CONTACT' ? (
                            <MediaContact message={msg} isOutbound={isOutbound} />
                          ) : msg.type === 'TEMPLATE' ? (
                            <TemplateMessage content={msg.content} isOutbound={isOutbound} />
                          ) : (
                            <p className="text-sm italic opacity-70">Mensagem não suportada</p>
                          )}
                          </div>
                          <div
                            className={`flex items-center gap-1 text-[10px] ${
                              msg.type === 'TEXT' && !(editing && editing.id === msg.id) ? 'self-end' : 'mt-1'
                            } ${
                              isOutbound ? 'justify-end opacity-70' : 'text-zinc-400'
                            }`}
                          >
                            {msg.metadata?.edited && <span className="italic opacity-70">editado</span>}
                            <span>{formatTime(msg.createdAt)}</span>
                            {isOutbound && (
                              <span title={statusTooltip(msg.status, msg.failedReason)}>
                                <StatusIcon
                                  className={`h-3 w-3 ${
                                    msg.status === 'FAILED'
                                      ? 'text-red-500'
                                      : msg.status === 'READ'
                                        ? 'text-sky-600 dark:text-sky-300'
                                        : ''
                                  }`}
                                />
                              </span>
                            )}
                          </div>
                          </div>
                        </div>
                      )}
                      {/* Falhou? Mostra o MOTIVO na tela (não só no tooltip) e
                          oferece reenviar — menos quando reenviar é inútil
                          (conta bloqueada na Meta): aí só explica o que fazer. */}
                      {isOutbound && msg.status === 'FAILED' && !isRevoked && (
                        <div className="mt-1 flex flex-col items-end gap-1">
                          <span className="max-w-[min(28rem,100%)] text-right text-[11px] leading-snug text-red-600 dark:text-red-400">
                            {failureText(msg.failedReason)}
                          </span>
                          {!isAccountBlocked(msg.failedReason) && (
                          <button
                            type="button"
                            onClick={() => handleResend(msg)}
                            disabled={resendingId === msg.id}
                            title={statusTooltip(msg.status, msg.failedReason)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                          >
                            <RotateCw className={`h-3 w-3 ${resendingId === msg.id ? 'animate-spin' : ''}`} />
                            {resendingId === msg.id ? 'Reenviando…' : 'Reenviar'}
                          </button>
                          )}
                        </div>
                      )}
                      {reactions.length > 0 && (
                        <div className={`absolute -bottom-2 ${isOutbound ? 'right-2' : 'left-2'} flex gap-0.5`}>
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-xs shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:ring-zinc-700">
                            {[...new Set(reactions)].join('')}
                            {reactions.length > 1 && (
                              <span className="ml-0.5 text-[10px] text-zinc-400">{reactions.length}</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    {!isOutbound && (
                      <button
                        type="button"
                        onClick={() => startReply(msg)}
                        className="self-center rounded-full bg-white p-1.5 text-zinc-400 opacity-0 shadow-sm ring-1 ring-zinc-200 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:text-zinc-100"
                        title="Responder"
                        aria-label="Responder esta mensagem"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  </Fragment>
                );
              });
            })()}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {replyingTo && (
        <ReplyPreviewBar message={replyingTo} onCancel={cancelReply} />
      )}
      {needsIntervention && !pontual ? (
        <InterventionBar
          conversation={conversation}
          loading={intervening}
          onPontual={() => setPontual(true)}
          onIntervir={handleIntervir}
        />
      ) : (
        <>
          {pontual && !isMine && (
            <div className="flex items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <Hand className="h-3.5 w-3.5" />
                Intervenção pontual — você não é o responsável por esta conversa
              </span>
              <button
                type="button"
                onClick={() => setPontual(false)}
                className="rounded px-1.5 py-0.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                Cancelar
              </button>
            </div>
          )}
          {showPrestacaoBar && prestacaoTx && (
            <PrestacaoApprovalBar
              txId={prestacaoTx}
              conversationId={conversation.id}
              agendarDefault={prestacaoAgendar}
              onDone={() => setPrestacaoDismissed(prestacaoTx)}
            />
          )}
          <ChatInput
            ref={chatInputRef}
            onSend={handleSend}
            onSendAudio={handleSendAudio}
            onSendInternal={handleSendInternal}
            onSendMedia={handleSendMedia}
            onSendContact={handleSendContact}
            onGenerateSummary={() => setSummaryOpen(true)}
            onSchedule={async (scheduleText, scheduledAtISO) => {
              try {
                await scheduledMessagesService.create({
                  conversationId: conversation.id,
                  text: scheduleText,
                  scheduledAt: scheduledAtISO,
                });
                toast.success('Mensagem agendada');
                queryClient.invalidateQueries({
                  queryKey: ['scheduled-messages', conversation.id],
                });
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Erro ao agendar');
                throw err; // mantém o texto no compositor em caso de erro
              }
            }}
            sendingFrom={
              conversation.channel.phoneNumber
                ? formatPhone(conversation.channel.phoneNumber)
                : conversation.channel.name
            }
            signatureName={user?.name ?? null}
            quickReplies={quickReplies}
            contactName={conversation.contact?.name ?? null}
            onSendRemoteAttachment={handleSendRemoteAttachment}
            channelId={
              conversation.channel.type.startsWith('WHATSAPP')
                ? conversation.channelId
                : null
            }
            onSendTemplate={
              conversation.channel.type.startsWith('WHATSAPP')
                ? handleSendTemplate
                : undefined
            }
            onScheduleTemplate={
              conversation.channel.type.startsWith('WHATSAPP')
                ? async (payload, scheduledAtISO) => {
                    try {
                      await scheduledMessagesService.create({
                        conversationId: conversation.id,
                        template: payload,
                        scheduledAt: scheduledAtISO,
                      });
                      toast.success('Template agendado');
                      queryClient.invalidateQueries({
                        queryKey: ['scheduled-messages', conversation.id],
                      });
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message || 'Erro ao agendar template');
                      throw err; // mantém o seletor aberto para corrigir
                    }
                  }
                : undefined
            }
            disabled={conversation.status === 'CLOSED'}
          />
        </>
      )}
      {summaryOpen && (
        <ConversationSummaryModal
          conversationId={conversation.id}
          onClose={() => setSummaryOpen(false)}
        />
      )}
      {forwardMsg && (
        <ForwardMessageModal message={forwardMsg} onClose={() => setForwardMsg(null)} />
      )}

      {/* Menu de contexto da mensagem (botão direito) — estilo WhatsApp */}
      {msgMenu && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setMsgMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMsgMenu(null); }} />
          <div
            className="fixed z-[56] w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            style={{
              left: Math.min(msgMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
              top: Math.min(msgMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360),
            }}
          >
            {[
              { icon: Reply, label: 'Responder', onClick: () => startReply(msgMenu.msg) },
              { icon: Smile, label: 'Reagir', onClick: () => toast.info('Reações em breve') },
              {
                icon: Star,
                label: msgMenu.msg.metadata?.favorited ? 'Desfavoritar' : 'Favoritar',
                onClick: () => handleFavorite(msgMenu.msg),
              },
              { icon: Forward, label: 'Encaminhar', onClick: () => setForwardMsg(msgMenu.msg) },
              { icon: Copy, label: 'Copiar', onClick: () => copyMessageText(msgMenu.msg) },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setMsgMenu(null); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
              >
                <item.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                {item.label}
              </button>
            ))}
            {msgMenu.msg.direction === 'OUTBOUND' && !msgMenu.msg.metadata?.isInternal && (
              <>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                {msgMenu.msg.type === 'TEXT' &&
                  !msgMenu.msg.revokedAt &&
                  Date.now() - new Date(msgMenu.msg.createdAt).getTime() < 15 * 60 * 1000 && (
                    <button
                      onClick={() => { startEditMessage(msgMenu.msg); setMsgMenu(null); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                    >
                      <Pencil className="h-4 w-4 shrink-0 text-zinc-400" />
                      Editar
                    </button>
                  )}
                <button
                  onClick={() => { handleRevoke(msgMenu.msg); setMsgMenu(null); }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  Apagar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Barra fina logo acima do ChatInput mostrando que estamos compondo uma
 * resposta a uma mensagem específica. X cancela. Replica o visual do
 * WhatsApp Web — borda colorida à esquerda + sender + preview truncado.
 */
function ReplyPreviewBar({
  message,
  onCancel,
}: {
  message: Message;
  onCancel: () => void;
}) {
  const sender =
    message.direction === 'OUTBOUND'
      ? message.sender?.name || 'Você'
      : (message.senderName ?? 'Cliente');
  const c = (message.content ?? {}) as Record<string, any>;
  const preview =
    (typeof c.text === 'string' && c.text) ||
    (typeof c.caption === 'string' && c.caption) ||
    `[${(message.type || 'mensagem').toLowerCase()}]`;
  return (
    <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
        <p className="text-xs font-medium text-primary">Respondendo {sender}</p>
        <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
          {preview}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Cancelar resposta"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Barra de intervenção (paridade LíderHub). Aparece no lugar do compositor
 * quando a conversa está com outro atendente ou conduzida pela IA. Informa
 * quem está conduzindo e oferece "Intervenção pontual" (libera o compositor
 * sem reatribuir) ou "Intervir na conversa" (assume de vez + pausa a IA).
 */
function InterventionBar({
  conversation,
  loading,
  onPontual,
  onIntervir,
}: {
  conversation: Conversation;
  loading: boolean;
  onPontual: () => void;
  onIntervir: () => void;
}) {
  const contactName = conversation.contact?.name || 'Este contato';
  const assigneeName = conversation.assignedTo?.name;
  const aiConducting = conversation.aiEnabled !== false;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/30">
      <span className="flex flex-1 min-w-0 items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        {assigneeName ? (
          <>
            <span className="truncate">
              <strong className="font-semibold">{contactName}</strong> está
              associado a{' '}
              <strong className="font-semibold">{assigneeName}</strong>
            </span>
          </>
        ) : (
          <>
            <Bot className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {aiConducting
                ? 'A inteligência artificial está conduzindo este atendimento'
                : `${contactName} ainda não tem responsável`}
            </span>
          </>
        )}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onPontual}
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/40"
        >
          Intervenção pontual
        </button>
        <button
          type="button"
          onClick={onIntervir}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Hand className="h-4 w-4" />
          )}
          Intervir na conversa
        </button>
      </div>
    </div>
  );
}
