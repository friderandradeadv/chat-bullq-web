'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsService } from '../services/ai-agents.service';
import { aiCatalogService } from '../services/ai-catalog.service';

/**
 * Skills atribuídas a um agente + toggle de "exige aprovação humana".
 * Extraído do edit-agent-dialog para ser reusado na página de edição.
 */
export function AgentSkillsAndTools({ agentId }: { agentId: string }) {
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const queryClient = useQueryClient();

  const { data: skills } = useQuery({
    queryKey: ['ai-skills'],
    queryFn: () => aiCatalogService.listSkills(),
  });

  const { data: bindings } = useQuery({
    queryKey: ['ai-agent-skills', agentId],
    queryFn: () => aiAgentsService.listAgentSkills(agentId),
    enabled: !!agentId,
  });

  const approvalByskillId = new Map(
    (bindings ?? []).map((b) => [b.skillId, b.requiresApproval]),
  );

  useEffect(() => {
    if (!skills) return;
    const ids = skills
      .filter((s) => (s.agents ?? []).some((a) => a.agent.id === agentId))
      .map((s) => s.id);
    setSkillIds(ids);
  }, [skills, agentId]);

  const toggleSkill = (id: string) =>
    setSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    try {
      await aiCatalogService.setAgentSkills(agentId, skillIds);
      await queryClient.invalidateQueries({
        queryKey: ['ai-agent-skills', agentId],
      });
      toast.success('Skills atualizadas');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro');
    } finally {
      setSavingSkills(false);
    }
  };

  const toggleApproval = async (skillId: string, next: boolean) => {
    try {
      await aiAgentsService.setSkillApproval(agentId, skillId, next);
      await queryClient.invalidateQueries({
        queryKey: ['ai-agent-skills', agentId],
      });
      toast.success(
        next
          ? 'Skill agora exige aprovação humana antes de executar'
          : 'Skill volta a executar automaticamente',
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Skills atribuídas ({skillIds.length})
        </h4>
        <button
          onClick={handleSaveSkills}
          disabled={savingSkills}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {savingSkills ? '…' : 'Salvar skills'}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Cada skill é uma função invocável ligada à sua tool (provider). Built-in
        essenciais (reply/transfer/tag) são incluídas automaticamente.
      </p>
      <p className="mt-2 text-[10px] text-zinc-400">
        💡 Skills com{' '}
        <ShieldCheck className="inline h-3 w-3 text-amber-600" /> exigem aprovação
        humana via inbox antes de executar. Padrão: executa direto.
      </p>
      <div className="mt-2 max-h-72 overflow-y-auto">
        {(skills ?? []).map((s) => {
          const checked = skillIds.includes(s.id);
          const requiresApproval = approvalByskillId.get(s.id) ?? false;
          return (
            <div
              key={s.id}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-zinc-800 ${
                checked ? 'bg-white dark:bg-zinc-800' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSkill(s.id)}
                className="mt-0.5 h-3.5 w-3.5 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                  {s.category && (
                    <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] uppercase text-zinc-600 dark:bg-zinc-700">
                      {s.category}
                    </span>
                  )}
                  <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    {s.source}
                  </span>
                  {checked && (
                    <button
                      type="button"
                      onClick={() => toggleApproval(s.id, !requiresApproval)}
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        requiresApproval
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {requiresApproval ? 'Aprovação' : 'Auto'}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">
                  {s.description}
                  {s.tool && (
                    <>
                      {' · via '}
                      <code className="font-mono">{s.tool.name}</code>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
        {(skills ?? []).length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-zinc-400">
            Nenhuma skill cadastrada. Crie em Jarvis &gt; Skills.
          </p>
        )}
      </div>
    </div>
  );
}
