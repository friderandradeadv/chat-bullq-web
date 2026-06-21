'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Search, Scale, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { legalCasesService, type OpponentRow } from '@/features/legal-cases/services/legal-cases.service';

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function PartesAdversasPage() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['legal-cases', 'opponents'],
    queryFn: () => legalCasesService.opponents(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.document ?? ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  const totalProcessos = filtered.reduce((s, r) => s + r.casesCount, 0);
  const totalValor = filtered.reduce((s, r) => s + r.totalValue, 0);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Partes Adversas</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
          {filtered.length}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">
        Réus dos processos — {totalProcessos} processos · {fmtMoney(totalValor)} em causa.
      </p>

      <div className="relative mt-4 w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar parte adversa, CNPJ…"
          className="h-9 w-full rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-[#DEE2E6] dark:border-zinc-800">
        {isLoading && <p className="p-6 text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && filtered.length === 0 && <p className="p-6 text-sm text-zinc-400">Nenhuma parte adversa.</p>}
        <ul className="divide-y divide-[#eef2f8] dark:divide-zinc-800">
          {filtered.map((r) => (
            <OpponentItem key={r.name} r={r} open={open === r.name} onToggle={() => setOpen(open === r.name ? null : r.name)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function OpponentItem({ r, open, onToggle }: { r: OpponentRow; open: boolean; onToggle: () => void }) {
  const iniciais = r.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
        {r.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.avatarUrl} alt={r.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
            {iniciais || <Building2 className="h-4 w-4" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {r.document ? <span>CNPJ {r.document}</span> : <span className="italic text-zinc-400">sem CNPJ</span>}
            {r.areas.map((a) => (
              <span key={a} className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{a}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.casesCount} <span className="text-xs font-normal text-zinc-400">proc.</span></p>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(r.totalValue)}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
      </button>
      {open && (
        <ul className="space-y-1 bg-zinc-50/60 px-4 pb-3 pt-1 dark:bg-zinc-900/30">
          {r.processos.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <Scale className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {p.cliente ?? '—'} {p.cnj && <span className="text-zinc-400">· {p.cnj}</span>}
              </span>
              {p.area && <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-400">{p.area}</span>}
              {p.value > 0 && <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(p.value)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
