'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  File as FileIcon,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Search,
  Upload,
} from 'lucide-react';
import {
  knowledgeService,
  type DocStatus,
  type KnowledgeDocSummary,
} from '@/features/knowledge/services/knowledge.service';
import { DropZone } from '@/components/drop-zone';
import { extractTextFromFile } from '@/features/knowledge/lib/extract-text';
import { aiAgentsService } from '@/features/ai-agents/services/ai-agents.service';

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  return `há ${Math.floor(months / 12)} ano(s)`;
}

const PAGE_SIZES = [10, 25, 50, 100, 200, 500];

export default function BaseConhecimentoPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [attachDoc, setAttachDoc] = useState<KnowledgeDocSummary | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: () => knowledgeService.list(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs ?? [];
    return (docs ?? []).filter((d) => d.title.toLowerCase().includes(q));
  }, [docs, search]);

  // volta pra primeira página quando muda a busca ou o tamanho
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['knowledge-documents'] });

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-4 lg:p-6">
        <div className="flex shrink-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Base de Conhecimento</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Centralize documentos e FAQs e vincule aos agentes — a IA responde com base neles.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Plus className="h-4 w-4" /> Adicionar Documento
          </button>
        </div>

        <div className="relative mt-5 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome…"
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800"
          />
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
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
          <span>{total === 0 ? '0 documentos' : `${start + 1}–${Math.min(start + pageSize, total)} de ${total}`}</span>
        </div>

        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Agentes</th>
                  <th className="px-4 py-2.5 text-left font-medium">Atualização</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr><td colSpan={5} className="py-12 text-center text-zinc-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : pageItems.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                    {search ? 'Nenhum documento encontrado.' : 'Nenhum documento ainda. Clique em “Adicionar Documento”.'}
                  </td></tr>
                ) : (
                  pageItems.map((doc) => (
                    <DocRow key={doc.id} doc={doc} onChange={invalidate} onAttach={() => setAttachDoc(doc)} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex shrink-0 items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
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
      </div>

      {showAdd && <AddDocModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); invalidate(); }} />}
      {attachDoc && <AttachAgentsModal doc={attachDoc} onClose={() => setAttachDoc(null)} onSaved={() => { setAttachDoc(null); invalidate(); }} />}
    </div>
  );
}

