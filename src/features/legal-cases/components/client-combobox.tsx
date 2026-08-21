'use client';

import { useMemo, useState } from 'react';
import { titleCaseName } from '@/lib/names';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { clientsService } from '@/features/legal-cases/services/clients.service';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface ClientSelection {
  name: string;
  document?: string | null;
  contactId?: string | null;
}

/**
 * Campo de CLIENTE (autor) com busca incremental nos clientes já cadastrados.
 * Conforme o usuário digita, abre a lista de clientes existentes (nome, CPF/CNPJ,
 * nº de processos); ao clicar, VINCULA por contactId/documento — o processo passa
 * a apontar pro cliente certo (imune a homônimo). Se não estiver no banco,
 * permite criar um novo com o texto digitado. Reaproveita GET /legal-cases/clients.
 */
export function ClientCombobox({
  value,
  onSelect,
  placeholder = 'Nome do cliente',
  inputClassName,
}: {
  value: string;
  onSelect: (sel: ClientSelection) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: clients = [] } = useQuery({
    queryKey: ['legal-clients'],
    queryFn: () => clientsService.list(),
    staleTime: 60_000,
  });

  const q = norm(value);
  const matches = useMemo(() => {
    if (!q) return clients.slice(0, 25);
    return clients.filter((c) => norm(c.name).includes(q)).slice(0, 25);
  }, [clients, q]);
  const exact = clients.some((c) => norm(c.name) === q);

  const INPUT =
    inputClassName ??
    'h-10 w-full rounded-md border border-zinc-300 bg-white pl-8 pr-3 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            // Digitar = cliente novo (some o vínculo até escolher da lista).
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
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {matches.map((c) => (
              <button
                key={c.partyId}
                type="button"
                onClick={() => {
                  onSelect({ name: c.name, document: c.document, contactId: c.contact?.id ?? null });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {/* Nome de cliente é cadastro → "Primeira Letra Maiúscula". */}
                <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">{titleCaseName(c.name)}</span>
                {c.document && <span className="shrink-0 text-[10px] text-zinc-400">{c.document}</span>}
                <span className="shrink-0 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800" title="processos">
                  {c.cases}
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
              <p className="px-2 py-2 text-xs text-zinc-400">Digite para buscar um cliente ou criar um novo</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
