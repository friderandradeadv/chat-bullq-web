'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  CircleDollarSign, TrendingUp, TrendingDown, Scale, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Info, Target, Users, Sparkles, Loader2, Plus, Trash2, X, Search, Receipt,
  ChevronDown, ChevronRight, Table2, Rocket, HeartHandshake, Scissors, Phone, Trophy, Flame, Calendar,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type FinTransacao } from '@/features/financeiro/services/financeiro.service';
import {
  aggregarClientes, mesKey, mesLabel, mesCurtoKey, MESES_PT, STATUS_FIN, type StatusFin, type ClienteFin,
} from '@/features/financeiro/lib/clientes';

const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kbrl = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '-' : ''; return a >= 1000 ? `${s}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${s}${a}`; };
const pct = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const mesCurto = (label: string) => label.replace('/20', '/');
const catColor = (data: FinDashboard, cat: string) => /honor/i.test(cat) ? '#2F9E44' : (data.categorias?.find((c) => c.nome === cat)?.cor ?? '#868E96');

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

type View = 'lancamentos' | 'honorarios' | 'fluxo' | 'crescimento' | 'projecoes' | 'motivacao';
const TABS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: 'lancamentos', label: 'Lançamentos', icon: Receipt },
  { key: 'honorarios', label: 'Honorários', icon: Users },
  { key: 'fluxo', label: 'Fluxo de caixa', icon: Table2 },
  { key: 'crescimento', label: 'Crescimento', icon: TrendingUp },
  { key: 'projecoes', label: 'Projeções', icon: Rocket },
  { key: 'motivacao', label: 'Motivação', icon: HeartHandshake },
];

