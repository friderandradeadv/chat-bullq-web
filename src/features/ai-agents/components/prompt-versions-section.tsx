'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  aiAgentsService,
  type PromptVersion,
} from '../services/ai-agents.service';

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ageMs = Date.now() - d.getTime();
  const ageHours = Math.floor(ageMs / 3_600_000);
  if (ageHours < 1) return 'há minutos';
  if (ageHours < 24) return `há ${ageHours}h`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 30) return `há ${ageDays}d`;
  return `há ${Math.floor(ageDays / 30)} meses`;
}

/**
 * Histórico de versões do system prompt. "Salvar versão" persiste o prompt
 * atual do editor e cria um snapshot; "Restaurar" traz o prompt da versão de
 * volta pro editor (e marca como ativa). O runner sempre usa o prompt vivo.
 */
export function PromptVersionsSection({
  agentId,
  currentSystemPrompt,
  currentOperationalContext,
  onRestore,
}: {
  agentId: string;
  currentSystemPrompt: string;
  currentOperationalContext: string;
  onRestore: (systemPrompt: string, operationalContext: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['ai-agent-prompt-versions', agentId],
    queryFn: () => aiAgentsService.listPromptVersions(agentId),
    enabled: open,
  });

  const versions = data?.versions ?? [];
  const activeVersion = data?.activeVersion ?? 1;

  const handleSaveVersion = async () => {
    setBusy(true);
    try {
      // Persiste o prompt atual do editor e tira o snapshot.
      await aiAgentsService.update(agentId, {
        systemPrompt: currentSystemPrompt,
        operationalContext: currentOperationalContext || null,
      });
      await aiAgentsService.savePromptVersion(agentId, {
        label: label.trim() || undefined,
        changeNote: note.trim() || undefined,
      });
      toast.success('Versão do prompt salva');
      setLabel('');
      setNote('');
      setShowForm(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['ai-agent', agentId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar a versão');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (v: PromptVersion) => {
    setBusy(true);
    try {
      await aiAgentsService.restorePromptVersion(agentId, v.version);
      onRestore(v.systemPrompt, v.operationalContext ?? '');
      toast.success(`Versão ${v.version} restaurada`);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['ai-agent', agentId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao restaurar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <History className="h-3.5 w-3.5" />
        Versões do prompt
        {versions.length > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {versions.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Salve marcos do prompt e volte pra qualquer um quando quiser.
            </p>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Salvar versão
              </button>
            )}
          </div>

          {showForm && (
            <div className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                placeholder="Rótulo (ex: v2 — tom mais formal)"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="O que mudou? (opcional)"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setLabel('');
                    setNote('');
                  }}
                  className="rounded-md px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveVersion}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? 'Salvando…' : 'Salvar prompt como versão'}
                </button>
              </div>
            </div>
          )}

          {versions.length === 0 ? (
            <p className="mt-2 text-[11px] italic text-zinc-400">
              Nenhuma versão salva ainda.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {versions.map((v) => {
                const isActive = v.version === activeVersion;
                return (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                          v{v.version}
                          {v.label ? ` · ${v.label}` : ''}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <Check className="h-2.5 w-2.5" /> ativa
                          </span>
                        )}
                      </div>
                      {v.changeNote && (
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {v.changeNote}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-400">
                        {formatRelative(v.createdAt)}
                      </p>
                    </div>
                    {!isActive && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRestore(v)}
                        title="Restaurar esta versão"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <RotateCcw className="h-3 w-3" /> Restaurar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
