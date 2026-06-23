'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, BarChart,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, Scale, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Info, Target, Users, Sparkles, Loader2,
} from 'lucide-react';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';

const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kbrl = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '-' : ''; return a >= 1000 ? `${s}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${s}${a}`; };
const mesCurto = (label: string) => label.replace('/20', '/');

const NIVEL: Record<string, { cor: string; bg: string; icon: React.ElementType }> = {
  critico: { cor: '#E03131', bg: 'bg-rose-50 border-rose-200 dark:bg-rose-900/15 dark:border-rose-900/40', icon: AlertTriangle },
  alerta: { cor: '#F59F00', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-900/40', icon: AlertTriangle },
  ok: { cor: '#2F9E44', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/15 dark:border-emerald-900/40', icon: CheckCircle2 },
  info: { cor: '#228BE6', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-900/40', icon: Info },
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">{label}</p>
      {payload.filter((p: any) => p.value != null).map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5 tabular-nums" style={{ color: p.color || p.fill }}>
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold">{brl2(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function FinanceiroPage() {
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'dashboard'], queryFn: () => financeiroService.dashboard(), staleTime: 60_000 });
  const [novosClientes, setNovosClientes] = useState(3);
  const [showTx, setShowTx] = useState(false);

  const meses = data?.meses ?? [];
  const ticket = data?.projecao?.ticketMedio || 250;

  const cenario = useMemo(() => {
    if (!meses.length) return [];
    const lastReal = [...meses].filter((m) => !m.projecao).slice(-1)[0];
    let acumBase = lastReal?.acumulado ?? 0;
    let acumCen = lastReal?.acumulado ?? 0;
    let extra = 0;
    return meses.map((m) => {
      if (!m.projecao) return { ...m, receitaCenario: m.receita, resultadoCenario: m.resultado, acumuladoCenario: m.acumulado, acumuladoBase: m.acumulado };
      extra += novosClientes * ticket;
      const receitaC = m.receita + extra;
      const resultadoC = Math.round(receitaC - m.despesaTotal);
      acumBase = Math.round(acumBase + m.resultado);
      acumCen = Math.round(acumCen + resultadoC);
      return { ...m, receitaCenario: Math.round(receitaC), resultadoCenario: resultadoC, acumuladoCenario: acumCen, acumuladoBase: acumBase };
    });
  }, [meses, novosClientes, ticket]);

  const chartData = cenario.map((m) => ({
    nome: mesCurto(m.label), receita: m.receita, despesa: -m.despesaTotal, resultado: m.resultado,
    acumulado: m.acumulado, acumuladoCenario: m.acumuladoCenario, projecao: m.projecao,
  }));
  const idxProj = chartData.findIndex((d) => d.projecao);
  const divisor = idxProj > 0 ? chartData[idxProj - 1]?.nome : undefined;

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;

  if (!data || data.vazio || !data.kpis) {
    return (
      <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100"><Wallet className="h-6 w-6 text-emerald-600" /> Financeiro</h1>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
            Ainda não importamos seus dados financeiros do Astrea. Assim que o snapshot for carregado, o painel completo aparece aqui.
          </div>
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const p = data.projecao!;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><Wallet className="h-5 w-5" /></span>
              Financeiro
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Espelho do Astrea — lucros, prejuízos, crescimento e gargalos do escritório.</p>
          </div>
          {data.geradoEm && <p className="text-xs text-zinc-400">dados de {data.fonte?.split('—')[0]?.trim() || 'Astrea'} · {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>}
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Scale} accent={k.saldoAtual < 0 ? '#E03131' : '#2F9E44'} label={`Saldo acumulado · ${k.mesAtualLabel}`} value={brl(k.saldoAtual)} hint={k.saldoAtual < 0 ? 'caixa no vermelho' : 'caixa positivo'} />
          <Kpi icon={k.resultadoMes >= 0 ? TrendingUp : TrendingDown} accent={k.resultadoMes >= 0 ? '#2F9E44' : '#E03131'} label="Resultado do mês" value={brl(k.resultadoMes)} hint={`receita ${brl(k.receitaMes)} · despesa ${brl(k.despesaMes)}`} />
          <Kpi icon={ArrowUpCircle} accent="#2F9E44" label="Receita (12 meses)" value={brl(k.receita12m)} hint={`média ${brl(k.receitaMedia)}/mês`} />
          <Kpi icon={ArrowDownCircle} accent="#E03131" label="Despesa (12 meses)" value={brl(k.despesa12m)} hint={`fixo ${brl(k.custoFixoMensal)}/mês`} />
        </div>

        {/* Gargalos / insights */}
        {data.insights.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.insights.map((ins, i) => {
              const n = NIVEL[ins.nivel] ?? NIVEL.info; const Icon = n.icon;
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border p-3.5 ${n.bg}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: n.cor }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{ins.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{ins.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Receita × Despesa × Resultado */}
        <Card title="Receita × Despesa × Resultado" sub="barras = entradas/saídas do mês · linha = resultado (lucro/prejuízo). À direita da linha tracejada é projeção da carteira atual.">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {divisor && <ReferenceLine x={divisor} stroke="#adb5bd" strokeDasharray="4 4" label={{ value: 'projeção →', fontSize: 10, fill: '#adb5bd', position: 'insideTopRight' }} />}
              <Bar name="Receita" dataKey="receita" fill="#2F9E44" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar name="Despesa" dataKey="despesa" fill="#E03131" radius={[0, 0, 3, 3]} maxBarSize={26} />
              <Line name="Resultado" type="monotone" dataKey="resultado" stroke="#228BE6" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Saldo acumulado */}
        <Card title="Saldo acumulado (caixa)" sub="a trajetória do caixa do escritório ao longo do tempo.">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#228BE6" stopOpacity={0.35} /><stop offset="100%" stopColor="#228BE6" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#adb5bd" />
              {divisor && <ReferenceLine x={divisor} stroke="#adb5bd" strokeDasharray="4 4" />}
              <Area name="Saldo acumulado" type="monotone" dataKey="acumulado" stroke="#228BE6" strokeWidth={2} fill="url(#gAcum)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Projeção interativa */}
        <Card
          title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-[#7048E8]" /> Projeção interativa — e se o escritório crescer?</span>}
          sub="arraste para simular novos clientes por mês e veja o caixa reagir. Ponto de equilíbrio calculado da sua carteira."
        >
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Novos clientes por mês</span>
                <span className="tabular-nums font-bold text-[#7048E8]">{novosClientes}</span>
              </div>
              <input type="range" min={0} max={20} value={novosClientes} onChange={(e) => setNovosClientes(+e.target.value)} className="mt-2 w-full accent-[#7048E8]" />
              <div className="mt-1 flex justify-between text-[10px] text-zinc-400"><span>0</span><span>ticket médio {brl(ticket)}/mês · +{brl(novosClientes * ticket)}/mês acumulando</span><span>20</span></div>
            </div>
            <div className="rounded-xl border border-zinc-200/70 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Equilíbrio</p>
              <p className="mt-0.5 text-xl font-bold text-zinc-800 dark:text-zinc-100">{p.clientesEquilibrio} <span className="text-sm font-medium text-zinc-400">cli/mês</span></p>
              <p className="text-[11px] text-zinc-400">~{brl(p.novaReceitaEquilibrio)}/mês de receita nova</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gCen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7048E8" stopOpacity={0.3} /><stop offset="100%" stopColor="#7048E8" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#adb5bd" />
              {divisor && <ReferenceLine x={divisor} stroke="#adb5bd" strokeDasharray="4 4" />}
              <Area name="Caixa — carteira atual" type="monotone" dataKey="acumulado" stroke="#ADB5BD" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
              <Area name={`Caixa — com ${novosClientes} cli/mês`} type="monotone" dataKey="acumuladoCenario" stroke="#7048E8" strokeWidth={2.5} fill="url(#gCen)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Despesas por categoria */}
          <Card title="Despesas por categoria" sub="onde o dinheiro sai.">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <ResponsiveContainer width="100%" height={200} className="!w-1/2">
                <PieChart>
                  <Pie data={data.categorias} dataKey="total" nameKey="nome" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {data.categorias.map((c, i) => <Cell key={i} fill={c.cor} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {data.categorias.map((c) => (
                  <div key={c.nome} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                    <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">{brl(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Top clientes */}
          <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#E64980]" /> Maiores clientes (faturamento)</span>} sub="quem mais já contribuiu com honorários.">
            <ResponsiveContainer width="100%" height={Math.max(200, Math.min(8, data.topClientes.length) * 30)}>
              <BarChart data={data.topClientes.slice(0, 8).map((c) => ({ nome: c.cliente.split(' ').slice(0, 2).join(' '), recebido: c.recebido }))} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#868e96' }} tickFormatter={kbrl} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="recebido" name="Recebido" fill="#E64980" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Lançamentos */}
        <Card
          title="Lançamentos recentes"
          sub={`${data.transacoes.length} lançamentos do Astrea`}
          action={<button onClick={() => setShowTx((v) => !v)} className="text-xs font-semibold text-[#228BE6] hover:underline">{showTx ? 'ocultar' : 'mostrar'}</button>}
        >
          {showTx ? (
            <div className="-mx-1 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
                  <tr><th className="px-2 py-1.5 font-medium">Data</th><th className="px-2 py-1.5 font-medium">Descrição</th><th className="px-2 py-1.5 font-medium">Categoria</th><th className="px-2 py-1.5 text-right font-medium">Valor</th></tr>
                </thead>
                <tbody>
                  {data.transacoes.map((t, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">{t.data}</td>
                      <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300">{t.party || '—'}{t.parcela ? <span className="text-zinc-400"> · {t.parcela}</span> : null}</td>
                      <td className="px-2 py-1.5 text-zinc-500">{t.categoria}</td>
                      <td className={`whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-zinc-400">Clique em "mostrar" para ver os {data.transacoes.length} lançamentos.</p>
          )}
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 pb-2 text-xs text-zinc-400">
          <Sparkles className="h-3.5 w-3.5" /> Reimporte a planilha do Astrea quando quiser atualizar os números.
        </p>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, accent, label, value, hint }: { icon: React.ElementType; accent: string; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${accent}1A`, color: accent }}><Icon className="h-4 w-4" /></span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function Card({ title, sub, action, children }: { title: React.ReactNode; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
