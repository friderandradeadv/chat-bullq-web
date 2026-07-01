'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Gavel, Clock, Scale, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import {
  recursosService,
  type RecursoStats,
  type EspecieStat,
  JULGAMENTO_LABEL,
} from '../services/recursos.service';

const pctTone = (p: number) => (p >= 50 ? 'emerald' : p >= 30 ? 'amber' : 'rose') as 'emerald' | 'amber' | 'rose';
const Hint = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-zinc-400">{children}</p>;

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#DEE2E6] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-[#DEE2E6] px-5 py-3.5 dark:border-zinc-800">
        <Activity className="h-4 w-4 text-[#228BE6]" />
        <h3 className="text-sm font-semibold text-[#202124] dark:text-zinc-100">Inteligência de Recursos</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KPI({ label, value, hint, tone, icon: Icon }: { label: string; value: string; hint?: string; tone?: 'emerald' | 'amber' | 'rose'; icon: React.ElementType }) {
  const toneCls = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-[#202124] dark:text-zinc-100';
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
      <div className="flex items-center gap-1.5 text-xs text-[#6C757D]"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-zinc-400">{hint}</div>}
    </div>
  );
}

function TaxaBar({ taxa }: { taxa: number | null }) {
  if (taxa == null) return <span className="text-xs text-zinc-400">sem decisão</span>;
  const p = Math.round(taxa * 100);
  const c = p >= 50 ? 'bg-emerald-500' : p >= 30 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"><div className={`h-full ${c}`} style={{ width: `${p}%` }} /></div>
      <span className="w-8 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{p}%</span>
    </div>
  );
}

function GeralView({ stats }: { stats: RecursoStats }) {
  const seg = [
    { k: 'PROVIDO', label: 'Provido', n: stats.porJulgamento.PROVIDO, c: 'bg-emerald-500' },
    { k: 'PARCIAL', label: 'Parcial', n: stats.porJulgamento.PARCIAL, c: 'bg-sky-500' },
    { k: 'NAO_PROVIDO', label: 'Não provido', n: stats.porJulgamento.NAO_PROVIDO, c: 'bg-rose-500' },
    { k: 'AGUARDANDO', label: 'Aguardando', n: stats.porJulgamento.AGUARDANDO, c: 'bg-amber-400' },
  ];
  const tot = stats.total || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {seg.map((s) => s.n > 0 && <div key={s.k} className={s.c} style={{ width: `${(s.n / tot) * 100}%` }} title={`${s.label}: ${s.n}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {seg.map((s) => (
          <div key={s.k} className="flex items-center gap-2 text-xs">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.c}`} />
            <span className="text-zinc-600 dark:text-zinc-300">{s.label}</span>
            <span className="font-semibold tabular-nums text-[#202124] dark:text-zinc-100">{s.n}</span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-[#6C757D]">
        Dos {stats.decididos} recursos já decididos, <b className="text-[#202124] dark:text-zinc-100">{stats.favoraveis} foram favoráveis</b> ao escritório — taxa de êxito de <b>{Math.round(stats.taxaExito * 100)}%</b>. {stats.aguardando} ainda aguardam julgamento.
      </p>
    </div>
  );
}

function EspeciesView({ rows }: { rows: EspecieStat[] }) {
  if (!rows.length) return <Hint>Sem dados por espécie.</Hint>;
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li key={e.nome} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-[#202124] dark:text-zinc-200">{e.nome}</span>
          <span className="shrink-0 text-xs text-zinc-400">{e.total} rec.</span>
          <span className="shrink-0"><TaxaBar taxa={e.taxa} /></span>
        </li>
      ))}
    </ul>
  );
}

