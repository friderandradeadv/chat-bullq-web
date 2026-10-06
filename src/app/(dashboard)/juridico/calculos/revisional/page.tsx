'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Percent, Loader2, AlertTriangle, CheckCircle2, Save, FileText, Upload, Presentation, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculadoraRevisionalService as svc,
  type Modalidade,
  type ResultadoRevisional,
  type TaxaMedia,
  type IndiceCorrecao,
  type AuditoriaContrato,
  type ExtracaoContrato,
  type IrregularidadeContrato,
} from '@/features/calculadora-revisional/services/calculadora-revisional.service';
import { DropZone } from '@/components/drop-zone';
import type { DadosApresentacaoRevisional } from '@/features/calculadora-revisional/components/apresentacao-vendas-revisional';
import { porTese, proveitoTotal, brlNum } from '@/features/calculadora-revisional/proveito';
import { PREFIXO_DOC, type PayloadDocumentoRevisional } from '@/features/calculadora-revisional/documento-payload';
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

  // ── Leitura do contrato (PDF) ───────────────────────────────────────────
  const [lendo, setLendo] = useState(false);
  const [extraido, setExtraido] = useState<ExtracaoContrato | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaContrato | null>(null);
  const [irregs, setIrregs] = useState<IrregularidadeContrato[]>([]);
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null);

  const lerContrato = async (file?: File) => {
    if (!file) return;
    setLendo(true);
    setAvisoLeitura(null);
    setExtraido(null);
    setAuditoria(null);
    setIrregs([]);
    try {
      const b64 = await new Promise<string>((ok, falha) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(',')[1] ?? '');
        fr.onerror = falha;
        fr.readAsDataURL(file);
      });
      const r = await svc.extrairContrato(b64, file.name);
      setExtraido(r.extraido);
      setAuditoria(r.auditoria);
      setIrregs(r.irregularidades);

      const e = r.extraido;
      setForm((f) => ({
        ...f,
        ...(e.modalidade ? { modalidade: e.modalidade } : {}),
        ...(e.valorFinanciado ? { valorLiberado: String(e.valorFinanciado) } : {}),
        ...(e.valorParcela ? { valorParcela: String(e.valorParcela) } : {}),
        ...(e.numeroParcelas ? { numeroParcelas: String(e.numeroParcelas) } : {}),
        ...(e.dataContratacao ? { dataContratacao: e.dataContratacao } : {}),
        ...(e.numeroParcelas && (e.primeiroVencimento || e.dataContratacao)
          ? { parcelasPagas: String(vencidasAte(e.primeiroVencimento ?? e.dataContratacao!, e.numeroParcelas)) }
          : {}),
        ...(e.banco && !f.nomeCalculo ? { nomeCalculo: e.banco } : {}),
      }));

      if (r.resumo.faltando.length) {
        setAvisoLeitura(
          `Não achei no contrato: ${r.resumo.faltando.join(', ')}. Preencha à mão — nada foi estimado.`,
        );
        toast.warning('Contrato lido em parte — confira os campos.');
      } else {
        toast.success(
          r.resumo.via === 'visao'
            ? 'Contrato lido por imagem (escaneado) — confira os campos.'
            : 'Contrato lido ✓ — confira os campos antes de calcular.',
        );
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler o contrato. Tente de novo.');
    } finally {
      setLendo(false);
    }
  };

  /**
   * Abre o documento em ABA PRÓPRIA. O payload vai por localStorage (a query
   * string levaria dado do cliente para o histórico do navegador); a aba nova
   * recebe só a chave. Guarda no máximo 8 documentos para a chave não crescer
   * sem fim.
   */
  const abrirDoc = (tipo: PayloadDocumentoRevisional['tipo']) => {
    if (!res) return;
    try {
      const antigas = Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO_DOC)).sort();
      for (const k of antigas.slice(0, Math.max(0, antigas.length - 7))) localStorage.removeItem(k);
      const chave = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload: PayloadDocumentoRevisional = {
        tipo,
        nome: form.nomeCalculo,
        res,
        auditoria,
        extraido,
        irregs,
        dadosApresentacao: dadosApresentacao(),
      };
      localStorage.setItem(PREFIXO_DOC + chave, JSON.stringify(payload));
      const aba = window.open(`/documentos/revisional?k=${encodeURIComponent(chave)}`, '_blank');
      if (!aba) toast.error('O navegador bloqueou a aba. Libere o pop-up para este site.');
    } catch {
      toast.error('Não consegui abrir o documento.');
    }
  };

  /**
   * Dados da apresentação de vendas. O proveito sai do que o cálculo tem, mas é
   * EDITÁVEL lá dentro: em contrato sem abusividade de juros, o proveito vem das
   * rubricas (seguros, tarifas), que o motor da revisional não soma sozinho.
   */
  const dadosApresentacao = (): DadosApresentacaoRevisional | null => {
    if (!res) return null;
    const afastadas: { o: string; porque: string }[] = [];
    if (!res.taxas.abusivo)
      afastadas.push({ o: 'Juros do contrato', porque: `o contrato cobra ${fmtPct(res.taxas.contratoMensalPct)} ao mês contra a média de ${fmtPct(res.taxas.referenciaMensalPct)} do Banco Central — está abaixo do mercado` });
    if (auditoria?.capitalizacao.pactuada === true)
      afastadas.push({ o: 'Capitalização de juros', porque: 'o contrato pactuou a capitalização de forma expressa, o que as Súmulas 539 e 541 do STJ admitem' });
    if (auditoria?.divergenciaTaxa && auditoria.divergenciaTaxa.diferencaPp <= 0.01)
      afastadas.push({ o: 'Taxa diferente da escrita', porque: 'a parcela cobrada bate com a taxa do contrato' });
    if (auditoria?.divergenciaCet && auditoria.divergenciaCet.diferencaPp <= 0)
      afastadas.push({ o: 'Custo Efetivo Total', porque: 'o banco informou o CET a maior que o apurado, não a menor' });
    for (const x of irregs.filter((y) => y.somavel === false && !brlNum(y.valor)))
      afastadas.push({ o: x.rubrica || x.tipo, porque: 'sem valor apurável com os documentos de hoje' });

    const teses = irregs
      .filter((x) => x.somavel !== false && brlNum(x.valor) > 0)
      .map((x) => {
        const t = porTese(res, brlNum(x.valor));
        return { rubrica: x.rubrica || x.tipo, cobrado: t.principal, recebe: Math.round(t.proveito), forca: x.confianca };
      });
    const economiaFuturaJuros = Math.max(0, res.resumo.economiaTotal - res.resumo.totalPagoAMais);
    if (res.taxas.abusivo)
      teses.unshift({
        rubrica: 'Juros acima da média de mercado',
        cobrado: 0,
        recebe: Math.round(res.resumo.restituicaoAtualizada + economiaFuturaJuros),
        forca: 'alta',
      });

    // 🚨 OS TRÊS NÚMEROS TÊM DE FECHAR. Restituição + economia futura = proveito,
    // e a parcela nova sai do principal LIMPO — não do `res.resumo`, que é só da
    // tese de juros e, em contrato abaixo da média, devolve parcela MAIOR.
    const principalIndevido = irregs
      .filter((x) => x.somavel !== false)
      .reduce((s2, x) => s2 + brlNum(x.valor), 0);
    const tot = proveitoTotal(res, principalIndevido);
    return {
      cliente: form.nomeCalculo || 'Cliente',
      credor: extraido?.banco || res.modalidade.label,
      contrato: extraido?.numeroContrato || '—',
      proveito: Math.round(tot.proveito),
      parcelaAtual: tot.parcelaAtual,
      parcelaNova: tot.parcelaNova,
      restituicao: Math.round(tot.restituicao),
      economiaFutura: Math.round(tot.economiaFutura),
      afastadas,
      teses,
    };
  };

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
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          {/* ── Contrato em PDF: a IA transcreve, a conta é determinística ── */}
          <DropZone
            accept="application/pdf,.pdf"
            multiple={false}
            disabled={lendo}
            overlayLabel="Solte o contrato (PDF) aqui"
            className="mb-5"
            onFiles={(fs) => lerContrato(fs[0])}
          >
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/20">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={lendo}
                onChange={(e) => lerContrato(e.target.files?.[0] ?? undefined)}
              />
              {lendo ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {lendo ? 'Lendo o contrato… (pode levar 1–2 min)' : 'Arraste o contrato (PDF) aqui ou clique para escolher'}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                A IA só transcreve os campos do instrumento — a conta é determinística. Campo não lido fica em branco, nunca estimado.
              </span>
            </label>
          </DropZone>

          {avisoLeitura && (
            <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {avisoLeitura}
            </p>
          )}

          {auditoria && <PainelAuditoria a={auditoria} e={extraido} irregs={irregs} />}

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
          {/* 🚨 `block`: este botão e o "Calcular" são inline-flex e fluíam na MESMA
              linha, um por cima do outro — defeito visível desde a 1ª tela. */}
          <button
            onClick={() => setAvancado((v) => !v)}
            className="mt-4 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {avancado ? '− Opções avançadas' : '+ Opções avançadas'}
          </button>
          {avancado && (
            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-700">
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

          <div className="mt-5">
            <button
              onClick={calcular}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Calculando…' : 'Calcular revisional'}
            </button>
          </div>
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
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white">
                Resumo — {res.modalidade.label}
              </div>
              <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row label="Parcela cobrada" valor={fmtBRL(res.resumo.parcelaContrato)} />
                <Row label="Parcela justa (taxa de referência)" valor={fmtBRL(res.resumo.parcelaRecalculada)} />
                <Row label="Diferença por parcela" valor={fmtBRL(res.resumo.diferencaParcela)} />
                <Row label="Total pago a mais (nominal)" valor={fmtBRL(res.resumo.totalPagoAMais)} />
                <Row label="Economia no contrato inteiro" valor={fmtBRL(res.resumo.economiaTotal)} numero={res.resumo.economiaTotal} />
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
                  numero={res.resumo.restituicaoAtualizada}
                  destaque
                />
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-700">
                <button
                  onClick={() => abrirDoc('calculo')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FileText className="h-4 w-4" /> Memória de cálculo
                </button>
                <button
                  onClick={() => abrirDoc('apresentacao')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#B7791F] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  <Presentation className="h-4 w-4" /> Apresentação ao cliente
                </button>
                <button
                  onClick={() => abrirDoc('parecer')}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ClipboardCheck className="h-4 w-4" /> Parecer interno
                </button>
                <span className="w-full text-xs text-zinc-400 sm:w-auto">abrem em outra aba · cálculo e apresentação vão ao cliente, o parecer é só nosso</span>
              </div>
              {caseId && (
                <div className="border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-700">
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
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white">
                Planilha de descumprimento contratual
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="px-4 py-1.5 text-zinc-500 dark:text-zinc-400">{l.numero}</td>
                        <td className="px-4 py-1.5 text-zinc-700 dark:text-zinc-200">
                          {l.data.split('-').reverse().join('/')}
                          {l.paga && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              paga
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{fmtBRL(l.parcelaContrato)}</td>
                        <td className="px-4 py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                          {fmtBRL(l.parcelaRecalculada)}
                        </td>
                        <td className="px-4 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{fmtBRL(l.diferenca)}</td>
                        <td className="px-4 py-1.5 text-right font-medium">
                          {l.paga && l.valorAtualizado > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {fmtBRL(l.valorAtualizado)}
                              {l.dobroAplicado && (
                                <span className="ml-1 text-[10px] text-zinc-400">2×</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
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
        className="h-4 w-4 rounded border-zinc-300 accent-blue-600 text-blue-600 dark:border-zinc-500 dark:bg-zinc-900"
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{titulo}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</div>}
    </div>
  );
}

/**
 * 🚨 COR AQUI É AFIRMAÇÃO, NÃO ENFEITE. Verde pintado num total ZERO dizia
 * "ganhamos" num contrato em que não há o que restituir; e "economia" negativa
 * (contrato mais barato que a média do BACEN) saía na cor do texto comum, como
 * se fosse um resultado qualquer. Verde só quando há valor; âmbar quando o
 * número contraria a tese.
 */
function Row({
  label,
  valor,
  destaque,
  numero,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
  /** valor numérico, quando a cor depende do sinal/zero */
  numero?: number;
}) {
  const positivo = numero == null || numero > 0;
  const negativo = numero != null && numero < 0;
  const corValor = destaque
    ? positivo
      ? 'text-lg font-bold text-emerald-600 dark:text-emerald-400'
      : 'text-lg font-bold text-zinc-500 dark:text-zinc-400'
    : negativo
      ? 'font-medium text-amber-600 dark:text-amber-400'
      : 'font-medium text-zinc-900 dark:text-zinc-100';
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className={`text-sm ${destaque ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
        {label}
      </dt>
      <dd className={`text-sm ${corValor}`}>{valor}</dd>
    </div>
  );
}

/** Parcelas já vencidas até hoje, a partir do 1º vencimento (cap em n). */
function vencidasAte(primeiroVencimento: string, n: number): number {
  const [ay, am, ad] = primeiroVencimento.split('-').map(Number);
  if (!ay || !am) return 0;
  const hoje = new Date();
  let meses = (hoje.getFullYear() - ay) * 12 + (hoje.getMonth() + 1 - am);
  if (hoje.getDate() >= (ad || 1)) meses += 1; // a do mês corrente já venceu
  return Math.max(0, Math.min(n, meses));
}

/**
 * O que o contrato DIZ × o que ele FAZ. Aparece depois de ler o PDF e antes do
 * cálculo — é a conferência que o advogado faz com o instrumento na mão.
 */
function PainelAuditoria({
  a,
  e,
  irregs,
}: {
  a: AuditoriaContrato;
  e: ExtracaoContrato | null;
  irregs: IrregularidadeContrato[];
}) {
  const cap = a.capitalizacao;
  return (
    <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Auditoria do contrato
          {e?.banco ? <span className="font-normal text-zinc-500"> — {e.banco}</span> : null}
          {e?.numeroContrato ? <span className="font-normal text-zinc-400"> · {e.numeroContrato}</span> : null}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell
          titulo="Taxa escrita"
          valor={a.divergenciaTaxa ? fmtPct(a.divergenciaTaxa.escritaPct) : '—'}
          sub="a.m., como no contrato"
        />
        <Cell
          titulo="Taxa praticada"
          valor={fmtPct(a.taxaPeriodicaMensalPct)}
          sub="a.m., pela parcela cobrada"
          alerta={!!a.divergenciaTaxa && a.divergenciaTaxa.diferencaPp > 0.01}
        />
        <Cell
          titulo="CET apurado"
          valor={fmtPct(a.cetAnualPct)}
          sub={
            a.divergenciaCet
              ? `a.a. · contrato diz ${fmtPct(a.divergenciaCet.escritaPct)}`
              : 'a.a., sobre o líquido liberado'
          }
          alerta={!!a.divergenciaCet && a.divergenciaCet.diferencaPp > 0.1}
        />
        <Cell
          titulo="Líquido liberado"
          valor={fmtBRL(a.valorLiberadoLiquido)}
          sub={a.encargosTotais > 0 ? `${fmtBRL(a.encargosTotais)} de encargos` : 'sem encargos lidos'}
          alerta={a.encargosTotais > 0}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <p className="text-zinc-600 dark:text-zinc-300">
          <span className="font-medium">Carência:</span> {a.carenciaDias} dias até a 1ª parcela
          {a.carenciaDias > 32 ? ' — prazo extra embute juros.' : '.'}
        </p>
        <p className="text-zinc-600 dark:text-zinc-300">
          <span className="font-medium">Capitalização:</span>{' '}
          {cap.pactuada === null
            ? 'taxas do contrato não lidas — teste do duodécuplo não aplicado.'
            : cap.pactuada
              ? `pactuada (anual ${fmtPct(cap.anualContratadaPct)} > duodécuplo ${fmtPct(cap.duodecuploPct)}).`
              : `SEM pactuação expressa (anual ${fmtPct(cap.anualContratadaPct)} ≤ duodécuplo ${fmtPct(cap.duodecuploPct)}) — Súmulas 539 e 541/STJ.`}
        </p>
      </div>

      {irregs.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          {irregs.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="text-zinc-600 dark:text-zinc-300">
                <b className="text-zinc-800 dark:text-zinc-100">{i.tipo}</b>
                {i.valor ? <span className="text-amber-600 dark:text-amber-400"> · {i.valor}</span> : null}
                <br />
                {i.fundamento}
              </span>
            </li>
          ))}
        </ul>
      )}

      {e?.observacoes && (
        <p className="mt-3 border-t border-zinc-200 pt-2 text-[11px] text-zinc-400 dark:border-zinc-700">
          Leitura: {e.observacoes}
        </p>
      )}
    </div>
  );
}

function Cell({
  titulo,
  valor,
  sub,
  alerta,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{titulo}</div>
      <div
        className={`mt-0.5 text-base font-semibold tabular-nums ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}
      >
        {valor}
      </div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  );
}
