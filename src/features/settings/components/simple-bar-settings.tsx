'use client';

import { useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Plus, RotateCcw, LayoutList } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useNavMode, SIMPLE_BAR_CATALOG, DEFAULT_SIMPLE_BAR, barItemById } from '@/stores/nav-mode-store';

// Edição da barra de atalhos do MODO SIMPLES (o que exibir + ordem). Por usuário
// (localStorage). O item "Menu" abre o menu completo — costuma ficar o 1º.
export function SimpleBarSettings() {
  const { barItems, hydrated, hydrate, setBarItems } = useNavMode();
  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated, hydrate]);

  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const visible = (id: string) => { const it = barItemById(id); return !!it && (!it.adminOnly || isAdmin); };

  const enabled = barItems.filter(visible);
  const available = SIMPLE_BAR_CATALOG.filter((it) => (!it.adminOnly || isAdmin) && !barItems.includes(it.id));

  const move = (id: string, dir: -1 | 1) => {
    const idx = barItems.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= barItems.length) return;
    const next = [...barItems];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBarItems(next);
  };
  const remove = (id: string) => setBarItems(barItems.filter((x) => x !== id));
  const add = (id: string) => setBarItems([...barItems, id]);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><LayoutList className="h-4 w-4 text-primary" /> Barra de atalhos (modo simples)</h2>
          <p className="mt-1 text-xs text-zinc-500">Escolha o que aparece e em que ordem na barra de baixo quando você usa o modo <strong>Simples</strong>. O item <strong>Menu</strong> abre o menu completo.</p>
        </div>
        <button onClick={() => setBarItems(DEFAULT_SIMPLE_BAR)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><RotateCcw className="h-3.5 w-3.5" /> Padrão</button>
      </div>

      {/* Na barra — ordenável */}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Na barra (da esquerda p/ a direita)</p>
      <div className="mt-2 space-y-1.5">
        {enabled.length === 0 && <p className="text-xs text-zinc-400">Nenhum atalho — adicione abaixo.</p>}
        {enabled.map((id, i) => {
          const it = barItemById(id)!;
          const Icon = it.icon;
          return (
            <div key={id} className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
              <span className="w-5 text-center text-xs font-semibold text-zinc-400">{i + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">{it.label}</span>
              <button onClick={() => move(id, -1)} disabled={i === 0} title="Subir (mais à esquerda)" className="rounded p-1 text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(id, 1)} disabled={i === enabled.length - 1} title="Descer (mais à direita)" className="rounded p-1 text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => remove(id)} title="Tirar da barra" className="rounded p-1 text-zinc-400 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-900/30"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>

      {/* Disponíveis */}
      {available.length > 0 && (<>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Disponíveis</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.id} onClick={() => add(it.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300">
                <Icon className="h-3.5 w-3.5" /> {it.label} <Plus className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}
