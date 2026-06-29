'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calculator,
  FileText,
  Gavel,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import {
  calculadoraCsService,
  type CalcularCsInput,
  type HonorariosBase,
  type IndiceCorrecao,
} from '@/features/calculadora-cs/services/calculadora-cs.service';

const brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);
const pct = (n: number | undefined) => `${(n ?? 0).toFixed(4).replace('.', ',')}%`;

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const cardCls =
  'rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';

function parseValor(raw: string): number {
  let s = (raw || '').replace(/r\$|\s/gi, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

const hoje = new Date().toISOString().slice(0, 10);

type Linha = { descricao: string; data: string; valor: string };
const linhaVazia = (descricao = ''): Linha => ({ descricao, data: '', valor: '' });

export default function CumprimentoSentencaPage() {
  const [form, setForm] = useState({
    nomeCalculo: '',
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    termoFinal: hoje,
    proRataDie: false,
    jurosMora: '1,00',
    jurosInicial: 'vencimento', // 'vencimento' | data
    multaPct: '0',
    honPercentual: '10',
    honBase: 'diferenca' as HonorariosBase,
    honQuantiaFixa: '',
    honAtualizar: false,
    honQuantiaData: '',
    multa523Mor: false,
    multa523Hon: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [debitos, setDebitos] = useState<Linha[]>([linhaVazia('Condenação')]);
  const [creditos, setCreditos] = useState<Linha[]>([]);
  const [obsIA, setObsIA] = useState<string | null>(null);

  const upd = (
    arr: Linha[],
    setArr: (l: Linha[]) => void,
    i: number,
    k: keyof Linha,
    v: string,
  ) => setArr(arr.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  // ── Importar sentença (IA) ────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [iaAviso, setIaAviso] = useState<string | null>(null);
  const iaMut = useMutation({
    mutationFn: (files: File[]) => calculadoraCsService.extrairSentenca(files),
    onSuccess: (r) => {
      const e = r.extracao;
      setObsIA(e?.observacoes || null);
      if (!e) {
        setIaAviso(r.aviso ?? 'A IA não retornou dados.');
        return;
      }
      if (e.debitos?.length) {
        setDebitos(
          e.debitos.map((d) => ({
            descricao: d.descricao,
            data: d.data,
            valor: String(d.valor).replace('.', ','),
          })),
        );
      }
      setForm((f) => ({
        ...f,
        nomeCalculo: e.nomeCalculo || f.nomeCalculo,
        indiceCorrecao: e.indiceCorrecao || f.indiceCorrecao,
        jurosMora: e.jurosMora != null ? String(e.jurosMora).replace('.', ',') : f.jurosMora,
        jurosInicial:
          e.jurosInicial && /^\d{4}-\d{2}-\d{2}$/.test(e.jurosInicial)
            ? e.jurosInicial
            : 'vencimento',
        honPercentual: e.honorarios ? String(e.honorarios.percentual).replace('.', ',') : f.honPercentual,
        honBase: e.honorarios?.base ?? f.honBase,
        honQuantiaFixa:
          e.honorarios?.base === 'fixa' && e.valorCausa
            ? String(e.valorCausa).replace('.', ',')
            : f.honQuantiaFixa,
        multa523Mor: e.aplicarMulta523 ?? f.multa523Mor,
        multa523Hon: e.aplicarMulta523 ?? f.multa523Hon,
      }));
      setIaAviso(r.aviso ?? `IA preencheu ${e.debitos?.length ?? 0} verba(s). Confira antes de calcular.`);
    },
    onError: (err) => setIaAviso((err as Error)?.message ?? 'Erro ao ler os documentos.'),
  });
  const onPick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files ? Array.from(ev.target.files) : [];
    ev.target.value = '';
    if (files.length) {
      setIaAviso(null);
      iaMut.mutate(files);
    }
  };

  // ── Cálculo ───────────────────────────────────────────────────────────────
  const debitosValidos = useMemo(
    () => debitos.filter((d) => d.data && !isNaN(parseValor(d.valor)) && parseValor(d.valor) > 0),
    [debitos],
  );
  const calc = useMutation({
    mutationFn: () => {
      const lin = (l: Linha) => ({ descricao: l.descricao || 'Item', data: l.data, valor: parseValor(l.valor) });
      const jmInicial = /^\d{4}-\d{2}-\d{2}$/.test(form.jurosInicial) ? form.jurosInicial : 'vencimento';
      const payload: CalcularCsInput = {
        nomeCalculo: form.nomeCalculo || undefined,
        indiceCorrecao: form.indiceCorrecao,
        termoFinal: form.termoFinal,
        proRataDie: form.proRataDie,
        jurosMora: parseValor(form.jurosMora) || 0,
        jurosInicial: jmInicial,
        multaPct: parseValor(form.multaPct) || 0,
        honorarios:
          parseValor(form.honPercentual) > 0
            ? {
                percentual: parseValor(form.honPercentual),
                base: form.honBase,
                quantiaFixa: form.honBase === 'fixa' ? parseValor(form.honQuantiaFixa) || 0 : undefined,
                atualizarQuantia: form.honBase === 'fixa' ? form.honAtualizar : undefined,
                quantiaData:
                  form.honBase === 'fixa' && form.honAtualizar && form.honQuantiaData
                    ? form.honQuantiaData
                    : undefined,
              }
            : undefined,
        multaMoratoria523: form.multa523Mor,
        honorarios523: form.multa523Hon,
        debitos: debitos.filter((d) => d.data && parseValor(d.valor) > 0).map(lin),
        creditos: creditos.filter((c) => c.data && parseValor(c.valor) > 0).map(lin),
      };
      return calculadoraCsService.calcular(payload);
    },
  });
  const res = calc.data;
  const podeCalcular = debitosValidos.length > 0 && !!form.termoFinal;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="w-full px-4 py-6 lg:px-6">
        <Link
          href="/juridico/calculos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Calculadoras
        </Link>
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
            <Gavel className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
              Cumprimento de Sentença
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Atualização de débitos · correção + juros + honorários + multa do art. 523 · importação por IA
            </p>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* ── Entrada ─────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Importar sentença (IA) */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Importar sentença / inicial (IA)
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Suba a <b>sentença</b> (e a <b>inicial</b>, se quiser) em PDF — a IA lê e
                preenche a condenação, índice, juros e honorários.
              </p>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPick} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={iaMut.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 py-2.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/15"
              >
                {iaMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Lendo os documentos…</>
                ) : (
                  <><Upload className="h-4 w-4" /> Enviar PDF(s) da sentença / inicial</>
                )}
              </button>
              {iaAviso && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{iaAviso}</p>}
              {obsIA && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span><b>IA:</b> {obsIA}</span>
                </div>
              )}
            </div>

            {/* Débitos */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileText className="h-4 w-4 text-zinc-400" /> Débitos (condenação)
              </h2>
              <ItensEditor itens={debitos} setItens={setDebitos} upd={(i, k, v) => upd(debitos, setDebitos, i, k, v)} placeholderDesc="Condenação / dano moral…" />
            </div>

            {/* Parâmetros */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Calculator className="h-4 w-4 text-zinc-400" /> Parâmetros
              </h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nome do cálculo</label>
                  <input className={inputCls} placeholder="Cumprimento - Autor x Réu" value={form.nomeCalculo} onChange={(e) => set('nomeCalculo', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Índice de correção</label>
                    <select className={inputCls} value={form.indiceCorrecao} onChange={(e) => set('indiceCorrecao', e.target.value as IndiceCorrecao)}>
                      <option value="INPC">INPC</option>
                      <option value="IPCA-E">IPCA-E</option>
                      <option value="IPCA">IPCA</option>
                      <option value="IGP-M">IGP-M</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Termo final (data do cálculo)</label>
                    <input type="date" className={inputCls} value={form.termoFinal} onChange={(e) => set('termoFinal', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Juros de mora (% a.m.)</label>
                    <input className={inputCls} inputMode="decimal" placeholder="1,00" value={form.jurosMora} onChange={(e) => set('jurosMora', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Multa (% sobre principal)</label>
                    <input className={inputCls} inputMode="decimal" placeholder="0" value={form.multaPct} onChange={(e) => set('multaPct', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Juros a partir de</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => set('jurosInicial', 'vencimento')} className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${form.jurosInicial === 'vencimento' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>
                      Vencimento de cada verba
                    </button>
                    <input type="date" className={`${inputCls} flex-1`} value={/^\d{4}-\d{2}-\d{2}$/.test(form.jurosInicial) ? form.jurosInicial : ''} onChange={(e) => set('jurosInicial', e.target.value || 'vencimento')} title="Data fixa (ex.: citação)" />
                  </div>
                  <p className="mt-1 text-[10px] leading-tight text-zinc-400">Data fixa (citação) à direita, ou por vencimento.</p>
                </div>

                <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Honorários sucumbenciais</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Percentual (%)</label>
                      <input className={inputCls} inputMode="decimal" placeholder="10" value={form.honPercentual} onChange={(e) => set('honPercentual', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Base</label>
                      <select className={inputCls} value={form.honBase} onChange={(e) => set('honBase', e.target.value as HonorariosBase)}>
                        <option value="diferenca">Sobre o principal corrigido</option>
                        <option value="debitos">Sobre os débitos corrigidos</option>
                        <option value="fixa">Sobre o valor da causa (fixo)</option>
                      </select>
                    </div>
                  </div>
                  {form.honBase === 'fixa' && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className={labelCls}>Valor da causa (R$)</label>
                        <input className={inputCls} inputMode="decimal" placeholder="12.268,18" value={form.honQuantiaFixa} onChange={(e) => set('honQuantiaFixa', e.target.value)} />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.honAtualizar} onChange={(e) => set('honAtualizar', e.target.checked)} />
                        Atualizar o valor da causa (correção até o termo final)
                      </label>
                      {form.honAtualizar && (
                        <div>
                          <label className={labelCls}>Data inicial da correção</label>
                          <input type="date" className={inputCls} value={form.honQuantiaData} onChange={(e) => set('honQuantiaData', e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Multa do art. 523 do CPC</p>
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.multa523Mor} onChange={(e) => set('multa523Mor', e.target.checked)} />
                    Multa moratória de 10%
                  </label>
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.multa523Hon} onChange={(e) => set('multa523Hon', e.target.checked)} />
                    Honorários de 10%
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.proRataDie} onChange={(e) => set('proRataDie', e.target.checked)} />
                  Pro rata die
                </label>
              </div>
            </div>

            {/* Créditos / amortizações */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileText className="h-4 w-4 text-zinc-400" /> Créditos / pagamentos <span className="text-xs font-normal text-zinc-400">(opcional)</span>
              </h2>
              {creditos.length === 0 ? (
                <button type="button" onClick={() => setCreditos([linhaVazia('Pagamento')])} className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
                  <Plus className="h-3.5 w-3.5" /> Adicionar amortização
                </button>
              ) : (
                <ItensEditor itens={creditos} setItens={setCreditos} upd={(i, k, v) => upd(creditos, setCreditos, i, k, v)} placeholderDesc="Pagamento parcial…" />
              )}
            </div>

            <button
              type="button"
              disabled={!podeCalcular || calc.isPending}
              onClick={() => calc.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {calc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular atualização
            </button>
            {calc.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">{(calc.error as Error)?.message ?? 'Erro ao calcular.'}</p>
            )}
          </div>

          {/* ── Resultado ───────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-4">
            {!res && (
              <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40">
                <Gavel className="mb-2 h-8 w-8 opacity-40" />
                Importe a sentença (ou preencha à mão) e clique em <b className="mx-1">Calcular</b>.
              </div>
            )}
            {res && (
              <>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Resultado</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {res.config.indiceCorrecao} · termo final {res.config.termoFinal.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <dl className="text-sm">
                    <ResRow label="Principal (débitos corrigidos − créditos)" valor={res.totais.principal} />
                    {res.totais.jurosMora !== 0 && <ResRow label={`Juros de mora (${pct(res.config.jurosMora)} a.m.)`} valor={res.totais.jurosMora} />}
                    {res.totais.multa > 0 && <ResRow label={`Multa (${pct(res.config.multaPct)})`} valor={res.totais.multa} />}
                    {res.totais.honorarios > 0 && (
                      <ResRow
                        label={`Honorários sucumbenciais — ${pct(res.config.honorarios?.percentual)} ${
                          res.config.honorarios?.base === 'fixa'
                            ? `sobre o valor da causa (${brl(res.honorariosBase)})`
                            : res.config.honorarios?.base === 'debitos'
                              ? 'sobre os débitos'
                              : 'sobre o principal'
                        }`}
                        valor={res.totais.honorarios}
                      />
                    )}
                    {res.totais.multa523Moratoria > 0 && <ResRow label="Multa moratória de 10% (art. 523, CPC)" valor={res.totais.multa523Moratoria} />}
                    {res.totais.multa523Honorarios > 0 && <ResRow label="Honorários de 10% (art. 523, CPC)" valor={res.totais.multa523Honorarios} />}
                    <ResRow label="Total geral" valor={res.totais.totalGeral} destaque />
                  </dl>
                </div>

                <div className={`${cardCls} overflow-hidden p-0`}>
                  <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Débitos atualizados</h2>
                  </div>
                  <div className="max-h-[55vh] overflow-auto">
                    <table className="w-full whitespace-nowrap text-right text-[11px]">
                      <thead className="sticky top-0 z-10 bg-zinc-100 align-bottom text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <tr>
                          {['Descrição', 'Termo inicial', 'Valor', 'Fator', 'Corrigido', 'Juros', 'Total'].map((h) => (
                            <th key={h} className="px-2 py-2 font-medium first:text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {[...res.debitos, ...res.creditos.map((c) => ({ ...c, _credito: true }))].map((l, i) => (
                          <tr key={i} className={(l as { _credito?: boolean })._credito ? 'bg-rose-50/50 dark:bg-rose-500/5' : undefined}>
                            <td className="px-2 py-1.5 text-left text-zinc-700 dark:text-zinc-200">
                              {(l as { _credito?: boolean })._credito ? '− ' : ''}{l.descricao}
                            </td>
                            <td className="px-2 py-1.5 text-left text-zinc-500">{l.data.split('-').reverse().join('/')}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{brl(l.valor)}</td>
                            <td className="px-2 py-1.5 text-zinc-400">{l.fator.toFixed(6).replace('.', ',')}</td>
                            <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{brl(l.corrigido)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{l.juros ? brl(l.juros) : '—'}</td>
                            <td className="px-2 py-1.5 font-semibold text-violet-700 dark:text-violet-400">{brl(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItensEditor({
  itens,
  setItens,
  upd,
  placeholderDesc,
}: {
  itens: Linha[];
  setItens: (l: Linha[]) => void;
  upd: (i: number, k: keyof Linha, v: string) => void;
  placeholderDesc: string;
}) {
  return (
    <div className="space-y-2">
      {itens.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_110px_auto] items-center gap-2">
          <input className={inputCls} placeholder={placeholderDesc} value={l.descricao} onChange={(e) => upd(i, 'descricao', e.target.value)} />
          <input type="date" className={inputCls} value={l.data} onChange={(e) => upd(i, 'data', e.target.value)} />
          <input className={inputCls} inputMode="decimal" placeholder="R$" value={l.valor} onChange={(e) => upd(i, 'valor', e.target.value)} />
          <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800" title="Remover">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setItens([...itens, linhaVazia()])} className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
        <Plus className="h-3.5 w-3.5" /> Adicionar verba
      </button>
    </div>
  );
}

function ResRow({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-2.5 last:border-0 odd:bg-zinc-50/60 dark:border-zinc-800 dark:odd:bg-zinc-800/30 ${destaque ? 'bg-violet-50/70 font-semibold dark:bg-violet-500/10' : ''}`}>
      <span className={`text-zinc-600 dark:text-zinc-300 ${destaque ? 'text-zinc-900 dark:text-white' : ''}`}>{label}</span>
      <span className={`shrink-0 tabular-nums ${destaque ? 'text-base text-violet-700 dark:text-violet-300' : valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
        {brl(valor)}
      </span>
    </div>
  );
}
