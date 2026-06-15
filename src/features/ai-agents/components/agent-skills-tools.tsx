'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Wrench, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { aiAgentsService, type AgentKind } from '../services/ai-agents.service';
import { aiCatalogService } from '../services/ai-catalog.service';
import {
  BUILTIN_TOOL_META,
  FALLBACK_TOOL_META,
  TOOL_GROUP_ORDER,
} from '../lib/builtin-tools-meta';

/**
 * Skills & Ferramentas de um agente. Dois blocos:
 *  1. Ferramentas built-in (sempre disponíveis por kind — só leitura, informativo).
 *  2. Skills personalizadas (HTTP/SQL do catálogo) que dá pra ligar/desligar +
 *     toggle de "exige aprovação humana".
 */
export function AgentSkillsAndTools({
  agentId,
  agentKind,
}: {
  agentId: string;
  agentKind?: AgentKind;
}) {
  return (
    <div className="space-y-4">
      <BuiltinToolbox agentKind={agentKind} />
      <CustomSkills agentId={agentId} />
    </div>
  );
}

// ─── Bloco 1: ferramentas built-in ──────────────────────────────────
function BuiltinToolbox({ agentKind }: { agentKind?: AgentKind }) {
  const { data: tools, isLoading } = useQuery({
    queryKey: ['builtin-tools'],
    queryFn: () => aiCatalogService.listBuiltinTools(),
  });

  const grouped = useMemo(() => {
    const list = (tools ?? []).map((t) => {
      const meta = BUILTIN_TOOL_META[t.name] ?? FALLBACK_TOOL_META(t.name, t.description);
      const available = !agentKind || t.kinds.includes(agentKind);
      return { ...t, meta, available };
    });
    const byGroup = new Map<string, typeof list>();
    for (const g of TOOL_GROUP_ORDER) byGroup.set(g, []);
    for (const item of list) {
      const arr = byGroup.get(item.meta.group) ?? [];
      arr.push(item);
      byGroup.set(item.meta.group, arr);
    }
    return [...byGroup.entries()].filter(([, arr]) => arr.length > 0);
  }, [tools, agentKind]);

  const availableCount = (tools ?? []).filter(
    (t) => !agentKind || t.kinds.includes(agentKind),
  ).length;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Ferramentas do agente
        </h4>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {availableCount} ativas
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Capacidades nativas que o agente já sabe usar — incluídas automaticamente
        conforme o tipo do agente. Cite-as no prompt com{' '}
        <code className="font-mono text-[10px]">@</code> para guiar quando usá-las.
      </p>

      {isLoading ? (
        <p className="px-2 py-4 text-center text-xs text-zinc-400">Carregando…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {group}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.map((t) => {
                  const Icon = t.meta.icon;
                  return (
                    <div
                      key={t.name}
                      title={t.available ? t.meta.description : `Disponível só para ${t.kinds.join(' / ')}`}
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                        t.available
                          ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40'
                          : 'border-dashed border-zinc-200 opacity-50 dark:border-zinc-800'
                      }`}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {t.meta.label}
                          </span>
                          {!t.available && (
                            <span className="rounded bg-zinc-200 px-1 text-[9px] uppercase text-zinc-500 dark:bg-zinc-700">
                              {t.kinds.includes('ORCHESTRATOR') ? 'orquestrador' : 'worker'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 line-clamp-2">
                          {t.meta.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bloco 2: skills personalizadas (catálogo HTTP/SQL) ─────────────
function CustomSkills({ agentId }: { agentId: string }) {
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
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Skills personalizadas ({skillIds.length})
          </h4>
        </div>
        <button
          onClick={handleSaveSkills}
          disabled={savingSkills || (skills ?? []).length === 0}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {savingSkills ? '…' : 'Salvar skills'}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Integrações sob medida (HTTP/SQL) que você cria no catálogo e liga a este
        agente. As ferramentas nativas acima já vêm incluídas.
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
            Nenhuma skill personalizada ainda. As ferramentas nativas acima já
            cobrem o atendimento — crie skills extras em Jarvis &gt; Skills para
            integrar sistemas (HTTP/SQL).
          </p>
        )}
      </div>
    </div>
  );
}
