'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Search, Scale } from 'lucide-react';
import { legalCasesService, type RecursoRow } from '@/features/legal-cases/services/legal-cases.service';
import { RecursosInsightsPanel } from '@/features/recursos/components/recursos-insights-panel';

const JULG_COLOR: Record<string, string> = {
  'Provido': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Não provido': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Aguardando decisão': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function RecursosPage() {
  const [search, setSearch] = useState('');
  const [especie, setEspecie] = useState('');
  const [julg, setJulg] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['legal-cases', 'recursos'], queryFn: () => legalCasesService.recursos() });

  const especies = useMemo(() => Array.from(new Set(rows.map((r) => r.especie).filter(Boolean))).sort() as string[], [rows]);
  const julgamentos = useMemo(() => Array.from(new Set(rows.map((r) => r.julgamento).filter(Boolean))).sort() as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (especie && r.especie !== especie) return false;
      if (julg && r.julgamento !== julg) return false;
      if (q && !`${r.cliente ?? ''} ${r.adversa ?? ''} ${r.processo ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, especie, julg]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Recursos</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{filtered.length}</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Recursos importados do Pipefy, vinculados aos processos.</p>

      <div className="mt-4 shrink-0">
        <RecursosInsightsPanel />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, réu, CNJ…"
            className="h-9 w-64 rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
        </div>
        <select value={especie} onChange={(e) => setEspecie(e.target.value)} className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <option value="">Todas as espécies</option>
          {especies.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={julg} onChange={(e) => setJulg(e.target.value)} className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <option value="">Todos os julgamentos</option>
          {julgamentos.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-[#DEE2E6] dark:border-zinc-800">
        {isLoading && <p className="p-6 text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && filtered.length === 0 && <p className="p-6 text-sm text-zinc-400">Nenhum recurso.</p>}
        <ul className="divide-y divide-[#eef2f8] dark:divide-zinc-800">
          {filtered.map((r, i) => <RecursoItem key={i} r={r} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />)}
        </ul>
      </div>
    </div>
  );
}

function RecursoItem({ r, open, onToggle }: { r: RecursoRow; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.cliente ?? '—'} <span className="font-normal text-zinc-400">×</span> {r.adversa ?? '—'}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {r.processo && <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" /> {r.processo}</span>}
            {r.recorrente && <span>Recorrente: {r.recorrente}</span>}
          </div>
        </div>
        {r.especie && <span className="shrink-0 rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{r.especie}</span>}
        {r.julgamento && <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${JULG_COLOR[r.julgamento] ?? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{r.julgamento}</span>}
      </button>
      {open && r.tese && (
        <div className="bg-zinc-50/60 px-4 pb-3 dark:bg-zinc-900/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Tese de julgamento</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400" style={{ textAlign: 'justify' }}>{r.tese}</p>
        </div>
      )}
    </li>
  );
}
