'use client';

import { Wallet, ArrowDownCircle, ArrowUpCircle, Scale, Info } from 'lucide-react';

export default function FinanceiroPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Wallet className="h-5 w-5" />
          </span>
          Financeiro
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Movimentações, entradas/saídas e saldo do escritório.
        </p>

        {/* KPIs (placeholder até ligar a fonte de dados) */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Kpi icon={Scale} accent="#228BE6" label="Saldo atual" value="—" />
          <Kpi icon={ArrowUpCircle} accent="#16a34a" label="Entradas (mês)" value="—" />
          <Kpi icon={ArrowDownCircle} accent="#dc2626" label="Saídas (mês)" value="—" />
        </div>

        {/* Movimentações */}
        <div className="mt-6 rounded-2xl border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Movimentações</h2>
          </div>
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma movimentação ainda.
            </p>
          </div>
        </div>

        {/* Aviso de roadmap */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-800 dark:text-amber-200/90">
            Em construção. Este módulo vai espelhar o <b>Financeiro do Astrea</b> — movimentações,
            categorias, contas, entradas/saídas e saldo. A importação das suas movimentações será
            ligada em seguida.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, accent,
}: {
  icon: React.ElementType; label: string; value: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
