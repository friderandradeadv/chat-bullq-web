'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface OpponentSelection {
  name: string;
  document?: string | null;
  contactId?: string | null;
}

/**
 * Campo de PARTE ADVERSA com busca incremental nos réus já cadastrados. Conforme
 * o usuário digita, abre a lista de partes adversas existentes (nome, documento,
 * nº de processos); se o réu não estiver no banco, permite criar um novo com o
 * texto digitado. Reaproveita o endpoint agregado GET /legal-cases/opponents.
 */
export function OpponentCombobox({
  value,
  onSelect,
  placeholder = 'Banco / réu (ex.: BANCO BMG S/A)',
  inputClassName,
}: {
  value: string;
  onSelect: (sel: OpponentSelection) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: opponents = [] } = useQuery({
    queryKey: ['legal-opponents'],
    queryFn: () => legalCasesService.opponents(),
    staleTime: 60_000,
  });

  const q = norm(value);
  const matches = useMemo(() => {
    if (!q) return opponents.slice(0, 25);
    return opponents.filter((o) => norm(o.name).includes(q)).slice(0, 25);
  }, [opponents, q]);
  const exact = opponents.some((o) => norm(o.name) === q);

  const INPUT =
    inputClassName ??
    'h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onSelect({ name: e.target.value });
            setOpen(true);
          }}
          placeholder={placeholder}
          className={INPUT}
        />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#cfe0ed] bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {matches.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => {
                  onSelect({ name: o.name, document: o.document, contactId: o.contactId });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span className="flex-1 truncate text-[#101820] dark:text-zinc-200">{o.name}</span>
                {o.document && <span className="shrink-0 text-[10px] text-zinc-400">{o.document}</span>}
                <span className="shrink-0 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800" title="processos">
                  {o.casesCount}
                </span>
              </button>
            ))}
            {value.trim() && !exact && (
              <button
                type="button"
                onClick={() => {
                  onSelect({ name: value.trim() });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-[#005efc] hover:bg-[#005efc]/5"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" /> Criar novo: “{value.trim()}”
              </button>
            )}
            {matches.length === 0 && !value.trim() && (
              <p className="px-2 py-2 text-xs text-zinc-400">Digite para buscar um réu ou criar um novo</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
