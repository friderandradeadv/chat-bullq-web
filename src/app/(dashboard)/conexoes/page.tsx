'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Cable, Plus, CheckCircle2, XCircle, Settings as SettingsIcon } from 'lucide-react';
import { channelsService } from '@/features/channels/services/channels.service';
import { ZappfyIcon, MetaIcon, InstagramIcon } from '@/components/ui/icons';
import { useOrgId } from '@/hooks/use-org-query-key';

const channelIcons: Record<string, React.ElementType> = {
  WHATSAPP_ZAPPFY: ZappfyIcon,
  WHATSAPP_OFFICIAL: MetaIcon,
  INSTAGRAM: InstagramIcon,
};

const channelLabels: Record<string, string> = {
  WHATSAPP_ZAPPFY: 'WhatsApp',
  WHATSAPP_OFFICIAL: 'WhatsApp Oficial',
  INSTAGRAM: 'Instagram',
};

export default function ConexoesPage() {
  const orgId = useOrgId();
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelsService.list(),
  });

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conexões</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Canais conectados ao seu atendimento (WhatsApp, Instagram).
          </p>
        </div>
        <Link
          href="/settings/channels"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova conexão
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
          ))
        ) : channels.length === 0 ? (
          <div className="col-span-full flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
            <Cable className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">Nenhuma conexão configurada</p>
            <Link href="/settings/channels" className="mt-2 text-xs text-primary hover:underline">
              Conectar um canal →
            </Link>
          </div>
        ) : (
          channels.map((ch) => {
            const Icon = channelIcons[ch.type] ?? Cable;
            return (
              <div
                key={ch.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {ch.name}
                  </p>
                  <p className="text-xs text-zinc-400">{channelLabels[ch.type] ?? ch.type}</p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${
                      ch.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {ch.isActive ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {ch.isActive ? 'Conectado' : 'Inativo'}
                  </span>
                </div>
                <Link
                  href="/settings/channels"
                  title="Gerenciar"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                >
                  <SettingsIcon className="h-4 w-4" />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
