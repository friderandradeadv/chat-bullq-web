'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanBoard } from '@/features/legal-cases/services/legal-cases.service';
import { useAuthStore } from '@/stores/auth-store';

const SWATCHES = ['#6741d9', '#1098ad', '#2f9e44', '#e8590c', '#c2255c', '#495057', '#9c36b5', '#1971c2'];

export default function QuadrosPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const { data: boards, isLoading } = useQuery({
    queryKey: ['legal-cases', 'boards'],
    queryFn: () => legalCasesService.getBoards(),
  });

  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-cases', 'boards'] });

  const create = async () => {
    const t = name.trim();
    if (!t) return;
    setBusy(true);
    try {
      const b = await legalCasesService.createBoard(t, color);
      toast.success('Quadro criado');
      setName('');
      await refresh();
      router.push(`/juridico/board/${b.key}`);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar quadro');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (key: string) => {
    const t = editName.trim();
    setEditing(null);
    if (!t) return;
    try {
      await legalCasesService.updateBoard(key, { name: t });
      await refresh();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao renomear');
    }
  };

  const recolor = async (key: string, c: string) => {
    try { await legalCasesService.updateBoard(key, { color: c }); await refresh(); }
    catch { toast.error('Erro ao mudar a cor'); }
  };

  const remove = async (b: KanbanBoard) => {
    if (!confirm(`Excluir o quadro "${b.name}"? Só é possível se não houver processos nele.`)) return;
    try {
      await legalCasesService.deleteBoard(b.key);
      toast.success('Quadro excluído');
      await refresh();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao excluir');
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    if (!boards) return;
    const arr = [...boards];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try { await legalCasesService.reorderBoards(arr.map((b) => b.key)); await refresh(); }
    catch { toast.error('Erro ao reordenar'); }
  };

  if (isLoading) {
    return <div className="flex h-40 items-center justify-center text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6 lg:pt-12">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <LayoutGrid className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quadros personalizados</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Crie uma vertical/quadro nova (ex.: Tributário, Trabalhista consultivo) sem depender de deploy.
            Depois adicione as fases direto no quadro.
          </p>
        </div>
      </div>

      {canManage && (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome do quadro</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
              placeholder="Ex: Tributário consultivo"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cor</span>
            <div className="flex gap-1.5">
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <button onClick={create} disabled={busy || !name.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Criar quadro
          </button>
        </div>
      )}

      <div className="space-y-2">
        {(boards ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Nenhum quadro personalizado ainda.{canManage ? ' Crie o primeiro acima.' : ''}
          </p>
        )}
        {(boards ?? []).map((b, i) => (
          <div key={b.key} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: b.color || '#6741d9' }} />
            {editing === b.key ? (
              <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                onBlur={() => rename(b.key)}
                onKeyDown={(e) => { if (e.key === 'Enter') rename(b.key); if (e.key === 'Escape') setEditing(null); }}
                className="flex-1 rounded border border-primary/60 bg-white px-2 py-1 text-sm text-zinc-900 outline-none dark:bg-zinc-900 dark:text-zinc-100" />
            ) : (
              <Link href={`/juridico/board/${b.key}`} className="flex flex-1 items-center gap-2 text-sm font-medium text-zinc-800 hover:text-primary dark:text-zinc-100">
                {b.name} <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </Link>
            )}
            {canManage && (
              <div className="flex items-center gap-1 text-zinc-400">
                {SWATCHES.slice(0, 4).map((c) => (
                  <button key={c} onClick={() => recolor(b.key, c)} aria-label={`cor ${c}`} className="h-4 w-4 rounded-full ring-1 ring-black/5" style={{ background: c }} />
                ))}
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800" aria-label="subir"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === (boards?.length ?? 0) - 1} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800" aria-label="descer"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => { setEditing(b.key); setEditName(b.name); }} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="renomear"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(b)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="excluir"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
