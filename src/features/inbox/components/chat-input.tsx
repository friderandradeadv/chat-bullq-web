'use client';

import { useState, useRef, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Send, Plus, Mic, Trash2, Square, Loader2, StickyNote, Sparkles, FileUp, PenLine, Smile, X, FileText, CalendarClock, Clock, Zap, Film, Image as ImageIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { toast } from 'sonner';
import { useAudioRecorder } from '../hooks/use-audio-recorder';
import { EmojiPicker } from './emoji-picker';
import type {
  QuickReply,
  QuickReplyAttachment,
} from '@/features/settings/services/quick-replies.service';
import { parseNaturalDate, formatScheduledPreview } from '../lib/parse-natural-date';

const QR_ATT_ICON: Record<QuickReplyAttachment['type'], typeof FileText> = {
  DOCUMENT: FileText,
  VIDEO: Film,
  AUDIO: Mic,
  IMAGE: ImageIcon,
};

export interface ChatInputHandle {
  /** Empilha arquivos no preview do compositor (usado pelo drag & drop). */
  addFiles: (files: File[]) => void;
  /** Preenche o texto do compositor (usado pelo rascunho do robô). */
  setText: (text: string) => void;
}

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  onSendAudio?: (blob: Blob) => Promise<void>;
  /** Envia como nota interna (só a equipe vê, não vai pro cliente). */
  onSendInternal?: (text: string) => Promise<void>;
  /** Envia uma mídia (imagem/vídeo/documento) — caption opcional. */
  onSendMedia?: (file: File, caption?: string) => Promise<void>;
  /** Abre o modal de gerar resumo da conversa. */
  onGenerateSummary?: () => void;
  /** Agenda o texto atual para envio futuro (ISO 8601). */
  onSchedule?: (text: string, scheduledAtISO: string) => Promise<void>;
  /** Número/conexão de onde a mensagem é enviada (ex.: "+55 (44) 9157-4212"). */
  sendingFrom?: string | null;
  /** Nome do atendente p/ o toggle "Assinatura" (assina as mensagens). */
  signatureName?: string | null;
  /** Mensagens rápidas da org — digite "/" para abrir o seletor. */
  quickReplies?: QuickReply[];
  /** Nome do contato p/ substituir {{nome}} nas mensagens rápidas. */
  contactName?: string | null;
  /** Envia um anexo remoto (mídia por URL — usado pelas mensagens rápidas). */
  onSendRemoteAttachment?: (
    att: QuickReplyAttachment,
    caption?: string,
  ) => Promise<void>;
  disabled?: boolean;
}

