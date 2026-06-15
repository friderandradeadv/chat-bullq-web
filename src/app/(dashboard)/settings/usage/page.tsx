'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, Cpu, Activity, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import {
  aiUsageService,
  USAGE_SOURCE_LABELS,
  type UsageRange,
} from '@/features/settings/services/ai-usage.service';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const int = new Intl.NumberFormat('pt-BR');

type PeriodKey = 'month' | '30d' | '7d';

function rangeFor(period: PeriodKey): UsageRange {
  if (period === 'month') return {}; // backend default = mês corrente
  const days = period === '30d' ? 30 : 7;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'Este mês' },
  { key: '30d', label: '30 dias' },
  { key: '7d', label: '7 dias' },
];

export default function SettingsUsagePage() {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const range = useMemo(() => rangeFor(period), [period]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-usage', period],
    queryFn: () => aiUsageService.get(range),
  });

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.daily ?? []).map((d) => d.costBrl)),
    [data],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Coins className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Uso da IA</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Consumo de tokens e custo estimado dos agentes e recursos de IA
          </p>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="mb-5 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              period === p.key
                ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Carregando…</span>
        </div>
      ) : isError || !data ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Não foi possível carregar o uso da IA.
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              icon={Coins}
              label="Custo (R$)"
              value={brl.format(data.totals.costBrl)}
              hint={`${usd.format(data.totals.costUsd)} • câmbio ${data.usdBrlRate.toFixed(2)}`}
            />
            <Kpi
              icon={Cpu}
              label="Tokens"
              value={int.format(data.totals.totalTokens)}
              hint={`${int.format(data.totals.inputTokens)} in / ${int.format(data.totals.outputTokens)} out`}
            />
            <Kpi
              icon={Sparkles}
              label="Cache lido"
              value={int.format(data.totals.cacheReadTokens)}
              hint="tokens reaproveitados"
            />
            <Kpi
              icon={Activity}
              label="Chamadas"
              value={int.format(data.totals.calls)}
              hint="requisições à IA"
            />
          </div>

          {/* Série diária */}
          <Card title="Custo por dia">
            {data.daily.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex h-40 items-end gap-1.5">
                {data.daily.map((d) => (
                  <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
                    <div
                      className="w-full rounded-t bg-zinc-300 transition-colors group-hover:bg-zinc-900 dark:bg-zinc-700 dark:group-hover:bg-zinc-100"
                      style={{ height: `${Math.max(2, (d.costBrl / maxDaily) * 100)}%` }}
                    />
                    <span className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
                      {brl.format(d.costBrl)}
                    </span>
                    <span className="mt-1 text-[9px] text-zinc-400">{d.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Por origem */}
          <Card title="Por recurso" icon={MessageSquare}>
            <BreakdownTable
              rows={data.bySource.map((r) => ({
                label: USAGE_SOURCE_LABELS[r.key] ?? r.key,
                tokens: r.totalTokens,
                calls: r.calls,
                costBrl: r.costBrl,
              }))}
              total={data.totals.costBrl}
            />
          </Card>

          {/* Por modelo */}
          <Card title="Por modelo" icon={Cpu}>
            <BreakdownTable
              rows={data.byModel.map((r) => ({
                label: r.key,
                tokens: r.totalTokens,
                calls: r.calls,
                costBrl: r.costBrl,
              }))}
              total={data.totals.costBrl}
            />
          </Card>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Custo estimado a partir da tabela de preços da Anthropic (USD) convertido por câmbio fixo
            configurável. Valores para acompanhamento — não são fatura.
          </p>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
        {title}
      </div>
      {children}
    </div>
  );
}

function BreakdownTable({
  rows,
  total,
}: {
  rows: { label: string; tokens: number; calls: number; costBrl: number }[];
  total: number;
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? (r.costBrl / total) * 100 : 0;
        return (
          <div key={r.label} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{r.label}</span>
                <span className="shrink-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {brl.format(r.costBrl)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ width: `${Math.max(1, pct)}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {int.format(r.tokens)} tok • {int.format(r.calls)} ch
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
      Sem uso registrado no período.
    </p>
  );
}
