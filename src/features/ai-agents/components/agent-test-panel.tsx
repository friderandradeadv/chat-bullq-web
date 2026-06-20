'use client';

/**
 * Aba "Testar" do editor de agente (estilo LíderHub). Um chat de teste que roda
 * o agente DE VERDADE (prompt real + tools), mas SEM efeitos colaterais — nada
 * é enviado ao cliente, nada é persistido, nenhuma tool é executada. Mostra a
 * resposta E as ações que o agente TOMARIA (transferir, etiquetar, etc.).
 *
 * Quando algo dá errado, mostra uma BOLHA DE ERRO amigável (com dica + "Tentar
 * de novo") em vez de um toast genérico. E tem o botão "Diagnóstico", que roda
 * uma checagem de saúde do agente e diz o que arrumar — pra o operador resolver
 * sozinho sem precisar de suporte.
 */

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  RotateCcw,
  RefreshCw,
  Loader2,
  FlaskConical,
  Stethoscope,
  AlertTriangle,
  CircleCheck,
  CircleX,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  aiAgentsService,
  type AgentTestFinalAction,
  type AgentDiagnoseResult,
} from '../services/ai-agents.service';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; args: unknown }[];
  finalAction?: AgentTestFinalAction;
  /** Quando preenchido, a bolha vira um cartão de erro com dica + retry. */
  error?: { message: string; hint: string };
}

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
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<AgentDiagnoseResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  // Roda um turno do agente com o histórico dado + o texto do cliente.
  const runTurn = async (history: TestMessage[], text: string) => {
    setLoading(true);
    try {
      const res = await aiAgentsService.test(agentId, {
        systemPrompt,
        modelId,
        temperature,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: text },
        ],
      });
      if (res.error) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: '',
            error: { message: res.error!.message, hint: res.error!.hint },
          },
        ]);
        return;
      }
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
      // Falha de rede/HTTP que nem chegou no backend tratado.
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: '',
          error: {
            message:
              err?.response?.data?.message || 'Não consegui falar com o servidor.',
            hint: 'Verifique a conexão e clique em "Tentar de novo".',
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    await runTurn(history, text);
  };

  // Tenta de novo a última mensagem do cliente: remove a bolha de erro e
  // reusa o último texto enviado pelo usuário.
  const retry = async () => {
    if (loading) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // Tudo até (e incluindo) a última mensagem do usuário fica; o que veio
    // depois (a bolha de erro) sai.
    const idx = messages.lastIndexOf(lastUser);
    const history = messages.slice(0, idx);
    setMessages(messages.slice(0, idx + 1));
    await runTurn(history, lastUser.content);
  };

  const runDiagnose = async () => {
    if (diagnosing) return;
    setDiagnosing(true);
    try {
      const res = await aiAgentsService.diagnose(agentId);
      setDiagnosis(res);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Não consegui rodar o diagnóstico',
      );
    } finally {
      setDiagnosing(false);
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
            <p className="text-[11px] text-zinc-400">
              Conversa de teste · nada é enviado ao cliente
            </p>
          </div>
          <button
            onClick={runDiagnose}
            title="Diagnóstico — checa a saúde do agente"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            {diagnosing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Diagnóstico</span>
          </button>
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
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-400">
              <FlaskConical className="h-8 w-8" />
              <p className="text-sm">Mande uma mensagem como se fosse o cliente.</p>
              <p className="text-[11px]">Testa o prompt atual — mesmo sem salvar.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const actions = (m.toolCalls ?? []).filter(
              (t) => t.name !== 'replyToConversation',
            );
            if (m.error) {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] space-y-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 dark:border-red-900/50 dark:bg-red-950/40">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                          {m.error.message}
                        </p>
                        <p className="mt-1 text-[12px] leading-snug text-red-600/90 dark:text-red-400/90">
                          {m.error.hint}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={retry}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-[12px] font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div className="max-w-[85%] space-y-1.5">
                  {(m.content || m.role === 'user') && (
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {m.content || (
                        <span className="italic opacity-60">
                          (só ações, sem texto)
                        </span>
                      )}
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

        {/* Sub-painel de Diagnóstico (sobrepõe quando aberto) */}
        {diagnosis && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <button
                onClick={() => setDiagnosis(null)}
                title="Voltar"
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Diagnóstico — {diagnosis.agentName}
                </p>
                <p
                  className={`text-[11px] font-medium ${
                    diagnosis.ok ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {diagnosis.ok
                    ? 'Tudo certo pra atender'
                    : 'Tem algo bloqueando o atendimento'}
                </p>
              </div>
              <button
                onClick={runDiagnose}
                title="Rodar de novo"
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {diagnosing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {diagnosis.checks.map((c) => {
                const Icon =
                  c.status === 'ok'
                    ? CircleCheck
                    : c.status === 'warn'
                      ? AlertTriangle
                      : CircleX;
                const tone =
                  c.status === 'ok'
                    ? 'text-emerald-500'
                    : c.status === 'warn'
                      ? 'text-amber-500'
                      : 'text-red-500';
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {c.label}
                        </p>
                        <p className="mt-0.5 break-words text-[12px] text-zinc-500 dark:text-zinc-400">
                          {c.detail}
                        </p>
                        {c.fix && (
                          <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            <span className="font-medium">Como arrumar:</span>{' '}
                            {c.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
