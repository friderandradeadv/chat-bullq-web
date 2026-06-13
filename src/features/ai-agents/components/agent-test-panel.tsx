'use client';

/**
 * Aba "Testar" do editor de agente (estilo LíderHub). Um chat de teste que roda
 * o agente DE VERDADE (prompt real + tools), mas SEM efeitos colaterais — nada
 * é enviado ao cliente, nada é persistido, nenhuma tool é executada. Mostra a
 * resposta E as ações que o agente TOMARIA (transferir, etiquetar, etc.).
 *
 * Testa o prompt ATUAL do editor (mesmo não salvo) — recebe systemPrompt/
 * modelId/temperature do estado da página.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Send, RotateCcw, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsService, type AgentTestFinalAction } from '../services/ai-agents.service';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; args: unknown }[];
  finalAction?: AgentTestFinalAction;
}

// Rótulos amigáveis das ações que o agente tomaria (tool calls que não são a
// resposta de texto). Cai num genérico se a tool não estiver mapeada.
const ACTION_LABELS: Record<string, string> = {
  tagConversation: '🏷️ Aplicaria etiqueta',
  transferToHuman: '🤝 Transferiria para humano',
  delegateToAgent: '➡️ Delegaria para especialista',
  handBackToOrchestrator: '↩️ Devolveria ao orquestrador',
  setContactStatus: '🟢 Mudaria o status do funil',
  setDepartment: '🏢 Mudaria o departamento',
  assignResponsible: '👤 Definiria o responsável',
  notifyMember: '🔔 Notificaria a equipe',
  saveContactName: '📝 Salvaria o nome do contato',
  getProductPitch: '📦 Buscaria o pitch do produto',
  checkBonusEligibility: '🎁 Checaria elegibilidade de bônus',
  checkMembersAccess: '🔑 Checaria acesso de membros',
  listAvailableAgents: '🗂️ Consultaria os especialistas',
};

function actionLabel(name: string): string {
  return ACTION_LABELS[name] ?? `⚙️ ${name}`;
}

interface Props {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  onClose: () => void;
}

export function AgentTestPanel({
  agentId,
  agentName,
  systemPrompt,
  modelId,
  temperature,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiAgentsService.test(agentId, {
        systemPrompt,
        modelId,
        temperature,
        messages: [...history, { role: 'user', content: text }],
      });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: (res.reply ?? '').trim(),
          toolCalls: res.toolCalls,
          finalAction: res.finalAction,
        },
      ]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao testar o agente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Testar — {agentName}
            </p>
            <p className="text-[11px] text-zinc-400">Conversa de teste · nada é enviado ao cliente</p>
          </div>
          <button
            onClick={() => setMessages([])}
            title="Reiniciar teste"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            title="Fechar"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-400">
              <FlaskConical className="h-8 w-8" />
              <p className="text-sm">Mande uma mensagem como se fosse o cliente.</p>
              <p className="text-[11px]">Testa o prompt atual — mesmo sem salvar.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const actions = (m.toolCalls ?? []).filter((t) => t.name !== 'replyToConversation');
            return (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[85%] space-y-1.5">
                  {(m.content || m.role === 'user') && (
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {m.content || <span className="italic opacity-60">(só ações, sem texto)</span>}
                    </div>
                  )}
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {actions.map((t, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800"
                        >
                          {actionLabel(t.name)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-100 px-3.5 py-2 dark:bg-zinc-800">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Mensagem do cliente…"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
