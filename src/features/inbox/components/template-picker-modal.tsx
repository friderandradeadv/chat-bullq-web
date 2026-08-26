'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, X, Loader2, Send, ChevronLeft, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService, type WaTemplate } from '../services/inbox.service';

interface Props {
  /** Canal (conexão) de onde o template sai — define quais templates existem. */
  channelId: string;
  /** Nome do contato — prefill do {{1}} (a maioria dos templates começa pelo nome). */
  contactName?: string | null;
  onClose: () => void;
  onSend: (payload: {
    name: string;
    language: string;
    parameters: string[];
    previewText: string;
  }) => Promise<void>;
  /**
   * Rótulo da ação de confirmar. O mesmo seletor serve para enviar agora e para
   * agendar; só o verbo muda, e o usuário precisa ver qual dos dois vai fazer.
   */
  confirmLabel?: string;
  /** Linha de contexto no topo (ex.: a data para a qual o template vai). */
  contextNote?: string | null;
}

/** Substitui {{1}}, {{2}}, … pelos valores (ou mantém o placeholder se vazio). */
function fill(body: string, params: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => {
    const v = params[Number(n) - 1];
    return v && v.trim() ? v : m;
  });
}

export function TemplatePickerModal({
  channelId,
  contactName,
  onClose,
  onSend,
  confirmLabel = 'Enviar template',
  contextNote,
}: Props) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WaTemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    inboxService
      .listTemplates(channelId)
      .then((rows) => {
        if (active) setTemplates(rows);
      })
      .catch(() => {
        if (active) setTemplates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [channelId]);

  const pick = (t: WaTemplate) => {
    setSelected(t);
    // prefill {{1}} com o nome do contato (convenção da maioria dos templates)
    const init = Array.from({ length: t.paramCount }, () => '');
    if (t.paramCount > 0 && contactName) init[0] = contactName;
    setParams(init);
  };

  const preview = useMemo(() => {
    if (!selected) return '';
    return [selected.headerText, fill(selected.bodyText, params), selected.footerText]
      .filter(Boolean)
      .join('\n\n');
  }, [selected, params]);

  const allFilled = useMemo(
    () => params.every((p) => p.trim().length > 0),
    [params],
  );

  const handleSend = async () => {
    if (!selected || sending || !allFilled) return;
    setSending(true);
    try {
      await onSend({
        name: selected.name,
        language: selected.language,
        parameters: params.map((p) => p.trim()),
        previewText: fill(selected.bodyText, params),
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erro ao enviar template');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <MessageSquareText className="h-4 w-4 text-primary" />
            )}
            {selected ? selected.name : confirmLabel}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {contextNote && (
            <p className="mb-2 rounded-lg bg-primary/5 px-3 py-2 text-[12px] font-medium text-primary">
              {contextNote}
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="px-2 py-10 text-center text-[13px] leading-relaxed text-zinc-400">
              Nenhum template aprovado neste canal.
              <br />
              Templates são criados e aprovados no WhatsApp Manager (Meta).
            </p>
          ) : !selected ? (
            // Lista de templates
            <div className="flex flex-col gap-1">
              <p className="px-1 pb-1 text-[11px] text-zinc-400">
                Use um template para falar com quem está fora da janela de 24h.
              </p>
              {templates.map((t) => (
                <button
                  key={`${t.name}-${t.language}`}
                  onClick={() => pick(t)}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-100 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-zinc-800"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                      {t.name}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {t.category}
                    </span>
                  </span>
                  <span className="line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug text-zinc-400">
                    {t.bodyText}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            // Preenchimento de parâmetros + preview
            <div className="flex flex-col gap-3">
              {selected.paramCount === 0 ? (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[12px] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                  Este template não tem campos para preencher.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: selected.paramCount }, (_, i) => (
                    <label key={i} className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-zinc-500">
                        {`{{${i + 1}}}`}
                        {i === 0 && contactName ? ' (nome do contato)' : ''}
                      </span>
                      <input
                        autoFocus={i === 0}
                        value={params[i] ?? ''}
                        onChange={(e) =>
                          setParams((prev) => {
                            const next = [...prev];
                            next[i] = e.target.value;
                            return next;
                          })
                        }
                        placeholder={`Valor do parâmetro ${i + 1}`}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Prévia
                </p>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {preview}
                </p>
                {selected.buttons && selected.buttons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.buttons.map((b, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-primary dark:border-zinc-700"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selected && templates.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !allFilled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
