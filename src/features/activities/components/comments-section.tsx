'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Pencil, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService } from '../services/activities.service';
import { membersService } from '@/features/settings/services/members.service';
import { avatarColor, avatarInitials } from '@/lib/avatar';

function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} className="shrink-0 rounded-full object-cover ring-1 ring-black/5" style={{ width: size, height: size }} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ring-1 ring-black/5" style={{ width: size, height: size, backgroundColor: avatarColor(name) }}>
      {avatarInitials(name)}
    </span>
  );
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Comentários da atividade (tarefa/prazo/evento): multi-linha (parágrafos),
 * @menção com autocomplete + notificação, editar (autor), excluir, e foto do autor.
 */
export function CommentsSection({ entityType, entityId, activityId, meId }: {
  entityType: string; entityId: string; activityId: string; meId?: string | null;
}) {
  const commentsQ = useQuery({ queryKey: ['activity-comments', activityId], queryFn: () => activitiesService.listComments(entityType, entityId) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const activeMembers = useMemo(() => members.filter((m) => m.user.isActive && m.user.name), [members]);

  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionedRef = useRef<Map<string, string>>(new Map()); // nome → userId
  const [mq, setMq] = useState<{ q: string; start: number; end: number } | null>(null);

  const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; } };

  const onType = (el: HTMLTextAreaElement) => {
    const val = el.value; const caret = el.selectionStart ?? val.length;
    setBody(val); grow(el);
    const upto = val.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}\p{M}]*)$/u.exec(upto);
    if (m) setMq({ q: m[1], start: caret - m[1].length - 1, end: caret });
    else setMq(null);
  };

  const suggestions = useMemo(() => {
    if (!mq) return [];
    const q = mq.q.toLowerCase();
    return activeMembers.filter((m) => m.user.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mq, activeMembers]);

  const pick = (name: string, userId: string) => {
    if (!mq) return;
    const next = `${body.slice(0, mq.start)}@${name} ${body.slice(mq.end)}`;
    mentionedRef.current.set(name, userId);
    setBody(next); setMq(null);
    requestAnimationFrame(() => { const el = taRef.current; if (el) { el.focus(); const pos = mq.start + name.length + 2; el.setSelectionRange(pos, pos); grow(el); } });
  };

  const resolveMentions = (text: string): string[] => {
    const ids = new Set<string>();
    for (const [name, id] of mentionedRef.current) if (text.includes(`@${name}`)) ids.add(id);
    for (const m of activeMembers) if (text.includes(`@${m.user.name}`)) ids.add(m.user.id);
    return [...ids];
  };

  const submit = async () => {
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    try {
      await activitiesService.addComment(entityType, entityId, t, resolveMentions(t));
      setBody(''); mentionedRef.current.clear(); setMq(null);
      grow(taRef.current);
      commentsQ.refetch();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao comentar'); } finally { setBusy(false); }
  };

  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const saveEdit = async (id: string) => {
    if (!editBody.trim()) return;
    try { await activitiesService.updateComment(id, editBody.trim()); setEditId(null); commentsQ.refetch(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao editar'); }
  };
  const del = async (id: string) => { try { await activitiesService.deleteComment(id); commentsQ.refetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };

  // Destaca @menções conhecidas (nomes de membros) dentro do corpo do comentário.
  const nameRe = useMemo(() => {
    const names = activeMembers.map((m) => m.user.name).sort((a, b) => b.length - a.length);
    return names.length ? new RegExp(`@(?:${names.map(esc).join('|')})`, 'g') : null;
  }, [activeMembers]);
  const renderBody = (text: string) => {
    if (!nameRe) return text;
    const out: React.ReactNode[] = []; let last = 0; let mm: RegExpExecArray | null; nameRe.lastIndex = 0;
    while ((mm = nameRe.exec(text))) {
      if (mm.index > last) out.push(text.slice(last, mm.index));
      out.push(<span key={mm.index} className="rounded bg-[#228BE6]/10 px-1 font-medium text-[#228BE6] dark:text-[#4a90e2]">{mm[0]}</span>);
      last = mm.index + mm[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  return (
    <div>
      <div className="space-y-3">
        {(commentsQ.data ?? []).length === 0 && !commentsQ.isLoading && <p className="text-sm text-zinc-400">Nenhum comentário ainda.</p>}
        {(commentsQ.data ?? []).map((c) => {
          const editado = c.updatedAt && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 2000;
          const meu = !!meId && c.author?.id === meId;
          return (
            <div key={c.id} className="group flex gap-2">
              <Avatar name={c.author?.name ?? '?'} url={c.author?.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{c.author?.name ?? 'Alguém'}</span>
                  <span className="text-[11px] text-zinc-400">{fmt(c.createdAt)}{editado ? ' · editado' : ''}</span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {meu && editId !== c.id && <button onClick={() => { setEditId(c.id); setEditBody(c.body); }} title="Editar" className="text-zinc-300 hover:text-[#228BE6]"><Pencil className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => del(c.id)} title="Excluir" className="text-zinc-300 hover:text-[#CE0000]"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {editId === c.id ? (
                  <div className="mt-1">
                    <textarea autoFocus value={editBody} onChange={(e) => { setEditBody(e.target.value); grow(e.target); }} rows={2} className="w-full resize-none rounded-lg border border-[#DEE2E6] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    <div className="mt-1 flex gap-2">
                      <button onClick={() => saveEdit(c.id)} className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"><Check className="h-3 w-3" /> Salvar</button>
                      <button onClick={() => setEditId(null)} className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">{renderBody(c.body)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer: multi-linha + @menção + enviar (Cmd/Ctrl+Enter). */}
      <div className="relative mt-3">
        {mq && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.map((m) => (
              <button key={m.user.id} onClick={() => pick(m.user.name, m.user.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <Avatar name={m.user.name} url={m.user.avatarUrl} size={22} />
                <span className="truncate text-zinc-700 dark:text-zinc-200">{m.user.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-[#DEE2E6] bg-white px-3 py-2 focus-within:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900">
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => onType(e.target)}
            onKeyDown={(e) => {
              if (mq && suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pick(suggestions[0].user.name, suggestions[0].user.id); return; }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
              if (e.key === 'Escape' && mq) setMq(null);
            }}
            rows={1}
            placeholder="Escreva um comentário…  (@ menciona · Enter quebra linha · ⌘/Ctrl+Enter envia)"
            className="max-h-[200px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
          <button onClick={submit} disabled={busy || !body.trim()} title="Enviar (⌘/Ctrl+Enter)" className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#228BE6] text-white hover:opacity-90 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
