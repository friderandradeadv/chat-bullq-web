'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  BarChart3, Scale, TrendingUp, Trophy, Landmark, Layers, Cpu,
  Target, Users, CalendarDays, Filter as FilterIcon, Briefcase, Gavel, Award, AlertTriangle,
} from 'lucide-react';
import { legalCasesService, type JuriRow } from '@/features/legal-cases/services/legal-cases.service';

const COLORS = ['#228BE6', '#7C3AED', '#0D9488', '#E11970', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#F97316', '#0EA5E9', '#A855F7', '#84CC16'];
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  return fmtMoney(v);
};
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e9ecef' };
type Metrica = 'qtd' | 'valor';

// Agrupa com placar de resultado REAL (lido dos andamentos) → taxa de êxito honesta.
// Decididos = favorável + perdido + extinto (extinção sem mérito/indeferimento).
interface ResBucket { key: string; count: number; valor: number; fav: number; perd: number; ext: number; enc: number; and: number; lim: number; exitoSum: number; exitoN: number }
type ResRow = ResBucket & { dec: number; taxa: number | null; exitoMedio: number | null };
function agruparRes(rows: JuriRow[], keyOf: (r: JuriRow) => string | null): ResRow[] {
  const m = new Map<string, ResBucket>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    const o = m.get(k) ?? { key: k, count: 0, valor: 0, fav: 0, perd: 0, ext: 0, enc: 0, and: 0, lim: 0, exitoSum: 0, exitoN: 0 };
    o.count++; o.valor += r.value;
    if (r.resultado === 'favoravel') o.fav++;
    else if (r.resultado === 'perdido') o.perd++;
    else if (r.resultado === 'extinto') o.ext++;
    else if (r.resultado === 'encerrado') o.enc++;
    else if (r.resultado === 'limbo') o.lim++;
    else o.and++;
    if (r.exito != null && r.resultado !== 'limbo') { o.exitoSum += r.exito; o.exitoN++; }
    m.set(k, o);
  }
  return [...m.values()].map((o) => {
    const dec = o.fav + o.perd + o.ext;
    return { ...o, dec, taxa: dec ? Math.round((o.fav / dec) * 100) : null, exitoMedio: o.exitoN ? Math.round(o.exitoSum / o.exitoN) : null };
  });
}
const taxaCor = (t: number | null) => (t == null ? '#94a3b8' : t >= 70 ? '#10B981' : t >= 50 ? '#228BE6' : t >= 30 ? '#F59E0B' : '#EF4444');

