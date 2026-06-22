'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  BarChart3, Scale, TrendingUp, Wallet, Trophy, Landmark, Layers, Cpu,
  Sparkles, Target, Users, CalendarDays, Filter as FilterIcon, Briefcase,
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

interface Bucket { key: string; count: number; valor: number; exitoSum: number; exitoN: number }
function agrupar(rows: JuriRow[], keyOf: (r: JuriRow) => string | null): (Bucket & { exitoMedio: number | null })[] {
  const m = new Map<string, Bucket>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    const o = m.get(k) ?? { key: k, count: 0, valor: 0, exitoSum: 0, exitoN: 0 };
    o.count++; o.valor += r.value;
    if (r.exito != null) { o.exitoSum += r.exito; o.exitoN++; }
    m.set(k, o);
  }
  return [...m.values()].map((o) => ({ ...o, exitoMedio: o.exitoN ? Math.round(o.exitoSum / o.exitoN) : null }));
}

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

  // ── KPIs ──
  const k = useMemo(() => {
    const nProc = rows.filter((r) => r.temProcesso).length;
    const nLeads = rows.filter((r) => !r.temProcesso).length;
    const valorTotal = rows.reduce((s, r) => s + r.value, 0);
    const valorEsperado = rows.reduce((s, r) => s + r.value * ((r.exito ?? 0) / 100), 0);
    const comExito = rows.filter((r) => r.exito != null);
    const exitoMedio = comExito.length ? Math.round(comExito.reduce((s, r) => s + (r.exito ?? 0), 0) / comExito.length) : null;
    const favoraveis = rows.filter((r) => r.resultado === 'favoravel').length;
    const perdidos = rows.filter((r) => r.resultado === 'perdido').length;
    const andamento = rows.filter((r) => r.resultado === 'andamento').length;
    const decididos = favoraveis + perdidos;
    const provaveis = rows.filter((r) => (r.exito ?? 0) >= 50);
    const ganhosProjetados = favoraveis + Math.round(rows.filter((r) => r.resultado === 'andamento').reduce((s, r) => s + (r.exito ?? 0) / 100, 0));
    return {
      nProc, nLeads, valorTotal, valorEsperado, exitoMedio, favoraveis, perdidos, andamento,
      taxaReal: decididos ? Math.round((favoraveis / decididos) * 100) : null,
      provaveis: provaveis.length, valorProvavel: provaveis.reduce((s, r) => s + r.value, 0),
      ganhosProjetados,
    };
  }, [rows]);

  const val = (b: { count: number; valor: number }) => (metrica === 'valor' ? b.valor : b.count);
  const porArea = useMemo(() => agrupar(rows, (r) => r.area).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porTribunal = useMemo(() => agrupar(rows, (r) => r.tribunal).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porSistema = useMemo(() => agrupar(rows, (r) => r.sistema).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porAssunto = useMemo(() => agrupar(rows, (r) => r.assunto).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porResponsavel = useMemo(() => agrupar(rows, (r) => r.responsavel).sort((a, b) => val(b) - val(a)), [rows, metrica]);
  const porFase = useMemo(() => {
    const m = new Map<string, { key: string; count: number; order: number }>();
    for (const r of rows) {
      const o = m.get(r.fase) ?? { key: r.faseLabel, count: 0, order: r.faseOrder };
      o.count++; m.set(r.fase, o);
    }
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [rows]);
  const exitoPorArea = useMemo(() => porArea.filter((a) => a.exitoMedio != null).sort((a, b) => (b.exitoMedio ?? 0) - (a.exitoMedio ?? 0)), [porArea]);
  const timeline = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.mes) m.set(r.mes, (m.get(r.mes) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, count]) => ({ mes, count }));
  }, [rows]);
  const honorarios = useMemo(() => agrupar(rows, (r) => r.honorarios), [rows]);

  if (isLoading) return <div className="p-8 text-sm text-zinc-400">Carregando jurimetria…</div>;

  const metricaLabel = metrica === 'valor' ? 'R$' : 'qtd';

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa] p-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-6 w-6 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Jurimetria</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{rows.length} {tipo === 'leads' ? 'leads' : tipo === 'todos' ? 'registros' : 'processos'}</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Inteligência da carteira — processos reais (com nº CNJ) separados de leads, com previsões e filtros dinâmicos.</p>

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
          métrica:
          <Segmented value={metrica} onChange={(v) => setMetrica(v as Metrica)} options={[['qtd', 'Qtd'], ['valor', 'R$']]} />
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Scale className="h-4 w-4" />} label="Processos (com CNJ)" value={String(k.nProc)} hint="ações ajuizadas" />
        <Kpi icon={<Briefcase className="h-4 w-4" />} label="Leads (sem processo)" value={String(k.nLeads)} hint="fechados, não ajuizados" accent="#F59E0B" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Valor em causa" value={fmtCompact(k.valorTotal)} accent="#7C3AED" />
        <Kpi icon={<Sparkles className="h-4 w-4" />} label="Valor esperado de êxito" value={fmtCompact(k.valorEsperado)} hint="Σ valor × prob." accent="#10B981" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Êxito médio estimado" value={k.exitoMedio != null ? `${k.exitoMedio}%` : '—'} accent="#0D9488" />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Taxa real (decididos)" value={k.taxaReal != null ? `${k.taxaReal}%` : '—'} hint={`${k.favoraveis} ganhos · ${k.perdidos} perdidos`} accent="#228BE6" />
      </div>

      {/* Previsões */}
      <div className="mt-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-900/10 dark:to-zinc-900">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Previsões</h3>
          <span className="text-[11px] text-zinc-400">com base na probabilidade de êxito da carteira filtrada</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Prev big={fmtCompact(k.valorEsperado)} label="Recuperação esperada" sub={`de ${fmtCompact(k.valorTotal)} em causa`} color="#10B981" />
          <Prev big={String(k.provaveis)} label="Êxito provável (≥50%)" sub={`${fmtCompact(k.valorProvavel)} em jogo`} color="#228BE6" />
          <Prev big={`~${k.ganhosProjetados}`} label="Ganhos projetados" sub={`${k.favoraveis} já favoráveis + andamento`} color="#7C3AED" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Distribuição por área" icon={<Layers className="h-4 w-4" />}><Donut data={porArea} metrica={metrica} /></Card>
        <Card title={`Por tribunal (${metricaLabel})`} icon={<Landmark className="h-4 w-4" />} subtitle="derivado do nº CNJ"><HBar data={porTribunal.slice(0, 10)} metrica={metrica} color="#228BE6" /></Card>
        <Card title={`Assuntos processuais (${metricaLabel})`} icon={<Scale className="h-4 w-4" />}><HBar data={porAssunto.slice(0, 10)} metrica={metrica} color="#7C3AED" /></Card>
        <Card title="Taxa de êxito estimada por área" icon={<TrendingUp className="h-4 w-4" />}><ExitoBar data={exitoPorArea} /></Card>
        <Card title="Novos por mês" icon={<CalendarDays className="h-4 w-4" />} subtitle="distribuição/criação"><Timeline data={timeline} /></Card>
        <Card title="Funil por fase" icon={<BarChart3 className="h-4 w-4" />}><HBar data={porFase.map((f) => ({ key: f.key, count: f.count, valor: 0, exitoMedio: null, exitoSum: 0, exitoN: 0 }))} metrica="qtd" color="#0D9488" max={14} /></Card>
        <Card title={`Por responsável (${metricaLabel})`} icon={<Users className="h-4 w-4" />}><HBar data={porResponsavel.slice(0, 10)} metrica={metrica} color="#E11970" /></Card>
        <Card title="Por sistema" icon={<Cpu className="h-4 w-4" />}><Donut data={porSistema} metrica={metrica} /></Card>
      </div>

      {/* Resultado + honorários */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Resultado dos processos" icon={<Target className="h-4 w-4" />}>
          <div className="flex items-center justify-around py-3">
            <Stat big={k.favoraveis} label="Favoráveis" color="#10B981" />
            <Stat big={k.perdidos} label="Perdidos" color="#EF4444" />
            <Stat big={k.andamento} label="Em andamento" color="#F59E0B" />
          </div>
          <p className="px-1 text-center text-[11px] text-zinc-400">Favoráveis = cumprimento + trânsito + prestação de contas · Perdidos = arquivo por insucesso.</p>
        </Card>
        <Card title="Honorários" icon={<Wallet className="h-4 w-4" />}>
          <div className="flex items-center justify-around py-3">
            {honorarios.length === 0 && <span className="text-sm text-zinc-400">Sem dados.</span>}
            {honorarios.map((h, i) => <Stat key={h.key} big={h.count} label={h.key} color={COLORS[i % COLORS.length]} />)}
          </div>
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
function Prev({ big, label, sub, color }: { big: string; label: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#e9ecef] bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-2xl font-bold" style={{ color }}>{big}</p>
      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</p>
      <p className="text-[11px] text-zinc-400">{sub}</p>
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

type ChartRow = { key: string; count: number; valor: number; exitoMedio: number | null };
const showVal = (r: ChartRow, metrica: Metrica) => (metrica === 'valor' ? r.valor : r.count);

function HBar({ data, color, metrica, max = 10 }: { data: ChartRow[]; color: string; metrica: Metrica; max?: number }) {
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
function Donut({ data, metrica }: { data: ChartRow[]; metrica: Metrica }) {
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
function ExitoBar({ data }: { data: ChartRow[] }) {
  const rows = data.map((r) => ({ key: r.key, v: r.exitoMedio ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f1f3f5" />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="key" width={110} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}% êxito estimado`, '']} />
        <Bar dataKey="v" radius={[0, 4, 4, 0]} barSize={16} fill="#10B981" label={{ position: 'right', fontSize: 11, fill: '#10B981', formatter: (v: unknown) => `${v}%` }}>
          {rows.map((_, i) => <Cell key={i} fill="#10B981" />)}
        </Bar>
      </BarChart>
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
