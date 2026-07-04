'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export type ComboAction = { value: string; label: string; hint?: string };

/**
 * Select BUSCÁVEL (typeahead) — o usuário digita e a lista filtra por correspondência,
 * em vez de abrir uma lista enorme. Padrão do escritório: usar em TODO seletor de vertical/
 * centro de custos/lista longa (igual a busca de processos).
 *
 * - `options`: itens normais (ex.: verticais). Filtram pela digitação.
 * - `actions`: itens de AÇÃO fixos no rodapé (ex.: "Ratear entre verticais…", "Escritório (comum)",
 *   "— sem vertical —"). Não filtram; aparecem sempre.
 * - `allowFree`: aceita texto livre (o que foi digitado vira o valor) — p/ campos abertos.
 */
export function ComboBox({
  value, onChange, options, actions = [], placeholder = 'Buscar…', allowFree = false,
  labelOf, className = '', disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  actions?: ComboAction[];
  placeholder?: string;
  allowFree?: boolean;
  labelOf?: (v: string) => string; // rótulo de exibição p/ um valor (ex.: '' → '— sem vertical —')
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const display = labelOf ? labelOf(value) : (actions.find((a) => a.value === value)?.label ?? value);
  const ql = q.trim().toLowerCase();
  const filtered = useMemo(() => (ql ? options.filter((o) => o.toLowerCase().includes(ql)) : options), [options, ql]);

  const pick = (v: string) => { onChange(v); setQ(''); setOpen(false); };

  // Fecha ao clicar FORA (listener no documento — robusto dentro de modais, onde um "backdrop"
  // por z-index não pega o clique). Também fecha no scroll de fundo e no Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-left text-sm dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50">
        <span className={`min-w-0 flex-1 truncate ${display ? '' : 'text-zinc-400'}`}>{display || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>
      {open && (
        <>
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg scrollbar-thin dark:border-zinc-700 dark:bg-zinc-900">
            <div className="sticky top-0 flex items-center gap-1.5 bg-white px-2 py-1 dark:bg-zinc-900">
              <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { if (filtered.length) pick(filtered[0]); else if (allowFree && q.trim()) pick(q.trim()); } if (e.key === 'Escape') setOpen(false); }}
                placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
            </div>
            {filtered.map((o) => (
              <button key={o} type="button" onClick={() => pick(o)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <span className="min-w-0 flex-1 truncate">{o}</span>
                {value === o && <Check className="h-3.5 w-3.5 shrink-0 text-[#7048E8]" />}
              </button>
            ))}
            {allowFree && ql && !filtered.some((o) => o.toLowerCase() === ql) && (
              <button type="button" onClick={() => pick(q.trim())} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-[#228BE6] hover:bg-zinc-100 dark:hover:bg-zinc-800">Usar “{q.trim()}”</button>
            )}
            {filtered.length === 0 && !allowFree && <p className="px-2.5 py-2 text-xs text-zinc-400">Nada encontrado.</p>}
            {actions.length > 0 && (
              <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                {actions.map((a) => (
                  <button key={a.value} type="button" onClick={() => pick(a.value)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    {a.hint && <span className="shrink-0 text-[10px] text-zinc-400">{a.hint}</span>}
                    {value === a.value && <Check className="h-3.5 w-3.5 shrink-0 text-[#7048E8]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
