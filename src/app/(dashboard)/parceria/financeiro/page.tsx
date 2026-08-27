'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Info } from 'lucide-react';
import { usePartnerLock, useMinhasParcerias } from '@/features/partnerships/hooks/use-partnership';
import { partnershipsService } from '@/features/partnerships/services/partnerships.service';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const mesLabel = (m: string) => {
  const [ano, mes] = m.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
};

export default function FinanceiroParceriaPage() {
  const travada = usePartnerLock();
  const todas = useMinhasParcerias();
  const parceria = travada ?? todas[0] ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['parceria', parceria?.id, 'acerto'],
    queryFn: () => partnershipsService.acerto(parceria!.id),
    enabled: !!parceria,
  });

  if (!parceria) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-zinc-500">
        Você não está em nenhuma parceria.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20 text-center text-sm text-zinc-500">
        Carregando o acerto…
      </div>
    );
  }

  const { resumo, serie, porCaso, lancamentos } = data;
  const picoSerie = Math.max(1, ...serie.map((s) => s.valor));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: data.parceria.cor }}
        >
          <CircleDollarSign className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Financeiro da parceria
          </h1>
          <p className="text-sm text-zinc-500">
            {data.parceria.nome} · divisão {data.parceria.partnerPct}/
            {100 - data.parceria.partnerPct}
          </p>
        </div>
      </div>

      {/* O que esta tela é — e o que ela não é. Dito na tela porque a pergunta
          "cadê o resto do financeiro?" aparece sozinha na primeira semana. */}
      <div className="mt-5 flex gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <Info className="mt-0.5 size-4 shrink-0 text-zinc-400" />
        <p>
          Esta é a conta <strong>da parceria</strong>: o que entrou nos processos marcados,
          menos os custos que vocês dividem (perícia, custas, tráfego da área). Custo fixo do
          escritório — aluguel, pró-labore, contador, impostos — não entra aqui e não afeta
          o seu percentual.
        </p>
      </div>

      {/* Cascata do acerto */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Linha label="Recebido" valor={resumo.recebido} tom="positivo" />
        <Linha label="Custos diretos" valor={-resumo.custosDiretos} tom="negativo" />
        <Linha label="Líquido da parceria" valor={resumo.liquido} tom="neutro" forte />
        <Linha
          label="Sua parte"
          valor={resumo.doParceiro}
          tom="neutro"
          forte
          cor={data.parceria.cor}
        />
        <Linha label="Parte do escritório" valor={resumo.doEscritorio} tom="neutro" />
        <Linha label="A receber" valor={resumo.aReceber} tom="pendente" />
      </div>

      {/* Série mensal */}
      {serie.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Entradas por mês
          </h2>
          <div className="flex items-end gap-1.5 overflow-x-auto rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            {serie.map((s) => (
              <div key={s.mes} className="flex min-w-[42px] flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular-nums text-zinc-400">
                  {s.valor >= 1000 ? `${Math.round(s.valor / 1000)}k` : Math.round(s.valor)}
                </span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(4, (s.valor / picoSerie) * 120)}px`,
                    background: data.parceria.cor,
                  }}
                />
                <span className="text-[10px] text-zinc-500">{mesLabel(s.mes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por caso */}
      {porCaso.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Resultado por processo
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 text-right font-medium">Recebido</th>
                  <th className="px-4 py-2.5 text-right font-medium">Custo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {porCaso.map((c) => (
                  <tr key={c.caseId}>
                    <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-white">
                      {c.cliente}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {brl(c.recebido)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {c.custo ? brl(-c.custo) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-900 dark:text-white">
                      {brl(c.liquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lançamentos */}
      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Lançamentos</h2>
          <span className="text-xs text-zinc-500">{resumo.nLancamentos} no total</span>
        </div>
        {!lancamentos.length ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Nenhum lançamento vinculado à parceria ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lancamentos.map((t, i) => (
                  <tr key={t.id ?? i}>
                    <td className="px-4 py-2.5 tabular-nums text-zinc-500">{t.data}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{t.categoria}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{t.cliente ?? t.descricao ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {t.status ? t.status.replace('_', ' ') : '—'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        t.valor >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {brl(t.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.geradoEm && (
        <p className="mt-6 text-xs text-zinc-400">Dados do snapshot de {data.geradoEm}.</p>
      )}
    </div>
  );
}

function Linha({
  label,
  valor,
  tom,
  forte,
  cor,
}: {
  label: string;
  valor: number;
  tom: 'positivo' | 'negativo' | 'neutro' | 'pendente';
  forte?: boolean;
  cor?: string;
}) {
  const cores = {
    positivo: 'text-emerald-600 dark:text-emerald-400',
    negativo: 'text-rose-600 dark:text-rose-400',
    neutro: 'text-zinc-900 dark:text-white',
    pendente: 'text-amber-600 dark:text-amber-400',
  } as const;
  return (
    <div
      className={`rounded-xl border p-4 ${
        forte
          ? 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${cores[tom]}`}
        style={cor ? { color: cor } : undefined}
      >
        {brl(valor)}
      </p>
    </div>
  );
}
