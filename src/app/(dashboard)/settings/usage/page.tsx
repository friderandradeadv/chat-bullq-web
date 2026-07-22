'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Coins,
  Cpu,
  Activity,
  Loader2,
  Sparkles,
  MessageSquare,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  aiUsageService,
  USAGE_SOURCE_LABELS,
  type UsageRange,
  type AiCreditHealth,
} from '@/features/settings/services/ai-usage.service';
import { useAuthStore } from '@/stores/auth-store';

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

      {/* Saldo da IA (Anthropic) — alerta de "perto do fim" / "acabou" */}
      <CreditCard />

      {/* Quota do Gemini — alerta de "429 RESOURCE_EXHAUSTED" */}
      <GeminiQuotaCard />

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
                    {/* Valor SEMPRE visível (vertical, cabe em qualquer nº de dias) */}
                    <span className="pointer-events-none mb-0.5 whitespace-nowrap text-[9px] font-medium leading-none tabular-nums text-zinc-500 [writing-mode:vertical-rl] rotate-180 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                      {d.costBrl > 0 ? brl.format(d.costBrl) : ''}
                    </span>
                    <div
                      className="w-full rounded-t bg-zinc-300 transition-colors group-hover:bg-zinc-900 dark:bg-zinc-700 dark:group-hover:bg-zinc-100"
                      style={{ height: `${Math.max(2, (d.costBrl / maxDaily) * 100)}%` }}
                    />
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

const CREDIT_TONE: Record<
  AiCreditHealth['status'],
  { box: string; icon: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  ok: {
    box: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  low: {
    box: 'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  empty: {
    box: 'border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
    Icon: AlertTriangle,
  },
  unset: {
    box: 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
    icon: 'text-zinc-400',
    Icon: Wallet,
  },
};

function creditMessage(h: AiCreditHealth): string {
  if (h.status === 'empty')
    return h.exhausted
      ? 'O crédito da IA ACABOU — a API da Anthropic recusou a última chamada. Enquanto não recarregar, os agentes (Camila etc.) param de responder e os leads travam. Recarregue no console da Anthropic e registre aqui.'
      : 'O saldo estimado zerou. Recarregue no console da Anthropic e registre a recarga aqui.';
  if (h.status === 'low')
    return 'Saldo perto do fim (menos de 20%). Recarregue logo pra não parar os agentes.';
  if (h.status === 'unset')
    return 'Registre quanto você carregou pra acompanharmos o saldo restante e avisarmos antes de acabar. O aviso de "acabou" (erro da API) funciona mesmo sem isso.';
  return 'Saldo folgado. Vou avisar aqui quando chegar perto do fim.';
}

function CreditCard() {
  const qc = useQueryClient();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const organizations = useAuthStore((s) => s.organizations);
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const { data: h, isLoading } = useQuery({
    queryKey: ['ai-usage', 'credit-health', activeOrgId],
    queryFn: () => aiUsageService.creditHealth(),
    refetchInterval: 60_000,
  });

  const reload = useMutation({
    mutationFn: (loadedUsd: number) => aiUsageService.registerReload(loadedUsd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-usage'] });
      setOpen(false);
      setAmount('');
      toast.success('Recarga registrada 💳 Saldo zerado e alerta apagado.');
    },
    onError: () => toast.error('Não consegui registrar a recarga.'),
  });

  if (isLoading || !h) {
    return (
      <div className="mb-5 flex h-20 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 dark:border-zinc-800">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const tone = CREDIT_TONE[h.status];
  const pct = h.remainingPct != null ? Math.round(h.remainingPct * 100) : null;
  const submit = () => {
    const v = Number(amount.replace(',', '.'));
    if (!Number.isFinite(v) || v < 1) {
      toast.error('Informe o valor da recarga em dólar (ex: 50).');
      return;
    }
    reload.mutate(v);
  };

  return (
    <div className={`mb-5 rounded-xl border p-4 ${tone.box}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
          <tone.Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Saldo da IA (Anthropic)
            </h3>
            {isAdmin && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> Registrei uma recarga
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{creditMessage(h)}</p>

          {h.remainingUsd != null && h.loadedUsd != null && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-xs text-zinc-500">
                <span>
                  Restante estimado:{' '}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {usd.format(h.remainingUsd)}
                  </strong>{' '}
                  ({brl.format(h.remainingUsd * h.usdBrlRate)})
                  {pct != null && ` • ${pct}%`}
                </span>
                <span className="text-zinc-400">de {usd.format(h.loadedUsd)}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${
                    h.status === 'empty'
                      ? 'bg-red-500'
                      : h.status === 'low'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, pct ?? 0)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Gasto desde a recarga: {usd.format(h.spentUsd)}
                {h.loadedAt &&
                  ` • recarregado em ${new Date(h.loadedAt).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
          )}

          {open && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900">
                <span className="text-sm text-zinc-400">US$</span>
                <input
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  inputMode="decimal"
                  placeholder="50"
                  className="w-20 bg-transparent px-1.5 py-1.5 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                />
              </div>
              <button
                onClick={submit}
                disabled={reload.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {reload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar'}
              </button>
              <span className="text-[11px] text-zinc-400">
                Quanto você carregou agora no console da Anthropic.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Quota do Gemini — sem "saldo declarado" (o Google não vende crédito
 * pré-pago do mesmo jeito que a Anthropic), só o erro real de 429
 * RESOURCE_EXHAUSTED reportado pelo GeminiLlmBackend. Fica escondido quando
 * está tudo ok pra não poluir a tela com mais uma caixa verde de "saldo
 * folgado" (aqui não existe "folgado", só "não bateu erro ainda").
 */
function GeminiQuotaCard() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);

  const { data: h, isLoading } = useQuery({
    queryKey: ['ai-usage', 'credit-health', activeOrgId],
    queryFn: () => aiUsageService.creditHealth(),
    refetchInterval: 60_000,
  });

  if (isLoading || !h || !h.geminiExhausted) return null;

  return (
    <div className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Quota do Gemini esgotou
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            A API do Google recusou a última chamada por limite de quota (429). Enquanto
            durar, os agentes que rodam em modelo Gemini param de responder e os leads
            travam. Verifique o limite/faturamento no Google AI Studio ou aguarde a janela
            de quota resetar.
          </p>
          {h.geminiExhaustedAt && (
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Desde {new Date(h.geminiExhaustedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>
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
