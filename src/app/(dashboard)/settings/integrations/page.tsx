'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSignature,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unplug,
  Plug,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { zapSignService, type ZapSignTemplate } from '@/features/settings/services/zapsign.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { cn } from '@/lib/utils';

export default function SettingsIntegrationsPage() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  const { data: status, isLoading } = useQuery({
    queryKey: ['zapsign-status', orgId],
    queryFn: () => zapSignService.getStatus(),
  });

  const { data: templates } = useQuery({
    queryKey: ['zapsign-templates', orgId],
    queryFn: () => zapSignService.getTemplates(),
    enabled: !!status?.connected,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['zapsign-status'] });
    queryClient.invalidateQueries({ queryKey: ['zapsign-templates'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Integrações</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Conecte serviços externos à sua organização
        </p>
      </div>

      <ZapSignCard
        connected={status?.connected ?? false}
        loading={isLoading}
        templates={templates ?? []}
        onRefresh={refresh}
      />
    </div>
  );
}

// ─── ZapSign Card ────────────────────────────────────────────────────────────

function ZapSignCard({
  connected,
  loading,
  templates,
  onRefresh,
}: {
  connected: boolean;
  loading: boolean;
  templates: ZapSignTemplate[];
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'config' | 'templates'>('config');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await zapSignService.connect(token.trim());
      toast.success('ZapSign conectado com sucesso!');
      setToken('');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Token inválido ou sem permissão');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await zapSignService.syncTemplates();
      toast.success(`${result.synced} modelos sincronizados`);
      onRefresh();
    } catch {
      toast.error('Erro ao sincronizar modelos');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o ZapSign? Os documentos existentes serão preservados.')) return;
    setDisconnecting(true);
    try {
      await zapSignService.disconnect();
      toast.success('ZapSign desconectado');
      onRefresh();
    } catch {
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
            <FileSignature className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">ZapSign</p>
            <p className="text-xs text-zinc-500">Assinatura eletrônica de documentos</p>
          </div>
        </div>
        {!loading && (
          <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', connected
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400')}>
            {connected
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</>
              : <><XCircle className="h-3.5 w-3.5" /> Desconectado</>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5">
        {(['config', 'templates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 py-3 px-2 mr-4 text-xs font-medium transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {t === 'config' ? 'Credencial' : `Modelos (${templates.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {tab === 'config' && (
          <div className="space-y-4">
            {!connected ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Cole seu token de API do ZapSign para conectar. Você encontra o token em{' '}
                  <a
                    href="https://app.zapsign.com.br/conta/integracoes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    app.zapsign.com.br → Integrações <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </p>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Token de API
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                      placeholder="Cole aqui o token ZapSign..."
                      className="w-full rounded-md border border-zinc-300 bg-white pr-10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={!token.trim() || saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plug className="h-4 w-4" />
                  {saving ? 'Conectando...' : 'Conectar ZapSign'}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Sua conta ZapSign está conectada. Os modelos são sincronizados automaticamente ao conectar.
                    Use o painel de ZapSign dentro de cada conversa para criar e enviar documentos para assinatura.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar modelos'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Unplug className="h-4 w-4" />
                    {disconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {!connected ? (
              <p className="text-sm text-zinc-500 py-4">Conecte o ZapSign para ver os modelos.</p>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <FileSignature className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
                <p className="mt-3 text-sm text-zinc-500">Nenhum modelo encontrado</p>
                <p className="mt-1 text-xs text-zinc-400">Sincronize para importar seus modelos do ZapSign</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {(t.inputs as unknown[]).length} variável{(t.inputs as unknown[]).length !== 1 ? 'is' : ''} •{' '}
                        {(t.signers as unknown[]).length} signatário{(t.signers as unknown[]).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 uppercase font-mono">{t.templateType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
