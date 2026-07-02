'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Scale, Copy, CalendarClock, Clock, Stethoscope, Scale as ScaleIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard, type KanbanData } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { chipTextColor } from '@/lib/avatar';

const KEY = ['legal-cases', 'kanban'];
const ACCENT = '#7048e8';
// Fase judicial de destino ao "entrar com o processo" após indeferimento.
const JUDICIAL_TARGET = 'montar_inicial';

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
  if (/INVALID|ACIDENT/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}
const colProduto = (p: string | null): string => cleanProduto(p) || 'Sem produto';

// Abas do requerimento administrativo (metadata.faseData.inss_admin.resultado).
type Resultado = '' | 'deferido' | 'recurso' | 'indeferido';
const norm = (v: string | null): Resultado => {
  const s = (v ?? '').toLowerCase();
  if (s.includes('defer') && !s.includes('indefer')) return 'deferido';
  if (s.includes('recurs')) return 'recurso';
  if (s.includes('indefer')) return 'indeferido';
  return '';
};
const TABS: { key: Resultado; label: string; color: string }[] = [
  { key: '', label: 'Em análise', color: '#868e96' },
  { key: 'deferido', label: 'Deferido', color: '#2f9e44' },
  { key: 'recurso', label: 'Em recurso', color: '#f59f00' },
  { key: 'indeferido', label: 'Indeferido', color: '#e03131' },
];

/**
 * Board do INSS administrativo com abas por resultado do requerimento (em
 * análise / deferido / em recurso / indeferido). No indeferido, o card ganha o
 * botão "Entrar com o judicial", que move o próprio processo para a Fase Judicial.
 */
