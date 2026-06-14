'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsService, type AiAgent } from '../services/ai-agents.service';

const EXAMPLES = [
  'Agente especializado em atraso de voo, que qualifica o passageiro e fecha contrato',
  'Agente de divórcio consensual que acolhe o cliente e agenda reunião',
  'Agente de BPC/LOAS que verifica requisitos e propõe os honorários',
];

/** "Criar agente com IA": o operador descreve em linguagem natural e a IA
 *  gera o prompt completo (persona + fluxo + uso das ferramentas). */
export function GenerateAgentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (agent: AiAgent) => void;
}) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const submit = async () => {
    const desc = description.trim();
    if (desc.length < 8) {
      toast.error('Descreva o agente com mais detalhes.');
      return;
    }
    setLoading(true);
    try {
      const agent = await aiAgentsService.generate({ description: desc });
      toast.success('Agente criado pela IA');
      onCreated(agent);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao gerar o agente';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Criar agente com IA</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Descreva o agente que você quer. A IA monta o prompt completo — persona, fluxo de
          qualificação e uso das ferramentas. Nasce inativo pra você revisar.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          placeholder="Ex: crie um agente especializado em atraso de voo, que qualifica o passageiro, calcula a indenização e fecha o contrato"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescription(ex)}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 hover:border-primary/40 hover:text-primary dark:border-zinc-700 dark:text-zinc-400"
            >
              {ex.length > 40 ? ex.slice(0, 40) + '…' : ex}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Criar com IA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
