'use client';

import { BadgeCheck } from 'lucide-react';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import type { AiAgent } from '../../services/ai-agents.service';
import { type TemplateVM, templateSubtitle } from './template-helpers';

function AgentAvatar({ agent, z }: { agent: AiAgent; z: number }) {
  if (agent.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agent.avatarUrl}
        alt={agent.name}
        title={agent.name}
        style={{ zIndex: z }}
        className="h-8 w-8 rounded-full border-2 border-white object-cover dark:border-zinc-900"
      />
    );
  }
  return (
    <div
      title={agent.name}
      style={{ zIndex: z, backgroundColor: avatarColor(agent.name) }}
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-zinc-900"
    >
      {avatarInitials(agent.name)}
    </div>
  );
}

export function TemplateCard({
  vm,
  onClick,
}: {
  vm: TemplateVM;
  onClick: () => void;
}) {
  const shown = vm.agents.slice(0, 3);
  const extra = vm.agents.length - shown.length;
  return (
    <button onClick={onClick} className="cursor-pointer text-left">
      <div className="group flex max-w-full flex-col rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {shown.map((a, i) => (
              <AgentAvatar key={a.id} agent={a} z={shown.length - i} />
            ))}
            {extra > 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-800">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  +{extra}
                </span>
              </div>
            )}
            {vm.agents.length === 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-800">
                <span className="text-xs font-medium text-zinc-400">0</span>
              </div>
            )}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {vm.folder.useCount} {vm.folder.useCount === 1 ? 'uso' : 'usos'}
          </span>
        </div>

        <h3 className="mb-1 truncate text-sm font-medium text-zinc-900 transition-colors group-hover:text-primary dark:text-zinc-100">
          {vm.folder.name}
        </h3>
        <p className="mb-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {templateSubtitle(vm)}
        </p>

        <div className="mt-auto flex items-center gap-1.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Frider Andrade</span>
          <BadgeCheck className="h-3.5 w-3.5 text-primary" fill="currentColor" stroke="white" />
        </div>
      </div>
    </button>
  );
}