function DocRow({ doc, onChange, onAttach }: { doc: KnowledgeDocSummary; onChange: () => void; onAttach: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); onChange(); toast.success(ok); }
    catch (e: any) { toast.error(e?.message ?? 'Erro'); }
    finally { setBusy(false); }
  };
  return (
    <tr className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {doc.sourceType === 'file' ? <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" /> : <FileText className="h-4 w-4 shrink-0 text-zinc-400" />}
          <span className="truncate text-zinc-800 dark:text-zinc-200" title={doc.title}>{doc.title}</span>
        </div>
        <div className="mt-1"><StatusBadge status={doc.status} chunks={doc.chunkCount} error={doc.error} /></div>
      </td>
      <td className="px-4 py-3 text-zinc-500">{doc.sourceType === 'file' ? 'Arquivo' : 'Texto'}</td>
      <td className="px-4 py-3">
        {doc.agentIds.length === 0
          ? <span className="text-zinc-400">Sem agentes vinculados</span>
          : <span className="text-zinc-600 dark:text-zinc-300">{doc.agentIds.length} agente{doc.agentIds.length === 1 ? '' : 's'}</span>}
      </td>
      <td className="px-4 py-3 text-zinc-400">{relativeTime(doc.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onAttach} title="Vincular agentes" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
            <Bot className="h-4 w-4" />
          </button>
          <button disabled={busy} onClick={() => act(() => knowledgeService.reindex(doc.id), 'Re-indexado')} title="Re-indexar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          </button>
          <button disabled={busy} onClick={() => { if (confirm('Remover este documento?')) act(() => knowledgeService.remove(doc.id), 'Removido'); }} title="Remover" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status, chunks, error }: { status: DocStatus; chunks: number; error?: string | null }) {
  const map = {
    indexed: { icon: CheckCircle2, label: `Indexado · ${chunks} trecho${chunks === 1 ? '' : 's'}`, cls: 'text-emerald-600' },
    indexing: { icon: Loader2, label: 'Indexando…', cls: 'text-amber-600' },
    pending: { icon: Clock, label: 'Pendente', cls: 'text-amber-600' },
    failed: { icon: AlertCircle, label: error ? `Falhou: ${error.slice(0, 40)}` : 'Falhou', cls: 'text-red-600' },
  }[status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${map.cls}`}>
      <Icon className={`h-3 w-3 ${status === 'indexing' ? 'animate-spin' : ''}`} /> {map.label}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddDocModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      setContent(text);
      setFileName(file.name);
      setMimeType(file.type || '');
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
      if (!text.trim()) toast.warning('Não consegui extrair texto desse arquivo (talvez seja PDF escaneado/imagem).');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao ler o arquivo');
    } finally {
      setExtracting(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await knowledgeService.create({
        title: title.trim(),
        content,
        sourceType: mode === 'file' ? 'file' : 'text',
        fileName: mode === 'file' ? fileName : undefined,
        mimeType: mode === 'file' ? mimeType : undefined,
      });
      toast.success('Documento adicionado e indexado');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Adicionar Documento" onClose={onClose}>
      <div className="mb-3 inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
        {(['text', 'file'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-sm ${mode === m ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400'}`}>
            {m === 'text' ? 'Texto' : 'Arquivo (PDF/TXT)'}
          </button>
        ))}
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="mb-2 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700" />

      {mode === 'file' && (
        <div className="mb-2">
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,text/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <DropZone accept=".pdf,.txt,.md,.csv,text/*,application/pdf" multiple={false} onFiles={(fs) => onFile(fs[0])} className="inline-block">
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {fileName || 'Escolher ou arrastar arquivo'}
            </button>
          </DropZone>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={mode === 'file' ? 6 : 9}
        placeholder={mode === 'file' ? 'O texto extraído aparece aqui (pode editar).' : 'Cole o texto / FAQ / política…'}
        className="w-full resize-y rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700"
      />
      {content && <p className="mt-1 text-[11px] text-zinc-400">{content.length.toLocaleString('pt-BR')} caracteres</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        <button onClick={submit} disabled={saving || extracting || !title.trim() || !content.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar e indexar
        </button>
      </div>
    </Modal>
  );
}

function AttachAgentsModal({ doc, onClose, onSaved }: { doc: KnowledgeDocSummary; onClose: () => void; onSaved: () => void }) {
  const { data: agents } = useQuery({ queryKey: ['ai-agents-min'], queryFn: () => aiAgentsService.list() });
  const [sel, setSel] = useState<Set<string>>(new Set(doc.agentIds));
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => (agents ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [agents]);

  const save = async () => {
    setSaving(true);
    try { await knowledgeService.setAgents(doc.id, Array.from(sel)); toast.success('Agentes vinculados'); onSaved(); }
    catch (e: any) { toast.error(e?.message ?? 'Erro'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Vincular agentes — ${doc.title}`} onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="py-4 text-sm text-zinc-400">Nenhum agente cadastrado.</p>
      ) : (
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {sorted.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <input type="checkbox" checked={sel.has(a.id)} onChange={(e) => setSel((p) => { const n = new Set(p); e.target.checked ? n.add(a.id) : n.delete(a.id); return n; })} className="h-4 w-4 rounded border-zinc-300" />
              <span className="truncate text-zinc-700 dark:text-zinc-300">{a.name}</span>
              {!a.isActive && <span className="text-[10px] text-zinc-400">(inativo)</span>}
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </div>
    </Modal>
  );
}
