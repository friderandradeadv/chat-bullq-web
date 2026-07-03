'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, Scale, Copy, CalendarClock, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard, type KanbanPhase } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { useDragScroll } from '@/lib/use-drag-scroll';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

function cleanProduto(s: string | null): string | null {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
}
function produtoColor(p: string | null): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD|CONSUMID/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}
const colProduto = (p: string | null): string => cleanProduto(p) || 'Sem produto';

export interface AdminBoardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  /** filtro dos cards que entram neste board (ex.: fase inss_admin, área Bancário…). */
  filter: (c: KanbanCard, preKeys: Set<string>) => boolean;
  /** texto quando não há nenhum card. */
  emptyHint?: string;
  /** colunas fixas por FASE (ex.: as 8 fases do pipe bancário). Sem isto, agrupa por produto. */
  columns?: { key: string; label: string }[];
  /** colunas derivadas das fases do endpoint (respeita rename/ordem/esconder/custom das Configurações). */
  columnsFromPhases?: (p: KanbanPhase) => boolean;
  /** trilha do board — escopa a busca no servidor (performance). */
  lane?: 'pre' | 'judicial' | 'banco';
}

/**
 * Board de leitura para uma trilha administrativa (INSS / bancária). Reaproveita
 * os cards do kanban jurídico, filtra pela trilha e agrupa por PRODUTO em colunas.
 * Cards clicáveis abrem a ficha (sem drag — a trilha não é uma fase movível).
 */
export function AdminBoard({ title, subtitle, icon: Icon, accent, filter, emptyHint, columns: colDefs, columnsFromPhases, lane }: AdminBoardProps) {
  // queryKey por lane (mesma convenção dos demais boards) — evita colisão de cache.
  const KEY = ['legal-cases', 'kanban', lane ?? 'all'];
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const dragScroll = useDragScroll();

  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban(lane ? { lane } : {}), refetchInterval: 60_000 });
  const preKeys = useMemo(() => new Set((data?.phases ?? []).filter((p) => p.lane === 'pre').map((p) => p.key)), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.cards ?? []).filter((c) => {
      if (!filter(c, preKeys)) return false;
      if (q && !`${c.title} ${c.client ?? ''} ${c.opponent ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, filter, preKeys]);

  const columns = useMemo(() => {
    // Colunas derivadas das fases do endpoint (respeita Configurações › Fases).
    if (columnsFromPhases) {
      const phs = (data?.phases ?? []).filter(columnsFromPhases).sort((a, b) => a.order - b.order);
      if (phs.length) return phs.map((p) => ({ nome: p.label, cards: filtered.filter((c) => c.phase === p.key) }));
      // fallback (API ainda sem as fases): usa as colunas estáticas se houver.
    }
    // Colunas fixas por FASE (pipe fiel): mantém a ordem e mostra até as vazias.
    if (colDefs) return colDefs.map((cd) => ({ nome: cd.label, cards: filtered.filter((c) => c.phase === cd.key) }));
    // Senão, agrupa por produto (INSS, bancária por área).
    const map = new Map<string, KanbanCard[]>();
    for (const c of filtered) {
      const k = colProduto(c.produto);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return Array.from(map, ([nome, cards]) => ({ nome, cards })).sort((a, b) => b.cards.length - a.cards.length);
  }, [filtered, colDefs, columnsFromPhases, data]);

  return (
    <div className="flex h-full flex-col bg-[#fafafa] text-[#101820] dark:bg-zinc-950 dark:text-zinc-200">
      <div className="shrink-0 border-b border-[#dbeaf5] px-6 pb-4 pt-6 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" style={{ color: accent }} />
          <h1 className="text-xl font-bold text-[#101820] dark:text-zinc-100">{title}</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{filtered.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, banco…"
              className="h-9 w-60 rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-6 text-sm text-zinc-400">Carregando…</p>
      ) : !colDefs && !columnsFromPhases && filtered.length === 0 ? (
        <div className="px-6 py-10">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {emptyHint ?? 'Nenhum card nesta trilha ainda.'}
          </div>
        </div>
      ) : (
        <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto py-4 pl-4 pr-4 lg:pl-6">
          {columns.map((col) => (
            <div key={col.nome} className="flex min-h-0 w-[280px] shrink-0 flex-col">
              <div className="flex h-10 items-center gap-2 px-1">
                <h2 className="truncate text-sm font-medium" style={{ color: accent }}>{col.nome}</h2>
                <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{col.cards.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border border-[#dcdfe5] bg-[#f2f2f2] px-1.5 pb-2 pt-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                {col.cards.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
                {col.cards.map((c) => <AdminCard key={c.id} c={c} onOpen={setOpenCaseId} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={data?.phases ?? []} onClose={() => setOpenCaseId(null)} />}
    </div>
  );
}

function AdminCard({ c, onOpen }: { c: KanbanCard; onOpen: (id: string) => void }) {
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  return (
    <button onClick={() => onOpen(c.id)}
      className="w-full cursor-pointer rounded border border-[#cfe0ed] bg-white py-2.5 pl-2 pr-3 text-left shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        {c.produto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{cleanProduto(c.produto)}</span>}
        {c.areaJuridica && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: 'rgb(209,209,209)', color: '#101820' }}>{c.areaJuridica}</span>}
        {/* Etiquetas (EntityTag/Astrea) NÃO vão na face do card — só na ficha (fix 406b46f). */}
      </div>
      <p className="mt-2 break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" /><span className="truncate">{c.cnj}</span>
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº do processo copiado'); }} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></span>
        </p>
      )}
      {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
      {c.proximoPrazo && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400" title="Tempo na fase atual"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
        {c.responsible && (c.responsible.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.responsible.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
          : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>)}
      </div>
    </button>
  );
}
