'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Download, Eye, Loader2, Printer, Sliders, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * APRESENTAÇÃO DE VENDAS — REVISIONAL. Mesmo modelo da do REPB
 * (`repb-apresentacao-vendas.tsx`): value stack como ÂNCORA, três degraus de
 * preço (tabela riscada → proposta → oferta de hoje) e PDF de uma página só.
 *
 * 🚨 OS NÚMEROS SÃO EDITÁVEIS DE PROPÓSITO. O proveito vem do cálculo, mas quem
 * decide o preço é o advogado na frente do cliente: os campos do topo mudam a
 * apresentação ao vivo, e nada aqui se grava sozinho.
 */

const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const round100 = (v: number) => Math.round(v / 100) * 100;

// Value stack: cada serviço com preço de mercado individual. É a âncora — o
// cliente vê o custo avulso antes de ver o pacote.
const SERVICOS: [string, number][] = [
  ['Auditoria técnica do contrato (taxa real, CET, capitalização, tarifas)', 1200],
  ['Levantamento das séries do Banco Central e parecer de abusividade', 800],
  ['Memória de cálculo e planilha de restituição', 900],
  ['Elaboração da petição inicial', 1800],
  ['Acompanhamento processual até a sentença', 1500],
  ['Negociação de acordo com o banco', 900],
  ['Recursos, se necessários', 1400],
];
const SERVICOS_BASE = SERVICOS.reduce((a, [, v]) => a + v, 0); // 8.500

/** Porte do caso pelo proveito econômico — o trabalho cresce com o que está em jogo. */
function porteMult(p: number): number {
  if (p >= 200_000) return 3.0;
  if (p >= 100_000) return 2.4;
  if (p >= 50_000) return 1.8;
  if (p >= 25_000) return 1.4;
  if (p >= 10_000) return 1.15;
  return 1.0;
}

export interface DadosApresentacaoRevisional {
  cliente: string;
  credor: string;
  contrato: string;
  proveito: number;
  parcelaAtual: number;
  parcelaNova: number;
  restituicao: number;
  economiaFutura: number;
  /** o que foi conferido e NÃO vira pedido — com o motivo */
  afastadas: { o: string; porque: string }[];
  /** cada tese com o que o banco cobrou e o que o cliente recebe de volta */
  teses: { rubrica: string; cobrado: number; recebe: number; forca: string }[];
}

