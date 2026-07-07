'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calculator,
  FileDown,
  FileText,
  Gavel,
  Info,
  Loader2,
  Plus,
  ShieldAlert,
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
import { gerarPdfCs } from '@/features/calculadora-cs/lib/pdf';
import { DropZone } from '@/components/drop-zone';

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

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Descontos mensais posteriores ao cálculo da inicial (tutela NÃO deferida):
 * gera uma verba por mês, do mês seguinte ao último desconto até o termo final.
 */
function gerarDescontosPosteriores(
  ultimoDesconto: string,
  termoFinal: string,
  valor: number,
): { descricao: string; data: string; valor: number }[] {
  const [y0, m0, d0] = ultimoDesconto.split('-').map(Number);
  const [yF, mF, dF] = termoFinal.split('-').map(Number);
  const out: { descricao: string; data: string; valor: number }[] = [];
  let y = y0;
  let m = m0;
  for (let i = 0; i < 600; i++) {
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    const ultimoDia = new Date(y, m, 0).getDate();
    const d = Math.min(d0, ultimoDia);
    if (y > yF || (y === yF && (m > mF || (m === mF && d > dF)))) break;
    out.push({
      descricao: `Desconto ${pad2(m)}/${y} — após a inicial`,
      data: `${y}-${pad2(m)}-${pad2(d)}`,
      valor,
    });
  }
  return out;
}

