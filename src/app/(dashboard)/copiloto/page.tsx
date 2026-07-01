'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import {
  adminCopilotService,
  type CopilotTurn,
} from '@/features/admin-copilot/services/admin-copilot.service';

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const SUGGESTIONS = [
  'Por que a Camila parou de responder a conversa do [nome do cliente]?',
  'Religa a IA da conversa do [nome ou telefone].',
  'A conversa do [nome] está com a IA ligada ou pausada?',
];

export default function CopilotoPage() {
  const [messages, setMessages] = useState<CopilotTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next: CopilotTurn[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await adminCopilotService.chat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content:
            '⚠️ Não consegui responder: ' +
            (e?.response?.data?.message || e?.message || 'erro desconhecido') +
            (e?.response?.status === 403
              ? ' (o Copiloto é só para sócios/admin).'
              : ''),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6"
      style={{ fontFamily: INTER }}
    >
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Copiloto
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Seu assistente interno — diagnostica e age no BullQ (sem depender de
            ninguém de fora).
          </p>
        </div>
      </div>

      {/* Conversa */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
              <Bot className="h-7 w-7" />
            </div>
            <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Pergunte em português. Ex: por que a IA parou numa conversa, ou
              peça pra religar a IA de um lead.
            </p>
            <div className="flex w-full max-w-md flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-600 transition hover:border-[#7048E8]/40 hover:bg-[#7048E8]/5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === 'user'
                  ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                  : 'bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20'
              }`}
            >
              {m.role === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === 'user'
                  ? 'rounded-tr-sm bg-[#7048E8] text-white'
                  : 'rounded-tl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> pensando…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="Escreva pro Copiloto…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7048E8] text-white transition hover:bg-[#5f3dd0] disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}
