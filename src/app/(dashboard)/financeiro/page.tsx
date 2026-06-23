'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, BarChart,
} from 'recharts';
import {
  CircleDollarSign, TrendingUp, TrendingDown, Scale, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Info, Target, Users, Sparkles, Loader2, Plus, Trash2, X, Search, Receipt,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type FinTransacao } from '@/features/financeiro/services/financeiro.service';

const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kbrl = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '-' : ''; return a >= 1000 ? `${s}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${s}${a}`; };
const mesCurto = (label: string) => label.replace('/20', '/');

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const mesLabel = (mes: string) => { const m = (mes || '').match(/(\d{4})-(\d{2})/); return m ? `${MESES_PT[+m[2] - 1]} de ${m[1]}` : (mes || 'Sem data'); };
// Cor da categoria — receita (Honorários) em verde; despesas puxam a cor do donut; fallback cinza.
const catColor = (data: FinDashboard, cat: string) => {
  if (/honor/i.test(cat)) return '#2F9E44';
  return data.categorias?.find((c) => c.nome === cat)?.cor ?? '#868E96';
};

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
  const [view, setView] = useState<'lancamentos' | 'fluxo'>('lancamentos');

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;

  if (!data || data.vazio || !data.kpis) {
    return (
      <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100"><CircleDollarSign className="h-6 w-6 text-emerald-600" /> Financeiro</h1>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
            Ainda não importamos seus dados financeiros do Astrea. Assim que o snapshot for carregado, o painel completo aparece aqui.
          </div>
        </div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CircleDollarSign className="h-5 w-5" /></span>
              Financeiro
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Espelho do Astrea — lançamentos, fluxo de caixa, crescimento e gargalos do escritório.</p>
          </div>
          {data.geradoEm && <p className="text-xs text-zinc-400">dados de {data.fonte?.split('—')[0]?.trim() || 'Astrea'} · {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>}
        </div>

        {/* KPIs — pulso financeiro sempre visível no topo */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Scale} accent={k.saldoAtual < 0 ? '#E03131' : '#2F9E44'} label={`Saldo acumulado · ${k.mesAtualLabel}`} value={brl(k.saldoAtual)} hint={k.saldoAtual < 0 ? 'caixa no vermelho' : 'caixa positivo'} />
          <Kpi icon={k.resultadoMes >= 0 ? TrendingUp : TrendingDown} accent={k.resultadoMes >= 0 ? '#2F9E44' : '#E03131'} label="Resultado do mês" value={brl(k.resultadoMes)} hint={`receita ${brl(k.receitaMes)} · despesa ${brl(k.despesaMes)}`} />
          <Kpi icon={ArrowUpCircle} accent="#2F9E44" label="Receita (12 meses)" value={brl(k.receita12m)} hint={`média ${brl(k.receitaMedia)}/mês`} />
          <Kpi icon={ArrowDownCircle} accent="#E03131" label="Despesa (12 meses)" value={brl(k.despesa12m)} hint={`fixo ${brl(k.custoFixoMensal)}/mês`} />
        </div>

        {/* Abas estilo Astrea — Lançamentos (padrão) | Fluxo de caixa */}
        <div className="mt-5 flex items-center gap-1 border-b border-[#DEE2E6] dark:border-zinc-800">
          <TabBtn active={view === 'lancamentos'} onClick={() => setView('lancamentos')} icon={Receipt} count={data.resumoLancamentos?.total}>Lançamentos</TabBtn>
          <TabBtn active={view === 'fluxo'} onClick={() => setView('fluxo')} icon={TrendingUp}>Fluxo de caixa</TabBtn>
        </div>

        {view === 'lancamentos' ? <Lancamentos data={data} /> : <FluxoDeCaixa data={data} />}

        <p className="mt-6 flex items-center justify-center gap-1.5 pb-2 text-xs text-zinc-400">
          <Sparkles className="h-3.5 w-3.5" /> Reimporte a planilha do Astrea quando quiser atualizar os números — seus lançamentos manuais ficam preservados.
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, count, children }: { active: boolean; onClick: () => void; icon: React.ElementType; count?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {count != null && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${active ? 'bg-[#228BE6]/10 text-[#228BE6]' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>{count}</span>}
    </button>
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

// ─── Aba "Fluxo de caixa" — gargalos + gráficos + projeção interativa ──────────

function FluxoDeCaixa({ data }: { data: FinDashboard }) {
  const [novosClientes, setNovosClientes] = useState(3);
  const meses = data.meses ?? [];
  const ticket = data.projecao?.ticketMedio || 250;

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
  const p = data.projecao!;

  return (
    <>
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
    </>
  );
}

// ─── Aba "Lançamentos" — livro-razão editável, agrupado por mês ────────────────

const ABAS = [
  { key: 'todos', label: 'Todos' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'despesas', label: 'Despesas' },
] as const;
const hojeBR = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const toBR = (iso: string) => { const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const toISOInput = (br: string) => { const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

interface Grupo { key: string; items: FinTransacao[]; rec: number; desp: number; saldo: number }

function Lancamentos({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<'todos' | 'receitas' | 'despesas'>('todos');
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [f, setF] = useState({ dataISO: toISOInput(hojeBR()), tipo: 'receita' as 'receita' | 'despesa', categoria: 'Honorários', party: '', valor: '' });

  const cats = data.categoriasConhecidas ?? ['Honorários', 'Aluguel', 'Suprimentos escritório', 'Contador', 'Anuidade OAB', 'GPS - INSS', 'Pró-labore', 'Outros'];

  const addM = useMutation({
    mutationFn: () => financeiroService.addTransacao({ data: toBR(f.dataISO), tipo: f.tipo, categoria: f.categoria, valor: Number(f.valor.replace(',', '.')) || 0, party: f.party }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success('Lançamento adicionado'); setShowForm(false); setF((p) => ({ ...p, party: '', valor: '' })); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao lançar'),
  });
  const delM = useMutation({
    mutationFn: (id: string) => financeiroService.removeTransacao(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success('Lançamento removido'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const txs = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.transacoes.filter((t) => {
      if (aba === 'receitas' && t.valor < 0) return false;
      if (aba === 'despesas' && t.valor >= 0) return false;
      if (q && !`${t.party ?? ''} ${t.categoria} ${t.data}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.transacoes, aba, busca]);

  // Agrupa por mês (YYYY-MM), mais recente primeiro, com subtotais por mês.
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, FinTransacao[]>();
    for (const t of txs) {
      const key = t.mes || '0000-00';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries())
      .map(([key, items]) => {
        const rec = items.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0);
        const desp = items.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0);
        return { key, items, rec, desp, saldo: rec - desp };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [txs]);

  const resumo = useMemo(() => ({
    rec: txs.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0),
    desp: txs.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0),
    saldo: txs.reduce((s, t) => s + t.valor, 0),
  }), [txs]);

  const toggle = (key: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const podeSalvar = f.dataISO && f.categoria && Number(f.valor.replace(',', '.')) > 0;

  return (
    <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Lançamentos <span className="font-normal text-zinc-400">· livro-razão por mês</span></h2>
          <p className="mt-0.5 text-xs text-zinc-400">{resumo.rec || resumo.desp ? `${txs.length} lançamento(s) · ${grupos.length} ${grupos.length === 1 ? 'mês' : 'meses'}` : 'sem lançamentos no filtro'}</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Fechar' : 'Novo lançamento'}
        </button>
      </div>

      {/* Form de novo lançamento */}
      {showForm && (
        <div className="mt-3 grid gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30 sm:grid-cols-[auto_auto_1fr_auto_auto]">
          <input type="date" value={f.dataISO} onChange={(e) => setF({ ...f, dataISO: e.target.value })} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
            {(['receita', 'despesa'] as const).map((tp) => (
              <button key={tp} onClick={() => setF({ ...f, tipo: tp, categoria: tp === 'receita' ? 'Honorários' : 'Aluguel' })} className={`px-3 py-1.5 text-xs font-semibold capitalize ${f.tipo === tp ? (tp === 'receita' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{tp}</button>
            ))}
          </div>
          <input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} placeholder="Cliente / descrição" className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
            <button disabled={!podeSalvar || addM.isPending} onClick={() => addM.mutate()} className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              {addM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lançar'}
            </button>
          </div>
        </div>
      )}

      {/* Abas + busca */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {ABAS.map((a) => (
            <button key={a.key} onClick={() => setAba(a.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${aba === a.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{a.label}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-44 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
      </div>

      {/* Resumo do filtro (período inteiro) */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 py-1.5 dark:bg-emerald-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Receitas</p><p className="text-sm font-bold tabular-nums text-emerald-600">{brl(resumo.rec)}</p></div>
        <div className="rounded-lg bg-rose-50 py-1.5 dark:bg-rose-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Despesas</p><p className="text-sm font-bold tabular-nums text-rose-600">{brl(resumo.desp)}</p></div>
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-zinc-800/40"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Saldo</p><p className={`text-sm font-bold tabular-nums ${resumo.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl(resumo.saldo)}</p></div>
      </div>

      {/* Grupos por mês */}
      <div className="mt-3 max-h-[36rem] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {grupos.map((g) => {
          const aberto = !collapsed.has(g.key);
          return (
            <div key={g.key} className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
              {/* Cabeçalho do mês com subtotais */}
              <button onClick={() => toggle(g.key)} className="flex w-full items-center gap-2 bg-zinc-50/80 px-3 py-2 text-left transition hover:bg-zinc-100/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                {aberto ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                <span className="text-sm font-semibold capitalize text-zinc-700 dark:text-zinc-200">{mesLabel(g.key)}</span>
                <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700/70">{g.items.length}</span>
                <div className="ml-auto flex items-center gap-2.5 text-xs tabular-nums sm:gap-3.5">
                  <span className="hidden text-emerald-600 sm:inline">+{brl(g.rec)}</span>
                  <span className="hidden text-rose-600 sm:inline">−{brl(g.desp)}</span>
                  <span className={`font-semibold ${g.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl(g.saldo)}</span>
                </div>
              </button>

              {/* Linhas do mês */}
              {aberto && (
                <div>
                  {g.items.map((t) => (
                    <div key={t.id} className="group grid grid-cols-[3.5rem_1fr_auto_2rem] items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-sm dark:border-zinc-800/70 sm:grid-cols-[3.5rem_1fr_10rem_auto_2rem]">
                      <span className="text-xs tabular-nums text-zinc-400">{t.data.slice(0, 5)}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                        <span className="truncate text-zinc-700 dark:text-zinc-300">{t.party || t.categoria}</span>
                        {t.parcela ? <span className="shrink-0 text-[11px] text-zinc-400">· {t.parcela}</span> : null}
                        {t.manual ? <span className="shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30">manual</span> : null}
                      </span>
                      <span className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(data, t.categoria) }} />
                        <span className="truncate">{t.categoria}</span>
                      </span>
                      <span className={`justify-self-end whitespace-nowrap text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</span>
                      <button onClick={() => { if (confirm('Remover este lançamento?')) delM.mutate(t.id!); }} disabled={delM.isPending} title="Remover" className="justify-self-end rounded p-1 text-zinc-300 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento{busca ? ' para a busca' : aba !== 'todos' ? ` em ${aba}` : ''}.</p>}
      </div>
    </div>
  );
}
