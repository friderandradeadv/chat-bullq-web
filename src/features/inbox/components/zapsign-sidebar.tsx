'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSignature,
  X,
  Search,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  zapSignService,
  type ZapSignTemplate,
  type ZapSignDocument,
} from '@/features/settings/services/zapsign.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { cn } from '@/lib/utils';

interface ZapSignSidebarProps {
  conversationId: string;
  onClose: () => void;
}

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending: { label: 'Pendente', icon: Clock, cls: 'text-amber-500' },
  signed: { label: 'Assinado', icon: CheckCircle2, cls: 'text-emerald-500' },
  refused: { label: 'Recusado', icon: XCircle, cls: 'text-red-500' },
  expired: { label: 'Expirado', icon: XCircle, cls: 'text-zinc-400' },
};

export function ZapSignSidebar({ conversationId, onClose }: ZapSignSidebarProps) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'send' | 'docs'>('send');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ZapSignTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [signerName, setSignerName] = useState('');
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const res = await zapSignService.syncTemplates();
      qc.invalidateQueries({ queryKey: ['zapsign-templates', orgId] });
      toast.success(`${res.synced} modelo(s) sincronizado(s)`);
    } catch {
      toast.error('Erro ao sincronizar modelos');
    } finally {
      setSyncing(false);
    }
  };

  const { data: status } = useQuery({
    queryKey: ['zapsign-status', orgId],
    queryFn: () => zapSignService.getStatus(),
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ['zapsign-templates', orgId],
    queryFn: () => zapSignService.getTemplates(),
    enabled: !!status?.connected,
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['zapsign-docs', conversationId],
    queryFn: () => zapSignService.getConversationDocuments(conversationId),
    refetchInterval: tab === 'docs' ? 15000 : false,
  });

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectTemplate = (t: ZapSignTemplate) => {
    setSelected(t);
    const initial: Record<string, string> = {};
    (t.inputs as Array<{ variable: string }>).forEach((inp) => {
      initial[inp.variable] = '';
    });
    setVars(initial);
    setSignerName('');
  };

  const handleExtract = async () => {
    if (!selected) return;
    setExtracting(true);
    try {
      const res = await zapSignService.extractWithAI(conversationId, selected.token);
      setVars((prev) => ({ ...prev, ...res.variables }));
      if (res.signerName && !signerName) setSignerName(res.signerName);
      const total = Object.keys(res.variables).length;
      const filled = Object.values(res.variables).filter((v) => v && v.trim()).length;
      toast.success(`IA preencheu ${filled} de ${total} campo(s) a partir da conversa`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao extrair com IA');
    } finally {
      setExtracting(false);
    }
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const doc = await zapSignService.createDocument(conversationId, {
        templateToken: selected.token,
        variables: vars,
        signerName: signerName || undefined,
      });
      toast.success('Documento criado! Link de assinatura gerado.');
      qc.invalidateQueries({ queryKey: ['zapsign-docs', conversationId] });
      setSelected(null);
      setTab('docs');
      if (doc.signingUrl) {
        await navigator.clipboard.writeText(doc.signingUrl).catch(() => undefined);
        toast.info('Link copiado para a área de transferência');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar documento');
    } finally {
      setSending(false);
    }
  };

  if (!status?.connected) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <SidebarHeader onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <FileSignature className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
          <p className="text-sm text-zinc-500">ZapSign não configurado</p>
          <a
            href="/settings/integrations"
            className="text-xs text-primary hover:underline"
          >
            Configurar em Integrações →
          </a>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <SidebarHeader onClose={onClose} />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-3">
        {(['send', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 py-2.5 px-2 mr-3 text-xs font-medium transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {t === 'send' ? 'Enviar documento' : `Enviados (${docs.length})`}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col overflow-hidden p-3 gap-2">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar modelo..."
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <button
                  onClick={handleSyncTemplates}
                  disabled={syncing}
                  title="Sincronizar modelos da ZapSign"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {tplLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-md border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                  ))
                ) : filtered.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-400">Nenhum modelo encontrado</p>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="w-full rounded-md border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-zinc-800"
                    >
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{t.name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {(t.inputs as unknown[]).length} variáveis
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  ← Voltar
                </button>
                <span className="flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {selected.name}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                >
                  {extracting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {extracting ? 'Extraindo da conversa…' : 'Extrair com IA'}
                </button>
                <p className="text-center text-[10px] text-zinc-400">
                  A IA lê a conversa e preenche os campos abaixo. Confira antes de gerar.
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Nome do signatário</label>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nome do contato (opcional)"
                    className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                {selected.inputs.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-zinc-500">
                      Campos do documento ({selected.inputs.length})
                    </p>
                    {selected.inputs.map((inp) => {
                      const variable = inp.variable;
                      const display = (inp.label || variable).replace(/[{}]/g, '');
                      return (
                        <div key={variable}>
                          <label className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                            {display}
                            {inp.required && <span className="text-red-400">*</span>}
                          </label>
                          <input
                            value={vars[variable] ?? ''}
                            onChange={(e) =>
                              setVars((prev) => ({ ...prev, [variable]: e.target.value }))
                            }
                            placeholder={inp.help_text || display}
                            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                          {inp.help_text && (
                            <p className="mt-0.5 text-[10px] text-zinc-400">{inp.help_text}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    Este modelo não tem campos editáveis sincronizados. Clique em
                    sincronizar (↻) no topo do ZapSign para atualizar.
                  </p>
                )}
              </div>
              <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Criando documento...' : 'Gerar e copiar link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {docsLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
              ))
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <FileSignature className="h-8 w-8 text-zinc-200 dark:text-zinc-700" />
                <p className="mt-2 text-xs text-zinc-400">Nenhum documento enviado</p>
              </div>
            ) : (
              docs.map((doc) => <DocCard key={doc.id} doc={doc} />)
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">ZapSign</span>
      </div>
      <button
        onClick={onClose}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DocCard({ doc }: { doc: ZapSignDocument }) {
  const s = STATUS_MAP[doc.status] ?? STATUS_MAP.pending;
  const StatusIcon = s.icon;

  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!doc.signingUrl) return;
    await navigator.clipboard.writeText(doc.signingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex-1 min-w-0 truncate">
          {doc.name}
        </p>
        <span className={cn('flex items-center gap-1 text-[10px] font-medium shrink-0', s.cls)}>
          <StatusIcon className="h-3 w-3" />
          {s.label}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-zinc-400">
        {new Date(doc.createdAt).toLocaleString('pt-BR')}
      </p>
      {doc.signingUrl && (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={copyLink}
            className="flex-1 rounded border border-zinc-200 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {copied ? '✓ Copiado' : 'Copiar link'}
          </button>
          <a
            href={doc.signingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded border border-zinc-200 px-2 text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
