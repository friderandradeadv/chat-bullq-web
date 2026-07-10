'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Percent, Loader2, AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculadoraRevisionalService as svc,
  type Modalidade,
  type ResultadoRevisional,
  type TaxaMedia,
  type IndiceCorrecao,
} from '@/features/calculadora-revisional/services/calculadora-revisional.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

const fmtBRL = (v: number | null | undefined) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtPct = (v: number | null | undefined, casas = 2) =>
  typeof v === 'number' ? `${v.toFixed(casas).replace('.', ',')}%` : '—';

const INDICES: IndiceCorrecao[] = ['INPC', 'IPCA-E', 'IPCA', 'IGP-M'];

function hojeIso(): string {
  // Client-only; evita depender de Date no SSR.
  return new Date().toISOString().slice(0, 10);
}

export default function RevisionalPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [form, setForm] = useState({
    modalidade: 'pf_pessoal_nao_consignado',
    valorLiberado: '',
    valorParcela: '',
    numeroParcelas: '',
    parcelasPagas: '',
    dataContratacao: '',
    dataBase: '',
    taxaReferenciaManual: '',
    multiplicadorAbusividade: '1',
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    corrigir: true,
    dobro: false,
    modulacaoStj: true,
    jurosMora: '0',
    nomeCalculo: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [avancado, setAvancado] = useState(false);
  const [taxaMedia, setTaxaMedia] = useState<TaxaMedia | null>(null);
  const [res, setRes] = useState<ResultadoRevisional | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [caseId, setCaseId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);

  const modalidadeAtual = useMemo(
    () => modalidades.find((m) => m.key === form.modalidade),
    [modalidades, form.modalidade],
  );
  const semSerie = modalidadeAtual ? !modalidadeAtual.temSerie : false;

  // Carrega modalidades + lê ?case=/?cliente= da URL + data-base padrão = hoje.
  useEffect(() => {
    svc.listarModalidades().then(setModalidades).catch(() => {});
    const sp = new URLSearchParams(window.location.search);
    setCaseId(sp.get('case'));
    const cliente = sp.get('cliente');
    setForm((f) => ({
      ...f,
      dataBase: hojeIso(),
      ...(cliente ? { nomeCalculo: cliente } : {}),
    }));
  }, []);

  // Preview da taxa média do BACEN quando modalidade + data da contratação mudam.
  useEffect(() => {
    if (!form.modalidade || !/^\d{4}-\d{2}-\d{2}$/.test(form.dataContratacao)) {
      setTaxaMedia(null);
      return;
    }
    let vivo = true;
    svc
      .buscarTaxaMedia(form.modalidade, form.dataContratacao)
      .then((t) => vivo && setTaxaMedia(t))
      .catch(() => vivo && setTaxaMedia(null));
    return () => {
      vivo = false;
    };
  }, [form.modalidade, form.dataContratacao]);

  const calcular = async () => {
    setErro(null);
    const valorLiberado = Number(form.valorLiberado);
    const valorParcela = Number(form.valorParcela);
    const numeroParcelas = Number(form.numeroParcelas);
    const manual = form.taxaReferenciaManual ? Number(form.taxaReferenciaManual) : undefined;

    if (!(valorLiberado > 0)) return setErro('Informe o valor liberado (financiado).');
    if (!(valorParcela > 0)) return setErro('Informe o valor da parcela.');
    if (!(numeroParcelas >= 1)) return setErro('Informe o número de parcelas.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataContratacao))
      return setErro('Informe a data da contratação.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataBase)) return setErro('Informe a data-base.');
    if (valorParcela * numeroParcelas <= valorLiberado)
      return setErro(
        'A soma das parcelas não supera o valor liberado — não há juros a revisar. Confira os valores.',
      );
    if (semSerie && manual == null)
      return setErro(
        'Esta modalidade não tem série do BACEN. Informe a taxa de referência manual (em % ao mês) no bloco avançado.',
      );

    setLoading(true);
    setRes(null);
    setSalvouOk(false);
    try {
      const r = await svc.calcular({
        modalidade: form.modalidade,
        valorLiberado,
        valorParcela,
        numeroParcelas,
        parcelasPagas: form.parcelasPagas ? Number(form.parcelasPagas) : undefined,
        dataContratacao: form.dataContratacao,
        dataBase: form.dataBase,
        taxaReferenciaManual: manual,
        multiplicadorAbusividade: Number(form.multiplicadorAbusividade) || 1,
        indiceCorrecao: form.indiceCorrecao,
        corrigir: form.corrigir,
        dobro: form.dobro,
        modulacaoStj: form.modulacaoStj,
        jurosMora: Number(form.jurosMora) || 0,
        nomeCalculo: form.nomeCalculo || undefined,
      });
      setRes(r);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao calcular a revisional.');
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    if (!caseId || !res) return;
    setSalvando(true);
    try {
      await legalCasesService.salvarCalculo(caseId, {
        cenario: 'revisional',
        cenarioTitulo: `Revisional — ${res.modalidade.label}`,
        total: res.resumo.restituicaoAtualizada,
        resumo: res.resumo,
        metodoLabel: `Revisional de juros (${res.modalidade.label})`,
        linhas: res.linhas,
        config: {
          ...res.config,
          modalidade: res.modalidade.label,
          taxas: res.taxas,
          nomeCalculo: form.nomeCalculo,
        },
      });
      try {
        new BroadcastChannel('bullq-calculo').postMessage({ caseId });
      } catch {
        /* sem suporte */
      }
      setSalvouOk(true);
      toast.success('Cálculo salvo no processo ✓');
      setTimeout(() => {
        try {
          window.close();
        } catch {
          /* */
        }
      }, 700);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar no processo');
    } finally {
      setSalvando(false);
    }
  };

  const grupos = useMemo(() => {
    const g: Record<string, Modalidade[]> = {};
    for (const m of modalidades) (g[m.grupo] ??= []).push(m);
    return g;
  }, [modalidades]);

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <Link
            href="/juridico/calculos"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" /> Calculadoras
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Revisional de contratos bancários
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Compara a taxa real do contrato com a taxa média do BACEN e monta a planilha de
                restituição.
              </p>
            </div>
          </div>
        </div>

        {/* ── Formulário ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Modalidade de crédito" className="sm:col-span-2">
              <select
                value={form.modalidade}
                onChange={(e) => set('modalidade', e.target.value)}
                className={inputCls}
              >
                {Object.entries(grupos).map(([grupo, items]) => (
                  <optgroup key={grupo} label={grupo}>
                    {items.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Valor liberado / financiado (R$)">
              <input
                type="number"
                inputMode="decimal"
                value={form.valorLiberado}
                onChange={(e) => set('valorLiberado', e.target.value)}
                placeholder="Ex.: 5000"
                className={inputCls}
              />
            </Field>
            <Field label="Valor da parcela (R$)">
              <input
                type="number"
                inputMode="decimal"
                value={form.valorParcela}
                onChange={(e) => set('valorParcela', e.target.value)}
                placeholder="Ex.: 350"
                className={inputCls}
              />
            </Field>
            <Field label="Nº total de parcelas">
              <input
                type="number"
                inputMode="numeric"
                value={form.numeroParcelas}
                onChange={(e) => set('numeroParcelas', e.target.value)}
                placeholder="Ex.: 24"
                className={inputCls}
              />
            </Field>
            <Field label="Parcelas já pagas (opcional)" hint="Vazio = todas. Base da restituição.">
              <input
                type="number"
                inputMode="numeric"
                value={form.parcelasPagas}
                onChange={(e) => set('parcelasPagas', e.target.value)}
                placeholder="Ex.: 12"
                className={inputCls}
              />
            </Field>
            <Field label="Data da contratação">
              <input
                type="date"
                value={form.dataContratacao}
                onChange={(e) => set('dataContratacao', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Data-base (correção até)">
              <input
                type="date"
                value={form.dataBase}
                onChange={(e) => set('dataBase', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Preview da taxa média do BACEN */}
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
            {semSerie ? (
              <span className="text-blue-800 dark:text-blue-300">
                Modalidade sem série do BACEN (crédito direcionado) — informe a{' '}
                <b>taxa de referência manual</b> no bloco avançado.
              </span>
            ) : !form.dataContratacao ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                Informe a data da contratação para buscar a taxa média do BACEN.
              </span>
            ) : taxaMedia == null ? (
              <span className="text-zinc-500 dark:text-zinc-400">Buscando taxa do BACEN…</span>
            ) : taxaMedia.taxa != null ? (
              <span className="text-blue-800 dark:text-blue-300">
                Taxa média do BACEN ({taxaMedia.mes}):{' '}
                <b>{fmtPct(taxaMedia.taxa)} a.m.</b> — {taxaMedia.fonte}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                {taxaMedia.mensagem || 'Sem taxa do BACEN para essa data — informe manualmente.'}
              </span>
            )}
          </div>

          {/* Avançado */}
          <button
            onClick={() => setAvancado((v) => !v)}
            className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {avancado ? '− Opções avançadas' : '+ Opções avançadas'}
          </button>
          {avancado && (
            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800">
              <Field
                label="Taxa de referência manual (% a.m.)"
                hint="Sobrepõe o BACEN. Obrigatória p/ crédito direcionado (ex.: Pronampe)."
              >
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.taxaReferenciaManual}
                  onChange={(e) => set('taxaReferenciaManual', e.target.value)}
                  placeholder="Ex.: 1.80"
                  className={inputCls}
                />
              </Field>
              <Field
                label="Multiplicador de abusividade"
                hint="1,0 = limita à taxa média. Alguns juízos admitem 1,5×."
              >
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.multiplicadorAbusividade}
                  onChange={(e) => set('multiplicadorAbusividade', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Índice de correção">
                <select
                  value={form.indiceCorrecao}
                  onChange={(e) => set('indiceCorrecao', e.target.value as IndiceCorrecao)}
                  className={inputCls}
                >
                  {INDICES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Juros de mora (% a.m.)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.jurosMora}
                  onChange={(e) => set('jurosMora', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Check
                  label="Corrigir monetariamente a restituição"
                  checked={form.corrigir}
                  onChange={(v) => set('corrigir', v)}
                />
                <Check
                  label="Restituir em dobro o que foi pago a mais (CDC 42, §ún.)"
                  checked={form.dobro}
                  onChange={(v) => set('dobro', v)}
                />
                <Check
                  label="Modular o dobro pelo marco do STJ (30/03/2021)"
                  checked={form.modulacaoStj}
                  onChange={(v) => set('modulacaoStj', v)}
                />
              </div>
            </div>
          )}

          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
            </div>
          )}

          <button
            onClick={calcular}
            disabled={loading}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Calculando…' : 'Calcular revisional'}
          </button>
        </div>

        {/* ── Resultado ──────────────────────────────────────────────── */}
        {res && (
          <div className="mt-6 space-y-5">
            {/* Taxas */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card
                titulo="Taxa do contrato"
                valor={`${fmtPct(res.taxas.contratoMensalPct)} a.m.`}
                sub={`${fmtPct(res.taxas.contratoAnualPct, 1)} a.a. (CET)`}
                tone={res.taxas.abusivo ? 'danger' : 'neutral'}
              />
              <Card
                titulo="Taxa de referência"
                valor={`${fmtPct(res.taxas.referenciaMensalPct)} a.m.`}
                sub={
                  res.taxas.taxaMediaBacenPct != null
                    ? `Média ${fmtPct(res.taxas.taxaMediaBacenPct)} × ${res.taxas.multiplicador}`
                    : res.taxas.fonte
                }
                tone="neutral"
              />
              <Card
                titulo={res.taxas.abusivo ? 'Excedente sobre a média' : 'Dentro da média'}
                valor={
                  res.taxas.excedentePct != null && res.taxas.abusivo
                    ? `+${fmtPct(res.taxas.excedentePct, 0)}`
                    : '—'
                }
                sub={res.taxas.abusivo ? 'Taxa acima do parâmetro' : 'Sem abusividade aparente'}
                tone={res.taxas.abusivo ? 'danger' : 'ok'}
              />
            </div>

            {/* Resumo financeiro */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-white">
                Resumo — {res.modalidade.label}
              </div>
              <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row label="Parcela cobrada" valor={fmtBRL(res.resumo.parcelaContrato)} />
                <Row label="Parcela justa (taxa de referência)" valor={fmtBRL(res.resumo.parcelaRecalculada)} />
                <Row label="Diferença por parcela" valor={fmtBRL(res.resumo.diferencaParcela)} />
                <Row label="Total pago a mais (nominal)" valor={fmtBRL(res.resumo.totalPagoAMais)} />
                <Row label="Economia no contrato inteiro" valor={fmtBRL(res.resumo.economiaTotal)} />
                {res.config.corrigir && (
                  <Row label="Restituição corrigida" valor={fmtBRL(res.resumo.restituicaoCorrigida)} />
                )}
                <Row
                  label={
                    res.config.dobro
                      ? 'Restituição atualizada (em dobro, CDC 42)'
                      : 'Restituição atualizada'
                  }
                  valor={fmtBRL(res.resumo.restituicaoAtualizada)}
                  destaque
                />
              </dl>
              {caseId && (
                <div className="border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
                  {salvouOk ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Salvo no processo
                    </span>
                  ) : (
                    <button
                      onClick={salvar}
                      disabled={salvando}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar no processo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Planilha de descumprimento */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-white">
                Planilha de descumprimento contratual
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Vencimento</th>
                      <th className="px-4 py-2 text-right font-medium">Parcela cobrada</th>
                      <th className="px-4 py-2 text-right font-medium">Parcela justa</th>
                      <th className="px-4 py-2 text-right font-medium">Diferença</th>
                      <th className="px-4 py-2 text-right font-medium">Restituir (atual.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.linhas.map((l) => (
                      <tr
                        key={l.numero}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                      >
                        <td className="px-4 py-1.5 text-zinc-500 dark:text-zinc-400">{l.numero}</td>
                        <td className="px-4 py-1.5">
                          {l.data.split('-').reverse().join('/')}
                          {l.paga && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              paga
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right">{fmtBRL(l.parcelaContrato)}</td>
                        <td className="px-4 py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                          {fmtBRL(l.parcelaRecalculada)}
                        </td>
                        <td className="px-4 py-1.5 text-right">{fmtBRL(l.diferenca)}</td>
                        <td className="px-4 py-1.5 text-right font-medium">
                          {l.paga && l.valorAtualizado > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {fmtBRL(l.valorAtualizado)}
                              {l.dobroAplicado && (
                                <span className="ml-1 text-[10px] text-zinc-400">2×</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="px-1 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
              Estimativa técnica para instrução. A taxa do contrato é a taxa efetiva mensal implícita
              (valor liberado × parcela × prazo); a taxa de referência é a média do BACEN da modalidade
              na época (SGS). Não substitui perícia contábil nem garante o resultado da ação.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-blue-600 dark:border-zinc-600"
      />
      {label}
    </label>
  );
}

function Card({
  titulo,
  valor,
  sub,
  tone,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  tone: 'neutral' | 'danger' | 'ok';
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-zinc-900 dark:text-white';
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{titulo}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</div>}
    </div>
  );
}

function Row({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className={`text-sm ${destaque ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
        {label}
      </dt>
      <dd className={`text-sm ${destaque ? 'text-lg font-bold text-emerald-600 dark:text-emerald-400' : 'font-medium text-zinc-900 dark:text-zinc-100'}`}>
        {valor}
      </dd>
    </div>
  );
}