function TeseItem({ t }: { t: RecursoStats['melhoresTeses'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><Award className="mr-1 inline h-3 w-3" />{JULGAMENTO_LABEL[t.julgamento]}</span>
        {t.especie && <span className="text-xs font-medium text-[#202124] dark:text-zinc-200">{t.especie}</span>}
        {t.cliente && <span className="truncate text-xs text-zinc-400">· {t.cliente}</span>}
      </div>
      <p className={`mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 ${open ? '' : 'line-clamp-2'}`}>{t.ementa}</p>
      {(t.ementa?.length ?? 0) > 140 && <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-medium text-[#228BE6] hover:underline">{open ? 'menos' : 'ler tese completa'}</button>}
    </li>
  );
}

function GargalosView({ g }: { g: RecursoStats['gargalos'] }) {
  const empty = !g.especiesBaixoExito.length && !g.bancosBaixoExito.length && !g.maisAguardando.length;
  if (empty) return <Hint>Nenhum gargalo evidente — sem espécies/bancos com baixa taxa de êxito nem grandes filas de espera.</Hint>;
  const Bloco = ({ titulo, items, render }: { titulo: string; items: any[]; render: (x: any) => React.ReactNode }) =>
    items.length ? (
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#6C757D]"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />{titulo}</div>
        <ul className="space-y-1">{items.map((x, i) => <li key={i} className="flex items-center justify-between gap-3 text-sm text-[#202124] dark:text-zinc-200">{render(x)}</li>)}</ul>
      </div>
    ) : null;
  return (
    <div className="space-y-4">
      <Bloco titulo="Espécies com baixa taxa de êxito" items={g.especiesBaixoExito} render={(x) => <><span className="min-w-0 flex-1 truncate">{x.nome}</span><span className="shrink-0"><TaxaBar taxa={x.taxa} /></span></>} />
      <Bloco titulo="Bancos onde mais perdemos" items={g.bancosBaixoExito} render={(x) => <><span className="min-w-0 flex-1 truncate">{x.nome}</span><span className="shrink-0"><TaxaBar taxa={x.taxa} /></span></>} />
      <Bloco titulo="Mais recursos parados (aguardando)" items={g.maisAguardando} render={(x) => <><span className="min-w-0 flex-1 truncate">{x.nome}</span><span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">{x.aguardando} parado(s)</span></>} />
    </div>
  );
}

export function RecursosInsightsPanel() {
  const [tab, setTab] = useState<'geral' | 'especies' | 'teses' | 'gargalos'>('geral');
  const { data: stats, isLoading } = useQuery({ queryKey: ['recursos-stats'], queryFn: () => recursosService.stats(), refetchInterval: 20_000, refetchOnWindowFocus: true });
  if (isLoading) return <Panel><Hint>Carregando métricas do escritório…</Hint></Panel>;
  if (!stats || stats.total === 0) return null;
  const exito = Math.round(stats.taxaExito * 100);
  const TABS: [typeof tab, string][] = [['geral', 'Visão geral'], ['especies', 'Por espécie'], ['teses', 'Melhores teses'], ['gargalos', 'Gargalos']];
  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Taxa de êxito" value={`${exito}%`} hint={`${stats.favoraveis}/${stats.decididos} decididos`} tone={pctTone(exito)} icon={TrendingUp} />
        <KPI label="Total de recursos" value={String(stats.total)} icon={Gavel} />
        <KPI label="Aguardando" value={String(stats.aguardando)} tone="amber" icon={Clock} />
        <KPI label="Decididos" value={String(stats.decididos)} hint={`${stats.favoraveis} a favor · ${stats.desfavoraveis} contra`} icon={Scale} />
      </div>
      <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? 'border-[#228BE6] text-[#228BE6]' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-3">
        {tab === 'geral' && <GeralView stats={stats} />}
        {tab === 'especies' && <EspeciesView rows={stats.porEspecie} />}
        {tab === 'teses' && (stats.melhoresTeses.length ? <ul className="space-y-2">{stats.melhoresTeses.map((t, i) => <TeseItem key={i} t={t} />)}</ul> : <Hint>Ainda não há teses de resultados favoráveis — conforme os tribunais julgam, as melhores teses aparecem aqui.</Hint>)}
        {tab === 'gargalos' && <GargalosView g={stats.gargalos} />}
      </div>
    </Panel>
  );
}
