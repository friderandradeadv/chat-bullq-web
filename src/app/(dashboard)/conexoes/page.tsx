'use client';

import { ChannelsList } from '@/features/channels/components/channels-list';

export default function ConexoesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Conexões</h1>
        <p className="text-xs text-zinc-500">
          Gerencie suas conexões com canais de comunicação.
        </p>
      </header>
      <div className="px-6 py-6">
        <ChannelsList />
      </div>
    </div>
  );
}
