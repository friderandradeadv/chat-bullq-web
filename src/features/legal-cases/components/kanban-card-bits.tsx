'use client';

// Peças reutilizáveis dos kanbans jurídicos:
// - PhaseHeader: renomeia a fase clicando no título (só sócios).
// - CardTags: gerenciador de etiquetas (EntityTag) estilo Astrea — chip com ✕ pra
//   remover + botão "+" pra adicionar. Usado na ficha (drawer), que é aberta por
//   TODOS os kanbans, então vale em todos.

import { useEffect, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService, type TagOption } from '@/features/activities/services/activities.service';

/** Texto claro/escuro conforme a luminância do fundo (contraste legível). */
export function tagTextColor(bg: string): string {
  const c = (bg ?? '').replace('#', '');
  if (c.length < 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#202124' : '#ffffff';
}

export function PhaseHeader({
  phase,
  canRename,
  onRename,
}: {
  phase: { key: string; label: string };
  canRename: boolean;
  onRename: (key: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(phase.label);
  useEffect(() => setText(phase.label), [phase.label]);

  if (!canRename) {
    return (
      <h2 className="truncate text-sm font-medium text-[#e11970] dark:text-[#f06595]">
        {phase.label}
      </h2>
    );
  }

  const commit = () => {
    const t = text.trim();
    setEditing(false);
    if (t && t !== phase.label) onRename(phase.key, t);
    else setText(phase.label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setEditing(false); setText(phase.label); }
        }}
        className="w-full rounded border border-[#e11970] bg-white px-1 py-0.5 text-sm font-medium text-[#101820] outline-none dark:bg-zinc-800 dark:text-zinc-100"
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      title="Clique pra renomear a fase (só sócios)"
      className="cursor-text truncate text-sm font-medium text-[#e11970] hover:underline dark:text-[#f06595]"
    >
      {phase.label}
    </h2>
  );
}

export function CardTags({
  caseId,
  tags,
  onChanged,
}: {
  caseId: string;
  tags: { id: string; name: string; color: string }[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<TagOption[] | null>(null);
  const attachedIds = new Set(tags.map((t) => t.id));

  const loadAvail = async () => {
    if (avail) return;
    try {
      setAvail(await activitiesService.listAvailableTags());
    } catch {
      setAvail([]);
    }
  };

  const add = async (tagId: string) => {
    setBusy(true);
    try {
      await activitiesService.attachTag('case', caseId, tagId);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao adicionar etiqueta');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tagId: string) => {
    setBusy(true);
    try {
      // O card só traz o id da Tag; pra remover preciso do EntityTag (vínculo).
      const list = await activitiesService.listTags('case', caseId);
      const et = list.find((x) => x.tagId === tagId);
      if (et) await activitiesService.detachTag(et.id);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover etiqueta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight"
          style={{ backgroundColor: t.color, color: tagTextColor(t.color) }}
        >
          {t.name}
          <button
            type="button"
            disabled={busy}
            title="Remover etiqueta"
            onClick={() => remove(t.id)}
            className="hover:opacity-70"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="relative">
        <button
          type="button"
          title="Adicionar etiqueta"
          onClick={() => {
            setOpen((v) => !v);
            void loadAvail();
          }}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#e11970] dark:hover:bg-zinc-800"
        >
          <Plus className="h-3 w-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 max-h-60 w-52 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                Etiquetas
              </p>
              {avail === null && <p className="px-3 py-2 text-xs text-zinc-400">Carregando…</p>}
              {avail?.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta cadastrada.</p>
              )}
              {avail?.map((t) => {
                const on = attachedIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    disabled={busy}
                    onClick={() => (on ? remove(t.id) : add(t.id))}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{t.name}</span>
                    {on && <Check className="h-4 w-4 shrink-0 text-[#e11970]" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
