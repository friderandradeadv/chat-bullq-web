'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Search, ExternalLink } from 'lucide-react';
import { legalCasesService, type ContratoRow } from '@/features/legal-cases/services/legal-cases.service';

export default function ContratosPage() {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['legal-cases', 'contratos'], queryFn: () => legalCasesService.contratos() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.cliente ?? ''} ${r.honorarios ?? ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Contratos</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{filtered.length}</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Contratos de honorários importados do Pipefy.</p>

      <div className="relative mt-4 w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, honorários…"
          className="h-9 w-full rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-[#DEE2E6] dark:border-zinc-800">
        {isLoading && <p className="p-6 text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && filtered.length === 0 && <p className="p-6 text-sm text-zinc-400">Nenhum contrato.</p>}
        <ul className="divide-y divide-[#eef2f8] dark:divide-zinc-800">
          {filtered.map((c: ContratoRow, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.cliente ?? '—'}</p>
                {c.honorarios && <p className="mt-0.5 truncate text-xs text-zinc-500">{c.honorarios}</p>}
              </div>
              {c.dataAssinatura && <span className="shrink-0 text-xs text-zinc-400">{c.dataAssinatura}</span>}
              {c.contratoUrl ? (
                <a href={c.contratoUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#DEE2E6] px-2.5 py-1 text-xs font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700">
                  Contrato <ExternalLink className="h-3 w-3" />
                </a>
              ) : <span className="shrink-0 text-[11px] italic text-zinc-400">sem PDF</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
