'use client';

// Peças reutilizáveis dos cards do kanban jurídico (Fase Judicial + Pré-Processual):
// - InlineCardTitle: renomeia o Case.title clicando no nome do card.
// - CardTags: etiquetas (EntityTag) no card, com ✕ pra remover e + pra adicionar,
//   igual à fase processual (reusa o activitiesService).

import { useEffect, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService, type TagOption } from '@/features/activities/services/activities.service';
import { legalCasesService } from '../services/legal-cases.service';

/** Texto claro/escuro conforme a luminância do fundo (contraste legível). */
export function tagTextColor(bg: string): string {
  const c = (bg ?? '').replace('#', '');
  if (c.length < 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#202124' : '#ffffff';
}

export function InlineCardTitle({
  caseId,
  value,
  className,
  onSaved,
}: {
  caseId: string;
  value: string;
  className?: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(value), [value]);

  const save = async () => {
    const t = text.trim();
    if (!t || t === value) {
      setEditing(false);
      setText(value);
      return;
    }
    setSaving(true);
    try {
      await legalCasesService.update(caseId, { title: t });
      toast.success('Nome do card atualizado');
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao renomear');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        disabled={saving}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            setEditing(false);
            setText(value);
          }
        }}
        onBlur={save}
        className="mt-2 w-full rounded border border-[#e11970] bg-white px-1 py-0.5 text-sm font-semibold uppercase leading-5 text-[#101820] outline-none dark:bg-zinc-800 dark:text-zinc-100"
      />
    );
  }
  return (
    <p
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title="Clique pra renomear o card"
      className={className}
    >
      {value?.toUpperCase()}
    </p>
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
