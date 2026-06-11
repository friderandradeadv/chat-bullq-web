'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Zap, FileText, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '../services/inbox.service';

export function ConversationSummaryModal({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'pick' | 'detailed'>('pick');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState<'simple' | 'detailed' | null>(null);

  const generate = async (m: 'simple' | 'detailed') => {
    setLoading(m);
    try {
      await inboxService.summarizeConversation(conversationId, m, m === 'detailed' ? instructions : undefined);
      queryClient.invalidateQueries({ queryKey: ['notes', conversationId] });
      toast.success('Resumo gerado e salvo nas Notas da conversa');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao gerar resumo');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Resumo da conversa</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                O resumo é salvo nas Notas da conversa — só você e sua equipe veem.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'pick' ? (
          <div className="mt-4 space-y-2.5">
            <button
              onClick={() => generate('simple')}
              disabled={loading !== null}
              className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-zinc-700"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {loading === 'simple' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resumo Simplificado</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  A IA resume a conversa de forma curta e objetiva.
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode('detailed')}
              disabled={loading !== null}
              className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-zinc-700"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resumo Detalhado</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Em tópicos, e você pode dar instruções pra IA (ex: extrair todas as queixas).
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Instruções para a IA (opcional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Ex: extraia os dados do cliente e liste os próximos passos do caso"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setMode('pick')}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                ← Voltar
              </button>
              <button
                onClick={() => generate('detailed')}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading === 'detailed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar resumo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
