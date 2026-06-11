'use client';

import { useSearchParams } from 'next/navigation';
import { AlertCircle, LayoutGrid, Layers, List } from 'lucide-react';
import { QueuesOverviewTab } from '@/features/queues/components/queues-overview-tab';
import { QueuesListTab } from '@/features/queues/components/queues-list-tab';
import { JobsTab } from '@/features/queues/components/jobs-tab';

type Tab = 'overview' | 'queues' | 'jobs';

const TAB_META: Record<Tab, { label: string; icon: React.ElementType }> = {
  overview: { label: 'Visão geral', icon: LayoutGrid },
  queues:   { label: 'Filas',       icon: Layers },
  jobs:     { label: 'Jobs',        icon: List },
};

const VALID_TABS: Tab[] = ['overview', 'queues', 'jobs'];

export default function QueuesPage() {
  const searchParams = useSearchParams();
  const raw = (searchParams.get('tab') ?? 'overview') as Tab;
  const tab: Tab = VALID_TABS.includes(raw) ? raw : 'overview';
  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <AlertCircle className="h-5 w-5 text-primary" />
          Filas
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <Icon className="h-4 w-4 text-zinc-400" />
          <span className="text-zinc-700 dark:text-zinc-300">{meta.label}</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && <QueuesOverviewTab />}
        {tab === 'queues' && <QueuesListTab />}
        {tab === 'jobs' && <JobsTab />}
      </div>
    </div>
  );
}
