'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  ArrowUpCircle, ArrowDownCircle, Sparkles, Search, HeartHandshake, Flame, Calendar, Gavel, ExternalLink, UserCircle2,
  TrendingUp, Target, ChevronRight, Scale, Plus, X, Loader2, Receipt, Wallet,
} from 'lucide-react';
import { financeiroService, type FinDashboard, type TxStatus } from '@/features/financeiro/services/financeiro.service';
import { contactsService } from '@/features/contacts/services/contacts.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { clientsService } from '@/features/legal-cases/services/clients.service';
import { mesKey, mesLabel, mesCurtoKey } from '@/features/financeiro/lib/clientes';

/** Contexto de criação de lançamento (quando o advogado pode lançar na vertical dele). */
export type CriarCtx = { userId: string; area: string; nome?: string };

const brl = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const brl2 = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kbrl = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '-' : ''; return a >= 1000 ? `${s}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${s}${a}`; };

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

const STATUS_TX: Record<TxStatus, { label: string; badge: string; cor: string }> = {
  a_receber: { label: 'A receber', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  recebido: { label: 'Recebido', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300', cor: '#2F9E44' },
  a_pagar: { label: 'A pagar', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', cor: '#F59F00' },
  pago: { label: 'Pago', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', cor: '#868E96' },
};

function MiniStat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#DEE2E6] bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

const VerProcesso = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <a href={`/processos/${id}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-zinc-700 hover:text-[#228BE6] hover:underline dark:text-zinc-200"><span className="truncate">{children}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-50" /></a>
);

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

export function MeuFinanceiroConteudo({ data, criar }: { data: FinDashboard; criar?: CriarCtx }) {
  const [subtab, setSubtab] = useState<'resumo' | 'holerite' | 'lancamentos' | 'receber' | 'projecoes' | 'motivacao'>('holerite');
  const [holMesSel, setHolMesSel] = useState('');
  const [novo, setNovo] = useState(false);
  const r = data.resumo ?? { recebido: 0, aReceber: 0, minhaParte: 0, nClientes: 0, nCasos: 0, nLancamentos: 0 };
  const clientes = data.clientes ?? [];
  // Quando o backend manda o bloco da ÁREA (vertical do advogado), a visão reflete
  // a vertical inteira (ex.: Previdenciário): lançamentos, CS e série da área toda.
  const deArea = !!data.area;
  const areaNome = data.area?.nome ?? '';
  const serie = (data.area?.serie?.length ? data.area.serie : data.serie) ?? [];
  const casos = data.casos ?? [];
  const cs = data.area?.cs ?? data.cs ?? { prestacao: 0, cumprimento: 0, cumprimentoNosso: 0, itens: [] as { caseId: string; cliente: string; tipo: string; valor: number; nosso?: number }[] };
  const lancFonte = data.area?.lancamentos ?? data.transacoes ?? [];
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
  const mesAtual = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }, []);
  const [mesSel, setMesSel] = useState(mesAtual); // abre no mês corrente (igual livro-razão); usuário muda no seletor
  const [stf, setStf] = useState<'todos' | 'recebido' | 'a_receber'>('todos');
  const [busca, setBusca] = useState('');

  // meses disponíveis + sempre o mês corrente (pra ele aparecer no seletor mesmo sem lançamento ainda)
  const mesesDisp = useMemo(() => Array.from(new Set([mesAtual, ...lancFonte.map(mesKey)])).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => b.localeCompare(a)), [lancFonte, mesAtual]);
  const txs = useMemo(() => lancFonte.filter((t) => {
    if (mesSel && mesKey(t) !== mesSel) return false;
    const st = t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
    if (stf === 'recebido' && !(st === 'recebido' || st === 'pago')) return false;
    if (stf === 'a_receber' && (st === 'recebido' || st === 'pago')) return false;
    if (busca && !`${t.pagador ?? t.party ?? ''} ${t.categoria}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [lancFonte, mesSel, stf, busca]);
  const chartData = serie.map((s) => ({ nome: mesCurtoKey(s.mes), valor: s.valor }));

  return (
    <>
        {/* Cabeçalho personalizado */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[#228BE6] text-base font-bold text-white">{iniciais}</span>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{saud}, {primeiro}! 👋</h1>
            <p className="text-sm text-zinc-500">{deArea ? <>Financeiro da vertical <strong>{areaNome}</strong> — <strong>{data.area?.nCasos ?? r.nCasos} processo(s)</strong> na área.</> : <>Seu financeiro — <strong>{r.nCasos ?? casos.length} processo(s)</strong> seus · <strong>{r.nClientes} cliente(s)</strong> que já te renderam honorários.</>}</p>
          </div>
        </div>

        {/* Subabas da visão escopada — organiza como o dashboard, mas na vertical */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-zinc-200/70 pb-2 dark:border-zinc-800">
          {([['holerite', 'Holerite', Wallet], ['resumo', 'Meu financeiro', Scale], ['lancamentos', 'Lançamentos', Receipt]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setSubtab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${subtab === k ? 'bg-[#7048E8] text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}><Icon className="h-4 w-4" /> {label}</button>
          ))}
          {criar && <button onClick={() => setNovo(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"><Plus className="h-4 w-4" /> Novo lançamento</button>}
        </div>
        {novo && criar && <NovoLancamentoModal criar={criar} onClose={() => setNovo(false)} />}

        {/* HOLERITE — folha do mês (entradas = sua parte dos honorários recebidos; retiradas; líquido) */}
        {subtab === 'holerite' && (() => {
          const hol = data.holerite ?? [];
          if (hol.length === 0) return <p className="mt-6 text-center text-sm text-zinc-400">Ainda não há holerite. Quando você receber honorários com <strong>rateio</strong> (sua parte) ou tiver <strong>retiradas</strong>, sua folha do mês aparece aqui.</p>;
          const mes = hol.some((x) => x.mes === holMesSel) ? holMesSel : hol[0].mes;
          const h = hol.find((x) => x.mes === mes) ?? hol[0];
          const liquido = h.liquido ?? (h.entradaTot - (h.saidaTot ?? 0));
          return (
            <div className="mt-4">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <select value={h.mes} onChange={(e) => setHolMesSel(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {hol.map((x) => <option key={x.mes} value={x.mes}>{mesLabel(x.mes)}</option>)}
                </select>
              </div>
              <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-emerald-500 to-[#228BE6] px-5 py-4 text-white">
                  <div><p className="text-[11px] uppercase tracking-wider opacity-80">Folha do mês</p><p className="text-lg font-bold">{mesLabel(h.mes)}</p></div>
                  <div className="text-right"><p className="text-[11px] uppercase tracking-wider opacity-80">{data.meuNome || ''}</p><p className="inline-flex items-center gap-1 text-sm font-semibold"><Wallet className="h-4 w-4" /> holerite</p></div>
                </div>
                <div className="px-5 py-4">
                  {/* Recebido de fato no mês (repasses + retiradas) = o dinheiro real */}
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600"><ArrowUpCircle className="h-3.5 w-3.5" /> Recebido no mês (repasses e retiradas)</p>
                  {(h.retiradas?.length ?? 0) === 0 ? <p className="pb-1 text-xs text-zinc-400">Nada foi pago a você neste mês ainda.</p> : (
                    <div className="space-y-0.5">
                      {h.retiradas.map((rt, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300"><span className="w-9 shrink-0 text-[11px] tabular-nums text-zinc-400">{(rt.data || '').slice(0, 5)}</span><span className="truncate">{rt.desc}</span></span>
                          <span className="shrink-0 font-medium tabular-nums text-emerald-600">{brl2(rt.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Líquido = o que recebeu de fato */}
                  <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-zinc-200 pt-3 dark:border-zinc-700">
                    <span className="text-sm font-bold uppercase tracking-wide text-zinc-500">Líquido do mês</span>
                    <span className={`text-xl font-bold tabular-nums ${liquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(liquido)}</span>
                  </div>

                  {/* Referência: quanto a vertical rendeu pra você pelo novo modelo (% do resultado) */}
                  {h.entradas.length > 0 && (
                    <div className="mt-4 rounded-lg bg-violet-50/60 p-3 dark:bg-violet-900/15">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#7048E8]">Referência · sua parte pelos honorários dos seus processos</p>
                      {h.entradas.map((e, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-sm">
                          <span className="min-w-0 text-zinc-600 dark:text-zinc-300"><span className="block truncate">Meus processos</span>{e.resultado != null && e.pct != null && <span className="block text-[11px] text-zinc-400">honorários dos meus processos {brl2(e.resultado)} × {e.pct}%</span>}</span>
                          <span className="shrink-0 font-medium tabular-nums text-[#7048E8]">{brl2(e.valor)}</span>
                        </div>
                      ))}
                      <p className="mt-1.5 text-[11px] text-zinc-400">Sua parte pelos honorários que <strong>você trouxe</strong> (% dos seus processos). O recebido acima pode diferir conforme os repasses do mês.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Minha vertical (Fase B) — o que ela vê em 10 segundos: receita − despesa = resultado → minha parte */}
        {subtab === 'resumo' && data.minhaVertical && data.minhaVertical.itens.length > 0 && (
          <div className="mt-4 space-y-3">
            {data.minhaVertical.itens.map((v) => (
              <div key={v.area} className="rounded-2xl border border-[#7048E8]/30 bg-gradient-to-br from-violet-50 to-white p-5 dark:border-violet-900/40 dark:from-violet-900/15 dark:to-zinc-900">
                <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Scale className="h-5 w-5 text-[#7048E8]" /> Meu financeiro{v.area ? ` · ${v.area}` : ''}</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Recebido (meus honorários)</p><p className="text-2xl font-bold tabular-nums text-emerald-600">{brl(v.receita)}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Minha parte ({v.pct}%)</p><p className="text-2xl font-bold tabular-nums text-[#7048E8]">{brl(v.minhaParte)}</p></div>
                </div>
                <p className="mt-2 text-[11px] text-zinc-400">Sua remuneração = <strong>{v.pct}% dos honorários dos seus processos</strong>{!data.minhaVertical!.configurada ? ' · % provisório, o escritório ainda vai definir sua participação' : ''}. Só aparecem os processos em que você participa.</p>
              </div>
            ))}
          </div>
        )}

        {/* Banner motivacional (Visão geral) */}
        {subtab === 'resumo' && (
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
        )}

        {/* Stats (Visão geral) */}
        {subtab === 'resumo' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Recebido (seus casos)" value={brl(r.recebido)} hint={melhorMes ? `melhor mês: ${mesLabel(melhorMes.mes).replace(' de ', '/')}` : `${r.nClientes} cliente(s)`} accent="#2F9E44" />
          <MiniStat label="A receber" value={brl(r.aReceber)} hint="lançamentos pendentes" accent="#F59F00" />
          <MiniStat label="Sua parte (rateio no êxito)" value={brl(r.minhaParte)} hint="o que você recebe de fato" accent="#7048E8" />
          <MiniStat label="Total a entrar" value={brl(aReceberTotal)} hint="a receber + sua parte + CS" accent="#228BE6" />
        </div>
        )}

        {/* Como funciona a remuneração da associada — honorários custeiam a vertical; ela recebe o rateio no êxito */}
        {subtab === 'resumo' && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-900/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-[#7048E8] dark:bg-violet-900/30"><Scale className="h-4 w-4" /></span>
          <div className="min-w-0 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">Como funciona a sua remuneração</p>
            <p className="mt-0.5">Os honorários <strong>iniciais e parcelados</strong> que aparecem aqui <strong>custeiam a vertical</strong> (estrutura, agência, anúncios) — não são o que você leva. <strong className="text-[#7048E8]">O que você recebe de fato é o rateio no êxito</strong>: a sua parte quando o caso é ganho. Ela aparece em <strong>“Sua parte (rateio no êxito)”</strong> acima e detalhada na aba <strong>Holerite</strong>.</p>
          </div>
        </div>
        )}

        {/* Gráfico: recebido mês a mês (Visão geral) */}
        {subtab === 'resumo' && serie.length > 1 && (
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

        {/* A receber (CS) — completo, escopado à área (prestação + cumprimento) */}
        {subtab === 'receber' && ((cs.prestacao > 0 || cs.cumprimento > 0) ? (
          <Card title={<span className="flex items-center gap-2"><Gavel className="h-4 w-4 text-emerald-600" /> A receber · Cumprimento de Sentença{deArea ? ` — ${areaNome}` : ''}</span>}
            sub={`o que os processos ${deArea ? 'da vertical' : 'seus'} devem trazer (preenchido no card de cada processo) — ${cs.itens.length} caso(s).`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Prestação (certo)</p><p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">{brl(cs.prestacao)}</p><p className="text-[11px] text-zinc-400">honorário + sucumbência apurados</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Cumprimento (nosso)</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#228BE6]">{brl(csCumprimentoNosso)}</p><p className="text-[11px] text-zinc-400">parte do escritório · bruto {brl(cs.cumprimento)}</p></div>
              <div className="rounded-xl border border-violet-300 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/15"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Total a receber</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#7048E8]">{brl(cs.prestacao + csCumprimentoNosso)}</p><p className="text-[11px] text-zinc-400">certo + provável (nosso)</p></div>
            </div>
            <div className="mt-3 max-h-64 space-y-0.5 overflow-y-auto scrollbar-thin">
              {cs.itens.map((x, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <VerProcesso id={x.caseId}>{x.cliente}</VerProcesso>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">{x.tipo === 'prestacao' ? 'prestação' : 'cumprimento'}</span>
                    {x.tipo === 'cumprimento' && x.nosso != null && <span className="hidden w-20 text-right text-[11px] text-zinc-400 sm:inline">bruto {brl(x.valor)}</span>}
                    <span className="w-24 text-right font-semibold tabular-nums text-emerald-600">{brl2(x.tipo === 'cumprimento' && x.nosso != null ? x.nosso : x.valor)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : deArea ? (
          <Card title={<span className="flex items-center gap-2"><Gavel className="h-4 w-4 text-emerald-600" /> A receber · Cumprimento de Sentença — {areaNome}</span>}>
            <p className="py-6 text-center text-sm text-zinc-400">Ainda não há valores em prestação de contas ou cumprimento nos casos da vertical. Assim que um processo chegar nessas fases e o valor for preenchido no card do processo, aparece aqui.</p>
          </Card>
        ) : null)}

        {/* Seus clientes (Visão geral) */}
        {subtab === 'resumo' && clientes.length > 0 && (
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

        {/* O que você está construindo — impacto + sua parte (Projeções) */}
        {subtab === 'projecoes' && data.projecaoCasos && data.projecaoCasos.nComValor > 0 && (
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
            {(data.projecaoCasos.nEstimados ?? 0) > 0 && (
              <p className="mt-2 inline-flex items-start gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">≈ Estimativa: {data.projecaoCasos.nEstimados} caso{data.projecaoCasos.nEstimados === 1 ? '' : 's'} usa{data.projecaoCasos.nEstimados === 1 ? '' : 'm'} valor da causa estimado (12× salário mínimo — art. 292 §1º CPC), porque o Astrea trouxe o valor zerado. Ajusta assim que o valor real for lançado.</p>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-400">Estimativa: a condenação real costuma sair diferente do valor da causa (pra mais ou pra menos) — {data.projecaoCasos.isSocio ? 'sua parte de sócio sai dos honorários do escritório, conforme a divisão acima.' : 'sua parte já é calculada pela média de êxito de cada caso.'}</p>
          </Card>
        )}

        {/* ── PROJEÇÕES da sua carteira — o caminho causa→sua parte + cenários ── */}
        {subtab === 'projecoes' && data.projecaoCasos && data.projecaoCasos.nComValor > 0 && (
          <Card title={<span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#7048E8]" /> Projeções da sua carteira</span>}
            sub="o caminho do valor até a sua parte, e três cenários conforme os casos evoluem.">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { label: 'Valor em causa', v: data.projecaoCasos.brutoEmProcesso, cor: '#E64980' },
                { label: 'Condenação estimada', v: data.projecaoCasos.condenacaoEstimada, cor: '#228BE6' },
                { label: 'Honorários do escritório', v: data.projecaoCasos.escritorioEmProcesso, cor: '#15AABF' },
                { label: 'Sua parte provável', v: data.projecaoCasos.liquidoProvavel, cor: '#7048E8' },
              ].map((s, i, arr) => (
                <div key={i} className="relative rounded-xl border border-zinc-200/70 p-3 dark:border-zinc-800">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-400">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: s.cor }}>{brl(s.v)}</p>
                  {i < arr.length - 1 && <ChevronRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-zinc-300 sm:block" />}
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Conservador', hint: 'se boa parte não vingar', fator: 0.6, cor: '#F59F00' },
                { label: 'Provável', hint: 'no ritmo de êxito atual', fator: 1, cor: '#7048E8' },
                { label: 'Otimista', hint: 'se a maioria for favorável', fator: 1.35, cor: '#2F9E44' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} /><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{c.label}</p></div>
                  <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: c.cor }}>{brl(Math.min(data.projecaoCasos!.brutoEmProcesso, data.projecaoCasos!.liquidoProvavel * c.fator))}</p>
                  <p className="text-[11px] text-zinc-400">{c.hint}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-zinc-400">Projeção da carteira, não caixa realizado. Em previdenciário o retorno chega quando o benefício é concedido (sucumbência/destaque) — por isso o valor mora no futuro que você está construindo.</p>
          </Card>
        )}

        {/* ── CUSTO DA SUA VERTICAL — entradas × saídas, overhead rateado por casos ── */}
        {subtab === 'resumo' && data.resultadoVertical && (
          <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4 text-[#15AABF]" /> Custo da sua vertical{data.minhaArea ? ` · ${data.minhaArea}` : ''}</span>}
            sub={`quanto a sua área rende e custa hoje — a estrutura compartilhada do escritório entra rateada por nº de casos (${data.resultadoVertical.nCasos} da sua vertical).`}>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Entradas</p><p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">{brl(data.resultadoVertical.entradas)}</p><p className="text-[11px] text-zinc-400">honorários recebidos</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Saídas</p><p className="mt-0.5 text-xl font-bold tabular-nums text-rose-600">{brl(data.resultadoVertical.saidas)}</p><p className="text-[11px] text-zinc-400">diretas {brl(data.resultadoVertical.diretas)} + estrutura {brl(data.resultadoVertical.overhead)}</p></div>
              <div className={`rounded-xl border p-3 ${data.resultadoVertical.resultado >= 0 ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10' : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'}`}><p className="text-[11px] uppercase tracking-wide text-zinc-400">Resultado hoje</p><p className={`mt-0.5 text-xl font-bold tabular-nums ${data.resultadoVertical.resultado >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{brl(data.resultadoVertical.resultado)}</p><p className="text-[11px] text-zinc-400">{data.resultadoVertical.resultado >= 0 ? 'a vertical se paga' : 'ainda em investimento'}</p></div>
              <div className="rounded-xl border border-violet-300 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/15"><p className="text-[11px] uppercase tracking-wide text-zinc-400">A caminho (carteira)</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#7048E8]">{brl(data.resultadoVertical.projetado)}</p><p className="text-[11px] text-zinc-400">honorários prováveis da área</p></div>
            </div>
            {data.resultadoVertical.custos && data.resultadoVertical.custos.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Custos diretos:</span>
                {data.resultadoVertical.custos.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-900/15 dark:text-rose-300">{c.label}: {brl(c.valor)}</span>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">{data.resultadoVertical.resultado < 0
              ? <>Hoje a vertical <strong>investe mais do que recebe</strong> — natural em previdenciário de gratuidade: o retorno chega quando os benefícios são concedidos (sucumbência/destaque). Há <strong className="text-[#7048E8]">{brl(data.resultadoVertical.projetado)}</strong> em honorários prováveis a caminho.</>
              : <>A vertical já <strong>se paga</strong>: as entradas cobrem os custos diretos e a fatia da estrutura do escritório.</>}</p>
          </Card>
        )}

        {/* ── MOTIVAÇÃO & metas — alvo da carteira + impacto (sem depender de caixa) ── */}
        {subtab === 'motivacao' && data.projecaoCasos && data.projecaoCasos.nComValor > 0 && (
          <Card title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-600" /> Suas metas</span>}
            sub="o alvo que a sua carteira aponta — e o quanto você já percorreu.">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Já realizado</p><p className="text-2xl font-bold tabular-nums text-emerald-600">{brl(r.recebido)}</p></div>
              <ChevronRight className="h-5 w-5 text-zinc-300" />
              <div><p className="text-[11px] uppercase tracking-wide text-zinc-400">Meta da carteira (sua parte)</p><p className="text-2xl font-bold tabular-nums text-[#7048E8]">{brl(data.projecaoCasos.liquidoProvavel)}</p></div>
              <div className="ml-auto max-w-xs text-right text-sm text-zinc-500">São <strong className="text-zinc-700 dark:text-zinc-200">{data.projecaoCasos.nComValor} casos</strong> trabalhando por você — cada decisão favorável aproxima essa meta.</div>
            </div>
            {data.projecaoCasos.liquidoProvavel > 0 && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#7048E8]" style={{ width: `${Math.min(100, Math.round((r.recebido / data.projecaoCasos.liquidoProvavel) * 100))}%` }} /></div>
                <p className="mt-1 text-[11px] text-zinc-400">{Math.min(100, Math.round((r.recebido / data.projecaoCasos.liquidoProvavel) * 100))}% da sua carteira já virou caixa.</p>
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Gavel, cor: '#228BE6', titulo: 'Acompanhe os casos em fase decisiva', texto: 'Sentença e cumprimento são onde a carteira vira caixa. Manter esses prazos em dia acelera o que já está a caminho.' },
                { icon: HeartHandshake, cor: '#E64980', titulo: `${data.projecaoCasos.nComValor} vidas contam com você`, texto: 'Cada processo é alguém aguardando um direito. O impacto do seu trabalho se mede em pessoas, não só em números.' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}><s.icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.titulo}</p><p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{s.texto}</p></div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── MOTIVAÇÃO — o que está a caminho (CS a receber + sua parte na carteira) ── */}
        {subtab === 'motivacao' && (cs.prestacao + csCumprimentoNosso > 0 || (data.projecaoCasos?.liquidoProvavel ?? 0) > 0) && (
          <Card title={<span className="flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" /> Motivação{deArea ? ` · ${areaNome}` : ''}</span>}
            sub="o retorno que o seu trabalho está construindo — mesmo o que ainda não virou caixa.">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">A receber (CS)</p><p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">{brl(cs.prestacao + csCumprimentoNosso)}</p><p className="text-[11px] text-zinc-400">prestação + cumprimento (nosso)</p></div>
              <div className="rounded-xl border border-violet-300 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/15"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Sua parte na carteira</p><p className="mt-0.5 text-xl font-bold tabular-nums text-[#7048E8]">{brl(data.projecaoCasos?.liquidoProvavel ?? 0)}</p><p className="text-[11px] text-zinc-400">honorários prováveis dos processos</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-900/10"><p className="text-[11px] uppercase tracking-wide text-zinc-400">Total a caminho</p><p className="mt-0.5 text-xl font-bold tabular-nums text-amber-600">{brl(cs.prestacao + csCumprimentoNosso + (data.projecaoCasos?.liquidoProvavel ?? 0))}</p><p className="text-[11px] text-zinc-400">o que o seu esforço deve trazer</p></div>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">🔥 Tem <strong className="text-amber-600">{brl(cs.prestacao + csCumprimentoNosso + (data.projecaoCasos?.liquidoProvavel ?? 0))}</strong> a caminho pelos seus processos. Cada prazo cumprido e cada audiência aproxima esse valor de virar caixa — e uma vida resolvida.</p>
          </Card>
        )}

        {/* Seus processos — autor × réu, etiquetas, o que o cliente busca, sua parte (Visão geral) */}
        {subtab === 'resumo' && casos.length > 0 && (
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

        {/* Lançamentos — filtrável (aba Lançamentos) */}
        {subtab === 'lancamentos' && (
        <Card title={<>{deArea ? <>Lançamentos da área · {areaNome}</> : 'Seus lançamentos'} <span className="font-normal text-zinc-400">· {txs.length}</span></>} sub={deArea ? `entradas e saídas ligadas à vertical ${areaNome} (inclui o que você lançar) — os honorários iniciais e parcelados custeiam a vertical; a sua remuneração é o rateio no êxito.` : 'movimentações dos seus casos — honorários iniciais e parcelados custeiam a vertical; a sua remuneração é o rateio no êxito.'} action={criar && <button onClick={() => setNovo(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo</button>}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="bg-transparent text-sm font-medium outline-none"><option value="">Todos os meses</option>{mesesDisp.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}</select>
            </div>
            <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">{STATUS_FILTROS_ADV.map((a) => <button key={a.key} onClick={() => setStf(a.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${stf === a.key ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500'}`}>{a.label}</button>)}</div>
            <div className="relative ml-auto"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></div>
          </div>
          <div className="max-h-[30rem] overflow-y-auto scrollbar-thin">
            {txs.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">Nenhum lançamento neste filtro.</p>
            ) : txs.map((t) => {
              const st = t.status ?? (t.valor >= 0 ? 'recebido' : 'pago');
              const fatia = t.minhaFatiaRateio; // despesa rateada: só a fatia é sua
              const valorMostrado = fatia ? -fatia.valor : t.valor;
              return (
                <div key={t.id} className="flex items-start gap-2 border-t border-zinc-100 px-1 py-1.5 text-sm dark:border-zinc-800/70">
                  <span className="mt-0.5 w-12 shrink-0 text-xs tabular-nums text-zinc-400">{t.data.slice(0, 5)}</span>
                  {valorMostrado >= 0 ? <ArrowUpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1">
                      <span className="truncate">{t.pagador || t.recebedor || t.party || t.categoria}</span>
                      {fatia && <span className="shrink-0 rounded bg-[#7048E8]/10 px-1 text-[9px] font-semibold text-[#7048E8]" title="sua parte do rateio (definida no RH)">sua fatia</span>}
                      {t.parcelaNum ? <span className="shrink-0 text-[11px] text-zinc-400">{t.parcelaNum}/{t.parcelaTot}</span> : null}
                    </span>
                    {fatia && <span className="block truncate text-[11px] text-zinc-400">{fatia.itens.map((x) => `${x.pct}% de ${brl2(x.base)}${x.label ? ` (${x.label})` : ` · ${x.area}`}`).join(' + ')}</span>}
                  </span>
                  <span className={`mt-0.5 hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${STATUS_TX[st].badge}`}>{STATUS_TX[st].label}</span>
                  <span className={`mt-0.5 w-24 shrink-0 text-right font-semibold tabular-nums ${valorMostrado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{brl2(valorMostrado)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        )}

        <p className="mt-4 pb-2 text-center text-xs text-zinc-400">{deArea ? <>Esta visão reflete a vertical <strong>{areaNome}</strong> — sua área de atuação.</> : 'Esta visão mostra apenas os seus processos — em que você é o responsável.'}</p>
    </>
  );
}

/** Modal compacto de novo lançamento (honorário/despesa) tagueado à vertical do advogado. */
function NovoLancamentoModal({ criar, onClose }: { criar: CriarCtx; onClose: () => void }) {
  const qc = useQueryClient();
  const hoje = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })();
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');
  const [categoria, setCategoria] = useState('Honorários');
  const [valor, setValor] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [contactId, setContactId] = useState<string | undefined>();
  const [caseId, setCaseId] = useState<string | undefined>();
  const [procLabel, setProcLabel] = useState('');
  const [data, setData] = useState(hoje);
  const [status, setStatus] = useState<TxStatus>('recebido');
  const CATS_REC = ['Honorários', 'Outros'];
  const CATS_DESP = ['Anúncios', 'Agência', 'Suprimentos escritório', 'Aluguel', 'Contador', 'Outros'];
  const cats = tipo === 'receita' ? CATS_REC : CATS_DESP;
  const save = useMutation({
    mutationFn: () => financeiroService.addTransacao({
      data, tipo, categoria, valor: Math.abs(Number(String(valor).replace(',', '.')) || 0),
      pagador: tipo === 'receita' ? (pessoa || undefined) : undefined, recebedor: tipo === 'despesa' ? (pessoa || undefined) : undefined,
      status, area: criar.area, responsavelId: criar.userId, contactId, caseId,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financeiro'] }); qc.invalidateQueries({ queryKey: ['contact'] }); toast.success('Lançamento adicionado'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao lançar'),
  });
  const podeSalvar = Number(String(valor).replace(',', '.')) > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#DEE2E6] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Receipt className="h-4 w-4 text-[#02883C]" /> Novo lançamento · {criar.area}</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {(['receita', 'despesa'] as const).map((t) => (
              <button key={t} onClick={() => { setTipo(t); setCategoria(t === 'receita' ? 'Honorários' : 'Anúncios'); setStatus(t === 'receita' ? 'recebido' : 'pago'); }} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${tipo === t ? (t === 'receita' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-zinc-500'}`}>{t === 'receita' ? 'Entrada' : 'Saída'}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-zinc-500">Categoria
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950">{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <label className="text-xs font-medium text-zinc-500">Valor (R$)
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
          </div>
          {tipo === 'receita' ? (
            <div className="text-xs font-medium text-zinc-500">Cliente <span className="font-normal text-zinc-400">(busca o cadastro — o lançamento entra na ficha dele)</span>
              <BuscaCliente value={pessoa} onPick={(c) => { setPessoa(c?.nome ?? ''); setContactId(c?.id); }} onText={(t) => { setPessoa(t); setContactId(undefined); }} />
            </div>
          ) : (
            <label className="block text-xs font-medium text-zinc-500">Fornecedor / descrição
              <input value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="ex.: Meta Ads, agência…" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
          )}
          <div className="text-xs font-medium text-zinc-500">Vincular a um processo <span className="font-normal text-zinc-400">(opcional — pra quitar/registrar no processo)</span>
            {caseId ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#228BE6]/40 bg-[#228BE6]/5 px-2 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-zinc-700 dark:text-zinc-200"><Gavel className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /><span className="truncate">{procLabel}</span></span>
                <button onClick={() => { setCaseId(undefined); setProcLabel(''); }} className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <BuscaProcesso onPick={(c) => { setCaseId(c.id); setProcLabel(c.label); }} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-zinc-500">Data
              <input value={data} onChange={(e) => setData(e.target.value)} placeholder="DD/MM/AAAA" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
            <label className="text-xs font-medium text-zinc-500">Situação
              <select value={status} onChange={(e) => setStatus(e.target.value as TxStatus)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                {tipo === 'receita' ? <><option value="recebido">Recebido</option><option value="a_receber">A receber</option></> : <><option value="pago">Pago</option><option value="a_pagar">A pagar</option></>}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!podeSalvar || save.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Lançar</button>
        </div>
      </div>
    </div>
  );
}

/** Busca de cliente (cadastro) — autocomplete. onPick=selecionou contato; onText=digitou livre. */
export function BuscaCliente({ value, onPick, onText }: { value: string; onPick: (c: { id: string; nome: string } | null) => void; onText: (t: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const ql = q.trim().toLowerCase();
  // Contatos do Comercial + clientes do Jurídico (parties dos processos, ex.: Lubrimarques).
  const { data, isFetching } = useQuery({ queryKey: ['fin-busca-cli', q], queryFn: () => contactsService.list({ search: q, limit: '8' }), enabled: open && ql.length >= 2, staleTime: 30_000 });
  const { data: legais = [] } = useQuery({ queryKey: ['fin-busca-cli-legais'], queryFn: () => clientsService.list(), enabled: open, staleTime: 300_000 });
  const contatos = data?.contacts ?? [];
  // Monta a lista: clientes do Jurídico que casam com a busca + contatos ainda não listados (por nome).
  const opts = useMemo(() => {
    if (ql.length < 2) return [] as { id: string; nome: string; fonte: 'juridico' | 'contato' }[];
    const vistos = new Set<string>();
    const out: { id: string; nome: string; fonte: 'juridico' | 'contato' }[] = [];
    for (const c of legais) {
      const nome = c.name ?? '';
      if (!nome.toLowerCase().includes(ql)) continue;
      const k = nome.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push({ id: c.contact?.id ?? c.partyId, nome, fonte: 'juridico' });
    }
    for (const c of contatos) {
      const nome = c.name ?? '';
      const k = nome.toLowerCase();
      if (!nome || vistos.has(k)) continue;
      vistos.add(k);
      out.push({ id: c.id, nome, fonte: 'contato' });
    }
    return out.slice(0, 12);
  }, [legais, contatos, ql]);
  return (
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); onText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="buscar cliente pelo nome…" className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      {open && ql.length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {isFetching && opts.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">buscando…</p>}
          {!isFetching && opts.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">nenhum cliente — o nome digitado será usado assim mesmo.</p>}
          {opts.map((c) => (
            <button key={`${c.fonte}-${c.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick({ id: c.id, nome: c.nome }); setQ(c.nome); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"><UserCircle2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="truncate">{c.nome}</span>{c.fonte === 'juridico' && <span className="ml-auto shrink-0 rounded bg-[#228BE6]/10 px-1.5 text-[10px] font-semibold text-[#228BE6]">processo</span>}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Busca de processo — autocomplete (pra quitar/vincular). */
export function BuscaProcesso({ onPick }: { onPick: (c: { id: string; label: string }) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useQuery({ queryKey: ['fin-busca-proc', q], queryFn: () => legalCasesService.list({ search: q }), enabled: open && q.trim().length >= 2, staleTime: 30_000 });
  const opts = (data ?? []).slice(0, 8);
  return (
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="buscar processo (cliente, nº, título)…" className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {isFetching && opts.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">buscando…</p>}
          {!isFetching && opts.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">nenhum processo encontrado.</p>}
          {opts.map((c) => (
            <button key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick({ id: c.id, label: `${c.title}${c.cnjNumber ? ` · ${c.cnjNumber}` : ''}` }); setOpen(false); }} className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <span className="truncate text-zinc-700 dark:text-zinc-200">{c.title}</span>
              <span className="truncate text-[11px] text-zinc-400">{c.cnjNumber || 'sem nº'}{c.area ? ` · ${c.area}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
