'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { inputCls } from '@/app/(dashboard)/processos/page';

// Busca de processo (combobox): digita número CNJ ou nome e escolhe — substitui o <select> gigante.
export function CaseSearch({ value, onChange, cases }: { value: string; onChange: (id: string) => void; cases: { id: string; title: string; cnjNumber: string | null }[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = cases.find((c) => c.id === value);
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const results = (q
    ? cases.filter((c) => c.title.toLowerCase().includes(q) || (digits.length >= 2 && (c.cnjNumber ?? '').replace(/\D/g, '').includes(digits)))
    : cases
  ).slice(0, 8);
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{selected.title}{selected.cnjNumber && <span className="ml-2 font-mono text-xs text-zinc-400">{selected.cnjNumber}</span>}</span>
        <button type="button" onClick={() => { onChange(''); setQuery(''); }} title="Trocar processo" className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Encontre pelo número ou nome…" className={`${inputCls} pl-9`} />
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 right-0 top-11 z-20 max-h-60 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }} className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className="block truncate text-sm text-zinc-800 dark:text-zinc-200">{c.title}</span>
              {c.cnjNumber && <span className="block font-mono text-xs text-zinc-400">{c.cnjNumber}</span>}
            </button>
          ))}
          {results.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">Nenhum processo encontrado.</p>}
        </div></>)}
    </div>
  );
}
/** Processo do formulário. Aberto de DENTRO de um processo (`fixedCase`), o
 *  campo mostra qual é e não deixa trocar — o item é daquele processo. */
export function CaseField({
  value,
  onChange,
  cases,
  fixedCase,
}: {
  value: string;
  onChange: (id: string) => void;
  cases: { id: string; title: string; cnjNumber: string | null }[];
  fixedCase?: { id: string; title: string; cnjNumber: string | null };
}) {
  if (fixedCase) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40" title="É deste processo">
        <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
          {fixedCase.title}
          {fixedCase.cnjNumber && <span className="ml-2 font-mono text-xs text-zinc-400">{fixedCase.cnjNumber}</span>}
        </span>
      </div>
    );
  }
  return <CaseSearch value={value} onChange={onChange} cases={cases} />;
}
