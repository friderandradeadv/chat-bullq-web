'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Gavel, Search, Scale, ChevronDown, ChevronRight, Building2, Users, Wallet, Trophy, Layers,
} from 'lucide-react';
import { legalCasesService, type OpponentRow } from '@/features/legal-cases/services/legal-cases.service';
import { titleCaseName } from '@/lib/names';

const COLORS = ['#228BE6', '#7C3AED', '#0D9488', '#E11970', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtCompact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : fmtMoney(v));
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e9ecef' };

/** Bucket canônico de assunto (espelha o backend de jurimetria). */
function bucket(raw: string): string {
  const s = (raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (/RMC|RCC|CONTRIBUI|CONSIGNAD|REVISIONAL|TARIFA|SEGURO|PORTABIL|BANCARI|FINANCIAMENTO|EMPRESTIM|PASSIVO/.test(s)) return 'Bancário';
  if (/BPC|LOAS|APOSENTAD|PREVID|MATERNIDADE|BENEFICIO|ABONO|AUXILIO|INSS/.test(s)) return 'Previdenciário';
  if (/TRABALH|RECLAMA|RESCIS|VERBAS|FERIAS|RTORD|FGTS/.test(s)) return 'Trabalhista';
  if (/TRAFICO|FURTO|ROUBO|ESTELIONATO|CRIME|PENAL|DROGA|DESACATO|FLAGRANTE|PRISAO/.test(s)) return 'Criminal';
  if (/GUARDA|ALIMENTO|FAMILIA|DIVORCIO|INVENTARIO/.test(s)) return 'Família';
  if (/CONSUMID|DANO|INDENIZ|VOO|FRAUDE|INSCRICAO|ABUSIVA|CARTAO DE CREDITO|ATRASO/.test(s)) return 'Consumidor';
  if (/OBRIGACAO|MONITORIA|EXECUCAO|CUMPRIMENTO|PENHORA|NULIDADE|ANULA|CIVEL|CIVIL/.test(s)) return 'Cível';
  return 'Outros';
}

type Enriched = OpponentRow & { buckets: string[]; principal: string };

export default function PartesAdversasPage() {
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sort, setSort] = useState<'processos' | 'valor' | 'nome'>('processos');
  const [open, setOpen] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['legal-cases', 'opponents'],
    queryFn: () => legalCasesService.opponents(),
  });

  const enriched: Enriched[] = useMemo(() => rows.map((r) => {
    const counts = new Map<string, number>();
    for (const p of r.processos) { const b = bucket(p.area ?? ''); counts.set(b, (counts.get(b) ?? 0) + 1); }
    for (const a of r.areas) { const b = bucket(a); if (!counts.has(b)) counts.set(b, 1); }
    const buckets = [...counts.keys()];
    const principal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Outros';
    return { ...r, name: titleCaseName(r.name), buckets, principal };
  }), [rows]);

  const areasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach((e) => e.buckets.forEach((b) => s.add(b)));
    return [...s].sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = enriched.filter((r) => {
      if (areaFilter && !r.buckets.includes(areaFilter)) return false;
      if (q && !`${r.name} ${r.document ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) =>
      sort === 'valor' ? b.totalValue - a.totalValue
        : sort === 'nome' ? a.name.localeCompare(b.name, 'pt-BR')
          : b.casesCount - a.casesCount || b.totalValue - a.totalValue);
  }, [enriched, search, areaFilter, sort]);

  const totalProcessos = filtered.reduce((s, r) => s + r.casesCount, 0);
  const totalValor = filtered.reduce((s, r) => s + r.totalValue, 0);
  const maior = filtered[0];

  // Gráficos
  const topLitigantes = filtered.slice(0, 8).map((r) => ({ key: shortName(r.name), count: r.casesCount }));
  const porArea = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => r.processos.forEach((p) => { const b = bucket(p.area ?? ''); m.set(b, (m.get(b) ?? 0) + 1); }));
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);
  // Concentração: % dos processos nas 5 maiores
  const top5Share = totalProcessos ? Math.round((filtered.slice(0, 5).reduce((s, r) => s + r.casesCount, 0) / totalProcessos) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa] p-4 text-zinc-800 lg:p-6 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Partes Adversas</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{filtered.length}</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Réus dos processos — quem o escritório mais enfrenta e quanto está em jogo.</p>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Partes adversas" value={String(filtered.length)} />
        <Kpi icon={<Scale className="h-4 w-4" />} label="Processos" value={String(totalProcessos)} accent="#228BE6" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Valor em causa" value={fmtCompact(totalValor)} accent="#7C3AED" />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Maior litigante" value={maior ? shortName(maior.name) : '—'} hint={maior ? `${maior.casesCount} processos` : ''} accent="#E11970" />
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Maiores litigantes" icon={<Trophy className="h-4 w-4" />} subtitle={`top 5 = ${top5Share}% dos processos`}>
          <ResponsiveContainer width="100%" height={Math.max(180, topLitigantes.length * 30)}>
            <BarChart data={topLitigantes} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="key" width={130} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} processos`, '']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: '#64748b' }}>
                {topLitigantes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Processos por área" icon={<Layers className="h-4 w-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porArea} dataKey="count" nameKey="key" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {porArea.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} processos`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar parte adversa, CNPJ…"
            className="h-9 w-64 rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
        </div>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <option value="">Todas as áreas</option>
          {areasDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'processos' | 'valor' | 'nome')} className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <option value="processos">Mais processos</option>
          <option value="valor">Maior valor</option>
          <option value="nome">Nome (A→Z)</option>
        </select>
      </div>

      {/* Lista */}
      <div className="mt-3 rounded-xl border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading && <p className="p-6 text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && filtered.length === 0 && <p className="p-6 text-sm text-zinc-400">Nenhuma parte adversa.</p>}
        <ul className="divide-y divide-[#eef2f8] dark:divide-zinc-800">
          {filtered.slice(0, 100).map((r, i) => (
            <OpponentItem key={r.name} rank={i + 1} r={r} open={open === r.name} onToggle={() => setOpen(open === r.name ? null : r.name)} />
          ))}
        </ul>
        {filtered.length > 100 && <p className="border-t border-[#eef2f8] p-3 text-center text-xs text-zinc-400 dark:border-zinc-800">Mostrando as 100 maiores de {filtered.length}.</p>}
      </div>
      <div className="h-6" />
    </div>
  );
}

function Kpi({ icon, label, value, hint, accent = '#64748b' }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e9ecef] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500"><span style={{ color: accent }}>{icon}</span>{label}</div>
      <p className="mt-1.5 truncate text-xl font-bold text-zinc-900 dark:text-zinc-100" title={value}>{value}</p>
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

function OpponentItem({ r, rank, open, onToggle }: { r: Enriched; rank: number; open: boolean; onToggle: () => void }) {
  const iniciais = r.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
        <span className="w-5 shrink-0 text-center text-xs font-semibold text-zinc-300 dark:text-zinc-600">{rank}</span>
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
            <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{r.principal}</span>
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
                {p.cliente ? titleCaseName(p.cliente) : '—'} {p.cnj && <span className="text-zinc-400">· {p.cnj}</span>}
              </span>
              {p.area && <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-400">{bucket(p.area)}</span>}
              {p.value > 0 && <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(p.value)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function shortName(name: string): string {
  return name.length > 22 ? name.slice(0, 21) + '…' : name;
}