interface PendingFile {
  file: File;
  /** object URL p/ preview de imagem/vídeo (revogado ao remover). */
  url?: string;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onSendAudio, onSendInternal, onSendMedia, onGenerateSummary, onSchedule, sendingFrom, signatureName, quickReplies, contactName, onSendRemoteAttachment, disabled },
  ref,
) {
  const [text, setText] = useState('');
  const [internalMode, setInternalMode] = useState(false);
  const [signatureOn, setSignatureOn] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleNL, setScheduleNL] = useState(''); // "amanhã às 7h"
  const [scheduleExact, setScheduleExact] = useState(''); // datetime-local (ajuste fino)
  const [useExact, setUseExact] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());
  // Mensagens rápidas "/" — anexos remotos pendentes + navegação do popup
  const [pendingAtts, setPendingAtts] = useState<QuickReplyAttachment[]>([]);
  const [qrIndex, setQrIndex] = useState(0);
  const [qrDismissed, setQrDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openSchedule = useCallback(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // default: +1h
    d.setSeconds(0, 0);
    setScheduleNL('');
    setScheduleExact(toLocalInput(d));
    setUseExact(false);
    setScheduleOpen(true);
  }, []);

  // Data resolvida pelo modo ativo (linguagem natural × ajuste fino).
  const parsedSchedule = useMemo<Date | null>(() => {
    if (useExact) {
      if (!scheduleExact) return null;
      const d = new Date(scheduleExact);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return scheduleNL.trim() ? parseNaturalDate(scheduleNL, nowTick) : null;
  }, [useExact, scheduleExact, scheduleNL, nowTick]);

  // Mantém o relógio do popover e o preview "agora são HH:MM" atualizados.
  useEffect(() => {
    if (!scheduleOpen) return;
    setNowTick(new Date());
    const t = setInterval(() => setNowTick(new Date()), 30_000);
    return () => clearInterval(t);
  }, [scheduleOpen]);

  const doSchedule = useCallback(
    async (when: Date | null) => {
      const trimmed = text.trim();
      if (!trimmed) {
        toast.error('Digite a mensagem antes de agendar.');
        return;
      }
      if (!when || Number.isNaN(when.getTime())) {
        toast.error('Não entendi a data. Ex.: "amanhã às 7h".');
        return;
      }
      if (when.getTime() <= Date.now()) {
        toast.error('Escolha um horário no futuro.');
        return;
      }
      if (!onSchedule || isScheduling) return;
      setIsScheduling(true);
      try {
        await onSchedule(trimmed, when.toISOString());
        setText('');
        setScheduleOpen(false);
        setScheduleNL('');
      } catch {
        /* erro tratado (toast) no caller */
      } finally {
        setIsScheduling(false);
      }
    },
    [text, onSchedule, isScheduling],
  );

  // ── Mensagens rápidas "/" ──────────────────────────────────────────────
  const slashQuery =
    !internalMode && text.startsWith('/') ? text.slice(1).toLowerCase() : null;

  const qrMatches = useMemo(() => {
    if (slashQuery === null || !quickReplies?.length) return [];
    if (!slashQuery) return quickReplies.slice(0, 8);
    return quickReplies
      .filter(
        (r) =>
          r.shortcut.toLowerCase().includes(slashQuery) ||
          r.content.toLowerCase().includes(slashQuery),
      )
      .slice(0, 8);
  }, [slashQuery, quickReplies]);

  const qrOpen = slashQuery !== null && !qrDismissed && qrMatches.length > 0;

  useEffect(() => {
    // novo texto → reabre o popup e volta a seleção pro topo
    setQrDismissed(false);
    setQrIndex(0);
  }, [text]);

  const applyVars = useCallback(
    (content: string) => {
      const firstName = (contactName ?? '').trim().split(/\s+/)[0] ?? '';
      return content.replace(/{{\s*nome\s*}}/gi, firstName);
    },
    [contactName],
  );

  const selectQuickReply = useCallback(
    (reply: QuickReply) => {
      setText(applyVars(reply.content));
      setPendingAtts(reply.attachments ?? []);
      setQrDismissed(true);
      textareaRef.current?.focus();
    },
    [applyVars],
  );

  const sendQuickAttachments = useCallback(async () => {
    if (!onSendRemoteAttachment) return;
    const trimmed = text.trim();
    const atts = pendingAtts;
    let captionUsed = false;
    for (let i = 0; i < atts.length; i++) {
      const att = atts[i];
      // caption vai na primeira mídia que suporta legenda (áudio não tem)
      const useCaption = !captionUsed && att.type !== 'AUDIO' && !!trimmed;
      await onSendRemoteAttachment(att, useCaption ? trimmed : att.caption);
      if (useCaption) captionUsed = true;
    }
    // texto sobrou (ex.: só anexos de áudio) → envia como mensagem separada
    if (trimmed && !captionUsed) {
      await onSend(trimmed);
    }
    setPendingAtts([]);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [pendingAtts, text, onSendRemoteAttachment, onSend]);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.size <= 64 * 1024 * 1024);
    if (valid.length < files.length) {
      toast.error('Alguns arquivos passam de 64MB e foram ignorados.');
    }
    if (!valid.length) return;
    setPending((prev) => [
      ...prev,
      ...valid.map((f) => ({
        file: f,
        url:
          f.type.startsWith('image/') || f.type.startsWith('video/')
            ? URL.createObjectURL(f)
            : undefined,
      })),
    ]);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      addFiles,
      setText: (t: string) => {
        setText(t);
        setTimeout(() => textareaRef.current?.focus(), 0);
      },
    }),
    [addFiles],
  );

  const removePending = (i: number) => {
    setPending((prev) => {
      const item = prev[i];
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter((_, idx) => idx !== i);
    });
  };
  const clearPending = () => {
    setPending((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
  };

  const handleSendPending = useCallback(async () => {
    if (!pending.length || !onSendMedia || isSending) return;
    setIsSending(true);
    const caption = text.trim();
    const items = pending;
    try {
      for (let i = 0; i < items.length; i++) {
        await onSendMedia(items[i].file, i === 0 && caption ? caption : undefined);
      }
      clearPending();
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erro ao enviar arquivo');
    } finally {
      setIsSending(false);
    }
  }, [pending, onSendMedia, isSending, text]);

  const handleSubmit = useCallback(async () => {
    if (pendingAtts.length > 0 && onSendRemoteAttachment) {
      if (isSending) return;
      setIsSending(true);
      try {
        await sendQuickAttachments();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err?.message || 'Erro ao enviar mensagem rápida');
      } finally {
        setIsSending(false);
      }
      return;
    }
    if (pending.length > 0) {
      await handleSendPending();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      if (internalMode && onSendInternal) {
        await onSendInternal(trimmed);
      } else {
        const sig =
          signatureOn && signatureName && !internalMode
            ? `*${signatureName}:*\n${trimmed}`
            : trimmed;
        await onSend(sig);
      }
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  }, [pendingAtts.length, onSendRemoteAttachment, sendQuickAttachments, pending.length, handleSendPending, text, isSending, internalMode, onSend, onSendInternal, signatureOn, signatureName]);

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    textareaRef.current?.focus();
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (files.length) addFiles(files);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (qrOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setQrIndex((i) => (i + 1) % qrMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setQrIndex((i) => (i - 1 + qrMatches.length) % qrMatches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectQuickReply(qrMatches[qrIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQrDismissed(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    // Expandido = área de redação maior (até ~55% da tela); normal = até 160px.
    const max = expanded ? Math.round(window.innerHeight * 0.55) : 160;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  };

  // Reajusta a altura sempre que alterna expandir/recolher ou o texto muda.
  useEffect(() => {
    handleInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, text]);

  const handleSendAudio = useCallback(async () => {
    if (!recorder.blob || !onSendAudio) return;
    setIsSendingAudio(true);
    try {
      await onSendAudio(recorder.blob);
      recorder.reset();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Erro ao enviar áudio',
      );
    } finally {
      setIsSendingAudio(false);
    }
  }, [recorder, onSendAudio]);

  const formatElapsed = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (disabled) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50">
        Conversa encerrada — reabra para enviar mensagens
      </div>
    );
  }

  // RECORDING MODE: shows a big bar with a pulsing red dot and the timer.
  if (recorder.state === 'recording') {
    return (
      <div className="border-t border-zinc-200 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-500/10">
          <button
            onClick={recorder.cancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20"
            aria-label="Cancelar gravação"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-medium tabular-nums">{formatElapsed(recorder.elapsedMs)}</span>
            <span className="text-xs opacity-70">Gravando…</span>
          </div>
          <button
            onClick={recorder.stop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600"
            aria-label="Parar gravação"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // PREVIEW MODE: the recording finished, user can listen/discard/send.
  if (recorder.state === 'stopped' && recorder.blob) {
    const audioSrc = URL.createObjectURL(recorder.blob);
    return (
      <div className="border-t border-zinc-200 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button
            onClick={recorder.cancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
            aria-label="Descartar áudio"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <audio
            controls
            src={audioSrc}
            className="h-9 flex-1 min-w-0"
          />
          <button
            onClick={handleSendAudio}
            disabled={isSendingAudio}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            aria-label="Enviar áudio"
          >
            {isSendingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
        </div>
        {recorder.error && (
          <p className="mt-1 text-xs text-red-500">{recorder.error}</p>
        )}
      </div>
    );
  }

  // IDLE MODE: text input + mic button.
  const canRecord = !!onSendAudio;
  const showMic = canRecord && !text.trim() && pending.length === 0 && pendingAtts.length === 0;

  return (
    <div className={`border-t px-5 py-3 transition-colors ${internalMode ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'}`}>
      {/* Top row — Nota interna toggle + Gerar resumo */}
      <div className="mb-2 flex items-center gap-3">
        {onSendInternal && (
          <button
            type="button"
            onClick={() => setInternalMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors ${
              internalMode ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${internalMode ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${internalMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <StickyNote className="h-3.5 w-3.5" />
            Nota interna
          </button>
        )}
        {signatureOn && signatureName && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <PenLine className="h-3 w-3" /> Assinando como <span className="font-semibold">{signatureName}:</span>
          </span>
        )}
        <div className="flex-1" />
        {sendingFrom && (
          <span className="hidden items-center gap-1 text-[11px] text-zinc-400 sm:inline-flex dark:text-zinc-500">
            Enviando de
            <span className="font-medium text-zinc-600 tabular-nums dark:text-zinc-300">{sendingFrom}</span>
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        onChange={handleFileChange}
      />
      {/* Anexos remotos da mensagem rápida selecionada (enviados por URL) */}
      {pendingAtts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingAtts.map((att, i) => {
            const Icon = QR_ATT_ICON[att.type];
            return (
              <span
                key={i}
                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                title={att.fileName || att.url}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{att.fileName || att.type.toLowerCase()}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAtts((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="shrink-0 rounded-full p-0.5 hover:bg-primary/10"
                  aria-label="Remover anexo"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {/* Preview dos arquivos selecionados/soltos — só envia ao confirmar */}
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900/60">
          {pending.map((p, i) => (
            <div
              key={i}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
              title={p.file.name}
            >
              {p.url && p.file.type.startsWith('image/') ? (
                <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
              ) : p.url && p.file.type.startsWith('video/') ? (
                <video src={p.url} className="h-full w-full object-cover" muted />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-zinc-500">
                  <FileText className="h-5 w-5" />
                  <span className="line-clamp-2 px-0.5 text-center text-[8px] leading-tight">
                    {p.file.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePending(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/55 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-2">
        {/* Popup de mensagens rápidas — digite "/" pra abrir (estilo LíderHub) */}
        {qrOpen && (
          <div className="absolute bottom-full left-0 z-[60] mb-2 max-h-80 w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <p className="flex items-center gap-1.5 px-3 pb-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              <Zap className="h-3 w-3" /> Mensagens rápidas
            </p>
            {qrMatches.map((r, i) => {
              const att = r.attachments?.[0];
              const AttIcon = att ? QR_ATT_ICON[att.type] : null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onMouseEnter={() => setQrIndex(i)}
                  onClick={() => selectQuickReply(r)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === qrIndex
                      ? 'bg-primary/[0.07] dark:bg-primary/15'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    /{r.shortcut}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[13px] text-zinc-600 dark:text-zinc-300">
                      {r.content || (att?.fileName ?? '')}
                    </span>
                  </span>
                  {AttIcon && (
                    <AttIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {emojiOpen && (
          <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
        )}
        {scheduleOpen && (
          <>
            {/* click-away */}
            <div className="fixed inset-0 z-[55]" onClick={() => setScheduleOpen(false)} />
            <div className="absolute bottom-full right-0 z-[60] mb-2 w-80 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">
                  <CalendarClock className="h-4 w-4 text-primary" /> Agendar mensagem
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(false)}
                  className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {!text.trim() && (
                <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  Digite a mensagem antes de agendar.
                </p>
              )}

              {/* Opções rápidas */}
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={isScheduling}
                  onClick={() => doSchedule(new Date(Date.now() + 60 * 60 * 1000))}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Clock className="h-4 w-4 text-zinc-500" /> Hoje daqui 1 hora
                </button>
                <button
                  type="button"
                  disabled={isScheduling}
                  onClick={() => doSchedule(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Clock className="h-4 w-4 text-zinc-500" /> Daqui 24 horas
                </button>
              </div>

              <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />

              {/* Agendar em — linguagem natural × ajuste fino */}
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Agendar em:
              </label>
              {!useExact ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={scheduleNL}
                    onChange={(e) => setScheduleNL(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        doSchedule(parsedSchedule);
                      }
                    }}
                    placeholder="amanhã às 15h"
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => doSchedule(parsedSchedule)}
                    disabled={!text.trim() || !parsedSchedule || isScheduling}
                    title="Agendar"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isScheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={scheduleExact}
                    onChange={(e) => setScheduleExact(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={() => doSchedule(parsedSchedule)}
                    disabled={!text.trim() || !parsedSchedule || isScheduling}
                    title="Agendar"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isScheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {/* Preview da data lida */}
              {!useExact && scheduleNL.trim() && (
                <p className={`mt-1.5 text-[11px] ${parsedSchedule ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {parsedSchedule ? `→ ${formatScheduledPreview(parsedSchedule)}` : 'Não entendi a data — tente "amanhã às 7h"'}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUseExact((v) => !v)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {useExact ? 'Escrever em palavras' : 'Escolher data exata'}
                </button>
                <span className="text-[11px] text-zinc-400">
                  Agora são {nowTick.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </>
        )}
        {/* Menu "+" — emoji, arquivo, gerar resumo, assinatura (estilo LíderHub) */}
        <Popover className="relative mb-1">
          <PopoverButton
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 data-[open]:bg-zinc-100 dark:data-[open]:bg-zinc-800"
            aria-label="Mais opções"
            title="Anexar, emoji e mais"
          >
            <Plus className="h-5 w-5" />
          </PopoverButton>
          <PopoverPanel
            anchor="top start"
            className="z-[60] w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl [--anchor-gap:8px] dark:border-zinc-700 dark:bg-zinc-900"
          >
            {({ close }) => (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => { close(); setEmojiOpen(true); }}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Smile className="h-4 w-4 text-zinc-500" />
                  Emoji
                </button>
                {onSendMedia && (
                  <button
                    type="button"
                    onClick={() => { close(); handlePickFile(); }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileUp className="h-4 w-4 text-zinc-500" />
                    Selecionar arquivo
                  </button>
                )}
                {onGenerateSummary && (
                  <button
                    type="button"
                    onClick={() => { close(); onGenerateSummary(); }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Gerar resumo
                  </button>
                )}
                {signatureName && (
                  <button
                    type="button"
                    onClick={() => setSignatureOn((v) => !v)}
                    className="flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2.5">
                      <PenLine className="h-4 w-4 text-zinc-500" />
                      Assinatura
                    </span>
                    <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${signatureOn ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${signatureOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </span>
                  </button>
                )}
              </div>
            )}
          </PopoverPanel>
        </Popover>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={pending.length > 0 ? 'Adicione uma legenda (opcional)…' : internalMode ? 'Escreva uma nota interna (só a equipe vê)...' : 'Digite uma mensagem...'}
          rows={1}
          className={`flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 dark:text-zinc-100 ${
            expanded ? 'max-h-[55vh] min-h-[160px]' : 'max-h-40 min-h-[40px]'
          } ${
            internalMode
              ? 'border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-400 dark:border-amber-800 dark:bg-amber-900/20'
              : 'border-zinc-200 bg-zinc-50 focus:border-primary focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900'
          }`}
        />
        {/* Expandir / recolher a área de redação */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher campo' : 'Expandir campo'}
          title={expanded ? 'Recolher campo' : 'Expandir campo'}
          className="mb-1 rounded-lg p-2.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        {/* Emoji — atalho dedicado ao lado de gravar áudio (estilo WhatsApp) */}
        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          aria-label="Emoji"
          title="Emoji"
          className={`mb-1 rounded-lg p-2.5 transition-colors ${
            emojiOpen
              ? 'bg-primary/10 text-primary'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          <Smile className="h-5 w-5" />
        </button>
        {/* Relógio — agendar a mensagem digitada (estilo LíderHub) */}
        {onSchedule && !internalMode && !!text.trim() && (
          <button
            type="button"
            onClick={() => (scheduleOpen ? setScheduleOpen(false) : openSchedule())}
            aria-label="Agendar mensagem"
            title="Agendar mensagem"
            className={`mb-1 rounded-lg p-2.5 transition-colors ${
              scheduleOpen
                ? 'bg-primary/10 text-primary'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <Clock className="h-5 w-5" />
          </button>
        )}
        {showMic ? (
          <button
            onClick={recorder.start}
            type="button"
            className="mb-1 rounded-lg bg-zinc-100 p-2.5 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Gravar áudio"
          >
            <Mic className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={(!text.trim() && pending.length === 0 && pendingAtts.length === 0) || isSending}
            className={`mb-1 rounded-lg p-2.5 text-white transition-colors disabled:opacity-50 ${
              internalMode && pending.length === 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            aria-label={pending.length > 0 ? 'Enviar arquivo(s)' : internalMode ? 'Salvar nota interna' : 'Enviar mensagem'}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : internalMode && pending.length === 0 ? <StickyNote className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </button>
        )}
      </div>
      {recorder.error && (
        <p className="mt-1.5 text-xs text-red-500">{recorder.error}</p>
      )}
    </div>
  );
});
