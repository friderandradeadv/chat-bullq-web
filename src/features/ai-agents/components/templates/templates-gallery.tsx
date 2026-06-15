'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { useOrgId } from '@/hooks/use-org-query-key';
import { aiAgentsService } from '../../services/ai-agents.service';
import { agentFoldersService } from '../../services/agent-folders.service';
import { buildTemplateVMs } from './template-helpers';
import { TemplateCard } from './template-card';

/**
 * Vitrine "Templates de Agentes" (topo da tela de Agentes — paridade LíderHub).
 * Mostra os 4 templates mais usados + um card "Ver todos" → /ai-agents/templates.
 */
export function TemplatesGallery() {
  const orgId = useOrgId();
  const router = useRouter();

  const { data: folders } = useQuery({
    queryKey: ['agent-folders', orgId],
    queryFn: () => agentFoldersService.list(),
  });
  const { data: agents } = useQuery({
    queryKey: ['ai-agents', orgId],
    queryFn: () => aiAgentsService.list(),
  });

  const templates = buildTemplateVMs(folders, agents);
  if (templates.length === 0) return null;

  const top = templates.slice(0, 4);

  return (
    <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Templates de Agentes
        </h3>
        <button
          onClick={() => router.push('/ai-agents/templates')}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Explorar templates <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {top.map((vm) => (
          <TemplateCard
            key={vm.folder.id}
            vm={vm}
            onClick={() => router.push(`/ai-agents/templates?t=${vm.folder.id}`)}
          />
        ))}
        {/* Card "Ver todos" */}
        <button
          onClick={() => router.push('/ai-agents/templates')}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-4 text-zinc-500 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
        >
          <LayoutGrid className="h-6 w-6" />
          <span className="text-xs font-medium">Ver todos</span>
        </button>
      </div>
    </div>
  );
}
