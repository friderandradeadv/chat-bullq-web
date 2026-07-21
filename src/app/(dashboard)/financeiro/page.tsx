'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ReferenceLine, Cell,
} from 'recharts';
import {
  CircleDollarSign, TrendingUp, TrendingDown, Scale, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Info, Target, Users, Sparkles, Loader2, Plus, Trash2, X, Search, Receipt, Save,
  ChevronDown, ChevronRight, ChevronLeft, Table2, Rocket, HeartHandshake, Scissors, Phone, Trophy, Flame, Calendar,
  Pencil, Check, Layers, Gavel, Landmark, ExternalLink, Wallet, UserCircle2, Banknote, CreditCard, AlertCircle, CalendarClock, Gem, RefreshCw,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type FinTransacao, type TxStatus, type AddTransacaoInput, type UpdateTransacaoInput, type Cobranca, type CrescimentoCarteira, type VerticalCusto, type Conta, type FinMes, type CadastroTipo } from '@/features/financeiro/services/financeiro.service';
import { ASTREA_DESPESAS, APORTES } from '@/features/financeiro/data/astrea-despesas';
import { legalCasesService, type CumprimentoFinanceiro } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { membersService } from '@/features/settings/services/members.service';
import { MeuFinanceiroConteudo, BuscaCliente, BuscaProcesso } from '@/features/financeiro/components/meu-financeiro-conteudo';
import { ComboBox } from '@/features/financeiro/components/combo-box';
import { VERTICAIS_PADRAO } from '@/features/financeiro/lib/verticais';
import { useAuthStore } from '@/stores/auth-store';
import {
  aggregarClientes, aggregarRetiradas, normNome, mesKey, mesLabel, mesCurtoKey, MESES_PT, STATUS_FIN, type StatusFin, type ClienteFin,
} from '@/features/financeiro/lib/clientes';