export default function FinanceiroPage() {
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'dashboard'], queryFn: () => financeiroService.dashboard(), staleTime: 60_000 });
  const [view, setView] = useState<View>('lancamentos');

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
            <p className="mt-1 text-sm text-zinc-500">Espelho do Astrea — lançamentos, honorários, fluxo de caixa, crescimento e projeções do escritório.</p>
          </div>
          {data.geradoEm && <p className="text-xs text-zinc-400">dados de {data.fonte?.split('—')[0]?.trim() || 'Astrea'} · {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>}
        </div>

        {/* KPIs — pulso financeiro sempre visível */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Scale} accent={k.saldoAtual < 0 ? '#E03131' : '#2F9E44'} label={`Saldo acumulado · ${k.mesAtualLabel}`} value={brl(k.saldoAtual)} hint={k.saldoAtual < 0 ? 'caixa no vermelho' : 'caixa positivo'} />
          <Kpi icon={k.resultadoMes >= 0 ? TrendingUp : TrendingDown} accent={k.resultadoMes >= 0 ? '#2F9E44' : '#E03131'} label="Resultado do mês" value={brl(k.resultadoMes)} hint={`receita ${brl(k.receitaMes)} · despesa ${brl(k.despesaMes)}`} />
          <Kpi icon={ArrowUpCircle} accent="#2F9E44" label="Receita (12 meses)" value={brl(k.receita12m)} hint={`média ${brl(k.receitaMedia)}/mês`} />
          <Kpi icon={ArrowDownCircle} accent="#E03131" label="Despesa (12 meses)" value={brl(k.despesa12m)} hint={`fixo ${brl(k.custoFixoMensal)}/mês`} />
        </div>

        {/* Abas estilo Astrea */}
        <div className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-[#DEE2E6] scrollbar-none dark:border-zinc-800">
          {TABS.map((t) => (
            <TabBtn key={t.key} active={view === t.key} onClick={() => setView(t.key)} icon={t.icon}
              count={t.key === 'lancamentos' ? data.resumoLancamentos?.total : undefined}>{t.label}</TabBtn>
          ))}
        </div>

        {view === 'lancamentos' && <LancamentosTab data={data} />}
        {view === 'honorarios' && <HonorariosTab data={data} />}
        {view === 'fluxo' && <FluxoTab data={data} />}
        {view === 'crescimento' && <CrescimentoTab data={data} />}
        {view === 'projecoes' && <ProjecoesTab data={data} />}
        {view === 'motivacao' && <MotivacaoTab data={data} />}

        <p className="mt-6 flex items-center justify-center gap-1.5 pb-2 text-xs text-zinc-400">
          <Sparkles className="h-3.5 w-3.5" /> Reimporte a planilha do Astrea quando quiser atualizar os números — seus lançamentos manuais ficam preservados.
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, count, children }: { active: boolean; onClick: () => void; icon: React.ElementType; count?: number; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
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

function Card({ title, sub, action, children, className }: { title?: React.ReactNode; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-4 rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ''}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ═══════════════════════════ ABA · LANÇAMENTOS (filtrado por mês) ═══════════════

const ABAS = [{ key: 'todos', label: 'Todos' }, { key: 'receitas', label: 'Receitas' }, { key: 'despesas', label: 'Despesas' }] as const;
const hojeBR = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const toBR = (iso: string) => { const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const toISOInput = (br: string) => { const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

function LancamentosTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const mesesDisp = useMemo(() => Array.from(new Set(data.transacoes.map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [data.transacoes]);
  const [mesSel, setMesSel] = useState<string>(mesesDisp[0] ?? '');
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
      if (mesSel && mesKey(t) !== mesSel) return false;
      if (aba === 'receitas' && t.valor < 0) return false;
      if (aba === 'despesas' && t.valor >= 0) return false;
      if (q && !`${t.party ?? ''} ${t.categoria} ${t.data}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.transacoes, mesSel, aba, busca]);

  const grupos = useMemo(() => {
    const map = new Map<string, FinTransacao[]>();
    for (const t of txs) { const key = mesKey(t); if (!map.has(key)) map.set(key, []); map.get(key)!.push(t); }
    return Array.from(map.entries()).map(([key, items]) => {
      const rec = items.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0);
      const desp = items.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0);
      return { key, items, rec, desp, saldo: rec - desp };
    }).sort((a, b) => b.key.localeCompare(a.key));
  }, [txs]);

  const resumo = useMemo(() => ({
    rec: txs.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0),
    desp: txs.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0),
    saldo: txs.reduce((s, t) => s + t.valor, 0),
  }), [txs]);

  const toggle = (key: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const podeSalvar = f.dataISO && f.categoria && Number(f.valor.replace(',', '.')) > 0;

  return (
    <Card title={<>Lançamentos <span className="font-normal text-zinc-400">· livro-razão</span></>}
      action={<button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">{showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Fechar' : 'Novo lançamento'}</button>}>

      {showForm && (
        <div className="mb-3 grid gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30 sm:grid-cols-[auto_auto_1fr_auto_auto]">
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
            <button disabled={!podeSalvar || addM.isPending} onClick={() => addM.mutate()} className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{addM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lançar'}</button>
          </div>
        </div>
      )}

      {/* Filtros: MÊS (principal) + tipo + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="bg-transparent text-sm font-medium capitalize outline-none">
            <option value="">Todos os meses</option>
            {mesesDisp.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
          </select>
        </div>
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {ABAS.map((a) => <button key={a.key} onClick={() => setAba(a.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${aba === a.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{a.label}</button>)}
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
      </div>

      {/* Resumo do filtro */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 py-1.5 dark:bg-emerald-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Receitas</p><p className="text-sm font-bold tabular-nums text-emerald-600">{brl(resumo.rec)}</p></div>
        <div className="rounded-lg bg-rose-50 py-1.5 dark:bg-rose-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Despesas</p><p className="text-sm font-bold tabular-nums text-rose-600">{brl(resumo.desp)}</p></div>
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-zinc-800/40"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Saldo</p><p className={`text-sm font-bold tabular-nums ${resumo.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl(resumo.saldo)}</p></div>
      </div>

      <p className="mt-2 text-xs text-zinc-400">{txs.length} lançamento(s){mesSel ? ` em ${mesLabel(mesSel)}` : ` · ${grupos.length} ${grupos.length === 1 ? 'mês' : 'meses'}`}</p>

      <div className="mt-2 space-y-2">
        {grupos.map((g) => {
          const aberto = !!mesSel || !collapsed.has(g.key);
          return (
            <div key={g.key} className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
              {!mesSel && (
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
              )}
              {aberto && (
                <div>
                  {g.items.map((t) => (
                    <div key={t.id} className="group grid grid-cols-[3.5rem_1fr_auto_2rem] items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-sm dark:border-zinc-800/70 sm:grid-cols-[3.5rem_1fr_10rem_auto_2rem]">
                      <span className="text-xs tabular-nums text-zinc-400">{t.data.slice(0, 5)}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                        <span className="truncate text-zinc-700 dark:text-zinc-300">{t.party || t.categoria}</span>
                        {t.manual ? <span className="shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30">manual</span> : null}
                      </span>
                      <span className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(data, t.categoria) }} /><span className="truncate">{t.categoria}</span></span>
                      <span className={`justify-self-end whitespace-nowrap text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</span>
                      <button onClick={() => { if (confirm('Remover este lançamento?')) delM.mutate(t.id!); }} disabled={delM.isPending} title="Remover" className="justify-self-end rounded p-1 text-zinc-300 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento neste filtro.</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════ ABA · HONORÁRIOS (clientes) ═══════════════════════

const STATUS_ORDER: StatusFin[] = ['em-dia', 'atencao', 'pontual', 'inativo'];

function HonorariosTab({ data }: { data: FinDashboard }) {
  const clientes = useMemo(() => aggregarClientes(data), [data]);
  const [filtro, setFiltro] = useState<'todos' | StatusFin>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const tot = useMemo(() => {
    const recebido = clientes.reduce((s, c) => s + c.recebido, 0);
    const repassado = clientes.reduce((s, c) => s + c.repassado, 0);
    const porStatus = (st: StatusFin) => clientes.filter((c) => c.status === st).length;
    return { recebido, repassado, liquido: recebido - repassado, nClientes: clientes.length, emDia: porStatus('em-dia'), atencao: porStatus('atencao') };
  }, [clientes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => (filtro === 'todos' || c.status === filtro) && (!q || c.nome.toLowerCase().includes(q)));
  }, [clientes, filtro, busca]);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Honorários recebidos" value={brl(tot.recebido)} hint={`${tot.nClientes} clientes`} accent="#2F9E44" />
        <MiniStat label="Repassado / estornado" value={brl(tot.repassado)} hint="saídas de honorários" accent="#868E96" />
        <MiniStat label="Líquido p/ o escritório" value={brl(tot.liquido)} hint="recebido − repassado" accent="#228BE6" />
        <MiniStat label="Em dia / Atenção" value={`${tot.emDia} / ${tot.atencao}`} hint="recorrentes que pararam = atenção" accent="#F59F00" />
      </div>

      <Card title="Carteira de honorários por cliente" sub="vinculado aos lançamentos. Status é comportamental (frequência de pagamento) — o saldo devedor exato vem com o módulo de cobrança."
        action={
          <div className="relative"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="w-44 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
        }>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Chip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos ({clientes.length})</Chip>
          {STATUS_ORDER.map((st) => {
            const n = clientes.filter((c) => c.status === st).length;
            return <Chip key={st} active={filtro === st} onClick={() => setFiltro(st)} cor={STATUS_FIN[st].cor}>{STATUS_FIN[st].label} ({n})</Chip>;
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
          <div className="hidden grid-cols-[1fr_7rem_5rem_6rem_6rem] gap-2 bg-zinc-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/40 sm:grid">
            <span>Cliente</span><span className="text-right">Recebido</span><span className="text-center">Pgtos</span><span className="text-center">Último</span><span className="text-center">Status</span>
          </div>
          {lista.map((c) => {
            const s = STATUS_FIN[c.status]; const exp = aberto === c.nome;
            return (
              <div key={c.nome} className="border-t border-zinc-100 dark:border-zinc-800/70">
                <button onClick={() => setAberto(exp ? null : c.nome)} className="grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-left transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 sm:grid-cols-[1fr_7rem_5rem_6rem_6rem]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {exp ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                    <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{c.nome}</span>
                    {c.recorrente && <span className="hidden shrink-0 rounded bg-violet-100 px-1 text-[9px] font-semibold text-violet-600 dark:bg-violet-900/30 sm:inline">recorrente</span>}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-emerald-600">{brl(c.recebido)}</span>
                  <span className="hidden text-center text-sm tabular-nums text-zinc-500 sm:block">{c.n}</span>
                  <span className="hidden text-center text-xs tabular-nums text-zinc-500 sm:block">{c.ultimo?.slice(0, 5) ?? '—'}</span>
                  <span className="hidden justify-self-center sm:block"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{s.label}</span></span>
                </button>
                {exp && (
                  <div className="border-t border-zinc-100 bg-zinc-50/40 px-3 py-2.5 dark:border-zinc-800/70 dark:bg-zinc-800/20">
                    <div className="mb-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <Info2 label="Total recebido" value={brl2(c.recebido)} />
                      <Info2 label="Nº pagamentos" value={`${c.n}${c.recorrente ? ` · ${c.mesesAtivos} meses` : ''}`} />
                      <Info2 label="Ticket médio" value={brl2(c.medio)} />
                      <Info2 label="Último / primeiro" value={`${c.ultimo ?? '—'} · ${c.primeiro ?? '—'}`} />
                    </div>
                    {c.repassado > 0 && <p className="mb-2 text-[11px] text-zinc-500">Repassado/estornado: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{brl2(c.repassado)}</span></p>}
                    <p className="mb-1.5 text-[11px] text-zinc-400">{s.dica}. Histórico de pagamentos:</p>
                    <div className="max-h-40 space-y-0.5 overflow-y-auto scrollbar-thin">
                      {c.pagamentos.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 text-xs odd:bg-white/60 dark:odd:bg-zinc-900/40">
                          <span className="tabular-nums text-zinc-500">{p.data}</span>
                          <span className="font-semibold tabular-nums text-emerald-600">{brl2(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {lista.length === 0 && <p className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">Nenhum cliente neste filtro.</p>}
        </div>
      </Card>
    </>
  );
}

function MiniStat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
function Info2({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p><p className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">{value}</p></div>;
}
function Chip({ active, onClick, cor, children }: { active: boolean; onClick: () => void; cor?: string; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? 'border-transparent bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700'}`}>{cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} />}{children}</button>;
}

// ═══════════════════════════ ABA · FLUXO DE CAIXA (tabela Astrea) ══════════════

function FluxoTab({ data }: { data: FinDashboard }) {
  const k = data.kpis!;
  const meses = data.meses;
  const realizados = meses.filter((m) => !m.projecao);
  const cats = data.categorias.map((c) => c.nome); // ordenadas por total desc
  const totReceita = realizados.reduce((s, m) => s + m.receita, 0);
  const totCat = (c: string) => realizados.reduce((s, m) => s + (m.despesas?.[c] ?? 0), 0);
  const totDesp = realizados.reduce((s, m) => s + m.despesaTotal, 0);
  const totResultado = totReceita - totDesp;

  const cell = 'px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap';
  const head = 'px-2.5 py-2 text-right whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide';

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Receita média/mês" value={brl(k.receitaMedia)} hint={`${k.totalMesesRealizados} meses realizados`} accent="#2F9E44" />
        <MiniStat label="Despesa média/mês" value={brl(k.despesaMediaMensal)} hint={`fixo ${brl(k.custoFixoMensal)}`} accent="#E03131" />
        <MiniStat label="Margem (12m)" value={pct(k.margem12m)} hint={`resultado ${brl(k.resultado12m)}`} accent={k.margem12m >= 0 ? '#2F9E44' : '#E03131'} />
        <MiniStat label="Meses no vermelho" value={`${k.mesesNoVermelho} / ${k.totalMesesRealizados}`} hint={k.melhorMes ? `melhor: ${k.melhorMes.label}` : ''} accent="#F59F00" />
      </div>

      <Card title="Fluxo de caixa" sub="matriz mensal de receitas e despesas, como no Astrea. Role na horizontal para ver todos os meses; à direita da faixa, projeção.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">Conta</th>
                {meses.map((m) => (
                  <th key={m.key} className={`${head} ${m.projecao ? 'text-zinc-400' : 'text-zinc-500'}`}>{mesCurtoKey(m.key)}{m.projecao ? ' *' : ''}</th>
                ))}
                <th className={`${head} bg-zinc-50 text-zinc-600 dark:bg-zinc-800/40`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Receita */}
              <tr className="border-b border-zinc-100 dark:border-zinc-800/70">
                <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-semibold text-emerald-600 dark:bg-zinc-900">Honorários (receita)</td>
                {meses.map((m) => <td key={m.key} className={`${cell} font-medium text-emerald-600 ${m.projecao ? 'opacity-60' : ''}`}>{m.receita ? brl(m.receita) : '—'}</td>)}
                <td className={`${cell} bg-zinc-50 font-bold text-emerald-700 dark:bg-zinc-800/40`}>{brl(totReceita)}</td>
              </tr>
              {/* Despesas por categoria */}
              {cats.map((c) => (
                <tr key={c} className="border-b border-zinc-100 dark:border-zinc-800/70">
                  <td className="sticky left-0 z-10 flex items-center gap-1.5 bg-white px-2.5 py-1.5 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"><span className="h-2 w-2 rounded-full" style={{ background: catColor(data, c) }} />{c}</td>
                  {meses.map((m) => { const v = m.despesas?.[c] ?? 0; return <td key={m.key} className={`${cell} text-zinc-500 ${m.projecao ? 'opacity-60' : ''}`}>{v ? brl(v) : '·'}</td>; })}
                  <td className={`${cell} bg-zinc-50 font-semibold text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300`}>{brl(totCat(c))}</td>
                </tr>
              ))}
              {/* Total despesas */}
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-semibold text-rose-600 dark:bg-zinc-900">Total despesas</td>
                {meses.map((m) => <td key={m.key} className={`${cell} font-medium text-rose-600 ${m.projecao ? 'opacity-60' : ''}`}>{m.despesaTotal ? brl(m.despesaTotal) : '—'}</td>)}
                <td className={`${cell} bg-zinc-50 font-bold text-rose-700 dark:bg-zinc-800/40`}>{brl(totDesp)}</td>
              </tr>
              {/* Resultado */}
              <tr className="border-b border-zinc-100 dark:border-zinc-800/70">
                <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">Resultado do mês</td>
                {meses.map((m) => <td key={m.key} className={`${cell} font-semibold ${m.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'} ${m.projecao ? 'opacity-60' : ''}`}>{brl(m.resultado)}</td>)}
                <td className={`${cell} bg-zinc-50 font-bold dark:bg-zinc-800/40 ${totResultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{brl(totResultado)}</td>
              </tr>
              {/* Saldo acumulado */}
              <tr>
                <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">Saldo acumulado</td>
                {meses.map((m) => <td key={m.key} className={`${cell} font-semibold ${m.acumulado >= 0 ? 'text-emerald-600' : 'text-rose-600'} ${m.projecao ? 'opacity-60' : ''}`}>{brl(m.acumulado)}</td>)}
                <td className={`${cell} bg-zinc-50 dark:bg-zinc-800/40`}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">* meses com projeção (carteira atual, conforme as parcelas de honorários já contratadas).</p>
      </Card>
    </>
  );
}

// ═══════════════════════════ ABA · CRESCIMENTO ═════════════════════════════════

function CrescimentoTab({ data }: { data: FinDashboard }) {
  const realizados = data.meses.filter((m) => !m.projecao);
  const serie = realizados.map((m, i) => {
    const prev = realizados[i - 1];
    const mom = prev && prev.receita > 0 ? ((m.receita - prev.receita) / prev.receita) * 100 : null;
    return { nome: mesCurto(m.label), receita: m.receita, resultado: m.resultado, mom, label: m.label, key: m.key };
  });
  const receitaTotal = realizados.reduce((s, m) => s + m.receita, 0);
  const mesesComLucro = realizados.filter((m) => m.resultado > 0).length;
  const ult3 = realizados.slice(-3).reduce((s, m) => s + m.receita, 0) / Math.min(3, realizados.length || 1);
  const ant3arr = realizados.slice(-6, -3);
  const ant3 = ant3arr.length ? ant3arr.reduce((s, m) => s + m.receita, 0) / ant3arr.length : 0;
  const cresc3 = ant3 > 0 ? ((ult3 - ant3) / ant3) * 100 : 0;
  const maior = [...realizados].sort((a, b) => b.receita - a.receita)[0];
  const momMedio = (() => { const vs = serie.map((s) => s.mom).filter((v): v is number => v != null); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0; })();

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Receita acumulada" value={brl(receitaTotal)} hint={`${realizados.length} meses de história`} accent="#2F9E44" />
        <MiniStat label="Maior faturamento" value={brl(maior?.receita ?? 0)} hint={maior?.label} accent="#7048E8" />
        <MiniStat label="Crescimento médio/mês" value={pct(momMedio)} hint="variação média mês a mês" accent={momMedio >= 0 ? '#2F9E44' : '#E03131'} />
        <MiniStat label="Meses com lucro" value={`${mesesComLucro} / ${realizados.length}`} hint={`${Math.round((mesesComLucro / (realizados.length || 1)) * 100)}% dos meses`} accent="#228BE6" />
      </div>

      <Card title={`Últimos 3 meses vs 3 anteriores`} sub="a tendência recente da receita do escritório.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{brl(ult3)}</span>
            <span className="text-xs text-zinc-400">média/mês agora</span>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${cresc3 >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
            {cresc3 >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{pct(cresc3)}
          </span>
          <span className="text-xs text-zinc-400">vs {brl(ant3)}/mês no trimestre anterior</span>
        </div>
      </Card>

      <Card title="Receita mês a mês" sub="barras = faturamento · linha = resultado (lucro/prejuízo).">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={48} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="Receita" dataKey="receita" fill="#2F9E44" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line name="Resultado" type="monotone" dataKey="resultado" stroke="#228BE6" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Variação mês a mês (%)" sub="quanto a receita subiu ou caiu em relação ao mês anterior.">
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900"><tr><th className="px-2 py-1.5 font-medium">Mês</th><th className="px-2 py-1.5 text-right font-medium">Receita</th><th className="px-2 py-1.5 text-right font-medium">Variação</th></tr></thead>
            <tbody>
              {[...serie].reverse().map((s) => (
                <tr key={s.key} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5 capitalize text-zinc-600 dark:text-zinc-300">{s.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-200">{brl(s.receita)}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${s.mom == null ? 'text-zinc-300' : s.mom >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.mom == null ? '—' : pct(s.mom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ═══════════════════════════ ABA · PROJEÇÕES ══════════════════════════════════

function simula(meses: FinDashboard['meses'], ticket: number, x: number) {
  const realizados = meses.filter((m) => !m.projecao);
  const futuros = meses.filter((m) => m.projecao);
  let acum = realizados.length ? realizados[realizados.length - 1].acumulado : 0;
  let extra = 0; let mesAzul: string | null = null;
  const pts = futuros.map((m) => {
    extra += x * ticket;
    const res = (m.receita + extra) - m.despesaTotal;
    acum += res;
    if (mesAzul == null && acum >= 0) mesAzul = m.label;
    return { nome: mesCurto(m.label), acumuladoCenario: Math.round(acum) };
  });
  return { acumFinal: Math.round(acum), mesAzul, pts };
}

function ProjecoesTab({ data }: { data: FinDashboard }) {
  const p = data.projecao!;
  const ticket = p.ticketMedio || 250;
  const [x, setX] = useState(p.clientesEquilibrio || 3);

  const chartData = useMemo(() => {
    const sim = simula(data.meses, ticket, x);
    const byNome = new Map(sim.pts.map((pt) => [pt.nome, pt.acumuladoCenario]));
    return data.meses.map((m) => ({ nome: mesCurto(m.label), acumulado: m.acumulado, acumuladoCenario: m.projecao ? (byNome.get(mesCurto(m.label)) ?? null) : m.acumulado, projecao: m.projecao }));
  }, [data.meses, ticket, x]);
  const divisor = (() => { const i = chartData.findIndex((d) => d.projecao); return i > 0 ? chartData[i - 1]?.nome : undefined; })();

  const cenarios = [
    { nome: 'Sem novos clientes', x: 0, cor: '#E03131', desc: 'só a carteira atual' },
    { nome: 'Ponto de equilíbrio', x: p.clientesEquilibrio || 3, cor: '#F59F00', desc: 'o mínimo para não afundar' },
    { nome: 'Crescimento', x: (p.clientesEquilibrio || 3) + 3, cor: '#2F9E44', desc: 'aquisição firme' },
  ].map((c) => ({ ...c, ...simula(data.meses, ticket, c.x) }));

  return (
    <>
      <div className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 dark:border-violet-900/40 dark:from-violet-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Rocket className="h-5 w-5 text-[#7048E8]" /> A esperança tem número</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          A carteira atual ({p.mesesProjetados} meses à frente) leva o caixa a <strong className={p.acumuladoFinalProj < 0 ? 'text-rose-600' : 'text-emerald-600'}>{brl(p.acumuladoFinalProj)}</strong>.
          Mas isso é só inércia. Cada novo cliente ao ticket médio de <strong>{brl(ticket)}</strong> empurra essa curva para cima — e o ponto de virada está a <strong>{p.clientesEquilibrio} cliente(s)/mês</strong> de distância.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cenarios.map((c) => (
          <div key={c.nome} className="rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} /><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{c.nome}</p></div>
            <p className="mt-0.5 text-[11px] text-zinc-400">+{c.x} cli/mês · {c.desc}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: c.acumFinal >= 0 ? '#2F9E44' : '#E03131' }}>{brl(c.acumFinal)}</p>
            <p className="text-[11px] text-zinc-400">caixa ao fim da projeção</p>
            <p className="mt-1.5 text-xs font-medium" style={{ color: c.mesAzul ? '#2F9E44' : '#868E96' }}>{c.mesAzul ? `🟢 azul em ${c.mesAzul}` : '🔴 não sai do vermelho no período'}</p>
          </div>
        ))}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-[#7048E8]" /> Simulador interativo</span>}
        sub="arraste para simular novos clientes por mês e veja o caixa reagir.">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-sm"><span className="font-medium text-zinc-700 dark:text-zinc-200">Novos clientes por mês</span><span className="tabular-nums font-bold text-[#7048E8]">{x}</span></div>
            <input type="range" min={0} max={20} value={x} onChange={(e) => setX(+e.target.value)} className="mt-2 w-full accent-[#7048E8]" />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-400"><span>0</span><span>ticket {brl(ticket)} · +{brl(x * ticket)}/mês acumulando</span><span>20</span></div>
          </div>
          <div className="rounded-xl border border-zinc-200/70 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Equilíbrio</p>
            <p className="mt-0.5 text-xl font-bold text-zinc-800 dark:text-zinc-100">{p.clientesEquilibrio} <span className="text-sm font-medium text-zinc-400">cli/mês</span></p>
            <p className="text-[11px] text-zinc-400">~{brl(p.novaReceitaEquilibrio)}/mês de receita nova</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs><linearGradient id="gCen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7048E8" stopOpacity={0.3} /><stop offset="100%" stopColor="#7048E8" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={48} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#adb5bd" />
            {divisor && <ReferenceLine x={divisor} stroke="#adb5bd" strokeDasharray="4 4" label={{ value: 'projeção →', fontSize: 10, fill: '#adb5bd', position: 'insideTopRight' }} />}
            <Area name="Caixa — carteira atual" type="monotone" dataKey="acumulado" stroke="#ADB5BD" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
            <Area name={`Caixa — com ${x} cli/mês`} type="monotone" dataKey="acumuladoCenario" stroke="#7048E8" strokeWidth={2.5} fill="url(#gCen)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

// ═══════════════════════════ ABA · MOTIVAÇÃO ══════════════════════════════════

const FRASES = [
  'Todo grande escritório já foi um caixa apertado com um advogado teimoso o bastante para não desistir.',
  'O vermelho de hoje é o combustível da virada de amanhã — desde que você não tire o pé.',
  'Você não está com dificuldade financeira; você está construindo uma estrutura que ainda vai te sustentar por décadas.',
  'Cada cliente bem atendido hoje é uma indicação na semana que vem. Plante.',
  'Disciplina no caixa é o que separa o escritório que sonha do escritório que dura.',
  'A conta que não fecha no fim do mês fecha no fim do ano — se a aquisição não parar.',
];

function MotivacaoTab({ data }: { data: FinDashboard }) {
  const k = data.kpis!; const p = data.projecao!;
  const [fraseIdx, setFraseIdx] = useState(0);
  const clientes = useMemo(() => aggregarClientes(data), [data]);
  const atencao = clientes.filter((c) => c.status === 'atencao');
  const reativavel = Math.round(atencao.reduce((s, c) => s + c.medio, 0));
  const maiorDespesa = data.categorias[0];
  const cut20 = maiorDespesa ? Math.round(maiorDespesa.total * 0.2) : 0;
  const proxAzul = simula(data.meses, p.ticketMedio || 250, p.clientesEquilibrio || 3).mesAzul;

  const sugestoes = [
    maiorDespesa && {
      icon: Scissors, cor: '#F76707', titulo: `Revisar "${maiorDespesa.nome}"`,
      texto: `É sua maior despesa (${brl(maiorDespesa.total)} no período). Cortar 20% libera ~${brl(cut20)} — caixa que volta direto pro azul.`,
    },
    atencao.length > 0 && {
      icon: Phone, cor: '#F59F00', titulo: `Cobrar ${atencao.length} cliente(s) que pararam de pagar`,
      texto: `Vinham pagando todo mês e sumiram. Uma conversa pode reativar ~${brl(reativavel)}/mês: ${atencao.slice(0, 3).map((c) => c.nome.split(' ').slice(0, 2).join(' ')).join(', ')}${atencao.length > 3 ? ' e outros' : ''}.`,
    },
    k.maiorReceita && {
      icon: Trophy, cor: '#2F9E44', titulo: 'Reativar a aquisição',
      texto: `Seu melhor mês foi ${k.maiorReceita.label} com ${brl(k.maiorReceita.receita)}. A capacidade existe — repetir aquele ritmo de captação muda o jogo.`,
    },
    {
      icon: Target, cor: '#228BE6', titulo: 'Mire o ponto de equilíbrio',
      texto: `Faltam ~${brl(p.novaReceitaEquilibrio)}/mês de receita nova — cerca de ${p.clientesEquilibrio} cliente(s)/mês ao ticket de ${brl(p.ticketMedio)}. ${proxAzul ? `Mantendo isso, o caixa fica azul em ${proxAzul}.` : ''}`,
    },
  ].filter(Boolean) as { icon: React.ElementType; cor: string; titulo: string; texto: string }[];

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 dark:border-zinc-800 dark:from-amber-900/15 dark:via-zinc-900 dark:to-emerald-900/15">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-600"><Flame className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{FRASES[fraseIdx]}</p>
            <button onClick={() => setFraseIdx((i) => (i + 1) % FRASES.length)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#7048E8] hover:underline"><Sparkles className="h-3.5 w-3.5" /> Me motive de novo</button>
          </div>
        </div>
      </div>

      {/* Meta: sair do vermelho */}
      <Card title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-600" /> Meta do escritório: caixa no azul</span>}
        sub={k.saldoAtual < 0 ? 'o caixa está negativo — eis o caminho de volta.' : 'caixa positivo, agora é fazer crescer.'}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Hoje</p><p className={`text-2xl font-bold tabular-nums ${k.saldoAtual < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{brl(k.saldoAtual)}</p></div>
          <ChevronRight className="h-5 w-5 text-zinc-300" />
          <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Meta</p><p className="text-2xl font-bold tabular-nums text-emerald-600">R$ 0+</p></div>
          <div className="ml-auto max-w-xs text-right text-sm text-zinc-500">
            {proxAzul ? <>Com <strong className="text-zinc-700 dark:text-zinc-200">{p.clientesEquilibrio} cliente(s)/mês</strong>, o caixa cruza o zero em <strong className="text-emerald-600">{proxAzul}</strong>.</> : <>Acelere a aquisição para o caixa voltar ao azul dentro do horizonte projetado.</>}
          </div>
        </div>
      </Card>

      <Card title="Sugestões para a virada" sub="ações concretas, tiradas dos seus próprios números.">
        <div className="grid gap-3 sm:grid-cols-2">
          {sugestoes.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}><s.icon className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.titulo}</p><p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{s.texto}</p></div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
