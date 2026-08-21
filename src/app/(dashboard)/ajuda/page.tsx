'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, ChevronDown, GraduationCap, HelpCircle, ImageOff, Loader2, Send, Sparkles, User } from 'lucide-react';
import { helpService, type HelpTurn } from '@/features/help/services/help.service';

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const SUGESTOES = [
  'Como gero uma réplica a partir da contestação?',
  'Como crio um prazo de recurso de uma sentença?',
  'Como gero a petição inicial de RMC?',
  'Por que uma conversa parou de responder?',
];

// Guias passo a passo (texto agora; prints numa 2ª rodada).
const GUIAS: { titulo: string; passos: string[]; print?: string }[] = [
  {
    titulo: 'Gerar uma peça por IA (réplica, especificação de provas, recurso)',
    passos: [
      'Abra a Agenda e clique no prazo do processo, ou abra a ficha do Processo.',
      'No bloco Gerar peça (IA), escolha Réplica, Especificação de provas ou Recurso.',
      'Suba o documento-base pedido (contestação para réplica, réplica para especificação, sentença para recurso). É opcional, mas melhora muito o resultado.',
      'Se quiser, escolha o produto (RMC/RCC) e escreva instruções (ex.: enfatizar a ausência de assinatura ICP-Brasil).',
      'Clique em Gerar. Em uns 20s a peça baixa em .docx e fica nos Anexos do processo.',
      'Revise as teses e as lacunas “[ • ]” antes de protocolar — a peça é um rascunho da IA.',
    ],
    print: 'Bloco “Gerar peça (IA)” na Agenda e na ficha do Processo',
  },
  {
    titulo: 'Gerar a petição inicial de RMC/RCC',
    passos: [
      'Abra a ficha do Processo na fase Montar inicial.',
      'Clique em Preencher cadastro do cliente (IA) e confira os dados.',
      'Suba o JG (Histórico de Créditos / IR) para a justiça gratuita.',
      'Abra a calculadora em Calcular RMC/RCC e salve o resultado — vira o valor da causa.',
      'Clique em Inicial RMC ou Inicial RCC. A peça sai no timbrado e vai para os Anexos.',
    ],
    print: 'Ações da inicial na ficha do Processo',
  },
  {
    titulo: 'Criar um prazo de recurso de uma sentença/acórdão',
    passos: [
      'Na Agenda, clique no item da análise da decisão (sentença ou acórdão).',
      'Na seção Criar prazo de recurso, escolha o recurso (ex.: Apelação, Embargos, REsp/RE).',
      'O prazo é criado já com a contagem em dias úteis (feriados e recesso considerados).',
    ],
    print: 'Seção “Criar prazo de recurso” no detalhe do item da Agenda',
  },
  {
    titulo: 'Religar a IA de uma conversa que “parou de responder”',
    passos: [
      'Vá em Conversas e abra a conversa do cliente.',
      'Quando um atendente responde manual, a IA é pausada automaticamente naquela conversa.',
      'Reative a IA na própria conversa para ela voltar a responder.',
    ],
    print: 'Toggle da IA dentro da conversa',
  },
];

/** Render leve de **negrito** preservando quebras de linha. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

export default function AjudaPage() {
  const [messages, setMessages] = useState<HelpTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState<number | null>(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next: HelpTurn[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await helpService.chat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages([
        ...next,
        { role: 'assistant', content: '⚠️ Não consegui responder: ' + (e?.response?.data?.message || e?.message || 'erro desconhecido') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-4 py-6" style={{ fontFamily: INTER }}>
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ajuda</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pergunte “como faço X” e o assistente te ensina passo a passo — ou veja os guias ao lado.
          </p>
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Guias */}
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <Link
            href="/academia"
            className="mb-3 flex items-center gap-2.5 rounded-xl border border-[#7048E8]/30 bg-[#7048E8]/5 px-3 py-2.5 text-sm transition hover:bg-[#7048E8]/10"
          >
            <GraduationCap className="h-5 w-5 shrink-0 text-[#7048E8]" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-zinc-800 dark:text-zinc-100">Academia Frider</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Trilhas completas: onboarding, hub, Claude, prazos, teses e ética
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#7048E8]" />
          </Link>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-zinc-400">Guias rápidos</p>
          <div className="space-y-2">
            {GUIAS.map((g, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setAberto(aberto === i ? null : i)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                >
                  {g.titulo}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition ${aberto === i ? 'rotate-180' : ''}`} />
                </button>
                {aberto === i && (
                  <div className="border-t border-zinc-100 px-3 pb-3 pt-2 dark:border-zinc-800">
                    <ol className="list-decimal space-y-1.5 pl-4 text-sm text-zinc-600 dark:text-zinc-300">
                      {g.passos.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ol>
                    {g.print && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40">
                        <ImageOff className="h-4 w-4 shrink-0" />
                        <span>Print em breve — {g.print}</span>
                      </div>
                    )}
                    <button
                      onClick={() => send(`Me explique com mais detalhes: ${g.titulo}`)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#7048E8] hover:underline"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Pedir explicação detalhada à IA
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
                  <Bot className="h-7 w-7" />
                </div>
                <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                  Pergunte em português. O assistente ensina onde clicar, passo a passo.
                </p>
                <div className="flex w-full max-w-md flex-col gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-600 transition hover:border-[#7048E8]/40 hover:bg-[#7048E8]/5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20'}`}>
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'rounded-tr-sm bg-[#7048E8] text-white' : 'rounded-tl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'}`}>
                  <Rich text={m.content} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> montando o passo a passo…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

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
              placeholder="Como faço para…?"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7048E8] text-white transition hover:bg-[#5f3dd0] disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
