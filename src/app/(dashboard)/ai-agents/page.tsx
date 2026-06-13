'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bot, BarChart3, User, Sparkles, Wrench, Activity, ShieldCheck } from 'lucide-react';
import { AgentsList } from '@/features/ai-agents/components/agents-list';
import { JarvisOverviewTab } from '@/features/ai-agents/components/jarvis/overview-tab';
import { JarvisAgentTab } from '@/features/ai-agents/components/jarvis/agent-tab';
import { JarvisSkillsTab } from '@/features/ai-agents/components/jarvis/skills-tab';
import { JarvisToolsTab } from '@/features/ai-agents/components/jarvis/tools-tab';
import { JarvisRunsTab } from '@/features/ai-agents/components/jarvis/runs-tab';
import { JarvisWatchdogTab } from '@/features/ai-agents/components/jarvis/watchdog-tab';

type Tab = 'overview' | 'agents' | 'skills' | 'tools' | 'agent' | 'runs' | 'watchdog';

const TAB_META: Record<Tab, { label: string; icon: React.ElementType }> = {
  overview: { label: 'Visão geral', icon: BarChart3 },
  agents: { label: 'Agentes', icon: Bot },
  skills: { label: 'Skills', icon: Sparkles },
  tools: { label: 'Tools', icon: Wrench },
  runs: { label: 'Execuções', icon: Activity },
  watchdog: { label: 'Watchdog', icon: ShieldCheck },
  agent: { label: 'Por agente', icon: User },
};

const VALID_TABS: Tab[] = ['overview', 'agents', 'skills', 'tools', 'runs', 'watchdog', 'agent'];

export default function AiAgentsPage() {
  const searchParams = useSearchParams();
  // Default = 'agents': a sidebar "Agentes" cai direto na LISTA de agentes
  // (estilo LíderHub). As outras seções do Jarvis ficam na barra de abas.
  const raw = (searchParams.get('tab') ?? 'agents') as Tab;
  const tab: Tab = VALID_TABS.includes(raw) ? raw : 'agents';
  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 pt-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <Bot className="h-5 w-5 text-primary" />
          Jarvis
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <Icon className="h-4 w-4 text-zinc-400" />
          <span className="text-zinc-700 dark:text-zinc-300">{meta.label}</span>
        </h1>

        {/* Barra de navegação entre as seções do Jarvis (recupera o acesso
            perdido no achatamento da sidebar — sem isso, só a aba default
            era alcançável). */}
        <nav className="-mb-px mt-3 flex items-center gap-1 overflow-x-auto">
          {VALID_TABS.map((t) => {
            const m = TAB_META[t];
            const TabIcon = m.icon;
            const active = t === tab;
            return (
              <Link
                key={t}
                href={`/ai-agents?tab=${t}`}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {m.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && <JarvisOverviewTab />}
        {tab === 'agents' && <AgentsList />}
        {tab === 'skills' && <JarvisSkillsTab />}
        {tab === 'tools' && <JarvisToolsTab />}
        {tab === 'runs' && <JarvisRunsTab />}
        {tab === 'watchdog' && <JarvisWatchdogTab />}
        {tab === 'agent' && <JarvisAgentTab />}
      </div>
    </div>
  );
}
