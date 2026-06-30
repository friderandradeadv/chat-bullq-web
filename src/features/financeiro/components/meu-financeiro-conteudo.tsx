'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  ArrowUpCircle, ArrowDownCircle, Sparkles, Search, HeartHandshake, Flame, Calendar, Gavel, ExternalLink, UserCircle2,
} from 'lucide-react';
import { type FinDashboard, type TxStatus } from '@/features/financeiro/services/financeiro.service';
import { mesKey, mesLabel, mesCurtoKey } from '@/features/financeiro/lib/clientes';

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

export function MeuFinanceiroConteudo({ data }: { data: FinDashboard }) {
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