export default function CumprimentoSentencaPage() {
  const [form, setForm] = useState({
    modo: 'condenacao' as 'condenacao' | 'obrigacaoFazer',
    nomeCalculo: '',
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    termoFinal: hoje,
    proRataDie: false,
    jurosMora: '1,00',
    jurosInicial: 'vencimento', // 'vencimento' | data
    multaPct: '0',
    honPercentual: '10',
    honBase: 'diferenca' as HonorariosBase | 'valorFixado' | 'condenacao',
    honQuantiaFixa: '',
    honAtualizar: false,
    honQuantiaData: '',
    honValorFixado: '',
    honValorCondenacao: '',
    multa523Mor: false,
    multa523Hon: false,
    tutelaDeferida: true,
    descontoMensal: '',
    ultimoDesconto: '',
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
      // Sem condenação líquida (débitos vazios) = obrigação de fazer → o que se
      // executa são só os honorários; com condenação, modo normal por débitos.
      const semCondenacao = !(e.debitos?.length);
      setForm((f) => ({
        ...f,
        modo: semCondenacao ? 'obrigacaoFazer' : 'condenacao',
        nomeCalculo: e.nomeCalculo || f.nomeCalculo,
        indiceCorrecao: e.indiceCorrecao || f.indiceCorrecao,
        jurosMora: e.jurosMora != null ? String(e.jurosMora).replace('.', ',') : f.jurosMora,
        jurosInicial:
          e.jurosInicial && /^\d{4}-\d{2}-\d{2}$/.test(e.jurosInicial)
            ? e.jurosInicial
            : 'vencimento',
        honPercentual: e.honorarios ? String(e.honorarios.percentual).replace('.', ',') : f.honPercentual,
        honBase: semCondenacao
          ? e.valorCausa != null
            ? 'fixa'
            : 'valorFixado'
          : (e.honorarios?.base ?? f.honBase),
        honQuantiaFixa:
          e.valorCausa != null && (semCondenacao || e.honorarios?.base === 'fixa')
            ? String(e.valorCausa).replace('.', ',')
            : f.honQuantiaFixa,
        // Tutela: só "deferida" se a sentença AFIRMA a suspensão dos descontos;
        // no silêncio, assume que continuaram (padrão do cumprimento).
        tutelaDeferida: e.tutelaDeferida === true,
        honQuantiaData: f.honQuantiaData || (e.dataSentenca ?? ''),
        // Multas do art. 523 NÃO são pré-marcadas pela IA: só incidem depois de
        // esgotado o prazo de 15 dias sem pagamento — decisão do advogado.
      }));
      setIaAviso(
        (semCondenacao
          ? 'Sem condenação líquida na sentença → selecionei "Obrigação de fazer — só sucumbência" (honorários como principal). Confira antes de calcular.'
          : (r.aviso ?? `IA preencheu ${e.debitos?.length ?? 0} verba(s). Confira antes de calcular.`)) +
          (e.tutelaDeferida !== true
            ? ' Tutela NÃO deferida: os descontos continuaram — preencha o desconto mensal no card da tutela.'
            : ''),
      );
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
  // Tutela NÃO deferida → descontos continuaram: verbas mensais até o termo final
  const descontosExtras = useMemo(() => {
    if (form.tutelaDeferida) return [];
    const v = parseValor(form.descontoMensal);
    if (!form.ultimoDesconto || !form.termoFinal || isNaN(v) || v <= 0) return [];
    return gerarDescontosPosteriores(form.ultimoDesconto, form.termoFinal, v);
  }, [form.tutelaDeferida, form.descontoMensal, form.ultimoDesconto, form.termoFinal]);

  // Obrigação de fazer: o valor executável são os próprios honorários — eles
  // viram o único "débito" (corrigido + juros), e a multa do 523 incide sobre eles.
  const honExecucaoValor = useMemo(() => {
    if (form.honBase === 'valorFixado') return parseValor(form.honValorFixado) || 0;
    const p = parseValor(form.honPercentual) || 0;
    const base =
      form.honBase === 'condenacao'
        ? parseValor(form.honValorCondenacao) || 0
        : parseValor(form.honQuantiaFixa) || 0;
    return Math.round(((p / 100) * base + Number.EPSILON) * 100) / 100;
  }, [form.honBase, form.honValorFixado, form.honPercentual, form.honQuantiaFixa, form.honValorCondenacao]);

  const [calcInfo, setCalcInfo] = useState<{
    honFixado: boolean;
    descontosExtras: number;
    modo: 'condenacao' | 'obrigacaoFazer';
  } | null>(null);
  const calc = useMutation({
    mutationFn: () => {
      const lin = (l: Linha) => ({ descricao: l.descricao || 'Item', data: l.data, valor: parseValor(l.valor) });
      const jmInicial = /^\d{4}-\d{2}-\d{2}$/.test(form.jurosInicial) ? form.jurosInicial : 'vencimento';
      if (form.modo === 'obrigacaoFazer') {
        const payload: CalcularCsInput = {
          nomeCalculo: form.nomeCalculo || undefined,
          indiceCorrecao: form.indiceCorrecao,
          termoFinal: form.termoFinal,
          proRataDie: form.proRataDie,
          jurosMora: parseValor(form.jurosMora) || 0,
          jurosInicial: jmInicial,
          multaPct: 0,
          multaMoratoria523: form.multa523Mor,
          honorarios523: form.multa523Hon,
          debitos: [
            {
              descricao:
                form.honBase === 'fixa'
                  ? `Honorários sucumbenciais (${form.honPercentual}% sobre o valor da causa)`
                  : form.honBase === 'condenacao'
                    ? `Honorários sucumbenciais (${form.honPercentual}% sobre a condenação)`
                    : 'Honorários sucumbenciais fixados',
              data:
                form.honAtualizar && form.honQuantiaData ? form.honQuantiaData : form.termoFinal,
              valor: honExecucaoValor,
            },
          ],
          creditos: [],
        };
        setCalcInfo({ honFixado: false, descontosExtras: 0, modo: 'obrigacaoFazer' });
        return calculadoraCsService.calcular(payload);
      }
      const payload: CalcularCsInput = {
        nomeCalculo: form.nomeCalculo || undefined,
        indiceCorrecao: form.indiceCorrecao,
        termoFinal: form.termoFinal,
        proRataDie: form.proRataDie,
        jurosMora: parseValor(form.jurosMora) || 0,
        jurosInicial: jmInicial,
        multaPct: parseValor(form.multaPct) || 0,
        honorarios:
          form.honBase === 'valorFixado'
            ? parseValor(form.honValorFixado) > 0
              ? {
                  // valor certo: o motor aplica 100% sobre a "quantia fixa"
                  percentual: 100,
                  base: 'fixa',
                  quantiaFixa: parseValor(form.honValorFixado),
                  atualizarQuantia: form.honAtualizar,
                  quantiaData:
                    form.honAtualizar && form.honQuantiaData ? form.honQuantiaData : undefined,
                }
              : undefined
            : parseValor(form.honPercentual) > 0
              ? {
                  percentual: parseValor(form.honPercentual),
                  // 'condenacao' só existe no modo obrigação de fazer; se sobrou no
                  // estado, cai no padrão (sobre o principal corrigido).
                  base: form.honBase === 'condenacao' ? 'diferenca' : form.honBase,
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
        debitos: [...debitos.filter((d) => d.data && parseValor(d.valor) > 0).map(lin), ...descontosExtras],
        creditos: creditos.filter((c) => c.data && parseValor(c.valor) > 0).map(lin),
      };
      setCalcInfo({ honFixado: form.honBase === 'valorFixado', descontosExtras: descontosExtras.length, modo: 'condenacao' });
      return calculadoraCsService.calcular(payload);
    },
  });
  const res = calc.data;
  const podeCalcular =
    form.modo === 'obrigacaoFazer'
      ? !!form.termoFinal && honExecucaoValor > 0
      : debitosValidos.length > 0 && !!form.termoFinal;

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
            {/* Caso RMC/RCC → calculadora própria em modo execução */}
            <Link
              href="/juridico/calculos/rmc-rcc?fase=cs"
              className="flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs leading-relaxed text-blue-800 transition-colors hover:bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Caso de RMC/RCC?</b> Use a calculadora RMC/RCC no modo{' '}
                <b>Cumprimento de sentença</b> — lá você importa HISCON/HISCRE, responde a tutela e
                o saldo já sai recalculado. Esta página serve para qualquer outra condenação.
              </span>
            </Link>

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
              <DropZone accept="application/pdf,.pdf" disabled={iaMut.isPending} onFiles={(fs) => { setIaAviso(null); iaMut.mutate(fs); }} overlayLabel="Solte a sentença / inicial aqui">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={iaMut.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 py-2.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/15"
                >
                  {iaMut.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Lendo os documentos…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Enviar ou arrastar PDF(s) da sentença / inicial</>
                  )}
                </button>
              </DropZone>
              {iaAviso && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{iaAviso}</p>}
              {obsIA && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span><b>IA:</b> {obsIA}</span>
                </div>
              )}
            </div>

            {/* Modo de execução */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Gavel className="h-4 w-4 text-zinc-400" /> O que será executado?
              </h2>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    set('modo', 'condenacao');
                    if (form.honBase === 'condenacao') set('honBase', 'diferenca');
                  }}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${form.modo === 'condenacao' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Condenação em dinheiro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set('modo', 'obrigacaoFazer');
                    if (form.honBase === 'diferenca' || form.honBase === 'debitos') set('honBase', 'valorFixado');
                  }}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${form.modo === 'obrigacaoFazer' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Obrigação de fazer — só sucumbência
                </button>
              </div>
              {form.modo === 'obrigacaoFazer' && (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Sentença sem condenação líquida (ex.: conversão do contrato, com restituição por
                  abatimento no recálculo): executa-se apenas os <b>honorários sucumbenciais</b>,
                  que viram o principal — corrigidos, com juros e, se for o caso, multa do art. 523.
                </p>
              )}
            </div>

            {form.modo === 'condenacao' && (
            <>
            {/* Débitos */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileText className="h-4 w-4 text-zinc-400" /> Débitos (condenação)
              </h2>
              <ItensEditor itens={debitos} setItens={setDebitos} upd={(i, k, v) => upd(debitos, setDebitos, i, k, v)} placeholderDesc="Condenação / dano moral…" />
            </div>

            {/* Tutela / descontos continuados */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Tutela deferida?{' '}
                <span className="text-xs font-normal text-zinc-400">(suspensão dos descontos)</span>
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Se a tutela <b>não</b> foi deferida, os descontos continuaram depois da inicial — o
                saldo devedor é recalculado somando um desconto por mês até o termo final.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set('tutelaDeferida', true)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${form.tutelaDeferida ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Sim — descontos suspensos
                </button>
                <button
                  type="button"
                  onClick={() => set('tutelaDeferida', false)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${!form.tutelaDeferida ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Não — descontos continuaram
                </button>
              </div>
              {!form.tutelaDeferida && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Desconto mensal (R$)</label>
                      <input className={inputCls} inputMode="decimal" placeholder="105,00" value={form.descontoMensal} onChange={(e) => set('descontoMensal', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Último desconto na inicial</label>
                      <input type="date" className={inputCls} value={form.ultimoDesconto} onChange={(e) => set('ultimoDesconto', e.target.value)} />
                    </div>
                  </div>
                  {descontosExtras.length > 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      Serão acrescidos <b>{descontosExtras.length} desconto(s)</b> de{' '}
                      <b>{brl(parseValor(form.descontoMensal))}</b> (
                      {descontosExtras[0].data.slice(0, 7).split('-').reverse().join('/')} a{' '}
                      {descontosExtras[descontosExtras.length - 1].data.slice(0, 7).split('-').reverse().join('/')}
                      ) ao saldo devedor, cada um corrigido com juros desde a própria data.
                    </p>
                  ) : (
                    <p className="text-[10px] leading-tight text-zinc-400">
                      Informe o valor do desconto mensal e a data do último desconto considerado no
                      cálculo da inicial.
                    </p>
                  )}
                </div>
              )}
            </div>
            </>
            )}

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
                      <option value="SELIC">SELIC (Fazenda · Tema 905)</option>
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
                    <input className={`${inputCls} disabled:opacity-50`} inputMode="decimal" placeholder="1,00" value={form.indiceCorrecao === 'SELIC' ? '0' : form.jurosMora} disabled={form.indiceCorrecao === 'SELIC'} onChange={(e) => set('jurosMora', e.target.value)} />
                    {form.indiceCorrecao === 'SELIC' && (
                      <p className="mt-1 text-[10px] leading-tight text-zinc-400">A SELIC já embute os juros (Tema 905/STJ).</p>
                    )}
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
                      <input className={`${inputCls} disabled:opacity-50`} inputMode="decimal" placeholder={form.honBase === 'valorFixado' ? '—' : '10'} value={form.honBase === 'valorFixado' ? '' : form.honPercentual} disabled={form.honBase === 'valorFixado'} onChange={(e) => set('honPercentual', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Base</label>
                      <select className={inputCls} value={form.honBase} onChange={(e) => set('honBase', e.target.value as typeof form.honBase)}>
                        {form.modo === 'condenacao' && (
                          <>
                            <option value="diferenca">Sobre o principal corrigido (condenação)</option>
                            <option value="debitos">Sobre os débitos corrigidos</option>
                          </>
                        )}
                        {form.modo === 'obrigacaoFazer' && (
                          <option value="condenacao">Sobre a condenação (informe o valor)</option>
                        )}
                        <option value="fixa">Sobre o valor da causa (fixo)</option>
                        <option value="valorFixado">Valor fixado (R$)</option>
                      </select>
                    </div>
                  </div>
                  {form.honBase === 'condenacao' && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className={labelCls}>Valor da condenação (R$)</label>
                        <input className={inputCls} inputMode="decimal" placeholder="ex.: valor apurado no recálculo" value={form.honValorCondenacao} onChange={(e) => set('honValorCondenacao', e.target.value)} />
                      </div>
                      <p className="text-[10px] leading-tight text-zinc-400">
                        Honorários = percentual × condenação (o proveito econômico apurado — ex.:
                        o abatimento no recálculo do contrato).
                      </p>
                      {honExecucaoValor > 0 && (
                        <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                          = {brl(honExecucaoValor)} de honorários
                        </p>
                      )}
                      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.honAtualizar} onChange={(e) => set('honAtualizar', e.target.checked)} />
                        Corrigir o valor até o termo final
                      </label>
                      {form.honAtualizar && (
                        <div>
                          <label className={labelCls}>Data da fixação (sentença)</label>
                          <input type="date" className={inputCls} value={form.honQuantiaData} onChange={(e) => set('honQuantiaData', e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}
                  {form.honBase === 'valorFixado' && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className={labelCls}>Honorários fixados (R$)</label>
                        <input className={inputCls} inputMode="decimal" placeholder="1.175,87" value={form.honValorFixado} onChange={(e) => set('honValorFixado', e.target.value)} />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.honAtualizar} onChange={(e) => set('honAtualizar', e.target.checked)} />
                        Corrigir o valor até o termo final
                      </label>
                      {form.honAtualizar && (
                        <div>
                          <label className={labelCls}>Data da fixação (sentença)</label>
                          <input type="date" className={inputCls} value={form.honQuantiaData} onChange={(e) => set('honQuantiaData', e.target.value)} />
                        </div>
                      )}
                      <p className="text-[10px] leading-tight text-zinc-400">
                        Use quando não há condenação líquida (ex.: obrigação de fazer) e os
                        honorários precisam ser fixados em valor certo.
                      </p>
                    </div>
                  )}
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
                  <p className="mt-1.5 text-[10px] leading-tight text-zinc-400">
                    Só marque depois de esgotado o prazo de 15 dias do art. 523 sem pagamento.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600" checked={form.proRataDie} onChange={(e) => set('proRataDie', e.target.checked)} />
                  Pro rata die
                </label>
              </div>
            </div>

            {/* Créditos / amortizações */}
            {form.modo === 'condenacao' && (
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
            )}

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
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      gerarPdfCs(
                        res,
                        calcInfo?.honFixado
                          ? { honorariosLabel: 'Honorários sucumbenciais — valor fixado' }
                          : undefined,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Baixar PDF
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Resultado</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {res.config.indiceCorrecao} · termo final {res.config.termoFinal.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <dl className="text-sm">
                    <ResRow
                      label={
                        calcInfo?.modo === 'obrigacaoFazer'
                          ? 'Honorários sucumbenciais corrigidos (principal da execução)'
                          : 'Principal (débitos corrigidos − créditos)'
                      }
                      valor={res.totais.principal}
                    />
                    {res.totais.jurosMora !== 0 && <ResRow label={`Juros de mora (${pct(res.config.jurosMora)} a.m.)`} valor={res.totais.jurosMora} />}
                    {res.totais.multa > 0 && <ResRow label={`Multa (${pct(res.config.multaPct)})`} valor={res.totais.multa} />}
                    {res.totais.honorarios > 0 && (
                      <ResRow
                        label={
                          calcInfo?.honFixado
                            ? `Honorários sucumbenciais — valor fixado${res.config.honorarios?.atualizarQuantia ? ' (corrigido até o termo final)' : ''}`
                            : `Honorários sucumbenciais — ${pct(res.config.honorarios?.percentual)} ${
                                res.config.honorarios?.base === 'fixa'
                                  ? `sobre o valor da causa (${brl(res.honorariosBase)})`
                                  : res.config.honorarios?.base === 'debitos'
                                    ? 'sobre os débitos'
                                    : 'sobre o principal'
                              }`
                        }
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
        <div key={i} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 lg:grid-cols-[1fr_120px_110px_auto]">
          <input className={`${inputCls} col-span-3 lg:col-span-1`} placeholder={placeholderDesc} value={l.descricao} onChange={(e) => upd(i, 'descricao', e.target.value)} />
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
