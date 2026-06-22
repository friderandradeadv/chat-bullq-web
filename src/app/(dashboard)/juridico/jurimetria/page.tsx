'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from 'recharts';
import {
  BarChart3, Scale, TrendingUp, Wallet, Trophy, Landmark, Layers, Cpu,
} from 'lucide-react';
import { legalCasesService, type JuriBucket } from '@/features/legal-cases/services/legal-cases.service';

const COLORS = ['#228BE6', '#7C3AED', '#0D9488', '#E11970', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#F97316', '#0EA5E9', '#A855F7', '#84CC16'];
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtCompact = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : fmtMoney(v);

export default function JurimetriaPage() {
  const { data, isLoading } = useQuery({ queryKey: ['legal-cases', 'jurimetria'], queryFn: () => legalCasesService.jurimetria() });

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-zinc-400">Carregando jurimetria…</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa] p-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-[#228BE6]" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Jurimetria</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{data.total} processos</span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">Dados reais da carteira do escritório — assuntos, tribunais, sistemas, fases e êxito.</p>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<Scale className="h-4 w-4" />} label="Processos" value={String(data.total)} hint={`${data.ativos} ativos · ${data.arquivados} arquivados`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Êxito médio estimado" value={data.exito.medio != null ? `${data.exito.medio}%` : '—'} hint={`${data.exito.comEstimativa} com estimativa`} accent="#10B981" />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Taxa real (decididos)" value={data.resultado.taxaReal != null ? `${data.resultado.taxaReal}%` : '—'} hint={`${data.resultado.favoraveis} favoráveis · ${data.resultado.perdidos} perdidos`} accent="#228BE6" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Valor em causa" value={fmtCompact(data.valorTotal)} hint="soma do valor da causa" accent="#7C3AED" />
        <Kpi icon={<Layers className="h-4 w-4" />} label="Em andamento" value={String(data.resultado.emAndamento)} hint={`${data.suspensos} suspensos`} accent="#F59E0B" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Processos por área" icon={<Layers className="h-4 w-4" />}>
          <DonutChart data={data.porArea} />
        </Card>

        <Card title="Por tribunal" icon={<Landmark className="h-4 w-4" />} subtitle="derivado do nº CNJ">
          <HBar data={data.porTribunal.slice(0, 10)} color="#228BE6" />
        </Card>

        <Card title="Taxa de êxito estimada por área" icon={<TrendingUp className="h-4 w-4" />}>
          <ExitoBar data={data.porArea.filter((a) => a.exitoMedio != null)} />
        </Card>

        <Card title="Assuntos processuais" icon={<Scale className="h-4 w-4" />}>
          <HBar data={data.porAssunto.slice(0, 10)} color="#7C3AED" />
        </Card>

        <Card title="Por sistema (tribunal eletrônico)" icon={<Cpu className="h-4 w-4" />}>
          <DonutChart data={data.porSistema} />
        </Card>

        <Card title="Processos por fase" icon={<BarChart3 className="h-4 w-4" />} subtitle="funil da carteira">
          <HBar data={data.porFase.map((f) => ({ key: f.label, count: f.count, valor: 0, exitoMedio: null }))} color="#0D9488" max={14} />
        </Card>
      </div>

      {/* Resultado + honorários */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Resultado dos processos" icon={<Trophy className="h-4 w-4" />}>
          <div className="flex items-center justify-around py-3">
            <Stat big={data.resultado.favoraveis} label="Favoráveis" color="#10B981" />
            <Stat big={data.resultado.perdidos} label="Perdidos" color="#EF4444" />
            <Stat big={data.resultado.emAndamento} label="Em andamento" color="#F59E0B" />
          </div>
          <p className="px-1 text-center text-xs text-zinc-400">
            Favoráveis = cumprimento + trânsito + prestação de contas · Perdidos = arquivo por insucesso.
          </p>
        </Card>

        <Card title="Honorários" icon={<Wallet className="h-4 w-4" />}>
          <div className="flex items-center justify-around py-3">
            {data.honorarios.map((h, i) => (
              <Stat key={h.key} big={h.count} label={h.key} color={COLORS[i % COLORS.length]} />
            ))}
            {data.honorarios.length === 0 && <span className="text-sm text-zinc-400">Sem dados de honorários.</span>}
          </div>
        </Card>
      </div>

      <div className="h-6" />
    </div>
  );
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function Kpi({ icon, label, value, hint, accent = '#64748b' }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e9ecef] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <span style={{ color: accent }}>{icon}</span>{label}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
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

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e9ecef' };

/** Barra horizontal (ranking) — top N por contagem. */
function HBar({ data, color, max = 10 }: { data: JuriBucket[]; color: string; max?: number }) {
  const rows = data.slice(0, max);
  const h = Math.max(160, rows.length * 28);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="key" width={120} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} processos`, '']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={color} barSize={16}>
          {rows.map((_, i) => <Cell key={i} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut por categoria. */
function DonutChart({ data }: { data: JuriBucket[] }) {
  const rows = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="key" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
          {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} processos`, n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Barra de % de êxito estimada por área. */
function ExitoBar({ data }: { data: JuriBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f1f3f5" />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="key" width={110} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}% êxito estimado`, '']} />
        <Bar dataKey="exitoMedio" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: '#10B981', formatter: (v: unknown) => `${v}%` }}>
          {data.map((_, i) => <Cell key={i} fill="#10B981" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
