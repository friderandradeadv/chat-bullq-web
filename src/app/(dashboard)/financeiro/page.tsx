'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ReferenceLine, Cell,
} from 'recharts';
import {
  CircleDollarSign, TrendingUp, TrendingDown, Scale, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Info, Target, Users, Sparkles, Loader2, Plus, Trash2, X, Search, Receipt,
  ChevronDown, ChevronRight, Table2, Rocket, HeartHandshake, Scissors, Phone, Trophy, Flame, Calendar,
  Pencil, Check, Layers, Gavel, Landmark, ExternalLink, Wallet, UserCircle2, Banknote, CreditCard, AlertCircle, CalendarClock, Gem,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type FinTransacao, type TxStatus, type AddTransacaoInput, type UpdateTransacaoInput, type Cobranca, type CrescimentoCarteira } from '@/features/financeiro/services/financeiro.service';
import { legalCasesService, type CumprimentoFinanceiro } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import { useAuthStore } from '@/stores/auth-store';
import {
  aggregarClientes, aggregarRetiradas, normNome, mesKey, mesLabel, mesCurtoKey, MESES_PT, STATUS_FIN, type StatusFin, type ClienteFin,
} from '@/features/financeiro/lib/clientes';

const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Nomes vêm em CAPS do Pipefy/Astrea — exibe em Title Case (preserva siglas/conectivos).
const MINUS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'a', 'o']);
const titleCase = (s?: string | null) => (s ?? '').toLowerCase().replace(/\b[\p{L}']+/gu, (w, i) => (i > 0 && MINUS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
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

type View = 'meu' | 'lancamentos' | 'honorarios' | 'cobrancas' | 'cumprimento' | 'retiradas' | 'contas' | 'fluxo' | 'crescimento' | 'projecoes' | 'motivacao' | 'previsoes' | 'verticais';
const TABS: { key: View; label: string; icon: React.ElementType; grupo: string }[] = [
  { key: 'meu', label: 'Meu financeiro', icon: UserCircle2, grupo: 'Pessoal' },
  { key: 'lancamentos', label: 'Lançamentos', icon: Receipt, grupo: 'Caixa' },
  { key: 'honorarios', label: 'Honorários', icon: Users, grupo: 'Caixa' },
  { key: 'cobrancas', label: 'Cobranças', icon: CreditCard, grupo: 'Caixa' },
  { key: 'contas', label: 'Contas', icon: Banknote, grupo: 'Caixa' },
  { key: 'retiradas', label: 'Retiradas', icon: Wallet, grupo: 'Caixa' },
  { key: 'cumprimento', label: 'CS — recebíveis dos processos', icon: Gavel, grupo: 'Processos' },
  { key: 'previsoes', label: 'Previsões da carteira', icon: Sparkles, grupo: 'Sócios' },
  { key: 'verticais', label: 'Verticais (por área)', icon: Layers, grupo: 'Análise & futuro' },
  { key: 'fluxo', label: 'Fluxo de caixa', icon: Table2, grupo: 'Análise & futuro' },
  { key: 'crescimento', label: 'Crescimento', icon: TrendingUp, grupo: 'Análise & futuro' },
  { key: 'projecoes', label: 'Projeções', icon: Rocket, grupo: 'Análise & futuro' },
  { key: 'motivacao', label: 'Motivação', icon: HeartHandshake, grupo: 'Análise & futuro' },
];
const GRUPOS = ['Pessoal', 'Caixa', 'Processos', 'Sócios', 'Análise & futuro'];

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
  // Organismo vivo: refaz sozinho a cada 60s e ao voltar pra aba — reflete movimentação dos processos/recebimentos.
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'dashboard'], queryFn: () => financeiroService.dashboard(), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const [view, setView] = useState<View>('meu');

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

        {/* Menu de seções — dropdown agrupado (compacto, não espalha) */}
        <TabsMenu view={view} setView={setView} lancCount={data.resumoLancamentos?.total} />

        {view === 'meu' && <MeuTab />}
        {view === 'previsoes' && <PrevisoesTab />}
        {view === 'lancamentos' && <LancamentosTab data={data} />}
        {view === 'honorarios' && <HonorariosTab data={data} />}
        {view === 'cobrancas' && <CobrancasTab data={data} />}
        {view === 'cumprimento' && <CumprimentoTab />}
        {view === 'retiradas' && <RetiradasTab data={data} />}
        {view === 'contas' && <ContasTab data={data} />}
        {view === 'verticais' && <VerticaisTab data={data} />}
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

function TabsMenu({ view, setView, lancCount }: { view: View; setView: (v: View) => void; lancCount?: number }) {
  const [open, setOpen] = useState(false);
  const active = TABS.find((t) => t.key === view) ?? TABS[0];
  return (
    <div className="relative z-30 mt-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:border-[#228BE6]/40 dark:border-zinc-800 dark:bg-zinc-900 sm:w-auto sm:min-w-[300px]">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#228BE6]/10 text-[#228BE6]"><active.icon className="h-4 w-4" /></span>
          <span className="truncate">{active.label}</span>
          {view === 'lancamentos' && lancCount != null && <span className="rounded-full bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#228BE6]">{lancCount}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-40 mt-1.5 w-[min(92vw,440px)] rounded-2xl border border-[#DEE2E6] bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            {GRUPOS.map((g) => (
              <div key={g} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{g}</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {TABS.filter((t) => t.grupo === g).map((t) => (
                    <button key={t.key} onClick={() => { setView(t.key); setOpen(false); }} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${view === t.key ? 'bg-[#228BE6]/10 font-semibold text-[#228BE6]' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                      <t.icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{t.label}</span>
                      {t.key === 'lancamentos' && lancCount != null && <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800">{lancCount}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
interface RateioForm { bruto: string; cliente: string; sucumbencia: string; honorarios: string }
interface Editor {
  id: string | null; serieId: string | null; tipo: 'receita' | 'despesa';
  dataISO: string; vencISO: string; pagtoISO: string;
  categoria: string; subtipo: 'inicial' | 'exito'; pagador: string; recebedor: string; valor: string;
  status: TxStatus; parcelas: string; repetir: 'nao' | 'mensal' | 'anual'; escopo: 'uma' | 'proximas'; split: SplitRow[];
  rateio: RateioForm; responsavelId: string; conta: string;
}
const RATEIO_VAZIO: RateioForm = { bruto: '', cliente: '', sucumbencia: '', honorarios: '' };

function LancamentosTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const mesesDisp = useMemo(() => Array.from(new Set(data.transacoes.map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [data.transacoes]);
  const mesHoje = useMemo(() => { const p = hojeBR().split('/'); return `${p[2]}-${p[1]}`; }, []);
  const [mesSel, setMesSel] = useState<string>(mesesDisp.includes(mesHoje) ? mesHoje : (mesesDisp.find((m) => m <= mesHoje) ?? mesesDisp[0] ?? ''));
  const [mostrarFuturas, setMostrarFuturas] = useState(false); // parcelas a receber/pagar de meses futuros só sob demanda
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
      // por padrão esconde parcelas a receber/pagar de meses FUTUROS (só aparecem com o toggle)
      if (!mostrarFuturas && !ehLiquidado(st) && mesKey(t) > mesHoje) return false;
      if (stFiltro === 'a_receber' && ehLiquidado(st)) return false;
      if (stFiltro === 'liquidado' && !ehLiquidado(st)) return false;
      if (respFiltro && (t.responsavelId ?? '') !== respFiltro) return false;
      if (contaFiltro && (t.conta ?? '') !== contaFiltro) return false;
      if (q && !`${t.pagador ?? t.party ?? ''} ${t.recebedor ?? ''} ${t.responsavel ?? ''} ${t.categoria} ${t.data}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.transacoes, mesSel, aba, stFiltro, respFiltro, contaFiltro, busca, mostrarFuturas, mesHoje]);
  const nFuturas = useMemo(() => data.transacoes.filter((t) => !ehLiquidado(txStatus(t)) && mesKey(t) > mesHoje).length, [data.transacoes, mesHoje]);

  const grupos = useMemo(() => {
    const map = new Map<string, FinTransacao[]>();
    for (const t of txs) { const key = mesKey(t); if (!map.has(key)) map.set(key, []); map.get(key)!.push(t); }
    return Array.from(map.entries()).map(([key, items]) => {
      // Liquidados (caixa real: pago/recebido) primeiro; depois os a receber/pagar.
      const ord = [...items].sort((a, b) => (ehLiquidado(txStatus(a)) ? 0 : 1) - (ehLiquidado(txStatus(b)) ? 0 : 1));
      const rec = items.filter((t) => t.valor >= 0).reduce((s, t) => s + t.valor, 0);
      const desp = items.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0);
      return { key, items: ord, rec, desp, saldo: rec - desp };
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

  const [importing, setImporting] = useState(false);
  const openNew = () => setEditor({ id: null, serieId: null, tipo: 'receita', dataISO: toISOInput(hojeBR()), vencISO: '', pagtoISO: toISOInput(hojeBR()), categoria: 'Honorários', subtipo: 'inicial', pagador: '', recebedor: '', valor: '', status: 'recebido', parcelas: '1', repetir: 'nao', escopo: 'uma', split: [], rateio: { ...RATEIO_VAZIO }, responsavelId: '', conta: contas[0]?.id ?? '' });
  const openEdit = (t: FinTransacao) => setEditor({ id: t.id!, serieId: t.serieId ?? null, tipo: t.valor >= 0 ? 'receita' : 'despesa', dataISO: toISOInput(t.data), vencISO: t.vencimento ? toISOInput(t.vencimento) : '', pagtoISO: t.dataPagamento ? toISOInput(t.dataPagamento) : toISOInput(t.data), categoria: t.categoria, subtipo: t.subtipo === 'exito' ? 'exito' : 'inicial', pagador: t.pagador ?? t.party ?? '', recebedor: t.recebedor ?? '', valor: String(Math.abs(t.valor)).replace('.', ','), status: txStatus(t), parcelas: '1', repetir: 'nao', escopo: 'uma', responsavelId: t.responsavelId ?? '', conta: t.conta ?? '', split: (t.split ?? []).filter((s) => s.tipo !== 'escritorio').map((s) => ({ tipo: s.tipo === 'associado' ? 'associado' : 'socio', userId: s.userId ?? '', valor: String(s.valor).replace('.', ',') })), rateio: t.rateio ? { bruto: String(t.rateio.bruto).replace('.', ','), cliente: String(t.rateio.cliente).replace('.', ','), sucumbencia: String(t.rateio.sucumbencia).replace('.', ','), honorarios: String(t.rateio.honorarios).replace('.', ',') } : { ...RATEIO_VAZIO } });
  // ao trocar o pagador (cliente), sugere o responsável se ainda não houver
  const onPagador = (val: string) => setEditor((ed) => ed ? { ...ed, pagador: val, responsavelId: ed.responsavelId || (ed.tipo === 'receita' ? sugereResp(val) : '') } : ed);

  const buildSplit = (ed: Editor) => ed.split.filter((r) => r.userId && parseValor(r.valor) > 0).map((r) => ({ tipo: r.tipo, userId: r.userId, nome: advogados.find((a) => a.id === r.userId)?.name ?? '', valor: parseValor(r.valor) }));
  // rateio (prestação de contas) só faz sentido em honorário de êxito com bruto preenchido
  const ehExito = (ed: Editor) => /honor/i.test(ed.categoria) && ed.subtipo === 'exito';
  const rateioNosso = (r: RateioForm) => parseValor(r.honorarios) + parseValor(r.sucumbencia);
  const buildRateio = (ed: Editor) => (ehExito(ed) && parseValor(ed.rateio.bruto) > 0) ? { bruto: parseValor(ed.rateio.bruto), cliente: parseValor(ed.rateio.cliente), sucumbencia: parseValor(ed.rateio.sucumbencia), honorarios: parseValor(ed.rateio.honorarios) } : null;

  const salvar = () => {
    if (!editor) return;
    const rateio = buildRateio(editor);
    // com rateio de êxito, o que entra no caixa é a parte do escritório (honorário + sucumbência)
    const v = rateio ? rateioNosso(editor.rateio) : parseValor(editor.valor);
    if (!(v > 0)) { toast.error(rateio ? 'Preencha honorário e/ou sucumbência do escritório' : 'Informe um valor maior que zero'); return; }
    const liq = ehLiquidado(editor.status);
    const split = buildSplit(editor);
    const responsavel = advogados.find((a) => a.id === editor.responsavelId)?.name ?? '';
    if (editor.id == null) {
      const reps = editor.repetir === 'nao' ? 1 : Math.max(1, parseInt(editor.parcelas, 10) || 1);
      addM.mutate({ data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, subtipo: /honor/i.test(editor.categoria) ? editor.subtipo : undefined, valor: v, pagador: editor.pagador || undefined, recebedor: editor.recebedor || undefined, vencimento: editor.vencISO ? toBR(editor.vencISO) : undefined, dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : undefined, status: editor.status, parcelas: reps, intervalo: editor.repetir === 'anual' ? 'anual' : 'mensal', split, rateio, responsavelId: editor.responsavelId || undefined, responsavel: responsavel || undefined, conta: editor.conta || undefined });
    } else {
      updM.mutate({ id: editor.id, input: { data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, subtipo: /honor/i.test(editor.categoria) ? editor.subtipo : undefined, valor: v, pagador: editor.pagador || '', recebedor: editor.recebedor || '', vencimento: editor.vencISO ? toBR(editor.vencISO) : '', dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : '', status: editor.status, escopo: editor.escopo, split, rateio, responsavelId: editor.responsavelId || '', responsavel, conta: editor.conta || '' } });
    }
  };
  const quickReceber = (t: FinTransacao) => updM.mutate({ id: t.id!, input: { status: t.valor >= 0 ? 'recebido' : 'pago', dataPagamento: hojeBR(), escopo: 'uma' } });
  const pedirExcluir = (t: FinTransacao) => { if (t.serieId) setSerieDel(t); else if (confirm('Remover este lançamento?')) delM.mutate({ id: t.id!, escopo: 'uma' }); };

  const ehSerie = !!editor?.serieId;
  const statusOpts: TxStatus[] = editor?.tipo === 'despesa' ? ['pago', 'a_pagar'] : ['recebido', 'a_receber'];

  return (
    <Card title={<>Lançamentos <span className="font-normal text-zinc-400">· livro-razão editável</span></>}
      action={<div className="flex items-center gap-2">
        <button onClick={() => setImporting(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-[#02883C] hover:text-[#02883C] dark:border-zinc-700 dark:text-zinc-300"><ArrowDownCircle className="h-3.5 w-3.5" /> Importar extrato</button>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo lançamento</button>
      </div>}>

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
        {nFuturas > 0 && (
          <button onClick={() => setMostrarFuturas((v) => !v)} title="Parcelas a receber/pagar de meses futuros" className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${mostrarFuturas ? 'border-[#228BE6] bg-[#228BE6]/10 text-[#228BE6]' : 'border-zinc-300 text-zinc-500 dark:border-zinc-700'}`}>
            <CalendarClock className="h-3.5 w-3.5" /> {mostrarFuturas ? 'Ocultar futuras' : `Futuras (${nFuturas})`}
          </button>
        )}
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
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{titleCase(t.pagador || t.recebedor || t.party || '') || t.categoria}</span>
                          {t.parcelaNum ? <span className="shrink-0 text-[11px] text-zinc-400">{t.parcelaNum}/{t.parcelaTot}</span> : null}
                          {t.responsavel ? <span className="hidden shrink-0 items-center gap-0.5 rounded bg-zinc-100 px-1 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 lg:inline-flex">{t.responsavel.split(' ')[0]}</span> : null}
                          {t.conta ? <span className="hidden shrink-0 rounded px-1 text-[9px] font-medium text-white lg:inline" style={{ background: contas.find((c) => c.id === t.conta)?.cor ?? '#868E96' }}>{contaNome(t.conta)}</span> : null}
                          {t.manual ? <span className="shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30">manual</span> : null}
                        </span>
                        <span className="hidden w-40 shrink-0 items-center gap-1.5 text-xs text-zinc-500 sm:flex"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(data, t.categoria) }} /><span className="hidden truncate md:inline">{t.categoria}</span></span>
                        <span className="hidden w-20 shrink-0 text-center sm:block"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TX[st].badge}`}>{STATUS_TX[st].label}</span></span>
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

              {(() => {
                const exitoRateio = /honor/i.test(editor.categoria) && editor.subtipo === 'exito' && parseValor(editor.rateio.bruto) > 0;
                const nosso = parseValor(editor.rateio.honorarios) + parseValor(editor.rateio.sucumbencia);
                return (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {exitoRateio
                      ? <Field label="Valor (entra no caixa = honorário + sucumbência)"><input value={brl2(nosso)} readOnly className="w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300" /></Field>
                      : <Field label="Valor (cada parcela)"><input value={editor.valor} onChange={(e) => setEditor({ ...editor, valor: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>}
                    <Field label="Fonte"><select value={editor.categoria} onChange={(e) => setEditor({ ...editor, categoria: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                  </div>
                );
              })()}

              {editor.tipo === 'receita' && /honor/i.test(editor.categoria) && (
                <Field label="Tipo de honorário">
                  <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
                    {([['inicial', 'Inicial (contrato/entrada)'], ['exito', 'Êxito (alvará/acordo)']] as const).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setEditor({ ...editor, subtipo: k })} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${editor.subtipo === k ? (k === 'exito' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white') : 'text-zinc-500'}`}>{label}</button>
                    ))}
                  </div>
                </Field>
              )}

              {/* Prestação de contas — rateio do alvará/acordo (só honorário de êxito) */}
              {editor.tipo === 'receita' && /honor/i.test(editor.categoria) && editor.subtipo === 'exito' && (
                <Field label="Prestação de contas (rateio do alvará/acordo)">
                  <div className="space-y-2.5 rounded-lg border border-violet-200/70 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-900/10">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Do <strong>bruto</strong> recebido, separe o que volta ao <strong>cliente</strong> e o que fica para o escritório (<strong>honorário contratual</strong> + <strong>sucumbência</strong>). O que fica é o que entra no caixa e depois se divide entre os advogados (abaixo).</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Bruto recebido"><input value={editor.rateio.bruto} onChange={(e) => setEditor({ ...editor, rateio: { ...editor.rateio, bruto: e.target.value } })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                      <Field label="Cliente recebe"><input value={editor.rateio.cliente} onChange={(e) => setEditor({ ...editor, rateio: { ...editor.rateio, cliente: e.target.value } })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                      <Field label="Honorário (escritório)"><input value={editor.rateio.honorarios} onChange={(e) => setEditor({ ...editor, rateio: { ...editor.rateio, honorarios: e.target.value } })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                      <Field label="Sucumbência (escritório)"><input value={editor.rateio.sucumbencia} onChange={(e) => setEditor({ ...editor, rateio: { ...editor.rateio, sucumbencia: e.target.value } })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                    </div>
                    {(() => {
                      const bruto = parseValor(editor.rateio.bruto);
                      const cliente = parseValor(editor.rateio.cliente);
                      const nosso = parseValor(editor.rateio.honorarios) + parseValor(editor.rateio.sucumbencia);
                      const conferir = bruto - cliente - nosso;
                      return (
                        <div className="flex items-center justify-between border-t border-violet-200/60 pt-2 text-[11px] dark:border-violet-900/40">
                          <span className="text-zinc-500 dark:text-zinc-400">Escritório (caixa): <strong className="text-violet-700 dark:text-violet-300">{brl2(nosso)}</strong></span>
                          {bruto > 0 && Math.abs(conferir) > 0.01 && <span className="text-amber-600 dark:text-amber-400">⚠️ bruto ≠ cliente + escritório (dif. {brl2(conferir)})</span>}
                        </div>
                      );
                    })()}
                  </div>
                </Field>
              )}

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
                      {(() => { const exitoR = editor.subtipo === 'exito' && parseValor(editor.rateio.bruto) > 0; const v = exitoR ? parseValor(editor.rateio.honorarios) + parseValor(editor.rateio.sucumbencia) : parseValor(editor.valor); const assigned = editor.split.reduce((s, r) => s + parseValor(r.valor), 0); const sobra = v - assigned; return <span className={`text-[11px] ${sobra < -0.01 ? 'text-rose-600' : 'text-zinc-400'}`}>Escritório: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(Math.max(0, sobra))}</strong>{sobra < -0.01 ? ' · rateio excede o valor!' : ''}</span>; })()}
                    </div>
                  </div>
                </Field>
              )}

              {!editor.id && (
                <Field label="Repetir lançamento">
                  <div className="flex flex-wrap items-center gap-2">
                    <Layers className="h-4 w-4 shrink-0 text-zinc-400" />
                    <select value={editor.repetir} onChange={(e) => { const r = e.target.value as Editor['repetir']; setEditor({ ...editor, repetir: r, parcelas: r === 'nao' ? '1' : (+editor.parcelas > 1 ? editor.parcelas : '12') }); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                      <option value="nao">Não repetir</option>
                      <option value="mensal">Mensalmente</option>
                      <option value="anual">Anualmente</option>
                    </select>
                    {editor.repetir !== 'nao' && (
                      <>
                        <span className="text-xs text-zinc-400">por</span>
                        <input type="number" min={2} max={120} value={editor.parcelas} onChange={(e) => setEditor({ ...editor, parcelas: e.target.value })} className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                        <span className="text-xs text-zinc-400">{editor.repetir === 'anual' ? 'ano(s)' : 'mês(es)'}</span>
                      </>
                    )}
                  </div>
                  {editor.repetir !== 'nao' && +editor.parcelas > 1 && <p className="mt-1.5 text-xs text-zinc-400">{editor.parcelas}× de {brl2(parseValor(editor.valor))} ({editor.repetir === 'anual' ? '1 por ano' : '1 por mês'}) · total {brl2(parseValor(editor.valor) * (+editor.parcelas || 1))}</p>}
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

      {importing && <ImportExtratoModal contas={contas} onClose={() => setImporting(false)} />}
    </Card>
  );
}

// ── Modal: importar extrato (PDF/CSV/OFX) → lançamentos, com dedup server-side ──
function ImportExtratoModal({ contas, onClose }: { contas: { id: string; nome: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [conta, setConta] = useState(contas[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [parsing, setParsing] = useState(false);
  const [conf, setConf] = useState<import('@/features/financeiro/services/financeiro.service').ExtratoConferencia | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());

  const conferir = async (linhas: { data: string; valor: number; descricao: string }[]) => {
    if (!linhas.length) { toast.error('Não consegui ler lançamentos desse arquivo. Tente OFX/CSV ou cole o texto.'); return; }
    try {
      const r = await financeiroService.conferirExtrato(conta || null, linhas);
      setConf(r);
      setSel(new Set(r.linhas.map((l, i) => (!l.duplicado ? i : -1)).filter((i) => i >= 0))); // novos marcados
      if (r.novos === 0) toast('Tudo nesse extrato já está lançado — nada novo.', { icon: '✅' });
      else toast.success(`${r.novos} novo(s) · ${r.duplicados} já existem`);
    } catch (e: any) { toast.error(e?.message || 'Erro ao conferir'); }
  };
  const onArquivo = async (f: File) => {
    setNome(f.name); setParsing(true); setConf(null);
    try {
      const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      let texto = '';
      if (isPdf) { const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(f); }); texto = (await financeiroService.lerExtratoPdf(b64)).texto; }
      else texto = await f.text();
      let linhas = lerExtrato(texto);
      if (linhas.length === 0) linhas = await financeiroService.extrairExtrato(texto);
      await conferir(linhas);
    } catch (e: any) { toast.error(e?.message || 'Erro ao ler o arquivo'); } finally { setParsing(false); }
  };

  const importM = useMutation({
    mutationFn: () => { if (!conf) throw new Error('confira primeiro'); const linhas = conf.linhas.filter((_, i) => sel.has(i)).map((l) => ({ data: l.data, valor: l.valor, descricao: l.descricao })); return financeiroService.importarExtratoLinhas(conta || null, linhas); },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success(`${r.importados} lançamento(s) importado(s)${r.duplicados ? ` · ${r.duplicados} já existiam` : ''}`); onClose(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar'),
  });

  const toggle = (i: number) => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl scrollbar-thin dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><ArrowDownCircle className="h-4 w-4 text-[#02883C]" /> Importar extrato</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div><label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">Conta</label>
            <select value={conta} onChange={(e) => setConta(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">— sem conta —</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />} Escolher arquivo (PDF/CSV/OFX)
            <input type="file" accept=".pdf,.csv,.ofx,.txt,.tsv,text/csv,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.currentTarget.value = ''; }} />
          </label>
          {nome && <span className="text-xs text-zinc-400">{nome}</span>}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Lê o arquivo, classifica e <strong>não duplica</strong>: confere cada linha contra o que já está no caixa (por valor+data) e contra reenvio do mesmo arquivo.</p>

        {conf && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-500">{conf.novos} novo(s) · <span className="text-amber-600">{conf.duplicados} já existe(m)</span></span>
              <span className="text-xs text-zinc-400">{sel.size} selecionado(s)</span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200/70 scrollbar-thin dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-zinc-900"><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium"></th><th className="px-2 py-1.5 font-medium">Data</th><th className="px-2 py-1.5 font-medium">Descrição</th><th className="px-2 py-1.5 text-right font-medium">Valor</th><th className="px-2 py-1.5 font-medium">Status</th></tr></thead>
                <tbody>
                  {conf.linhas.map((l, i) => (
                    <tr key={i} className={`border-t border-zinc-100 dark:border-zinc-800 ${l.duplicado ? 'opacity-60' : ''}`}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(i)} onChange={() => toggle(i)} className="accent-[#02883C]" /></td>
                      <td className="px-2 py-1.5 tabular-nums text-zinc-500">{l.data}</td>
                      <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">{l.descricao || '—'}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${l.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(l.valor)}</td>
                      <td className="px-2 py-1.5">{l.duplicado ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title={l.motivo || ''}>Já existe</span> : <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Novo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => importM.mutate()} disabled={importM.isPending || sel.size === 0} className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{importM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Importar ${sel.size} selecionado(s)`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
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
    const entradas = honor.filter((t) => t.valor >= 0);
    const recebido = Math.round(entradas.reduce((s, t) => s + t.valor, 0));
    const repassado = Math.round(honor.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0));
    const exito = Math.round(entradas.filter((t) => t.subtipo === 'exito').reduce((s, t) => s + t.valor, 0));
    const inicial = recebido - exito; // tudo que não é êxito = inicial (contrato/entrada)
    const porStatus = (st: StatusFin) => clientes.filter((c) => c.status === st).length;
    return { recebido, repassado, inicial, exito, liquido: recebido - repassado, nClientes: clientes.length, emDia: porStatus('em-dia'), atencao: porStatus('atencao') };
  }, [clientes, dataF.transacoes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => (filtro === 'todos' || c.status === filtro) && (!q || c.nome.toLowerCase().includes(q)));
  }, [clientes, filtro, busca]);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Honorários recebidos" value={brl(tot.recebido)} hint={`${tot.nClientes} clientes`} accent="#2F9E44" />
        <MiniStat label="Iniciais (contrato)" value={brl(tot.inicial)} hint="entrada / parcelas do contrato" accent="#10B981" />
        <MiniStat label="De êxito (alvará/acordo)" value={brl(tot.exito)} hint="ganho no processo" accent="#7048E8" />
        <MiniStat label="Líquido p/ o escritório" value={brl(tot.liquido)} hint="recebido − repassado" accent="#228BE6" />
        <MiniStat label="Em dia / Atenção" value={`${tot.emDia} / ${tot.atencao}`} hint="recorrentes que pararam" accent="#F59F00" />
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
  <a href={`/processos/${id}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-zinc-700 hover:text-[#228BE6] hover:underline dark:text-zinc-200"><span className="truncate">{children}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-50" /></a>
);

// Editor inline do nº do processo (numero_cs) direto na aba CS — salva no card.
function EditNumeroCs({ caseId, value }: { caseId: string; value: string | null }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await legalCasesService.saveFaseField(caseId, 'cumprimento', 'numero_cs', val.trim());
      await qc.invalidateQueries({ queryKey: ['financeiro', 'cumprimento'] });
      toast.success('Número do processo salvo.');
      setEditing(false);
    } catch { toast.error('Não consegui salvar o número.'); } finally { setSaving(false); }
  };
  if (editing) return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} placeholder="0000000-00.0000.0.00.0000" className="w-44 rounded border border-zinc-300 px-1.5 py-0.5 text-right text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
      <button onClick={save} disabled={saving} className="text-emerald-600 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
    </span>
  );
  return (
    <button onClick={() => { setVal(value ?? ''); setEditing(true); }} className="group inline-flex max-w-full items-center gap-1 text-xs text-zinc-500 hover:text-[#228BE6]" title="Editar nº do processo">
      {value ? <span className="truncate whitespace-nowrap tabular-nums">{value}</span> : <span className="italic text-zinc-300 dark:text-zinc-600">+ adicionar nº</span>}
      <Pencil className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60" />
    </button>
  );
}

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
  const brutoCump = r2(cumpCheio.reduce((s, x) => s + (x.valorCalculo || 0), 0));
  const t = {
    nPrestacao: prestacao.length, aReceberPrestacao: r2(prestacao.reduce((s, x) => s + (x.aReceberNosso || 0), 0)),
    nCumprimento: cumprimento.length, brutoEmCumprimento: brutoCump, nossoEmCumprimento: r2(brutoCump * 0.4),
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
        <MiniStat label="Em cumprimento (nosso ~40%)" value={brl(t.nossoEmCumprimento)} hint={`${t.nCumprimento} caso(s) · ${brl(t.brutoEmCumprimento)} bruto`} accent="#228BE6" />
        <MiniStat label="Sentenças favoráveis (estimado)" value={brl(t.estimadoFavoraveis)} hint={`${t.nFavoraveis} caso(s) · maior risco`} accent="#F59F00" />
        <MiniStat label="Total a receber (nosso)" value={brl(t.aReceberPrestacao + t.nossoEmCumprimento + t.estimadoFavoraveis)} hint="prestação + 40% cumprimento + sentenças" accent="#7048E8" />
      </div>

      {/* Prestação de contas — nosso */}
      <Card title="Prestação de contas — já é nosso (caixa real)" sub="o que entra pra nós: honorários contratuais + sucumbência.">
        {prestacaoCheia.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nenhuma prestação de contas com valores preenchidos.{prestVazio > 0 ? ` ${prestVazio} processo(s) nesta fase aguardando o preenchimento no card.` : ''}</p>
        ) : (
          <CsTabela cols={['Cliente', 'Nossos honorários', 'Sucumbência', 'A receber']}
            foot={<tr className="font-bold text-zinc-700 dark:text-zinc-100">
              <td className="px-2 py-1.5">Total ({prestacaoCheia.length})</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{brl2(prestacaoCheia.reduce((s, x) => s + x.honorariosNossos, 0))}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{brl2(prestacaoCheia.reduce((s, x) => s + (x.sucumbencia || 0), 0))}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{brl2(t.aReceberPrestacao)}</td>
            </tr>}>
            {prestacaoCheia.map((x) => (
              <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1.5"><VerProcesso id={x.caseId}>{titleCase(x.cliente || x.title)}</VerProcesso></td>
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
            <CsTabela cols={['Cliente', 'Valor do cálculo', 'Situação', 'Nº dos autos']} widths={['30%', '20%', '18%', '32%']}
              foot={<tr className="font-bold text-zinc-700 dark:text-zinc-100">
                <td className="px-2 py-1.5">Total ({cumpCheio.length})</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#228BE6]">{brl2(t.brutoEmCumprimento)}</td>
                <td className="px-2 py-1.5 text-center text-[11px] font-semibold text-zinc-500">nosso ~40%: {brl(t.nossoEmCumprimento)}</td>
                <td className="px-2 py-1.5" />
              </tr>}>
              {cumpCheio.map((x) => (
                <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5"><VerProcesso id={x.caseId}>{titleCase(x.cliente || x.title)}</VerProcesso></td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-[#228BE6]">{brl2(x.valorCalculo)}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${x.protocolado ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'}`}>{x.protocolado ? 'Protocolado' : 'A protocolar'}</span></td>
                  <td className="px-2 py-1.5 text-right"><EditNumeroCs caseId={x.caseId} value={x.numeroCs} /></td>
                </tr>
              ))}
            </CsTabela>
            {cumpVazio > 0 && <p className="mt-2 text-[11px] text-zinc-400">+ {cumpVazio} processo(s) em cumprimento sem o valor do cálculo preenchido no card.</p>}
          </>
        )}
      </Card>

      {/* Sentenças favoráveis — parâmetro */}
      {favoraveis.length > 0 && (
        <Card title="Sentenças favoráveis — parâmetro (maior risco)" sub="ganhamos em 1º grau mas ainda cabe recurso/reforma. ✨ = estimativa de IA (valor da causa + dano moral → nossa parte); senão, valor da causa × % de êxito.">
          <CsTabela cols={['Cliente', 'Resultado', 'Base', 'Estimado (nosso)']}
            foot={<tr className="font-bold text-zinc-700 dark:text-zinc-100">
              <td className="px-2 py-1.5">Total ({favoraveis.length})</td>
              <td className="px-2 py-1.5" /><td className="px-2 py-1.5" />
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-600">{brl2(t.estimadoFavoraveis)}</td>
            </tr>}>
            {favoraveis.map((x) => (
              <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1.5"><VerProcesso id={x.caseId}>{titleCase(x.cliente || x.title)}</VerProcesso></td>
                <td className="px-2 py-1.5 text-right text-xs text-zinc-500">{/parcial/i.test(x.resultado || '') ? 'Parcial' : /procedente/i.test(x.resultado || '') ? 'Procedente' : (x.resultado || '—')}</td>
                <td className="px-2 py-1.5 text-right text-[11px] text-zinc-400">{x.manualEstimado ? '✨ IA' : (x.exito != null ? `êxito ${x.exito}%` : '—')}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-600">{x.estimado != null ? brl2(x.estimado) : '—'}</td>
              </tr>
            ))}
          </CsTabela>
        </Card>
      )}
    </>
  );
}

function CsTabela({ cols, children, foot, w0 = '44%', widths }: { cols: string[]; children: React.ReactNode; foot?: React.ReactNode; w0?: string; widths?: string[] }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full table-fixed text-sm">
        <colgroup>{cols.map((c, i) => <col key={c} style={{ width: widths ? widths[i] : (i === 0 ? w0 : undefined) }} />)}</colgroup>
        <thead><tr className="text-[11px] uppercase tracking-wide text-zinc-400">{cols.map((c, i) => <th key={c} className={`px-2 py-1.5 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
        {foot && <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700">{foot}</tfoot>}
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
  const contas = data.contas ?? [];
  type RetEd = { id: string | null; tipo: 'Pró-labore' | 'Retirada'; recebedor: string; dataISO: string; valor: string; conta: string };
  const [ed, setEd] = useState<RetEd | null>(null);
  const inval = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
  const openNovo = (nome?: string) => setEd({ id: null, tipo: 'Pró-labore', recebedor: nome ?? '', dataISO: toISOInput(hojeBR()), valor: '', conta: contas[0]?.id ?? '' });
  const openEdit = (t: FinTransacao) => setEd({ id: t.id ?? null, tipo: t.categoria === 'Retirada' ? 'Retirada' : 'Pró-labore', recebedor: t.recebedor ?? t.party ?? '', dataISO: toISOInput(t.data), valor: String(Math.abs(t.valor)).replace('.', ','), conta: t.conta ?? '' });
  const saveM = useMutation({
    mutationFn: async () => {
      if (!ed) throw new Error('sem editor');
      const base = { data: toBR(ed.dataISO), tipo: 'despesa' as const, categoria: ed.tipo, valor: parseValor(ed.valor), recebedor: ed.recebedor || undefined, conta: ed.conta || undefined, status: 'pago' as const };
      if (ed.id) await financeiroService.updateTransacao(ed.id, { ...base, recebedor: ed.recebedor || '', conta: ed.conta || '', escopo: 'uma' });
      else await financeiroService.addTransacao(base);
    },
    onSuccess: () => { inval(); toast.success(ed?.id ? 'Retirada atualizada' : 'Retirada lançada'); setEd(null); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });
  const delM = useMutation({ mutationFn: (id: string) => financeiroService.removeTransacao(id, 'uma'), onSuccess: () => { inval(); toast.success('Retirada removida'); }, onError: (e: any) => toast.error(e?.message || 'Erro ao remover') });
  const retiradas = useMemo(() => data.transacoes.filter((t) => t.categoria === 'Pró-labore' || t.categoria === 'Retirada').sort((a, b) => toISOInput(b.data).localeCompare(toISOInput(a.data))), [data.transacoes]);

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  const totalParts = r.porUser.reduce((s, u) => s + u.aReceber, 0);

  return (
    <>
      <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-zinc-800 dark:from-cyan-900/15 dark:to-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Wallet className="h-5 w-5 text-[#15AABF]" /> Retiradas e pró-labore</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
            Quando um honorário entra, o rateio (no lançamento) separa a parte do <strong>escritório</strong>, do <strong>sócio</strong> e do <strong>associado</strong>. Aqui você vê quanto cada advogado tem a receber e quanto já retirou — e lança novas retiradas.
          </p>
        </div>
        <button onClick={() => openNovo()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#15AABF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1098AD]"><Plus className="h-4 w-4" /> Nova retirada</button>
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
                  <td className="px-2 py-1.5 text-right"><button onClick={() => openNovo(u.nome)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:border-[#15AABF] hover:text-[#15AABF] dark:border-zinc-700 dark:text-zinc-300">Lançar retirada</button></td>
                </tr>
              ))}
              {r.porUser.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">Nenhum advogado ativo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">A parte de cada advogado vem do rateio definido na hora do recebimento do honorário (no lançamento). Sem rateio, o valor inteiro fica com o escritório.</p>
      </Card>

      <Card title="Retiradas lançadas" sub="pró-labore e retiradas pagas — clique para editar ou remover.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Data</th><th className="px-2 py-1.5 font-medium">Tipo</th><th className="px-2 py-1.5 font-medium">Recebedor</th><th className="px-2 py-1.5 font-medium">Conta</th><th className="px-2 py-1.5 text-right font-medium">Valor</th><th className="w-20"></th></tr></thead>
            <tbody>
              {retiradas.map((t) => {
                const conta = contas.find((c) => c.id === t.conta);
                return (
                  <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1.5 tabular-nums text-zinc-600 dark:text-zinc-300">{t.data}</td>
                    <td className="px-2 py-1.5"><span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${t.categoria === 'Retirada' ? 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'}`}>{t.categoria}</span></td>
                    <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">{t.recebedor || t.party || '—'}</td>
                    <td className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">{conta?.nome || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-rose-600">{brl2(Math.abs(t.valor))}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-[#15AABF] dark:hover:bg-zinc-800" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (t.id && confirm('Remover esta retirada?')) delM.mutate(t.id); }} className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {retiradas.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-zinc-400">Nenhuma retirada lançada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: lançar / editar retirada */}
      {ed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEd(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-zinc-800 dark:text-zinc-100">{ed.id ? 'Editar retirada' : 'Nova retirada'}</h3>
            <div className="space-y-3">
              <Field label="Tipo">
                <div className="flex gap-2">
                  {(['Pró-labore', 'Retirada'] as const).map((tp) => (
                    <button key={tp} onClick={() => setEd({ ...ed, tipo: tp })} className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium ${ed.tipo === tp ? 'border-[#15AABF] bg-cyan-50 text-[#15AABF] dark:bg-cyan-900/20' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'}`}>{tp}</button>
                  ))}
                </div>
              </Field>
              <Field label="Recebedor">
                <input list="ret-advs" value={ed.recebedor} onChange={(e) => setEd({ ...ed, recebedor: e.target.value })} placeholder="Nome do advogado" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                <datalist id="ret-advs">{advs.map((a) => <option key={a.id} value={a.name} />)}</datalist>
              </Field>
              <Field label="Conta">
                <select value={ed.conta} onChange={(e) => setEd({ ...ed, conta: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">— sem conta —</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data"><input type="date" value={ed.dataISO} onChange={(e) => setEd({ ...ed, dataISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                <Field label="Valor"><input value={ed.valor} onChange={(e) => setEd({ ...ed, valor: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEd(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => saveM.mutate()} disabled={saveM.isPending || !(parseValor(ed.valor) > 0)} className="inline-flex items-center gap-1 rounded-lg bg-[#15AABF] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : ed.id ? 'Salvar' : 'Lançar retirada'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ ABA · VERTICAIS (POR ÁREA) ═══════════════════════

const CORES_AREA: Record<string, string> = {
  'Bancário': '#7048E8', 'Previdenciário': '#228BE6', 'Trabalhista': '#E8590C',
  'Consumidor': '#0CA678', 'Cível': '#F08C00', 'Geral (escritório)': '#868E96', 'Não identificada': '#ADB5BD',
};
const corArea = (a: string) => CORES_AREA[a] ?? '#15AABF';

function VerticaisTab({ data }: { data: FinDashboard }) {
  const verticais = data.crescimento?.verticalArea ?? [];
  const carteira = data.crescimento?.carteira.porArea ?? [];
  const totRec = verticais.reduce((s, v) => s + v.receita, 0);
  const totDesp = verticais.reduce((s, v) => s + v.despesa, 0);
  const recVerticais = verticais.filter((v) => v.receita > 0).sort((a, b) => b.receita - a.receita);
  const naoId = verticais.find((v) => v.area === 'Não identificada')?.receita ?? 0;
  const chart = recVerticais.map((v) => ({ area: v.area, receita: v.receita }));

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-violet-50 to-white p-5 dark:border-zinc-800 dark:from-violet-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Layers className="h-5 w-5 text-[#7048E8]" /> Verticais por área</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Quanto cada área (<strong>Bancário</strong>, <strong>Previdenciário</strong>, <strong>Trabalhista</strong>…) traz de honorário recebido e quanto pesa de despesa. A receita é casada pelo cliente do processo; despesas gerais do escritório ficam fora das áreas.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Receita por área (honorários)" value={brl(totRec)} hint="recebido, casado por cliente" accent="#2F9E44" />
        <MiniStat label="Despesa atribuída" value={brl(totDesp)} hint="repasses + geral" accent="#E03131" />
        <MiniStat label="Áreas com receita" value={String(recVerticais.filter((v) => v.area !== 'Não identificada').length)} hint="verticais ativas" accent="#7048E8" />
        <MiniStat label="Não identificada" value={brl(naoId)} hint="cliente sem processo casado" accent="#ADB5BD" />
      </div>

      {chart.length > 0 ? (
        <Card title="Receita recebida por área" sub="honorários casados ao cliente do processo.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis type="number" tickFormatter={(v) => brl(v)} tick={{ fontSize: 11 }} className="text-zinc-400" />
                <YAxis type="category" dataKey="area" width={110} tick={{ fontSize: 12 }} className="text-zinc-500" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="receita" name="Receita" radius={[0, 6, 6, 0]} barSize={22}>
                  {chart.map((c) => <Cell key={c.area} fill={corArea(c.area)} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card title="Receita recebida por área"><p className="py-8 text-center text-sm text-zinc-400">Ainda não há honorários recebidos casados a um cliente com processo. Lance honorários com o nome do cliente igual ao do processo para verticalizar.</p></Card>
      )}

      <Card title="Resumo por área" sub="receita recebida, despesa atribuída e resultado.">
        <CsTabela cols={['Área', 'Receita', 'Despesa', 'Resultado', '% receita']} w0="34%">
          {verticais.map((v) => (
            <tr key={v.area} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-2 py-1.5"><span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corArea(v.area) }} />{v.area}</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{v.receita ? brl2(v.receita) : '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{v.despesa ? brl2(v.despesa) : '—'}</td>
              <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${v.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(v.resultado)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{totRec > 0 && v.receita > 0 ? `${Math.round((v.receita / totRec) * 100)}%` : '—'}</td>
            </tr>
          ))}
          {verticais.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">Sem dados de verticalização ainda.</td></tr>}
        </CsTabela>
      </Card>

      {carteira.length > 0 && (
        <Card title="Carteira em processo por área" sub="honorário provável (valor da causa × chance de êxito × % do escritório) — ainda não é caixa.">
          <CsTabela cols={['Área', 'Carteira provável', '% da carteira']} w0="40%">
            {(() => { const tot = carteira.reduce((s, c) => s + c.valor, 0); return carteira.map((c) => (
              <tr key={c.area} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1.5"><span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corArea(c.area) }} />{c.area}</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-violet-600">{brl2(c.valor)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{tot > 0 ? `${Math.round((c.valor / tot) * 100)}%` : '—'}</td>
              </tr>
            )); })()}
          </CsTabela>
        </Card>
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

type ExtratoLinha = { data: string; valor: number; descricao: string };
// Parser OFX (.ofx — exportação padrão de banco; Nubank/ASAAS/MP oferecem). Lê os <STMTTRN>.
function parseOfx(text: string): ExtratoLinha[] {
  const out: ExtratoLinha[] = [];
  const blocos = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const tag = (t: string) => { const m = b.match(new RegExp(`<${t}>([^<\\r\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
    const dt = tag('DTPOSTED').replace(/[^\d]/g, '').slice(0, 8); // YYYYMMDD
    const amt = Number(tag('TRNAMT').replace(/[^\d.-]/g, ''));
    if (dt.length !== 8 || !Number.isFinite(amt)) continue;
    const data = `${dt.slice(6, 8)}/${dt.slice(4, 6)}/${dt.slice(0, 4)}`;
    const desc = (tag('MEMO') || tag('NAME') || '').slice(0, 140);
    out.push({ data, valor: amt, descricao: desc });
  }
  return out;
}
// Detecta o formato e lê (OFX ou CSV/TSV).
function lerExtrato(text: string): ExtratoLinha[] {
  if (/<STMTTRN>|<OFX>/i.test(text)) return parseOfx(text);
  return parseExtrato(text);
}
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

// ── Integração ASAAS: puxa o extrato direto da API e cria os lançamentos ──
function AsaasImport() {
  const qc = useQueryClient();
  const hoje = useMemo(() => toISOInput(hojeBR()), []);
  const inicioMes = useMemo(() => { const p = hojeBR().split('/'); return `${p[2]}-${p[1]}-01`; }, []);
  const [desde, setDesde] = useState(inicioMes);
  const [ate, setAte] = useState(hoje);
  const [prev, setPrev] = useState<import('@/features/financeiro/services/financeiro.service').AsaasPreview | null>(null);
  const { data: status } = useQuery({ queryKey: ['asaas', 'status'], queryFn: () => financeiroService.asaasStatus(), staleTime: 600_000 });

  const previewM = useMutation({
    mutationFn: () => financeiroService.asaasPreview(desde, ate),
    onSuccess: (r) => { setPrev(r); if (!r.configurado) toast.error('ASAAS não configurado no servidor.'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao consultar o ASAAS'),
  });
  const importM = useMutation({
    mutationFn: () => financeiroService.asaasImportar(desde, ate),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success(`${r.importados} lançamento(s) importado(s) do ASAAS`); previewM.mutate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar do ASAAS'),
  });

  if (status && !status.configurado) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
        <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300"><Landmark className="h-4 w-4" /> Integração ASAAS não configurada</p>
        <p className="mt-1 text-amber-700/90 dark:text-amber-200/80">Defina a chave <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">ASAAS_API_KEY</code> no servidor para puxar o extrato automaticamente.</p>
      </div>
    );
  }

  return (
    <Card title="Importar do ASAAS (extrato → caixa)" sub="sincroniza sozinho de hora em hora (pagamentos, taxas e compras viram lançamentos, sem duplicar). Use abaixo para puxar um período específico na hora.">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">De</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
        <div><label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">Até</label><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
        <button onClick={() => previewM.mutate()} disabled={previewM.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-[#0052FF] hover:text-[#0052FF] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{previewM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pré-visualizar</button>
        {prev?.configurado && (prev.novos ?? 0) > 0 && (
          <button onClick={() => importM.mutate()} disabled={importM.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{importM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />} Importar {prev.novos} novo(s)</button>
        )}
        {typeof prev?.saldo === 'number' && <span className="ml-auto text-xs text-zinc-400">Saldo ASAAS: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(prev.saldo)}</strong></span>}
      </div>

      {prev?.configurado && (
        <div className="mt-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <MiniStat label="Novos a importar" value={String(prev.novos ?? 0)} hint={`${prev.total ?? 0} no extrato`} accent="#0052FF" />
            <MiniStat label="Receitas (novos)" value={brl(prev.receitas ?? 0)} hint="pagamentos recebidos" accent="#2F9E44" />
            <MiniStat label="Despesas (novos)" value={brl(prev.despesas ?? 0)} hint="taxas + compras" accent="#E03131" />
            <MiniStat label="Já importados" value={String(prev.jaImportados ?? 0)} hint={`${prev.ignorados ?? 0} ignorados (transf.)`} accent="#868E96" />
          </div>
          {(prev.amostra?.length ?? 0) > 0 && (
            <div className="mt-3 overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1 font-medium">Data</th><th className="px-2 py-1 font-medium">Categoria</th><th className="px-2 py-1 font-medium">Quem</th><th className="px-2 py-1 text-right font-medium">Valor</th></tr></thead>
                <tbody>
                  {prev.amostra!.map((a, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1 tabular-nums text-zinc-500">{a.data}</td>
                      <td className="px-2 py-1 text-zinc-700 dark:text-zinc-200">{a.categoria}</td>
                      <td className="px-2 py-1 text-zinc-500">{a.party || '—'}</td>
                      <td className={`px-2 py-1 text-right font-semibold tabular-nums ${a.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(a.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(prev.novos ?? 0) > (prev.amostra?.length ?? 0) && <p className="mt-1.5 text-[11px] text-zinc-400">…e mais {(prev.novos ?? 0) - (prev.amostra?.length ?? 0)} lançamento(s).</p>}
            </div>
          )}
          {(prev.novos ?? 0) === 0 && <p className="mt-2 text-sm text-zinc-400">Nada novo nesse intervalo — tudo já importado ou só transferências (ignoradas).</p>}
        </div>
      )}
    </Card>
  );
}

function ContasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const contas = data.contas ?? [];
  const [conc, setConc] = useState<{ conta: string; texto: string } | null>(null);
  const [concResult, setConcResult] = useState<{ conciliados: number; semPar: { data: string; valor: number; descricao: string }[] } | null>(null);
  const [concLinhas, setConcLinhas] = useState<ExtratoLinha[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [upLoading, setUpLoading] = useState(false);
  const [upNome, setUpNome] = useState('');
  const onArquivo = async (f: File) => {
    setUpNome(f.name); setUpLoading(true); setConcResult(null); setConcLinhas([]);
    try {
      const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      let texto = '';
      if (isPdf) {
        const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(f); });
        texto = (await financeiroService.lerExtratoPdf(b64)).texto;
      } else {
        texto = await f.text();
      }
      setConc((c) => (c ? { ...c, texto } : c));
      // OFX/CSV tabular: regex local (rápido). Senão (PDF do Nubank, texto livre): IA parseia.
      let linhas = lerExtrato(texto);
      if (linhas.length === 0) linhas = await financeiroService.extrairExtrato(texto);
      setConcLinhas(linhas);
      if (linhas.length === 0) toast.error('Não consegui ler lançamentos desse arquivo. Tente OFX ou cole o texto do extrato.');
      else toast.success(`${linhas.length} lançamento(s) lido(s) do extrato`);
    } catch (e: any) { toast.error(e?.message || 'Erro ao ler o arquivo'); } finally { setUpLoading(false); }
  };
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
  const analisar = async () => {
    if (!conc) return;
    let linhas = concLinhas.length ? concLinhas : lerExtrato(conc.texto);
    if (!linhas.length && conc.texto.trim()) {
      setIaLoading(true);
      try { linhas = await financeiroService.extrairExtrato(conc.texto); setConcLinhas(linhas); }
      catch { /* trata abaixo */ }
      finally { setIaLoading(false); }
    }
    if (!linhas.length) { toast.error('Não consegui ler nenhuma linha. Suba um extrato (PDF/OFX/CSV) ou cole o texto com data, valor e descrição.'); return; }
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
          <button onClick={() => { setConc({ conta: contas[0]?.id ?? '', texto: '' }); setConcResult(null); setConcLinhas([]); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"><Sparkles className="h-3.5 w-3.5" /> Importar extrato</button>
        </div>
      </div>

      <AsaasImport />

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
              <Field label="Suba o extrato (OFX, CSV ou PDF do banco)">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#7048E8]/40 bg-[#7048E8]/5 px-3 py-4 text-sm font-medium text-[#7048E8] transition hover:bg-[#7048E8]/10">
                  {upLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  {upLoading ? 'Lendo arquivo…' : (upNome || 'Escolher arquivo (.ofx, .csv, .pdf)')}
                  <input type="file" accept=".ofx,.csv,.txt,.pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = ''; }} />
                </label>
                <p className="mt-1 text-[11px] text-zinc-400">No app do banco (Nubank/ASAAS/Mercado Pago): exportar extrato em OFX (mais preciso) ou PDF. A plataforma lê e faz o caixa.</p>
              </Field>
              <Field label="…ou cole o extrato (CSV: data; valor; descrição)">
                <textarea value={conc.texto} onChange={(e) => { setConc({ ...conc, texto: e.target.value }); setConcResult(null); setConcLinhas([]); }} rows={4} placeholder={'10/06/2026;47,00;Pix recebido Júlia Macedo\n12/06/2026;-2850,00;Aluguel Top Office'} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900" />
              </Field>
              <button onClick={analisar} disabled={iaLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{iaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Analisar e casar</button>

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

const MES_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtMesKey = (mk: string) => { const [y, m] = (mk || '').split('-'); const i = +m - 1; return MES_ABBR[i] ? `${MES_ABBR[i]}/${y.slice(2)}` : mk; };

function CrescimentoTab({ data }: { data: FinDashboard }) {
  const c = data.crescimento;
  const crescQ = useQuery({ queryKey: ['crescimento-carteira'], queryFn: () => financeiroService.getCrescimentoCarteira(), staleTime: 5 * 60_000 });
  const cc = crescQ.data;
  const realizados = data.meses.filter((m) => !m.projecao);
  const serie = realizados.map((m, i) => {
    const prev = realizados[i - 1];
    const mom = prev && prev.receita > 0 ? ((m.receita - prev.receita) / prev.receita) * 100 : null;
    return { nome: mesCurto(m.label), receita: m.receita, resultado: m.resultado, mom, label: m.label, key: m.key };
  });

  // Valuation: faturamento anual × múltiplo + carteira em processo (× peso) + recebíveis + recorrente + caixa
  const [mult, setMult] = useState(1.5);
  const [pesoCarteira, setPesoCarteira] = useState(50);
  const val = useMemo(() => {
    if (!c) return null;
    const fatur = c.receita.r12m * mult;
    const carteira = c.carteira.honorariosEscritorio * (pesoCarteira / 100);
    const total = fatur + carteira + c.recebiveisCS + c.recorrente.saldoDevedor + c.caixaAtual;
    return { fatur, carteira, total };
  }, [c, mult, pesoCarteira]);

  return (
    <>
      {cc && <CrescimentoFundacao cc={cc} />}
      {c && val && (
        <>
          {/* Patrimônio / valuation — o valor real do escritório, além do que já entrou */}
          <Card title={<span className="flex items-center gap-2"><Gem className="h-4 w-4 text-[#7048E8]" /> Quanto vale o escritório hoje</span>}
            sub="muito além da receita recebida: a carteira de honorários em processo é o maior ativo. Estimativa — ajuste o múltiplo e o peso da carteira.">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Valuation estimado</p>
                <p className="text-3xl font-bold tabular-nums text-[#7048E8]">{brl(val.total)}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">faturamento × {mult.toFixed(1)} + {pesoCarteira}% da carteira + recebíveis + caixa</p>
              </div>
              <div className="grid w-full gap-3 sm:max-w-xs">
                <label className="text-xs text-zinc-500">
                  <span className="flex justify-between"><span>Múltiplo do faturamento anual</span><b className="text-zinc-700 dark:text-zinc-200">{mult.toFixed(1)}×</b></span>
                  <input type="range" min={0.5} max={4} step={0.1} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="mt-1 w-full accent-[#7048E8]" />
                </label>
                <label className="text-xs text-zinc-500">
                  <span className="flex justify-between"><span>Peso da carteira em processo</span><b className="text-zinc-700 dark:text-zinc-200">{pesoCarteira}%</b></span>
                  <input type="range" min={0} max={100} step={5} value={pesoCarteira} onChange={(e) => setPesoCarteira(Number(e.target.value))} className="mt-1 w-full accent-[#7048E8]" />
                </label>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <CompValor label={`Faturamento × ${mult.toFixed(1)}`} sub={`${brl(c.receita.r12m)}/ano`} valor={val.fatur} cor="#2F9E44" />
              <CompValor label="Carteira em processo" sub={`${pesoCarteira}% de ${brl(c.carteira.honorariosEscritorio)}`} valor={val.carteira} cor="#7048E8" />
              <CompValor label="Recebíveis (CS)" sub="prestação + cumprimento" valor={c.recebiveisCS} cor="#228BE6" />
              <CompValor label="Recorrente a receber" sub={`${c.recorrente.ativasN} cobrança(s)`} valor={c.recorrente.saldoDevedor} cor="#F08C00" />
              <CompValor label="Caixa" sub={c.caixaAtual < 0 ? 'no vermelho' : 'acumulado'} valor={c.caixaAtual} cor={c.caixaAtual < 0 ? '#E03131' : '#2F9E44'} />
            </div>
            <p className="mt-3 text-[11px] text-zinc-400">⚠️ Estimativa de gestão, não avaliação contábil/oficial. A carteira em processo é honorário provável (depende de êxito e prazo) — por isso o peso ajustável.</p>
          </Card>

          {/* Pilares de crescimento */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Carteira em processo" value={brl(c.carteira.honorariosEscritorio)} hint={`honorários prováveis · ${c.carteira.nComValor} processos com valor`} accent="#7048E8" />
            <MiniStat label="Causas sob patrocínio" value={brl(c.carteira.brutoCausas)} hint={`${c.carteira.nCasos} processos no total`} accent="#E64980" />
            <MiniStat label="Base de clientes" value={String(c.base.clientesTotal)} hint={`${c.base.casosTotal} casos abertos`} accent="#228BE6" />
            <MiniStat label="Faturamento (12m)" value={brl(c.receita.r12m)} hint={`média ${brl(c.receita.media)}/mês`} accent="#2F9E44" />
          </div>
          {/* Glossário didático dos pilares */}
          <div className="mt-2 grid gap-x-4 gap-y-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
            <p><b className="text-zinc-600 dark:text-zinc-300">Carteira em processo</b> — honorários que o escritório ainda vai receber dos processos em andamento (valor da causa × chance de êxito × % do escritório). É o maior ativo &ldquo;oculto&rdquo;: dinheiro a caminho, que ainda não entrou no caixa.</p>
            <p><b className="text-zinc-600 dark:text-zinc-300">Causas sob patrocínio</b> — a soma do valor de todas as ações que o escritório defende hoje. Mostra o tamanho do que está em jogo para os clientes.</p>
            <p><b className="text-zinc-600 dark:text-zinc-300">Base de clientes</b> — quantas pessoas o escritório atende e quantos processos estão ativos.</p>
            <p><b className="text-zinc-600 dark:text-zinc-300">Faturamento (12m)</b> — o que de fato entrou em caixa nos últimos 12 meses (diferente da carteira, que ainda vai entrar).</p>
          </div>

          {/* Carteira por área */}
          {c.carteira.porArea.length > 0 && (
            <Card title="Carteira de honorários por área" sub="onde está concentrado o valor em processo (parte do escritório).">
              <div className="space-y-1.5">
                {c.carteira.porArea.map((a) => {
                  const p = c.carteira.honorariosEscritorio > 0 ? (a.valor / c.carteira.honorariosEscritorio) * 100 : 0;
                  return (
                    <div key={a.area} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-zinc-600 dark:text-zinc-300">{a.area}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-[#7048E8]" style={{ width: `${Math.max(2, p)}%` }} />
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(a.valor)}</span>
                      <span className="w-10 shrink-0 text-right text-[11px] text-zinc-400">{Math.round(p)}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </>
      )}

      {/* Receita recebida — a história do caixa que já entrou */}
      <Card title="Receita recebida, mês a mês" sub="barras = faturamento que entrou · linha = resultado (lucro/prejuízo). Os lançamentos no financeiro começam em mai/2025 — antes disso o controle era fora do sistema.">
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
    </>
  );
}

function BigStat({ label, value, hint, cor }: { label: string; value: string; hint?: string; cor: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: cor }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function CrescimentoFundacao({ cc }: { cc: CrescimentoCarteira }) {
  const r = cc.resumo;
  const serie = cc.serie.map((p) => ({ ...p, nome: fmtMesKey(p.mes) }));
  const totalFmt = r.crescimentoTotalPct != null ? `+${r.crescimentoTotalPct.toLocaleString('pt-BR')}%` : '—';
  return (
    <Card
      title={<span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-[#2F9E44]" /> Crescimento desde a fundação (jan/2024)</span>}
      sub="quantos processos o escritório acumula mês a mês, pela data de distribuição — a medida mais fiel do crescimento."
    >
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        O escritório saiu de <b>{r.carteiraJan2024}</b> processos em jan/2024 para <b>{r.carteiraHoje}</b> hoje
        {r.crescimentoTotalPct != null && <> — um salto de <b className="text-[#2F9E44]">{totalFmt}</b></>}
        {r.cagrMensalPct != null && <>, crescendo cerca de <b className="text-[#2F9E44]">+{r.cagrMensalPct.toLocaleString('pt-BR')}%</b> ao mês, em média</>}.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BigStat label="Carteira hoje" value={String(r.carteiraHoje)} hint={`${r.totalProcessos} no total${r.preProcessuais ? ` · ${r.preProcessuais} pré-processuais` : ''}`} cor="#7048E8" />
        <BigStat label="Crescimento total" value={totalFmt} hint="desde jan/2024" cor="#2F9E44" />
        <BigStat label="Ritmo médio" value={r.cagrMensalPct != null ? `+${r.cagrMensalPct.toLocaleString('pt-BR')}%/mês` : '—'} hint={`~${r.mediaNovosMes.toLocaleString('pt-BR')} novos processos/mês`} cor="#228BE6" />
        <BigStat label="Melhor mês" value={r.melhorMes ? String(r.melhorMes.novos) : '—'} hint={r.melhorMes ? `novos em ${fmtMesKey(r.melhorMes.mes)}` : ''} cor="#F08C00" />
      </div>

      {serie.length > 1 && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#868e96' }} width={36} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#868e96' }} width={42} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="l" stackId="m" name="Novos processos no mês" dataKey="novos" fill="#E64980" maxBarSize={22} />
              {r.estimadosNaCurva > 0 && (
                <Bar yAxisId="l" stackId="m" name="Estimados pelo nº CNJ" dataKey="estimados" fill="#F783AC" radius={[3, 3, 0, 0]} maxBarSize={22} />
              )}
              <Line yAxisId="r" name="Carteira acumulada" type="monotone" dataKey="acum" stroke="#2F9E44" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
        Contado pela <b>data de distribuição</b> ({r.comDataDistribuicao} processos).
        {r.baseHerdada > 0 && <> Inclui {r.baseHerdada} já em andamento antes de jan/2024 (base herdada, no ponto de partida).</>}
        {r.estimadosPorCnj > 0 && <> Outros {r.estimadosPorCnj} sem data registrada tiveram o <b>ano de ajuizamento recuperado do nº&nbsp;CNJ</b> e foram estimados dentro do ano (barra rosa-clara).</>}
        {r.preProcessuais > 0 && <> {r.preProcessuais} casos pré-processuais (sem ação ajuizada) entram no total, mas ficam fora da curva.</>}
      </p>
    </Card>
  );
}

function CompValor({ label, sub, valor, cor }: { label: string; sub: string; valor: number; cor: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="truncate text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: cor }}>{brl(valor)}</p>
      <p className="truncate text-[10px] text-zinc-400">{sub}</p>
    </div>
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

function CamadaCS({ label, hint, cor, value, on, setOn }: { label: string; hint: string; cor: string; value: number; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition ${on ? 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900' : 'border-transparent bg-zinc-100/60 opacity-60 dark:bg-zinc-800/40'}`}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 shrink-0" style={{ accentColor: cor }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} /><span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{label}</span></span>
        <span className="block truncate text-[10px] text-zinc-400">{hint}</span>
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: cor }}>{brl(value)}</span>
    </label>
  );
}

function ProjecoesTab({ data }: { data: FinDashboard }) {
  const p = data.projecao!;
  const ticket = p.ticketMedio || 250;
  const [x, setX] = useState(p.clientesEquilibrio || 3);
  const { data: cs } = useCumprimentoFin();
  const csCerto = cs?.totais.aReceberPrestacao ?? 0;      // prestação de contas = caixa real
  const csProvavel = cs?.totais.nossoEmCumprimento ?? 0;  // cumprimento, nossa parte 40% = provável
  const csEstimado = cs?.totais.estimadoFavoraveis ?? 0;  // sentenças favoráveis = estimado (risco)
  const [camCerto, setCamCerto] = useState(true);
  const [camProvavel, setCamProvavel] = useState(true);
  const [camEstimado, setCamEstimado] = useState(false);  // risco de reforma — desligado por padrão
  const temCS = csCerto + csProvavel + csEstimado > 0;
  const inj = (camCerto ? csCerto : 0) + (camProvavel ? csProvavel : 0) + (camEstimado ? csEstimado : 0);

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

      {temCS && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Renda esperada dos processos — some à projeção por nível de certeza</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <CamadaCS label="Certo" hint="prestação de contas (caixa nosso)" cor="#2F9E44" value={csCerto} on={camCerto} setOn={setCamCerto} />
            <CamadaCS label="Provável" hint="cumprimento · nossa parte 40%" cor="#228BE6" value={csProvavel} on={camProvavel} setOn={setCamProvavel} />
            <CamadaCS label="Estimado" hint="sentenças (IA) · cabe recurso" cor="#F59F00" value={csEstimado} on={camEstimado} setOn={setCamEstimado} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Somando ao caixa da projeção: <strong className="tabular-nums text-emerald-600">{brl(inj)}</strong> <span className="text-zinc-400">(injeção única). Desligue as camadas mais arriscadas para uma visão conservadora.</span></p>
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
  const { data: cs } = useCumprimentoFin();
  const csCerto = cs?.totais.aReceberPrestacao ?? 0;
  const csProvavel = cs?.totais.nossoEmCumprimento ?? 0;
  const csEstimado = cs?.totais.estimadoFavoraveis ?? 0;
  const csTotal = csCerto + csProvavel + csEstimado;
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

      {csTotal > 0 && (
        <Card title={<span className="flex items-center gap-2"><Landmark className="h-4 w-4 text-emerald-600" /> Tem caixa a caminho dos processos</span>}
          sub="o que os processos da fase judicial devem trazer — fôlego que não depende de novo cliente.">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Certo', hint: 'prestação de contas', cor: '#2F9E44', v: csCerto },
              { label: 'Provável', hint: 'cumprimento · nossos 40%', cor: '#228BE6', v: csProvavel },
              { label: 'Estimado', hint: 'sentenças (IA) · cabe recurso', cor: '#F59F00', v: csEstimado },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} /><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{c.label}</p></div>
                <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: c.cor }}>{brl(c.v)}</p>
                <p className="text-[11px] text-zinc-400">{c.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No total, <strong className="tabular-nums text-emerald-600">{brl(csTotal)}</strong> em recebíveis dos processos — {csCerto + csProvavel > 0 ? <>sendo <strong className="tabular-nums">{brl(csCerto + csProvavel)}</strong> entre certo e provável.</> : 'em diferentes estágios de certeza.'} Some isso à projeção na aba <strong>Projeções</strong>.</p>
        </Card>
      )}

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

const FRASES_ADV = [
  'Atrás de cada processo seu tem uma pessoa que dormiu mais tranquila por saber que você está cuidando.',
  'Você devolve dignidade a quem foi lesado. Isso não tem preço — mas tem retorno, e ele aparece aqui.',
  'Cada caso seu é uma história virando. Orgulhe-se: você muda vidas e constrói a sua carreira ao mesmo tempo.',
  'Constância vence talento que não aparece. Continue lutando por eles — e por você.',
  'O cliente que você atende bem hoje volta, indica e agradece amanhã. Seu trabalho compõe.',
  'Não é sobre um mês — é sobre a trajetória. E a sua está sendo escrita, processo a processo, vida a vida.',
  'Pouco a pouco, audiência após audiência, é assim que uma advogada de respeito se constrói.',
];
const STATUS_FILTROS_ADV = [{ key: 'todos', label: 'Todos' }, { key: 'recebido', label: 'Recebidos' }, { key: 'a_receber', label: 'A receber' }] as const;

function MeuFinanceiroConteudo({ data }: { data: FinDashboard }) {
  const r = data.resumo ?? { recebido: 0, aReceber: 0, minhaParte: 0, nClientes: 0, nCasos: 0, nLancamentos: 0 };
  const clientes = data.clientes ?? [];
  const serie = data.serie ?? [];
  const casos = data.casos ?? [];
  const cs = data.cs ?? { prestacao: 0, cumprimento: 0, cumprimentoNosso: 0, itens: [] as { caseId: string; cliente: string; tipo: string; valor: number; nosso?: number }[] };
  // parte do escritório no cumprimento (bruto × % do contrato). Usa o valor do
  // backend (por caso); se vier de uma API antiga, cai na % padrão do escritório.
  const csCumprimentoNosso = cs.cumprimentoNosso ?? Math.round(cs.cumprimento * (data.projecaoCasos?.escritorioPadrao ?? 40)) / 100;
  const melhorMes = data.melhorMes ?? null;
  // Total a entrar = a receber (lançamentos) + sua parte (rateio) + CS NOSSO
  // (prestação já é nossa; no cumprimento entra a parte do escritório, não o bruto).
  const aReceberTotal = r.aReceber + r.minhaParte + cs.prestacao + csCumprimentoNosso;
  const primeiro = (data.meuNome || '').split(' ')[0] || 'Dr(a).';
  const iniciais = (data.meuNome || 'AD').slice(0, 2).toUpperCase();
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  const [fraseIdx, setFraseIdx] = useState(0);
  const [mesSel, setMesSel] = useState('');
  const [stf, setStf] = useState<'todos' | 'recebido' | 'a_receber'>('todos');
  const [busca, setBusca] = useState('');

  const mesesDisp = useMemo(() => Array.from(new Set((data.transacoes ?? []).map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [data.transacoes]);
  const txs = useMemo(() => (data.transacoes ?? []).filter((t) => {
    if (mesSel && mesKey(t) !== mesSel) return false;
    const st = t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
    if (stf === 'recebido' && !(st === 'recebido' || st === 'pago')) return false;
    if (stf === 'a_receber' && (st === 'recebido' || st === 'pago')) return false;
    if (busca && !`${t.pagador ?? t.party ?? ''} ${t.categoria}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [data.transacoes, mesSel, stf, busca]);
  const chartData = serie.map((s) => ({ nome: mesCurtoKey(s.mes), valor: s.valor }));

  return (
    <>
        {/* Cabeçalho personalizado */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[#228BE6] text-base font-bold text-white">{iniciais}</span>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{saud}, {primeiro}! 👋</h1>
            <p className="text-sm text-zinc-500">Seu financeiro — <strong>{r.nCasos ?? casos.length} processo(s)</strong> seus · <strong>{r.nClientes} cliente(s)</strong> que já te renderam honorários.</p>
          </div>
        </div>

        {/* Banner motivacional */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 dark:border-zinc-800 dark:from-amber-900/15 dark:via-zinc-900 dark:to-emerald-900/15">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-600"><Flame className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                {r.recebido > 0 ? `Você já trouxe ${brl(r.recebido)} em honorários${aReceberTotal > 0 ? `, e ainda tem ${brl(aReceberTotal)} a entrar` : ''}. ` : ''}{FRASES_ADV[fraseIdx]}
              </p>
              <button onClick={() => setFraseIdx((i) => (i + 1) % FRASES_ADV.length)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#7048E8] hover:underline"><Sparkles className="h-3.5 w-3.5" /> Me motive de novo</button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Recebido (seus casos)" value={brl(r.recebido)} hint={melhorMes ? `melhor mês: ${mesLabel(melhorMes.mes).replace(' de ', '/')}` : `${r.nClientes} cliente(s)`} accent="#2F9E44" />
          <MiniStat label="A receber" value={brl(r.aReceber)} hint="lançamentos pendentes" accent="#F59F00" />
          <MiniStat label="Sua parte (rateio)" value={brl(r.minhaParte)} hint="honorários divididos com você" accent="#7048E8" />
          <MiniStat label="Total a entrar" value={brl(aReceberTotal)} hint="a receber + sua parte + CS" accent="#228BE6" />
        </div>

        {/* Gráfico: recebido mês a mês */}
        {serie.length > 1 && (
          <Card title="Seu recebido mês a mês" sub="a evolução dos honorários que você trouxe.">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" className="dark:opacity-20" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#868e96' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={kbrl} width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Bar name="Recebido" dataKey="valor" fill="#2F9E44" radius={[3, 3, 0, 0]} maxBarSize={34} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* A receber dos seus casos (CS) */}
        {(cs.prestacao > 0 || cs.cumprimento > 0) && (
          <Card title={<span className="flex items-center gap-2"><Gavel className="h-4 w-4 text-emerald-600" /> A receber dos seus casos (Cumprimento de Sentença)</span>} sub="valores que você preencheu no card dos processos.">
            <div className="mb-2 flex flex-wrap gap-4 text-sm">
              {cs.prestacao > 0 && <span className="text-emerald-600">Prestação (nosso): <strong>{brl(cs.prestacao)}</strong></span>}
              {cs.cumprimento > 0 && <span className="text-[#228BE6]">Em cumprimento (bruto): <strong>{brl(cs.cumprimento)}</strong></span>}
              {csCumprimentoNosso > 0 && <span className="text-[#7048E8]">Cumprimento (nosso ~%): <strong>{brl(csCumprimentoNosso)}</strong></span>}
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto scrollbar-thin">
              {cs.itens.map((x, i) => (
                <div key={i} className="flex items-center justify-between border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <VerProcesso id={x.caseId}>{x.cliente}</VerProcesso>
                  <span className="flex items-center gap-2"><span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">{x.tipo === 'prestacao' ? 'prestação' : 'cumprimento'}</span><span className="w-24 text-right font-semibold tabular-nums text-emerald-600">{brl2(x.valor)}</span></span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Seus clientes */}
        {clientes.length > 0 && (
          <Card title={<>Seus clientes <span className="font-normal text-zinc-400">· {clientes.length}</span></>} sub="quem mais te rendeu honorários.">
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {clientes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{c.nome}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{c.n} pgto{c.n > 1 ? 's' : ''}{c.ultimo ? ` · últ. ${c.ultimo.slice(0, 5)}` : ''}</span>
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-emerald-600">{brl2(c.recebido)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* O que você está construindo — impacto + sua parte (sem expor o caixa do escritório) */}
        {data.projecaoCasos && data.projecaoCasos.nComValor > 0 && (
          <Card title={<span className="flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-[#E64980]" /> O que você está construindo</span>}
            sub={data.projecaoCasos.isSocio ? 'o escritório recebe os honorários do contrato; a sua parte de sócio é a sua fatia desses honorários por área de atuação.' : 'da condenação estimada, o escritório recebe os honorários do contrato; a sua parte é o seu % sobre esses honorários.'}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-3 dark:border-pink-900/40 dark:bg-pink-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Em busca pelos seus clientes</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#E64980]">{brl(data.projecaoCasos.brutoEmProcesso)}</p><p className="text-[11px] text-zinc-400">{data.projecaoCasos.nComValor} {data.projecaoCasos.nComValor === 1 ? 'pessoa conta' : 'pessoas contam'} com você</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Honorários do escritório</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#228BE6]">{brl(data.projecaoCasos.escritorioEmProcesso)}</p><p className="text-[11px] text-zinc-400">% do contrato sobre a condenação</p></div>
              <div className="rounded-xl border border-violet-300 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/15"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Sua parte provável</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#7048E8]">{brl(data.projecaoCasos.liquidoProvavel)}</p><p className="text-[11px] text-zinc-400">{data.projecaoCasos.isSocio ? 'sua fatia dos honorários (o resto fica com o escritório)' : `${data.projecaoCasos.pctExito}% dos honorários do escritório`}</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Já realizado + a entrar</p><p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">{brl(r.recebido + aReceberTotal)}</p><p className="text-[11px] text-zinc-400">o que já se concretizou</p></div>
            </div>
            {data.projecaoCasos.isSocio && (data.projecaoCasos.divisao?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/30 p-3 dark:border-violet-900/40 dark:bg-violet-900/10">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-500">Como os honorários se dividem</p>
                <div className="space-y-1">
                  {data.projecaoCasos.divisao!.map((d) => (
                    <div key={d.quem} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><span className={`font-medium ${d.eu ? 'text-[#7048E8]' : ''}`}>{d.quem}</span><span className={`rounded-full px-1.5 text-[10px] font-bold ${d.eu ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{d.pct}%</span></span>
                      <span className={`tabular-nums font-semibold ${d.eu ? 'text-[#7048E8]' : 'text-zinc-500 dark:text-zinc-400'}`}>{brl(d.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">💜 Você não move só números — move <strong>vidas</strong>. São <strong>{r.nCasos ?? casos.length} histórias</strong> que passam pelas suas mãos.</p>
            <p className="mt-1.5 text-[11px] text-zinc-400">Estimativa: a condenação real costuma sair diferente do valor da causa (pra mais ou pra menos) — {data.projecaoCasos.isSocio ? 'sua parte de sócio sai dos honorários do escritório, conforme a divisão acima.' : 'sua parte já é calculada pela média de êxito de cada caso.'}</p>
          </Card>
        )}

        {/* Seus processos — autor × réu, etiquetas, o que o cliente busca, sua parte */}
        {casos.length > 0 && (
          <Card title={<>Seus processos <span className="font-normal text-zinc-400">· {casos.length}</span></>} sub="cada linha é uma pessoa que confia no seu trabalho.">
            <div className="max-h-[32rem] overflow-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900"><tr><th className="px-2 py-1.5 font-medium">Autor × Réu</th><th className="hidden px-2 py-1.5 font-medium sm:table-cell">Etiquetas</th><th className="px-2 py-1.5 text-right font-medium">Para o cliente</th><th className="hidden px-2 py-1.5 text-right font-medium md:table-cell">Escritório</th><th className="px-2 py-1.5 text-right font-medium">Sua parte</th></tr></thead>
                <tbody>
                  {casos.map((c) => (
                    <tr key={c.caseId} className="border-t border-zinc-100 dark:border-zinc-800/70">
                      <td className="max-w-0 px-2 py-1.5">
                        <VerProcesso id={c.caseId}>{c.autor || 'Processo'}</VerProcesso>
                        {c.reu && <span className="block truncate text-[11px] text-zinc-400">× {c.reu}</span>}
                      </td>
                      <td className="hidden px-2 py-1.5 sm:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {c.produto && <span className="rounded-full bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#228BE6]">{c.produto}</span>}
                          {c.area && c.area !== c.produto && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">{c.area}</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{c.valorCausa > 0 ? brl(c.valorCausa) : '—'}</td>
                      <td className="hidden whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[#228BE6] md:table-cell">{c.escritorioValor > 0 ? <>{brl(c.escritorioValor)} <span className="text-[10px] text-zinc-400">{c.firmPct}%</span></> : '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-[#7048E8]">{c.liquido > 0 ? brl(c.liquido) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Seus lançamentos — filtrável */}
        <Card title={<>Seus lançamentos <span className="font-normal text-zinc-400">· {txs.length}</span></>} sub="movimentações dos seus casos.">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="bg-transparent text-sm font-medium capitalize outline-none"><option value="">Todos os meses</option>{mesesDisp.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}</select>
            </div>
            <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">{STATUS_FILTROS_ADV.map((a) => <button key={a.key} onClick={() => setStf(a.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${stf === a.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{a.label}</button>)}</div>
            <div className="relative ml-auto"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
          </div>
          <div className="max-h-[30rem] overflow-y-auto scrollbar-thin">
            {txs.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento neste filtro.</p>
            ) : txs.map((t) => {
              const st = t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
              return (
                <div key={t.id} className="flex items-center gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">{t.data.slice(0, 5)}</span>
                  {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{t.pagador || t.recebedor || t.party || t.categoria}{t.parcelaNum ? <span className="ml-1 text-[11px] text-zinc-400">{t.parcelaNum}/{t.parcelaTot}</span> : null}</span>
                  <span className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${STATUS_TX[st].badge}`}>{STATUS_TX[st].label}</span>
                  <span className={`w-24 shrink-0 text-right font-semibold tabular-nums ${t.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(t.valor)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <p className="mt-4 pb-2 text-center text-xs text-zinc-400">Esta visão mostra apenas os seus processos — em que você é o responsável.</p>
    </>
  );
}

/** Página standalone (advogado com acesso limitado) — embrulha o conteúdo pessoal. */
function FinanceiroLimitado({ data }: { data: FinDashboard }) {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <MeuFinanceiroConteudo data={data} />
        {/* Sócio (mesmo limitado) também vê as previsões da carteira do escritório */}
        {data.projecaoCasos?.isSocio && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100"><Sparkles className="h-5 w-5 text-[#7048E8]" /> Previsões da carteira do escritório</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Visão de sócio — valor em causa e recuperação provável de toda a carteira.</p>
            <PrevisoesCarteira />
          </div>
        )}
      </div>
    </div>
  );
}

/** Aba "Meu financeiro" dentro do dashboard completo (admin/sócio/membro com acesso). */
function MeuTab() {
  const { user } = useAuthStore();
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const meuMembro = members.find((m) => m.user.id === user?.id);
  const isAdmin = meuMembro?.role === 'OWNER' || meuMembro?.role === 'ADMIN';
  const advs = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const [alvo, setAlvo] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'meu', alvo], queryFn: () => financeiroService.meuFinanceiro(alvo || undefined), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });

  return (
    <div className="mt-2">
      {isAdmin && advs.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Ver a visão pessoal de:</span>
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Eu ({user?.name || 'minha conta'})</option>
            {advs.filter((a) => a.id !== user?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      {isLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
        : !data ? <Card><p className="py-8 text-center text-sm text-zinc-400">Não foi possível carregar os dados.</p></Card>
        : <MeuFinanceiroConteudo data={data} />}
    </div>
  );
}

// ═══════════════════════════ ABA · PREVISÕES (SÓCIOS) ═════════════════════════
/** Previsões da carteira (valor de causa × probabilidade) — restrito a sócios/admin. */
function PrevisoesTab() {
  return <div className="mt-2"><PrevisoesCarteira /></div>;
}

function PrevisoesCarteira() {
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'previsoes'], queryFn: () => financeiroService.getPrevisoes(), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  if (!data || data.semAcesso) return <Card><p className="py-8 text-center text-sm text-zinc-400">Previsões da carteira são visíveis apenas para os sócios.</p></Card>;
  const taxaCor = (t: number | null) => (t == null ? 'text-zinc-400' : t >= 60 ? 'text-emerald-600' : t >= 40 ? 'text-[#228BE6]' : 'text-amber-600');
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Valor em causa" value={brl(data.valorTotal)} hint={`${data.nComValor} processos com valor`} accent="#7C3AED" />
        <MiniStat label="Recuperação esperada" value={brl(data.recuperacaoEsperada)} hint="já tira os perdidos/extintos" accent="#10B981" />
        <MiniStat label="Êxito provável (≥50%)" value={String(data.provaveis.n)} hint={`${brl(data.provaveis.valor)} em jogo`} accent="#228BE6" />
        <MiniStat label="Já perdidos / extintos" value={String((data.perdidos ?? 0) + (data.extintos ?? 0))} hint={`${brl(data.perdidoValor ?? 0)} que não volta`} accent="#EF4444" />
      </div>

      <p className="mt-2 text-[11px] text-zinc-400">✅ Recuperação esperada já <b>exclui</b> processos perdidos/extintos (lidos dos andamentos reais — improcedência, RESP negado, extinção). Só conta o que está em andamento (× probabilidade) e o limbo a 10%.</p>

      {data.limbo && data.limbo.n > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Em limbo / execução frustrada</p>
            <p className="text-xl font-bold tabular-nums text-zinc-600 dark:text-zinc-300">{brl(data.limbo.valor)}</p>
            <p className="text-[11px] text-zinc-400">{data.limbo.n} processos de Contribuições (associações sumiram)</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Recuperação considerada</p>
            <p className="text-xl font-bold tabular-nums text-amber-600">{brl(data.limbo.esperado)}</p>
            <p className="text-[11px] text-zinc-400">só {data.limbo.pct}% de chance (execução frustrada + PF)</p>
          </div>
        </div>
      )}

      <Card title="Recuperação esperada por área" sub="valor em causa × probabilidade de êxito de cada caso.">
        <div className="space-y-1.5">
          {data.porArea.map((a) => {
            const p = data.recuperacaoEsperada > 0 ? (a.esperado / data.recuperacaoEsperada) * 100 : 0;
            return (
              <div key={a.key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-zinc-600 dark:text-zinc-300">{a.key}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, p)}%` }} /></div>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-600">{brl(a.esperado)}</span>
                <span className="hidden w-16 shrink-0 text-right text-[11px] text-zinc-400 sm:inline">{a.exitoMedio != null ? `${a.exitoMedio}% êxito` : '—'}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Por tese — valor, recuperação e desempenho" sub="onde está o valor e quanto tende a voltar (por tese/produto).">
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
              <tr><th className="px-2 py-1.5 font-medium">Tese</th><th className="px-2 py-1.5 text-right font-medium">Casos</th><th className="px-2 py-1.5 text-right font-medium">Em causa</th><th className="px-2 py-1.5 text-right font-medium">Esperado</th><th className="px-2 py-1.5 text-right font-medium">Êxito real</th></tr>
            </thead>
            <tbody>
              {data.porTese.map((t) => (
                <tr key={t.key} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5 font-medium text-zinc-700 dark:text-zinc-200">{t.key}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{t.n}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{brl(t.valor)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-600">{brl(t.esperado)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${taxaCor(t.taxa)}`}>{t.taxa == null ? '—' : `${t.taxa}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[11px] text-zinc-400">⚠️ Estimativa: usa o % de êxito de cada caso (ou o fator de realização padrão). A condenação real pode sair pra mais ou pra menos. Esta visão é restrita aos sócios.</p>
    </>
  );
}
