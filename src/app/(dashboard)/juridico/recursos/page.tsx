'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Search, Scale, LayoutGrid, List, Clock, Award, ThumbsDown } from 'lucide-react';
import {
  recursosService,
  type Recurso,
  type JulgamentoRecurso,
  JULGAMENTO_LABEL,
  PARTE_RECORRENTE_LABEL,
} from '@/features/recursos/services/recursos.service';
import { RecursosInsightsPanel } from '@/features/recursos/components/recursos-insights-panel';

const JULG_BADGE: Record<JulgamentoRecurso, string> = {
  AGUARDANDO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PROVIDO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  NAO_PROVIDO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  PARCIAL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

// Resultado do ponto de vista do ESCRITÓRIO (quem recorreu importa).
const isDecided = (r: Recurso) => r.julgamento !== 'AGUARDANDO';
const isFav = (r: Recurso) =>
  r.parteRecorrente === 'ADVERSA' ? r.julgamento === 'NAO_PROVIDO' : r.julgamento === 'PROVIDO' || r.julgamento === 'PARCIAL';
type ColKey = 'aguardando' | 'fav' | 'desfav';
const colOf = (r: Recurso): ColKey => (!isDecided(r) ? 'aguardando' : isFav(r) ? 'fav' : 'desfav');

const COLS: { key: ColKey; title: string; icon: React.ElementType; head: string; bar: string; ring: string }[] = [
  { key: 'aguardando', title: 'Aguardando decisão', icon: Clock, head: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-400', ring: 'border-l-amber-400' },
  { key: 'fav', title: 'Favoráveis ao escritório', icon: Award, head: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'border-l-emerald-500' },
  { key: 'desfav', title: 'Desfavoráveis', icon: ThumbsDown, head: 'text-rose-700 dark:text-rose-400', bar: 'bg-rose-500', ring: 'border-l-rose-500' },
];

export default function RecursosPage() {
  const [search, setSearch] = useState('');
  const [especie, setEspecie] = useState('');
  const [julg, setJulg] = useState('');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['recursos', 'all'], queryFn: () => recursosService.list() });

  const especies = useMemo(() => Array.from(new Set(rows.map((r) => r.especie).filter(Boolean))).sort() as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (especie && r.especie !== especie) return false;
      if (julg && r.julgamento !== julg) return false;
      if (q && !`${r.clienteNome ?? ''} ${r.parteAdversa ?? ''} ${r.cnjNumber ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, especie, julg]);

  const byCol = useMemo(() => {
    const m: Record<ColKey, Recurso[]> = { aguardando: [], fav: [], desfav: [] };
    for (const r of filtered) m[colOf(r)].push(r);
    return m;
  }, [filtered]);

  return (
    <div className="flex h-full flex-col bg-white p-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
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
          {(['AGUARDANDO', 'PROVIDO', 'PARCIAL', 'NAO_PROVIDO'] as JulgamentoRecurso[]).map((j) => <option key={j} value={j}>{JULGAMENTO_LABEL[j]}</option>)}
        </select>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[#DEE2E6] dark:border-zinc-700">
          <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><LayoutGrid className="h-4 w-4" /> Kanban</button>
          <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><List className="h-4 w-4" /> Lista</button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-zinc-400">Carregando…</p>
      ) : view === 'kanban' ? (
        <div className="mt-4 grid flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.key} className="flex min-h-0 flex-col rounded-xl border border-[#DEE2E6] bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex items-center gap-2 border-b border-[#DEE2E6] px-3 py-2.5 dark:border-zinc-800">
                <span className={`h-2 w-2 rounded-full ${c.bar}`} />
                <c.icon className={`h-4 w-4 ${c.head}`} />
                <span className={`text-sm font-semibold ${c.head}`}>{c.title}</span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{byCol[c.key].length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {byCol[c.key].length === 0 && <p className="px-2 py-6 text-center text-xs text-zinc-400">Vazio</p>}
                {byCol[c.key].map((r) => <RecursoCard key={r.id} r={r} ring={c.ring} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-[#DEE2E6] dark:border-zinc-800">
          {filtered.length === 0 && <p className="p-6 text-sm text-zinc-400">Nenhum recurso.</p>}
          <ul className="divide-y divide-[#eef2f8] dark:divide-zinc-800">
            {filtered.map((r) => <RecursoListItem key={r.id} r={r} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecursoCard({ r, ring }: { r: Recurso; ring: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border border-l-4 border-zinc-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${ring}`}>
      <div className="flex items-start justify-between gap-2">
        {r.especie && <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{r.especie}</span>}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${JULG_BADGE[r.julgamento]}`}>{JULGAMENTO_LABEL[r.julgamento]}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
        {r.clienteNome ?? '—'} <span className="font-normal text-zinc-400">×</span> {r.parteAdversa ?? '—'}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {r.cnjNumber && <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" /> {r.cnjNumber}</span>}
        {r.parteRecorrente && <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">recorreu: {PARTE_RECORRENTE_LABEL[r.parteRecorrente]}</span>}
      </div>
      {r.motivo && (
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"><span className="font-medium text-zinc-400">Motivo:</span> {r.motivo}</p>
      )}
      {r.ementa && (
        <>
          <button onClick={() => setOpen((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#228BE6] hover:underline">{open ? 'ocultar tese' : 'ver tese de julgamento'}</button>
          {open && <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">{r.ementa}</p>}
        </>
      )}
    </div>
  );
}

function RecursoListItem({ r }: { r: Recurso }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.clienteNome ?? '—'} <span className="font-normal text-zinc-400">×</span> {r.parteAdversa ?? '—'}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {r.cnjNumber && <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" /> {r.cnjNumber}</span>}
            {r.parteRecorrente && <span>Recorrente: {PARTE_RECORRENTE_LABEL[r.parteRecorrente]}</span>}
          </div>
          {r.motivo && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400"><span className="font-medium text-zinc-400">Motivo:</span> {r.motivo}</p>}
        </div>
        {r.especie && <span className="shrink-0 rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{r.especie}</span>}
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${JULG_BADGE[r.julgamento]}`}>{JULGAMENTO_LABEL[r.julgamento]}</span>
      </button>
      {open && r.ementa && (
        <div className="bg-zinc-50/60 px-4 pb-3 dark:bg-zinc-900/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Tese de julgamento</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400" style={{ textAlign: 'justify' }}>{r.ementa}</p>
        </div>
      )}
    </li>
  );
}