// SEMPRE com centavos — pedido do Matheus 17/07: todo valor em R$ exibe os centavos.
const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Nomes vêm em CAPS do Pipefy/Astrea — exibe em Title Case (preserva siglas/conectivos).
const MINUS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'a', 'o']);
const titleCase = (s?: string | null) => (s ?? '').toLowerCase().replace(/\b[\p{L}']+/gu, (w, i) => (i > 0 && MINUS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
const kbrl = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '-' : ''; return a >= 1000 ? `${s}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${s}${a}`; };
// valor compacto (sem "R$ ", com centavos) — p/ colunas estreitas que não podem quebrar linha
const brlN = (n: number) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// mês "2026-07" → "07/2026" (evita quebrar em 2 linhas como "Julho de 2026")
const mmYYYY = (k: string) => { const m = (k || '').match(/^(\d{4})-(\d{2})$/); return m ? `${m[2]}/${m[1]}` : k; };
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

type View = 'lancamentos' | 'honorarios' | 'cobrancas' | 'cumprimento' | 'retiradas' | 'contas' | 'fluxo' | 'crescimento' | 'projecoes' | 'motivacao' | 'previsoes' | 'verticais' | 'advogado';
const TABS: { key: View; label: string; icon: React.ElementType; grupo: string }[] = [
  { key: 'lancamentos', label: 'Lançamentos', icon: Receipt, grupo: 'Caixa' },
  { key: 'honorarios', label: 'Honorários', icon: Users, grupo: 'Caixa' },
  { key: 'cobrancas', label: 'A receber', icon: CreditCard, grupo: 'Caixa' }, // cobranças (parcelas/ASAAS) + recebíveis dos processos (CS)
  { key: 'retiradas', label: 'Retiradas', icon: Wallet, grupo: 'Caixa' },
  { key: 'contas', label: 'Contas', icon: Banknote, grupo: 'Caixa' },
  { key: 'verticais', label: 'Verticais', icon: Layers, grupo: 'Análise' },
  { key: 'projecoes', label: 'Projeções e crescimento', icon: Rocket, grupo: 'Análise' },
];
const GRUPOS = ['Caixa', 'Análise'];

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

// VERTICAIS_PADRAO agora vem da fonte única (features/financeiro/lib/verticais) — importada abaixo.

export default function FinanceiroPage() {
  // Organismo vivo: refaz sozinho a cada 60s e ao voltar pra aba — reflete movimentação dos processos/recebimentos.
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'dashboard'], queryFn: () => financeiroService.dashboard(), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  // Abre em "Lançamentos" por padrão (livro-razão do mês corrente) — é a tela de trabalho do dia a dia.
  const [view, setView] = useState<View>('lancamentos');
  const [showSaldo, setShowSaldo] = useState(false);
  // Seletor "ver o financeiro de" — por advogado (escopado à vertical dele) ou,
  // para o dono (OWNER), por vertical inteira. Só admin/sócio.
  const { user } = useAuthStore();
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const meuMembro = members.find((m) => m.user.id === user?.id);
  const isAdmin = meuMembro?.role === 'OWNER' || meuMembro?.role === 'ADMIN';
  const isOwner = meuMembro?.role === 'OWNER';
  // inclui você mesmo ("meu financeiro") e esconde logins não-atribuíveis (Admin duplicado).
  const advs = useMemo(() => members.filter((m) => m.user.isActive && m.assignable !== false).map((m) => ({ id: m.user.id, name: m.user.name, eu: m.user.id === user?.id })), [members, user?.id]);
  // Verticais que o dono pode ver inteiras.
  const VERTICAIS = ['Bancário', 'Previdenciário', 'Consumidor', 'Cível'];
  // sel: '' = escritório · 'v:Área' = vertical inteira · userId = visão pessoal do advogado
  const [sel, setSel] = useState('');
  // Vem de um link "?vertical=Bancário" (chips do perfil em Meu Espaço) → já abre a vertical.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vertical');
    if (v) setSel(`v:${v}`);
  }, []);
  const verVert = sel.startsWith('v:') ? sel.slice(2) : '';
  const verAdv = sel.startsWith('v:') ? '' : sel;
  const advNome = advs.find((a) => a.id === verAdv)?.name;

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
      <div className="h-full overflow-y-auto overflow-x-hidden bg-[#f5f6f8] dark:bg-zinc-950">
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
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CircleDollarSign className="h-5 w-5" /></span>
              Financeiro
              {verVert ? <span className="text-lg font-semibold text-[#15AABF]"> · {verVert}</span> : verAdv && advNome ? <span className="text-lg font-semibold text-[#7048E8]"> · {advNome.split(' ')[0]}</span> : null}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{verVert ? 'financeiro de toda a vertical — todos os casos e advogados da área.' : verAdv ? 'financeiro do advogado, escopado à vertical de atuação dele(a).' : 'Lançamentos, honorários, fluxo de caixa, crescimento e projeções do escritório.'}</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && advs.length > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                <UserCircle2 className="h-4 w-4 text-zinc-400" />
                <select value={sel} onChange={(e) => setSel(e.target.value)} className="bg-transparent text-sm font-medium outline-none dark:text-zinc-100">
                  <option value="">Escritório (tudo)</option>
                  {/* Verticais foram unificadas na aba "Verticais" (visão geral + entrar na área). */}
                  <optgroup label="Por advogado">
                    {advs.map((a) => <option key={a.id} value={a.id}>{a.eu ? `Você (${a.name.split(' ')[0]}) — meu financeiro` : `${a.name} — financeiro dele(a)`}</option>)}
                  </optgroup>
                </select>
              </div>
            )}
            {!sel && data.geradoEm && <p className="text-xs text-zinc-400">atualizado em {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>}
          </div>
        </div>

        {verVert ? (
          <VerticalFinanceiro area={verVert} />
        ) : verAdv ? (
          <AdvogadoFinanceiro userId={verAdv} />
        ) : (
        <>
        {/* KPIs — pulso financeiro sempre visível */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(() => { const caixa = k.caixaContas ?? k.saldoAtual; const divida = k.aporteAcumulado ?? 0; const pos = caixa - divida; const temDivida = divida > 0; const valor = temDivida ? pos : caixa; return (
          <Kpi icon={Scale} accent={valor < 0 ? '#E03131' : '#2F9E44'} label={`${temDivida ? 'Posição real' : 'Caixa real'} · ${k.mesAtualLabel}`} value={brl(valor)} hint={temDivida ? `${brl(caixa)} em caixa − ${brl(divida)} devido aos sócios` : `nas contas · operacional ${brl(k.saldoOperacional ?? k.saldoAtual)}`} onClick={() => setShowSaldo(true)} />
          ); })()}
          <Kpi icon={k.resultadoMes >= 0 ? TrendingUp : TrendingDown} accent={k.resultadoMes >= 0 ? '#2F9E44' : '#E03131'} label="Resultado do mês" value={brl(k.resultadoMes)} hint={`receita ${brl(k.receitaMes)} · despesa ${brl(k.despesaMes)}`} />
          <Kpi icon={ArrowUpCircle} accent="#2F9E44" label="Receita (12 meses)" value={brl(k.receita12m)} hint={`média ${brl(k.receitaMedia)}/mês`} />
          <Kpi icon={ArrowDownCircle} accent="#E03131" label="Despesa (12 meses)" value={brl(k.despesa12m)} hint={`fixo ${brl(k.custoFixoMensal)}/mês`} />
        </div>

        {showSaldo && <SaldoDetalheModal meses={data.meses ?? []} saldoAtual={k.saldoAtual} saldoOperacional={k.saldoOperacional ?? k.saldoAtual} caixaContas={k.caixaContas ?? k.saldoAtual} onClose={() => setShowSaldo(false)} />}

        {/* Menu de seções — dropdown agrupado (compacto, não espalha) */}
        <TabsMenu view={view} setView={setView} lancCount={data.resumoLancamentos?.total} />

        {view === 'lancamentos' && <LancamentosTab data={data} />}
        {view === 'honorarios' && <HonorariosTab data={data} />}
        {/* "A receber" reúne Cobranças (parcelas/ASAAS) + CS (recebíveis dos processos), separados por subaba. */}
        {view === 'cobrancas' && <AReceberTab data={data} />}
        {view === 'retiradas' && <RetiradasTab data={data} />}
        {view === 'contas' && <ContasTab data={data} />}
        {view === 'verticais' && <VerticaisTab data={data} />}
        {/* "Projeções e crescimento" reúne as antigas abas Projeções + Crescimento +
            Previsões da carteira (sócios) numa só — o painel do futuro num lugar. */}
        {view === 'projecoes' && (
          <>
            <ProjecoesTab data={data} />
            <CrescimentoTab data={data} />
            <PrevisoesTab />
          </>
        )}
        </>
        )}

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
          {/* Mobile: ocupa a coluna toda (não estoura/corta com o overflow-x-hidden
              do root). Desktop: painel largo fixo. */}
          <div className="absolute left-0 z-40 mt-1.5 w-full sm:w-[min(92vw,440px)] rounded-2xl border border-[#DEE2E6] bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
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

function Kpi({ icon: Icon, accent, label, value, hint, onClick }: { icon: React.ElementType; accent: string; label: string; value: string; hint?: string; onClick?: () => void }) {
  const Cmp: any = onClick ? 'button' : 'div';
  return (
    <Cmp onClick={onClick} className={`w-full rounded-2xl border border-[#DEE2E6] bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-900 ${onClick ? 'cursor-pointer transition hover:-translate-y-0.5 hover:border-[#228BE6]/50 hover:shadow-md' : ''}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${accent}1A`, color: accent }}><Icon className="h-4 w-4" /></span>
        <span className="truncate">{label}</span>
        {onClick && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-zinc-300" />}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{hint}</p>}
    </Cmp>
  );
}

// Detalhe do saldo acumulado: saldo inicial das contas + soma dos resultados mês a mês.
function SaldoDetalheModal({ meses, saldoAtual, saldoOperacional, caixaContas, onClose }: { meses: FinMes[]; saldoAtual: number; saldoOperacional: number; caixaContas: number; onClose: () => void }) {
  const realizados = meses.filter((m) => !m.projecao);
  const saldoInicial = realizados.length ? realizados[0].acumulado - realizados[0].resultado - (realizados[0].aporte ?? 0) : 0;
  const totalReceita = realizados.reduce((s, m) => s + m.receita, 0);
  const totalDespesa = realizados.reduce((s, m) => s + m.despesaTotal, 0);
  const totalAporte = realizados.reduce((s, m) => s + (m.aporte ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl scrollbar-thin dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Caixa real × resultado operacional</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400"><strong>Saldo inicial</strong> + <strong>resultados</strong> (receita − despesa <strong>liquidadas</strong>) de cada mês{totalAporte > 0 ? <> + <strong className="text-amber-600">empréstimo dos sócios</strong> (o que os CPFs cobriram — é <strong>dívida a devolver</strong>, não faturamento)</> : null}. Fatura de cartão só entra quando paga.</p>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/40">
          <span className="text-zinc-500">Saldo inicial das contas</span>
          <span className={`font-semibold tabular-nums ${saldoInicial >= 0 ? 'text-zinc-700 dark:text-zinc-200' : 'text-rose-600'}`}>{brl2(saldoInicial)}</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
          <div className="grid grid-cols-[1fr_5rem_5rem_5.5rem] gap-1 bg-zinc-50/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/40">
            <span>Mês</span><span className="text-right">Receita</span><span className="text-right">Despesa</span><span className="text-right">Acumulado</span>
          </div>
          {realizados.map((m) => (
            <div key={m.key} className="grid grid-cols-[1fr_5rem_5rem_5.5rem] items-center gap-1 border-t border-zinc-100 px-3 py-1.5 text-xs dark:border-zinc-800/70">
              <span className="flex min-w-0 items-center gap-1 truncate text-zinc-600 dark:text-zinc-300">{m.label}{(m.aporte ?? 0) > 0 && <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="empréstimo dos sócios (CPFs) — dívida a devolver">+empréstimo {brl2(m.aporte!)}</span>}</span>
              <span className="text-right tabular-nums text-emerald-600">{m.receita ? brl2(m.receita) : '—'}</span>
              <span className="text-right tabular-nums text-rose-600">{m.despesaTotal ? brl2(m.despesaTotal) : '—'}</span>
              <span className={`text-right font-semibold tabular-nums ${m.acumulado >= 0 ? 'text-zinc-700 dark:text-zinc-200' : 'text-rose-600'}`}>{brl2(m.acumulado)}</span>
            </div>
          ))}
          {realizados.length === 0 && <p className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">Sem meses realizados ainda.</p>}
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center justify-between text-zinc-500"><span>Total de receitas</span><span className="tabular-nums text-emerald-600">{brl2(totalReceita)}</span></div>
          <div className="flex items-center justify-between text-zinc-500"><span>Total de despesas</span><span className="tabular-nums text-rose-600">− {brl2(totalDespesa)}</span></div>
          {totalAporte > 0 && <div className="flex items-center justify-between text-zinc-500"><span>Resultado operacional <span className="text-[11px] text-zinc-400">(o que o escritório gerou/queimou)</span></span><span className={`font-semibold tabular-nums ${saldoOperacional >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(saldoOperacional)}</span></div>}
          <div className="flex items-center justify-between border-t border-dashed border-zinc-200 pt-1.5 font-semibold dark:border-zinc-700"><span className="text-zinc-700 dark:text-zinc-200">Caixa real <span className="text-[11px] font-normal text-zinc-400">(dinheiro nas contas agora)</span></span><span className={`tabular-nums ${caixaContas >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(caixaContas)}</span></div>
          {totalAporte > 0 && <div className="flex items-center justify-between text-zinc-500"><span>Empréstimo dos sócios <span className="text-[11px] text-zinc-400">(dívida a devolver aos CPFs)</span></span><span className="tabular-nums text-amber-600">− {brl2(totalAporte)}</span></div>}
          {totalAporte > 0 && <div className="flex items-center justify-between border-t border-zinc-200 pt-1.5 font-bold dark:border-zinc-700"><span className="text-zinc-700 dark:text-zinc-200">Posição real <span className="text-[11px] font-normal text-zinc-400">(caixa − empréstimo dos sócios)</span></span><span className={`tabular-nums ${caixaContas - totalAporte >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(caixaContas - totalAporte)}</span></div>}
          {totalAporte > 0 && <p className="mt-1 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">O escritório está com <strong>{brl2(caixaContas)}</strong> em caixa mas deve <strong>{brl2(totalAporte)}</strong> aos sócios (dinheiro que os CPFs gastaram e ainda não foi devolvido). A <strong>posição real</strong> é de <strong>{brl2(caixaContas - totalAporte)}</strong> — o rombo verdadeiro. Conforme o escritório for pagando os sócios de volta, essa dívida cai.</p>}
        </div>
        <p className="mt-3 text-[11px] text-zinc-400">Dica: para ver os lançamentos de um mês, use o filtro de mês no livro-razão abaixo.</p>
      </div>
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
const ST_FILTROS = [{ key: 'liquidado', label: 'Liquidados (caixa)' }, { key: 'a_receber', label: 'A receber / a pagar' }, { key: 'todos', label: 'Todos' }] as const;
const hojeBR = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const toBR = (iso: string) => { const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const toISOInput = (br: string) => { const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const parseValor = (s: string) => Number(String(s).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;
// Percentual OU fração — aceita "50" (%), "50%", "1/2", "1/3" no mesmo campo. Usado na
// contribuição pessoal (Kauani contribui "1/2 do REPB" é mais natural que calcular 216,67 de cabeça).
const parsePct = (s: string): number => {
  const t = String(s).trim();
  const fr = t.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (fr) { const num = Number(fr[1].replace(',', '.')); const den = Number(fr[2].replace(',', '.')); return den > 0 ? (num / den) * 100 : 0; }
  return parseValor(t.replace('%', ''));
};
// Contribuição de uma pessoa numa despesa: valor fixo, % do total, ou % de UMA vertical do
// rateio (ex.: "Kauani banca 50% da fatia do REPB"). O valor final gravado é sempre em R$
// (o modo/%/vertical só existem pra facilitar a conta na hora de digitar).
type ContribModo = 'valor' | 'pctTotal' | 'pctVertical';
interface ContribRow { userId?: string; nome: string; modo: ContribModo; valor: string; pct: string; area?: string }
const contribValorCalc = (row: ContribRow, totalDespesa: number, rateioRows: { area: string; valor: string }[]): number => {
  if (row.modo === 'valor') return parseValor(row.valor);
  if (row.modo === 'pctTotal') return Math.round(totalDespesa * (parsePct(row.pct) / 100) * 100) / 100;
  if (row.modo === 'pctVertical') { const rv = rateioRows.find((r) => r.area === row.area); const base = rv ? parseValor(rv.valor) : 0; return Math.round(base * (parsePct(row.pct) / 100) * 100) / 100; }
  return 0;
};
// Moeda: máscara enquanto digita (só dígitos → centavos → "1.234,56") + número → texto.
const maskBRL = (raw: string) => { const d = String(raw).replace(/\D/g, ''); if (!d) return ''; return (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fmtMoney = (n: number) => (Math.abs(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Input de dinheiro: mostra "R$" fixo e formata em moeda conforme o usuário digita.
function MoneyInput({ value, onChange, placeholder = '0,00', readOnly = false, autoFocus = false }: { value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; autoFocus?: boolean }) {
  return (
    <div className={`flex items-center rounded-md border px-2 ${readOnly ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50' : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`}>
      <span className="mr-1 shrink-0 text-xs text-zinc-400">R$</span>
      <input value={value} onChange={(e) => onChange?.(maskBRL(e.target.value))} readOnly={readOnly} autoFocus={autoFocus} inputMode="numeric" placeholder={placeholder} className={`w-full bg-transparent py-1.5 text-right text-sm tabular-nums outline-none ${readOnly ? 'text-zinc-600 dark:text-zinc-300' : ''}`} />
    </div>
  );
}

const STATUS_TX: Record<TxStatus, { label: string; badge: string; cor: string }> = {
  a_receber: { label: 'A receber', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  recebido: { label: 'Recebido', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300', cor: '#2F9E44' },
  a_pagar: { label: 'A pagar', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  pago: { label: 'Pago', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', cor: '#868E96' },
};
const txStatus = (t: FinTransacao): TxStatus => t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
const ehLiquidado = (s: TxStatus) => s === 'recebido' || s === 'pago';

interface SplitRow { tipo: 'socio' | 'associado'; userId: string; valor: string; modo: 'valor' | 'pct'; pct: string }
interface RateioForm { bruto: string; cliente: string; sucumbencia: string; honorarios: string }
interface Editor {
  id: string | null; serieId: string | null; tipo: 'receita' | 'despesa';
  dataISO: string; vencISO: string; pagtoISO: string;
  categoria: string; subtipo: 'inicial' | 'exito'; pagador: string; recebedor: string; valor: string;
  status: TxStatus; parcelas: string; repetir: 'nao' | 'mensal' | 'anual'; escopo: 'uma' | 'proximas'; split: SplitRow[];
  rateio: RateioForm; responsavelId: string; conta: string;
  area: string; // vertical/centro de custos do lançamento (direto). Rateio, quando houver, sobrepõe.
  rateioVerticais: { area: string; valor: string; label?: string }[]; // rateio de despesa entre verticais (label = linha do custo, ex.: Agência 1/3)
  contribuintes: ContribRow[]; // contribuição PESSOAL (quem ajudou a pagar do próprio bolso) — independente do rateio por vertical, só informativo
  contactId?: string; caseId?: string; procLabel?: string;
}
const RATEIO_VAZIO: RateioForm = { bruto: '', cliente: '', sucumbencia: '', honorarios: '' };

// ── Ficha do cliente: clicar no nome abre o processo (drawer com o card financeiro) ──
function useFichaCliente() {
  const { data: juri } = useQuery({ queryKey: ['jurimetria'], queryFn: () => legalCasesService.jurimetria(), staleTime: 300_000 });
  const { data: kb } = useQuery({ queryKey: ['kanban', 'fin'], queryFn: () => legalCasesService.kanban(), staleTime: 300_000 });
  const phases = useMemo(() => kb?.phases ?? [], [kb]);
  const clienteCaseId = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of juri?.rows ?? []) { const k = normNome(r.cliente || ''); if (k && r.id && !m.has(k)) m.set(k, r.id); }
    return m;
  }, [juri]);
  const caseDoCliente = (nome?: string | null) => clienteCaseId.get(normNome(nome || '')) ?? null;
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  return { caseDoCliente, openCaseId, setOpenCaseId, phases };
}
type Ficha = ReturnType<typeof useFichaCliente>;
// span clicável (não <button>) p/ poder ficar DENTRO de botões de toggle (Honorários/Cobranças)
function ClienteLink({ nome, ficha, className }: { nome: string; ficha: Ficha; className?: string }) {
  const cid = ficha.caseDoCliente(nome);
  if (!cid) return <span className={className}>{nome}</span>;
  return <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); ficha.setOpenCaseId(cid); }} className={`${className ?? ''} cursor-pointer text-[#228BE6] hover:underline`} title="Abrir ficha do cliente">{nome}</span>;
}
function FichaDrawerMount({ ficha }: { ficha: Ficha }) {
  return ficha.openCaseId ? <CaseDetailDrawer caseId={ficha.openCaseId} phases={ficha.phases} onClose={() => ficha.setOpenCaseId(null)} /> : null;
}

/** Mini-calendário (estilo Astrea): navega/seleciona mês OU clica dia/período. */
function CalendarioFiltro({ mesSel, deISO, ateISO, onMes, onPeriodo, onLimpar }: {
  mesSel: string; deISO: string; ateISO: string;
  onMes: (ym: string) => void; onPeriodo: (de: string, ate: string) => void; onLimpar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<'dias' | 'meses'>('dias');
  const [selDe, setSelDe] = useState('');
  const [selAte, setSelAte] = useState('');
  const [ver, setVer] = useState<{ y: number; m: number }>(() => {
    const now = new Date();
    if (mesSel) { const [y, m] = mesSel.split('-').map(Number); return { y, m: m - 1 }; }
    if (deISO) { const d = new Date(deISO + 'T00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const label = mesSel ? mesLabel(mesSel) : (deISO && ateISO ? (deISO === ateISO ? toBR(deISO) : `${toBR(deISO)} – ${toBR(ateISO)}`) : deISO ? `a partir de ${toBR(deISO)}` : 'Todos os meses');
  const ativo = !!(mesSel || deISO || ateISO);
  const diasNoMes = new Date(ver.y, ver.m + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ver.y, ver.m, 1).getDay();
  const iso = (d: number) => `${ver.y}-${String(ver.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const navMes = (delta: number) => setVer((v) => { const nm = v.m + delta; return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }; });
  const clicaDia = (d: number) => {
    const dISO = iso(d);
    if (!selDe || (selDe && selAte)) { setSelDe(dISO); setSelAte(''); }
    else { const [a, b] = dISO < selDe ? [dISO, selDe] : [selDe, dISO]; setSelDe(a); setSelAte(b); onPeriodo(a, b); setOpen(false); }
  };
  const marcado = (d: number) => { const x = iso(d); return !!selDe && (x === selDe || (!!selAte && x >= selDe && x <= selAte)); };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-sm dark:bg-zinc-900 ${ativo ? 'border-[#228BE6] text-[#228BE6]' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'}`}>
        <Calendar className="h-3.5 w-3.5" /> <span className="font-medium">{label}</span> <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => (modo === 'dias' ? navMes(-1) : setVer((v) => ({ ...v, y: v.y - 1 })))} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setModo((m) => (m === 'dias' ? 'meses' : 'dias'))} className="rounded-lg px-2 py-1 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800">{modo === 'dias' ? `${MESES_PT[ver.m]} de ${ver.y}` : ver.y}</button>
              <button onClick={() => (modo === 'dias' ? navMes(1) : setVer((v) => ({ ...v, y: v.y + 1 })))} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="h-4 w-4" /></button>
            </div>
            {modo === 'dias' ? (
              <>
                <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-zinc-400">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => <div key={i} className="py-1">{w}</div>)}</div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`b${i}`} />)}
                  {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((d) => (
                    <button key={d} onClick={() => clicaDia(d)} className={`grid h-8 place-items-center rounded-lg text-sm tabular-nums transition ${marcado(d) ? 'bg-[#228BE6] font-semibold text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}>{d}</button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] text-zinc-400">{selDe && !selAte ? 'clique no fim do período (ou no mesmo dia)' : 'clique num dia (ou 2 pra um período)'}</p>
                <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  <button onClick={() => { onMes(`${ver.y}-${String(ver.m + 1).padStart(2, '0')}`); setSelDe(''); setSelAte(''); setOpen(false); }} className="text-xs font-semibold text-[#7048E8] hover:underline">Mês inteiro</button>
                  <button onClick={() => { onLimpar(); setSelDe(''); setSelAte(''); setOpen(false); }} className="text-xs text-zinc-400 hover:text-rose-600">Limpar</button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {MESES_PT.map((mn, i) => (
                  <button key={i} onClick={() => { onMes(`${ver.y}-${String(i + 1).padStart(2, '0')}`); setModo('dias'); setSelDe(''); setSelAte(''); setOpen(false); }} className={`rounded-lg px-2 py-2.5 text-sm transition ${mesSel === `${ver.y}-${String(i + 1).padStart(2, '0')}` ? 'bg-[#228BE6] font-semibold text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}>{mn.slice(0, 3)}</button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Classificador em lote: agrupa despesas por categoria/fornecedor; atribui UMA vertical, RATEIA entre várias, marca comum ou desfaz. Mostra as já classificadas pra corrigir. */
function ClassificadorVertical({ data, onClose }: { data: FinDashboard; onClose: () => void }) {
  const qc = useQueryClient();
  const verticais = useMemo(() => [...new Set([...data.transacoes.flatMap((t) => t.verticais ?? []), ...VERTICAIS_PADRAO])].filter(Boolean), [data.transacoes]);
  const grupos = useMemo(() => {
    const m = new Map<string, { key: string; categoria: string; fornecedor: string; txs: FinTransacao[]; total: number; atual: string }>();
    for (const t of data.transacoes) {
      if (t.valor >= 0 || !t.id || t.area === 'Escritório') continue; // pula receita e comum-confirmado
      const forn = (t.recebedor || t.party || t.pagador || '').trim();
      const key = `${t.categoria}|${normNome(forn)}`;
      const g = m.get(key) ?? { key, categoria: t.categoria, fornecedor: forn, txs: [], total: 0, atual: '' };
      g.txs.push(t); g.total += Math.abs(t.valor); m.set(key, g);
    }
    for (const g of m.values()) {
      const rateado = g.txs.some((t) => (t.rateioVerticais?.length ?? 0) > 0);
      const areas = new Set(g.txs.map((t) => t.area || ''));
      g.atual = rateado ? 'rateio' : (areas.size === 1 && [...areas][0] ? String([...areas][0]) : '');
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [data.transacoes]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [rateio, setRateio] = useState<Record<string, { area: string; pct: number }[]>>({});
  const [busy, setBusy] = useState('');
  const inval = () => qc.invalidateQueries({ queryKey: ['financeiro'] });
  const curDe = (g: { key: string; atual: string }) => sel[g.key] ?? (g.atual === 'rateio' ? '__ratear' : g.atual);

  const aplicar = async (g: { key: string; txs: FinTransacao[] }) => {
    const v = curDe(g as any);
    setBusy(g.key);
    for (const t of g.txs) {
      if (!t.id) continue;
      try {
        if (v === '__ratear') {
          const rows = (rateio[g.key] ?? []).filter((r) => r.area && r.pct > 0);
          const abs = Math.abs(t.valor);
          let acc = 0;
          const rv = rows.map((r, i) => { const valor = i === rows.length - 1 ? Math.round((abs - acc) * 100) / 100 : Math.round(abs * (r.pct / 100) * 100) / 100; acc += valor; return { area: r.area, valor }; });
          await financeiroService.updateTransacao(t.id, { area: '', rateioVerticais: rv, escopo: 'uma' });
        } else {
          await financeiroService.updateTransacao(t.id, { area: v || '', rateioVerticais: [], escopo: 'uma' });
        }
      } catch { /* ignore */ }
    }
    setBusy(''); inval();
    toast.success(`${g.txs.length} lançamento(s) · ${v === '__ratear' ? 'rateado' : v === 'Escritório' ? 'comum' : v || 'sem vertical'}`);
  };
  const nomeAtual = (a: string) => a === 'rateio' ? 'rateado' : a === '' ? 'sem vertical' : a;
  const somaR = (key: string) => Math.round((rateio[key] ?? []).reduce((s, r) => s + (r.pct || 0), 0) * 100) / 100;
  // Divide 100% igualmente entre as linhas (ex.: 3 → 33,33 / 33,33 / 33,34 — a última absorve o resto p/ fechar 100).
  const dividirIgual = (key: string) => setRateio((rr) => { const rows = rr[key] ?? []; const n = rows.length; if (!n) return rr; const base = Math.floor(10000 / n) / 100; const pcts = Array(n).fill(base); pcts[n - 1] = Math.round((100 - base * (n - 1)) * 100) / 100; return { ...rr, [key]: rows.map((x, i) => ({ ...x, pct: pcts[i] })) }; });
  // Separa o que falta classificar (some da lista principal quando aplicado) do que já tem vertical/rateio/comum.
  // Usa o estado PERSISTIDO (g.atual), não o sel transitório — senão a linha pula de seção no meio da edição.
  const pendentes = grupos.filter((g) => !g.atual);
  const feitos = grupos.filter((g) => g.atual);
  const [showFeitos, setShowFeitos] = useState(false);

  const linhaGrupo = (g: typeof grupos[number]) => { const cur = curDe(g); return (
    <div key={g.key} className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{g.fornecedor || g.categoria}{g.atual && <span className="shrink-0 rounded bg-zinc-100 px-1 text-[9px] font-semibold text-zinc-500 dark:bg-zinc-800">{nomeAtual(g.atual)}</span>}</p>
          <p className="text-[11px] text-zinc-400">{g.categoria} · {g.txs.length} lançamento(s) · {brl2(g.total)}</p>
        </div>
        <ComboBox className="w-56" value={cur} options={verticais}
          actions={[{ value: '', label: '— sem vertical —' }, { value: 'Escritório', label: 'Escritório (comum · rateio auto)' }, { value: '__ratear', label: 'Ratear entre verticais…' }]}
          labelOf={(v) => v === '__ratear' ? 'Ratear entre verticais…' : v === 'Escritório' ? 'Escritório (comum)' : v === '' ? '— sem vertical —' : v}
          placeholder="vertical…"
          onChange={(val) => { setSel((s) => ({ ...s, [g.key]: val })); if (val === '__ratear' && !rateio[g.key]) setRateio((r) => ({ ...r, [g.key]: [{ area: verticais[0] ?? '', pct: 50 }, { area: verticais[1] ?? '', pct: 50 }] })); }} />
        <button onClick={() => aplicar(g)} disabled={busy === g.key} className="inline-flex items-center gap-1 rounded-lg bg-[#7048E8] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy === g.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}</button>
      </div>
      {cur === '__ratear' && (
        <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {(rateio[g.key] ?? []).map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <ComboBox className="min-w-0 flex-1" value={r.area} options={verticais} placeholder="vertical…" onChange={(val) => setRateio((rr) => ({ ...rr, [g.key]: (rr[g.key] ?? []).map((x, j) => j === i ? { ...x, area: val } : x) }))} />
              <input value={String(r.pct)} onChange={(e) => { const n = Math.max(0, Math.min(100, parseFloat(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0)); setRateio((rr) => ({ ...rr, [g.key]: (rr[g.key] ?? []).map((x, j) => j === i ? { ...x, pct: n } : x) })); }} inputMode="decimal" className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-sm text-zinc-400">%</span>
              <button onClick={() => setRateio((rr) => ({ ...rr, [g.key]: (rr[g.key] ?? []).filter((_, j) => j !== i) }))} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRateio((rr) => ({ ...rr, [g.key]: [...(rr[g.key] ?? []), { area: verticais[0] ?? '', pct: 0 }] }))} className="text-xs font-medium text-[#228BE6] hover:underline">+ vertical</button>
            <button onClick={() => dividirIgual(g.key)} className="rounded-md border border-[#228BE6]/40 px-2 py-0.5 text-[11px] font-medium text-[#228BE6] hover:bg-[#228BE6]/10">÷ dividir igual</button>
            <span className={`text-[11px] ${Math.abs(somaR(g.key) - 100) < 0.02 ? 'text-emerald-600' : 'text-amber-600'}`}>soma {somaR(g.key)}%{Math.abs(somaR(g.key) - 100) >= 0.02 ? ' (ideal 100%)' : ' ✓'}</span>
          </div>
        </div>
      )}
    </div>
  ); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl scrollbar-thin dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Layers className="h-5 w-5 text-[#7048E8]" /> Classificar despesas por vertical</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-[13px] text-zinc-500 dark:text-zinc-400">Cada grupo (categoria/fornecedor): escolha <strong>uma vertical</strong>, <strong>Ratear</strong> entre várias (ex.: agência 1/3 cada), ou <strong>Escritório (comum)</strong> pro que é do escritório. Já classificou algo errado? O <strong>estado atual</strong> aparece do lado — é só trocar pra <strong>— sem vertical —</strong> e Aplicar pra desfazer.</p>
        {grupos.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">✅ Nada a classificar — todas as despesas já são de uma vertical, rateadas ou comuns.</p>
        ) : (
          <>
            {pendentes.length > 0 ? (
              <div className="space-y-1.5">{pendentes.map(linhaGrupo)}</div>
            ) : (
              <p className="rounded-lg bg-emerald-50 py-6 text-center text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">✅ Tudo classificado — nenhuma despesa sem vertical.</p>
            )}
            {feitos.length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button onClick={() => setShowFeitos((v) => !v)} className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                  <span>Já classificados ({feitos.length}) — abra para corrigir</span>
                  <ChevronDown className={`h-4 w-4 transition ${showFeitos ? 'rotate-180' : ''}`} />
                </button>
                {showFeitos && <div className="mt-2 space-y-1.5">{feitos.map(linhaGrupo)}</div>}
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-zinc-400">O rateio divide o valor de cada lançamento pelos % escolhidos — a despesa continua <strong>uma só</strong> no livro-razão; cada vertical enxerga sua fatia.</p>
      </div>
    </div>
  );
}

function LancamentosTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const mesesDisp = useMemo(() => Array.from(new Set(data.transacoes.map(mesKey))).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [data.transacoes]);
  const mesHoje = useMemo(() => { const p = hojeBR().split('/'); return `${p[2]}-${p[1]}`; }, []);
  // Abre já filtrado pelo mês corrente (é o que a equipe olha no dia a dia). "" = Todos os meses.
  const [mesSel, setMesSel] = useState<string>(mesHoje);
  // Garante o mês corrente na lista do seletor mesmo sem lançamentos ainda (senão o value fica órfão).
  const mesesOpcoes = useMemo(() => (mesesDisp.includes(mesHoje) ? mesesDisp : [mesHoje, ...mesesDisp]), [mesesDisp, mesHoje]);
  const [mostrarFuturas, setMostrarFuturas] = useState(false); // parcelas a receber/pagar de meses futuros só sob demanda
  const [deISO, setDeISO] = useState(''); // período por calendário (vence o filtro de mês)
  const [ateISO, setAteISO] = useState('');
  const [aba, setAba] = useState<'todos' | 'receitas' | 'despesas'>('todos');
  const [stFiltro, setStFiltro] = useState<'todos' | 'a_receber' | 'liquidado'>('liquidado');
  const [respFiltro, setRespFiltro] = useState('');
  const [contaFiltro, setContaFiltro] = useState('');
  const [vertFiltro, setVertFiltro] = useState(''); // filtro por vertical (centro de custos). '' = todas; '__comum' = escritório/sem vertical
  const [showClassif, setShowClassif] = useState(false); // classificador de despesas sem vertical
  const nSemVert = useMemo(() => data.transacoes.filter((t) => t.valor < 0 && (t.verticais?.length ?? 0) === 0 && !t.area).length, [data.transacoes]);
  const temClassif = useMemo(() => data.transacoes.some((t) => t.valor < 0 && t.area !== 'Escritório'), [data.transacoes]); // há despesas p/ classificar OU corrigir
  const [busca, setBusca] = useState('');
  // verticais que aparecem nos lançamentos (pra popular o filtro)
  const verticaisLanc = useMemo(() => [...new Set(data.transacoes.flatMap((t) => t.verticais ?? []))].filter(Boolean).sort((a, b) => a.localeCompare(b)), [data.transacoes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [serieDel, setSerieDel] = useState<FinTransacao | null>(null);

  const cats = data.categoriasConhecidas ?? ['Honorários', 'Aluguel', 'Suprimentos escritório', 'Agência de tráfego', 'Contador', 'Anuidade OAB', 'GPS - INSS', 'Pró-labore', 'Outros'];
  const contas = data.contas ?? [];
  const contaNome = (id?: string | null) => contas.find((c) => c.id === id)?.nome ?? null;
  // Cartões de crédito: os gastos do cartão NÃO entram no caixa (livro-razão) — vivem na visão de cartão.
  const cardIds = useMemo(() => new Set(contas.filter((c) => c.cartao).map((c) => c.id)), [contas]);
  // Gasto de FATURA do cartão (sai do caixa): despesa numa conta-cartão que veio do
  // extrato do cartão (fonteImport) OU ainda está em aberto (a_pagar). Uma despesa
  // LANÇADA À MÃO numa conta-cartão (ex.: repasse) NÃO é fatura — fica no livro-razão.
  const isFaturaCartao = (t: FinTransacao) => !!t.conta && cardIds.has(t.conta) && t.valor < 0 && (!!t.fonteImport || txStatus(t) === 'a_pagar');
  const [modo, setModo] = useState<'ledger' | 'cartao'>('ledger');
  // Verticais disponíveis para ratear uma despesa (ex.: agência 1/3 cada).
  const areasVert = useMemo(() => {
    const base = VERTICAIS_PADRAO;
    const extra = [...(data.verticalPnL?.verticais ?? []).map((v) => v.area), ...(data.crescimento?.verticalArea ?? []).map((v) => v.area)];
    // frentes/campanhas já usadas em rateios (ex.: "REPB") viram sugestões também
    const frentes: string[] = [];
    for (const t of data.transacoes) for (const x of t.rateioVerticais ?? []) if (x.area) frentes.push(x.area);
    return [...new Set([...base, ...extra, ...frentes])].filter((a) => a && a !== 'Não identificada');
  }, [data.verticalPnL, data.crescimento, data.transacoes]);
  // Linhas de custo cadastradas por vertical (ex.: Bancário → Agência 1/3, Tráfego Pago).
  // Ao ratear uma despesa, marcar a linha faz a saída cair no holerite de quem a assume.
  const { data: vcCfg } = useQuery({ queryKey: ['financeiro', 'vertical-custos'], queryFn: () => financeiroService.getVerticalCustos(), staleTime: 300_000 });
  const linhasPorArea = useMemo(() => {
    const m: Record<string, { label: string; valor: number }[]> = {};
    for (const [area, linhas] of Object.entries(vcCfg?.verticalCustos ?? {})) m[area] = (linhas ?? []).filter((l) => l.label).map((l) => ({ label: l.label, valor: Number(l.valor) || 0 }));
    return m;
  }, [vcCfg]);
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advogados = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const nomeUser = useMemo(() => Object.fromEntries(members.map((m) => [m.user.id, m.user.name])) as Record<string, string>, [members]);
  // Quem assume cada custo (RH › Configurações). Cruza com o rateio pra mostrar,
  // na expansão do lançamento, que sócio/associado paga que fatia de cada linha.
  const { data: cpCfg } = useQuery({ queryKey: ['financeiro', 'custos-pessoa'], queryFn: () => financeiroService.getCustosPessoa(), staleTime: 300_000 });
  const assumentesDe = (area: string, label?: string): { nome: string; pct: number }[] => {
    const out: { nome: string; pct: number }[] = [];
    for (const [uid, linhas] of Object.entries(cpCfg?.custosPessoa ?? {})) {
      for (const c of linhas ?? []) {
        // linha específica bate no label; "vertical inteira" (sem label) assume qualquer linha da área
        if (c.area === area && (c.label ? c.label === label : true)) out.push({ nome: nomeUser[uid] || 'Colaborador', pct: c.pct });
      }
    }
    return out;
  };
  const { organizations, activeOrgId } = useAuthStore();
  const orgName = organizations.find((o) => o.id === activeOrgId)?.name ?? 'Escritório';
  // ── Cadastro de pagadores/recebedores (escritório pré-cad + fornecedores/sócios) ──
  const cadastros = data.cadastros ?? [];
  const escritorioNome = cadastros.find((c) => c.tipo === 'escritorio')?.nome ?? orgName;
  // fornecedores = quem RECEBE numa despesa (cadastrados + já usados no livro-razão)
  const fornecedores = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cadastros) if (c.tipo === 'fornecedor' || c.tipo === 'outro') m.set(normNome(c.nome), c.nome);
    for (const t of data.transacoes) if (t.valor < 0) { const n = (t.recebedor || '').trim(); if (n && normNome(n) !== normNome(escritorioNome)) m.set(normNome(n), n); }
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [cadastros, data.transacoes, escritorioNome]);
  // pagadores de despesa = escritório + sócios/CPFs (+ advogados)
  const pagadoresDespesa = useMemo(() => {
    const m = new Map<string, string>();
    m.set(normNome(escritorioNome), escritorioNome);
    for (const c of cadastros) if (c.tipo === 'escritorio' || c.tipo === 'socio') m.set(normNome(c.nome), c.nome);
    for (const a of advogados) m.set(normNome(a.name), a.name);
    return [...m.values()];
  }, [cadastros, escritorioNome, advogados]);
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
  const ficha = useFichaCliente(); // clicar no nome abre a ficha do processo
  const invalidate = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });

  const addM = useMutation({ mutationFn: (i: AddTransacaoInput) => financeiroService.addTransacao(i), onSuccess: (r) => { invalidate(); toast.success(r.criados > 1 ? `${r.criados} parcelas lançadas` : 'Lançamento adicionado'); setEditor(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao lançar') });
  const updM = useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateTransacaoInput }) => financeiroService.updateTransacao(id, input), onSuccess: () => { invalidate(); toast.success('Lançamento atualizado'); setEditor(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar') });
  const delM = useMutation({ mutationFn: ({ id, escopo }: { id: string; escopo: 'uma' | 'proximas' }) => financeiroService.removeTransacao(id, escopo), onSuccess: (r) => { invalidate(); toast.success(`${r.removidos} lançamento(s) removido(s)`); setSerieDel(null); }, onError: (e: any) => toast.error(e?.message || 'Erro ao remover') });

  const temPeriodo = !!(deISO || ateISO); // período por calendário vence o filtro de mês
  const txs = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.transacoes.filter((t) => {
      // Débitos de cartão A PAGAR APARECEM no livro-razão (seção "a pagar") — são a despesa.
      // Ao pagar a fatura eles migram pra conta e viram liquidados. Só escondo pago-no-cartão (legado).
      if (isFaturaCartao(t) && txStatus(t) !== 'a_pagar') return false;
      const iso = toISOInput(t.data);
      if (temPeriodo) { if (deISO && iso < deISO) return false; if (ateISO && iso > ateISO) return false; }
      else if (mesSel && mesKey(t) !== mesSel) return false;
      if (aba === 'receitas' && t.valor < 0) return false;
      if (aba === 'despesas' && t.valor >= 0) return false;
      const st = txStatus(t);
      // só no modo "Todos os meses" (sem período/mês) escondemos as parcelas FUTURAS (toggle).
      if (!temPeriodo && !mesSel && !mostrarFuturas && !ehLiquidado(st) && mesKey(t) > mesHoje) return false;
      if (stFiltro === 'a_receber' && ehLiquidado(st)) return false;
      if (stFiltro === 'liquidado' && !ehLiquidado(st)) return false;
      if (respFiltro && (t.responsavelId ?? '') !== respFiltro) return false;
      if (contaFiltro && (t.conta ?? '') !== contaFiltro) return false;
      if (vertFiltro) {
        const vs = t.verticais ?? [];
        if (vertFiltro === '__comum') { if (vs.length > 0) return false; }
        else {
          // vertical específica: mostra o que é da vertical + as DESPESAS COMUNS (sem vertical),
          // porque o comum é consumido por TODAS as verticais (rateado por igual).
          const ehComum = vs.length === 0 && t.valor < 0;
          if (!vs.includes(vertFiltro) && !ehComum) return false;
        }
      }
      if (q && !`${t.pagador ?? t.party ?? ''} ${t.recebedor ?? ''} ${t.responsavel ?? ''} ${t.categoria} ${t.data}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.transacoes, mesSel, aba, stFiltro, respFiltro, contaFiltro, vertFiltro, busca, mostrarFuturas, mesHoje, temPeriodo, deISO, ateISO]);
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
  // Lançamentos com o rateio (verticais/honorários) expandido no livro-razão.
  const [rvOpen, setRvOpen] = useState<Set<string>>(new Set());
  const toggleRv = (id: string) => setRvOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [importing, setImporting] = useState(false);
  const openNew = () => setEditor({ id: null, serieId: null, tipo: 'receita', dataISO: toISOInput(hojeBR()), vencISO: '', pagtoISO: toISOInput(hojeBR()), categoria: 'Honorários', subtipo: 'inicial', pagador: '', recebedor: escritorioNome, valor: '', status: 'recebido', parcelas: '1', repetir: 'nao', escopo: 'uma', split: [], rateio: { ...RATEIO_VAZIO }, responsavelId: '', conta: contas[0]?.id ?? '', area: '', rateioVerticais: [], contribuintes: [], contactId: '', caseId: '', procLabel: '' });
  const openEdit = (t: FinTransacao) => setEditor({ id: t.id!, serieId: t.serieId ?? null, tipo: t.valor >= 0 ? 'receita' : 'despesa', dataISO: toISOInput(t.data), vencISO: t.vencimento ? toISOInput(t.vencimento) : '', pagtoISO: t.dataPagamento ? toISOInput(t.dataPagamento) : toISOInput(t.data), categoria: t.categoria, subtipo: t.subtipo === 'exito' ? 'exito' : 'inicial', pagador: t.pagador ?? t.party ?? '', recebedor: t.recebedor ?? '', valor: fmtMoney(Math.abs(t.valor)), status: txStatus(t), parcelas: '1', repetir: 'nao', escopo: 'uma', responsavelId: t.responsavelId ?? '', conta: t.conta ?? '', split: (t.split ?? []).filter((s) => s.tipo !== 'escritorio').map((s) => ({ tipo: s.tipo === 'associado' ? 'associado' : 'socio', userId: s.userId ?? '', valor: fmtMoney(s.valor), modo: 'valor' as const, pct: '' })), rateio: t.rateio ? { bruto: fmtMoney(t.rateio.bruto), cliente: fmtMoney(t.rateio.cliente), sucumbencia: fmtMoney(t.rateio.sucumbencia), honorarios: fmtMoney(t.rateio.honorarios) } : { ...RATEIO_VAZIO }, area: t.area ?? '', rateioVerticais: (t.rateioVerticais ?? []).map((x) => ({ area: x.area, valor: fmtMoney(x.valor), label: x.label ?? '' })), contribuintes: (t.contribuintes ?? []).map((x) => ({ userId: x.userId ?? undefined, nome: x.nome, modo: 'valor' as const, valor: fmtMoney(x.valor), pct: '' })) });
  // ao trocar o pagador (cliente), sugere o responsável se ainda não houver
  const onPagador = (val: string) => setEditor((ed) => ed ? { ...ed, pagador: val, responsavelId: ed.responsavelId || (ed.tipo === 'receita' ? sugereResp(val) : '') } : ed);

  // Base do rateio entre advogados: no êxito é honorário+sucumbência; senão, o valor.
  const splitBase = (ed: Editor) => (ehExito(ed) && parseValor(ed.rateio.bruto) > 0) ? parseValor(ed.rateio.honorarios) + parseValor(ed.rateio.sucumbencia) : parseValor(ed.valor);
  // Valor efetivo de uma linha do rateio: em % vira R$ sobre a base (auto-calculado).
  const rowValor = (r: SplitRow, base: number) => r.modo === 'pct' ? Math.round(base * (parseValor(r.pct) / 100) * 100) / 100 : parseValor(r.valor);
  const buildSplit = (ed: Editor) => { const base = splitBase(ed); return ed.split.filter((r) => r.userId && rowValor(r, base) > 0).map((r) => ({ tipo: r.tipo, userId: r.userId, nome: advogados.find((a) => a.id === r.userId)?.name ?? '', valor: rowValor(r, base) })); };
  // rateio (prestação de contas) só faz sentido em honorário de êxito com bruto preenchido
  const ehExito = (ed: Editor) => /honor/i.test(ed.categoria) && ed.subtipo === 'exito';
  const rateioNosso = (r: RateioForm) => parseValor(r.honorarios) + parseValor(r.sucumbencia);
  const buildRateio = (ed: Editor) => (ehExito(ed) && parseValor(ed.rateio.bruto) > 0) ? { bruto: parseValor(ed.rateio.bruto), cliente: parseValor(ed.rateio.cliente), sucumbencia: parseValor(ed.rateio.sucumbencia), honorarios: parseValor(ed.rateio.honorarios) } : null;

  // Checa duplicata ANTES de criar um lançamento NOVO — mesma essência do dedup da importação
  // de extrato (mesmo sinal + valor ±1 centavo + data ±3 dias), só que aqui é um AVISO com
  // confirmação (não um bloqueio silencioso): mostra o candidato e o usuário decide, porque um
  // lançamento manual nunca conferia nada antes de salvar (diferente da importação, que já confere).
  const diasEntre = (isoA: string, isoB: string) => Math.round(Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 86400000);
  const possiveisDuplicatas = (tipo: 'receita' | 'despesa', valor: number, dataISO: string): FinTransacao[] => {
    const sinal = tipo === 'despesa' ? -1 : 1;
    return data.transacoes.filter((t) => {
      if (Math.sign(t.valor) !== sinal) return false;
      if (Math.abs(Math.abs(t.valor) - valor) > 0.01) return false;
      const tIso = toISOInput(t.data);
      return !!tIso && diasEntre(tIso, dataISO) <= 3;
    }).slice(0, 3);
  };

  const salvar = () => {
    if (!editor) return;
    const rateio = buildRateio(editor);
    // com rateio de êxito, o que entra no caixa é a parte do escritório (honorário + sucumbência)
    const v = rateio ? rateioNosso(editor.rateio) : parseValor(editor.valor);
    if (!(v > 0)) { toast.error(rateio ? 'Preencha honorário e/ou sucumbência do escritório' : 'Informe um valor maior que zero'); return; }
    // Só para lançamento NOVO e ÚNICO (não série repetida — recorrência é intencional e geraria
    // aviso falso todo mês).
    if (editor.id == null && editor.repetir === 'nao') {
      const dup = possiveisDuplicatas(editor.tipo, v, editor.dataISO);
      if (dup.length) {
        const lista = dup.map((c) => `• ${(c.data || '').slice(0, 5)} — ${titleCase(c.pagador || c.recebedor || c.party || '') || c.categoria} — ${brl2(Math.abs(c.valor))}`).join('\n');
        if (!confirm(`Já existe ${dup.length > 1 ? 'lançamento(s) parecido(s)' : 'um lançamento parecido'} (mesmo valor, data próxima):\n\n${lista}\n\nPode ser o mesmo já lançado (ex.: veio de um extrato importado). Lançar mesmo assim?`)) return;
      }
    }
    const liq = ehLiquidado(editor.status);
    const split = buildSplit(editor);
    const rvArr = editor.tipo === 'despesa' ? editor.rateioVerticais.filter((x) => x.area && parseValor(x.valor) > 0).map((x) => ({ area: x.area, valor: parseValor(x.valor), ...(x.label ? { label: x.label } : {}) })) : [];
    const contribArr = editor.tipo === 'despesa' ? editor.contribuintes.filter((x) => x.nome && contribValorCalc(x, v, editor.rateioVerticais) > 0).map((x) => ({ userId: x.userId || undefined, nome: x.nome, valor: contribValorCalc(x, v, editor.rateioVerticais) })) : [];
    const responsavel = advogados.find((a) => a.id === editor.responsavelId)?.name ?? '';
    if (editor.id == null) {
      const reps = editor.repetir === 'nao' ? 1 : Math.max(1, parseInt(editor.parcelas, 10) || 1);
      addM.mutate({ data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, subtipo: /honor/i.test(editor.categoria) ? editor.subtipo : undefined, valor: v, pagador: editor.pagador || undefined, recebedor: editor.recebedor || undefined, vencimento: editor.vencISO ? toBR(editor.vencISO) : undefined, dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : undefined, status: editor.status, parcelas: reps, intervalo: editor.repetir === 'anual' ? 'anual' : 'mensal', split, rateio, rateioVerticais: rvArr.length ? rvArr : undefined, contribuintes: contribArr.length ? contribArr : undefined, responsavelId: editor.responsavelId || undefined, responsavel: responsavel || undefined, conta: editor.conta || undefined, area: editor.area || undefined, contactId: editor.contactId || undefined, caseId: editor.caseId || undefined });
    } else {
      updM.mutate({ id: editor.id, input: { data: toBR(editor.dataISO), tipo: editor.tipo, categoria: editor.categoria, subtipo: /honor/i.test(editor.categoria) ? editor.subtipo : undefined, valor: v, pagador: editor.pagador || '', recebedor: editor.recebedor || '', vencimento: editor.vencISO ? toBR(editor.vencISO) : '', dataPagamento: liq ? toBR(editor.pagtoISO || editor.dataISO) : '', status: editor.status, escopo: editor.escopo, split, rateio, ...(rvArr.length ? { rateioVerticais: rvArr } : {}), contribuintes: contribArr, responsavelId: editor.responsavelId || '', responsavel, conta: editor.conta || '', area: editor.area || '' } });
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

      {/* Alternador: caixa (livro-razão) × cartão de crédito */}
      {cardIds.size > 0 && (
        <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {([['ledger', 'Livro-razão'], ['cartao', 'Cartão de crédito']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setModo(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${modo === k ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{k === 'cartao' && <CreditCard className="h-3.5 w-3.5" />}{l}</button>
          ))}
        </div>
      )}

      {modo === 'cartao' && cardIds.size > 0 ? <CartaoCreditoView data={data} contas={contas} onDone={invalidate} /> : (
      <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarioFiltro
          mesSel={mesSel} deISO={deISO} ateISO={ateISO}
          onMes={(ym) => { setMesSel(ym); setDeISO(''); setAteISO(''); }}
          onPeriodo={(de, ate) => { setDeISO(de); setAteISO(ate); setMesSel(''); }}
          onLimpar={() => { setMesSel(''); setDeISO(''); setAteISO(''); }}
        />
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
        {verticaisLanc.length > 0 && (
          <ComboBox className="w-48" value={vertFiltro} options={verticaisLanc}
            actions={[{ value: '', label: 'Todas as verticais' }, { value: '__comum', label: 'Escritório (comum)' }]}
            labelOf={(v) => v === '' ? 'Todas as verticais' : v === '__comum' ? 'Escritório (comum)' : v}
            placeholder="filtrar vertical…" onChange={setVertFiltro} />
        )}
        {temClassif && (
          <button onClick={() => setShowClassif(true)} title="Classificar / ratear / desfazer despesas por vertical" className="inline-flex items-center gap-1.5 rounded-lg border border-[#7048E8]/40 bg-[#7048E8]/5 px-2.5 py-1.5 text-xs font-semibold text-[#7048E8] hover:bg-[#7048E8]/10"><Layers className="h-3.5 w-3.5" /> Classificar por vertical{nSemVert > 0 ? ` (${nSemVert})` : ''}</button>
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

      <p className="mt-2 text-xs text-zinc-400">{txs.length} lançamento(s){temPeriodo ? ` no período${deISO ? ` de ${toBR(deISO)}` : ''}${ateISO ? ` até ${toBR(ateISO)}` : ''}` : mesSel ? ` em ${mesLabel(mesSel)}` : ` · ${grupos.length} ${grupos.length === 1 ? 'mês' : 'meses'}`}</p>

      <div className="mt-2 space-y-2">
        {grupos.map((g) => {
          const aberto = !!mesSel || !collapsed.has(g.key);
          return (
            <div key={g.key} className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
              {!mesSel && (
                <button onClick={() => toggle(g.key)} className="flex w-full items-center gap-2 bg-zinc-50/80 px-3 py-2 text-left transition hover:bg-zinc-100/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                  {aberto ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{mesLabel(g.key)}</span>
                  <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700/70">{g.items.length}</span>
                  <div className="ml-auto flex items-center gap-2.5 text-xs tabular-nums sm:gap-3.5">
                    <span className="hidden text-emerald-600 sm:inline">+{brl(g.rec)}</span>
                    <span className="hidden text-rose-600 sm:inline">−{brl(g.desp)}</span>
                    <span className={`font-semibold ${g.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl(g.saldo)}</span>
                  </div>
                </button>
              )}
              {aberto && (() => {
                const linha = (t: FinTransacao) => {
                  const st = txStatus(t);
                  const rv = t.rateioVerticais ?? [];
                  const sp = (t.split ?? []).filter((s) => s.tipo !== 'escritorio');
                  const temRv = rv.length > 0;
                  const temSplit = sp.length > 0;
                  const podeExpandir = temRv || temSplit;
                  const open = podeExpandir && rvOpen.has(t.id!);
                  const escrit = Math.abs(t.valor) - sp.reduce((a, s) => a + (Number(s.valor) || 0), 0);
                  return (
                    <div key={t.id} className="border-t border-zinc-100 dark:border-zinc-800/70">
                      <div className="group flex items-center gap-2 px-3 py-1.5 text-sm">
                        <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-400">{((!ehLiquidado(st) && t.vencimento) ? t.vencimento : t.data).slice(0, 5)}</span>
                        {t.valor >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <ClienteLink nome={titleCase((t.valor < 0 ? (t.recebedor || t.party || t.pagador) : (t.pagador || t.party || t.recebedor)) || '') || t.categoria} ficha={ficha} className="truncate text-zinc-700 dark:text-zinc-300" />{t.valor < 0 && normNome(t.pagador ?? '') !== normNome(escritorioNome) && !!t.pagador && <span className="hidden shrink-0 text-[11px] text-zinc-400 lg:inline" title="quem pagou">· pago por {titleCase(t.pagador)}</span>}
                          {t.parcelaNum ? <span className="shrink-0 text-[11px] text-zinc-400">{t.parcelaNum}/{t.parcelaTot}</span> : null}
                          {t.responsavel ? <span className="hidden shrink-0 items-center gap-0.5 rounded bg-zinc-100 px-1 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 lg:inline-flex">{t.responsavel.split(' ')[0]}</span> : null}
                          {t.conta ? <span className="hidden shrink-0 rounded px-1 text-[9px] font-medium text-white lg:inline" style={{ background: contas.find((c) => c.id === t.conta)?.cor ?? '#868E96' }}>{contaNome(t.conta)}</span> : null}
                          {t.manual ? <span className="shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30">manual</span> : null}
                          {(t.verticais?.length ?? 0) > 0 && <span className="hidden shrink-0 rounded px-1 text-[9px] font-semibold text-white lg:inline" style={{ background: corArea(t.verticais![0]) }} title={t.verticais!.join(' · ')}>{t.verticais!.length > 1 ? `${t.verticais!.length}×vert.` : t.verticais![0]}</span>}
                          {(t.verticais?.length ?? 0) === 0 && t.valor < 0 && <span className="hidden shrink-0 rounded bg-sky-100 px-1 text-[9px] font-semibold text-sky-600 lg:inline dark:bg-sky-900/30 dark:text-sky-300" title="custo comum do escritório — rateado por igual em todas as verticais">comum</span>}
                          {podeExpandir ? <button onClick={() => toggleRv(t.id!)} title="Ver o rateio" className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#7048E8]/10 px-1 text-[9px] font-semibold text-[#7048E8] transition hover:bg-[#7048E8]/20">{temRv ? 'rateado' : 'rateio'} {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}</button> : null}
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
                      {open && (
                        <div className="bg-[#7048E8]/[0.04] px-3 pb-2 pl-10 pt-1 dark:bg-[#7048E8]/[0.07]">
                          {temRv && (
                            <div className="mb-1.5">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#7048E8]">Rateio entre verticais (custo por área)</p>
                              <div className="space-y-1">
                                {rv.map((x, i) => {
                                  const ass = assumentesDe(x.area, x.label);
                                  return (
                                  <div key={i}>
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate text-zinc-600 dark:text-zinc-300">{x.area}{x.label ? <span className="text-zinc-400"> · {x.label}</span> : null}</span>
                                      <span className="shrink-0 font-medium tabular-nums text-rose-600">− {brl2(x.valor)}</span>
                                    </div>
                                    {ass.length > 0 && (
                                      <div className="ml-2 mt-0.5 space-y-0.5 border-l-2 border-[#7048E8]/20 pl-2">
                                        {ass.map((a, j) => (
                                          <div key={j} className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                            <span className="truncate">{a.nome} banca {a.pct}%</span>
                                            <span className="shrink-0 tabular-nums">− {brl2(x.valor * a.pct / 100)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {temSplit && (
                            <div>
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#7048E8]">Rateio dos honorários (quem recebeu)</p>
                              <div className="space-y-0.5">
                                {sp.map((s, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate text-zinc-600 dark:text-zinc-300">{s.nome || 'Advogado'}</span>
                                    <span className="shrink-0 font-medium tabular-nums text-emerald-600">{brl2(s.valor)}</span>
                                  </div>
                                ))}
                                {escrit > 0.01 && (
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-zinc-600 dark:text-zinc-300">Escritório</span>
                                    <span className="shrink-0 font-medium tabular-nums text-emerald-600">{brl2(escrit)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                };
                // Separa de fato o que já caiu no caixa do que ainda é a receber / a pagar.
                const liq = g.items.filter((t) => ehLiquidado(txStatus(t)));
                const pend = g.items.filter((t) => !ehLiquidado(txStatus(t)));
                const secao = (titulo: string, cor: string, itens: FinTransacao[]) => itens.length === 0 ? null : (
                  <div>
                    <div className="flex items-center gap-1.5 border-t border-zinc-100 bg-zinc-50/50 px-3 py-1 dark:border-zinc-800/70 dark:bg-zinc-800/20">
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cor }}>{titulo}</span>
                      <span className="text-[10px] text-zinc-400">({itens.length})</span>
                      <span className="ml-auto text-[10px] font-semibold tabular-nums text-zinc-400">{brl(itens.reduce((s, t) => s + Math.abs(t.valor), 0))}</span>
                    </div>
                    {itens.map(linha)}
                  </div>
                );
                return <div>{secao('Recebido / pago (caixa)', '#02883C', liq)}{secao('A receber / a pagar', '#F08C00', pend)}</div>;
              })()}
            </div>
          );
        })}
        {grupos.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento neste filtro.</p>}
      </div>
      </>
      )}

      {showClassif && <ClassificadorVertical data={data} onClose={() => setShowClassif(false)} />}

      {/* Modal de edição / novo lançamento */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 scrollbar-thin">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{editor.id ? 'Editar lançamento' : 'Novo lançamento'}{editor.parcelas && +editor.parcelas > 1 && !editor.id ? ` · ${editor.parcelas}×` : ''}</h3>
              <button onClick={() => setEditor(null)} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              {/* tipo */}
              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
                {(['receita', 'despesa'] as const).map((tp) => (
                  <button key={tp} onClick={() => setEditor({ ...editor, tipo: tp, categoria: tp === 'receita' ? 'Honorários' : 'Aluguel', status: tp === 'receita' ? (editor.status === 'a_receber' ? 'a_receber' : 'recebido') : (editor.status === 'a_pagar' ? 'a_pagar' : 'pago'),
                    // despesa: quem paga é o escritório (default) e o recebedor é o fornecedor (a preencher); receita: o inverso
                    pagador: tp === 'despesa' ? escritorioNome : (editor.pagador === escritorioNome ? '' : editor.pagador),
                    recebedor: tp === 'receita' ? escritorioNome : (editor.recebedor === escritorioNome ? '' : editor.recebedor),
                    contactId: tp === 'despesa' ? undefined : editor.contactId })} className={`px-4 py-1.5 text-sm font-semibold capitalize ${editor.tipo === tp ? (tp === 'receita' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{tp}</button>
                ))}
              </div>

              {(() => {
                const exitoRateio = /honor/i.test(editor.categoria) && editor.subtipo === 'exito' && parseValor(editor.rateio.bruto) > 0;
                const nosso = parseValor(editor.rateio.honorarios) + parseValor(editor.rateio.sucumbencia);
                return (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {exitoRateio
                      ? <Field label="Valor (entra no caixa = honorário + sucumbência)"><input value={brl2(nosso)} readOnly className="w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300" /></Field>
                      : <Field label="Valor (cada parcela)"><MoneyInput value={editor.valor} onChange={(v) => setEditor({ ...editor, valor: v })} /></Field>}
                    <Field label="Fonte"><select value={editor.categoria} onChange={(e) => setEditor({ ...editor, categoria: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                  </div>
                );
              })()}

              {editor.tipo === 'receita' && /honor/i.test(editor.categoria) && splitBase(editor) > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900/90 dark:border-indigo-900/40 dark:bg-indigo-900/10 dark:text-indigo-200/90">
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span>Este recebimento gera <b className="tabular-nums">DAS ~{brl2(splitBase(editor) * 0.045)}</b> (Simples, 4,5%) — some no imposto do mês. Veja em Contabilidade.</span>
                </div>
              )}

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
                      <Field label="Bruto recebido"><MoneyInput value={editor.rateio.bruto} onChange={(v) => setEditor({ ...editor, rateio: { ...editor.rateio, bruto: v } })} /></Field>
                      <Field label="Cliente recebe"><MoneyInput value={editor.rateio.cliente} onChange={(v) => setEditor({ ...editor, rateio: { ...editor.rateio, cliente: v } })} /></Field>
                      <Field label="Honorário (escritório)"><MoneyInput value={editor.rateio.honorarios} onChange={(v) => setEditor({ ...editor, rateio: { ...editor.rateio, honorarios: v } })} /></Field>
                      <Field label="Sucumbência (escritório)"><MoneyInput value={editor.rateio.sucumbencia} onChange={(v) => setEditor({ ...editor, rateio: { ...editor.rateio, sucumbencia: v } })} /></Field>
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

              {/* Datas: sempre a competência (mês de referência) + UMA data conforme a situação —
                  se já caiu (recebido/pago) mostra quando entrou/saiu; se está a receber/pagar, o vencimento. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Competência (mês de referência)"><input type="date" value={editor.dataISO} onChange={(e) => setEditor({ ...editor, dataISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                {ehLiquidado(editor.status)
                  ? <Field label={editor.tipo === 'receita' ? 'Recebido em' : 'Pago em'}><input type="date" value={editor.pagtoISO} onChange={(e) => setEditor({ ...editor, pagtoISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                  : <Field label="Vence em"><input type="date" value={editor.vencISO} onChange={(e) => setEditor({ ...editor, vencISO: e.target.value })} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></Field>}
              </div>

              {editor.tipo === 'receita' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cliente / origem (quem pagou)"><BuscaCliente value={editor.pagador} onPick={(c) => setEditor((ed) => ed ? { ...ed, pagador: c?.nome ?? '', contactId: c?.id, responsavelId: ed.responsavelId || (ed.tipo === 'receita' ? sugereResp(c?.nome ?? '') : '') } : ed)} onText={(t) => setEditor((ed) => ed ? { ...ed, pagador: t, contactId: undefined, responsavelId: ed.responsavelId || (ed.tipo === 'receita' ? sugereResp(t) : '') } : ed)} /></Field>
                  <Field label="Recebedor (destino)">
                    <input list="fin-recebedores-rec" value={editor.recebedor} onChange={(e) => setEditor({ ...editor, recebedor: e.target.value })} placeholder="quem recebe (escritório, advogado…)" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                    <datalist id="fin-recebedores-rec">
                      <option value={escritorioNome} />
                      {advogados.map((a) => <option key={a.id} value={a.name} />)}
                    </datalist>
                    {editor.recebedor !== escritorioNome && <button type="button" onClick={() => setEditor({ ...editor, recebedor: escritorioNome })} className="mt-1 text-[11px] font-medium text-[#228BE6] hover:underline">usar o escritório ({escritorioNome})</button>}
                  </Field>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* DESPESA: o escritório paga (pagador) → o destaque é o RECEBEDOR (fornecedor) */}
                  <Field label="Recebedor (fornecedor / quem recebeu)">
                    <ComboBox value={editor.recebedor} options={fornecedores} allowFree placeholder="buscar fornecedor…" onChange={(v) => setEditor({ ...editor, recebedor: v })} />
                    <p className="mt-1 text-[11px] text-zinc-400">puxa do cadastro; um fornecedor novo é cadastrado ao salvar.</p>
                  </Field>
                  <Field label="Pagador (quem pagou a despesa)">
                    <ComboBox value={editor.pagador} options={pagadoresDespesa} allowFree placeholder={escritorioNome} onChange={(v) => setEditor({ ...editor, pagador: v, contactId: undefined })} />
                    {normNome(editor.pagador) !== normNome(escritorioNome) && <button type="button" onClick={() => setEditor({ ...editor, pagador: escritorioNome })} className="mt-1 text-[11px] font-medium text-[#228BE6] hover:underline">pago pelo escritório ({escritorioNome})</button>}
                    {normNome(editor.pagador) !== normNome(escritorioNome) && !!editor.pagador && <p className="mt-1 text-[11px] text-amber-600">pago por um sócio/CPF → é <strong>empréstimo do sócio</strong> se não for reembolsado.</p>}
                  </Field>
                </div>
              )}

              <Field label="Vincular a um processo (opcional — pra quitar/registrar no processo)">
                {editor.caseId ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-[#228BE6]/40 bg-[#228BE6]/5 px-2 py-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><Gavel className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /><span className="truncate">{editor.procLabel}</span></span>
                    <button type="button" onClick={() => setEditor((ed) => ed ? { ...ed, caseId: '', procLabel: '' } : ed)} className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <BuscaProcesso onPick={(c) => setEditor((ed) => ed ? { ...ed, caseId: c.id, procLabel: c.label } : ed)} />
                )}
              </Field>

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

              {/* Centro de custos UNIFICADO: uma vertical · Escritório (comum, rateia auto) · Ratear entre várias.
                  Modo escolhido em PILLS bem visíveis (não escondido dentro do combobox) — é o
                  ponto que mais gerava confusão: "Ratear" ficava perdido no rodapé de uma lista
                  de 7 verticais e passava despercebido. */}
              {(() => {
                const modo = editor.rateioVerticais.length > 0 ? '__ratear' : (editor.area === 'Escritório' ? 'Escritório' : 'uma');
                const opcoes = [...new Set([...verticaisLanc, ...VERTICAIS_PADRAO])];
                const irPara = (m: 'uma' | 'Escritório' | '__ratear') => {
                  if (m === '__ratear') {
                    const primeira = editor.area && editor.area !== 'Escritório' ? editor.area : '';
                    setEditor({ ...editor, area: '', rateioVerticais: editor.rateioVerticais.length ? editor.rateioVerticais : [{ area: primeira, valor: '', label: '' }, { area: '', valor: '', label: '' }] });
                  } else if (m === 'Escritório') {
                    setEditor({ ...editor, area: 'Escritório', rateioVerticais: [] });
                  } else {
                    setEditor({ ...editor, area: editor.area === 'Escritório' ? '' : editor.area, rateioVerticais: [] });
                  }
                };
                return (
                <Field label="Centro de custos (vertical)">
                  <div className="flex flex-wrap gap-1.5">
                    <Chip active={modo === 'uma'} onClick={() => irPara('uma')}>Uma vertical</Chip>
                    <Chip active={modo === 'Escritório'} onClick={() => irPara('Escritório')}>Escritório (comum)</Chip>
                    <Chip active={modo === '__ratear'} onClick={() => irPara('__ratear')}>Ratear entre várias verticais</Chip>
                  </div>
                  {modo === 'uma' && <div className="mt-2"><ComboBox value={editor.area} options={opcoes} allowFree placeholder="digite a vertical…" onChange={(v) => setEditor({ ...editor, area: v })} /></div>}
                  <p className="mt-1.5 text-[11px] text-zinc-400"><strong>Uma vertical</strong> = custo direto dela · <strong>Escritório (comum)</strong> = rateia automático e igual entre todas as verticais · <strong>Ratear</strong> = você define a fatia de cada uma (ex.: agência ÷ 3). Honorário casa a vertical sozinho pelo cliente do processo.</p>
                </Field>
                );
              })()}

              {/* Linhas do rateio manual — só quando escolheu "Ratear entre várias" acima */}
              {editor.tipo === 'despesa' && editor.rateioVerticais.length > 0 && (() => {
                const total = parseValor(editor.valor);
                const somaRV = editor.rateioVerticais.reduce((s, x) => s + parseValor(x.valor), 0);
                const dividirIgual = () => { const n = editor.rateioVerticais.filter((x) => x.area).length || editor.rateioVerticais.length; if (!n || total <= 0) return; const cada = Math.floor((total / n) * 100) / 100; setEditor({ ...editor, rateioVerticais: editor.rateioVerticais.map((x, i, arr) => ({ ...x, valor: fmtMoney(i === arr.length - 1 ? total - cada * (n - 1) : cada) })) }); };
                return (
                <Field label="Fatia de cada vertical">
                  <div className="space-y-2 rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-800">
                    <p className="text-[11px] text-zinc-400">A despesa aparece <strong>uma vez</strong> no livro-razão; cada área puxa a fatia (ex.: agência R$1.300 ÷ 3). Marque a <strong>linha</strong> (ex.: Agência 1/3) para a fatia cair no <strong>holerite</strong> de quem assume esse custo.</p>
                    {editor.rateioVerticais.map((x, i) => {
                      return (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <ComboBox className="min-w-0 flex-1" value={x.area} options={areasVert} allowFree placeholder="vertical ou frente…" onChange={(val) => setEditor({ ...editor, rateioVerticais: editor.rateioVerticais.map((y, j) => j === i ? { ...y, area: val } : y) })} />
                        {/* Linha do custo (Agência 1/3, Anúncios…) — casa com o CUSTEIO do RH: quem assume essa linha vê a fatia no holerite. Vazio = área inteira. */}
                        <ComboBox className="min-w-[8rem] flex-1" value={x.label ?? ''} options={['Agência (1/3)', 'Anúncios', 'Tráfego Pago']} allowFree placeholder="linha (opcional)" onChange={(val) => setEditor({ ...editor, rateioVerticais: editor.rateioVerticais.map((y, j) => j === i ? { ...y, label: val } : y) })} />
                        <div className="w-28"><MoneyInput value={x.valor} onChange={(v) => setEditor({ ...editor, rateioVerticais: editor.rateioVerticais.map((y, j) => j === i ? { ...y, valor: v } : y) })} /></div>
                        <button onClick={() => setEditor({ ...editor, rateioVerticais: editor.rateioVerticais.filter((_, j) => j !== i) })} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditor({ ...editor, rateioVerticais: [...editor.rateioVerticais, { area: '', valor: '', label: '' }] })} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar vertical</button>
                        {editor.rateioVerticais.length > 0 && total > 0 && <button onClick={dividirIgual} className="text-xs font-medium text-[#7048E8] hover:underline">dividir igual</button>}
                      </div>
                      {editor.rateioVerticais.length > 0 && <span className={`text-[11px] ${somaRV - total > 0.01 ? 'text-rose-600' : 'text-zinc-400'}`}>rateado {brl2(somaRV)}{total > 0 ? ` de ${brl2(total)}` : ''}{somaRV - total > 0.01 ? ' · excede!' : (total - somaRV > 0.01 ? ` · ${brl2(total - somaRV)} no geral` : '')}</span>}
                    </div>
                  </div>
                </Field>
                );
              })()}

              {/* Contribuição PESSOAL — quem, do próprio bolso, ajudou a pagar esta despesa.
                  Dimensão INDEPENDENTE do rateio por vertical acima (não precisa bater célula a
                  célula) — puramente informativo: aparece no holerite da pessoa, mas não vira
                  reembolso nem abate o líquido. */}
              {editor.tipo === 'despesa' && (() => {
                const total = parseValor(editor.valor);
                const verticaisComFatia = editor.rateioVerticais.filter((r) => r.area);
                const calc = (x: ContribRow) => contribValorCalc(x, total, editor.rateioVerticais);
                const somaContrib = editor.contribuintes.reduce((s, x) => s + calc(x), 0);
                const setRow = (i: number, patch: Partial<ContribRow>) => setEditor({ ...editor, contribuintes: editor.contribuintes.map((y, j) => j === i ? { ...y, ...patch } : y) });
                return (
                <Field label="Quem ajudou a pagar (contribuição pessoal)">
                  <div className="space-y-2 rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-800">
                    <p className="text-[11px] text-zinc-400">Marque quem cobriu parte deste gasto <strong>do próprio bolso</strong> — em <strong>valor fixo</strong>, <strong>%</strong> ou <strong>fração</strong> (ex.: Kauani banca "1/2" da fatia do REPB). Só aparece como "você contribuiu" no <strong>holerite</strong> da pessoa — não é reembolso nem abate a despesa.</p>
                    {editor.contribuintes.map((x, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={x.userId ?? ''} onChange={(e) => { const u = advogados.find((a) => a.id === e.target.value); setRow(i, { userId: e.target.value || undefined, nome: u?.name ?? x.nome }); }}>
                            <option value="">— escolher pessoa —</option>
                            {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <select className="shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={x.modo} onChange={(e) => setRow(i, { modo: e.target.value as ContribModo })}>
                            <option value="valor">R$ fixo</option>
                            <option value="pctTotal">% do total</option>
                            <option value="pctVertical" disabled={!verticaisComFatia.length}>% de uma vertical</option>
                          </select>
                          {x.modo === 'valor' && <div className="w-24"><MoneyInput value={x.valor} onChange={(v) => setRow(i, { valor: v })} /></div>}
                          {x.modo === 'pctTotal' && <div className="flex w-24 items-center gap-1"><input value={x.pct} onChange={(e) => setRow(i, { pct: e.target.value })} placeholder="50 ou 1/2" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-xs text-zinc-400">%</span></div>}
                          {x.modo === 'pctVertical' && (<>
                            <select className="w-28 shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={x.area ?? ''} onChange={(e) => setRow(i, { area: e.target.value })}>
                              <option value="">— vertical —</option>
                              {verticaisComFatia.map((r, k) => <option key={k} value={r.area}>{r.area}</option>)}
                            </select>
                            <div className="flex w-20 items-center gap-1"><input value={x.pct} onChange={(e) => setRow(i, { pct: e.target.value })} placeholder="50 ou 1/2" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-xs text-zinc-400">%</span></div>
                          </>)}
                          <button onClick={() => setEditor({ ...editor, contribuintes: editor.contribuintes.filter((_, j) => j !== i) })} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        {x.modo !== 'valor' && <p className="pl-1 text-[10px] text-zinc-400">= {brl2(calc(x))}{x.modo === 'pctVertical' && !x.area ? ' · escolha a vertical' : ''}</p>}
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => setEditor({ ...editor, contribuintes: [...editor.contribuintes, { nome: '', modo: 'valor', valor: '', pct: '' }] })} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar pessoa</button>
                      {editor.contribuintes.length > 0 && <span className={`text-[11px] ${somaContrib - total > 0.01 ? 'text-amber-600' : 'text-zinc-400'}`}>contribuiu {brl2(somaContrib)}{total > 0 ? ` de ${brl2(total)}` : ''}{somaContrib - total > 0.01 ? ' · passou do total' : ''}</span>}
                    </div>
                  </div>
                </Field>
                );
              })()}

              {/* Rateio (split) — só para honorários. Cada advogado por R$ ou % (auto-calcula). */}
              {editor.tipo === 'receita' && /honor/i.test(editor.categoria) && (() => {
                const base = splitBase(editor);
                return (
                <Field label="Rateio de honorários (sócio / associado · o resto fica com o escritório)">
                  <div className="space-y-2 rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-800">
                    {base > 0 && <p className="text-[11px] text-zinc-400">Base do rateio: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(base)}</strong> — informe em R$ ou % de cada advogado.</p>}
                    {editor.split.map((r, i) => {
                      const upd = (patch: Partial<SplitRow>) => setEditor({ ...editor, split: editor.split.map((x, j) => j === i ? { ...x, ...patch } : x) });
                      const efetivo = rowValor(r, base);
                      return (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <select value={r.userId} onChange={(e) => upd({ userId: e.target.value })} className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <option value="">advogado…</option>
                          {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <select value={r.tipo} onChange={(e) => upd({ tipo: e.target.value as 'socio' | 'associado' })} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <option value="socio">Sócio</option>
                          <option value="associado">Associado</option>
                        </select>
                        <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                          {(['valor', 'pct'] as const).map((m) => <button key={m} type="button" onClick={() => upd({ modo: m })} className={`px-2 py-1.5 text-xs font-semibold ${r.modo === m ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-500 dark:bg-zinc-900'}`}>{m === 'valor' ? 'R$' : '%'}</button>)}
                        </div>
                        {r.modo === 'pct'
                          ? <input value={r.pct} onChange={(e) => upd({ pct: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="%" className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                          : <div className="w-28"><MoneyInput value={r.valor} onChange={(v) => upd({ valor: v })} /></div>}
                        <button onClick={() => setEditor({ ...editor, split: editor.split.filter((_, j) => j !== i) })} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                        {r.modo === 'pct' && <span className="w-full pl-1 text-right text-[11px] text-zinc-400 sm:w-auto">= <strong className="text-zinc-600 dark:text-zinc-300">{brl2(efetivo)}</strong></span>}
                      </div>
                      );
                    })}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setEditor({ ...editor, split: [...editor.split, { tipo: 'socio', userId: '', valor: '', modo: 'valor', pct: '' }] })} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar advogado</button>
                      {(() => { const assigned = editor.split.reduce((s, r) => s + rowValor(r, base), 0); const sobra = base - assigned; return <span className={`text-[11px] ${sobra < -0.01 ? 'text-rose-600' : 'text-zinc-400'}`}>Escritório: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(Math.max(0, sobra))}</strong>{sobra < -0.01 ? ' · rateio excede o valor!' : ''}</span>; })()}
                    </div>
                  </div>
                </Field>
                );
              })()}

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
      <FichaDrawerMount ficha={ficha} />
    </Card>
  );
}

// ── Visão de cartão de crédito: gastos da fatura + saldo em aberto + pagar fatura ──
function CartaoCreditoView({ data, contas, onDone }: { data: FinDashboard; contas: Conta[]; onDone: () => void }) {
  const cartoes = useMemo(() => contas.filter((c) => c.cartao), [contas]);
  // Pode pagar a fatura com QUALQUER conta (incl. Nubank, que é conta e cartão) — não-cartão primeiro.
  const contasPagam = useMemo(() => [...contas].sort((a, b) => (a.cartao ? 1 : 0) - (b.cartao ? 1 : 0)), [contas]);
  const [cardId, setCardId] = useState<string>(cartoes[0]?.id ?? '');
  const cartao = cartoes.find((c) => c.id === cardId) ?? cartoes[0];
  const [contaPg, setContaPg] = useState<string>(contasPagam[0]?.id ?? '');
  const [dataPg, setDataPg] = useState<string>(toISOInput(hojeBR()));
  // Fatura selecionada para pagar (mês/ciclo).
  const [pgFatura, setPgFatura] = useState<{ key: string; label: string; venc: string; txIds: string[]; total: number } | null>(null);
  const qc = useQueryClient();

  const fechamento = cartao?.fechamento ?? 0;
  const vencDia = cartao?.vencimento ?? 0;
  // Gastos da fatura: despesas do cartão vindas do extrato (fonteImport) ou em aberto.
  // Despesa lançada à mão (ex.: repasse) NÃO entra na fatura — fica no livro-razão.
  // Gastos da fatura: TUDO que é despesa no cartão (a_pagar ou já pago) + os que migraram
  // pra conta ao pagar (faturaDe = este cartão). Assim nenhuma fatura "some" do histórico.
  // ESTORNO (crédito — "Estorno de compra") vem do extrato com valor POSITIVO — inclui aqui
  // também, senão ele simplesmente sumia da fatura em vez de abater o total.
  const gastos = useMemo(() => data.transacoes.filter((t) => (t.conta === cartao?.id && (t.valor < 0 || (t.valor > 0 && t.fonteImport === 'extrato'))) || t.faturaDe === cartao?.id), [data.transacoes, cartao?.id]);

  // A qual fatura (mês/ciclo) um gasto pertence: se o dia > fechamento, cai na fatura do mês seguinte.
  const faturaInfo = (dataBR: string) => {
    const m = (dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return { key: '0000-00', label: 'Sem data', fecha: '', venc: '' };
    const dia = +m[1]; let mes = +m[2]; let ano = +m[3];
    if (fechamento > 0 && dia > fechamento) { mes += 1; if (mes > 12) { mes = 1; ano += 1; } }
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    const fecha = fechamento > 0 ? `${String(fechamento).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}` : '';
    let vm = mes + 1, va = ano; if (vm > 12) { vm = 1; va += 1; }
    const venc = vencDia > 0 ? `${String(vencDia).padStart(2, '0')}/${String(vm).padStart(2, '0')}/${va}` : '';
    return { key, label: mesLabel(key), fecha, venc };
  };

  // Agrupa por fatura (mês do ciclo). Em aberto = gastos a_pagar; pagas = já baixadas.
  const faturas = useMemo(() => {
    const map = new Map<string, { info: ReturnType<typeof faturaInfo>; abertos: FinTransacao[]; pagos: FinTransacao[] }>();
    for (const t of gastos) {
      const info = faturaInfo(t.data);
      if (!map.has(info.key)) map.set(info.key, { info, abertos: [], pagos: [] });
      const g = map.get(info.key)!;
      if (txStatus(t) === 'a_pagar') g.abertos.push(t); else g.pagos.push(t);
    }
    return [...map.values()].sort((a, b) => b.info.key.localeCompare(a.info.key));
  }, [gastos, fechamento, vencDia]);

  // Soma com SINAL (não Math.abs): despesa (negativo) soma ao total devido, estorno
  // (positivo) abate — Math.abs contaria o estorno como MAIS um gasto em vez de um crédito.
  const abertoTotal = faturas.reduce((s, f) => s + f.abertos.reduce((x, t) => x - t.valor, 0), 0);

  // Seletor de mês (fatura) — igual ao livro-razão. '' = todas as faturas.
  const [mesFat, setMesFat] = useState<string>(() => faturaInfo(hojeBR()).key);
  const [impFatura, setImpFatura] = useState(false);
  const mesesFat = useMemo(() => [...new Set([mesFat, ...faturas.map((f) => f.info.key)])].filter((k) => /^\d{4}-\d{2}$/.test(k)).sort((a, b) => b.localeCompare(a)), [faturas, mesFat]);
  const faturasVis = mesFat ? faturas.filter((f) => f.info.key === mesFat) : faturas;

  const pagarM = useMutation({
    mutationFn: () => financeiroService.pagarFatura({ cartaoId: cartao!.id, contaPagamentoId: contaPg, data: toBR(dataPg), txIds: pgFatura!.txIds }),
    onSuccess: (r) => { toast.success(`Fatura ${pgFatura?.label} paga: ${brl2(r.pago)} · ${r.baixados} gasto(s)`); setPgFatura(null); onDone(); qc.invalidateQueries({ queryKey: ['financeiro'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao pagar fatura'),
  });

  const reabrirM = useMutation({
    mutationFn: (txIds: string[]) => financeiroService.reabrirFatura({ cartaoId: cartao!.id, txIds }),
    onSuccess: (r) => { toast.success(`${r.reabertos} gasto(s) reabertos (voltaram para "a pagar")`); onDone(); qc.invalidateQueries({ queryKey: ['financeiro'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao reabrir'),
  });

  const abrirPagar = (f: (typeof faturas)[number]) => {
    const total = f.abertos.reduce((s, t) => s - t.valor, 0); // sinal: estorno abate
    setContaPg(contasPagam[0]?.id ?? '');
    setDataPg(f.info.venc ? toISOInput(f.info.venc) : toISOInput(hojeBR()));
    setPgFatura({ key: f.info.key, label: f.info.label, venc: f.info.venc, txIds: f.abertos.map((t) => t.id!).filter(Boolean), total });
  };

  const linha = (t: FinTransacao) => {
    const ehCredito = t.valor > 0; // estorno/crédito na fatura — abate em vez de somar
    return (
    <div key={t.id} className="flex items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-sm dark:border-zinc-800/70">
      <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-400">{(t.data || '').slice(0, 5)}</span>
      {ehCredito ? <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{titleCase(t.pagador || t.recebedor || t.party || '') || t.categoria}{ehCredito && <span className="ml-1.5 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">estorno</span>}</span>
      <span className="hidden w-40 shrink-0 items-center gap-1.5 text-xs text-zinc-500 sm:flex"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(data, t.categoria) }} /><span className="truncate">{t.categoria}</span></span>
      <span className={`w-24 shrink-0 whitespace-nowrap text-right font-semibold tabular-nums ${ehCredito ? 'text-emerald-600' : 'text-rose-600'}`}>{ehCredito ? '-' : ''}{brl2(t.valor)}</span>
    </div>
    );
  };

  if (!cartao) return null;
  const semCiclo = !(fechamento > 0);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {cartoes.length > 1 ? (
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200"><CreditCard className="h-4 w-4" style={{ color: cartao.cor ?? '#820AD1' }} /> {cartao.nome}</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <CalendarioFiltro
            mesSel={mesFat} deISO="" ateISO=""
            onMes={(ym) => setMesFat(ym)}
            onPeriodo={() => setMesFat('')}
            onLimpar={() => setMesFat('')}
          />
          <span className="text-xs text-zinc-400">{fechamento > 0 ? `fecha dia ${fechamento}` : 'sem dia de fechamento'}{vencDia > 0 ? ` · vence dia ${vencDia}` : ''} · em aberto <strong className="text-rose-600">{brl2(abertoTotal)}</strong></span>
          <button onClick={() => setImpFatura(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#820AD1] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"><ArrowDownCircle className="h-3.5 w-3.5" /> Importar fatura</button>
        </div>
      </div>
      {impFatura && <ImportExtratoModal contas={contas} contaFixa={cartao.id} onClose={() => { setImpFatura(false); onDone(); }} />}

      {semCiclo && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/15 dark:text-amber-400">Defina o <strong>dia de fechamento e vencimento</strong> deste cartão em <strong>Contas</strong> para separar as faturas por mês (ex.: fecha 26, vence 3).</p>}
      <p className="mt-2 text-xs text-zinc-400">Use <strong>Importar fatura</strong> pra subir o extrato do cartão aqui — os gastos entram como <strong>"a pagar"</strong> (fora do caixa). Ao clicar <strong>Pagar fatura</strong>, os próprios débitos viram <strong>liquidados</strong> na conta escolhida (sem lançar o pagamento em dobro).</p>

      <div className="mt-3 space-y-3">
        {faturasVis.map((f) => {
          const totalAberto = f.abertos.reduce((s, t) => s - t.valor, 0); // sinal: estorno abate
          const totalPago = f.pagos.reduce((s, t) => s - t.valor, 0);
          const paga = f.abertos.length === 0 && f.pagos.length > 0;
          return (
            <div key={f.info.key} className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2 bg-zinc-50/70 px-3 py-2 dark:bg-zinc-800/30">
                <CreditCard className="h-4 w-4 shrink-0" style={{ color: cartao.cor ?? '#820AD1' }} />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Fatura {f.info.label}</span>
                {(f.info.fecha || f.info.venc) && <span className="text-[11px] text-zinc-400">{f.info.fecha ? `fecha ${f.info.fecha.slice(0, 5)}` : ''}{f.info.venc ? ` · vence ${f.info.venc.slice(0, 5)}` : ''}</span>}
                {paga ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">paga</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">em aberto</span>}
                <span className="ml-auto text-sm font-bold tabular-nums text-rose-600">{brl2(totalAberto || totalPago)}</span>
                {f.abertos.length > 0 && contasPagam.length > 0 && (
                  <button onClick={() => abrirPagar(f)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"><Banknote className="h-3.5 w-3.5" /> Pagar fatura</button>
                )}
                {paga && (
                  <button onClick={() => { if (confirm(`Reabrir a fatura ${f.info.label}? Os ${f.pagos.length} gasto(s) voltam para "a pagar".`)) reabrirM.mutate(f.pagos.map((t) => t.id!).filter(Boolean)); }} disabled={reabrirM.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition hover:border-amber-500 hover:text-amber-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"><RefreshCw className="h-3.5 w-3.5" /> Reabrir</button>
                )}
              </div>
              {f.abertos.map(linha)}
              {f.pagos.length > 0 && <><div className="border-t border-zinc-100 bg-zinc-50/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#02883C] dark:border-zinc-800/70 dark:bg-zinc-800/20">Pago ({f.pagos.length})</div>{f.pagos.map(linha)}</>}
            </div>
          );
        })}
        {faturas.length === 0 && <p className="rounded-xl border border-zinc-200/70 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">Nenhum gasto no cartão. Suba o extrato do cartão em <strong>Importar extrato</strong> (escolha a conta do cartão).</p>}
        {faturas.length > 0 && faturasVis.length === 0 && <p className="rounded-xl border border-zinc-200/70 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">Nenhuma fatura em <strong>{mesLabel(mesFat)}</strong>. Escolha outro mês ou <button onClick={() => setMesFat('')} className="font-medium text-[#228BE6] hover:underline">ver todas</button>.</p>}
      </div>

      {pgFatura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Pagar fatura {pgFatura.label}</h3><button onClick={() => setPgFatura(null)} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button></div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Baixa <strong>{pgFatura.txIds.length}</strong> gasto(s) desta fatura (<strong className="text-rose-600">{brl2(pgFatura.total)}</strong>) e lança uma saída no livro-razão.</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pagar com a conta</p>
                <select value={contaPg} onChange={(e) => setContaPg(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {contasPagam.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Data do pagamento{pgFatura.venc ? ` (vence ${pgFatura.venc.slice(0, 5)})` : ''}</p>
                <input type="date" value={dataPg} onChange={(e) => setDataPg(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setPgFatura(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => pagarM.mutate()} disabled={pagarM.isPending || !contaPg} className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{pagarM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Pagar {brl2(pgFatura.total)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal: importar extrato (PDF/CSV/OFX) → lançamentos, com dedup server-side ──
function ImportExtratoModal({ contas, onClose, contaFixa }: { contas: { id: string; nome: string; cartao?: boolean }[]; onClose: () => void; contaFixa?: string }) {
  const qc = useQueryClient();
  const [conta, setConta] = useState(contaFixa ?? contas[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [parsing, setParsing] = useState(false);
  const [conf, setConf] = useState<import('@/features/financeiro/services/financeiro.service').ExtratoConferencia | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [areas, setAreas] = useState<Record<number, string>>({}); // vertical escolhida por linha (init da sugestão da IA); '__ratear' = rateio abaixo
  const [rateios, setRateios] = useState<Record<number, { area: string; valor: string; label?: string }[]>>({}); // fatia de cada vertical quando areas[i] === '__ratear'
  const [contribs, setContribs] = useState<Record<number, ContribRow[]>>({}); // contribuição pessoal por linha (independente do rateio por vertical)
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advogados = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);

  const conferir = async (linhas: { data: string; valor: number; descricao: string }[], contaArg?: string) => {
    if (!linhas.length) { toast.error('Não consegui ler lançamentos desse arquivo. Tente OFX/CSV ou cole o texto.'); return; }
    try {
      const r = await financeiroService.conferirExtrato((contaArg ?? conta) || null, linhas);
      setConf(r);
      setAreas(Object.fromEntries(r.linhas.map((l, i) => [i, l.verticalSugerida || '']))); // pré-preenche com a sugestão
      setSel(new Set(r.linhas.map((l, i) => (!l.duplicado && !l.revisar ? i : -1)).filter((i) => i >= 0))); // novos marcados; suspeitas ficam DESMARCADAS pra revisão
      const rev = r.revisar ?? r.linhas.filter((l) => l.revisar).length;
      if (r.novos === 0 && !rev) toast('Tudo nesse extrato já está lançado — nada novo.', { icon: '✅' });
      else toast.success(`${r.novos} novo(s) · ${r.duplicados} já existe(m)${rev ? ` · ${rev} pra revisar` : ''}`);
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
      // Detecta se é FATURA DE CARTÃO só com sinais ESTRUTURAIS de cartão (compras parceladas,
      // IOF de compra, "pagamento recebido" = crédito da fatura). E NÃO troca se o arquivo tem
      // cara de EXTRATO DE CONTA (transferências, Pix/TED, "pagamento de fatura" = você pagando o
      // cartão PELA conta). Antes, "pagamento de fatura" (que é linha de CONTA) fazia trocar errado.
      const sinalCartao = linhas.some((l) => /iof de compra|parcela\s*\d+\s*\/\s*\d+|pagamento\s*recebid/i.test(l.descricao || ''));
      const sinalConta = linhas.some((l) => /transfer[eê]ncia|\bpix\b|\bted\b|\bdoc\b|pagamento\s*de\s*fatura|dep[óo]sito|sal[áa]rio|rendimento/i.test(l.descricao || ''));
      const pareceCartao = sinalCartao && !sinalConta;
      const cardAcc = contas.find((c) => c.cartao);
      const contaAtualEhCartao = !!contas.find((c) => c.id === conta)?.cartao;
      let alvo = conta;
      if (!contaFixa && pareceCartao && cardAcc && !contaAtualEhCartao) { alvo = cardAcc.id; setConta(cardAcc.id); toast(`Detectei fatura de cartão → conta "${cardAcc.nome}" (vai pra fatura, não pro caixa). Se for extrato da conta, troque acima.`, { icon: '💳', duration: 6000 }); }
      await conferir(linhas, alvo);
    } catch (e: any) { toast.error(e?.message || 'Erro ao ler o arquivo'); } finally { setParsing(false); }
  };

  const importM = useMutation({
    mutationFn: () => {
      if (!conf) throw new Error('confira primeiro');
      const linhas = conf.linhas.map((l, i) => ({ l, i })).filter(({ i }) => sel.has(i)).map(({ l, i }) => {
        const rawRateio = areas[i] === '__ratear' ? (rateios[i] ?? []) : [];
        const rv = rawRateio.filter((x) => x.area && parseValor(x.valor) > 0).map((x) => ({ area: x.area, valor: parseValor(x.valor), ...(x.label ? { label: x.label } : {}) }));
        const cb = (contribs[i] ?? []).filter((x) => x.nome && contribValorCalc(x, Math.abs(l.valor), rawRateio) > 0).map((x) => ({ userId: x.userId || undefined, nome: x.nome, valor: contribValorCalc(x, Math.abs(l.valor), rawRateio) }));
        return { data: l.data, valor: l.valor, descricao: l.descricao, area: rv.length ? undefined : (areas[i] || '').trim() || undefined, rateioVerticais: rv.length ? rv : undefined, contribuintes: cb.length ? cb : undefined };
      });
      return financeiroService.importarExtratoLinhas(conta || null, linhas);
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success(`${r.importados} lançamento(s) importado(s)${r.duplicados ? ` · ${r.duplicados} já existiam` : ''}`); onClose(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar'),
  });
  // Bloqueia importar se alguma linha selecionada estiver "ratear" sem nenhuma fatia válida
  // (área + valor) — evita cair de volta em "sem vertical" silenciosamente.
  const rateioIncompleto = [...sel].some((i) => areas[i] === '__ratear' && !(rateios[i] ?? []).some((x) => x.area && parseValor(x.valor) > 0));

  const toggle = (i: number) => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl scrollbar-thin dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><ArrowDownCircle className="h-4 w-4 text-[#02883C]" /> {contaFixa ? 'Importar fatura do cartão' : 'Importar extrato'}</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div><label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">Conta</label>
            {contaFixa
              ? <div className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-sm font-semibold text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-300"><CreditCard className="h-3.5 w-3.5" /> {contas.find((c) => c.id === contaFixa)?.nome ?? 'Cartão'}</div>
              : <select value={conta} onChange={(e) => setConta(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">— sem conta —</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />} Escolher arquivo (PDF/CSV/OFX)
            <input type="file" accept=".pdf,.csv,.ofx,.txt,.tsv,text/csv,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.currentTarget.value = ''; }} />
          </label>
          {nome && <span className="text-xs text-zinc-400">{nome}</span>}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Lê o arquivo, <strong>sugere a vertical</strong> de cada despesa (você ajusta na coluna) e <strong>não duplica</strong>: confere cada linha contra o que já está no caixa (valor+data) e contra reenvio do mesmo arquivo. Linhas <span className="font-semibold text-amber-700 dark:text-amber-300">⚠️ Revisar</span> têm mesmo valor+data de um lançamento existente mas <strong>nome diferente</strong> (ex.: sucumbência paga pelo tribunal no caso de um cliente) — vêm <strong>desmarcadas</strong>; marque só se for mesmo um lançamento novo. Comum do escritório → "Escritório" (rateia auto). Precisa dividir uma despesa entre <strong>várias verticais</strong> (ex.: agência ÷ 3)? Clique no ícone <Layers className="inline h-3 w-3 align-text-bottom" /> ao lado da vertical.</p>
        {contas.find((c) => c.id === conta)?.cartao
          ? <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-300">💳 <strong>Fatura de cartão:</strong> as compras entram como <strong>"a pagar"</strong> (fora do caixa) e a linha de <strong>pagamento de fatura é ignorada</strong>. Só entram no caixa quando você clicar em <strong>Pagar fatura</strong>.</p>
          : <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">⚠️ Importando pra uma <strong>conta bancária</strong> (vira caixa). Se este for o <strong>extrato do cartão</strong>, troque a conta acima pra <strong>"Nubank cartão"</strong>.</p>}

        {conf && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-500">{conf.novos - (conf.revisar ?? conf.linhas.filter((l) => l.revisar).length)} novo(s) · <span className="text-amber-600">{conf.duplicados} já existe(m)</span>{(conf.revisar ?? conf.linhas.filter((l) => l.revisar).length) > 0 && <> · <span className="font-semibold text-amber-700 dark:text-amber-300">{conf.revisar ?? conf.linhas.filter((l) => l.revisar).length} pra revisar ⚠️</span></>}</span>
              <span className="text-xs text-zinc-400">{sel.size} selecionado(s)</span>
            </div>
            {/* Sem scroll aninhado (era um scroll dentro do scroll do modal, confuso de mexer):
                só o modal inteiro rola — 1 scrollbar só. */}
            <div className="overflow-x-auto rounded-lg border border-zinc-200/70 scrollbar-thin dark:border-zinc-800">
              <table className="w-full min-w-[26rem] text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900"><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium"></th><th className="px-2 py-1.5 font-medium">Data</th><th className="px-2 py-1.5 font-medium">Descrição</th><th className="px-2 py-1.5 text-right font-medium">Valor</th><th className="px-2 py-1.5 font-medium">Vertical</th><th className="px-2 py-1.5 font-medium">Status</th></tr></thead>
                <tbody>
                  {conf.linhas.map((l, i) => (
                    <Fragment key={i}>
                    <tr className={`border-t border-zinc-100 dark:border-zinc-800 ${l.duplicado ? 'opacity-60' : l.revisar ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(i)} onChange={() => toggle(i)} className="accent-[#02883C]" /></td>
                      <td className="px-2 py-1.5 tabular-nums text-zinc-500">{l.data}</td>
                      <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">{l.descricao || '—'}{l.revisar && l.motivo && <span className="mt-0.5 block text-[10px] font-medium leading-tight text-amber-700 dark:text-amber-300">⚠️ {l.motivo}</span>}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${l.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(l.valor)}</td>
                      <td className="px-2 py-1.5">{l.valor < 0 ? (
                        areas[i] === '__ratear' ? (
                          <button type="button" onClick={() => setAreas((a) => ({ ...a, [i]: '' }))} title="Desfazer rateio — voltar a escolher uma vertical" className="inline-flex items-center gap-1 rounded-md border border-[#7048E8]/40 bg-[#7048E8]/10 px-2 py-1.5 text-xs font-medium text-[#7048E8] hover:bg-[#7048E8]/20">
                            <Layers className="h-3.5 w-3.5" /> Rateando <X className="h-3 w-3" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <ComboBox className="w-28" value={areas[i] ?? ''} options={VERTICAIS_PADRAO}
                              actions={[{ value: 'Escritório', label: 'Escritório (comum) · rateia auto' }]}
                              labelOf={(v) => v === '' ? 'Escritório (comum · padrão)' : v === 'Escritório' ? 'Escritório (comum)' : v}
                              placeholder="vertical…" onChange={(v) => setAreas((a) => ({ ...a, [i]: v }))} />
                            <button type="button" title="Ratear entre várias verticais" onClick={() => {
                              const primeira = areas[i] && areas[i] !== 'Escritório' ? areas[i] : '';
                              setAreas((a) => ({ ...a, [i]: '__ratear' }));
                              if (!rateios[i]) setRateios((r) => ({ ...r, [i]: [{ area: primeira, valor: '' }, { area: '', valor: '' }] }));
                            }} className="shrink-0 rounded-md border border-zinc-300 p-1.5 text-zinc-500 hover:border-[#7048E8] hover:text-[#7048E8] dark:border-zinc-700">
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      ) : (
                        <ComboBox className="w-44" value={areas[i] ?? ''} options={VERTICAIS_PADRAO}
                          actions={[{ value: '', label: 'Honorário (casa pelo cliente)' }, { value: '__transfer', label: 'Transferência / cobertura (não é honorário)' }, { value: 'Escritório', label: 'Escritório (comum)' }]}
                          labelOf={(v) => v === '' ? 'casa pelo cliente' : v === '__transfer' ? 'transferência (não honorário)' : v === 'Escritório' ? 'Escritório (comum)' : v}
                          placeholder="honorário…" onChange={(v) => setAreas((a) => ({ ...a, [i]: v }))} />
                      )}</td>
                      <td className="px-2 py-1.5">{l.duplicado
                        ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title={l.motivo || ''}>Já existe</span>
                        : l.revisar
                        ? <span className="cursor-help rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title={l.motivo || ''}>⚠️ Revisar</span>
                        : <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Novo</span>}</td>
                    </tr>
                    {areas[i] === '__ratear' && (() => {
                      const rows = rateios[i] ?? [];
                      const total = Math.abs(l.valor);
                      const soma = rows.reduce((s, x) => s + parseValor(x.valor), 0);
                      const setRows = (fn: (rows: { area: string; valor: string; label?: string }[]) => { area: string; valor: string; label?: string }[]) => setRateios((r) => ({ ...r, [i]: fn(r[i] ?? []) }));
                      const dividirIgual = () => { const n = rows.filter((x) => x.area).length || rows.length; if (!n || total <= 0) return; const cada = Math.floor((total / n) * 100) / 100; setRows((rr) => rr.map((x, j, arr) => ({ ...x, valor: fmtMoney(j === arr.length - 1 ? total - cada * (n - 1) : cada) }))); };
                      return (
                        <tr className="border-t border-zinc-100 bg-violet-50/40 dark:border-zinc-800 dark:bg-violet-900/10">
                          <td></td>
                          <td colSpan={5} className="px-2 py-2">
                            <div className="space-y-1.5 rounded-lg border border-violet-200/70 p-2.5 dark:border-violet-900/40">
                              <p className="text-[11px] text-zinc-400">A despesa continua <strong>uma só</strong> no livro-razão; cada vertical puxa sua fatia (rateio de {brl2(l.valor)}).</p>
                              {rows.map((x, j) => (
                                <div key={j} className="flex flex-wrap items-center gap-1.5">
                                  <ComboBox className="min-w-0 flex-1" value={x.area} options={VERTICAIS_PADRAO} allowFree placeholder="vertical…" onChange={(val) => setRows((rr) => rr.map((y, k) => k === j ? { ...y, area: val } : y))} />
                                  <div className="w-28"><MoneyInput value={x.valor} onChange={(v) => setRows((rr) => rr.map((y, k) => k === j ? { ...y, valor: v } : y))} /></div>
                                  <button onClick={() => setRows((rr) => rr.filter((_, k) => k !== j))} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                                </div>
                              ))}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setRows((rr) => [...rr, { area: '', valor: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar vertical</button>
                                  {rows.length > 0 && total > 0 && <button onClick={dividirIgual} className="text-xs font-medium text-[#7048E8] hover:underline">dividir igual</button>}
                                </div>
                                <span className={`text-[11px] ${soma - total > 0.01 ? 'text-rose-600' : 'text-zinc-400'}`}>rateado {brl2(soma)} de {brl2(total)}{soma - total > 0.01 ? ' · excede!' : (total - soma > 0.01 ? ` · falta ${brl2(total - soma)}` : ' ✓')}</span>
                              </div>
                            </div>
                            {/* Contribuição PESSOAL — quem ajudou a pagar do próprio bolso. Vem
                                DEPOIS do rateio por vertical (mesma ordem do editor manual);
                                independente das fatias acima — aparece no holerite da pessoa. */}
                            {(() => {
                              const cRows = contribs[i] ?? [];
                              const verticaisComFatia = rows.filter((r) => r.area);
                              const calc = (x: ContribRow) => contribValorCalc(x, total, rows);
                              const cSoma = cRows.reduce((s, x) => s + calc(x), 0);
                              const setCRow = (j: number, patch: Partial<ContribRow>) => setContribs((c) => ({ ...c, [i]: (c[i] ?? []).map((y, k) => k === j ? { ...y, ...patch } : y) }));
                              return (
                              <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200/70 p-2.5 dark:border-amber-900/40">
                                <p className="text-[11px] text-zinc-400">Quem ajudou a pagar <strong>do próprio bolso</strong> — em <strong>valor fixo</strong>, <strong>%</strong> ou <strong>fração</strong> (ex.: "1/2" da fatia do REPB). Informativo — aparece no <strong>holerite</strong> da pessoa, não abate a despesa.</p>
                                {cRows.map((x, j) => (
                                  <div key={j} className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <select className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={x.userId ?? ''} onChange={(e) => { const u = advogados.find((a) => a.id === e.target.value); setCRow(j, { userId: e.target.value || undefined, nome: u?.name ?? x.nome }); }}>
                                        <option value="">— escolher pessoa —</option>
                                        {advogados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                      </select>
                                      <select className="shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={x.modo} onChange={(e) => setCRow(j, { modo: e.target.value as ContribModo })}>
                                        <option value="valor">R$ fixo</option>
                                        <option value="pctTotal">% do total</option>
                                        <option value="pctVertical" disabled={!verticaisComFatia.length}>% de uma vertical</option>
                                      </select>
                                      {x.modo === 'valor' && <div className="w-24"><MoneyInput value={x.valor} onChange={(v) => setCRow(j, { valor: v })} /></div>}
                                      {x.modo === 'pctTotal' && <div className="flex w-24 items-center gap-1"><input value={x.pct} onChange={(e) => setCRow(j, { pct: e.target.value })} placeholder="50 ou 1/2" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-xs text-zinc-400">%</span></div>}
                                      {x.modo === 'pctVertical' && (<>
                                        <select className="w-28 shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={x.area ?? ''} onChange={(e) => setCRow(j, { area: e.target.value })}>
                                          <option value="">— vertical —</option>
                                          {verticaisComFatia.map((r, k) => <option key={k} value={r.area}>{r.area}</option>)}
                                        </select>
                                        <div className="flex w-20 items-center gap-1"><input value={x.pct} onChange={(e) => setCRow(j, { pct: e.target.value })} placeholder="50 ou 1/2" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-xs text-zinc-400">%</span></div>
                                      </>)}
                                      <button onClick={() => setContribs((c) => ({ ...c, [i]: (c[i] ?? []).filter((_, k) => k !== j) }))} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                    {x.modo !== 'valor' && <p className="pl-1 text-[10px] text-zinc-400">= {brl2(calc(x))}{x.modo === 'pctVertical' && !x.area ? ' · escolha a vertical' : ''}</p>}
                                  </div>
                                ))}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <button onClick={() => setContribs((c) => ({ ...c, [i]: [...(c[i] ?? []), { nome: '', modo: 'valor', valor: '', pct: '' }] }))} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar pessoa</button>
                                  {cRows.length > 0 && <span className="text-[11px] text-zinc-400">contribuiu {brl2(cSoma)} de {brl2(total)}</span>}
                                </div>
                              </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })()}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              {rateioIncompleto && <span className="text-xs text-amber-600">⚠️ dê uma fatia (vertical + valor) pra cada rateio antes de importar</span>}
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={() => importM.mutate()} disabled={importM.isPending || sel.size === 0 || rateioIncompleto} className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{importM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Importar ${sel.size} selecionado(s)`}</button>
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
  const ficha = useFichaCliente();
  const [filtro, setFiltro] = useState<'todos' | StatusFin>('todos');
  const [busca, setBusca] = useState('');
  const [ordemCli, setOrdemCli] = useState<'valor' | 'recente' | 'antigo'>('valor');
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
    const recebido = entradas.reduce((s, t) => s + t.valor, 0);
    const repassado = honor.filter((t) => t.valor < 0).reduce((s, t) => s - t.valor, 0);
    const exito = entradas.filter((t) => t.subtipo === 'exito').reduce((s, t) => s + t.valor, 0);
    const inicial = recebido - exito; // tudo que não é êxito = inicial (contrato/entrada)
    const porStatus = (st: StatusFin) => clientes.filter((c) => c.status === st).length;
    return { recebido, repassado, inicial, exito, liquido: recebido - repassado, nClientes: clientes.length, emDia: porStatus('em-dia'), atencao: porStatus('atencao') };
  }, [clientes, dataF.transacoes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrada = clientes.filter((c) => (filtro === 'todos' || c.status === filtro) && (!q || c.nome.toLowerCase().includes(q)));
    // aggregarClientes já devolve ordenado por 'valor' (recebido desc); só reordena se pedirem outra ordem.
    if (ordemCli === 'valor') return filtrada;
    const dataIso = (br: string | null) => toISOInput(br || '') || '0000-00-00';
    return [...filtrada].sort((a, b) => {
      const cmp = dataIso(ordemCli === 'recente' ? b.ultimo : a.primeiro).localeCompare(dataIso(ordemCli === 'recente' ? a.ultimo : b.primeiro));
      return cmp;
    });
  }, [clientes, filtro, busca, ordemCli]);

  // TODOS os recebimentos individuais (não agrupados por cliente), mais recente primeiro —
  // pra nenhum pagamento "sumir" no meio da carteira ordenada por valor total.
  const recebimentos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dataF.transacoes
      .filter((t) => /honor/i.test(t.categoria) && t.valor >= 0 && (!t.status || t.status === 'recebido'))
      .filter((t) => !q || (t.party || t.pagador || '').toLowerCase().includes(q))
      .sort((a, b) => toISOInput(b.data).localeCompare(toISOInput(a.data)));
  }, [dataF.transacoes, busca]);
  const [showTodos, setShowTodos] = useState(false);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Honorários recebidos" value={brl(tot.recebido)} hint={`${tot.nClientes} clientes`} accent="#2F9E44" />
        <MiniStat label="Iniciais (contrato)" value={brl(tot.inicial)} hint="entrada / parcelas do contrato" accent="#10B981" />
        <MiniStat label="De êxito (alvará/acordo)" value={brl(tot.exito)} hint="ganho no processo" accent="#7048E8" />
        <MiniStat label="Líquido p/ o escritório" value={brl(tot.liquido)} hint="recebido − repassado" accent="#228BE6" />
        <MiniStat label="Em dia / Atenção" value={`${tot.emDia} / ${tot.atencao}`} hint="recorrentes que pararam" accent="#F59F00" />
      </div>

      <Card title={<>Todos os recebimentos <span className="font-normal text-zinc-400">· {recebimentos.length}</span></>}
        sub="cada pagamento de honorário individual, mais recente primeiro — nenhum some no meio da carteira por cliente."
        action={<button onClick={() => setShowTodos((v) => !v)} className="text-xs font-medium text-[#228BE6] hover:underline">{showTodos ? 'ocultar' : 'ver todos'}</button>}>
        {showTodos ? (
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {recebimentos.map((t, i) => (
              <div key={t.id ?? i} className="flex items-center gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm first:border-t-0 dark:border-zinc-800/70">
                <span className="w-16 shrink-0 tabular-nums text-xs text-zinc-400">{(t.data || '').slice(0, 5)}</span>
                <ClienteLink nome={t.party || t.pagador || ''} ficha={ficha} className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300" />
                {t.subtipo === 'exito' && <span className="hidden shrink-0 rounded bg-violet-100 px-1.5 text-[9px] font-semibold text-violet-600 dark:bg-violet-900/30 sm:inline">êxito</span>}
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-emerald-600">{brl2(t.valor)}</span>
              </div>
            ))}
            {recebimentos.length === 0 && <p className="py-6 text-center text-sm text-zinc-400">Nenhum recebimento no filtro atual.</p>}
          </div>
        ) : (
          <div className="space-y-0.5">
            {recebimentos.slice(0, 5).map((t, i) => (
              <div key={t.id ?? i} className="flex items-center gap-2 px-1 py-1 text-sm">
                <span className="w-16 shrink-0 tabular-nums text-xs text-zinc-400">{(t.data || '').slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{titleCase(t.party || t.pagador || '')}</span>
                {t.subtipo === 'exito' && <span className="hidden shrink-0 rounded bg-violet-100 px-1.5 text-[9px] font-semibold text-violet-600 dark:bg-violet-900/30 sm:inline">êxito</span>}
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-emerald-600">{brl2(t.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Carteira de honorários por cliente" sub="vinculado aos lançamentos. Status é comportamental (frequência de pagamento). O saldo devedor exato dos parcelados está na aba Cobranças."
        action={
          <div className="flex items-center gap-2">
            <select value={ordemCli} onChange={(e) => setOrdemCli(e.target.value as typeof ordemCli)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" title="Ordem da lista">
              <option value="valor">Maior valor</option>
              <option value="recente">Chegada: mais recente</option>
              <option value="antigo">Chegada: mais antigo</option>
            </select>
            <div className="relative"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="w-44 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
          </div>
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
                    <ClienteLink nome={c.nome} ficha={ficha} className="truncate text-sm font-medium" />
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
                    {(() => {
                      // Rateio: quem recebeu o quê dos honorários deste cliente (split entre advogados + escritório) e a prestação de contas do êxito.
                      const txsCli = dataF.transacoes.filter((t) => /honor/i.test(t.categoria) && normNome(t.pagador || t.party || '') === normNome(c.nome) && ((t.split?.length ?? 0) > 0 || t.rateio));
                      if (txsCli.length === 0) return null;
                      const acc = new Map<string, number>();
                      let escritorio = 0;
                      for (const t of txsCli) {
                        const sp = t.split ?? [];
                        const assigned = sp.reduce((s, x) => s + (x.valor || 0), 0);
                        for (const x of sp) { const k = x.nome || (x.tipo === 'associado' ? 'Associado' : 'Sócio'); acc.set(k, (acc.get(k) ?? 0) + (x.valor || 0)); }
                        escritorio += Math.max(0, Math.abs(t.valor) - assigned);
                      }
                      const exitos = txsCli.filter((t) => t.rateio);
                      return (
                        <div className="mt-2 border-t border-zinc-200/60 pt-2 dark:border-zinc-800/60">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#7048E8]">Rateio dos honorários (quem recebeu)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {escritorio > 0 && <span className="rounded-full bg-[#228BE6]/10 px-2 py-0.5 text-[11px] font-semibold text-[#228BE6]">Escritório: {brl2(escritorio)}</span>}
                            {[...acc.entries()].map(([nome, v]) => <span key={nome} className="rounded-full bg-[#7048E8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#7048E8]">{nome}: {brl2(v)}</span>)}
                          </div>
                          {exitos.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-[11px] text-zinc-400">Prestação de contas (êxito):</p>
                              {exitos.map((t, i) => t.rateio ? (
                                <div key={i} className="rounded bg-white/60 px-1.5 py-1 text-[11px] text-zinc-500 dark:bg-zinc-900/40">
                                  <span className="tabular-nums">{t.data}</span> · bruto <strong className="text-zinc-700 dark:text-zinc-200">{brl2(t.rateio.bruto)}</strong> · cliente {brl2(t.rateio.cliente)} · honorário {brl2(t.rateio.honorarios)} · sucumbência {brl2(t.rateio.sucumbencia)}
                                </div>
                              ) : null)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
          {lista.length === 0 && <p className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">Nenhum cliente neste filtro.</p>}
        </div>
      </Card>
      <FichaDrawerMount ficha={ficha} />
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

// "A receber" com 2 subvisualizações: Honorários iniciais (ASAAS/boletos) × A receber judicial (CS — prestação + cumprimento).
function AReceberTab({ data }: { data: FinDashboard }) {
  const [sub, setSub] = useState<'honorarios' | 'judicial'>('honorarios');
  return (
    <div>
      <div className="mt-4 inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {([['honorarios', 'Honorários iniciais', CreditCard], ['judicial', 'A receber judicial', Gavel]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setSub(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sub === k ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <Icon className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-400">{sub === 'honorarios'
        ? 'Boletos/parcelas dos honorários iniciais — sincroniza sozinho do ASAAS.'
        : 'Recebíveis dos processos (prestação de contas + cumprimento de sentença) — a parte do escritório, preenchida no card de cada processo.'}</p>
      {sub === 'honorarios' && <CobrancasTab data={data} />}
      {sub === 'judicial' && <CumprimentoTab />}
    </div>
  );
}

function CobrancasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const ficha = useFichaCliente();
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
  const syncAsaasM = useMutation({ mutationFn: () => financeiroService.asaasCobrancas(true), onSuccess: (r) => { if (r.forbidden) { toast.error('Só sócios/admin podem sincronizar.'); return; } if (!r.configurado) { toast.error('ASAAS não configurado no servidor.'); return; } inval(); toast.success(`ASAAS: ${r.novas} nova(s) · ${r.atualizadas} atualizada(s)`); }, onError: (e: any) => toast.error(e?.message || 'Erro ao sincronizar com o ASAAS') });

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

  // Filtro por mês (igual o livro-razão): mostra as cobranças com parcela VENCENDO no mês escolhido.
  const parcMes = (venc: string) => { const m = (venc || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}` : ''; };
  const [mesF, setMesF] = useState('');
  const mesesCob = useMemo(() => [...new Set(cobrancas.flatMap((c) => c.parcelas.map((p) => parcMes(p.vencimento))))].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [cobrancas]);
  const cobrancasF = useMemo(() => (!mesF ? cobrancas : cobrancas.filter((c) => c.parcelas.some((p) => p.status !== 'paga' && parcMes(p.vencimento) === mesF))), [cobrancas, mesF]);
  const aReceberMes = useMemo(() => (!mesF ? 0 : cobrancas.flatMap((c) => c.parcelas).filter((p) => p.status !== 'paga' && parcMes(p.vencimento) === mesF).reduce((s, p) => s + p.valor, 0)), [cobrancas, mesF]);

  return (
    <>
      <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-blue-50 to-white p-5 dark:border-zinc-800 dark:from-blue-900/15 dark:to-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><CreditCard className="h-5 w-5 text-[#228BE6]" /> Cobranças de honorários parcelados</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
            Espelha as <strong>vendas a prazo do ASAAS</strong> (atualiza sozinho de hora em hora) e também aceita contratos cadastrados na mão. Acompanhe o <strong>saldo devedor real</strong>, parcelas em aberto e atrasadas. Ao baixar uma parcela manual, ela vira <strong>honorário recebido</strong> no livro-razão.
          </p>
        </div>
        <button onClick={() => syncAsaasM.mutate()} disabled={syncAsaasM.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0052FF] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{syncAsaasM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Sincronizar ASAAS</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Saldo devedor (a receber)" value={brl(tot.devedor)} hint={`${tot.n} cobrança(s)`} accent="#228BE6" />
        <MiniStat label="Em atraso" value={brl(tot.atrasado)} hint={`${tot.nAtraso} cliente(s) atrasado(s)`} accent="#E03131" />
        <MiniStat label="Já recebido (parcelas baixadas)" value={brl(tot.recebido)} hint="entrou no livro-razão" accent="#2F9E44" />
        <div className="rounded-2xl border border-dashed border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Nova cobrança</button>
        </div>
      </div>

      {mesesCob.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
            <select value={mesF} onChange={(e) => setMesF(e.target.value)} className="bg-transparent text-sm font-medium outline-none"><option value="">Todos os meses</option>{mesesCob.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}</select>
          </div>
          {mesF && <span className="text-sm text-zinc-500">A receber em <strong className="text-zinc-700 dark:text-zinc-200">{mesLabel(mesF)}</strong>: <strong className="tabular-nums text-[#228BE6]">{brl2(aReceberMes)}</strong></span>}
          {mesF && <button onClick={() => setMesF('')} className="text-xs text-zinc-400 hover:text-zinc-600">limpar</button>}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
      ) : cobrancasF.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-zinc-400">{mesF ? `Nenhuma parcela a receber em ${mesLabel(mesF)}.` : 'Nenhuma cobrança ainda. Clique em "Nova cobrança" para cadastrar um contrato parcelado.'}</p></Card>
      ) : (
        <div className="mt-4 space-y-2">
          {cobrancasF.map((c) => {
            const s = STATUS_COB[c.statusCalc] ?? STATUS_COB.em_dia;
            const exp = aberta === c.id;
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <button onClick={() => setAberta(exp ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                  {exp ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100"><ClienteLink nome={c.cliente} ficha={ficha} className="truncate" /><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{s.label}</span>{c.fonte === 'asaas' && <span className="rounded-full bg-[#0052FF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">ASAAS</span>}</p>
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
                          {c.fonte === 'asaas'
                            ? <span className="w-7 shrink-0 text-center text-[9px] text-zinc-300" title="Status sincronizado do ASAAS — o recebimento entra no caixa automaticamente">ⓘ</span>
                            : p.status === 'paga'
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
      <FichaDrawerMount ficha={ficha} />
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

  const allCs = [...cs.cumprimento, ...cs.prestacao, ...cs.favoraveis, ...(cs.repb ?? [])];
  const areas = Array.from(new Set(allCs.map((x) => areaJuridica(x.area)))).sort() as string[];
  const resps = Array.from(new Set(allCs.map((x) => x.responsavel).filter(Boolean))).sort() as string[];
  const match = (x: { area: string | null; responsavel: string | null }) => (!areaF || areaJuridica(x.area) === areaF) && (!respF || x.responsavel === respF);
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const cumprimento = cs.cumprimento.filter(match);
  const prestacao = cs.prestacao.filter(match);
  const favoraveis = cs.favoraveis.filter(match);
  const repb = (cs.repb ?? []).filter(match);
  const repbCheio = repb.filter((x) => x.aReceberNosso > 0);
  const prestacaoCheia = prestacao.filter((x) => x.aReceberNosso > 0);
  const cumpCheio = cumprimento.filter((x) => x.valorCalculo > 0);
  const cumpVazio = cumprimento.length - cumpCheio.length;
  const prestVazio = prestacao.length - prestacaoCheia.length;
  const brutoCump = r2(cumpCheio.reduce((s, x) => s + (x.valorCalculo || 0), 0));
  const t = {
    nPrestacao: prestacao.length, aReceberPrestacao: r2(prestacao.reduce((s, x) => s + (x.aReceberNosso || 0), 0)),
    nCumprimento: cumprimento.length, brutoEmCumprimento: brutoCump, nossoEmCumprimento: r2(brutoCump * 0.4),
    nFavoraveis: favoraveis.length, estimadoFavoraveis: r2(favoraveis.reduce((s, x) => s + (x.estimado || 0), 0)),
    nRepb: repbCheio.length, aReceberRepb: r2(repbCheio.reduce((s, x) => s + (x.aReceberNosso || 0), 0)),
    acordadoRepb: r2(repbCheio.reduce((s, x) => s + (x.valorAcordo || 0), 0)), descontoRepb: r2(repbCheio.reduce((s, x) => s + (x.desconto || 0), 0)),
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

      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${t.nRepb > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <MiniStat label="A receber (nosso) — prestação" value={brl(t.aReceberPrestacao)} hint={`${t.nPrestacao} processo(s)`} accent="#2F9E44" />
        <MiniStat label="Em cumprimento (nosso ~40%)" value={brl(t.nossoEmCumprimento)} hint={`${t.nCumprimento} caso(s) · ${brl(t.brutoEmCumprimento)} bruto`} accent="#228BE6" />
        <MiniStat label="Sentenças favoráveis (estimado)" value={brl(t.estimadoFavoraveis)} hint={`${t.nFavoraveis} caso(s) · maior risco`} accent="#F59F00" />
        {t.nRepb > 0 && <MiniStat label="Acordos REPB (honorários)" value={brl(t.aReceberRepb)} hint={`${t.nRepb} acordo(s) · ${brl(t.acordadoRepb)} acordado`} accent="#B7791F" />}
        <MiniStat label="Total a receber (nosso)" value={brl(t.aReceberPrestacao + t.nossoEmCumprimento + t.estimadoFavoraveis + t.aReceberRepb)} hint="prestação + 40% cumprimento + sentenças + REPB" accent="#7048E8" />
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

      {/* Acordos REPB — êxito extrajudicial (honorários já são caixa nosso) */}
      {repbCheio.length > 0 && (
        <Card title="Acordos REPB — reestruturação de passivo (caixa nosso)" sub="acordos fechados na trilha REPB. Honorários do escritório = nosso; o desconto obtido é o ganho do cliente. Preenchido no card (fase Acordo/Concluído).">
          <CsTabela cols={['Cliente', 'Dívida original', 'Acordo', 'Desconto', 'Honorários (nosso)']} widths={['28%', '18%', '18%', '18%', '18%']}
            foot={<tr className="font-bold text-zinc-700 dark:text-zinc-100">
              <td className="px-2 py-1.5">Total ({repbCheio.length})</td>
              <td className="px-2 py-1.5" />
              <td className="px-2 py-1.5 text-right tabular-nums text-[#B7791F]">{brl2(t.acordadoRepb)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{brl2(t.descontoRepb)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{brl2(t.aReceberRepb)}</td>
            </tr>}>
            {repbCheio.map((x) => (
              <tr key={x.caseId} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1.5"><VerProcesso id={x.caseId}>{titleCase(x.cliente || x.title)}</VerProcesso></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{x.dividaOriginal ? brl2(x.dividaOriginal) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#B7791F]">{x.valorAcordo ? brl2(x.valorAcordo) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{x.desconto ? brl2(x.desconto) : '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-600">{brl2(x.honorariosNossos)}</td>
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
  const { data: members = [], isLoading } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advs = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const r = useMemo(() => aggregarRetiradas(data, advs), [data, advs]);
  const contas = data.contas ?? [];
  const retiradas = useMemo(() => data.transacoes.filter((t) => t.categoria === 'Pró-labore' || t.categoria === 'Retirada').sort((a, b) => toISOInput(b.data).localeCompare(toISOInput(a.data))), [data.transacoes]);

  // Matriz mês × advogado (quanto cada um retirou) — puxada DIRETO do livro-razão.
  const { matriz, colUsers, totalGeral } = useMemo(() => {
    const rows = new Map<string, Map<string, number>>();
    const labels = new Map<string, string>();
    for (const t of retiradas) {
      const mk = mesKey(t);
      const nome = (t.recebedor || t.party || '').trim() || '—';
      const u = advs.find((a) => normNome(a.name) === normNome(nome));
      const uk = u ? u.id : (normNome(nome) || '—');
      labels.set(uk, u ? u.name : nome);
      let mm = rows.get(mk); if (!mm) { mm = new Map(); rows.set(mk, mm); }
      mm.set(uk, (mm.get(uk) ?? 0) + Math.abs(t.valor));
    }
    const colTot = new Map<string, number>();
    for (const mm of rows.values()) for (const [uk, v] of mm) colTot.set(uk, (colTot.get(uk) ?? 0) + v);
    const colUsers = [...colTot.entries()].sort((a, b) => b[1] - a[1]).map(([uk]) => ({ uk, label: labels.get(uk) ?? uk }));
    const matriz = [...rows.entries()].map(([mk, mm]) => ({ mk, cells: mm, tot: [...mm.values()].reduce((s, v) => s + v, 0) })).sort((a, b) => b.mk.localeCompare(a.mk));
    const totalGeral = [...colTot.values()].reduce((s, v) => s + v, 0);
    return { matriz, colUsers, totalGeral };
  }, [retiradas, advs]);

  // Filtro por mês (igual o livro-razão) — a matriz já é mês a mês; aqui você foca num mês só.
  const [mesRet, setMesRet] = useState('');
  const matrizF = useMemo(() => (mesRet ? matriz.filter((row) => row.mk === mesRet) : matriz), [matriz, mesRet]);

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  const totalParts = r.porUser.reduce((s, u) => s + u.aReceber, 0);

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-zinc-800 dark:from-cyan-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Wallet className="h-5 w-5 text-[#15AABF]" /> Retiradas e pró-labore</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Painel <strong>informativo</strong>: mostra quanto cada pessoa já retirou por mês, lido direto do <strong>livro-razão</strong>. Para registrar uma retirada ou pró-labore, lance na aba <strong>Lançamentos</strong> (tipo despesa, categoria <em>Retirada</em>/<em>Pró-labore</em>, recebedor = a pessoa). Assim não há dois lugares para conferir.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total já retirado" value={brl(r.totalRetirado)} hint="pró-labore + retiradas (livro-razão)" accent="#E64980" />
        <MiniStat label="Honorários recebidos" value={brl(r.totalHonorarios)} hint="base do rateio" accent="#2F9E44" />
        <MiniStat label="Ficou no escritório" value={brl(r.escritorio)} hint="parte do escritório no rateio" accent="#228BE6" />
        <MiniStat label="Crédito do rateio" value={brl(totalParts)} hint="parte dos advogados (informativo)" accent="#7048E8" />
      </div>

      <Card title="Retiradas por mês" sub="quanto cada pessoa retirou em cada mês — espelho do livro-razão."
        action={matriz.length > 0 ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
            <select value={mesRet} onChange={(e) => setMesRet(e.target.value)} className="bg-transparent text-sm font-medium outline-none"><option value="">Todos os meses</option>{matriz.map((row) => <option key={row.mk} value={row.mk}>{mesLabel(row.mk)}</option>)}</select>
          </div>
        ) : undefined}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="px-2 py-1.5 font-medium">Mês</th>
                {colUsers.map((c) => <th key={c.uk} className="px-2 py-1.5 text-right font-medium">{c.label.split(' ')[0]}</th>)}
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrizF.map((row) => (
                <tr key={row.mk} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{mesLabel(row.mk)}</td>
                  {colUsers.map((c) => { const v = row.cells.get(c.uk) ?? 0; return <td key={c.uk} className="px-2 py-1.5 text-right tabular-nums text-pink-600">{v ? brl2(v) : '—'}</td>; })}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl2(row.tot)}</td>
                </tr>
              ))}
              {matrizF.length === 0 && <tr><td colSpan={colUsers.length + 2} className="py-8 text-center text-sm text-zinc-400">{mesRet ? 'Nenhuma retirada neste mês.' : 'Nenhuma retirada lançada ainda. Lance na aba Lançamentos.'}</td></tr>}
            </tbody>
            {matrizF.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 text-[13px] font-bold dark:border-zinc-700">
                  <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">Total{mesRet ? ' do mês' : ''}</td>
                  {colUsers.map((c) => { const v = matrizF.reduce((s, row) => s + (row.cells.get(c.uk) ?? 0), 0); return <td key={c.uk} className="px-2 py-1.5 text-right tabular-nums text-pink-600">{brl2(v)}</td>; })}
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-100">{brl2(matrizF.reduce((s, row) => s + row.tot, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Card title="Por advogado (acumulado)" sub="crédito do rateio × o que já foi retirado — apenas informativo, sem 'a pagar'.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Advogado</th><th className="px-2 py-1.5 text-right font-medium">Crédito do rateio</th><th className="px-2 py-1.5 text-right font-medium">Já retirou</th><th className="px-2 py-1.5 text-right font-medium">Diferença</th></tr></thead>
            <tbody>
              {r.porUser.filter((u) => u.aReceber || u.retirado).map((u) => (
                <tr key={u.userId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1.5"><span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />{u.nome}</span></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-violet-600">{u.aReceber ? brl2(u.aReceber) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-pink-600">{u.retirado ? brl2(u.retirado) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${u.saldo >= 0 ? 'text-zinc-400' : 'text-amber-600'}`}>{brl2(u.saldo)}</td>
                </tr>
              ))}
              {r.porUser.filter((u) => u.aReceber || u.retirado).length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-zinc-400">Nenhum crédito ou retirada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">O <strong>crédito do rateio</strong> é a parte que coube a cada advogado nos honorários recebidos (definida no lançamento do honorário). A <strong>diferença</strong> é só uma referência de quanto ainda não foi sacado — <strong>não é uma dívida a pagar</strong>. O pagamento real é o lançamento da retirada no livro-razão.</p>
      </Card>

      <Card title="Lançamentos de retirada" sub="pró-labore e retiradas do livro-razão. Para editar, abra a aba Lançamentos.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Data</th><th className="px-2 py-1.5 font-medium">Tipo</th><th className="px-2 py-1.5 font-medium">Recebedor</th><th className="px-2 py-1.5 font-medium">Conta</th><th className="px-2 py-1.5 text-right font-medium">Valor</th></tr></thead>
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
                  </tr>
                );
              })}
              {retiradas.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">Nenhuma retirada lançada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ═══════════════════════════ ABA · VERTICAIS (POR ÁREA) ═══════════════════════

const CORES_AREA: Record<string, string> = {
  'RMC/RCC': '#7048E8', 'REPB': '#9C36B5', 'Bancário': '#7048E8', 'Previdenciário': '#228BE6', 'Trabalhista': '#E8590C',
  'Consumidor': '#0CA678', 'Cível': '#F08C00', 'Dativos': '#495057', 'Geral (escritório)': '#868E96', 'Não identificada': '#ADB5BD',
};
const corArea = (a: string) => CORES_AREA[a] ?? '#15AABF';

function VerticaisTab({ data }: { data: FinDashboard }) {
  const [sel, setSel] = useState('');
  const [exp, setExp] = useState(''); // vertical com o livro-razão mensal aberto
  const [mesV, setMesV] = useState(''); // '' = período todo; senão recorta cada vertical no mês
  const pnl = data.verticalPnL;
  const verticais = pnl?.verticais ?? [];
  // meses disponíveis (o backend agora dá a mesma lista de meses em toda vertical)
  const mesesV = useMemo(() => {
    const s = new Set<string>();
    for (const v of verticais) for (const m of v.porMes ?? []) s.add(m.mes);
    return [...s].filter((k) => /^\d{4}-\d{2}$/.test(k)).sort((a, b) => b.localeCompare(a));
  }, [verticais]);
  // recorta uma vertical no mês escolhido (ou o período todo se mesV === '')
  const recorte = (v: (typeof verticais)[number]) => {
    if (!mesV) return { entradas: v.entradas, diretas: v.diretas, comum: v.comum ?? 0, saidas: v.saidas, resultado: v.resultado, margem: v.margem };
    const pm = (v.porMes ?? []).find((m) => m.mes === mesV);
    const entradas = pm?.entradas ?? 0, diretas = pm?.diretas ?? 0, comum = pm?.comum ?? 0;
    const saidas = Math.round((diretas + comum) * 100) / 100;
    return { entradas, diretas, comum, saidas, resultado: pm?.resultado ?? Math.round((entradas - saidas) * 100) / 100, margem: entradas > 0 ? Math.round(((entradas - saidas) / entradas) * 1000) / 10 : null };
  };
  const cons = pnl?.consolidado;
  const comum = pnl?.comum;
  const pessoas = pnl?.pessoas;
  const carteira = data.crescimento?.carteira.porArea ?? [];
  const comReceita = verticais.filter((v) => v.entradas > 0).sort((a, b) => b.entradas - a.entradas);
  const chart = comReceita.map((v) => ({ area: v.area, entradas: v.entradas }));
  // meses que aparecem em comum/pessoas (pra tabela "fora das verticais")
  const mesesFora = useMemo(() => {
    const m = new Map<string, { label: string; comum: number; pessoas: number }>();
    for (const x of comum?.porMes ?? []) { const r = m.get(x.mes) ?? { label: x.label, comum: 0, pessoas: 0 }; r.comum = x.valor; m.set(x.mes, r); }
    for (const x of pessoas?.porMes ?? []) { const r = m.get(x.mes) ?? { label: x.label, comum: 0, pessoas: 0 }; r.pessoas = x.valor; m.set(x.mes, r); }
    return [...m.entries()].map(([mes, r]) => ({ mes, ...r })).sort((a, b) => b.mes.localeCompare(a.mes));
  }, [comum, pessoas]);

  // Unificado: entrar numa vertical mostra o financeiro completo da área aqui mesmo.
  if (sel && sel !== 'Não identificada') return (
    <div className="mt-4">
      <button onClick={() => setSel('')} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#228BE6] hover:underline"><ChevronLeft className="h-4 w-4" /> Todas as verticais</button>
      <VerticalFinanceiro area={sel} />
    </div>
  );

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-gradient-to-br from-violet-50 to-white p-5 dark:border-zinc-800 dark:from-violet-900/15 dark:to-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Layers className="h-5 w-5 text-[#7048E8]" /> Verticais — o que cada área custa e rende</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          Cada vertical é como um <strong>livro-razão próprio</strong>: quanto faturou (honorário <strong>inicial</strong> + <strong>êxito</strong>) e quanto custou de <strong>direto</strong> (agência + anúncios), <strong>mês a mês</strong>. Os custos <strong>comuns</strong> do escritório (aluguel, contador, impostos, Claude…) são <strong>rateados por igual</strong> entre todas as verticais — cada área banca sua fatia. O <strong>pró-labore</strong> fica num balde à parte. Clique numa vertical para abrir os meses.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Faturou (verticais)" value={brl(cons?.entradas ?? 0)} hint="honorários casados" accent="#2F9E44" />
        <MiniStat label="Custo direto" value={brl(cons?.diretas ?? 0)} hint="agência + anúncios" accent="#E8590C" />
        <MiniStat label="Comum (escritório)" value={brl(cons?.comum ?? 0)} hint="rateado igual nas verticais" accent="#228BE6" />
        <MiniStat label="Pró-labore/retiradas" value={brl(cons?.pessoas ?? 0)} hint="pessoas" accent="#E64980" />
        <MiniStat label="Resultado do escritório" value={brl(cons?.resultado ?? 0)} hint="faturou − direto − comum − pessoas" accent={(cons?.resultado ?? 0) >= 0 ? '#2F9E44' : '#E03131'} />
      </div>

      <Card title="Cada vertical se paga?" sub={mesV ? 'Faturou × gastou (direto + fatia do comum) no mês escolhido. Clique num card pra ver o mês a mês.' : 'Receita − Despesa da área = Resultado (período todo). Escolha um mês pra ver faturou × gastou do mês.'}
        action={mesesV.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => { const i = mesesV.indexOf(mesV); if (i < mesesV.length - 1) setMesV(mesesV[i + 1]); }} disabled={!mesV || mesesV.indexOf(mesV) >= mesesV.length - 1} className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800" title="mês anterior"><ChevronLeft className="h-4 w-4" /></button>
            <select value={mesV} onChange={(e) => setMesV(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Período todo</option>
              {mesesV.map((k) => <option key={k} value={k}>{mmYYYY(k)}</option>)}
            </select>
            <button onClick={() => { const i = mesesV.indexOf(mesV); if (mesV && i > 0) setMesV(mesesV[i - 1]); }} disabled={!mesV || mesesV.indexOf(mesV) <= 0} className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800" title="próximo mês"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {verticais.map((v) => { const rc = recorte(v); return (
            <div key={v.area} className="cursor-pointer rounded-xl border p-4 transition hover:shadow-sm" style={{ borderColor: `${corArea(v.area)}55` }} onClick={() => setExp(exp === v.area ? '' : v.area)}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-100"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corArea(v.area) }} />{v.area}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${rc.entradas <= 0 && rc.saidas <= 0 ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : rc.resultado >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{rc.entradas <= 0 && rc.saidas <= 0 ? 'sem movimento' : rc.resultado >= 0 ? '✅ se paga' : '⚠️ subsidiada'}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">{mesV ? 'Faturou' : 'Receita'}</p><p className="text-sm font-bold tabular-nums text-emerald-600">{brl(rc.entradas)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">{mesV ? 'Gastou' : 'Despesa'}</p><p className="text-sm font-bold tabular-nums text-rose-600">{brl(rc.saidas)}</p>{(rc.comum ?? 0) > 0 && <p className="text-[9px] text-zinc-400">direto {brl(rc.diretas)} + comum {brl(rc.comum ?? 0)}</p>}</div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Resultado</p><p className={`text-sm font-bold tabular-nums ${rc.resultado >= 0 ? 'text-zinc-800 dark:text-zinc-100' : 'text-rose-600'}`}>{brl(rc.resultado)}</p></div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">{mesV ? mmYYYY(mesV) : `${v.nCasos} caso(s)`}{rc.margem != null ? ` · margem ${Math.round(rc.margem)}%` : ''} · <span className="text-[#228BE6]">{exp === v.area ? 'ocultar' : 'ver mês a mês'}</span></p>
              {exp === v.area && (() => {
                // Só meses com movimento real (evita listar meses só-comum eternamente e crescer sem fim).
                const linhas = (v.porMes ?? []).filter((m) => (m.entradas ?? 0) !== 0 || (m.diretas ?? 0) !== 0 || (m.comum ?? 0) !== 0);
                return (
                <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
                  {linhas.length > 0 ? (<>
                    <div className="flex items-center gap-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-400"><span className="w-9 shrink-0">Mês</span><span className="flex flex-1 items-center justify-end gap-1"><span className="w-[58px] text-right">Faturou</span><span className="w-[58px] text-right">Gastou</span><span className="w-[58px] text-right">Result.</span></span></div>
                    <div className="max-h-56 space-y-0.5 overflow-y-auto scrollbar-thin">
                      {linhas.map((m) => { const gasto = Math.round(((m.diretas ?? 0) + (m.comum ?? 0)) * 100) / 100; return (
                        <div key={m.mes} className={`flex items-center gap-1 text-[10px] ${mesV === m.mes ? 'rounded bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                          <span className="w-9 shrink-0 tabular-nums text-zinc-500">{mmYYYY(m.mes)}</span>
                          <span className="flex flex-1 items-center justify-end gap-1 whitespace-nowrap tabular-nums"><span className="w-[58px] text-right text-emerald-600">{brlN(m.entradas)}</span><span className="w-[58px] text-right text-rose-500" title="direto + fatia do comum">−{brlN(gasto)}</span><span className={`w-[58px] text-right font-semibold ${m.resultado >= 0 ? 'text-zinc-700 dark:text-zinc-200' : 'text-rose-600'}`}>{brlN(m.resultado)}</span></span>
                        </div>
                      ); })}
                    </div>
                    {linhas.length > 6 && <p className="mt-1 text-[10px] text-zinc-400">{linhas.length} meses · role pra ver todos</p>}
                  </>) : <p className="text-[11px] text-zinc-400">Sem lançamentos com data ainda. Lance honorários e marque a vertical nas despesas.</p>}
                  <button onClick={(e) => { e.stopPropagation(); setSel(v.area); }} className="mt-1.5 text-[11px] font-medium text-[#228BE6] hover:underline">detalhe completo da vertical →</button>
                </div>
                );
              })()}
            </div>
          ); })}
          {verticais.length === 0 && <p className="col-span-full py-8 text-center text-sm text-zinc-400">Sem verticais ainda. Lance honorários (casam pelo cliente) e marque a vertical nas despesas.</p>}
        </div>
      </Card>

      {mesesFora.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Banknote className="h-4 w-4 text-[#228BE6]" /> Fora das verticais (escritório)</span>}
          sub="de onde vêm os custos comuns (aluguel, contador, impostos, Claude…) — são rateados por igual dentro das verticais acima. Pró-labore fica fora do P&L.">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Mês</th><th className="px-2 py-1.5 text-right font-medium">Comum (escritório)</th><th className="px-2 py-1.5 text-right font-medium">Pró-labore/retiradas</th><th className="px-2 py-1.5 text-right font-medium">Total fora</th></tr></thead>
              <tbody>
                {mesesFora.map((m) => (
                  <tr key={m.mes} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{m.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-sky-600">{m.comum ? brl2(m.comum) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-pink-600">{m.pessoas ? brl2(m.pessoas) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl2(m.comum + m.pessoas)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-zinc-200 text-[13px] font-bold dark:border-zinc-700"><td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">Total</td><td className="px-2 py-1.5 text-right tabular-nums text-sky-600">{brl2(comum?.total ?? 0)}</td><td className="px-2 py-1.5 text-right tabular-nums text-pink-600">{brl2(pessoas?.total ?? 0)}</td><td className="px-2 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-100">{brl2((comum?.total ?? 0) + (pessoas?.total ?? 0))}</td></tr></tfoot>
            </table>
          </div>
        </Card>
      )}

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

      <RemunVerticalEditor data={data} />
    </>
  );
}

/** Participação por vertical (Fase B): quanto % do RESULTADO de cada vertical cada pessoa recebe. */
function RemunVerticalEditor({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list(), staleTime: 300_000 });
  const advs = useMemo(() => members.filter((m) => m.user.isActive).map((m) => ({ id: m.user.id, name: m.user.name })), [members]);
  const verticais = useMemo(() => [...new Set([...(data.verticalPnL?.verticais ?? []).map((v) => v.area), ...VERTICAIS_PADRAO])], [data.verticalPnL]);
  const { data: cfg } = useQuery({ queryKey: ['financeiro', 'remun-vertical'], queryFn: () => financeiroService.getRemunVertical(), staleTime: 300_000 });
  const [draft, setDraft] = useState<Record<string, { area: string; pct: number }[]>>({});
  useEffect(() => { if (cfg?.remunVertical) setDraft(cfg.remunVertical); }, [cfg]);
  const save = useMutation({ mutationFn: () => financeiroService.setRemunVertical(draft), onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro'] }); toast.success('Participações salvas'); }, onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro') });
  const rows = (uid: string) => draft[uid] ?? [];
  const setRow = (uid: string, i: number, patch: Partial<{ area: string; pct: number }>) => setDraft((d) => ({ ...d, [uid]: (d[uid] ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = (uid: string) => setDraft((d) => ({ ...d, [uid]: [...(d[uid] ?? []), { area: verticais[0] ?? '', pct: 40 }] }));
  const rmRow = (uid: string, i: number) => setDraft((d) => ({ ...d, [uid]: (d[uid] ?? []).filter((_, j) => j !== i) }));

  return (
    <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4 text-[#7048E8]" /> Participação por vertical (remuneração)</span>}
      sub="quanto % do RESULTADO (receita − custos) de cada vertical a pessoa recebe. É isso que alimenta o holerite dela.">
      <div className="space-y-3">
        {advs.map((a) => (
          <div key={a.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200"><UserCircle2 className="h-4 w-4 text-zinc-400" />{a.name}</span>
              <button onClick={() => addRow(a.id)} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> vertical</button>
            </div>
            {rows(a.id).length === 0 ? <p className="text-[11px] text-zinc-400">Sem participação configurada — cai no padrão (área principal × 30%).</p> : (
              <div className="space-y-1.5">
                {rows(a.id).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ComboBox className="min-w-0 flex-1" value={r.area} options={verticais} allowFree placeholder="vertical…" onChange={(val) => setRow(a.id, i, { area: val })} />
                    <div className="flex items-center gap-1"><input value={String(r.pct)} onChange={(e) => setRow(a.id, i, { pct: Math.max(0, Math.min(100, parseFloat(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0)) })} inputMode="decimal" className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /><span className="text-sm text-zinc-400">%</span></div>
                    <button onClick={() => rmRow(a.id, i)} className="rounded p-1 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar participações'}</button></div>
    </Card>
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
// Divide UMA linha de CSV respeitando aspas (RFC4180: "" = aspas escapada;
// vírgulas dentro de aspas não separam). Sem isso, "IOF de ""X""","18,22" quebra.
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const brNum = (s: string): number => { const t = String(s).replace(/[^\d,.-]/g, ''); if (!t || !/\d/.test(t)) return NaN; return /,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, '')); };
const toBRdate = (c: string): string => {
  const br = c.match(/(\d{2})[\/-](\d{2})[\/-](\d{2,4})/); const iso = c.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (br) return `${br[1]}/${br[2]}/${br[3].length === 2 ? '20' + br[3] : br[3]}`;
  return '';
};
// Fallback pra TEXTO CORRIDO (comum em PDF de extrato de CONTA bancária extraído sem
// tabela real: "20/07/2026 PIX RECEBIDO - JOÃO SILVA 1.250,00", 1 transação por linha).
// A lógica por coluna/separador falha aqui porque a vírgula DECIMAL do valor (1.250,00)
// é confundida com separador de coluna quando o parser cai no default `,`. Em vez de
// depender de colunas, acha a DATA em qualquer posição da linha e o PRIMEIRO valor em
// formato BR (R$ opcional, milhar com ponto, 2 casas decimais) logo depois dela —
// o que sobrar entre os dois é a descrição. Pega o PRIMEIRO valor (não o último) porque
// layouts com coluna de SALDO no fim ("... 1.250,00 5.430,12") têm o valor da transação
// antes do saldo corrente.
function parseLinhaLivre(linha: string): { data: string; valor: number; descricao: string } | null {
  const mData = linha.match(/(\d{2})[\/-](\d{2})[\/-](\d{2,4})/);
  if (!mData || mData.index == null) return null;
  const dataBR = toBRdate(mData[0]);
  if (!dataBR) return null;
  const depoisData = linha.slice(mData.index + mData[0].length);
  const mValor = depoisData.match(/-?\(?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?/);
  if (!mValor || mValor.index == null) return null;
  let valor = brNum(mValor[0]);
  if (!Number.isFinite(valor) || valor === 0) return null;
  if (/\(/.test(mValor[0])) valor = -Math.abs(valor); // "(1.234,56)" = negativo contábil
  const descricao = depoisData.slice(0, mValor.index).replace(/^[\s\-–|:]+/, '').replace(/[\s\-–|:]+$/, '').trim();
  return { data: dataBR, valor, descricao: descricao.slice(0, 140) };
}
// Parser de extrato CSV/TSV/; — entende cabeçalho (date/title/amount, Data/Histórico/Valor)
// e a convenção da FATURA DE CARTÃO Nubank (amount positivo = compra = DESPESA).
function parseExtrato(text: string): { data: string; valor: number; descricao: string }[] {
  const linhas = text.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = linhas[0].includes(';') ? ';' : linhas[0].includes('\t') ? '\t' : ',';
  const header = splitCsvLine(linhas[0], sep).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /date|data|title|descr|amount|valor|value|hist/.test(h));
  const idxOf = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = hasHeader ? idxOf('date', 'data') : -1;
  const iAmt = hasHeader ? idxOf('amount', 'valor', 'value') : -1;
  const iDesc = hasHeader ? idxOf('title', 'descr', 'hist', 'estabelec', 'lanc', 'lanç') : -1;
  // Fatura de cartão Nubank: header exatamente date,title,amount → compra (amount +) é despesa
  const cartaoNubank = hasHeader && ['date', 'title', 'amount'].every((h, i) => (header[i] || '') === h);
  const out: { data: string; valor: number; descricao: string }[] = [];
  for (let r = hasHeader ? 1 : 0; r < linhas.length; r++) {
    const cols = splitCsvLine(linhas[r], sep);
    let dataBR = '', valor = NaN, desc = '';
    if (hasHeader && iDate >= 0 && iAmt >= 0) {
      dataBR = toBRdate(cols[iDate] || '');
      let v = brNum(cols[iAmt] || '');
      if (cartaoNubank && Number.isFinite(v)) v = -v; // cartão: o valor da fatura é saída de caixa
      valor = v;
      desc = (iDesc >= 0 ? cols[iDesc] : cols.filter((_, i) => i !== iDate && i !== iAmt).join(' ')) || '';
    } else {
      const rest: string[] = [];
      for (const c of cols) {
        const d = toBRdate(c);
        if (!dataBR && d && /^\d/.test(c)) { dataBR = d; continue; }
        const n = brNum(c);
        if (Number.isFinite(n) && /[,.]/.test(c)) { valor = n; continue; } // última col com decimal = valor
        if (c && !/^\d+$/.test(c)) rest.push(c);
      }
      desc = rest.join(' ');
    }
    // Coluna/separador não achou nada útil (típico de PDF de extrato de conta em texto
    // corrido) — tenta direto na linha crua, sem depender de separador.
    if (!dataBR || !Number.isFinite(valor) || valor === 0) {
      const livre = parseLinhaLivre(linhas[r]);
      if (livre) { dataBR = livre.data; valor = livre.valor; desc = livre.descricao; }
    }
    if (dataBR && Number.isFinite(valor) && valor !== 0) out.push({ data: dataBR, valor, descricao: desc.slice(0, 140) });
  }
  return out;
}

// ── Integração ASAAS: reconcilia pagamentos (a receber/recebido) + taxas/cartão ──
function AsaasImport() {
  const qc = useQueryClient();
  const [prev, setPrev] = useState<import('@/features/financeiro/services/financeiro.service').AsaasPreview | null>(null);
  const { data: status } = useQuery({ queryKey: ['asaas', 'status'], queryFn: () => financeiroService.asaasStatus(), staleTime: 600_000 });

  const previewM = useMutation({
    mutationFn: () => financeiroService.asaasPreview(),
    onSuccess: (r) => { setPrev(r); if (!r.configurado) toast.error('ASAAS não configurado no servidor.'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao consultar o ASAAS'),
  });
  const importM = useMutation({
    mutationFn: () => financeiroService.asaasImportar(),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); setPrev(r); toast.success(`ASAAS sincronizado: ${r.novos ?? 0} novos · ${r.atualizados ?? 0} atualizados`); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao sincronizar com o ASAAS'),
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
    <Card title="ASAAS → caixa (recebimentos e a receber)" sub="sincroniza sozinho de hora em hora: cada cobrança vira um lançamento (a receber se pendente, recebido se paga); taxas e compras viram despesa. Sem duplicar.">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => importM.mutate()} disabled={importM.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{importM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />} Sincronizar agora</button>
        <button onClick={() => previewM.mutate()} disabled={previewM.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-[#0052FF] hover:text-[#0052FF] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{previewM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pré-visualizar</button>
        {typeof prev?.saldo === 'number' && <span className="ml-auto text-xs text-zinc-400">Saldo ASAAS: <strong className="text-zinc-600 dark:text-zinc-300">{brl2(prev.saldo)}</strong></span>}
      </div>

      {prev?.configurado && (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <MiniStat label="A receber (pendentes)" value={brl(prev.aReceber ?? 0)} hint="cobranças em aberto" accent="#F59F00" />
          <MiniStat label="Recebido" value={brl(prev.recebido ?? 0)} hint="pagamentos quitados" accent="#2F9E44" />
          <MiniStat label="Despesas (taxas/cartão)" value={brl(prev.despesas ?? 0)} hint="últimos 120 dias" accent="#E03131" />
          <MiniStat label="Lançamentos" value={`${prev.novos ?? 0} novo(s)`} hint={`${prev.atualizados ?? 0} atualizado(s)${(prev.removidos ?? 0) ? ` · ${prev.removidos} removido(s)` : ''}`} accent="#0052FF" />
        </div>
      )}
    </Card>
  );
}

function ContasTab({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const contas = data.contas ?? [];
  const [conc, setConc] = useState<{ conta: string; texto: string } | null>(null);
  const [concResult, setConcResult] = useState<{ conciliados: number; semPar: { data: string; valor: number; descricao: string; dup: boolean }[] } | null>(null);
  const [concSel, setConcSel] = useState<Set<number>>(new Set());
  const [concLinhas, setConcLinhas] = useState<ExtratoLinha[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [upLoading, setUpLoading] = useState(false);
  const [upNome, setUpNome] = useState('');
  const [retro, setRetro] = useState<{ done: number; total: number; pulados: number } | null>(null);
  const [retroMsg, setRetroMsg] = useState<string>('');
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
  const [form, setForm] = useState<{ id?: string; nome: string; banco: string; saldoInicial: string; cartao?: boolean; fechamento?: string; vencimento?: string } | null>(null);
  const inval = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
  const addM = useMutation({ mutationFn: (i: { nome: string; banco: string; saldoInicial: number; cartao?: boolean; fechamento?: number; vencimento?: number }) => financeiroService.addConta(i), onSuccess: () => { inval(); toast.success('Conta adicionada'); setForm(null); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const updM = useMutation({ mutationFn: ({ id, i }: { id: string; i: any }) => financeiroService.updateConta(id, i), onSuccess: () => { inval(); toast.success('Conta atualizada'); setForm(null); }, onError: (e: any) => toast.error(e?.message || 'Erro') });
  const delM = useMutation({ mutationFn: (id: string) => financeiroService.removeConta(id), onSuccess: () => { inval(); toast.success('Conta removida'); }, onError: (e: any) => toast.error(e?.message || 'Erro') });

  // Aporte/empréstimo dos sócios NÃO é dinheiro que está na conta — é passivo (aparece na "posição real").
  // Excluir do saldo da conta (senão infla o Nubank; ex.: 8.151 reais + 9.435 empréstimo = 17.586 fantasma).
  const ehAporte = (t: FinTransacao) => /aporte|empr[eé]stimo dos s[óo]cios/i.test(`${t.categoria} ${t.pagador ?? ''}`);
  const saldoConta = (id: string) => {
    const ini = contas.find((c) => c.id === id)?.saldoInicial ?? 0;
    let mov = 0, aReceber = 0, aPagar = 0, n = 0;
    for (const t of data.transacoes) {
      if (t.conta !== id || ehAporte(t)) continue; n++;
      const st = txStatus(t);
      if (t.valor >= 0) { if (st === 'recebido') mov += t.valor; else aReceber += t.valor; }
      else { if (st === 'pago') mov += t.valor; else aPagar += -t.valor; }
    }
    // saldo REAL da API (ASAAS) vence o somatório do ledger (que ignora transferências de saída)
    const real = data.saldosReais?.[id];
    return { saldo: real != null ? real : ini + mov, aReceber, aPagar, n, real: real != null };
  };
  const semConta = data.transacoes.filter((t) => !t.conta).length;
  // Cartões não entram na lista de contas nem no "saldo somado" — vivem na aba Cartão de crédito.
  const contasVis = contas.filter((c) => !c.cartao);
  const total = contasVis.reduce((s, c) => s + saldoConta(c.id).saldo, 0);

  // ── Lançar gastos retroativos do Astrea (idempotente: pula o que já existe) ──
  const norm = (s?: string | null) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const centsOf = (v: number) => Math.round(Math.abs(v) * 100);
  const ymOf = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}`; // DD/MM/YYYY → YYYY-MM
  const lancarRetro = async () => {
    const existentes = data.transacoes.filter((t) => t.valor < 0).map((t) => ({ c: centsOf(t.valor), ym: ymOf(t.data), p: norm(t.recebedor || t.party || t.pagador) }));
    const jaTem = (o: { data: string; valor: number; party: string }) => {
      const c = centsOf(o.valor), ym = ymOf(o.data), p = norm(o.party);
      return existentes.some((e) => e.c === c && e.ym === ym && (e.p === p || (!!e.p && !!p && (e.p.includes(p) || p.includes(e.p)))));
    };
    const todo = ASTREA_DESPESAS.filter((o) => !jaTem(o));
    const pulados = ASTREA_DESPESAS.length - todo.length;
    setRetroMsg('');
    if (!todo.length) { setRetroMsg(`✅ Tudo já lançado — as ${ASTREA_DESPESAS.length} saídas do Astrea já constam.`); toast.success('Tudo já lançado.'); return; }
    if (!confirm(`Lançar ${todo.length} gasto(s) retroativo(s) do Astrea?${pulados ? ` (${pulados} já existem e serão pulados)` : ''}\n\nTotal: ${brl(todo.reduce((s, o) => s + o.valor, 0))}. Pode rodar de novo sem duplicar.`)) return;
    setRetro({ done: 0, total: todo.length, pulados });
    let ok = 0, fail = 0, firstErr = '';
    for (const o of todo) {
      try { await financeiroService.addTransacao({ data: o.data, tipo: 'despesa', categoria: o.categoria, valor: o.valor, recebedor: o.party, dataPagamento: o.data, status: 'pago' }); ok++; }
      catch (e: any) { fail++; if (!firstErr) firstErr = e?.response?.data?.message || e?.message || 'erro desconhecido'; }
      setRetro({ done: ok + fail, total: todo.length, pulados });
    }
    qc.invalidateQueries({ queryKey: ['financeiro'] });
    setRetro(null);
    if (fail) { setRetroMsg(`⚠️ ${ok} lançado(s), ${fail} falharam. Erro: ${firstErr}`); toast.error(`${fail} falharam: ${firstErr}`); }
    else { setRetroMsg(`✅ ${ok} gasto(s) lançado(s)${pulados ? ` · ${pulados} já existiam` : ''}. Recarregue pra ver os KPIs.`); toast.success(`${ok} gasto(s) lançado(s)`); }
  };

  // ── Fechar o caixa com aportes (Você + Pai) — idempotente ──
  const [aporteRun, setAporteRun] = useState(false);
  const [aporteArmed, setAporteArmed] = useState(false); // confirmação em 2 cliques do "Desfazer"
  const nAportes = data.transacoes.filter((t) => t.valor > 0 && /aporte/i.test(t.categoria || '')).length;
  // sugestão do empréstimo que RECONCILIA: caixa − operacional = o que os CPFs puseram pra sustentar o caixa.
  // Registrando esse valor, a "posição real" (caixa − empréstimo) volta a ser o resultado operacional.
  const sugEmp = Math.max(0, (data.kpis?.caixaContas ?? 0) - (data.kpis?.saldoOperacional ?? 0));
  const [empValor, setEmpValor] = useState(() => (sugEmp > 0 ? fmtMoney(sugEmp) : ''));
  const registrarEmprestimo = async () => {
    const v = parseValor(empValor);
    if (!(v > 0)) { toast.error('Informe o valor do empréstimo.'); return; }
    setAporteRun(true);
    try {
      await financeiroService.addTransacao({ data: hojeBR(), tipo: 'receita', categoria: 'Aporte', valor: v, pagador: 'Empréstimo dos sócios (CPF)', dataPagamento: hojeBR(), status: 'recebido' });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      setRetroMsg(`✅ Empréstimo de ${brl(v)} registrado. Posição real = caixa − empréstimo. Recarregue pra ver.`);
      toast.success('Empréstimo registrado');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro'); }
    setAporteRun(false);
  };
  const lancarAportes = async () => {
    const existentes = data.transacoes.filter((t) => t.valor > 0 && /aporte/i.test(t.categoria || ''));
    const jaTem = (a: { data: string; valor: number }) => existentes.some((e) => centsOf(e.valor) === centsOf(a.valor) && ymOf(e.data) === ymOf(a.data));
    const todo = APORTES.filter((a) => !jaTem(a));
    if (!todo.length) { toast.success('Aportes já lançados — caixa já fechado.'); return; }
    const totalAporte = todo.reduce((s, a) => s + a.valor, 0);
    if (!confirm(`Registrar ${brl(totalAporte)} em aportes (Você + Pai) para fechar o caixa?\n\nDistribuído nos meses de aperto (ago–dez/2025, jan e jun/2026). Marcado como "Aporte" — não conta como faturamento. Pode editar depois pra separar quanto foi do seu pai.`)) return;
    setAporteRun(true);
    let ok = 0, fail = 0, firstErr = '';
    for (const a of todo) {
      try { await financeiroService.addTransacao({ data: a.data, tipo: 'receita', categoria: 'Aporte', valor: a.valor, pagador: 'Aporte (Você + Pai)', dataPagamento: a.data, status: 'recebido' }); ok++; }
      catch (e: any) { fail++; if (!firstErr) firstErr = e?.response?.data?.message || e?.message || 'erro desconhecido'; }
    }
    qc.invalidateQueries({ queryKey: ['financeiro'] });
    setAporteRun(false);
    if (fail) { setRetroMsg(`⚠️ Aportes: ${ok} ok, ${fail} falharam. Erro: ${firstErr}`); toast.error(`${fail} falharam: ${firstErr}`); }
    else { setRetroMsg(`✅ ${ok} aporte(s) lançado(s) · caixa fechado. Recarregue pra ver.`); toast.success(`${ok} aporte(s) lançado(s)`); }
  };
  // Desfazer: remove os lançamentos de aporte/empréstimo (a posição real volta a ser o caixa).
  const removerAportes = async () => {
    const aportes = data.transacoes.filter((t) => t.valor > 0 && /aporte/i.test(t.categoria || '') && t.id);
    if (!aportes.length) { toast.success('Não há empréstimo registrado.'); setAporteArmed(false); return; }
    if (!aporteArmed) { setAporteArmed(true); return; } // 1º clique: arma; 2º clique: executa
    setAporteArmed(false);
    setAporteRun(true);
    let ok = 0, fail = 0, firstErr = '';
    for (const t of aportes) {
      try { await financeiroService.removeTransacao(t.id!, 'uma'); ok++; }
      catch (e: any) { fail++; if (!firstErr) firstErr = e?.response?.data?.message || e?.message || 'erro'; }
    }
    qc.invalidateQueries({ queryKey: ['financeiro'] });
    setAporteRun(false);
    if (fail) { setRetroMsg(`⚠️ Remoção: ${ok} ok, ${fail} falharam. Erro: ${firstErr}`); toast.error(`${fail} falharam: ${firstErr}`); }
    else { setRetroMsg(`✅ ${ok} aporte(s) removido(s) · posição real = caixa. Recarregue pra ver.`); toast.success(`${ok} removido(s)`); }
  };

  // ── Separar Nubank em conta bancária + cartão (os gastos de fatura vão pro cartão) ──
  const [sepRun, setSepRun] = useState(false);
  const [showTools, setShowTools] = useState(false);
  // só oferece separar se há um Nubank marcado como cartão QUE NÃO seja o "Nubank cartão" já separado
  const nubankCartao = contas.find((c) => c.cartao && /nubank/i.test(c.nome) && !/cart[aã]o/i.test(c.nome));
  const separarNubank = async () => {
    const nb = nubankCartao;
    if (!nb) { toast.error('Não achei um "Nubank" marcado como cartão.'); return; }
    const faturaTx = data.transacoes.filter((t) => t.conta === nb.id && t.valor < 0 && (!!t.fonteImport || txStatus(t) === 'a_pagar'));
    if (!confirm(`Separar "${nb.nome}" em conta + cartão?\n\n• Crio "Nubank cartão" e movo ${faturaTx.length} gasto(s) de fatura pra lá.\n• "${nb.nome}" vira conta bancária (deixa de ser cartão).\n\nRecebimentos, retiradas e pagamentos de fatura CONTINUAM na conta. Depois é só informar o saldo real da conta.`)) return;
    setSepRun(true);
    try {
      const novo = await financeiroService.addConta({ nome: 'Nubank cartão', banco: nb.banco, cor: nb.cor, cartao: true, fechamento: nb.fechamento, vencimento: nb.vencimento, saldoInicial: 0 });
      const cartaoId = novo?.id;
      if (!cartaoId) throw new Error('não recebi o id da nova conta-cartão');
      let movidos = 0;
      for (const t of faturaTx) { if (t.id) { await financeiroService.updateTransacao(t.id, { conta: cartaoId }); movidos++; } }
      await financeiroService.updateConta(nb.id, { nome: nb.nome, banco: nb.banco, cor: nb.cor, saldoInicial: nb.saldoInicial ?? 0, cartao: false });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      setRetroMsg(`✅ Nubank separado: ${movidos} gasto(s) de fatura foram pra "Nubank cartão". Agora edite o "Nubank" (lápis no card) e informe o saldo real da conta bancária.`);
      toast.success('Nubank separado em conta + cartão.');
    } catch (e: any) { const m = e?.response?.data?.message || e?.message || 'erro'; setRetroMsg(`⚠️ Falha ao separar Nubank: ${m}`); toast.error(m); }
    setSepRun(false);
  };

  // ── Desfazer: extrato de cartão que caiu no caixa (liquidado) por engano ──
  const [limpaRun, setLimpaRun] = useState(false);
  const gastosCartaoNoCaixa = data.transacoes.filter((t) => t.fonteImport === 'extrato' && (txStatus(t) === 'pago' || txStatus(t) === 'recebido'));
  const limparCartaoCaixa = async () => {
    const alvo = gastosCartaoNoCaixa;
    if (!alvo.length) { toast.success('Nada de extrato importado no caixa.'); return; }
    const soma = alvo.reduce((s, t) => s + Math.abs(t.valor), 0);
    if (!confirm(`Remover ${alvo.length} lançamento(s) que vieram de extrato importado e caíram no caixa (soma ${brl(soma)})?\n\n⚠️ Confira o total: deve ser o extrato do CARTÃO (valores pequenos + o pagamento). Se aparecer um honorário grande, cancele.\n\nDepois reimporte o extrato na conta "Nubank cartão" → vira fatura (a pagar), não caixa.`)) return;
    setLimpaRun(true);
    let ok = 0, fail = 0;
    for (const t of alvo) { if (t.id) { try { await financeiroService.removeTransacao(t.id, 'uma'); ok++; } catch { fail++; } } }
    qc.invalidateQueries({ queryKey: ['financeiro'] });
    setRetroMsg(fail ? `⚠️ Removidos ${ok}, ${fail} falharam.` : `✅ ${ok} lançamento(s) de extrato removidos do caixa. Agora reimporte o extrato na conta "Nubank cartão" (Importar extrato → conta Nubank cartão).`);
    toast.success(`${ok} removido(s)`);
    setLimpaRun(false);
  };

  const salvar = () => {
    if (!form || !form.nome.trim()) { toast.error('Informe o nome da conta'); return; }
    const i = { nome: form.nome.trim(), banco: form.banco, saldoInicial: parseValor(form.saldoInicial), cartao: !!form.cartao, fechamento: form.cartao && form.fechamento ? Number(form.fechamento) : undefined, vencimento: form.cartao && form.vencimento ? Number(form.vencimento) : undefined };
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
    // match EXATO (valor+sinal, data ±5d) em QUALQUER conta → já existe, concilia.
    let conciliados = 0; const semPar: { data: string; valor: number; descricao: string; dup: boolean }[] = [];
    for (const l of linhas) {
      const alvo = isoNum(l.data);
      const match = data.transacoes.find((t) => {
        if (t.id && usadas.has(t.id)) return false;
        if (Math.sign(t.valor) !== Math.sign(l.valor)) return false;
        if (Math.abs(Math.abs(t.valor) - Math.abs(l.valor)) > 0.01) return false;
        return Math.abs(isoNum(t.data) - alvo) <= 5 || Math.abs((t.vencimento ? isoNum(t.vencimento) : 0) - alvo) <= 5;
      });
      if (match) { conciliados++; if (match.id) usadas.add(match.id); continue; }
      // sem par exato — mas se há lançamento de MESMO valor+sinal (qualquer data/conta),
      // marca como POSSÍVEL DUPLICADO e deixa DESmarcado por padrão (o usuário decide).
      const dup = data.transacoes.some((t) => !(t.id && usadas.has(t.id)) && Math.sign(t.valor) === Math.sign(l.valor) && Math.abs(Math.abs(t.valor) - Math.abs(l.valor)) <= 0.01);
      semPar.push({ data: l.data, valor: l.valor, descricao: l.descricao, dup });
    }
    setConcResult({ conciliados, semPar });
    setConcSel(new Set(semPar.map((l, i) => (l.dup ? -1 : i)).filter((i) => i >= 0))); // só os não-suspeitos vêm marcados
  };
  const criarComIA = async () => {
    if (!conc || !concResult) return;
    const escolhidos = concResult.semPar.filter((_, i) => concSel.has(i));
    if (!escolhidos.length) { toast.error('Selecione ao menos um lançamento para criar.'); return; }
    const ehCartao = !!contas.find((c) => c.id === conc.conta)?.cartao; // cartão → gasto vira fatura (a_pagar), fora do caixa
    setIaLoading(true);
    try {
      const ehPagamentoFatura = (d: string) => /pagamento\s*(de\s*)?(fatura|recebid|efetuad)/i.test(d || '');
      const sug = await financeiroService.classificarExtrato(escolhidos.map((l) => ({ descricao: l.descricao, valor: l.valor })));
      for (let i = 0; i < escolhidos.length; i++) {
        const l = escolhidos[i]; const s = sug.find((x) => x.i === i);
        if (ehCartao && ehPagamentoFatura(l.descricao)) continue; // no cartão, o pagamento de fatura não vira lançamento (baixa ao Pagar fatura)
        // No cartão TODO lançamento é gasto (a_pagar), independe do sinal; na conta vale o sinal/classificador.
        const tipo: 'receita' | 'despesa' = ehCartao ? 'despesa' : ((s?.tipo as 'receita' | 'despesa') ?? (l.valor >= 0 ? 'receita' : 'despesa'));
        await financeiroService.addTransacao({ data: l.data, tipo, categoria: s?.categoria ?? (ehCartao ? 'Cartão' : (l.valor >= 0 ? 'Honorários' : 'Outros')), valor: Math.abs(l.valor), pagador: s?.party || l.descricao.slice(0, 60), conta: conc.conta, status: ehCartao ? 'a_pagar' : (tipo === 'receita' ? 'recebido' : 'pago') });
      }
      qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
      toast.success(`${escolhidos.length} lançamento(s) criado(s) e conciliado(s)`);
      setConc(null); setConcResult(null); setConcSel(new Set());
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

      {/* Ferramentas de configuração inicial — recolhível (ações de uma vez só) */}
      <div className="mt-4 rounded-2xl border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button onClick={() => setShowTools((v) => !v)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
          <span className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-200"><Scissors className="h-4 w-4 text-zinc-400" /> Ferramentas de configuração <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">uma vez só</span></span>
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${showTools ? 'rotate-180' : ''}`} />
        </button>
        {showTools && (<div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><ArrowDownCircle className="h-4 w-4 text-[#820AD1]" /> Gastos retroativos (Astrea)</h3>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">Lança de uma vez as <strong>{ASTREA_DESPESAS.length} saídas</strong> do Astrea (mai/2025 → jun/2026, {brl(ASTREA_DESPESAS.reduce((s, o) => s + o.valor, 0))}), com categoria e data corretas. <strong>Pula o que já existe</strong> — pode rodar quantas vezes quiser sem duplicar.</p>
          </div>
          <button onClick={lancarRetro} disabled={!!retro} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#820AD1] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {retro ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Lançando {retro.done}/{retro.total}…</> : <><ArrowDownCircle className="h-3.5 w-3.5" /> Lançar gastos retroativos</>}
          </button>
        </div>
        {retro && <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[#820AD1] transition-all" style={{ width: `${Math.round((retro.done / Math.max(1, retro.total)) * 100)}%` }} /></div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100"><Scale className="h-4 w-4 text-amber-600" /> Empréstimo dos sócios (CPF)</h4>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-600 dark:text-zinc-300">O que entrou dos CPFs (você + seu pai) pra tapar o buraco = <strong>dívida a devolver</strong>, não faturamento. Registrando, a <strong>posição real = caixa − empréstimo</strong> volta a mostrar o vermelho real. O valor sugerido (<strong>{brl(sugEmp)}</strong>) é o que <strong>reconcilia</strong> o caixa com o operacional — <strong>edite</strong> pra bater com o que vocês de fato colocaram (confere no extrato do CPF). A dívida cai quando o escritório pagar os sócios de volta.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-28"><MoneyInput value={empValor} onChange={setEmpValor} /></div>
              <button onClick={registrarEmprestimo} disabled={aporteRun} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {aporteRun ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Scale className="h-3.5 w-3.5" /> Registrar</>}
              </button>
            </div>
            {nAportes > 0 && <button onClick={removerAportes} onBlur={() => setAporteArmed(false)} disabled={aporteRun} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium disabled:opacity-60 ${aporteArmed ? 'border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'border-zinc-300 text-zinc-500 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400'}`}>
              <Trash2 className="h-3 w-3" /> {aporteArmed ? `Confirmar: remover ${nAportes}` : 'Desfazer'}
            </button>}
          </div>
        </div>
        {nubankCartao && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100"><CreditCard className="h-4 w-4 text-[#820AD1]" /> Separar Nubank em conta + cartão</h4>
              <p className="mt-1 max-w-2xl text-[13px] text-zinc-600 dark:text-zinc-300">O "{nubankCartao.nome}" está como <strong>cartão</strong>, mas você tem <strong>conta E cartão</strong>. Isso cria uma conta <strong>"Nubank cartão"</strong> só pra fatura, move os gastos de cartão pra lá, e deixa o <strong>"{nubankCartao.nome}" como conta bancária</strong> (com os recebimentos, retiradas e pagamentos de fatura). Depois você informa o saldo real da conta.</p>
            </div>
            <button onClick={separarNubank} disabled={sepRun} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#820AD1] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {sepRun ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Separando…</> : <><CreditCard className="h-3.5 w-3.5" /> Separar conta e cartão</>}
            </button>
          </div>
        )}
        {gastosCartaoNoCaixa.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100"><Trash2 className="h-4 w-4 text-rose-500" /> Desfazer extrato de cartão no caixa</h4>
              <p className="mt-1 max-w-2xl text-[13px] text-zinc-600 dark:text-zinc-300">Há <strong>{gastosCartaoNoCaixa.length} lançamento(s)</strong> de extrato importado que caíram no <strong>caixa como liquidados</strong> (soma {brl(gastosCartaoNoCaixa.reduce((s, t) => s + Math.abs(t.valor), 0))}). Isso remove eles. Depois <strong>reimporte na conta "Nubank cartão"</strong> — aí viram <strong>fatura (a pagar)</strong> e só entram no caixa quando você clicar em <strong>Pagar fatura</strong>.</p>
            </div>
            <button onClick={limparCartaoCaixa} disabled={limpaRun} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {limpaRun ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removendo…</> : <><Trash2 className="h-3.5 w-3.5" /> Remover do caixa</>}
            </button>
          </div>
        )}
        {retroMsg && <p className={`mt-3 rounded-lg border px-3 py-2 text-[13px] ${retroMsg.startsWith('⚠️') ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>{retroMsg}</p>}
        </div>)}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniStat label="Saldo somado das contas" value={brl(total)} hint={`${contasVis.length} conta(s)`} accent={total >= 0 ? '#2F9E44' : '#E03131'} />
        <MiniStat label="Lançamentos sem conta" value={String(semConta)} hint="marque a conta neles para conciliar" accent="#F59F00" />
        <div className="rounded-2xl border border-dashed border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={() => setForm({ nome: '', banco: 'nubank', saldoInicial: '', cartao: false, fechamento: '', vencimento: '' })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Nova conta</button>
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
              {contas.find((c) => c.id === conc.conta)?.cartao && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">⚠️ Esta conta é um <strong>cartão</strong>. Aqui deve entrar só o <strong>extrato do cartão</strong> (os gastos viram fatura). O extrato da <strong>conta bancária</strong> deve ir numa conta normal.</p>
              )}
              <button onClick={analisar} disabled={iaLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{iaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Analisar e casar</button>

              {concResult && (
                <div className="rounded-xl border border-zinc-200/70 p-3 dark:border-zinc-800">
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600">✓ {concResult.conciliados} já conciliado(s)</span>
                    <span className="text-amber-600">⚠ {concResult.semPar.length} sem par</span>
                  </div>
                  {concResult.semPar.length > 0 && (
                    <>
                      <p className="mt-2 text-[11px] text-zinc-400">Marque o que quer <strong>criar</strong>. Linhas em <span className="text-amber-600">âmbar</span> têm um lançamento de mesmo valor já existente (possível duplicado) — vêm desmarcadas.</p>
                      <div className="mt-1.5 max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin">
                        {concResult.semPar.map((l, i) => (
                          <label key={i} className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${l.dup ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                            <input type="checkbox" checked={concSel.has(i)} onChange={(e) => setConcSel((prev) => { const n = new Set(prev); if (e.target.checked) n.add(i); else n.delete(i); return n; })} className="h-3.5 w-3.5 shrink-0 accent-[#7048E8]" />
                            <span className="w-12 shrink-0 text-zinc-400">{l.data.slice(0, 5)}</span>
                            <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{l.descricao || '—'}{l.dup && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">já existe?</span>}</span>
                            <span className={`shrink-0 tabular-nums ${l.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(l.valor)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px]">
                        <button onClick={() => setConcSel(new Set(concResult.semPar.map((_, i) => i)))} className="font-medium text-[#228BE6] hover:underline">marcar todos</button>
                        <button onClick={() => setConcSel(new Set())} className="font-medium text-zinc-500 hover:underline">desmarcar todos</button>
                        <span className="ml-auto text-zinc-400">{concSel.size} selecionado(s)</span>
                      </div>
                      <button onClick={criarComIA} disabled={iaLoading || concSel.size === 0} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{iaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Criar {concSel.size} selecionado(s)</button>
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
        {contasVis.map((c) => {
          const s = saldoConta(c.id);
          return (
            <div key={c.id} className="group rounded-2xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100"><span className="h-3 w-3 rounded-full" style={{ background: c.cor ?? '#868E96' }} />{c.nome}</span>
                <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setForm({ id: c.id, nome: c.nome, banco: c.banco, saldoInicial: String(c.saldoInicial ?? 0).replace('.', ','), cartao: !!c.cartao, fechamento: c.fechamento ? String(c.fechamento) : '', vencimento: c.vencimento ? String(c.vencimento) : '' })} className="rounded p-1 text-zinc-300 hover:text-[#228BE6]"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm(`Remover a conta "${c.nome}"?`)) delM.mutate(c.id); }} className="rounded p-1 text-zinc-300 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
              <p className={`mt-2 text-2xl font-bold tabular-nums ${s.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(s.saldo)}</p>
              <p className="text-[11px] text-zinc-400">{s.real ? 'saldo real (API) · ' : ''}{c.cartao ? 'cartão · ' : ''}{s.n} lançamento(s) nesta conta</p>
              {s.saldo < 0 && !s.real && !c.cartao && (c.saldoInicial ?? 0) === 0 && (
                <button onClick={() => setForm({ id: c.id, nome: c.nome, banco: c.banco, saldoInicial: String(c.saldoInicial ?? 0).replace('.', ','), cartao: !!c.cartao, fechamento: c.fechamento ? String(c.fechamento) : '', vencimento: c.vencimento ? String(c.vencimento) : '' })} className="mt-2 block w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-left text-[11px] text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">⚠️ Saldo negativo? Falta o <strong>saldo inicial</strong> da conta. Clique e informe o saldo de abertura (o extrato traz "saldo anterior").</button>
              )}
              {(s.aReceber > 0 || s.aPagar > 0) && (
                <div className="mt-2 flex gap-3 text-[11px]">
                  {s.aReceber > 0 && <span className="text-amber-600">a receber {brl(s.aReceber)}</span>}
                  {s.aPagar > 0 && <span className="text-rose-500">a pagar {brl(s.aPagar)}</span>}
                </div>
              )}
            </div>
          );
        })}
        {contasVis.length === 0 && <p className="col-span-full py-8 text-center text-sm text-zinc-400">Nenhuma conta cadastrada. Clique em "Nova conta".</p>}
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
              <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                <input type="checkbox" checked={!!form.cartao} onChange={(e) => setForm({ ...form, cartao: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#820AD1]" />
                <span className="text-sm text-zinc-600 dark:text-zinc-300">É <strong>cartão de crédito</strong><span className="mt-0.5 block text-[11px] text-zinc-400">Os <strong>gastos</strong> (despesas) ficam na fatura, fora do caixa, até você pagar. As entradas continuam no livro-razão. Dica: se o banco tem conta E cartão (ex.: Nubank), crie <strong>duas contas separadas</strong> — uma conta e uma cartão.</span></span>
              </label>
              {form.cartao && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fecha no dia"><input value={form.fechamento ?? ''} onChange={(e) => setForm({ ...form, fechamento: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="ex.: 26" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                  <Field label="Vence no dia"><input value={form.vencimento ?? ''} onChange={(e) => setForm({ ...form, vencimento: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="ex.: 3" className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" /></Field>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              <button onClick={salvar} disabled={addM.isPending || updM.isPending} className="rounded-lg bg-[#228BE6] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <CadastrosCard data={data} />
      <ConciliacaoAstrea data={data} />
    </>
  );
}

/** Gestão do cadastro de pagadores/recebedores (escritório, fornecedores, sócios). */
function CadastrosCard({ data }: { data: FinDashboard }) {
  const qc = useQueryClient();
  const cadastros = data.cadastros ?? [];
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CadastroTipo>('fornecedor');
  const inval = () => qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
  const TIPOS: { k: CadastroTipo; label: string }[] = [{ k: 'escritorio', label: 'Escritório' }, { k: 'fornecedor', label: 'Fornecedor' }, { k: 'socio', label: 'Sócio/CPF' }, { k: 'cliente', label: 'Cliente' }, { k: 'outro', label: 'Outro' }];
  const addM = useMutation({ mutationFn: () => financeiroService.addCadastro({ nome: nome.trim(), tipo }), onSuccess: () => { inval(); setNome(''); toast.success('Cadastrado'); }, onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro') });
  const updM = useMutation({ mutationFn: (v: { id: string; tipo: CadastroTipo }) => financeiroService.updateCadastro(v.id, { tipo: v.tipo }), onSuccess: inval, onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro') });
  const delM = useMutation({ mutationFn: (id: string) => financeiroService.removeCadastro(id), onSuccess: () => { inval(); toast.success('Removido'); }, onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro') });
  const ordenados = [...cadastros].sort((a, b) => (a.tipo === 'escritorio' ? -1 : b.tipo === 'escritorio' ? 1 : a.nome.localeCompare(b.nome)));

  return (
    <Card title={<span className="flex items-center gap-2"><UserCircle2 className="h-4 w-4 text-[#228BE6]" /> Cadastro de pagadores/recebedores</span>}
      sub="quem aparece nos campos de pagador/recebedor do lançamento. Fornecedores entram sozinhos ao lançar despesas; aqui você organiza e pré-cadastra (ex.: seu pai como sócio).">
      <div className="flex flex-wrap items-end gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nome.trim()) addM.mutate(); }} placeholder="Nome (ex.: José Andrade)" className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as CadastroTipo)} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">{TIPOS.filter((t) => t.k !== 'escritorio').map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}</select>
        <button onClick={() => addM.mutate()} disabled={!nome.trim() || addM.isPending} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
      </div>
      <div className="mt-3 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Nome</th><th className="px-2 py-1.5 font-medium">Tipo</th><th className="w-10"></th></tr></thead>
          <tbody>
            {ordenados.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-200">{c.nome}</td>
                <td className="px-2 py-1.5">
                  <select value={c.tipo} disabled={c.id === 'escritorio'} onChange={(e) => updM.mutate({ id: c.id, tipo: e.target.value as CadastroTipo })} className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900">{TIPOS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}</select>
                </td>
                <td className="px-2 py-1.5 text-right">{c.id !== 'escritorio' && <button onClick={() => { if (confirm(`Remover "${c.nome}" do cadastro?`)) delM.mutate(c.id); }} className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </tr>
            ))}
            {ordenados.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-sm text-zinc-400">Nenhum cadastro ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Auditoria do rombo real: compara o ledger vivo com a referência do Astrea, mês a mês. */
function ConciliacaoAstrea({ data }: { data: FinDashboard }) {
  const [open, setOpen] = useState(false);
  const ASTREA_RECEITA = 85110.58, ASTREA_RESULT = -29826.10;
  const ymBR = (d: string) => { const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}` : ''; };
  const astreaDesp = ASTREA_DESPESAS.reduce((s, o) => s + o.valor, 0);
  const astreaMes = useMemo(() => { const m = new Map<string, number>(); for (const o of ASTREA_DESPESAS) { const k = ymBR(o.data); if (k) m.set(k, (m.get(k) ?? 0) + o.valor); } return m; }, []);
  const realizados = (data.meses ?? []).filter((m) => !m.projecao);
  const sysReceita = realizados.reduce((s, m) => s + m.receita, 0);
  const sysDespesa = realizados.reduce((s, m) => s + m.despesaTotal, 0);
  const sysResult = sysReceita - sysDespesa;
  const diffRec = sysReceita - ASTREA_RECEITA;
  const diffDesp = sysDespesa - astreaDesp;
  const sysByKey = new Map(realizados.map((m) => [m.key, m]));
  const meses = [...new Set([...astreaMes.keys(), ...realizados.map((m) => m.key)])].filter((k) => /^\d{4}-\d{2}$/.test(k)).sort((a, b) => b.localeCompare(a));

  // Caça-duplicatas: receitas com MESMO valor + MESMO mês + MESMO pagador = provável duplicata.
  const [openDup, setOpenDup] = useState(false);
  const qc = useQueryClient();
  const delTx = useMutation({ mutationFn: (id: string) => financeiroService.removeTransacao(id, 'uma'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] }); toast.success('Lançamento removido'); }, onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro') });
  const dups = useMemo(() => {
    const groups = new Map<string, FinTransacao[]>();
    for (const t of data.transacoes ?? []) {
      if (t.valor <= 0 || (t.status && t.status !== 'recebido')) continue;
      const key = `${Math.round(t.valor * 100)}|${mesKey(t)}|${normNome(t.pagador ?? t.party ?? '')}`;
      const arr = groups.get(key) ?? []; arr.push(t); groups.set(key, arr);
    }
    return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b[0].valor - a[0].valor);
  }, [data.transacoes]);
  const dupTotal = dups.reduce((s, g) => s + g[0].valor * (g.length - 1), 0);
  const dupCount = dups.reduce((s, g) => s + (g.length - 1), 0);
  const [armAll, setArmAll] = useState(false); // arma o "remover todas" (2 cliques — confirm() nativo trava a automação)
  const [busyAll, setBusyAll] = useState(false);
  const removerTodas = async () => {
    const ids = dups.flatMap((g) => g.slice(1).map((t) => t.id).filter(Boolean)) as string[];
    setBusyAll(true); let ok = 0;
    for (const id of ids) { try { await financeiroService.removeTransacao(id, 'uma'); ok++; } catch { /* ignora */ } }
    setBusyAll(false); setArmAll(false);
    qc.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
    toast.success(`${ok} cópia(s) removida(s)`);
  };

  return (
    <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4 text-amber-600" /> Conciliação Astrea × sistema</span>}
      sub="por que o resultado operacional do sistema difere do déficit que você conhece do Astrea.">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Sistema (ledger vivo)</p>
          <div className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Receita</span><span className="tabular-nums text-emerald-600">{brl2(sysReceita)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Despesa</span><span className="tabular-nums text-rose-600">{brl2(sysDespesa)}</span></div>
            <div className="flex justify-between border-t border-zinc-100 pt-0.5 font-semibold dark:border-zinc-800"><span className="text-zinc-600 dark:text-zinc-300">Resultado</span><span className={`tabular-nums ${sysResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(sysResult)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Astrea (referência)</p>
          <div className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Receita</span><span className="tabular-nums text-emerald-600">{brl2(ASTREA_RECEITA)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Despesa</span><span className="tabular-nums text-rose-600">{brl2(astreaDesp)}</span></div>
            <div className="flex justify-between border-t border-zinc-100 pt-0.5 font-semibold dark:border-zinc-800"><span className="text-zinc-600 dark:text-zinc-300">Resultado</span><span className="tabular-nums text-rose-600">{brl2(ASTREA_RESULT)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Diferença (sistema − Astrea)</p>
          <div className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Receita</span><span className={`font-semibold tabular-nums ${Math.abs(diffRec) > 1000 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'}`}>{diffRec >= 0 ? '+' : ''}{brl2(diffRec)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Despesa</span><span className={`font-semibold tabular-nums ${Math.abs(diffDesp) > 1000 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'}`}>{diffDesp >= 0 ? '+' : ''}{brl2(diffDesp)}</span></div>
            <div className="flex justify-between border-t border-amber-200/60 pt-0.5 font-semibold dark:border-amber-900/40"><span className="text-zinc-600 dark:text-zinc-300">No resultado</span><span className="tabular-nums text-amber-700 dark:text-amber-300">{(sysResult - ASTREA_RESULT) >= 0 ? '+' : ''}{brl2(sysResult - ASTREA_RESULT)}</span></div>
          </div>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
        {Math.abs(diffRec) >= Math.abs(diffDesp)
          ? <>A maior causa é a <strong>receita</strong>: o sistema mostra <strong>{diffRec >= 0 ? `${brl2(diffRec)} a mais` : `${brl2(-diffRec)} a menos`}</strong> que o Astrea. {diffRec > 0 ? 'Provável: honorários que entraram por ASAAS/cobranças (e não estavam no relatório do Astrea), ou lançamentos duplicados. Confira os meses de receita alta abaixo — se algum não bater, é aí que o rombo "some".' : 'Faltam receitas no sistema.'}</>
          : <>A maior causa é a <strong>despesa</strong>: o sistema tem <strong>{diffDesp >= 0 ? `${brl2(diffDesp)} a mais` : `${brl2(-diffDesp)} a menos`}</strong> que o Astrea. {diffDesp < 0 ? 'Faltam gastos retroativos — rode "Lançar gastos retroativos" acima.' : 'Há despesas além das do Astrea.'}</>}
        {' '}O <strong>déficit real</strong> que você conhece (−{brl2(-ASTREA_RESULT)}) é o do Astrea; o sistema só bate com ele quando a receita e a despesa aqui casarem com a referência.
      </p>

      <button onClick={() => setOpen(!open)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#228BE6] hover:underline">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} {open ? 'Ocultar' : 'Ver'} mês a mês
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 font-medium">Mês</th><th className="px-2 py-1.5 text-right font-medium">Despesa Astrea</th><th className="px-2 py-1.5 text-right font-medium">Despesa sistema</th><th className="px-2 py-1.5 text-right font-medium">Δ despesa</th><th className="px-2 py-1.5 text-right font-medium">Receita sistema</th><th className="px-2 py-1.5 text-right font-medium">Resultado sistema</th></tr></thead>
            <tbody>
              {meses.map((k) => {
                const ad = astreaMes.get(k) ?? 0;
                const sm = sysByKey.get(k);
                const sd = sm?.despesaTotal ?? 0;
                const sr = sm?.receita ?? 0;
                const res = sr - sd;
                const dd = sd - ad;
                return (
                  <tr key={k} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{mesLabel(k)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{ad ? brl2(ad) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{sd ? brl2(sd) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${Math.abs(dd) > 500 ? 'text-amber-600' : 'text-zinc-400'}`}>{dd ? `${dd >= 0 ? '+' : ''}${brl2(dd)}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{sr ? brl2(sr) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${res >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{sm ? brl2(res) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-zinc-400">O Astrea só me deu o <strong>total</strong> de receitas (sem quebra por mês), então a coluna de receita mostra só a do sistema. <strong>Δ despesa</strong> em âmbar = mês onde o sistema destoa do Astrea (gasto faltando ou sobrando).</p>
        </div>
      )}

      {dups.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
          <button onClick={() => setOpenDup(!openDup)} className="flex w-full items-center justify-between gap-2 text-left">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300"><Flame className="h-4 w-4" /> {dups.length} possível(is) receita(s) duplicada(s) · ~{brl2(dupTotal)}</span>
            {openDup ? <ChevronDown className="h-4 w-4 text-amber-600" /> : <ChevronRight className="h-4 w-4 text-amber-600" />}
          </button>
          <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/80">Mesmo valor + mesmo mês + mesmo pagador. Confira e remova a cópia extra — isso deve aproximar o operacional do rombo real. (parcelas legítimas do mesmo cliente caem em meses diferentes, então não entram aqui.)</p>
          <div className="mt-2">
            <button onClick={() => (armAll ? removerTodas() : setArmAll(true))} disabled={busyAll} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${armAll ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {busyAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removendo…</> : armAll ? <><Trash2 className="h-3.5 w-3.5" /> Confirmar: remover {dupCount} cópia(s)</> : <><Trash2 className="h-3.5 w-3.5" /> Remover todas as cópias ({dupCount})</>}
            </button>
            {armAll && !busyAll && <button onClick={() => setArmAll(false)} className="ml-2 text-xs text-zinc-500 hover:text-zinc-700">cancelar</button>}
            <span className="ml-2 text-[11px] text-zinc-400">mantém a 1ª de cada grupo, remove as cópias</span>
          </div>
          {openDup && (
            <div className="mt-2 space-y-2">
              {dups.map((g, gi) => (
                <div key={gi} className="rounded-lg border border-amber-200/70 bg-white/60 p-2 dark:border-amber-900/30 dark:bg-zinc-900/40">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{titleCase(g[0].pagador ?? g[0].party ?? '') || g[0].categoria} · {brl2(g[0].valor)} · {mesLabel(mesKey(g[0]))} <span className="font-normal text-zinc-400">({g.length}×)</span></p>
                  <div className="mt-1 space-y-0.5">
                    {g.map((t, ti) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-500">{t.data} · {t.categoria}{ti === 0 ? <span className="ml-1 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">manter</span> : null}</span>
                        {ti > 0 && <button onClick={() => { if (t.id) delTx.mutate(t.id); }} disabled={delTx.isPending} className="rounded border border-rose-200 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:hover:bg-rose-900/20">remover cópia</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
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
    <label className={`flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border p-2.5 transition ${on ? 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900' : 'border-transparent bg-zinc-100/60 opacity-60 dark:bg-zinc-800/40'}`}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 shrink-0" style={{ accentColor: cor }} />
      <span className="min-w-0 flex-1 basis-0">
        <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} /><span className="truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200">{label}</span></span>
        <span className="block truncate text-[10px] text-zinc-400">{hint}</span>
      </span>
      <span className="ml-auto shrink-0 whitespace-nowrap text-sm font-bold tabular-nums" style={{ color: cor }}>{brl(value)}</span>
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


/** Página standalone (advogado com acesso limitado) — embrulha o conteúdo pessoal. */
function FinanceiroLimitado({ data }: { data: FinDashboard }) {
  const { user } = useAuthStore();
  // o próprio advogado pode lançar honorários/despesas na vertical dele
  const criar = user?.id && data.minhaArea ? { userId: user.id, area: data.minhaArea } : undefined;
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        {/* Visão pessoal escopada à vertical do advogado — lançamentos (pode criar),
            CS, projeção e motivação. O caixa e a carteira do escritório inteiro
            ficam restritos aos administradores. */}
        <MeuFinanceiroConteudo data={data} criar={criar} />
      </div>
    </div>
  );
}

/** Financeiro de UM advogado (escopado à vertical dele) — acionado pelo toggle
 * "ver o financeiro de" no topo do dashboard. Mostra exatamente o que ele vê. */
function AdvogadoFinanceiro({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'meu', userId], queryFn: () => financeiroService.meuFinanceiro(userId), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  if (!data) return <Card><p className="py-8 text-center text-sm text-zinc-400">Não foi possível carregar o financeiro deste advogado.</p></Card>;
  const criar = data.minhaArea ? { userId, area: data.minhaArea } : undefined;
  return (
    <div className="mt-4 rounded-2xl border border-[#7048E8]/25 bg-[#7048E8]/[0.03] p-4 dark:border-[#7048E8]/30 dark:bg-[#7048E8]/[0.06]">
      <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-[#7048E8]/10 px-2 py-0.5 text-xs font-medium text-[#7048E8]"><UserCircle2 className="h-3.5 w-3.5" /> é exatamente isto que ele(a) vê no login — escopado à vertical de atuação · você pode lançar por ele(a)</p>
      <MeuFinanceiroConteudo data={data} criar={criar} />
    </div>
  );
}

/** Financeiro de uma VERTICAL inteira (todos os casos/advogados da área) — visão
 * do dono. Reusa o layout da visão pessoal (bloco de área), escopado à vertical. */
function VerticalFinanceiro({ area }: { area: string }) {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({ queryKey: ['financeiro', 'vertical', area], queryFn: () => financeiroService.vertical(area), staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>;
  if (!data || data.semAcesso) return <Card><p className="py-8 text-center text-sm text-zinc-400">A visão por vertical é exclusiva do dono do escritório.</p></Card>;
  // O dono pode lançar honorários/despesas direto na vertical escolhida.
  const criar = user?.id ? { userId: user.id, area } : undefined;
  return (
    <div className="mt-4 rounded-2xl border border-[#15AABF]/25 bg-[#15AABF]/[0.04] p-4 dark:border-[#15AABF]/30 dark:bg-[#15AABF]/[0.07]">
      <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-[#15AABF]/10 px-2 py-0.5 text-xs font-medium text-[#0c8599]"><Scale className="h-3.5 w-3.5" /> vertical inteira · {area} — todos os casos e advogados da área · você pode lançar aqui</p>
      <MeuFinanceiroConteudo data={data} criar={criar} />
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
        <div className="max-h-96 overflow-x-auto overflow-y-auto scrollbar-thin">
          <table className="w-full min-w-[30rem] text-sm">
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
