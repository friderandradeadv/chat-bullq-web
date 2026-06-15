'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { TemplatesMarketplace } from '@/features/ai-agents/components/templates/templates-marketplace';

export default function AgentTemplatesPage() {
  return (
    <div className="h-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <TemplatesMarketplace />
      </Suspense>
    </div>
  );
}
