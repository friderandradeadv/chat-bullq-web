'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Eye, Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
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
  onClose: () => void;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-600 dark:bg-[#292F31]">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => gerar(true)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {ocupado === 'ver' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Eye className="h-4 w-4" /> Ver PDF</>}
          </button>
          <button onClick={() => gerar(false)} disabled={ocupado !== null} className="inline-flex items-center gap-1 rounded-lg border border-blue-500/50 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:text-blue-400 dark:hover:bg-blue-500/10">
            {ocupado === 'baixar' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4" /> Baixar</>}
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"><Printer className="h-4 w-4" /> Imprimir</button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
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
  onClose: () => void;
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
  onClose: () => void;
}) {
  const a = useMemo(() => {
    const brlNum = (v: string) =>
      Number(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const rubricas = irregs.map((i) => ({ tipo: i.tipo, valor: brlNum(i.valor), confianca: i.confianca }));
    const somaRubricas = rubricas.reduce((s, r) => s + r.valor, 0);
    const economiaFutura = Math.max(0, res.resumo.economiaTotal - res.resumo.totalPagoAMais);
    const proveitoJuros = res.taxas.abusivo ? res.resumo.restituicaoAtualizada + economiaFutura : 0;
    const proveito = Math.round(proveitoJuros + somaRubricas);
    const maior = rubricas.reduce((m, r) => (r.valor > m ? r.valor : m), proveitoJuros);
    const concentracao = proveito > 0 ? (maior / proveito) * 100 : 0;
    // Faixas decididas pelo custo real de uma ação cível completa (12 a 24 meses).
    const veredito =
      proveito < 5_000 ? 'DECLINAR' : proveito < 15_000 ? 'CONDICIONAL' : 'ACEITAR';
    const entradaMinima = Math.max(1_500, Math.round((proveito * 0.2) / 100) * 100);
    return { rubricas, somaRubricas, proveitoJuros, proveito, concentracao, veredito, entradaMinima, economiaFutura };
  }, [res, irregs]);

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

      <H n="01">Proveito econômico</H>
      <Linha k="Pela tese de juros (acima da média do BACEN)" v={a.proveitoJuros > 0 ? brl(a.proveitoJuros) : 'não há — contrato abaixo da média'} />
      {a.rubricas.map((r) => (
        <Linha key={r.tipo} k={`${r.tipo} (confiança ${r.confianca})`} v={r.valor > 0 ? brl(r.valor) : 'sem valor apurado'} />
      ))}
      <Linha k="Proveito econômico estimado" v={brl(a.proveito)} forte />

      <H n="02">Risco de concentração</H>
      <p className="text-[13px] leading-relaxed text-zinc-700">
        A maior rubrica responde por <b>{a.concentracao.toFixed(0)}%</b> do proveito.
        {a.concentracao > 70
          ? ' Acima de 70%: se essa tese cair, o caso perde quase todo o valor. Não ancorar a expectativa do cliente nela.'
          : ' Distribuição aceitável entre as teses.'}
      </p>

      <H n="03">Honorários mínimos para o caso fechar</H>
      <Linha k="Entrada sugerida (no ato, não reembolsável)" v={brl(a.entradaMinima)} />
      <Linha k="Êxito sugerido sobre o proveito" v="40% (contratual da casa)" />
      <Linha k="Receita estimada do escritório" v={brl(Math.round(a.proveito * 0.4))} />
      <Linha k="Fica com o cliente" v={brl(Math.round(a.proveito * 0.6))} />
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Base: art. 23 do Estatuto da OAB — a sucumbência é do advogado e não entra no cálculo do contratual.
        Custas, taxa judiciária e perícia são do cliente; o escritório não as absorve.
      </p>

      <H n="04">O que pesa contra</H>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-zinc-700">
        {!res.taxas.abusivo && <li>A tese de juros abusivos <b>não existe</b>: o contrato pratica {pctF(res.taxas.contratoMensalPct)} a.m. contra média de {pctF(res.taxas.referenciaMensalPct)} a.m. Pedi-la entrega ao banco o argumento mais fácil da contestação.</li>}
        {auditoria?.capitalizacao.pactuada === true && <li>Capitalização expressamente pactuada (anual supera o duodécuplo) — Súmulas 539 e 541 do STJ afastam o anatocismo.</li>}
        {auditoria?.divergenciaCet && auditoria.divergenciaCet.diferencaPp <= 0 && <li>O CET foi declarado <b>a maior</b> que o apurado: não há vício de informação a explorar.</li>}
        <li>Risco de sucumbência entre 10% e 20% do valor da causa, por conta do cliente.</li>
        <li>Prazo realista de 12 a 24 meses em primeira instância, com acompanhamento integral.</li>
      </ul>

      <H n="05">Conclusão</H>
      <p className="text-[13px] leading-relaxed text-zinc-700">
        {a.veredito === 'DECLINAR' && <>Proveito de {brl(a.proveito)} não sustenta uma ação cível completa no padrão de honorários da casa. <b>Recomenda-se declinar</b> ou encaminhar para acordo extrajudicial direto.</>}
        {a.veredito === 'CONDICIONAL' && <>Caso pequeno: proveito de {brl(a.proveito)}. <b>Só vale com a entrada paga no ato</b> — ela é o que cobre o trabalho independentemente do desfecho. Se o cliente não aceitar a entrada, declinar.</>}
        {a.veredito === 'ACEITAR' && <>Proveito de {brl(a.proveito)} comporta a estrutura da ação. <b>Recomenda-se aceitar</b>, com entrada no ato e êxito sobre o proveito.</>}
      </p>

      <p className="mt-6 border-t border-zinc-200 pt-3 text-[10.5px] leading-relaxed text-zinc-500">
        Documento de uso interno do escritório, para decisão de aceitação de causa. Não é parecer ao cliente
        e não deve ser entregue a ele. Valores estimados sobre os dados disponíveis nesta data.
      </p>
    </Folha>
  );
}
