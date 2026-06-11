'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  AlertCircle,
} from 'lucide-react';

const STORAGE_KEY = 'queues-tree-expanded';

type Tab = 'overview' | 'queues' | 'jobs';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutGrid },
  { id: 'queues', label: 'Filas', icon: Layers },
  { id: 'jobs', label: 'Jobs', icon: List },
];

export function QueuesTree() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  });

  const isQueues = pathname?.startsWith('/queues');
  const activeTab = (searchParams.get('tab') as Tab) ?? 'overview';

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    }
  };

  const goRoot = () => router.push('/queues?tab=overview');
  const goTab = (tab: Tab) => router.push(`/queues?tab=${tab}`);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          className="flex h-7 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-300"
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={goRoot}
          className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
            isQueues
              ? 'bg-zinc-950/5 text-zinc-950 dark:bg-white/5 dark:text-white'
              : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white'
          }`}
        >
          <AlertCircle className="size-5" />
          <span className="flex-1">Filas</span>
        </button>
      </div>

      {expanded && (
        <div className="ml-5 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = isQueues && activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  isActive
                    ? 'bg-zinc-950/5 font-medium text-zinc-900 dark:bg-white/5 dark:text-white'
                    : 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <Icon className="size-3.5 text-zinc-400" />
                <span className="flex-1">{t.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
