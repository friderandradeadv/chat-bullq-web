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
  afastadas: string[];
  teses: { rubrica: string; valor: number; forca: string }[];
}

export function ApresentacaoVendasRevisional({
  dados,
  onClose,
}: {
  dados: DadosApresentacaoRevisional;
  onClose: () => void;
}) {
  const nome = (dados.cliente || 'Cliente').toUpperCase();
  const vt0 = round100(SERVICOS_BASE * porteMult(dados.proveito));

  const [proveito, setProveito] = useState(dados.proveito);
  const [valorTabela, setValorTabela] = useState(vt0);
  const [pctExitoTabela, setPctExitoTabela] = useState(40);
  const [entradaPadrao, setEntradaPadrao] = useState(round100(vt0 * 0.25));
  const [pctExitoPadrao, setPctExitoPadrao] = useState(30);
  const [entradaHoje, setEntradaHoje] = useState(round100(vt0 * 0.2));
  const [parcelasHoje, setParcelasHoje] = useState(3);
  const [pctExitoHoje, setPctExitoHoje] = useState(25);
  const [ocupado, setOcupado] = useState<'ver' | 'baixar' | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const c = useMemo(() => {
    const P = Math.max(0, proveito);
    const exitoTabela = Math.round((P * pctExitoTabela) / 100);
    const exitoPadrao = Math.round((P * pctExitoPadrao) / 100);
    const exitoHoje = Math.round((P * pctExitoHoje) / 100);
    const anchor = valorTabela + exitoTabela;
    const padrao = entradaPadrao + exitoPadrao;
    const oferta = entradaHoje + exitoHoje;
    return {
      P, exitoTabela, exitoPadrao, exitoHoje, anchor, padrao, oferta,
      liquidoPadrao: P - padrao,
      liquidoHoje: P - oferta,
      economizaVsPadrao: Math.max(0, padrao - oferta),
      descTabela: valorTabela > 0 ? Math.round((1 - entradaPadrao / valorTabela) * 100) : 0,
      descHoje: valorTabela > 0 ? Math.round((1 - entradaHoje / valorTabela) * 100) : 0,
      parcela: parcelasHoje > 0 ? Math.round(entradaHoje / parcelasHoje) : entradaHoje,
    };
  }, [proveito, valorTabela, pctExitoTabela, entradaPadrao, pctExitoPadrao, entradaHoje, pctExitoHoje, parcelasHoje]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Controles de preço — não entram no PDF */}
      <div className="no-print flex shrink-0 flex-wrap items-end gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-900/60">
        <Campo label="Proveito econômico">{num(proveito, setProveito)}</Campo>
        <Campo label="Valor de tabela">{num(valorTabela, setValorTabela)}</Campo>
        <Campo label="Êxito tabela %">{num(pctExitoTabela, setPctExitoTabela)}</Campo>
        <Campo label="Entrada padrão">{num(entradaPadrao, setEntradaPadrao)}</Campo>
        <Campo label="Êxito padrão %">{num(pctExitoPadrao, setPctExitoPadrao)}</Campo>
        <Campo label="Entrada hoje">{num(entradaHoje, setEntradaHoje)}</Campo>
        <Campo label="Parcelas">{num(parcelasHoje, setParcelasHoje)}</Campo>
        <Campo label="Êxito hoje %">{num(pctExitoHoje, setPctExitoHoje)}</Campo>
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
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Teses que este contrato não sustenta</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dados.afastadas.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-300"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /> {a}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#B7791F]">O que vamos pedir</p>
              <div className="mt-2 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {dados.teses.map((t) => (
                  <div key={t.rubrica} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-200"><Check className="h-4 w-4 shrink-0 text-[#B7791F]" /> {t.rubrica}</span>
                    <span className="shrink-0 font-serif text-base font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(t.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Slide>

          {/* 3 · OS NÚMEROS */}
          <Slide>
            <SlideKicker>Os números do seu caso</SlideKicker>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Restituição do já pago" value={fmtBRL(dados.restituicao)} />
              <Stat label="Economia nas parcelas" value={fmtBRL(dados.economiaFutura)} />
              <Stat label="Proveito total" value={fmtBRL(c.P)} good />
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-700">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">A sua parcela</p>
              <div className="mt-3 flex flex-wrap items-end gap-6">
                <div><p className="text-xs text-zinc-500">hoje</p><p className="font-serif text-3xl font-bold text-zinc-400 line-through">{fmtBRL(dados.parcelaAtual)}</p></div>
                <div><p className="text-xs text-zinc-500">com a revisão</p><p className="font-serif text-4xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(dados.parcelaNova)}</p></div>
                <div className="ml-auto text-right"><p className="text-xs text-zinc-500">a menos por mês</p><p className="font-serif text-2xl font-bold text-[#B7791F]">{fmtBRL(dados.parcelaAtual - dados.parcelaNova)}</p></div>
              </div>
            </div>
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

          {/* 5 · A SUA PROPOSTA (ancoragem) */}
          <Slide>
            <SlideKicker>A sua proposta</SlideKicker>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-700">
              <span className="text-sm text-zinc-500">Valor de tabela + {pct(pctExitoTabela)} de êxito</span>
              <span className="text-xl font-semibold text-zinc-400 line-through">{fmtBRL(c.anchor)}</span>
            </div>
            <div className="rounded-2xl border-2 border-[#B7791F]/40 bg-[#B7791F]/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#B7791F]">Proposta para o seu caso</p>
              <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-zinc-500">Entrada (dá início ao trabalho)</p>
                  <p className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(entradaPadrao)}</p>
                  <p className="text-[11px] font-semibold text-[#c22e00]">−{c.descTabela}% sobre o valor de tabela</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">+ Êxito ({pct(pctExitoPadrao)})</p>
                  <p className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.exitoPadrao)}</p>
                  <p className="text-[11px] text-zinc-500">só sobre o que você ganhar</p>
                </div>
              </div>
              <ExitoExplica proveito={c.P} pctExito={pctExitoPadrao} exito={c.exitoPadrao} />
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#B7791F]/20 pt-4">
                <div className="rounded-xl bg-[#B7791F]/10 p-4">
                  <p className="text-xs text-zinc-500">Total de honorários (estimado)</p>
                  <p className="mt-0.5 font-serif text-2xl font-bold text-[#B7791F]">{fmtBRL(c.padrao)}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-900/15">
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Fica com você</p>
                  <p className="mt-0.5 font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(c.liquidoPadrao)}</p>
                </div>
              </div>
            </div>
          </Slide>

          {/* 6 · FECHAR HOJE */}
          <Slide dark>
            <span className="self-start rounded-full bg-[#c22e00] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">Condição válida nesta reunião</span>
            <h2 className="mt-4 font-serif text-3xl font-bold text-white">Para começar hoje</h2>
            <div className="mt-5 rounded-2xl border border-[#B7791F]/40 bg-white/5 p-6">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-white/60">Entrada</p>
                  <p className="font-serif text-4xl font-bold text-white">{fmtBRL(entradaHoje)}</p>
                  <p className="text-[11px] text-[#e0b872]">em até {parcelasHoje}× de {fmtBRL(c.parcela)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">+ Êxito ({pct(pctExitoHoje)})</p>
                  <p className="font-serif text-4xl font-bold text-white">{fmtBRL(c.exitoHoje)}</p>
                  <p className="text-[11px] text-white/50">só se você ganhar</p>
                </div>
              </div>
              <ExitoExplica proveito={c.P} pctExito={pctExitoHoje} exito={c.exitoHoje} dark />
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-white/60">Economiza em relação à proposta padrão</p><p className="mt-0.5 font-serif text-2xl font-bold text-[#e0b872]">{fmtBRL(c.economizaVsPadrao)}</p></div>
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4"><p className="text-xs text-emerald-300/80">Fica com você</p><p className="mt-0.5 font-serif text-2xl font-bold text-emerald-300">{fmtBRL(c.liquidoHoje)}</p></div>
              </div>
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
      <p>O êxito é <b>{pct(pctExito)} sobre o proveito</b> — sobre o que você efetivamente recuperar e deixar de pagar, nunca sobre o valor do contrato.</p>
      <p className={`mt-1.5 font-semibold ${dark ? 'text-[#e0b872]' : 'text-[#B7791F]'}`}>Ex.: proveito de {fmtBRL(proveito)} × {pct(pctExito)} = {fmtBRL(exito)} de êxito</p>
      <p className={`mt-1.5 ${dark ? 'text-white/55' : 'text-zinc-400'}`}>É uma <b>estimativa</b> pela projeção atual e <b>varia com o resultado</b>: o fixo é o <b>percentual</b>, nunca o valor.</p>
    </div>
  );
}