export function ApresentacaoVendasRevisional({
  dados,
  onClose,
}: {
  dados: DadosApresentacaoRevisional;
  /** só existe quando aberto como modal; em aba própria não há o que fechar */
  onClose?: () => void;
}) {
  const nome = (dados.cliente || 'Cliente').toUpperCase();
  const vt0 = round100(SERVICOS_BASE * porteMult(dados.proveito));

  const [proveito, setProveito] = useState(dados.proveito);
  const [valorTabela, setValorTabela] = useState(vt0);
  const [pctExitoTabela, setPctExitoTabela] = useState(40);
  const [entradaPadrao, setEntradaPadrao] = useState(round100(vt0 * 0.25));
  const [pctExitoPadrao, setPctExitoPadrao] = useState(30);
  // Opção 2: meio a meio, sem entrada — o mesmo padrão da RMC.
  const [pctMeioAMeio, setPctMeioAMeio] = useState(50);
  const [ocupado, setOcupado] = useState<'ver' | 'baixar' | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const c = useMemo(() => {
    const P = Math.max(0, proveito);
    const exitoTabela = Math.round((P * pctExitoTabela) / 100);
    const exitoPadrao = Math.round((P * pctExitoPadrao) / 100);
    const meioAMeio = Math.round((P * pctMeioAMeio) / 100);
    // 🚨 A ENTRADA É ADIANTAMENTO DO ÊXITO, NÃO ADICIONAL. Somando as duas, num
    // caso pequeno o escritório ficava com MAIS que o cliente (R$ 4.520 contra
    // R$ 3.547 num proveito de R$ 8.067 — 56%). A entrada se abate do êxito: o
    // total é o maior dos dois, e o cliente paga a diferença só no fim.
    const anchor = valorTabela + exitoTabela;
    const padrao = Math.max(entradaPadrao, exitoPadrao);
    const saldoPadrao = Math.max(0, exitoPadrao - entradaPadrao);
    return {
      P, exitoTabela, exitoPadrao, anchor, padrao, saldoPadrao, meioAMeio,
      pctEscritorio: P > 0 ? (padrao / P) * 100 : 0,
      liquidoPadrao: P - padrao,
      descTabela: valorTabela > 0 ? Math.round((1 - entradaPadrao / valorTabela) * 100) : 0,
    };
  }, [proveito, valorTabela, pctExitoTabela, entradaPadrao, pctExitoPadrao, pctMeioAMeio]);

  const stack = useMemo(() => {
    const f = SERVICOS_BASE > 0 ? valorTabela / SERVICOS_BASE : 1;
    return SERVICOS.map(([n, base]) => ({ n, v: round100(base * f) }));
  }, [valorTabela]);

  /** Gera o PDF da apresentação. `ver` abre numa aba; senão baixa direto. */
  const gerarPdf = async (ver: boolean) => {
    const el = slideRef.current;
    if (!el) return;
    setOcupado(ver ? 'ver' : 'baixar');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const wmm = 210;
      const hmm = Math.max(297, (canvas.height * wmm) / canvas.width);
      const pdf = new jsPDF({ unit: 'mm', format: [wmm, hmm], orientation: 'portrait' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wmm, hmm);
      const safe = (nome || 'cliente').replace(/[^\p{L}\p{N} .-]/gu, '').trim() || 'cliente';
      if (ver) {
        // Abre para CONFERIR antes de decidir salvar — o visualizador do
        // navegador já traz o botão de download.
        const url = URL.createObjectURL(pdf.output('blob'));
        const aba = window.open(url, '_blank');
        if (!aba) toast.error('O navegador bloqueou a aba. Libere o pop-up para este site.');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        pdf.save(`Proposta revisional - ${safe}.pdf`);
      }
    } catch {
      toast.error('Não consegui gerar o PDF. Use "Imprimir" e salve como PDF.');
    } finally {
      setOcupado(null);
    }
  };

  const num = (v: number, set: (n: number) => void) => (
    <input
      type="number"
      value={v}
      onChange={(e) => set(Number(e.target.value) || 0)}
      className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="no-print sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <Sliders className="h-4 w-4 text-[#B7791F]" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Apresentação de vendas — {nome}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => gerarPdf(true)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg bg-[#B7791F] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {ocupado === 'ver' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Eye className="h-4 w-4" /> Ver PDF</>}
          </button>
          <button onClick={() => gerarPdf(false)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg border border-[#B7791F]/50 px-3 py-1.5 text-sm font-semibold text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-60">
            {ocupado === 'baixar' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4" /> Baixar</>}
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"><Printer className="h-4 w-4" /> Imprimir</button>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
          )}
        </div>
      </div>

      {/* Controles de preço — não entram no PDF */}
      <div className="no-print sticky top-[49px] z-10 flex shrink-0 flex-wrap items-end gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
        <Campo label="Proveito econômico">{num(proveito, setProveito)}</Campo>
        <Campo label="Valor de tabela">{num(valorTabela, setValorTabela)}</Campo>
        <Campo label="Êxito tabela %">{num(pctExitoTabela, setPctExitoTabela)}</Campo>
        <Campo label="Entrada padrão">{num(entradaPadrao, setEntradaPadrao)}</Campo>
        <Campo label="Êxito padrão %">{num(pctExitoPadrao, setPctExitoPadrao)}</Campo>
        <Campo label="Meio a meio %">{num(pctMeioAMeio, setPctMeioAMeio)}</Campo>
        {c.pctEscritorio > 50 && (
          <p className="w-full rounded-md bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
            ⚠ O escritório ficaria com {pct(c.pctEscritorio)} do proveito — mais que o cliente. Baixe a entrada ou o êxito.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-100 p-6 dark:bg-zinc-950">
        <div ref={slideRef} className="mx-auto flex max-w-3xl flex-col gap-6 bg-zinc-100 dark:bg-zinc-950">

          {/* 1 · CAPA */}
          <Slide dark>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#e0b872]">Proposta de trabalho</p>
            <h1 className="mt-3 font-serif text-4xl font-bold text-white">Revisão do seu financiamento</h1>
            <p className="mt-2 text-lg text-white/70">{dados.credor}</p>
            <div className="mt-auto grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
              <div><p className="text-[11px] uppercase tracking-wide text-white/50">Cliente</p><p className="font-serif text-xl text-white">{dados.cliente}</p></div>
              <div><p className="text-[11px] uppercase tracking-wide text-white/50">Contrato</p><p className="font-serif text-xl text-white">{dados.contrato}</p></div>
            </div>
          </Slide>

          {/* 2 · O QUE ENCONTRAMOS */}
          <Slide>
            <SlideKicker>O que a auditoria encontrou</SlideKicker>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
              Auditamos o contrato inteiro, não só os juros. Começamos pelo que <b>não</b> dá para pedir — é isso que separa análise de promessa.
            </p>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">O que NÃO vamos pedir, e por quê</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dados.afastadas.map((a) => (
                  <li key={a.o} className="flex items-start gap-2 text-[12.5px] text-zinc-600 dark:text-zinc-300">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span><b className="text-zinc-800 dark:text-zinc-100">{a.o}</b> — {a.porque}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#B7791F]">O que é irregular e vamos pedir</p>
              <table className="mt-2 w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                    <th className="py-1.5 pr-3 font-semibold">Rubrica</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">O banco cobrou</th>
                    <th className="py-1.5 text-right font-semibold">Você recebe de volta</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.teses.map((t) => (
                    <tr key={t.rubrica} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-3 text-[12.5px] text-zinc-700 dark:text-zinc-200">
                        <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-[#B7791F]" /> {t.rubrica}</span>
                      </td>
                      <td className="py-2 pr-3 text-right text-[12.5px] tabular-nums text-zinc-500">{t.cobrado > 0 ? fmtBRL(t.cobrado) : '—'}</td>
                      <td className="py-2 text-right font-serif text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtBRL(t.recebe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                "Você recebe de volta" é maior que o cobrado porque inclui os <b>juros</b> que incidiram sobre a
                cobrança durante o contrato, a devolução do que já foi pago e a redução das parcelas que faltam.
              </p>
            </div>
          </Slide>

          {/* 3 · OS NÚMEROS */}
          <Slide>
            <SlideKicker>Os números do seu caso</SlideKicker>
            <div className="rounded-2xl bg-gradient-to-br from-[#1a1206] via-[#2a1d0a] to-[#101820] p-7 ring-1 ring-[#B7791F]/25">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#e0b872]">O que você pode recuperar</p>
              <p className="mt-1 font-serif text-6xl font-bold leading-none text-white">{fmtBRL(c.P)}</p>
              <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-4">
                <div><p className="text-[11px] uppercase tracking-wide text-white/50">Devolvido do que já pagou</p><p className="font-serif text-2xl font-bold text-white">{fmtBRL(dados.restituicao)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-white/50">Economia nas parcelas que faltam</p><p className="font-serif text-2xl font-bold text-white">{fmtBRL(dados.economiaFutura)}</p></div>
              </div>
            </div>
            {dados.parcelaAtual - dados.parcelaNova > 0.5 && (
              <div className="mt-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/60 p-7 dark:border-emerald-400/25 dark:bg-emerald-900/10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">A sua parcela</p>
                <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
                  <div><p className="text-xs text-zinc-500">hoje</p><p className="font-serif text-3xl font-bold text-zinc-400 line-through">{fmtBRL(dados.parcelaAtual)}</p></div>
                  <div><p className="text-xs text-zinc-500">com a revisão</p><p className="font-serif text-5xl font-bold leading-none text-emerald-700 dark:text-emerald-400">{fmtBRL(dados.parcelaNova)}</p></div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-zinc-500">a menos, todo mês</p>
                    <p className="font-serif text-3xl font-bold text-[#B7791F]">−{fmtBRL(dados.parcelaAtual - dados.parcelaNova)}</p>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
              Estimativa técnica sobre o contrato e as séries oficiais do Banco Central. Não é promessa de resultado — o art. 41 do Código de Ética da OAB veda ao advogado garantir desfecho.
            </p>
          </Slide>

          {/* 4 · VALUE STACK (âncora) */}
          <Slide>
            <SlideKicker>O que está incluído</SlideKicker>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300">Contratado avulso, cada etapa custaria:</p>
            <div className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {stack.map((s) => (
                <div key={s.n} className="flex items-center justify-between gap-4 py-2">
                  <span className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300"><Check className="h-4 w-4 shrink-0 text-[#B7791F]" /> {s.n}</span>
                  <span className="shrink-0 text-sm font-semibold text-zinc-500">{fmtBRL(s.v)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300"><Check className="h-4 w-4 shrink-0 text-[#B7791F]" /> Atendimento direto com o Dr. Matheus</span>
                <span className="shrink-0 text-xs font-semibold uppercase text-[#B7791F]">incluso</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 p-5 dark:bg-black">
              <span className="font-serif text-lg text-white">Valor de tabela dos serviços</span>
              <span className="font-serif text-3xl font-bold text-[#e0b872]">{fmtBRL(valorTabela)}</span>
            </div>
          </Slide>

          {/* 5 · DUAS PORTAS — tecnica do "sim ou sim": as duas sao um sim */}
          <Slide>
            <SlideKicker>Duas formas de contratar</SlideKicker>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-700">
              <div>
                <span className="text-sm text-zinc-500">Valor de tabela dos serviços + {pct(pctExitoTabela)} de êxito</span>
                <p className="text-[11px] text-zinc-400">é o que custaria contratado avulso, sem pacote</p>
              </div>
              <span className="text-xl font-semibold text-zinc-400 line-through">{fmtBRL(c.anchor)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* OPÇÃO 1 */}
              <div className="flex flex-col rounded-2xl border-2 border-[#B7791F]/40 bg-[#B7791F]/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#B7791F]">Opção 1 · entrada + êxito</p>
                <p className="mt-2 text-xs text-zinc-500">Você paga agora</p>
                <p className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(entradaPadrao)}</p>
                <p className="mt-3 text-xs text-zinc-500">E no fim, {pct(pctExitoPadrao)} do que ganhar, já abatida a entrada</p>
                <p className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.saldoPadrao)}</p>
                <div className="mt-auto border-t border-[#B7791F]/20 pt-3">
                  <div className="flex items-baseline justify-between"><span className="text-xs text-zinc-500">Total de honorários</span><span className="font-serif text-xl font-bold text-[#B7791F]">{fmtBRL(c.padrao)}</span></div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-xs text-emerald-700 dark:text-emerald-400">Fica com você</span><span className="font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(c.liquidoPadrao)}</span></div>
                </div>
              </div>

              {/* OPÇÃO 2 — meio a meio, como na RMC */}
              <div className="flex flex-col rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-600 dark:bg-zinc-800/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Opção 2 · meio a meio</p>
                <p className="mt-2 text-xs text-zinc-500">Você paga agora</p>
                <p className="font-serif text-3xl font-bold text-emerald-700 dark:text-emerald-400">Nada</p>
                <p className="mt-3 text-xs text-zinc-500">E no fim, metade do que ganhar</p>
                <p className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.meioAMeio)}</p>
                <div className="mt-auto border-t border-zinc-200 pt-3 dark:border-zinc-600">
                  <div className="flex items-baseline justify-between"><span className="text-xs text-zinc-500">Total de honorários</span><span className="font-serif text-xl font-bold text-zinc-700 dark:text-zinc-200">{fmtBRL(c.meioAMeio)}</span></div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-xs text-emerald-700 dark:text-emerald-400">Fica com você</span><span className="font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(c.meioAMeio)}</span></div>
                </div>
              </div>
            </div>

            <ExitoExplica proveito={c.P} pctExito={pctExitoPadrao} exito={c.exitoPadrao} />
            <p className="mt-3 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              A diferença entre as duas é só <b>quando</b> você paga. Na <b>Opção 1</b> a entrada barateia o total,
              porque divide o risco com o escritório. Na <b>Opção 2</b> você não tira nada do bolso agora e o
              escritório só recebe se você receber.
            </p>
          </Slide>

          {/* 6 · O FECHAMENTO — pergunta de escolha, sem urgencia fabricada */}
          <Slide dark>
            <div className="flex h-full flex-col justify-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#e0b872]">Para seguirmos</p>
              <h2 className="mt-3 font-serif text-4xl font-bold leading-tight text-white">
                Qual das duas faz<br />mais sentido para você?
              </h2>
              <div className="mt-7 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#B7791F]/40 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#e0b872]">Opção 1</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-white">{fmtBRL(entradaPadrao)} agora</p>
                  <p className="text-[12px] text-white/60">+ {pct(pctExitoPadrao)} no fim · total {fmtBRL(c.padrao)}</p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Opção 2</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-white">Nada agora</p>
                  <p className="text-[12px] text-white/60">metade no fim · total {fmtBRL(c.meioAMeio)}</p>
                </div>
              </div>
              <p className="mt-7 text-[15px] leading-relaxed text-white/75">
                Me responda com <b className="text-white">1</b> ou <b className="text-white">2</b> e eu já mando o
                contrato e a procuração para assinatura digital. Qualquer dúvida sobre os números, é só perguntar
                por aqui mesmo.
              </p>
            </div>
          </Slide>


          {/* 7 · PRÓXIMOS PASSOS */}
          <Slide>
            <SlideKicker>Como começa</SlideKicker>
            <div className="flex flex-col gap-3">
              {[
                ['01', 'Contrato de honorários e procuração', 'Assinatura digital, com a entrada no ato.'],
                ['02', 'Documentos', 'Identidade, comprovante de residência e os comprovantes das parcelas já pagas.'],
                ['03', 'Protocolo da ação', 'Vara cível do seu domicílio, com pedido de gratuidade de justiça.'],
                ['04', 'Acompanhamento', 'Atualização a cada movimentação relevante, direto com o escritório.'],
              ].map(([n, t, d]) => (
                <div key={n} className="flex items-start gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-700">
                  <span className="font-serif text-2xl font-bold text-[#B7791F]">{n}</span>
                  <div><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t}</p><p className="text-[13px] text-zinc-600 dark:text-zinc-300">{d}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-900/15">
              <p className="text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
                <b>Importante:</b> até haver decisão judicial, a parcela continua devida integralmente. Deixar de pagar durante a ação expõe o veículo à busca e apreensão. Custas e despesas processuais correm por conta do cliente.
              </p>
            </div>
          </Slide>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-zinc-500">{label}</span>{children}</label>;
}
function Slide({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <section className={`print-slide flex min-h-[440px] flex-col rounded-2xl p-9 shadow-sm ${dark ? 'bg-gradient-to-br from-[#1a1206] via-[#2a1d0a] to-[#101820] ring-1 ring-[#B7791F]/20' : 'border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`} style={{ pageBreakAfter: 'always' }}>
      {children}
    </section>
  );
}
function SlideKicker({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100"><span className="border-b-2 border-[#B7791F] pb-1">{children}</span></h2>;
}
function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${good ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/15' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40'}`}>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-serif text-xl font-bold ${good ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
    </div>
  );
}
function ExitoExplica({ proveito, pctExito, exito, dark }: { proveito: number; pctExito: number; exito: number; dark?: boolean }) {
  return (
    <div className={`mt-3 rounded-lg border p-3.5 text-[12px] leading-relaxed ${dark ? 'border-[#B7791F]/30 bg-white/5 text-white/75' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300'}`}>
      <p>O êxito é <b>{pct(pctExito)} sobre o proveito</b> — sobre o que você efetivamente recuperar e deixar de pagar, nunca sobre o valor do contrato. O percentual é menor porque há <b>entrada</b>: ela paga o trabalho ganhe ou perca, e por isso o escritório cobra menos no fim.</p>
      <p className={`mt-1.5 font-semibold ${dark ? 'text-[#e0b872]' : 'text-[#B7791F]'}`}>Ex.: proveito de {fmtBRL(proveito)} × {pct(pctExito)} = {fmtBRL(exito)} de êxito</p>
      <p className={`mt-1.5 ${dark ? 'text-white/55' : 'text-zinc-400'}`}>É uma <b>estimativa</b> pela projeção atual e <b>varia com o resultado</b>: o fixo é o <b>percentual</b>, nunca o valor.</p>
    </div>
  );
}
