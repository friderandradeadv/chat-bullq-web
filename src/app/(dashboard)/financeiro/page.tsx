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
  Pencil, Check, Layers, Gavel, Landmark, ExternalLink, Wallet, UserCircle2, Banknote, CreditCard, AlertCircle, CalendarClock,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type FinTransacao, type TxStatus, type AddTransacaoInput, type UpdateTransacaoInput, type Cobranca } from '@/features/financeiro/services/financeiro.service';
import { legalCasesService, type CumprimentoFinanceiro } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import {
  aggregarClientes, aggregarRetiradas, normNome, mesKey, mesLabel, mesCurtoKey, MESES_PT, STATUS_FIN, type StatusFin, type ClienteFin,
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

type View = 'lancamentos' | 'honorarios' | 'cobrancas' | 'cumprimento' | 'retiradas' | 'contas' | 'fluxo' | 'crescimento' | 'projecoes' | 'motivacao';
const TABS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: 'lancamentos', label: 'Lançamentos', icon: Receipt },
  { key: 'honorarios', label: 'Honorários', icon: Users },
  { key: 'cobrancas', label: 'Cobranças', icon: CreditCard },
  { key: 'cumprimento', label: 'CS', icon: Gavel },
  { key: 'retiradas', label: 'Retiradas', icon: Wallet },
  { key: 'contas', label: 'Contas', icon: Banknote },
  { key: 'fluxo', label: 'Fluxo de caixa', icon: Table2 },
  { key: 'crescimento', label: 'Crescimento', icon: TrendingUp },
  { key: 'projecoes', label: 'Projeções', icon: Rocket },
  { key: 'motivacao', label: 'Motivação', icon: HeartHandshake },
];

// Produto cru do card (RMC, RCC, "CS - RMC", Contribuições, 7780-Indenização…)
// → Área jurídica (Bancário/Previdenciário/Trabalhista/Consumidor/Cível).
// Espelha areaFromProduto do backend (legal-phases.ts) para o filtro agrupar bonito.
const upperNoAcc = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function areaJuridica(produto?: string | null): string {
  const s = upperNoAcc(produto);
  if (!s) return 'Cível';
  if (/TRABALH|RESCIS|FERIAS|RECLAMA|VERBAS/.test(s)) return 'Trabalhista';
  if (/BPC|LOAS|APOSENTAD|BENEFICIO|PREVID|AUXILIO|INSS/.test(s)) return 'Previdenciário';
  if (/RMC|RCC|PORTABIL|REVISIONAL|CONSIGNAD|CONTRIBUI|TARIFA|SEGURO|EMPRESTIM|BANC|CARTAO/.test(s)) return 'Bancário';
  if (/CONSUMID|DANO|INDENIZ|VOO|FRAUDE|INSCRICAO|NULID|OBRIGACAO|MONITORIA|ANULA/.test(s)) return 'Consumidor';
  return 'Cível';
}

