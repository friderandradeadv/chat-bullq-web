'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator, Loader2, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import {
  calculadoraRmcService,
  type CalcularRmcInput,
  type IndiceCorrecao,
  type ParcelaInput,
} from '@/features/calculadora-rmc/services/calculadora-rmc.service';

const brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const cardCls =
  'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';

/** Normaliza um valor monetário pt-BR ("1.212,00", "60,60", "32.06") em número. */
function parseValor(raw: string): number {
  let s = raw.replace(/r\$|\s/gi, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // BR: ponto=milhar, vírgula=decimal
  return parseFloat(s);
}

/** Normaliza data DD/MM/AAAA ou AAAA-MM-DD em AAAA-MM-DD. */
function parseData(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseParcelas(texto: string): { parcelas: ParcelaInput[]; erros: string[] } {
  const parcelas: ParcelaInput[] = [];
  const erros: string[] = [];
  texto.split('\n').forEach((linha, i) => {
    const t = linha.trim();
    if (!t) return;
    const partes = t.split(/[;,\t]|\s{2,}|\s(?=R\$)|\s(?=\d)/).map((p) => p.trim()).filter(Boolean);
    const data = parseData(partes[0] ?? '');
    const valor = parseValor(partes[1] ?? partes[0] ?? '');
    if (!data || isNaN(valor)) {
      erros.push(`Linha ${i + 1}: "${t}"`);
      return;
    }
    parcelas.push({ data, valor });
  });
  return { parcelas, erros };
}

function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, d || 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

const hoje = new Date().toISOString().slice(0, 10);

export default function CalculadoraRmcPage() {
  const [form, setForm] = useState({
    nomeCalculo: '',
    valorEmprestimo: '',
    taxaConversao: '2.50',
    dobro: true,
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    dataBase: hoje,
    proRataDie: false,
    danosMorais: '',
    honorariosTipo: 'NENHUM' as 'NENHUM' | 'FIXO' | 'PERCENTUAL',
    honorariosValor: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [parcelasTexto, setParcelasTexto] = useState('');
  const [ger, setGer] = useState({ dataInicial: '', valor: '', meses: '12' });
  const { parcelas, erros } = useMemo(() => parseParcelas(parcelasTexto), [parcelasTexto]);

  const gerarParcelas = () => {
    const di = parseData(ger.dataInicial) ?? ger.dataInicial;
    const v = parseValor(ger.valor);
    const n = parseInt(ger.meses, 10);
    if (!parseData(di) || isNaN(v) || !n) return;
    const linhas: string[] = [];
    for (let i = 0; i < n; i++) {
      linhas.push(`${addMonthsISO(di, i)}\t${v.toFixed(2)}`);
    }
    setParcelasTexto((prev) => (prev.trim() ? prev.trim() + '\n' : '') + linhas.join('\n'));
  };

  const calc = useMutation({
    mutationFn: () => {
      const payload: CalcularRmcInput = {
        valorEmprestimo: parseValor(form.valorEmprestimo),
        taxaConversao: Number(form.taxaConversao),
        dobro: form.dobro,
        indiceCorrecao: form.indiceCorrecao,
        dataBase: form.dataBase,
        proRataDie: form.proRataDie,
        danosMorais: form.danosMorais ? parseValor(form.danosMorais) : 0,
        nomeCalculo: form.nomeCalculo || undefined,
        parcelas,
      };
      if (form.honorariosTipo !== 'NENHUM') {
        payload.honorariosTipo = form.honorariosTipo;
        payload.honorariosValor = form.honorariosValor ? parseValor(form.honorariosValor) : 0;
      }
      return calculadoraRmcService.calcular(payload);
    },
  });

  const podeCalcular =
    parseValor(form.valorEmprestimo) > 0 && Number(form.taxaConversao) > 0 && parcelas.length > 0;
  const res = calc.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Cálculo de Revisão da RMC / RCC
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Conversão em empréstimo + restituição em dobro com correção monetária (INPC/IPCA-E ·
            BACEN)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Coluna de entrada ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className={cardCls}>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Contrato</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nome do cálculo</label>
                <input
                  className={inputCls}
                  placeholder="Ex.: RMC - BMG - Fulano"
                  value={form.nomeCalculo}
                  onChange={(e) => set('nomeCalculo', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor do empréstimo (R$)</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="1.212,00"
                    value={form.valorEmprestimo}
                    onChange={(e) => set('valorEmprestimo', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Taxa conversão (% a.m.)</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="2,50"
                    value={form.taxaConversao}
                    onChange={(e) => set('taxaConversao', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Índice de correção</label>
                  <select
                    className={inputCls}
                    value={form.indiceCorrecao}
                    onChange={(e) => set('indiceCorrecao', e.target.value as IndiceCorrecao)}
                  >
                    <option value="INPC">INPC</option>
                    <option value="IPCA-E">IPCA-E</option>
                    <option value="IPCA">IPCA</option>
                    <option value="IGP-M">IGP-M</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Data-base</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.dataBase}
                    onChange={(e) => set('dataBase', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                    checked={form.dobro}
                    onChange={(e) => set('dobro', e.target.checked)}
                  />
                  Restituir em dobro (CDC 42)
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                    checked={form.proRataDie}
                    onChange={(e) => set('proRataDie', e.target.checked)}
                  />
                  Pro rata die
                </label>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
              Danos morais & honorários
            </h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Danos morais (R$)</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.danosMorais}
                  onChange={(e) => set('danosMorais', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Honorários</label>
                  <select
                    className={inputCls}
                    value={form.honorariosTipo}
                    onChange={(e) => set('honorariosTipo', e.target.value as typeof form.honorariosTipo)}
                  >
                    <option value="NENHUM">Nenhum</option>
                    <option value="PERCENTUAL">% sobre o devido</option>
                    <option value="FIXO">Valor fixo</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {form.honorariosTipo === 'FIXO' ? 'Valor (R$)' : 'Percentual (%)'}
                  </label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    disabled={form.honorariosTipo === 'NENHUM'}
                    value={form.honorariosValor}
                    onChange={(e) => set('honorariosValor', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">
              Parcelas descontadas
            </h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Uma por linha: <code>data valor</code> (ex.: <code>01/12/2022 60,60</code>). Use o
              gerador para preencher rápido.
            </p>
            <div className="mb-3 grid grid-cols-[1fr_1fr_70px_auto] items-end gap-2">
              <div>
                <label className={labelCls}>1ª competência</label>
                <input
                  type="date"
                  className={inputCls}
                  value={ger.dataInicial}
                  onChange={(e) => setGer({ ...ger, dataInicial: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Valor</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="60,60"
                  value={ger.valor}
                  onChange={(e) => setGer({ ...ger, valor: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Meses</label>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={ger.meses}
                  onChange={(e) => setGer({ ...ger, meses: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={gerarParcelas}
                className="flex h-[38px] items-center gap-1 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Plus className="h-4 w-4" /> Gerar
              </button>
            </div>
            <textarea
              className={`${inputCls} h-40 font-mono text-xs`}
              placeholder={'01/12/2022\t60,60\n01/01/2023\t60,60\n...'}
              value={parcelasTexto}
              onChange={(e) => setParcelasTexto(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                {parcelas.length} parcela(s) reconhecida(s)
              </span>
              {erros.length > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {erros.length} linha(s) ignorada(s)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!podeCalcular || calc.isPending}
            onClick={() => calc.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {calc.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Calcular restituição
          </button>
          {calc.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {(calc.error as Error)?.message ?? 'Erro ao calcular.'}
            </p>
          )}
        </div>

        {/* ── Coluna de resultado ───────────────────────────────────────── */}
        <div className="space-y-4">
          {!res && (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-center text-sm text-zinc-400 dark:border-zinc-700">
              <Calculator className="mb-2 h-8 w-8 opacity-40" />
              Preencha o contrato e as parcelas e clique em <b className="mx-1">Calcular</b>.
            </div>
          )}

          {res && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Kpi label="Total descontado" valor={res.resumo.totalDebitado} />
                <Kpi label="A restituir (nominal)" valor={res.resumo.somaNominalRestituir} />
                <Kpi label="Restituição corrigida" valor={res.resumo.restituicao} destaque />
                <Kpi label="Danos morais" valor={res.resumo.danosMorais} />
                <Kpi label="Honorários" valor={res.resumo.honorarios} />
                <Kpi label="TOTAL" valor={res.resumo.total} destaque />
              </div>

              <div className={`${cardCls} overflow-hidden p-0`}>
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Evolução do saldo devedor
                  </h2>
                </div>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
                      <tr>
                        {['Nº', 'Data', 'Debitado', 'Saldo ant.', 'Juros', 'Amort.', 'Saldo', 'A restituir', 'Fator', 'Atualizado'].map(
                          (h) => (
                            <th key={h} className="px-2.5 py-2 font-medium first:text-left">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {res.linhas.map((l) => (
                        <tr
                          key={l.numero}
                          className={
                            l.valorRestituir > 0
                              ? 'bg-emerald-50/60 dark:bg-emerald-500/5'
                              : undefined
                          }
                        >
                          <td className="px-2.5 py-1.5 text-left text-zinc-400">{l.numero}</td>
                          <td className="px-2.5 py-1.5 text-left text-zinc-600 dark:text-zinc-300">
                            {l.data.split('-').reverse().join('/')}
                          </td>
                          <td className="px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300">
                            {brl(l.valorDebitado)}
                          </td>
                          <td className="px-2.5 py-1.5 text-zinc-500">{brl(l.saldoAnterior)}</td>
                          <td className="px-2.5 py-1.5 text-zinc-500">{brl(l.juros)}</td>
                          <td className="px-2.5 py-1.5 text-zinc-500">{brl(l.amortizacao)}</td>
                          <td
                            className={`px-2.5 py-1.5 ${l.saldoAtual < 0 ? 'text-red-500' : 'text-zinc-500'}`}
                          >
                            {brl(l.saldoAtual)}
                          </td>
                          <td className="px-2.5 py-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                            {l.valorRestituir ? brl(l.valorRestituir) : '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-zinc-400">
                            {l.fatorCorrecao.toFixed(6)}
                          </td>
                          <td className="px-2.5 py-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                            {l.valorAtualizado ? brl(l.valorAtualizado) : '—'}
                          </td>
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
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        destaque
          ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-bold ${
          destaque ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-900 dark:text-white'
        }`}
      >
        {brl(valor)}
      </div>
    </div>
  );
}