export default function JurimetriaPage() {
  const { data, isLoading } = useQuery({ queryKey: ['legal-cases', 'jurimetria'], queryFn: () => legalCasesService.jurimetria() });
  const allRows = data?.rows ?? [];

  // ── Filtros ──
  const [tipo, setTipo] = useState<'processos' | 'leads' | 'todos'>('processos');
  const [area, setArea] = useState('');
  const [tribunal, setTribunal] = useState('');
  const [sistema, setSistema] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [ano, setAno] = useState('');
  const [metrica, setMetrica] = useState<Metrica>('qtd');

  const opts = useMemo(() => {
    const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean) as string[])].sort();
    return {
      areas: uniq(allRows.map((r) => r.area)),
      tribunais: uniq(allRows.map((r) => r.tribunal)),
      sistemas: uniq(allRows.map((r) => r.sistema)),
      responsaveis: uniq(allRows.map((r) => r.responsavel)),
      anos: uniq(allRows.map((r) => (r.ano ? String(r.ano) : null))).sort((a, b) => Number(b) - Number(a)),
    };
  }, [allRows]);

  const rows = useMemo(() => allRows.filter((r) => {
    if (tipo === 'processos' && !r.temProcesso) return false;
    if (tipo === 'leads' && r.temProcesso) return false;
    if (area && r.area !== area) return false;
    if (tribunal && r.tribunal !== tribunal) return false;
    if (sistema && r.sistema !== sistema) return false;
    if (responsavel && r.responsavel !== responsavel) return false;
    if (ano && String(r.ano) !== ano) return false;
    return true;
  }), [allRows, tipo, area, tribunal, sistema, responsavel, ano]);

  // ── KPIs (foco em desempenho, não em dinheiro) ──
  const k = useMemo(() => {
    const nProc = rows.filter((r) => r.temProcesso).length;
    const nLeads = rows.filter((r) => !r.temProcesso).length;
    const comExito = rows.filter((r) => r.exito != null);
    const exitoMedio = comExito.length ? Math.round(comExito.reduce((s, r) => s + (r.exito ?? 0), 0) / comExito.length) : null;
    const fav = rows.filter((r) => r.resultado === 'favoravel').length;
    const perd = rows.filter((r) => r.resultado === 'perdido').length;
    const ext = rows.filter((r) => r.resultado === 'extinto').length;
    const enc = rows.filter((r) => r.resultado === 'encerrado').length;
    const and = rows.filter((r) => r.resultado === 'andamento').length;
    const limboRows = rows.filter((r) => r.limbo || r.resultado === 'limbo');
    const predat = rows.filter((r) => r.predatoria).length;
    const respNeg = rows.filter((r) => r.recursoNegado).length;
    const dec = fav + perd + ext;
    return { nProc, nLeads, exitoMedio, fav, perd, ext, enc, and, predat, respNeg, lim: limboRows.length, limboValor: limboRows.reduce((s, r) => s + r.value, 0), taxaReal: dec ? Math.round((fav / dec) * 100) : null, dec };
  }, [rows]);

  const val = (b: { count: number; valor: number }) => (metrica === 'valor' ? b.valor : b.count);

  // tribunal: ranking por taxa de êxito; desempata por volume de favoráveis (importante: se
  // "perdidos" não são marcados, a taxa fica 100% e o que diferencia é quanto se ganha)
  const porTribunal = useMemo(() => agruparRes(rows, (r) => r.tribunal), [rows]);
  const tribunalRank = useMemo(() => porTribunal.filter((t) => t.dec >= 3).sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.fav - a.fav), [porTribunal]);
  const tribunalRankFew = useMemo(() => porTribunal.filter((t) => t.dec > 0 && t.dec < 3).sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.fav - a.fav), [porTribunal]);

  // teses (assunto/produto): qual performa mais
  const porTese = useMemo(() => agruparRes(rows, (r) => r.assunto).sort((a, b) => b.count - a.count), [rows]);
  const teseRank = useMemo(() => [...porTese].filter((t) => t.dec > 0).sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.fav - a.fav), [porTese]);

  // entendimento: combinações tribunal × tese com volume, ordenadas por taxa
  const tribTese = useMemo(() => agruparRes(rows, (r) => (r.tribunal && r.assunto ? `${r.tribunal}|||${r.assunto}` : null))
    .filter((c) => c.dec >= 2)
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.dec - a.dec)
    .map((c) => { const [trib, tese] = c.key.split('|||'); return { ...c, trib, tese }; }), [rows]);

  // descritivos (mantidos)
  const porArea = useMemo(() => agruparRes(rows, (r) => r.area).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porSistema = useMemo(() => agruparRes(rows, (r) => r.sistema).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porResponsavel = useMemo(() => agruparRes(rows, (r) => r.responsavel).sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.count - a.count), [rows]);
  const porFase = useMemo(() => {
    const m = new Map<string, { key: string; count: number; order: number }>();
    for (const r of rows) { const o = m.get(r.fase) ?? { key: r.faseLabel, count: 0, order: r.faseOrder }; o.count++; m.set(r.fase, o); }
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [rows]);
  const timeline = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.mes) m.set(r.mes, (m.get(r.mes) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, count]) => ({ mes, count }));
  }, [rows]);

  if (isLoading) return <div className="p-8 text-sm text-zinc-400">Carregando jurimetria…</div>;

  const metricaLabel = metrica === 'valor' ? 'R$' : 'qtd';
  const melhorTrib = tribunalRank[0];
  const piorTrib = tribunalRank.length > 1 ? tribunalRank[tribunalRank.length - 1] : null;
  // motivos das derrotas (perdido + extinto), agregados
  const motivosDerrota = useMemo(() => {
    const m = new Map<string, { motivo: string; n: number; valor: number }>();
    for (const r of rows) {
      if (r.resultado !== 'perdido' && r.resultado !== 'extinto') continue;
      const k = r.resultadoMotivo || 'sem motivo identificado';
      const o = m.get(k) ?? { motivo: k, n: 0, valor: 0 }; o.n++; o.valor += r.value; m.set(k, o);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [rows]);
  const predatorios = useMemo(() => rows.filter((r) => r.predatoria), [rows]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa] p-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-6 w-6 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Jurimetria</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{rows.length} {tipo === 'leads' ? 'leads' : tipo === 'todos' ? 'registros' : 'processos'}</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Onde, em quê e com quem o escritório ganha mais — tribunais, teses e o entendimento de cada juízo.</p>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#e9ecef] bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <FilterIcon className="h-4 w-4 text-zinc-400" />
        <Segmented value={tipo} onChange={(v) => setTipo(v as typeof tipo)} options={[['processos', 'Processos'], ['leads', 'Leads'], ['todos', 'Todos']]} />
        <Sel value={area} onChange={setArea} placeholder="Área" options={opts.areas} />
        <Sel value={tribunal} onChange={setTribunal} placeholder="Tribunal" options={opts.tribunais} />
        <Sel value={sistema} onChange={setSistema} placeholder="Sistema" options={opts.sistemas} />
        <Sel value={responsavel} onChange={setResponsavel} placeholder="Responsável" options={opts.responsaveis} />
        <Sel value={ano} onChange={setAno} placeholder="Ano" options={opts.anos} />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
          distribuição:
          <Segmented value={metrica} onChange={(v) => setMetrica(v as Metrica)} options={[['qtd', 'Qtd'], ['valor', 'R$']]} />
        </div>
      </div>

      {/* KPIs de desempenho REAL (lido dos andamentos, não da fase) */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Scale className="h-4 w-4" />} label="Processos (com CNJ)" value={String(k.nProc)} hint={`+${k.nLeads} leads sem ação`} />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Taxa de êxito REAL" value={k.taxaReal != null ? `${k.taxaReal}%` : '—'} hint={`${k.fav} de ${k.dec} decididos`} accent={taxaCor(k.taxaReal)} />
        <Kpi icon={<Award className="h-4 w-4" />} label="Favoráveis" value={String(k.fav)} hint="procedência · acordo · execução" accent="#10B981" />
        <Kpi icon={<Target className="h-4 w-4" />} label="Perdidos" value={String(k.perd)} hint="improcedência · RESP negado" accent="#EF4444" />
        <Kpi icon={<Scale className="h-4 w-4" />} label="Extintos / indeferidos" value={String(k.ext)} hint="sem mérito · emenda à inicial" accent="#F59E0B" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Em andamento" value={String(k.and)} hint={`+${k.enc} encerrados a conferir`} accent="#228BE6" />
      </div>

      {/* Destaque: onde ganhamos × onde apanhamos */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {melhorTrib && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-900/10 dark:to-zinc-900">
            <Landmark className="h-7 w-7 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Onde mais vencemos</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{melhorTrib.key} <span className="text-emerald-600">· {melhorTrib.taxa}%</span></p>
              <p className="text-[11px] text-zinc-400">{melhorTrib.fav} favoráveis de {melhorTrib.dec} decididos</p>
            </div>
          </div>
        )}
        {piorTrib && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 dark:border-rose-900/40 dark:from-rose-900/10 dark:to-zinc-900">
            <Landmark className="h-7 w-7 shrink-0 text-rose-600" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Onde mais apanhamos</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{piorTrib.key} <span className="text-rose-600">· {piorTrib.taxa}%</span></p>
              <p className="text-[11px] text-zinc-400">{piorTrib.perd + piorTrib.ext} derrotas de {piorTrib.dec} decididos</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300">
        <Cpu className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Resultado lido dos <b>andamentos reais</b> (DataJud + DJEN + e-SAJ/Projudi), não da fase do kanban: improcedência, extinção sem mérito, indeferimento da inicial, RESP/RE não conhecido e procedência/acordo. <b>{k.enc} processos arquivados</b> não têm decisão clara nos autos — ficam como “a conferir”, fora da taxa.</span>
      </div>

      {(k.predat > 0 || k.respNeg > 0) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{k.predat > 0 && <><b>{k.predat} processos com flag de advocacia predatória / NUMOPEDE</b> nos andamentos. </>}{k.respNeg > 0 && <><b>{k.respNeg} com RESP/RE não conhecido.</b></>} Conferir abaixo nos motivos das derrotas.</span>
        </div>
      )}

      {k.lim > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <span><b>{k.lim} processos em limbo</b> (Contribuições — associações sumiram, execução frustrada, investigação PF): <b>{fmtCompact(k.limboValor)}</b> em causa. Ficam <b>fora</b> da taxa de êxito e entram nas previsões só com ~10% de chance.</span>
        </div>
      )}

      {/* Sucesso por tribunal — o coração da jurimetria */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sucesso por tribunal" icon={<Landmark className="h-4 w-4" />} subtitle="taxa de êxito real · mín. 3 decididos">
          <TaxaTabela data={tribunalRank} colLabel="Tribunal" />
          {tribunalRankFew.length > 0 && (
            <p className="mt-2 text-[11px] text-zinc-400">Amostra pequena (1–2 decididos): {tribunalRankFew.map((t) => `${t.key} ${t.taxa}%`).join(' · ')}</p>
          )}
        </Card>
        <Card title="Taxa de êxito por tribunal" icon={<Trophy className="h-4 w-4" />} subtitle="barra = % favoráveis dos decididos">
          <TaxaBar data={tribunalRank.slice(0, 10)} />
        </Card>
      </div>

      {/* Desempenho por tese */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Desempenho por tese" icon={<Gavel className="h-4 w-4" />} subtitle="qual tese mais performa (taxa de êxito)">
          <TaxaTabela data={teseRank.slice(0, 12)} colLabel="Tese / produto" />
        </Card>
        <Card title="Volume por tese" icon={<Scale className="h-4 w-4" />} subtitle={`carteira por tese (${metricaLabel})`}>
          <HBar data={porTese.slice(0, 10)} metrica={metrica} color="#7C3AED" />
        </Card>
      </div>

      {/* Entendimento: tribunal × tese */}
      <div className="mt-4">
        <Card title="Entendimento por tribunal × tese" icon={<Award className="h-4 w-4" />} subtitle="onde cada tese vence ou apanha (mín. 2 decididos)">
          {tribTese.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">Ainda sem combinações com decisões suficientes nesta seleção.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
                  <tr><th className="px-2 py-1.5 font-medium">Tribunal</th><th className="px-2 py-1.5 font-medium">Tese</th><th className="px-2 py-1.5 text-right font-medium">Decididos</th><th className="px-2 py-1.5 text-right font-medium">Favoráveis</th><th className="px-2 py-1.5 text-right font-medium">Taxa</th></tr>
                </thead>
                <tbody>
                  {tribTese.map((c) => (
                    <tr key={c.key} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 font-medium text-zinc-700 dark:text-zinc-200">{c.trib}</td>
                      <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{c.tese}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{c.dec}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{c.fav}</td>
                      <td className="px-2 py-1.5 text-right"><span className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: taxaCor(c.taxa) }}>{c.taxa}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Por que perdemos — motivos das derrotas + alertas */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Por que perdemos" icon={<Target className="h-4 w-4" />} subtitle="motivos das derrotas (perdidos + extintos), dos andamentos">
          {motivosDerrota.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">Nenhuma derrota identificada nos andamentos desta seleção.</p>
          ) : (
            <div className="space-y-1.5">
              {motivosDerrota.map((m) => {
                const tot = motivosDerrota.reduce((s, x) => s + x.n, 0) || 1;
                const p = (m.n / tot) * 100;
                return (
                  <div key={m.motivo} className="flex items-center gap-3">
                    <span className="w-56 shrink-0 truncate text-sm text-zinc-600 dark:text-zinc-300" title={m.motivo}>{m.motivo}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(3, p)}%` }} /></div>
                    <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-rose-600">{m.n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="Alertas — advocacia predatória / NUMOPEDE" icon={<AlertTriangle className="h-4 w-4" />} subtitle="processos sinalizados nos andamentos">
          {predatorios.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">Nenhum processo com flag de predatória nesta seleção.</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto scrollbar-thin">
              {predatorios.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/40 px-2.5 py-1.5 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
                  <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{r.cliente}</span>
                  <span className="flex shrink-0 items-center gap-2"><span className="text-[11px] text-zinc-400">{r.tribunal ?? '—'}</span><span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{r.resultado}</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Descritivos da carteira */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Distribuição por área" icon={<Layers className="h-4 w-4" />}><Donut data={porArea} metrica={metrica} /></Card>
        <Card title="Sucesso por responsável" icon={<Users className="h-4 w-4" />} subtitle="taxa de êxito por advogado"><TaxaTabela data={porResponsavel.filter((r) => r.dec > 0).slice(0, 10)} colLabel="Responsável" /></Card>
        <Card title="Funil por fase" icon={<BarChart3 className="h-4 w-4" />}><HBar data={porFase.map((f) => ({ key: f.key, count: f.count, valor: 0 }))} metrica="qtd" color="#0D9488" max={14} /></Card>
        <Card title="Por sistema" icon={<Cpu className="h-4 w-4" />}><Donut data={porSistema} metrica={metrica} /></Card>
        <Card title="Novos por mês" icon={<CalendarDays className="h-4 w-4" />} subtitle="distribuição/criação"><Timeline data={timeline} /></Card>
        <Card title="Resultado dos processos" icon={<Target className="h-4 w-4" />}>
          <div className="flex flex-wrap items-center justify-around gap-y-3 py-3">
            <Stat big={k.fav} label="Favoráveis" color="#10B981" />
            <Stat big={k.perd} label="Perdidos" color="#EF4444" />
            <Stat big={k.ext} label="Extintos" color="#F59E0B" />
            <Stat big={k.enc} label="Encerrados" color="#94A3B8" />
            <Stat big={k.and} label="Em andamento" color="#228BE6" />
            <Stat big={k.lim} label="Limbo" color="#A855F7" />
          </div>
          <p className="px-1 text-center text-[11px] text-zinc-400">Lido dos andamentos reais. Favoráveis = procedência/acordo/execução · Perdidos = improcedência/RESP negado · Extintos = sem mérito/indeferimento · Encerrados = arquivados sem decisão clara (a conferir).</p>
        </Card>
      </div>
      <div className="h-6" />
    </div>
  );
}

// ─── Controles ────────────────────────────────────────────────────────────────
function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-[#DEE2E6] bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value === v ? 'bg-[#228BE6] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
function Sel({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border px-2 text-xs ${value ? 'border-[#228BE6] text-[#228BE6]' : 'border-[#DEE2E6] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'} bg-white dark:bg-zinc-900`}>
      <option value="">{placeholder}: todos</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Cards / charts ─────────────────────────────────────────────────────────
function Kpi({ icon, label, value, hint, accent = '#64748b' }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e9ecef] bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500"><span style={{ color: accent }}>{icon}</span><span className="truncate">{label}</span></div>
      <p className="mt-1.5 text-xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
function Card({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e9ecef] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[#228BE6]">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
        {subtitle && <span className="text-[11px] text-zinc-400">· {subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
function Stat({ big, label, color }: { big: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold" style={{ color }}>{big}</p>
      <p className="mt-0.5 text-xs font-medium capitalize text-zinc-500">{label.toLowerCase()}</p>
    </div>
  );
}

// Tabela de taxa de êxito (tribunal/tese/responsável)
function TaxaTabela({ data, colLabel }: { data: ResRow[]; colLabel: string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-zinc-400">Sem decisões nesta seleção.</p>;
  return (
    <div className="max-h-80 overflow-y-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
          <tr><th className="px-2 py-1.5 font-medium">{colLabel}</th><th className="px-2 py-1.5 text-right font-medium">Dec.</th><th className="px-2 py-1.5 text-right font-medium">Fav.</th><th className="px-2 py-1.5 text-right font-medium">Perd.</th><th className="px-2 py-1.5 text-right font-medium">Ext.</th><th className="px-2 py-1.5 text-right font-medium">Taxa</th></tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.key} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-2 py-1.5 font-medium text-zinc-700 dark:text-zinc-200">{r.key}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{r.dec}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{r.fav}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{r.perd || ''}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-600">{r.ext || ''}</td>
              <td className="px-2 py-1.5 text-right"><span className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: taxaCor(r.taxa) }}>{r.taxa == null ? '—' : `${r.taxa}%`}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaxaBar({ data }: { data: ResRow[] }) {
  const rows = data.map((r) => ({ key: r.key, v: r.taxa ?? 0 }));
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-zinc-400">Sem decisões suficientes.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f1f3f5" />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="key" width={130} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}% de êxito`, '']} />
        <Bar dataKey="v" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
          {rows.map((r, i) => <Cell key={i} fill={taxaCor(r.v)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type SimpleRow = { key: string; count: number; valor: number };
const showVal = (r: SimpleRow, metrica: Metrica) => (metrica === 'valor' ? r.valor : r.count);
function HBar({ data, color, metrica, max = 10 }: { data: SimpleRow[]; color: string; metrica: Metrica; max?: number }) {
  const rows = data.slice(0, max).map((r) => ({ key: r.key, v: showVal(r, metrica) }));
  const h = Math.max(160, rows.length * 28);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="key" width={125} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [metrica === 'valor' ? fmtMoney(Number(v)) : `${v} processos`, '']} />
        <Bar dataKey="v" radius={[0, 4, 4, 0]} fill={color} barSize={16}>
          {rows.map((_, i) => <Cell key={i} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
function Donut({ data, metrica }: { data: SimpleRow[]; metrica: Metrica }) {
  const rows = data.slice(0, 8).map((r) => ({ key: r.key, v: showVal(r, metrica) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="v" nameKey="key" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
          {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [metrica === 'valor' ? fmtMoney(Number(v)) : `${v} processos`, n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
function Timeline({ data }: { data: { mes: string; count: number }[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-zinc-400">Sem datas.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#228BE6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#228BE6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f3f5" />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} processos`, '']} />
        <Area type="monotone" dataKey="count" stroke="#228BE6" strokeWidth={2} fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