export default function FinanceiroPage() {
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'dashboard'], queryFn: () => financeiroService.dashboard(), staleTime: 60_000 });
  const [view, setView] = useState<View>('lancamentos');

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;

  if (data?.semAcesso) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f5f6f8] p-6 dark:bg-zinc-950">
        <div className="max-w-md rounded-2xl border border-[#DEE2E6] bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><CircleDollarSign className="h-6 w-6" /></span>
          <h1 className="mt-3 text-lg font-bold text-zinc-800 dark:text-zinc-100">Financeiro restrito</h1>
          <p className="mt-1 text-sm text-zinc-500">Você não tem acesso ao módulo financeiro. Fale com o administrador do escritório se precisar.</p>
        </div>
      </div>
    );
  }
  if (data?.limited) return <FinanceiroLimitado data={data} />;

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
            <p className="mt-1 text-sm text-zinc-500">Lançamentos, honorários, fluxo de caixa, crescimento e projeções do escritório.</p>
          </div>
          {data.geradoEm && <p className="text-xs text-zinc-400">atualizado em {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>}
        </div>

        {/* KPIs — pulso financeiro sempre visível */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Scale} accent={k.saldoAtual < 0 ? '#E03131' : '#2F9E44'} label={`Saldo acumulado · ${k.mesAtualLabel}`} value={brl(k.saldoAtual)} hint={k.saldoAtual < 0 ? 'caixa no vermelho' : 'caixa positivo'} />
          <Kpi icon={k.resultadoMes >= 0 ? TrendingUp : TrendingDown} accent={k.resultadoMes >= 0 ? '#2F9E44' : '#E03131'} label="Resultado do mês" value={brl(k.resultadoMes)} hint={`receita ${brl(k.receitaMes)} · despesa ${brl(k.despesaMes)}`} />
          <Kpi icon={ArrowUpCircle} accent="#2F9E44" label="Receita (12 meses)" value={brl(k.receita12m)} hint={`média ${brl(k.receitaMedia)}/mês`} />
          <Kpi icon={ArrowDownCircle} accent="#E03131" label="Despesa (12 meses)" value={brl(k.despesa12m)} hint={`fixo ${brl(k.custoFixoMensal)}/mês`} />
        </div>

        {/* Abas estilo Astrea — sempre em UMA linha; rolam na horizontal em telas estreitas */}
        <div className="mt-5 border-b border-[#DEE2E6] dark:border-zinc-800">
          <div className="flex items-center gap-x-1 overflow-x-auto pb-px scrollbar-thin [scrollbar-width:thin]">
            {TABS.map((t) => (
              <TabBtn key={t.key} active={view === t.key} onClick={() => setView(t.key)} icon={t.icon}
                count={t.key === 'lancamentos' ? data.resumoLancamentos?.total : undefined}>{t.label}</TabBtn>
            ))}
          </div>
        </div>

        {view === 'lancamentos' && <LancamentosTab data={data} />}
        {view === 'honorarios' && <HonorariosTab data={data} />}
        {view === 'cobrancas' && <CobrancasTab data={data} />}
        {view === 'cumprimento' && <CumprimentoTab />}
        {view === 'retiradas' && <RetiradasTab data={data} />}
        {view === 'contas' && <ContasTab data={data} />}
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
const ST_FILTROS = [{ key: 'todos', label: 'Todos' }, { key: 'a_receber', label: 'A receber/pagar' }, { key: 'liquidado', label: 'Liquidados' }] as const;
const hojeBR = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const toBR = (iso: string) => { const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const toISOInput = (br: string) => { const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const parseValor = (s: string) => Number(String(s).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;

const STATUS_TX: Record<TxStatus, { label: string; badge: string; cor: string }> = {
  a_receber: { label: 'A receber', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  recebido: { label: 'Recebido', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300', cor: '#2F9E44' },
  a_pagar: { label: 'A pagar', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  pago: { label: 'Pago', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', cor: '#868E96' },
};
const txStatus = (t: FinTransacao): TxStatus => t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
const ehLiquidado = (s: TxStatus) => s === 'recebido' || s === 'pago';

interface SplitRow { tipo: 'socio' | 'associado'; userId: string; valor: string }
interface Editor {
  id: string | null; serieId: string | null; tipo: 'receita' | 'despesa';
  dataISO: string; vencISO: string; pagtoISO: string;
  categoria: string; pagador: string; recebedor: string; valor: string;
  status: TxStatus; parcelas: string; escopo: 'uma' | 'proximas'; split: SplitRow[];
  responsavelId: string; conta: string;
}

function LancamentosTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const mesesDisp = useMemo(() => Array.from(new Set(data.transacoes.map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [data.transacoes]);
  const [mesSel, setMesSel] = useState<string>(mesesDisp[0] ?? '');
  const [aba, setAba] = useState<'todos' | 'receitas' | 'despesas'>('todos');
  const [stFiltro, setStFiltro] = useState<'todos' | 'a_receber' | 'liquidado'>('todos');
  const [respFiltro, setRespFiltro] = useState('');
  const [contaFiltro, setContaFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [serieDel, setSerieDel] = useState<FinTransacao | null>(null);

  const cats = data.categoriasConhecidas ?? ['Honorários', 'Aluguel', 'Suprimentos escritório', 'Contador', 'Anuidade OAB', 'GPS - INSS', 'Pró-labore', 'Outros'];
  const contas = data.contas ?? [];
  const contaNome = (id?: string | null) => contas.find((c) => c.id === id)?.nome ?? null;
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advogados = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  // cliente → responsável (do processo) para sugestão automática nos honorários
  const { data: juri } = useQuery({ queryKey: ['jurimetria'], queryFn: () => legalCasesService.jurimetria(), staleTime: 300_000 });
  const clienteResp = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of juri?.rows ?? []) if (r.cliente && r.responsavel) m.set(normNome(r.cliente), r.responsavel);
    return m;
  }, [juri]);
  const sugereResp = (pagador: string) => {
    const nome = clienteResp.get(normNome(pagador || ''));
    if (!nome) return '';
    return advogados.find((a) => normNome(a.name) === normNome(nome))?.id ?? '';
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });

  const addM = useMutation({ mutationFn: (i: AddTransacaoInput) => financeiroService.addTransacao(i), onSuccess: (r) => { invalidate(); toast.success(r.criados > 1 ? `${r.criados} parcelas lançadas` : 'Lançamento adicionado'); setEditor(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao lançar') });
  const updM = useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateTransacaoInput }) => financeiroService.updateTransacao(id, input), onSuccess: () => { invalidate(); toast.success('Lançamento atualizado'); setEditor(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar') });
  const delM = useMutation({ mutationFn: ({ id, escopo }: { id: string; escopo: 'uma' | 'proximas' }) => financeiroService.removeTransacao(id, escopo), onSuccess: (r) => { invalidate(); toast.success(`${r.removidos} lançamento(s) removido(s)`); setSerieDel(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao remover') });

  const txs = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.transacoes.filter((t) => {
      if (mesSel && mesKey(t) !== mesSel) return false;
      if (aba === 'receitas' && t.valor < 0) return false;
      if (aba === 'despesas' && t.valor >= 0) return false;
      const st = txStatus(t);
      if (stFiltro === 'a_receber' && ehLiquidado(st)) return false;
      if (stFiltro === 'liquidado' && !ehLiquidado(st)) return false;
      if (respFiltro && (t.responsavelId ?? '') !== respFiltro) return false;
      if (contaFiltro && (t.conta ?? '') !== contaFiltro) return false;
      if (q && !`${t.pagador ?? t.party ?? ''} ${t.recebedor ?? ''} ${t.responsavel ?? ''} ${t.categoria} ${t.data}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.transacoes, mesSel, aba, stFiltro, respFiltro, contaFiltro, busca]);

  const grupos = useMemo(() => {
    const map = new Map<string, FinTransacao[]>();
    for (const t of txs) { const key = mesKey(t); if (!map.has(key)) map.set(key, []); map.get(key)!.push(t); }
    return Array.from(map.entries()).map(([key, items]) => {
      const rec = items.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0);
      const desp = items.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0);
      return { key, items, rec, desp, saldo: rec - desp };
    }).sort((a, b) => b.key.localeCompare(a.key));
  }, [txs]);

  const resumo = useMemo(() => {
    let recebido = 0, aReceber = 0, despesas = 0, aPagar = 0;
    for (const t of txs) {
      const st = txStatus(t);
      if (t.valor >= 0) { if (st === 'a_receber') aReceber += t.valor; else recebido += t.valor; }
      else { if (st === 'a_pagar') aPagar += -t.valor; else despesas += -t.valor; }
    }
    return { recebido, aReceber, despesas, aPagar, saldo: recebido - despesas };
  }, [txs]);

  const toggle = (key: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const openNew = () => setEditor({ id: null, serieId: null, tipo: 'receita', dataISO: toISOInput(hojeBR()), vencISO: '', pagtoISO: toISOInput(hojeBR()), categoria: 'Honorários', pagador: '', recebedor: '', valor: '', status: 'recebido', parcelas: '1', escopo: 'uma', split: [], responsavelId: '', conta: contas[0]?.id ?? '' });
  const openEdit = (t: FinTransacao) => setEditor({ id: t.id!, serieId: t.serieId ?? null, tipo: t.valor >= 0 ? 'receita' : 'despesa', dataISO: toISOInput(t.data), vencISO: t.vencimento ? toISOInput(t.vencimento) : '', pagtoISO: t.dataPagamento ? toISOInput(t.dataPagamento) : toISOInput(t.data), categoria: t.categoria, pagador: t.pagador ?? t.party ?? '', recebedor: t.recebedor ?? '', valor: String(Math.abs(t.valor)).replace('.', ','), status: txStatus(t), parcelas: '1', escopo: 'uma', responsavelId: t.responsavelId ?? '', conta: t.conta ?? '', split: (t.split ?? []).filter((s) => s.tipo !== 'escritorio').map((s) => ({ tipo: s.tipo === 'associado' ? 'associado' : 'socio', userId: s.userId ?? '', valor: String(s.valor).replace('.', ',') })) });
  // ao trocar o pagador (cliente), sugere o responsável se ainda não houver
  const onPagador = (val: string) => setEditor((ed) => ed ? { ...ed, pagador: val, responsavelId: ed.responsavelId || (ed.tipo === 'receita' ? sugereResp(val) : '') } : ed);

  const buildSplit = (ed: Editor) => ed.split.filter((r) => r.userId && parseValor(r.valor) > 0).map((r) => ({ tipo: r.tipo, userId: r.userId, nome: advogados.find((a) => a.id === r.userId)?.name ?? '', valor: parseValor(r.valor) }));

  const salvar = () => {
    if (!editor) return;
    const v = parseValor(editor.valor);
    if (!(v > 0)) { toast.error('Informe um valor maior que zero'); return; }
    const liq = ehLiquidado(editor.status);
    const split = buildSplit(editor);
    const responsavel = advogados.find((a) => a.id === editor.responsavelId)?.name ?? '';
    if (editor.id == null) {
      addM.mutate({ data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, valor: v, pagador: editor.pagador || undefined, recebedor: editor.recebedor || undefined, vencimento: editor.vencISO ? toBR(editor.vencISO) : undefined, dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : undefined, status: editor.status, parcelas: Math.max(1, parseInt(editor.parcelas, 10) || 1), split, responsavelId: editor.responsavelId || undefined, responsavel: responsavel || undefined, conta: editor.conta || undefined });
    } else {
      updM.mutate({ id: editor.id, input: { data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, valor: v, pagador: editor.pagador || '', recebedor: editor.recebedor || '', vencimento: editor.vencISO ? toBR(editor.vencISO) : '', dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : '', status: editor.status, escopo: editor.escopo, split, responsavelId: editor.responsavelId || '', responsavel, conta: editor.conta || '' } });
    }
  };
  const quickReceber = (t: FinTransacao) => updM.mutate({ id: t.id!, input: { status: t.valor >= 0 ? 'recebido' : 'pago', dataPagamento: hojeBR(), escopo: 'uma' } });
  const pedirExcluir = (t: FinTransacao) => { if (t.serieId) setSerieDel(t); else if (confirm('Remover este lançamento?')) delM.mutate({ id: t.id!, escopo: 'uma' }); };

  const ehSerie = !!editor?.serieId;
  const statusOpts: TxStatus[] = editor?.tipo === 'despesa' ? ['pago', 'a_pagar'] : ['recebido', 'a_receber'];

  return (
    <Card title={<>Lançamentos <span className="font-normal text-zinc-400">· livro-razão editável</span></>}
      action={<button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo lançamento</button>}>

      {/* Filtros */}
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
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {ST_FILTROS.map((a) => <button key={a.key} onClick={() => setStFiltro(a.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${stFiltro === a.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{a.label}</button>)}
        </div>
        <select value={respFiltro} onChange={(e) => setRespFiltro(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Todos responsáveis</option>
          {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {contas.length > 0 && (
          <select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
      </div>

      {/* Resumo do filtro */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-lg bg-emerald-50 py-1.5 dark:bg-emerald-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Recebido</p><p className="text-sm font-bold tabular-nums text-emerald-600">{brl(resumo.recebido)}</p></div>
        <div className="rounded-lg bg-amber-50 py-1.5 dark:bg-amber-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">A receber</p><p className="text-sm font-bold tabular-nums text-amber-600">{brl(resumo.aReceber)}</p></div>
        <div className="rounded-lg bg-rose-50 py-1.5 dark:bg-rose-900/15"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Despesas</p><p className="text-sm font-bold tabular-nums text-rose-600">{brl(resumo.despesas)}</p>{resumo.aPagar > 0 && <p className="text-[10px] text-amber-600">+{brl(resumo.aPagar)} a pagar</p>}</div>
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-zinc-800/40"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Saldo realizado</p><p className={`text-sm font-bold tabular-nums ${resumo.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl(resumo.saldo)}</p></div>
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
                  {g.items.map((t) => {
                    const st = txStatus(t);
                    return (
                      <div key={t.id} className="group flex items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-sm dark:border-zinc-800/70">
                        <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-400">{((!ehLiquidado(st) && t.vencimento) ? t.vencimento : t.data).slice(0, 5)}</span>
                        {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{t.pagador || t.recebedor || t.party || t.categoria}</span>
                          {t.parcelaNum ? <span className="shrink-0 text-[11px] text-zinc-400">{t.parcelaNum}/{t.parcelaTot}</span> : null}
                          {t.responsavel ? <span className="hidden shrink-0 items-center gap-0.5 rounded bg-zinc-100 px-1 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 lg:inline-flex">{t.responsavel.split(' ')[0]}</span> : null}
                          {t.conta ? <span className="hidden shrink-0 rounded px-1 text-[9px] font-medium text-white lg:inline" style={{ background: contas.find((c) => c.id === t.conta)?.cor ?? '#868E96' }}>{contaNome(t.conta)}</span> : null}
                          {t.manual ? <span className="shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30">manual</span> : null}
                        </span>
                        <span className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(data, t.categoria) }} /><span className="hidden max-w-[8rem] truncate md:inline">{t.categoria}</span></span>
                        <span className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${STATUS_TX[st].badge}`}>{STATUS_TX[st].label}</span>
                        <span className={`w-24 shrink-0 whitespace-nowrap text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</span>
                        <span className="flex shrink-0 items-center">
                          {!ehLiquidado(st) && <button onClick={() => quickReceber(t)} title={t.valor >= 0 ? 'Marcar como recebido' : 'Marcar como pago'} className="rounded p-1 text-zinc-300 transition hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>}
                          <button onClick={() => openEdit(t)} title="Editar" className="rounded p-1 text-zinc-300 transition hover:text-[#228BE6]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => pedirExcluir(t)} title="Excluir" className="rounded p-1 text-zinc-300 transition hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento neste filtro.</p>}
      </div>

      {/* Modal de edição / novo lançamento */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{editor.id ? 'Editar lançamento' : 'Novo lançamento'}{editor.parcelas && +editor.parcelas > 1 && !editor.id ? ` · ${editor.parcelas}×` : ''}</h3>
              <button onClick={() => setEditor(null)} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              {/* tipo */}
              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
                {(['receita', 'despesa'] as const).map((tp) => (
                  <button key={tp} onClick={() => setEditor({ ...editor, tipo: tp, categoria: tp === 'receita' ? 'Honorários' : 'Aluguel', status: tp === 'receita' ? (editor.status === 'a_receber' ? 'a_receber' : 'recebido') : (editor.status === 'a_pagar' ? 'a_pagar' : 'pago') })} className={`px-4 py-1.5 text-sm font-semibold capitalize ${editor.tipo === tp ? (tp === 'receita' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{tp}</button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor (cada parcela)"><input value={editor.valor} onChange={(e) => setEditor({ ...editor, valor: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="Fonte"><select value={editor.categoria} onChange={(e) => setEditor({ ...editor, categoria: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              </div>

              {/* status */}
              <Field label="Situação">
                <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                  {statusOpts.map((s) => <button key={s} onClick={() => setEditor({ ...editor, status: s })} className={`px-3 py-1.5 text-xs font-semibold ${editor.status === s ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{STATUS_TX[s].label}</button>)}
                </div>
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={editor.tipo === 'receita' ? 'Competência' : 'Data'}><input type="date" value={editor.dataISO} onChange={(e) => setEditor({ ...editor, dataISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="Vencimento"><input type="date" value={editor.vencISO} onChange={(e) => setEditor({ ...editor, vencISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                {ehLiquidado(editor.status) && <Field label="Pagamento"><input type="date" value={editor.pagtoISO} onChange={(e) => setEditor({ ...editor, pagtoISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pagador (cliente/origem)"><input value={editor.pagador} onChange={(e) => onPagador(e.target.value)} placeholder="quem paga" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="Recebedor (destino)"><input value={editor.recebedor} onChange={(e) => setEditor({ ...editor, recebedor: e.target.value })} placeholder="quem recebe (escritório, advogado…)" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Responsável (advogado)">
                  <select value={editor.responsavelId} onChange={(e) => setEditor({ ...editor, responsavelId: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <option value="">— sem responsável —</option>
                    {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Conta bancária">
                  <select value={editor.conta} onChange={(e) => setEditor({ ...editor, conta: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <option value="">— sem conta —</option>
                    {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Field>
              </div>

              {/* Rateio (split) — só para honorários */}
              {editor.tipo === 'receita' && /honor/i.test(editor.categoria) && (
                <Field label="Rateio de honorários (sócio / associado · o resto fica com o escritório)">
                  <div className="space-y-2 rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-800">
                    {editor.split.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <select value={r.userId} onChange={(e) => setEditor({ ...editor, split: editor.split.map((x, j) => j === i ? { ...x, userId: e.target.value } : x) })} className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <option value="">advogado…</option>
                          {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <select value={r.tipo} onChange={(e) => setEditor({ ...editor, split: editor.split.map((x, j) => j === i ? { ...x, tipo: e.target.value as 'socio' | 'associado' } : x) })} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <option value="socio">Sócio</option>
                          <option value="associado">Associado</option>
                        </select>
                        <input value={r.valor} onChange={(e) => setEditor({ ...editor, split: editor.split.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} inputMode="decimal" placeholder="R$" className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                        <button onClick={() => setEditor({ ...editor, split: editor.split.filter((_, j) => j !== i) })} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setEditor({ ...editor, split: [...editor.split, { tipo: 'socio', userId: '', valor: '' }] })} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar advogado</button>
                      {(() => { const v = parseValor(editor.valor); const assigned = editor.split.reduce((s, r) => s + parseValor(r.valor), 0); const sobra = v - assigned; return <span className={`text-[11px] ${sobra < -0.01 ? 'text-rose-600' : 'text-zinc-400'}`}>Escritório: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(Math.max(0, sobra))}</strong>{sobra < -0.01 ? ' · rateio excede o valor!' : ''}</span>; })()}
                    </div>
                  </div>
                </Field>
              )}

              {!editor.id && (
                <Field label="Parcelas (lança N parcelas mensais)">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-zinc-400" />
                    <input type="number" min={1} max={120} value={editor.parcelas} onChange={(e) => setEditor({ ...editor, parcelas: e.target.value })} className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                    {+editor.parcelas > 1 && <span className="text-xs text-zinc-400">{editor.parcelas}× de {editor.valor ? brl2(parseValor(editor.valor)) : 'R$ 0,00'} = {brl2(parseValor(editor.valor) * (+editor.parcelas || 1))}</span>}
                  </div>
                </Field>
              )}

              {editor.id && ehSerie && (
                <Field label="Aplicar a">
                  <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                    {(['uma', 'proximas'] as const).map((es) => <button key={es} onClick={() => setEditor({ ...editor, escopo: es })} className={`px-3 py-1.5 text-xs font-semibold ${editor.escopo === es ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{es === 'uma' ? 'Só esta' : 'Esta e as próximas'}</button>)}
                  </div>
                </Field>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {editor.id ? <button onClick={() => { const t = data.transacoes.find((x) => x.id === editor.id); setEditor(null); if (t) pedirExcluir(t); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-3.5 w-3.5" /> Excluir</button> : <span />}
              <div className="flex items-center gap-2">
                <button onClick={() => setEditor(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
                <button onClick={salvar} disabled={addM.isPending || updM.isPending} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{(addM.isPending || updM.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini-sheet: excluir série */}
      {serieDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSerieDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">Este lançamento faz parte de um parcelamento{serieDel.parcelaNum ? ` (${serieDel.parcelaNum}/${serieDel.parcelaTot})` : ''}. O que deseja remover?</p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={() => delM.mutate({ id: serieDel.id!, escopo: 'uma' })} disabled={delM.isPending} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Só esta parcela</button>
              <button onClick={() => delM.mutate({ id: serieDel.id!, escopo: 'proximas' })} disabled={delM.isPending} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700">Esta e as próximas</button>
              <button onClick={() => setSerieDel(null)} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>{children}</label>;
}

// ═══════════════════════════ ABA · HONORÁRIOS (clientes) ═══════════════════════

const STATUS_ORDER: StatusFin[] = ['em-dia', 'atencao', 'pontual', 'inativo'];

function HonorariosTab({ data }: { data: FinDashboard }) {
  const [filtro, setFiltro] = useState<'todos' | StatusFin>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [respF, setRespF] = useState('');
  const [mesDe, setMesDe] = useState('');
  const [mesAte, setMesAte] = useState('');

  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advogados = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const mesesDisp = useMemo(() => Array.from(new Set(data.transacoes.map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort(), [data.transacoes]);

  // aplica filtros de responsável + período às transações antes de agregar
  const dataF = useMemo(() => ({
    ...data,
    transacoes: data.transacoes.filter((t) => {
      if (respF && (t.responsavelId ?? '') !== respF) return false;
      const mk = mesKey(t);
      if (mesDe && mk < mesDe) return false;
      if (mesAte && mk > mesAte) return false;
      return true;
    }),
  }), [data, respF, mesDe, mesAte]);

  const clientes = useMemo(() => aggregarClientes(dataF), [dataF]);

  const tot = useMemo(() => {
    // somatórios EXATOS, direto das transações de honorários (inclui estornos a quem nunca pagou)
    const honor = dataF.transacoes.filter((t) => /honor/i.test(t.categoria));
    const recebido = Math.round(honor.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0));
    const repassado = Math.round(honor.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0));
    const porStatus = (st: StatusFin) => clientes.filter((c) => c.status === st).length;
    return { recebido, repassado, liquido: recebido - repassado, nClientes: clientes.length, emDia: porStatus('em-dia'), atencao: porStatus('atencao') };
  }, [clientes, data.transacoes]);

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

      <Card title="Carteira de honorários por cliente" sub="vinculado aos lançamentos. Status é comportamental (frequência de pagamento). O saldo devedor exato dos parcelados está na aba Cobranças."
        action={
          <div className="relative"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="w-44 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
        }>
        {/* Filtros: responsável + período */}
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <select value={respF} onChange={(e) => setRespF(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Todos responsáveis</option>
            {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="flex items-center gap-1 text-xs text-zinc-400"><Calendar className="h-3.5 w-3.5" /> de
            <select value={mesDe} onChange={(e) => setMesDe(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">início</option>{mesesDisp.map((m) => <option key={m} value={m}>{mesCurtoKey(m)}</option>)}</select>
            até
            <select value={mesAte} onChange={(e) => setMesAte(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">fim</option>{mesesDisp.map((m) => <option key={m} value={m}>{mesCurtoKey(m)}</option>)}</select>
          </span>
          {(respF || mesDe || mesAte) && <button onClick={() => { setRespF(''); setMesDe(''); setMesAte(''); }} className="text-xs text-zinc-400 hover:text-zinc-600 underline">limpar</button>}
        </div>
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

// ═══════════════════════════ ABA · COBRANÇAS (parcelamento) ═══════════════════

const STATUS_COB: Record<string, { label: string; badge: string }> = {
  em_dia: { label: 'Em dia', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300' },
  atrasada: { label: 'Em atraso', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300' },
  quitada: { label: 'Quitada', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  cancelada: { label: 'Cancelada', badge: 'bg-zinc-100 text-zinc-400' },
};

function CobrancasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const { data: cobrancas = [], isLoading } = useQuery({ queryKey: ['financeiro', 'cobrancas'], queryFn: () => financeiroService.listCobrancas() });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advogados = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const contas = data.contas ?? [];
  const [form, setForm] = useState<{ cliente: string; descricao: string; valorTotal: string; nParcelas: string; dataISO: string; responsavelId: string; conta: string } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const inval = () => { qc.invalidateQueries({ queryKey: ['financeiro', 'cobrancas'] }); qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); };
  const addM = useMutation({ mutationFn: () => financeiroService.addCobranca({ cliente: form!.cliente.trim(), descricao: form!.descricao.trim() || undefined, valorTotal: parseValor(form!.valorTotal), nParcelas: Math.max(1, parseInt(form!.nParcelas, 10) || 1), dataInicio: toBR(form!.dataISO), responsavelId: form!.responsavelId || undefined, responsavel: advogados.find((a) => a.id === form!.responsavelId)?.name, conta: form!.conta || undefined }), onSuccess: () => { inval(); toast.success('Cobrança criada'); setForm(null); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const delM = useMutation({ mutationFn: (id: string) => financeiroService.removeCobranca(id), onSuccess: () => { inval(); toast.success('Cobrança removida'); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const pagarM = useMutation({ mutationFn: ({ id, num }: { id: string; num: number }) => financeiroService.pagarParcela(id, num), onSuccess: () => { inval(); toast.success('Parcela baixada (lançada como recebida)'); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const desfazerM = useMutation({ mutationFn: ({ id, num }: { id: string; num: number }) => financeiroService.desfazerParcela(id, num), onSuccess: () => { inval(); toast.success('Baixa desfeita'); }, onError: (e: any) => toast.error(e?.message || 'Erro') });

  const tot = useMemo(() => {
    const ativas = cobrancas.filter((c) => c.statusCalc !== 'cancelada');
    return {
      devedor: ativas.reduce((s, c) => s + c.saldoDevedor, 0),
      atrasado: ativas.reduce((s, c) => s + c.valorAtrasado, 0),
      nAtraso: ativas.filter((c) => c.statusCalc === 'atrasada').length,
      n: cobrancas.length,
      recebido: cobrancas.reduce((s, c) => s + c.pago, 0),
    };
  }, [cobrancas]);

  const openNew = () => setForm({ cliente: '', descricao: '', valorTotal: '', nParcelas: '12', dataISO: toISOInput(hojeBR()), responsavelId: '', conta: contas[0]?.id ?? '' });

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-blue-50 to-white p-5 dark:border-zinc-800 dark:from-blue-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><CreditCard className="h-5 w-5 text-[#228BE6]" /> Cobranças de honorários parcelados</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Como no Asaas: cadastre o contrato do cliente (valor total + parcelas + 1º vencimento) e acompanhe o <strong>saldo devedor real</strong>, parcelas em aberto e atrasadas. Ao baixar uma parcela, ela vira automaticamente um <strong>honorário recebido</strong> no livro-razão.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Saldo devedor (a receber)" value={brl(tot.devedor)} hint={`${tot.n} cobrança(s)`} accent="#228BE6" />
        <MiniStat label="Em atraso" value={brl(tot.atrasado)} hint={`${tot.nAtraso} cliente(s) atrasado(s)`} accent="#E03131" />
        <MiniStat label="Já recebido (parcelas baixadas)" value={brl(tot.recebido)} hint="entrou no livro-razão" accent="#2F9E44" />
        <div className="rounded-2xl border border-dashed border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Nova cobrança</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
      ) : cobrancas.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-zinc-400">Nenhuma cobrança ainda. Clique em "Nova cobrança" para cadastrar um contrato parcelado.</p></Card>
      ) : (
        <div className="mt-4 space-y-2">
          {cobrancas.map((c) => {
            const s = STATUS_COB[c.statusCalc] ?? STATUS_COB.em_dia;
            const exp = aberta === c.id;
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <button onClick={() => setAberta(exp ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                  {exp ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{c.cliente}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{s.label}</span></p>
                    <p className="truncate text-xs text-zinc-400">{c.descricao ? `${c.descricao} · ` : ''}{c.pagas}/{c.nParcelas} pagas · total {brl(c.valorTotal)}{c.proximaParcela ? ` · próx. ${c.proximaParcela.vencimento}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-lg font-bold tabular-nums ${c.saldoDevedor > 0.01 ? 'text-[#228BE6]' : 'text-emerald-600'}`}>{brl(c.saldoDevedor)}</p>
                    <p className="text-[10px] text-zinc-400">saldo devedor{c.valorAtrasado > 0 ? ` · ${brl(c.valorAtrasado)} vencido` : ''}</p>
                  </div>
                </button>
                {exp && (
                  <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500">Parcelas</span>
                      <button onClick={() => { if (confirm(`Remover a cobrança de ${c.cliente}? (os lançamentos já baixados permanecem)`)) delM.mutate(c.id); }} className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"><Trash2 className="h-3 w-3" /> Remover cobrança</button>
                    </div>
                    <div className="space-y-1">
                      {c.parcelas.map((p) => (
                        <div key={p.num} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm odd:bg-zinc-50/60 dark:odd:bg-zinc-800/30">
                          <span className="w-8 shrink-0 text-xs text-zinc-400">{p.num}/{c.nParcelas}</span>
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><CalendarClock className="h-3.5 w-3.5" />{p.vencimento}</span>
                          <span className="flex-1" />
                          {p.status === 'paga' ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">Paga {p.dataPagamento ? `· ${p.dataPagamento.slice(0, 5)}` : ''}</span>
                          ) : p.atrasada ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/25 dark:text-rose-300"><AlertCircle className="h-3 w-3" /> Vencida</span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/25 dark:text-amber-300">Em aberto</span>
                          )}
                          <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl2(p.valor)}</span>
                          {p.status === 'paga'
                            ? <button onClick={() => desfazerM.mutate({ id: c.id, num: p.num })} disabled={desfazerM.isPending} title="Desfazer baixa" className="rounded p-1 text-zinc-300 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                            : <button onClick={() => pagarM.mutate({ id: c.id, num: p.num })} disabled={pagarM.isPending} title="Dar baixa (lançar recebido)" className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700">Baixar</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nova cobrança */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Nova cobrança</h3><button onClick={() => setForm(null)} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <Field label="Cliente"><input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="nome do cliente" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              <Field label="Descrição (opcional)"><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: honorários contratuais RMC" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Valor total"><input value={form.valorTotal} onChange={(e) => setForm({ ...form, valorTotal: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="Nº de parcelas"><input type="number" min={1} max={120} value={form.nParcelas} onChange={(e) => setForm({ ...form, nParcelas: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="1º vencimento"><input type="date" value={form.dataISO} onChange={(e) => setForm({ ...form, dataISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              </div>
              {parseValor(form.valorTotal) > 0 && +form.nParcelas > 0 && <p className="text-xs text-zinc-500">{form.nParcelas}× de <strong className="text-zinc-700 dark:text-zinc-200">{brl2(parseValor(form.valorTotal) / (+form.nParcelas || 1))}</strong> (mensal, a partir do 1º vencimento).</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Responsável (advogado)"><select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">— sem —</option>{advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
                <Field label="Conta de recebimento"><select value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">— sem —</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => addM.mutate()} disabled={addM.isPending || !form.cliente.trim() || !(parseValor(form.valorTotal) > 0)} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{addM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar cobrança'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ ABA · CUMPRIMENTO DE SENTENÇA ════════════════════

function useCumprimentoFin() {
  return useQuery({ queryKey: ['financeiro', 'cumprimento'], queryFn: () => legalCasesService.cumprimentoFinanceiro(), staleTime: 60_000 });
}
const VerProcesso = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <a href={`/processos/${id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-zinc-700 hover:text-[#228BE6] hover:underline dark:text-zinc-200">{children}<ExternalLink className="h-3 w-3 shrink-0 opacity-50" /></a>
);

function CumprimentoTab() {
  const { data: cs, isLoading } = useCumprimentoFin();
  const [areaF, setAreaF] = useState('');
  const [respF, setRespF] = useState('');
  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  if (!cs) return <Card><p className="py-8 text-center text-sm text-zinc-400">Não foi possível carregar os processos.</p></Card>;

  const allCs = [...cs.cumprimento, ...cs.prestacao, ...cs.favoraveis];
  const areas = Array.from(new Set(allCs.map((x) => areaJuridica(x.area)))).sort() as string[];
  const resps = Array.from(new Set(allCs.map((x) => x.responsavel).filter(Boolean))).sort() as string[];
  const match = (x: { area: string | null; responsavel: string | null }) => (!areaF || areaJuridica(x.area) === areaF) && (!respF || x.responsavel === respF);
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const cumprimento = cs.cumprimento.filter(match);
  const prestacao = cs.prestacao.filter(match);
  const favoraveis = cs.favoraveis.filter(match);
  const prestacaoCheia = prestacao.filter((x) => x.aReceberNosso > 0);
  const cumpCheio = cumprimento.filter((x) => x.valorCalculo > 0);
  const cumpVazio = cumprimento.length - cumpCheio.length;
  const prestVazio = prestacao.length - prestacaoCheia.length;
  const t = {
    nPrestacao: prestacao.length, aReceberPrestacao: r2(prestacao.reduce((s, x) => s + (x.aReceberNosso || 0), 0)),
    nCumprimento: cumprimento.length, brutoEmCumprimento: r2(cumpCheio.reduce((s, x) => s + (x.valorCalculo || 0), 0)),
    nFavoraveis: favoraveis.length, estimadoFavoraveis: r2(favoraveis.reduce((s, x) => s + (x.estimado || 0), 0)),
  };

  return (
    <>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-900/40 dark:from-emerald-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Landmark className="h-5 w-5 text-emerald-600" /> Caixa a receber dos processos</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Puxado direto dos cards da Fase Judicial. Em <strong>Cumprimento de Sentença</strong> você lança o valor do cálculo; em <strong>Prestação de Contas</strong>, a divisão (nosso / sucumbência / cliente). O que está na prestação já é <strong>caixa nosso, quase certo</strong>; as sentenças favoráveis são <strong>parâmetro</strong> (ainda há risco de reforma no tribunal).
        </p>
      </div>

      {(areas.length > 0 || resps.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Filtrar:</span>
          <select value={areaF} onChange={(e) => setAreaF(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Todas as áreas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select value={respF} onChange={(e) => setRespF(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Todos responsáveis</option>{resps.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          {(areaF || respF) && <button onClick={() => { setAreaF(''); setRespF(''); }} className="text-xs text-zinc-400 underline hover:text-zinc-600">limpar</button>}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="A receber (nosso) — prestação" value={brl(t.aReceberPrestacao)} hint={`${t.nPrestacao} processo(s)`} accent="#2F9E44" />
        <MiniStat label="Em cumprimento (bruto)" value={brl(t.brutoEmCumprimento)} hint={`${t.nCumprimento} protocolado(s)/em curso`} accent="#228BE6" />
        <MiniStat label="Sentenças favoráveis (estimado)" value={brl(t.estimadoFavoraveis)} hint={`${t.nFavoraveis} caso(s) · maior risco`} accent="#F59F00" />
        <MiniStat label="Total potencial" value={brl(t.aReceberPrestacao + t.brutoEmCumprimento + t.estimadoFavoraveis)} hint="prestação + cumprimento + favoráveis" accent="#7048E8" />
      </div>

      {/* Prestação de contas — nosso */}
      <Card title="Prestação de contas — já é nosso (caixa real)" sub="o que entra pra nós: honorários contratuais + sucumbência.">
        {prestacaoCheia.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nenhuma prestação de contas com valores preenchidos.{prestVazio > 0 ? ` ${prestVazio} processo(s) nesta fase aguardando o preenchimento no card.` : ''}</p>
        ) : (
          <CsTabela cols={['Cliente', 'Nossos honorários', 'Sucumbência', 'A receber']}>
            {prestacaoCheia.map((x) => (
              <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="max-w-0 px-2 py-1.5"><VerProcesso id={x.caseId}>{x.cliente || x.title}</VerProcesso></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{brl2(x.honorariosNossos)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{x.sucumbencia ? brl2(x.sucumbencia) : '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-600">{brl2(x.aReceberNosso)}</td>
              </tr>
            ))}
          </CsTabela>
        )}
      </Card>

      {/* Em cumprimento — protocolado */}
      <Card title="Em cumprimento de sentença — protocolado, aguardando alvará" sub="valor do cálculo (bruto da condenação). A parte do escritório é definida na prestação de contas.">
        {cumpCheio.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nenhum processo com valor de cálculo preenchido.{cumpVazio > 0 ? ` ${cumpVazio} em cumprimento aguardando o "Valor do cálculo" no card.` : ''}</p>
        ) : (
          <>
            <CsTabela cols={['Cliente', 'Valor do cálculo', 'Situação', 'Nº dos autos']}>
              {cumpCheio.map((x) => (
                <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="max-w-0 px-2 py-1.5"><VerProcesso id={x.caseId}>{x.cliente || x.title}</VerProcesso></td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-[#228BE6]">{brl2(x.valorCalculo)}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${x.protocolado ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'}`}>{x.protocolado ? 'Protocolado' : 'A protocolar'}</span></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-xs text-zinc-500">{x.numeroCs || '—'}</td>
                </tr>
              ))}
            </CsTabela>
            {cumpVazio > 0 && <p className="mt-2 text-[11px] text-zinc-400">+ {cumpVazio} processo(s) em cumprimento sem o valor do cálculo preenchido no card.</p>}
          </>
        )}
      </Card>

      {/* Sentenças favoráveis — parâmetro */}
      {favoraveis.length > 0 && (
        <Card title="Sentenças favoráveis — parâmetro (maior risco)" sub="ganhamos em 1º grau mas ainda cabe recurso/reforma. Estimativa = valor da causa × % de êxito.">
          <CsTabela cols={['Cliente', 'Resultado', 'Êxito', 'Estimado (nosso)']}>
            {favoraveis.map((x) => (
              <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="max-w-0 px-2 py-1.5"><VerProcesso id={x.caseId}>{x.cliente || x.title}</VerProcesso></td>
                <td className="px-2 py-1.5 text-xs text-zinc-500">{x.resultado || '—'}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-zinc-500">{x.exito != null ? `${x.exito}%` : '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-600">{x.estimado != null ? brl2(x.estimado) : '—'}</td>
              </tr>
            ))}
          </CsTabela>
        </Card>
      )}
    </>
  );
}

function CsTabela({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">{cols.map((c, i) => <th key={c} className={`px-2 py-1.5 font-medium ${i === 0 ? '' : i === cols.length - 1 ? 'text-right' : 'text-right'}`}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════ ABA · RETIRADAS / PRÓ-LABORE ═════════════════════

function RetiradasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advs = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const r = useMemo(() => aggregarRetiradas(data, advs), [data, advs]);
  const [ret, setRet] = useState<{ nome: string } | null>(null);
  const [f, setF] = useState({ dataISO: toISOInput(hojeBR()), valor: '' });
  const addRet = useMutation({
    mutationFn: () => financeiroService.addTransacao({ data: toBR(f.dataISO), tipo: 'despesa', categoria: 'Pró-labore', valor: parseValor(f.valor), recebedor: ret?.nome, status: 'pago' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success('Retirada lançada'); setRet(null); setF((p) => ({ ...p, valor: '' })); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao lançar'),
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  const totalParts = r.porUser.reduce((s, u) => s + u.aReceber, 0);

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-zinc-800 dark:from-cyan-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Wallet className="h-5 w-5 text-[#15AABF]" /> Retiradas e pró-labore</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Quando um honorário entra, o rateio (no lançamento) separa a parte do <strong>escritório</strong>, do <strong>sócio</strong> e do <strong>associado</strong>. Aqui você vê quanto cada advogado tem a receber e quanto já retirou — e lança novas retiradas.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Honorários recebidos" value={brl(r.totalHonorarios)} hint="base do rateio" accent="#2F9E44" />
        <MiniStat label="Parte do escritório" value={brl(r.escritorio)} hint="caixa do escritório" accent="#228BE6" />
        <MiniStat label="Parte dos advogados" value={brl(totalParts)} hint="a receber pelo rateio" accent="#7048E8" />
        <MiniStat label="Total já retirado" value={brl(r.totalRetirado)} hint="pró-labore + retiradas pagas" accent="#E64980" />
      </div>

      <Card title="Por advogado" sub="parte do rateio × retiradas pagas (categoria Pró-labore/Retirada).">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Advogado</th><th className="px-2 py-1.5 text-right font-medium">A receber (parte)</th><th className="px-2 py-1.5 text-right font-medium">Já retirou</th><th className="px-2 py-1.5 text-right font-medium">Saldo</th><th className="w-24"></th></tr></thead>
            <tbody>
              {r.porUser.map((u) => (
                <tr key={u.userId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5"><span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />{u.nome}</span></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-violet-600">{u.aReceber ? brl2(u.aReceber) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-pink-600">{u.retirado ? brl2(u.retirado) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${u.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(u.saldo)}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => setRet({ nome: u.nome })} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:border-[#15AABF] hover:text-[#15AABF] dark:border-zinc-700 dark:text-zinc-300">Lançar retirada</button></td>
                </tr>
              ))}
              {r.porUser.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">Nenhum advogado ativo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">A parte de cada advogado vem do rateio definido na hora do recebimento do honorário (no lançamento). Sem rateio, o valor inteiro fica com o escritório.</p>
      </Card>

      {/* Modal: lançar retirada */}
      {ret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRet(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-zinc-800 dark:text-zinc-100">Retirada · {ret.nome}</h3>
            <div className="space-y-3">
              <Field label="Data"><input type="date" value={f.dataISO} onChange={(e) => setF({ ...f, dataISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              <Field label="Valor"><input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRet(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => addRet.mutate()} disabled={addRet.isPending || !(parseValor(f.valor) > 0)} className="inline-flex items-center gap-1 rounded-lg bg-[#15AABF] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{addRet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar retirada'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ ABA · CONTAS BANCÁRIAS ═══════════════════════════

const BANCOS = [
  { id: 'nubank', nome: 'Nubank', cor: '#820AD1' },
  { id: 'asaas', nome: 'ASAAS', cor: '#0052FF' },
  { id: 'mercadopago', nome: 'Mercado Pago', cor: '#00B1EA' },
  { id: 'outro', nome: 'Outro', cor: '#868E96' },
];

// Parser flexível de extrato bancário colado (CSV/TSV/;) — best-effort.
function parseExtrato(text: string): { data: string; valor: number; descricao: string }[] {
  const num = (s: string) => { const t = String(s).replace(/[^\d,.-]/g, ''); if (!t || !/\d/.test(t)) return NaN; return /,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, '')); };
  const out: { data: string; valor: number; descricao: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const row = raw.trim(); if (!row) continue;
    const sep = row.includes(';') ? ';' : row.includes('\t') ? '\t' : ',';
    const cols = row.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    let dataBR = '', valor = NaN; const desc: string[] = [];
    for (const c of cols) {
      const br = c.match(/^(\d{2})[\/-](\d{2})[\/-](\d{2,4})$/); const iso = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dataBR && br) { dataBR = `${br[1]}/${br[2]}/${br[3].length === 2 ? '20' + br[3] : br[3]}`; continue; }
      if (!dataBR && iso) { dataBR = `${iso[3]}/${iso[2]}/${iso[1]}`; continue; }
      const n = num(c);
      if (Number.isFinite(n) && /[,.\-]/.test(c)) { valor = n; continue; } // última col numérica = valor
      if (c && !/^\d+$/.test(c)) desc.push(c);
    }
    if (dataBR && Number.isFinite(valor)) out.push({ data: dataBR, valor, descricao: desc.join(' ').slice(0, 140) });
  }
  return out;
}

function ContasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const contas = data.contas ?? [];
  const [conc, setConc] = useState<{ conta: string; texto: string } | null>(null);
  const [concResult, setConcResult] = useState<{ conciliados: number; semPar: { data: string; valor: number; descricao: string }[] } | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [form, setForm] = useState<{ id?: string; nome: string; banco: string; saldoInicial: string } | null>(null);
  const inval = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
  const addM = useMutation({ mutationFn: (i: { nome: string; banco: string; saldoInicial: number }) => financeiroService.addConta(i), onSuccess: () => { inval(); toast.success('Conta adicionada'); setForm(null); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const updM = useMutation({ mutationFn: ({ id, i }: { id: string; i: any }) => financeiroService.updateConta(id, i), onSuccess: () => { inval(); toast.success('Conta atualizada'); setForm(null); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const delM = useMutation({ mutationFn: (id: string) => financeiroService.removeConta(id), onSuccess: () => { inval(); toast.success('Conta removida'); }, onError: (e: any) => toast.error(e?.message || 'Erro') });

  const saldoConta = (id: string) => {
    const ini = contas.find((c) => c.id === id)?.saldoInicial ?? 0;
    let mov = 0, aReceber = 0, aPagar = 0, n = 0;
    for (const t of data.transacoes) {
      if (t.conta !== id) continue; n++;
      const st = txStatus(t);
      if (t.valor >= 0) { if (st === 'recebido') mov += t.valor; else aReceber += t.valor; }
      else { if (st === 'pago') mov += t.valor; else aPagar += -t.valor; }
    }
    return { saldo: ini + mov, aReceber, aPagar, n };
  };
  const semConta = data.transacoes.filter((t) => !t.conta).length;
  const total = contas.reduce((s, c) => s + saldoConta(c.id).saldo, 0);

  const salvar = () => {
    if (!form || !form.nome.trim()) { toast.error('Informe o nome da conta'); return; }
    const i = { nome: form.nome.trim(), banco: form.banco, saldoInicial: parseValor(form.saldoInicial) };
    if (form.id) updM.mutate({ id: form.id, i }); else addM.mutate(i);
  };

  // ── Conciliação: casa as linhas do extrato com lançamentos por valor + data (±5 dias) ──
  const isoNum = (br: string) => { const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? +`${m[3]}${m[2]}${m[1]}` : 0; };
  const analisar = () => {
    if (!conc) return;
    const linhas = parseExtrato(conc.texto);
    if (!linhas.length) { toast.error('Não consegui ler nenhuma linha. Cole o extrato com data, valor e descrição.'); return; }
    const usadas = new Set<string>();
    let conciliados = 0; const semPar: typeof linhas = [];
    for (const l of linhas) {
      const alvo = isoNum(l.data);
      const match = data.transacoes.find((t) => {
        if (t.id && usadas.has(t.id)) return false;
        if (t.conta && t.conta !== conc.conta) return false;
        if (Math.sign(t.valor) !== Math.sign(l.valor)) return false;
        if (Math.abs(Math.abs(t.valor) - Math.abs(l.valor)) > 0.01) return false;
        return Math.abs(isoNum(t.data) - alvo) <= 5 || Math.abs((t.vencimento ? isoNum(t.vencimento) : 0) - alvo) <= 5;
      });
      if (match) { conciliados++; if (match.id) usadas.add(match.id); } else semPar.push(l);
    }
    setConcResult({ conciliados, semPar });
  };
  const criarComIA = async () => {
    if (!conc || !concResult?.semPar.length) return;
    setIaLoading(true);
    try {
      const sug = await financeiroService.classificarExtrato(concResult.semPar.map((l) => ({ descricao: l.descricao, valor: l.valor })));
      for (let i = 0; i < concResult.semPar.length; i++) {
        const l = concResult.semPar[i]; const s = sug.find((x) => x.i === i);
        await financeiroService.addTransacao({ data: l.data, tipo: (s?.tipo as 'receita' | 'despesa') ?? (l.valor >= 0 ? 'receita' : 'despesa'), categoria: s?.categoria ?? (l.valor >= 0 ? 'Honorários' : 'Outros'), valor: Math.abs(l.valor), pagador: s?.party || l.descricao.slice(0, 60), conta: conc.conta, status: l.valor >= 0 ? 'recebido' : 'pago' });
      }
      qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
      toast.success(`${concResult.semPar.length} lançamento(s) criado(s) e conciliado(s)`);
      setConc(null); setConcResult(null);
    } catch (e: any) { toast.error(e?.message || 'Erro ao criar lançamentos'); } finally { setIaLoading(false); }
  };

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-violet-50 to-white p-5 dark:border-zinc-800 dark:from-violet-900/15 dark:to-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Banknote className="h-5 w-5 text-[#820AD1]" /> Contas bancárias</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              Marque a conta em cada lançamento para filtrar e ver o saldo de cada uma. Use <strong>Importar extrato</strong> para conciliar: o sistema casa as linhas com os lançamentos e a <strong>IA cria os que faltam</strong>.
            </p>
          </div>
          <button onClick={() => { setConc({ conta: contas[0]?.id ?? '', texto: '' }); setConcResult(null); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"><Sparkles className="h-3.5 w-3.5" /> Importar extrato</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniStat label="Saldo somado das contas" value={brl(total)} hint={`${contas.length} conta(s)`} accent={total >= 0 ? '#2F9E44' : '#E03131'} />
        <MiniStat label="Lançamentos sem conta" value={String(semConta)} hint="marque a conta neles para conciliar" accent="#F59F00" />
        <div className="rounded-2xl border border-dashed border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={() => setForm({ nome: '', banco: 'nubank', saldoInicial: '' })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Nova conta</button>
        </div>
      </div>

      {/* Modal conciliação (importar extrato) */}
      {conc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setConc(null); setConcResult(null); }}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Sparkles className="h-4 w-4 text-[#7048E8]" /> Conciliação bancária</h3><button onClick={() => { setConc(null); setConcResult(null); }} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <Field label="Conta"><select value={conc.conta} onChange={(e) => { setConc({ ...conc, conta: e.target.value }); setConcResult(null); }} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
              <Field label="Cole o extrato (CSV: data, valor, descrição — um por linha)">
                <textarea value={conc.texto} onChange={(e) => { setConc({ ...conc, texto: e.target.value }); setConcResult(null); }} rows={6} placeholder={'10/06/2026;47,00;Pix recebido Júlia Macedo\n12/06/2026;-2850,00;Aluguel Top Oce'} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900" />
              </Field>
              <button onClick={analisar} className="rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white">Analisar e casar</button>

              {concResult && (
                <div className="rounded-xl border border-zinc-200/70 p-3 dark:border-zinc-800">
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600">✓ {concResult.conciliados} já conciliado(s)</span>
                    <span className="text-amber-600">⚠ {concResult.semPar.length} sem par</span>
                  </div>
                  {concResult.semPar.length > 0 && (
                    <>
                      <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto scrollbar-thin">
                        {concResult.semPar.map((l, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="w-12 shrink-0 text-zinc-400">{l.data.slice(0, 5)}</span>
                            <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{l.descricao || '—'}</span>
                            <span className={`shrink-0 tabular-nums ${l.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(l.valor)}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={criarComIA} disabled={iaLoading} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{iaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Criar os {concResult.semPar.length} faltantes com IA</button>
                    </>
                  )}
                  {concResult.semPar.length === 0 && <p className="mt-2 text-xs text-emerald-600">Tudo conciliado! Nenhum lançamento faltando.</p>}
                </div>
              )}
              <p className="text-[11px] text-zinc-400">Dica: exporte o extrato em CSV no app do banco (Nubank/ASAAS/Mercado Pago) e cole aqui. A integração automática por API entra depois.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contas.map((c) => {
          const s = saldoConta(c.id);
          return (
            <div key={c.id} className="group rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100"><span className="h-3 w-3 rounded-full" style={{ background: c.cor ?? '#868E96' }} />{c.nome}</span>
                <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setForm({ id: c.id, nome: c.nome, banco: c.banco, saldoInicial: String(c.saldoInicial ?? 0).replace('.', ',') })} className="rounded p-1 text-zinc-300 hover:text-[#228BE6]"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm(`Remover a conta "${c.nome}"?`)) delM.mutate(c.id); }} className="rounded p-1 text-zinc-300 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
              <p className={`mt-2 text-2xl font-bold tabular-nums ${s.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(s.saldo)}</p>
              <p className="text-[11px] text-zinc-400">{s.n} lançamento(s) nesta conta</p>
              {(s.aReceber > 0 || s.aPagar > 0) && (
                <div className="mt-2 flex gap-3 text-[11px]">
                  {s.aReceber > 0 && <span className="text-amber-600">a receber {brl(s.aReceber)}</span>}
                  {s.aPagar > 0 && <span className="text-rose-500">a pagar {brl(s.aPagar)}</span>}
                </div>
              )}
            </div>
          );
        })}
        {contas.length === 0 && <p className="col-span-full py-8 text-center text-sm text-zinc-400">Nenhuma conta cadastrada. Clique em "Nova conta".</p>}
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700">
        💡 Você pretende migrar tudo para o <strong className="text-[#820AD1]">Nubank</strong>. Conforme for movendo, basta marcar os novos lançamentos na conta Nubank — o saldo das outras vai zerando naturalmente.
      </p>

      {/* Modal conta */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-zinc-800 dark:text-zinc-100">{form.id ? 'Editar conta' : 'Nova conta'}</h3>
            <div className="space-y-3">
              <Field label="Banco"><select value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value, nome: form.nome || (BANCOS.find((b) => b.id === e.target.value)?.nome ?? '') })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{BANCOS.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></Field>
              <Field label="Nome / apelido"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Nubank PJ" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              <Field label="Saldo inicial (opcional)"><input value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={salvar} disabled={addM.isPending || updM.isPending} className="rounded-lg bg-[#228BE6] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ ABA · FLUXO DE CAIXA (tabela Astrea) ══════════════

const JANELAS = [{ key: 'tudo', label: 'Tudo' }, { key: '12', label: 'Últimos 12m' }, { key: 'ano', label: 'Ano atual' }] as const;
function FluxoTab({ data }: { data: FinDashboard }) {
  const k = data.kpis!;
  const [janela, setJanela] = useState<'tudo' | '12' | 'ano'>('tudo');
  const anoAtual = (data.mesAtual || '').slice(0, 4);
  const meses = useMemo(() => {
    if (janela === 'ano') return data.meses.filter((m) => m.key.startsWith(anoAtual));
    if (janela === '12') return [...data.meses.filter((m) => !m.projecao).slice(-12), ...data.meses.filter((m) => m.projecao)];
    return data.meses;
  }, [data.meses, janela, anoAtual]);
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

      <Card title="Fluxo de caixa" sub="matriz mensal de receitas e despesas, como no Astrea. Role na horizontal para ver todos os meses; à direita da faixa, projeção."
        action={<div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">{JANELAS.map((j) => <button key={j.key} onClick={() => setJanela(j.key)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${janela === j.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{j.label}</button>)}</div>}>
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

function simula(meses: FinDashboard['meses'], ticket: number, x: number, injecao = 0) {
  const realizados = meses.filter((m) => !m.projecao);
  const futuros = meses.filter((m) => m.projecao);
  let acum = (realizados.length ? realizados[realizados.length - 1].acumulado : 0) + injecao;
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
  const { data: cs } = useCumprimentoFin();
  const csCerto = cs?.totais.aReceberPrestacao ?? 0;
  const [usarCS, setUsarCS] = useState(true);
  const inj = usarCS ? csCerto : 0;

  const chartData = useMemo(() => {
    const sim = simula(data.meses, ticket, x, inj);
    const byNome = new Map(sim.pts.map((pt) => [pt.nome, pt.acumuladoCenario]));
    return data.meses.map((m) => ({ nome: mesCurto(m.label), acumulado: m.acumulado, acumuladoCenario: m.projecao ? (byNome.get(mesCurto(m.label)) ?? null) : m.acumulado, projecao: m.projecao }));
  }, [data.meses, ticket, x, inj]);
  const divisor = (() => { const i = chartData.findIndex((d) => d.projecao); return i > 0 ? chartData[i - 1]?.nome : undefined; })();

  const cenarios = [
    { nome: 'Sem novos clientes', x: 0, cor: '#E03131', desc: 'só a carteira atual' },
    { nome: 'Ponto de equilíbrio', x: p.clientesEquilibrio || 3, cor: '#F59F00', desc: 'o mínimo para não afundar' },
    { nome: 'Crescimento', x: (p.clientesEquilibrio || 3) + 3, cor: '#2F9E44', desc: 'aquisição firme' },
  ].map((c) => ({ ...c, ...simula(data.meses, ticket, c.x, inj) }));

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

      {csCerto > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usarCS} onChange={(e) => setUsarCS(e.target.checked)} className="h-4 w-4 accent-emerald-600" /><span className="font-medium text-zinc-700 dark:text-zinc-200">Somar recebíveis certos de Cumprimento de Sentença</span></label>
          <span className="text-sm font-bold tabular-nums text-emerald-600">{brl(csCerto)}</span>
          <span className="text-xs text-zinc-400">já é nosso (prestação de contas){cs?.totais.brutoEmCumprimento ? ` · + ${brl(cs.totais.brutoEmCumprimento)} em cumprimento, bruto, não somado` : ''}.</span>
        </div>
      )}

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

// ═══════════════════════════ VISÃO LIMITADA (advogado · só os casos dele) ═════

function FinanceiroLimitado({ data }: { data: FinDashboard }) {
  const r = data.resumo ?? { recebido: 0, aReceber: 0, minhaParte: 0, nClientes: 0, nLancamentos: 0 };
  const txs = (data.transacoes ?? []).slice(0, 300);
  const primeiro = (data.meuNome || '').split(' ')[0] || 'Dr(a).';
  const aReceberTotal = r.aReceber + r.minhaParte;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CircleDollarSign className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Seu financeiro</h1>
            <p className="text-sm text-zinc-500">Olá, {primeiro}! Aqui está o financeiro <strong>dos seus casos</strong> — o que você já recebeu, o que tem a receber e a sua parte.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Recebido (seus casos)" value={brl(r.recebido)} hint={`${r.nClientes} cliente(s) seus`} accent="#2F9E44" />
          <MiniStat label="A receber" value={brl(r.aReceber)} hint="lançamentos pendentes" accent="#F59F00" />
          <MiniStat label="Sua parte (rateio)" value={brl(r.minhaParte)} hint="honorários divididos com você" accent="#7048E8" />
          <MiniStat label="Total a entrar" value={brl(aReceberTotal)} hint="a receber + sua parte" accent="#228BE6" />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 dark:border-zinc-800 dark:from-amber-900/15 dark:via-zinc-900 dark:to-emerald-900/15">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-600"><Flame className="h-5 w-5" /></span>
            <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
              {r.recebido > 0
                ? `Você já trouxe ${brl(r.recebido)} em honorários${aReceberTotal > 0 ? `, e ainda tem ${brl(aReceberTotal)} a entrar` : ''}. Cada caso bem conduzido vira o próximo. Continue!`
                : 'Seu histórico financeiro aparece aqui conforme os honorários dos seus casos entram. Bora construir!'}
            </p>
          </div>
        </div>

        <Card title={<>Seus lançamentos <span className="font-normal text-zinc-400">· {r.nLancamentos}</span></>} sub="movimentações dos processos em que você é o responsável.">
          <div className="max-h-[34rem] overflow-y-auto scrollbar-thin">
            {txs.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento vinculado aos seus casos ainda.</p>
            ) : txs.map((t) => {
              const st = t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
              return (
                <div key={t.id} className="flex items-center gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">{t.data.slice(0, 5)}</span>
                  {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{t.pagador || t.recebedor || t.party || t.categoria}</span>
                  <span className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${STATUS_TX[st].badge}`}>{STATUS_TX[st].label}</span>
                  <span className={`w-24 shrink-0 text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <p className="mt-4 pb-2 text-center text-xs text-zinc-400">Você vê apenas o financeiro dos seus casos. O caixa geral do escritório é restrito.</p>
      </div>
    </div>
  );
}