export function InssBoard() {
  const qc = useQueryClient();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Resultado>('');
  const dragScroll = useDragScroll();

  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban({}), refetchInterval: 30_000 });

  const inss = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.cards ?? []).filter((c) => {
      if (c.phase !== 'inss_admin') return false;
      if (q && !`${c.title} ${c.client ?? ''} ${c.opponent ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search]);

  const counts = useMemo(() => {
    const m: Record<Resultado, number> = { '': 0, deferido: 0, recurso: 0, indeferido: 0 };
    for (const c of inss) m[norm(c.inssResultado)]++;
    return m;
  }, [inss]);

  const shown = useMemo(() => inss.filter((c) => norm(c.inssResultado) === tab), [inss, tab]);

  const columns = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const c of shown) {
      const k = colProduto(c.produto);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return Array.from(map, ([nome, cards]) => ({ nome, cards })).sort((a, b) => b.cards.length - a.cards.length);
  }, [shown]);

  const setResultado = async (id: string, value: Resultado) => {
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === id ? { ...x, inssResultado: value || null } : x)) } : old,
    );
    try {
      await legalCasesService.saveFaseField(id, 'inss_admin', 'resultado', value || null);
      const lbl = TABS.find((t) => t.key === value)?.label ?? 'Em análise';
      toast.success(`Marcado como "${lbl}"`);
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(e?.response?.data?.message || 'Erro ao salvar o resultado');
    }
  };

  const entrarJudicial = async (c: KanbanCard) => {
    if (!confirm(`Entrar com o processo judicial de ${(c.client ?? c.title)}?\nO card sai do INSS administrativo e vai para a Fase Judicial (Montar Inicial).`)) return;
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === c.id ? { ...x, phase: JUDICIAL_TARGET } : x)) } : old,
    );
    try {
      await legalCasesService.movePhase(c.id, JUDICIAL_TARGET);
      toast.success('Processo movido para a Fase Judicial (Montar Inicial)');
      qc.invalidateQueries({ queryKey: KEY });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(e?.response?.data?.message || 'Erro ao mover o processo');
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#fafafa] text-[#101820] dark:bg-zinc-950 dark:text-zinc-200">
      <div className="shrink-0 border-b border-[#dbeaf5] px-6 pb-3 pt-6 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" style={{ color: ACCENT }} />
          <h1 className="text-xl font-bold text-[#101820] dark:text-zinc-100">INSS — Administrativo</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{inss.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">Requerimentos e recursos na esfera administrativa do INSS. No indeferimento, você entra com a ação judicial em um clique.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…"
              className="h-9 w-60 rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
        </div>

        {/* Abas por resultado */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key || 'analise'} onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}
                style={active ? { background: t.color } : { border: '1px solid #cfe0ed' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: active ? '#fff' : t.color }} />
                {t.label}
                <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-[#edeff3] dark:bg-zinc-800'}`}>{counts[t.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-6 text-sm text-zinc-400">Carregando…</p>
      ) : shown.length === 0 ? (
        <div className="px-6 py-10">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Nenhum processo nesta aba. {tab === '' ? 'Quando um card entrar na fase administrativa do INSS, ele aparece aqui.' : 'Marque o resultado no rodapé de cada card para movê-lo para esta aba.'}
          </div>
        </div>
      ) : (
        <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto py-4 pl-6 pr-4">
          {columns.map((col) => (
            <div key={col.nome} className="flex min-h-0 w-[300px] shrink-0 flex-col">
              <div className="flex h-10 items-center gap-2 px-1">
                <h2 className="truncate text-sm font-medium" style={{ color: ACCENT }}>{col.nome}</h2>
                <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{col.cards.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border border-[#dcdfe5] bg-[#f2f2f2] px-1.5 pb-2 pt-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                {col.cards.map((c) => (
                  <InssCard key={c.id} c={c} onOpen={setOpenCaseId} onSetResultado={setResultado} onEntrarJudicial={entrarJudicial} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={data?.phases ?? []} onClose={() => setOpenCaseId(null)} />}
    </div>
  );
}

function InssCard({
  c, onOpen, onSetResultado, onEntrarJudicial,
}: {
  c: KanbanCard;
  onOpen: (id: string) => void;
  onSetResultado: (id: string, v: Resultado) => void;
  onEntrarJudicial: (c: KanbanCard) => void;
}) {
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const res = norm(c.inssResultado);
  const [busy, setBusy] = useState(false);

  return (
    <div className="w-full rounded border border-[#cfe0ed] bg-white py-2.5 pl-2 pr-3 text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <button onClick={() => onOpen(c.id)} className="block w-full text-left">
        <div className="-ml-1 flex flex-wrap items-center gap-1">
          {c.produto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{cleanProduto(c.produto)}</span>}
          {(c.tags ?? []).map((t) => <span key={t.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: t.color, color: chipTextColor(t.color) }}>{t.name}</span>)}
        </div>
        <p className="mt-2 break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
        {c.cnj && (
          <span className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
            <Scale className="h-3 w-3 shrink-0" /><span className="truncate">{c.cnj}</span>
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº copiado'); }} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></span>
          </span>
        )}
        {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
        {c.proximoPrazo && (
          <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
            <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
          </span>
        )}
      </button>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400" title="Tempo na fase"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
        {c.responsible && (c.responsible.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.responsible.avatarUrl} alt="" title={c.responsible.name} className="h-5 w-5 rounded-full object-cover" />
          : <span title={c.responsible.name} className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>)}
      </div>

      {/* Resultado do requerimento (define a aba) */}
      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={res}
          onChange={(e) => onSetResultado(c.id, e.target.value as Resultado)}
          className="h-7 flex-1 rounded-md border border-[#cfe0ed] bg-white px-1.5 text-[11px] text-[#101820] focus:border-[#7048e8] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="">Em análise</option>
          <option value="deferido">Deferido</option>
          <option value="recurso">Em recurso</option>
          <option value="indeferido">Indeferido</option>
        </select>
      </div>

      {res === 'indeferido' && (
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onEntrarJudicial(c); } finally { setBusy(false); } }}
          className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#7048e8] px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScaleIcon className="h-3.5 w-3.5" />} Entrar com o judicial
        </button>
      )}
    </div>
  );
}
