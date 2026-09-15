'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Check } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService } from '@/features/activities/services/activities.service';
import { ASTREA_BLUE } from '@/app/(dashboard)/processos/page';

// Paleta das etiquetas jurídicas — a mesma na agenda, na ficha do processo e no
// seletor de cor. Morava na página da agenda; saiu para cá junto do seletor.
export const TAG_PALETTE = ['#E03131', '#F76707', '#F59F00', '#2F9E44', '#228BE6', '#7048E8', '#868E96', '#CE0000', '#23CBFF', '#02883C'];

export function TagSelector({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const qc = useQueryClient();
  const availQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#E03131');
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tags = availQ.data ?? [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const recolor = async (id: string, color: string) => {
    setBusy(true);
    try {
      await activitiesService.updateTag(id, { color });
      setPaletteFor(null);
      await qc.invalidateQueries({ queryKey: ['tags-available'] });
      await qc.invalidateQueries({ queryKey: ['activity-tags-index'] });
      await qc.invalidateQueries({ queryKey: ['activity-tags'] });
      toast.success('Cor da etiqueta atualizada');
    } catch (e: any) { toast.error(e?.message || 'Erro ao atualizar cor'); } finally { setBusy(false); }
  };
  const createNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try { const t = await activitiesService.createTag(name, newColor); setNewName(''); availQ.refetch(); onChange([...selected, t.id]); }
    catch (e: any) { toast.error(e?.message || 'Erro'); }
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} title="Etiquetas" className="relative rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800">
        <Tag className="h-5 w-5" />
        {selected.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#228BE6] px-1 text-[9px] font-bold text-white">{selected.length}</span>}
      </button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setPaletteFor(null); }} />
        <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Etiquetas</p>
          <div className="max-h-40 overflow-y-auto">
            {tags.map((t) => { const on = selected.includes(t.id); return (
              <div key={t.id}>
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setPaletteFor(paletteFor === t.id ? null : t.id); }} title="Alterar cor" className="h-3 w-3 shrink-0 rounded-full ring-offset-1 transition hover:ring-2 hover:ring-zinc-300 dark:ring-offset-zinc-900" style={{ backgroundColor: t.color }} />
                  <button type="button" onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {on && <Check className="h-4 w-4 shrink-0 text-[#228BE6]" />}
                  </button>
                </div>
                {paletteFor === t.id && (
                  <div className="flex flex-wrap gap-1.5 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                    {TAG_PALETTE.map((c) => (
                      <button key={c} type="button" disabled={busy} onClick={() => recolor(t.id, c)} className={`h-5 w-5 rounded-full transition disabled:opacity-40 ${t.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-800' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
            ); })}
            {tags.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta jurídica.</p>}
          </div>
          <div className="mt-1 border-t border-[#DEE2E6] px-3 py-2 dark:border-zinc-700">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Nova etiqueta</p>
            <div className="mb-2 flex flex-wrap gap-1.5">{TAG_PALETTE.map((c) => (<button key={c} type="button" onClick={() => setNewColor(c)} className={`h-4 w-4 rounded-full ${newColor === c ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-900' : ''}`} style={{ backgroundColor: c }} />))}</div>
            <div className="flex items-center gap-1.5"><input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createNew(); } }} placeholder="Nome da etiqueta" className="min-w-0 flex-1 rounded border border-[#DEE2E6] px-2 py-1 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /><button type="button" disabled={!newName.trim()} onClick={createNew} className="shrink-0 rounded px-2 py-1 text-xs font-bold uppercase text-white disabled:opacity-40" style={{ backgroundColor: ASTREA_BLUE }}>Criar</button></div>
          </div>
        </div></>)}
    </div>
  );
}