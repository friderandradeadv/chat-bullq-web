'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Eye, Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
// 🚨 Esta tela fica FORA do layout do dashboard, onde mora o alternador de
// tema. Sem ele aqui, o claro/escuro some para quem abre o documento.
import { ThemeToggle } from '@/features/auth/components/theme-toggle';
import { porTese, brlNum } from '@/features/calculadora-revisional/proveito';
import type {
  AuditoriaContrato,
  ExtracaoContrato,
  IrregularidadeContrato,
  ResultadoRevisional,
} from '@/features/calculadora-revisional/services/calculadora-revisional.service';

/**
 * Os dois documentos do caso que NÃO são a apresentação de vendas:
 *   • MEMÓRIA DE CÁLCULO — o que vai ao cliente e instrui a peça;
 *   • PARECER INTERNO — a decisão de pegar ou não a ação, que o cliente NUNCA vê.
 *
 * Ambos saem em PDF por duas portas: "Ver" abre numa aba para conferir antes de
 * decidir salvar; "Baixar" grava direto.
 */

const brl = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctF = (v: number | null | undefined, c = 2) =>
  typeof v === 'number' ? `${v.toFixed(c).replace('.', ',')}%` : '—';

/** Topo com as ações + a folha que vira PDF. */
function Folha({
  titulo,
  arquivo,
  onClose,
  children,
}: {
  titulo: string;
  arquivo: string;
  /** só existe quando aberto como modal; em aba própria não há o que fechar */
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ocupado, setOcupado] = useState<'ver' | 'baixar' | null>(null);

  const gerar = async (ver: boolean) => {
    const el = ref.current;
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
      if (ver) {
        const url = URL.createObjectURL(pdf.output('blob'));
        if (!window.open(url, '_blank')) toast.error('O navegador bloqueou a aba. Libere o pop-up para este site.');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        pdf.save(`${arquivo}.pdf`);
      }
    } catch {
      toast.error('Não consegui gerar o PDF. Use "Imprimir" e salve como PDF.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="no-print sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => gerar(true)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {ocupado === 'ver' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Eye className="h-4 w-4" /> Ver PDF</>}
          </button>
          <button onClick={() => gerar(false)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg border border-blue-500/50 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:text-blue-400 dark:hover:bg-blue-500/10">
            {ocupado === 'baixar' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4" /> Baixar</>}
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"><Printer className="h-4 w-4" /> Imprimir</button>
          <ThemeToggle className="inline-flex items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800" />
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {/* A FOLHA é sempre clara: ela vira papel. Não recebe variante dark. */}
        <div ref={ref} className="mx-auto max-w-3xl bg-white p-10 text-zinc-800 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="mt-7 mb-3 flex items-baseline gap-3 border-b border-zinc-200 pb-1.5 first:mt-0">
      <span className="text-sm font-bold text-zinc-400">{n}</span>
      <span className="text-lg font-bold text-zinc-900">{children}</span>
    </h2>
  );
}
function Linha({ k, v, forte }: { k: string; v: string; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 py-1.5 last:border-0">
      <span className={`text-[13px] ${forte ? 'font-semibold text-zinc-900' : 'text-zinc-600'}`}>{k}</span>
      <span className={`text-[13px] tabular-nums ${forte ? 'text-base font-bold text-zinc-900' : 'font-medium text-zinc-800'}`}>{v}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────── MEMÓRIA DE CÁLCULO
export function MemoriaCalculoRevisional({
  res, auditoria, extraido, nome, onClose,
}: {
  res: ResultadoRevisional;
  auditoria: AuditoriaContrato | null;
  extraido: ExtracaoContrato | null;
  nome: string;
  onClose?: () => void;
}) {
  const cfg = res.config;
  return (
    <Folha titulo="Memória de cálculo" arquivo={`Memoria de calculo - ${nome || 'caso'}`} onClose={onClose}>
      <p className="text-[11px] font-bold uppercase tracking-[3px] text-zinc-400">Memória de cálculo</p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900">Revisional de contrato bancário</h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        {nome || 'Caso'}{extraido?.banco ? ` · ${extraido.banco}` : ''}{extraido?.numeroContrato ? ` · ${extraido.numeroContrato}` : ''}
      </p>

      <H n="01">Premissas do cálculo</H>
      <Linha k="Modalidade (série do BACEN)" v={res.modalidade.label} />
      <Linha k="Valor liberado / financiado" v={brl(cfg.valorLiberado)} />
      <Linha k="Parcela cobrada" v={brl(cfg.valorParcela)} />
      <Linha k="Prazo" v={`${cfg.numeroParcelas} parcelas · ${cfg.parcelasPagas} já pagas`} />
      <Linha k="Contratação" v={cfg.dataContratacao.split('-').reverse().join('/')} />
      <Linha k="Data-base" v={cfg.dataBase.split('-').reverse().join('/')} />
      <Linha k="Índice de correção" v={cfg.corrigir ? cfg.indiceCorrecao : 'sem correção'} />
      <Linha k="Restituição" v={cfg.dobro ? `em dobro (CDC 42)${cfg.modulacaoStj ? ', modulada em 30/03/2021' : ''}` : 'simples'} />

      <H n="02">Taxas apuradas</H>
      <Linha k="Taxa praticada pelo contrato" v={`${pctF(res.taxas.contratoMensalPct)} a.m. · ${pctF(res.taxas.contratoAnualPct, 1)} a.a.`} />
      <Linha k={`Taxa média do BACEN${res.taxas.mes ? ` (${res.taxas.mes})` : ''}`} v={`${pctF(res.taxas.taxaMediaBacenPct)} a.m.`} />
      <Linha k="Taxa de referência adotada" v={`${pctF(res.taxas.referenciaMensalPct)} a.m. · multiplicador ${res.taxas.multiplicador}`} />
      <Linha k="Veredito" v={res.taxas.abusivo ? `ACIMA da média em ${pctF(res.taxas.excedentePct, 1)}` : 'ABAIXO da média de mercado'} forte />
      <p className="mt-2 text-[11px] text-zinc-500">Fonte: {res.taxas.fonte}.</p>

      {auditoria && (
        <>
          <H n="03">Auditoria do instrumento</H>
          <Linha k="Taxa escrita no contrato" v={auditoria.divergenciaTaxa ? `${pctF(auditoria.divergenciaTaxa.escritaPct)} a.m.` : 'não informada'} />
          <Linha k="Taxa praticada (por período)" v={`${pctF(auditoria.taxaPeriodicaMensalPct)} a.m.`} />
          <Linha k="CET apurado sobre o líquido liberado" v={`${pctF(auditoria.cetAnualPct, 2)} a.a.`} />
          <Linha k="Líquido efetivamente liberado" v={brl(auditoria.valorLiberadoLiquido)} />
          <Linha k="Encargos somados ao principal" v={brl(auditoria.encargosTotais)} />
          <Linha k="Carência até a 1ª parcela" v={`${auditoria.carenciaDias} dias`} />
          <Linha k="Capitalização mensal" v={auditoria.capitalizacao.pactuada == null ? 'não apurável' : auditoria.capitalizacao.pactuada ? `pactuada (anual ${pctF(auditoria.capitalizacao.anualContratadaPct)} > duodécuplo ${pctF(auditoria.capitalizacao.duodecuploPct)})` : `SEM pactuação expressa (Súm. 539 e 541/STJ)`} />
        </>
      )}

      <H n="04">Resultado</H>
      <Linha k="Parcela cobrada" v={brl(res.resumo.parcelaContrato)} />
      <Linha k="Parcela recalculada pela taxa de referência" v={brl(res.resumo.parcelaRecalculada)} />
      <Linha k="Diferença por parcela" v={brl(res.resumo.diferencaParcela)} />
      <Linha k="Total pago a mais (nominal)" v={brl(res.resumo.totalPagoAMais)} />
      <Linha k="Economia no contrato inteiro" v={brl(res.resumo.economiaTotal)} />
      <Linha k="Restituição corrigida" v={brl(res.resumo.restituicaoCorrigida)} />
      <Linha k="Restituição atualizada" v={brl(res.resumo.restituicaoAtualizada)} forte />

      <H n="05">Planilha parcela a parcela</H>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-zinc-500">
            <th className="py-1.5 pr-2 font-semibold">#</th>
            <th className="py-1.5 pr-2 font-semibold">Vencimento</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Cobrada</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Justa</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Diferença</th>
            <th className="py-1.5 text-right font-semibold">Restituir</th>
          </tr>
        </thead>
        <tbody>
          {res.linhas.map((l) => (
            <tr key={l.numero} className="border-b border-zinc-100">
              <td className="py-1 pr-2 text-zinc-400">{l.numero}</td>
              <td className="py-1 pr-2">{l.data.split('-').reverse().join('/')}{l.paga ? ' · paga' : ''}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{brl(l.parcelaContrato)}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-zinc-500">{brl(l.parcelaRecalculada)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{brl(l.diferenca)}</td>
              <td className="py-1 text-right tabular-nums font-medium">{l.paga && l.valorAtualizado > 0 ? brl(l.valorAtualizado) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 border-t border-zinc-200 pt-3 text-[10.5px] leading-relaxed text-zinc-500">
        Frider Andrade | Advogados. Cálculo sobre o contrato apresentado e a série temporal oficial do Banco Central.
        A conferência contra a via original e contra o extrato de pagamentos é obrigatória antes do ajuizamento.
        Não constitui promessa de resultado — vedada pelo art. 41 do Código de Ética e Disciplina da OAB.
      </p>
    </Folha>
  );
}

// ─────────────────────────────────────────────────── PARECER INTERNO

export function ParecerInternoRevisional({
  res, auditoria, extraido, irregs, nome, onClose,
}: {
  res: ResultadoRevisional;
  auditoria: AuditoriaContrato | null;
  extraido: ExtracaoContrato | null;
  irregs: IrregularidadeContrato[];
  nome: string;
  onClose?: () => void;
}) {
  const a = useMemo(() => {
    const cfg = res.config;
    const n = cfg.numeroParcelas;
    const pagas = Math.min(cfg.parcelasPagas, n);
    const vincendas = Math.max(0, n - pagas);

    // Entram só as rubricas SOMÁVEIS (o motor marca quais são).
    const teses = irregs
      .filter((x) => x.somavel !== false && brlNum(x.valor) > 0)
      .map((x) => ({
        rubrica: x.rubrica || x.tipo,
        confianca: x.confianca,
        fundamento: x.fundamento,
        ...porTese(res, brlNum(x.valor)),
      }));

    // A tese de juros tem conta própria (vem do motor da revisional).
    const economiaFuturaJuros = Math.max(0, res.resumo.economiaTotal - res.resumo.totalPagoAMais);
    const teseJuros = res.taxas.abusivo
      ? {
          rubrica: 'Juros acima da média de mercado',
          confianca: 'alta' as const,
          proveito: res.resumo.restituicaoAtualizada + economiaFuturaJuros,
          restituicaoDobro: res.resumo.restituicaoAtualizada,
          restituicaoSimples: res.resumo.restituicaoAtualizada,
          economiaFutura: economiaFuturaJuros,
          reducao: res.resumo.diferencaParcela,
          principal: 0,
        }
      : null;

    const todas = [...(teseJuros ? [teseJuros] : []), ...teses];
    const proveito = Math.round(todas.reduce((s, t) => s + t.proveito, 0));
    const maior = todas.reduce((m, t) => (t.proveito > m ? t.proveito : m), 0);
    const concentracao = proveito > 0 ? (maior / proveito) * 100 : 0;

    // Fora da conta: o que foi conferido e NÃO vira pedido com valor.
    const fora: { o: string; porque: string }[] = [];
    if (!res.taxas.abusivo)
      fora.push({ o: 'Juros remuneratórios', porque: `o contrato pratica ${pctF(res.taxas.contratoMensalPct)} a.m. contra a média de ${pctF(res.taxas.referenciaMensalPct)} a.m. do BACEN — está abaixo do mercado` });
    if (auditoria?.capitalizacao.pactuada === true)
      fora.push({ o: 'Capitalização de juros', porque: `a taxa anual (${pctF(auditoria.capitalizacao.anualContratadaPct)}) supera o duodécuplo da mensal (${pctF(auditoria.capitalizacao.duodecuploPct)}): pactuação expressa, Súmulas 539 e 541 do STJ` });
    if (auditoria?.divergenciaTaxa && auditoria.divergenciaTaxa.diferencaPp <= 0.01)
      fora.push({ o: 'Taxa praticada maior que a escrita', porque: `diferença de ${auditoria.divergenciaTaxa.diferencaPp.toFixed(3).replace('.', ',')} ponto percentual — arredondamento, não cobrança a maior` });
    if (auditoria?.divergenciaCet && auditoria.divergenciaCet.diferencaPp <= 0)
      fora.push({ o: 'CET informado a menor', porque: `declarou ${pctF(auditoria.divergenciaCet.escritaPct)} a.a. contra ${pctF(auditoria.divergenciaCet.praticadaPct)} apurados: informou a maior` });
    for (const x of irregs.filter((y) => y.somavel === false)) {
      if (x.rubrica === 'Juros embutidos nos encargos financiados')
        fora.push({ o: `${x.rubrica} (${x.valor})`, porque: 'já está dentro do que cada rubrica acima devolve — somar de novo contaria o mesmo dinheiro duas vezes' });
      else if (!brlNum(x.valor))
        fora.push({ o: x.rubrica || x.tipo, porque: 'sem valor apurável com os documentos de hoje' });
    }

    const veredito = proveito < 5_000 ? 'DECLINAR' : proveito < 15_000 ? 'CONDICIONAL' : 'ACEITAR';
    // 🚨 REGRA DA CASA: o contratual é 40% quando o escritório assume o risco
    // inteiro. HAVENDO ENTRADA no ato, o êxito cai para 30% — é a entrada que
    // compra a redução, porque ela paga o trabalho ganhe ou perca.
    const entrada = Math.max(1_500, Math.round((proveito * 0.2) / 100) * 100);
    const PCT_EXITO_COM_ENTRADA = 0.30;
    const PCT_EXITO_SEM_ENTRADA = 0.40;
    const exito = Math.round(proveito * PCT_EXITO_COM_ENTRADA);
    // 🚨 A ENTRADA É ADIANTAMENTO DO ÊXITO, NÃO ADICIONAL. Somadas, num caso
    // pequeno o escritório ficava com MAIS que o cliente (56% de um proveito de
    // R$ 8 mil). O total é o maior dos dois; no fim paga-se só o saldo.
    const saldo = Math.max(0, exito - entrada);
    const receita = Math.max(entrada, exito);
    const liquidoCliente = proveito - receita;
    const pctEscritorio = proveito > 0 ? (receita / proveito) * 100 : 0;
    const exitoSemEntrada = Math.round(proveito * PCT_EXITO_SEM_ENTRADA);
    return {
      todas, proveito, concentracao, fora, veredito, pagas, vincendas, dobro: cfg.dobro,
      entrada, exito, saldo, receita, liquidoCliente, pctEscritorio, exitoSemEntrada,
    };
  }, [res, irregs, auditoria]);

  const cor =
    a.veredito === 'ACEITAR' ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
      : a.veredito === 'CONDICIONAL' ? 'bg-amber-50 border-amber-300 text-amber-900'
        : 'bg-red-50 border-red-300 text-red-800';

  return (
    <Folha titulo="Parecer interno — vale a pena pegar?" arquivo={`Parecer interno - ${nome || 'caso'}`} onClose={onClose}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-zinc-400">Uso interno · não entregar ao cliente</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Parecer de viabilidade</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            {nome || 'Caso'}{extraido?.banco ? ` · ${extraido.banco}` : ''}
          </p>
        </div>
        <div className={`shrink-0 rounded-xl border-2 px-5 py-3 text-center ${cor}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Recomendação</p>
          <p className="text-xl font-bold">{a.veredito}</p>
        </div>
      </div>

      <H n="01">O que é irregular e cabe ação</H>
      {a.todas.length === 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
          Nenhuma rubrica irregular foi apurada neste contrato. Não há pedido com valor a deduzir.
        </p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-[10.5px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Rubrica</th>
              <th className="py-2 pr-3 text-right font-semibold">Cobrado</th>
              <th className="py-2 pr-3 text-right font-semibold">Cai da parcela</th>
              <th className="py-2 pr-3 text-right font-semibold">{a.dobro ? 'Devolve em dobro' : 'Devolve'}</th>
              <th className="py-2 pr-3 text-right font-semibold">Economia futura</th>
              <th className="py-2 text-right font-semibold">O cliente recebe</th>
            </tr>
          </thead>
          <tbody>
            {a.todas.map((t) => (
              <tr key={t.rubrica} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{t.rubrica}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">{t.principal > 0 ? brl(t.principal) : '—'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{brl(t.reducao)}/mês</td>
                <td className="py-2 pr-3 text-right tabular-nums">{brl(a.dobro ? t.restituicaoDobro : (t as { restituicaoSimples?: number }).restituicaoSimples ?? t.restituicaoDobro)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{brl(t.economiaFutura)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-zinc-900">{brl(t.proveito)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-300">
              <td className="py-2 pr-3 font-bold text-zinc-900" colSpan={5}>Proveito econômico estimado</td>
              <td className="py-2 text-right text-base font-bold tabular-nums text-zinc-900">{brl(a.proveito)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Base: {a.pagas} parcelas já vencidas e {a.vincendas} a vencer. Tirar a rubrica do principal reduz a parcela;
        a redução vezes as parcelas pagas é o que se repete {a.dobro ? 'em dobro (art. 42, § único, do CDC)' : 'na forma simples'},
        e vezes as vincendas é a economia futura. <b>O juro que incidiu sobre a rubrica já está nessa redução</b> — por isso não aparece como linha à parte.
      </p>

      <H n="02">O que NÃO entra na conta</H>
      {a.fora.length === 0 ? (
        <p className="text-[13px] text-zinc-600">Nada foi descartado na auditoria.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {a.fora.map((f) => (
            <li key={f.o} className="flex gap-3 border-b border-zinc-100 pb-2 last:border-0 text-[13px]">
              <span className="mt-0.5 shrink-0 text-zinc-400">✕</span>
              <span><b className="text-zinc-900">{f.o}</b> — <span className="text-zinc-600">{f.porque}</span></span>
            </li>
          ))}
        </ul>
      )}

      <H n="03">Risco de concentração</H>
      <p className="text-[13px] leading-relaxed text-zinc-700">
        A maior tese responde por <b>{a.concentracao.toFixed(0)}%</b> do proveito.
        {a.concentracao > 70
          ? ' Acima de 70%: se ela cair, o caso perde quase todo o valor. Não ancorar a expectativa do cliente nela.'
          : ' Distribuição aceitável entre as teses.'}
      </p>

      <H n="04">Honorários para o caso fechar</H>
      <Linha k="Entrada (no ato, adiantamento do êxito)" v={brl(a.entrada)} />
      <Linha k="Êxito sobre o proveito — COM entrada" v={`30% · ${brl(a.exito)}`} />
      <Linha k="Saldo a pagar no fim (êxito − entrada)" v={brl(a.saldo)} />
      <Linha k={`Receita do escritório (${a.pctEscritorio.toFixed(0)}% do proveito)`} v={brl(a.receita)} />
      <Linha k="Fica com o cliente" v={brl(a.liquidoCliente)} forte />
      {a.pctEscritorio > 50 && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[12px] font-semibold text-red-800">
          ⚠ Nesta configuração o escritório fica com {a.pctEscritorio.toFixed(0)}% do proveito — mais que o cliente.
          Reveja a entrada ou o percentual antes de propor.
        </p>
      )}
      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[12px] leading-relaxed text-zinc-700">
          <b>Regra da casa:</b> o contratual é <b>40%</b> quando o escritório assume o risco inteiro, sem entrada
          — aqui seriam {brl(a.exitoSemEntrada)}. <b>Havendo entrada no ato, o êxito cai para 30%</b>: é a entrada
          que compra a redução, porque ela paga o trabalho ganhe ou perca.
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Art. 23 do Estatuto da OAB: a sucumbência é do advogado e não entra no cálculo do contratual.
        Custas, taxa judiciária e perícia são do cliente; o escritório não as absorve.
      </p>

      <H n="05">O que pesa contra</H>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-zinc-700">
        {a.fora.slice(0, 3).map((f) => <li key={f.o}>{f.o}: {f.porque}.</li>)}
        <li>Risco de sucumbência entre 10% e 20% do valor da causa, por conta do cliente.</li>
        <li>Prazo realista de 12 a 24 meses em primeira instância, com acompanhamento integral.</li>
      </ul>

      <H n="06">Conclusão</H>
      <p className="text-[13px] leading-relaxed text-zinc-700">
        {a.veredito === 'DECLINAR' && <>Proveito de {brl(a.proveito)} não sustenta uma ação cível completa no padrão de honorários da casa. <b>Recomenda-se declinar</b> ou encaminhar para acordo extrajudicial direto.</>}
        {a.veredito === 'CONDICIONAL' && <>Caso pequeno: proveito de {brl(a.proveito)}. <b>Só vale com a entrada paga no ato</b> — ela cobre o trabalho independentemente do desfecho. Se o cliente não aceitar a entrada, declinar.</>}
        {a.veredito === 'ACEITAR' && <>Proveito de {brl(a.proveito)} comporta a estrutura da ação. <b>Recomenda-se aceitar</b>, com entrada no ato e êxito sobre o proveito.</>}
      </p>

      <p className="mt-6 border-t border-zinc-200 pt-3 text-[10.5px] leading-relaxed text-zinc-500">
        Documento de uso interno do escritório, para decisão de aceitação de causa. Não é parecer ao cliente
        e não deve ser entregue a ele. Valores estimados sobre os dados disponíveis nesta data.
      </p>
    </Folha>
  );
}
