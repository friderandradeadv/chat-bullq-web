'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Zap,
  Loader2,
  Upload,
  FileText,
  Film,
  Mic,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  quickRepliesService,
  type QuickReply,
  type QuickReplyAttachment,
  type QuickReplyPayload,
} from '@/features/settings/services/quick-replies.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { useOrgId } from '@/hooks/use-org-query-key';

const ATT_META: Record<
  QuickReplyAttachment['type'],
  { label: string; icon: typeof FileText; cls: string }
> = {
  DOCUMENT: { label: 'Documento', icon: FileText, cls: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
  VIDEO: { label: 'Vídeo', icon: Film, cls: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800' },
  AUDIO: { label: 'Áudio', icon: Mic, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  IMAGE: { label: 'Imagem', icon: ImageIcon, cls: 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' },
};

/** Converte o JSON extraído do LíderHub ({a,t,c,cap,fn,fu}) pro nosso payload. */
function normalizeImport(raw: any[]): QuickReplyPayload[] {
  const typeMap: Record<string, QuickReplyAttachment['type']> = {
    documentMessage: 'DOCUMENT',
    videoMessage: 'VIDEO',
    audioMessage: 'AUDIO',
    imageMessage: 'IMAGE',
  };
  const seen = new Map<string, number>();
  return raw.map((x) => {
    // formato nativo
    if (x.shortcut) {
      return {
        shortcut: x.shortcut,
        title: x.title || x.shortcut,
        content: x.content ?? '',
        attachments: x.attachments ?? [],
      };
    }
    // formato LíderHub
    let shortcut = String(x.a ?? '').trim();
    const n = (seen.get(shortcut) ?? 0) + 1;
    seen.set(shortcut, n);
    if (n > 1) shortcut = `${shortcut}${n}`;
    const content = String(x.c ?? '').trim();
    const attachments: QuickReplyAttachment[] = [];
    if (x.fu) {
      const att: QuickReplyAttachment = {
        type: typeMap[x.t] ?? 'DOCUMENT',
        url: x.fu,
      };
      if (x.fn) att.fileName = x.fn;
      const cap = String(x.cap ?? '').trim();
      if (cap && cap !== content) att.caption = cap;
      attachments.push(att);
    }
    return { shortcut, title: shortcut, content, attachments };
  });
}

export default function SettingsQuickRepliesPage() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);

  // Drawer (criar/editar)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<QuickReplyAttachment[]>([]);
  const [attUrl, setAttUrl] = useState('');
  const [attType, setAttType] = useState<QuickReplyAttachment['type']>('DOCUMENT');
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const attFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const { data: replies, isLoading } = useQuery({
    queryKey: ['quick-replies', orgId],
    queryFn: () => quickRepliesService.list(),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['quick-replies'] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return replies ?? [];
    return (replies ?? []).filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q),
    );
  }, [replies, search]);

  // Paginação: volta pra 1ª página quando muda a busca ou o tamanho.
  useEffect(() => { setPage(1); }, [search, pageSize]);
  const PAGE_SIZES = [10, 25, 50, 100, 200, 500];
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const openCreate = () => {
    setEditing(null);
    setShortcut('');
    setContent('');
    setAttachments([]);
    setAttUrl('');
    setDrawerOpen(true);
  };

  const openEdit = (reply: QuickReply) => {
    setEditing(reply);
    setShortcut(reply.shortcut);
    setContent(reply.content);
    setAttachments(reply.attachments ?? []);
    setAttUrl('');
    setDrawerOpen(true);
  };

  const addAttachment = () => {
    const url = attUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Informe uma URL válida (https://...)');
      return;
    }
    const fileName = url.split('/').pop()?.split('?')[0] || undefined;
    setAttachments((prev) => [...prev, { type: attType, url, fileName }]);
    setAttUrl('');
  };

  /** Detecta o tipo do anexo pelo mime do arquivo escolhido. */
  const detectAttType = (mime: string): QuickReplyAttachment['type'] => {
    if (mime.startsWith('image/')) return 'IMAGE';
    if (mime.startsWith('video/')) return 'VIDEO';
    if (mime.startsWith('audio/')) return 'AUDIO';
    return 'DOCUMENT';
  };

  /** Upload de arquivo do computador → vira anexo (hospeda no nosso domínio). */
  const handleAttFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAtt(true);
    try {
      const { url, mimeType, filename } = await inboxService.uploadMedia(file);
      setAttachments((prev) => [
        ...prev,
        { type: detectAttType(mimeType || file.type), url, fileName: filename || file.name },
      ]);
      toast.success('Arquivo anexado');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao enviar o arquivo.');
    } finally {
      setUploadingAtt(false);
    }
    setAttUrl('');
  };

  const handleSave = async () => {
    const finalShortcut = shortcut.trim().replace(/^\//, '');
    if (!finalShortcut || (!content.trim() && attachments.length === 0)) return;
    const dup = (replies ?? []).find(
      (r) =>
        r.id !== editing?.id &&
        r.shortcut.toLowerCase() === finalShortcut.toLowerCase(),
    );
    if (dup) {
      toast.error(`Atalho "/${finalShortcut}" já existe`);
      return;
    }
    setSaving(true);
    try {
      const payload: QuickReplyPayload = {
        shortcut: finalShortcut,
        title: finalShortcut,
        content: content.trim(),
        attachments,
      };
      if (editing) {
        await quickRepliesService.update(editing.id, payload);
        toast.success('Mensagem rápida atualizada');
      } else {
        await quickRepliesService.create(payload);
        toast.success(`Mensagem rápida "/${finalShortcut}" criada`);
      }
      setDrawerOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reply: QuickReply) => {
    if (!confirm(`Remover a mensagem rápida "/${reply.shortcut}"?`)) return;
    try {
      await quickRepliesService.remove(reply.id);
      toast.success('Mensagem rápida removida');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error('O arquivo deve conter um array JSON de mensagens.');
      }
      const items = normalizeImport(raw);
      const res = await quickRepliesService.importMany(items);
      toast.success(
        `Importação concluída: ${res.created} criadas, ${res.updated} atualizadas${res.errors.length ? `, ${res.errors.length} erros` : ''}`,
      );
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {/* Header — estilo LíderHub */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Mensagens rápidas
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Crie atalhos de mensagens para usar com &quot;/&quot; no compositor da conversa.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" /> Criar Mensagem
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            title="Importa JSON (formato nativo ou export do LíderHub) — idempotente por atalho"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar JSON
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mt-6">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar mensagens..."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-zinc-300 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-950"
        />
      </div>

      {/* Itens por página */}
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Exibir</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>por página</span>
        </div>
        <span>{total === 0 ? '0 mensagens' : `${pageStart + 1}–${Math.min(pageStart + pageSize, total)} de ${total}`}</span>
      </div>

      {/* Tabela — estilo LíderHub */}
      <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <th className="px-4 py-3">Atalho</th>
              <th className="px-4 py-3">Conteúdo</th>
              <th className="px-4 py-3">Anexo</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td colSpan={4} className="px-4 py-4">
                    <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                </tr>
              ))
            ) : !filtered.length ? (
              <tr>
                <td colSpan={4}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <Zap className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
                    <p className="mt-3 text-sm text-zinc-500">
                      {search ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem rápida criada'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pageItems.map((reply) => {
                const att = reply.attachments?.[0];
                const meta = att ? ATT_META[att.type] : null;
                return (
                  <tr
                    key={reply.id}
                    className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[12px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        /{reply.shortcut}
                      </span>
                    </td>
                    <td className="max-w-[360px] px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
                      <span className="line-clamp-2 whitespace-pre-line">
                        {reply.content || (
                          <span className="italic text-zinc-300 dark:text-zinc-600">
                            Sem texto (somente anexo)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {meta ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.cls}`}
                          title={att?.fileName}
                        >
                          <meta.icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <Popover className="relative">
                        <PopoverButton className="rounded-md p-1.5 text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
                          <MoreHorizontal className="h-4 w-4" />
                        </PopoverButton>
                        <PopoverPanel
                          anchor="bottom end"
                          transition
                          className="z-50 mt-1 w-36 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          {({ close }) => (
                            <>
                              <button
                                onClick={() => {
                                  close();
                                  openEdit(reply);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                onClick={() => {
                                  close();
                                  handleDelete(reply);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </button>
                            </>
                          )}
                        </PopoverPanel>
                      </Popover>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            ‹ Anterior
          </button>
          <span>Página {safePage} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Próxima ›
          </button>
        </div>
      )}

      {/* Drawer lateral — Nova/Editar Mensagem rápida */}
      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-y-0 right-0 flex max-w-full">
          <DialogPanel className="flex h-full w-screen max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-950">
            <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
              <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {editing ? 'Editar Mensagem' : 'Nova Mensagem'}
              </DialogTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {editing
                  ? 'Atualize a mensagem rápida'
                  : 'Crie um atalho para usar com "/" na conversa'}
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Atalho
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-zinc-400">/</span>
                  <input
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value.replace(/\s/g, '_'))}
                    placeholder="ex: boas_vindas"
                    autoFocus
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Mensagem
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={'Texto da mensagem… use {{nome}} para inserir o nome do contato'}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Anexos
                </label>
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-col gap-1.5">
                    {attachments.map((att, i) => {
                      const meta = ATT_META[att.type];
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <meta.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                            {att.fileName || att.url}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="rounded p-0.5 text-zinc-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Procurar arquivo no computador (upload) */}
                <input
                  ref={attFileRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  className="hidden"
                  onChange={handleAttFile}
                />
                <button
                  type="button"
                  onClick={() => attFileRef.current?.click()}
                  disabled={uploadingAtt}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {uploadingAtt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingAtt ? 'Enviando…' : 'Procurar arquivo no computador'}
                </button>

                <p className="mb-1.5 text-[11px] text-zinc-400">ou cole uma URL pública:</p>
                <div className="flex items-center gap-2">
                  <select
                    value={attType}
                    onChange={(e) =>
                      setAttType(e.target.value as QuickReplyAttachment['type'])
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="DOCUMENT">Documento</option>
                    <option value="IMAGE">Imagem</option>
                    <option value="VIDEO">Vídeo</option>
                    <option value="AUDIO">Áudio</option>
                  </select>
                  <input
                    value={attUrl}
                    onChange={(e) => setAttUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAttachment()}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={addAttachment}
                    className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!shortcut.trim() || (!content.trim() && attachments.length === 0) || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? 'Salvar alterações' : 'Criar Mensagem'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
