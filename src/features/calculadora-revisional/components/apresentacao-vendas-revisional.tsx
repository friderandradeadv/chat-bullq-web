'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Eye, FileText, Loader2, MessageCircle, Printer, Send, Sliders, X } from 'lucide-react';
import { toast } from 'sonner';
// 🚨 Esta tela fica FORA do layout do dashboard, onde mora o alternador de
// tema. Sem ele aqui, o claro/escuro some para quem abre o documento.
import { ThemeToggle } from '@/features/auth/components/theme-toggle';
import { inboxService, type Conversation } from '@/features/inbox/services/inbox.service';
import { useAuthStore } from '@/stores/auth-store';
import { channelsService, type Channel } from '@/features/channels/services/channels.service';

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
  const [fone, setFone] = useState('');
  const [msgs, setMsgs] = useState<string[] | null>(null); // null = ainda não editadas à mão
  const { user } = useAuthStore();
  const [canais, setCanais] = useState<Channel[]>([]);
  // Escolha do destinatário: conversa do hub (padrão) ou número digitado.
  const [modo, setModo] = useState<'hub' | 'numero'>('hub');
  const [soMinhas, setSoMinhas] = useState(true);
  const [status, setStatus] = useState<'ATIVAS' | 'PENDING' | 'OPEN' | 'WAITING' | 'TODAS'>('ATIVAS');
  const [busca, setBusca] = useState('');
  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [escolhida, setEscolhida] = useState<Conversation | null>(null);
  const [anexarPdf, setAnexarPdf] = useState(true);
  const [canalId, setCanalId] = useState('');
  const [enviando, setEnviando] = useState<number | null>(null); // índice em curso
  const [enviandoPdf, setEnviandoPdf] = useState(false);

  /**
   * Conversas do hub para escolher o destinatário.
   *
   * "ATIVAS" = PENDING + OPEN + WAITING: a conversa que está viva, de qualquer
   * forma. CLOSED fica de fora porque mandar proposta para conversa encerrada
   * reabre atendimento sem que ninguém esteja esperando.
   */
  useEffect(() => {
    if (modo !== 'hub') return;
    let vivo = true;
    setCarregando(true);
    const base: Record<string, string> = { limit: '40', archived: 'exclude', groups: 'exclude' };
    if (soMinhas && user?.id) base.assignedToId = user.id;
    if (busca.trim()) base.search = busca.trim();
    const pedidos =
      status === 'ATIVAS'
        ? ['PENDING', 'OPEN', 'WAITING'].map((st) => inboxService.getConversations({ ...base, status: st }))
        : [inboxService.getConversations(status === 'TODAS' ? base : { ...base, status })];
    Promise.all(pedidos)
      .then((rs) => {
        if (!vivo) return;
        const todas = rs.flatMap((r) => r.conversations ?? []);
        const vistas = new Set<string>();
        setConversas(
          todas
            .filter((c) => (vistas.has(c.id) ? false : (vistas.add(c.id), true)))
            .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
        );
      })
      .catch(() => vivo && setConversas([]))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [modo, soMinhas, status, busca, user?.id]);

  // Canais de WhatsApp ativos — é por um deles que a proposta sai, com o número
  // oficial do escritório, e não pelo WhatsApp pessoal de quem está na tela.
  useEffect(() => {
    channelsService
      .list()
      .then((cs) => {
        const wpp = cs.filter((c) => c.isActive && /whatsapp/i.test(c.type));
        setCanais(wpp);
        if (wpp.length) setCanalId(wpp[0].id);
      })
      .catch(() => { /* sem canal: sobra o wa.me */ });
  }, []);
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

  /** Monta o PDF numa página só, do tamanho exato dos slides. Serve aos três
   *  usos: ver, baixar e anexar no envio pelo hub. */
  const montarPdf = async () => {
    const el = slideRef.current;
    if (!el) throw new Error('sem slides');
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas-pro'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const wmm = 210;
    const hmm = Math.max(297, (canvas.height * wmm) / canvas.width);
    const pdf = new jsPDF({ unit: 'mm', format: [wmm, hmm], orientation: 'portrait' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wmm, hmm);
    return pdf;
  };

  /**
   * 🚨 NOME DE ARQUIVO SEM ESPAÇO. A Evolution reprova a URL da mídia no
   * `isURL` antes mesmo de baixar, e a falha sai muda ("Falhou ao enviar").
   * Ver memória `evolution-reprova-url-midia-com-espaco`.
   */
  const nomeArquivoPdf = () => {
    const base = (dados.cliente || 'cliente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `proposta-revisional-${base || 'cliente'}.pdf`;
  };

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
      if (ver) {
        // Abre para CONFERIR antes de decidir salvar — o visualizador do
        // navegador já traz o botão de download.
        const url = URL.createObjectURL(pdf.output('blob'));
        const aba = window.open(url, '_blank');
        if (!aba) toast.error('O navegador bloqueou a aba. Libere o pop-up para este site.');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        pdf.save(nomeArquivoPdf());
      }
    } catch {
      toast.error('Não consegui gerar o PDF. Use "Imprimir" e salve como PDF.');
    } finally {
      setOcupado(null);
    }
  };

  /**
   * A proposta em MENSAGENS CURTAS, não num bloco só.
   *
   * 🚨 PAREDÃO DE TEXTO NÃO SE LÊ NO WHATSAPP. O cliente abre, vê o tamanho e
   * deixa para depois. Em bolhas curtas ele lê uma, responde ou segue — e cada
   * bolha carrega UMA ideia: quem fala, o que não cabe, o que cabe, quanto dá,
   * as duas opções, as ressalvas, a pergunta.
   *
   * 🚨 A ÚLTIMA É SEMPRE PERGUNTA FECHADA. "Opção 1 ou opção 2" faz responder;
   * "estou à disposição" encerra a conversa.
   */
  const mensagensPadrao = useMemo(() => {
    const primeiro = (dados.cliente || '').trim().split(/\s+/)[0] || 'tudo bem';
    const M: string[] = [];
    // "AYMORÉ ... S.A." já termina em ponto: somar outro vira "S.A..".
    const credor = (dados.credor || '').trim().replace(/\.$/, '');
    M.push(`Olá, ${primeiro}! Aqui é do escritório Frider Andrade Advogados. Terminei a análise do seu contrato com o ${credor}.`);
    if (dados.afastadas.length) {
      M.push(
        'Começo pelo que *não* dá para pedir, porque é importante você saber:\n' +
        dados.afastadas.slice(0, 3).map((a) => `• ${a.o} — ${a.porque}`).join('\n'),
      );
    }
    if (dados.teses.length) {
      M.push(
        'Agora o que encontrei de irregular e cabe ação:\n' +
        dados.teses.map((t) => (t.cobrado > 0 ? `• ${t.rubrica} — o banco cobrou ${fmtBRL(t.cobrado)}` : `• ${t.rubrica}`)).join('\n'),
      );
    }
    const queda = dados.parcelaAtual - dados.parcelaNova > 0.5
      ? ` Se o pedido for acolhido, sua parcela cairia de ${fmtBRL(dados.parcelaAtual)} para cerca de ${fmtBRL(dados.parcelaNova)}.`
      : '';
    M.push(`Pela minha estimativa, dá para *buscar cerca de ${fmtBRL(c.P)}*, somando a devolução do que você já pagou e a redução das parcelas que faltam.${queda}`);
    M.push(
      'Sobre os honorários, você escolhe:\n\n' +
      `*OPÇÃO 1 — entrada + êxito*\nVocê paga ${fmtBRL(entradaPadrao)} agora e, no fim, ${pct(pctExitoPadrao)} do que vier a receber, já abatida a entrada.\n\n` +
      '*OPÇÃO 2 — meio a meio*\nVocê não paga nada agora. No fim, dividimos meio a meio o que você vier a receber.',
    );
    M.push('A diferença é só *quando* você paga: na 1 a entrada barateia o total, porque você divide o risco com o escritório; na 2 nós só recebemos se você vier a receber.');
    M.push('Dois pontos importantes: esses números são *estimativa*, não garantia — eu não posso prometer resultado, e o valor só se conhece na sentença. E até sair a decisão, a parcela continua sendo paga normalmente.');
    M.push('Me responde aqui: vai ser a *OPÇÃO 1* ou a *OPÇÃO 2*? Com a sua resposta eu já mando o contrato e a procuração para assinatura digital e começamos.');
    return M;
  }, [dados, c.P, entradaPadrao, pctExitoPadrao]);

  const mensagens = msgs ?? mensagensPadrao;
  const foraDeHora = (() => {
    const h = new Date().getHours();
    return h < 8 || h >= 19;
  })();

  const numeroLimpo = () => {
    const d = fone.replace(/\D/g, '');
    if (d.length < 10) return null;
    return d.startsWith('55') ? d : `55${d}`;
  };

  /** Abre a conversa já com a PRIMEIRA mensagem; as outras vão pelo copiar. */
  const abrirWhatsapp = (texto: string) => {
    const numero = numeroLimpo();
    if (!numero) return toast.error('Informe o WhatsApp do cliente com DDD.');
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  /**
   * Envia as mensagens pelo HUB, em ordem, pelo número oficial.
   *
   * 🚨 NÃO é `oneOff`. O envio ASSUME a conversa e pausa a IA de propósito: a
   * última mensagem pede "opção 1 ou 2", e sem pausar o robô ele responderia o
   * cliente no lugar do advogado.
   *
   * Pausa curta entre uma e outra: a fila do backend é FIFO, mas o provedor
   * entrega mais confiável quando não recebe oito de uma vez.
   */
  const enviarPeloHub = async () => {
    const numero = numeroLimpo();
    if (!escolhida && !numero) return toast.error('Escolha a conversa no hub ou informe o WhatsApp com DDD.');
    if (!escolhida && !canalId) return toast.error('Nenhum canal de WhatsApp ativo para enviar.');
    try {
      setEnviando(0);
      // Conversa escolhida no hub dispensa resolver pelo telefone.
      const conversa = escolhida ?? (await inboxService.startConversation(canalId, numero!));
      for (let i = 0; i < mensagens.length; i++) {
        setEnviando(i + 1);
        await inboxService.sendMessage({
          conversationId: conversa.id,
          type: 'TEXT',
          content: { text: mensagens[i] },
        });
        if (i < mensagens.length - 1) await new Promise((r) => setTimeout(r, 900));
      }
      if (anexarPdf) {
        setEnviando(mensagens.length + 1);
        const pdf = await montarPdf();
        const arquivo = new File([pdf.output('blob')], nomeArquivoPdf(), { type: 'application/pdf' });
        await inboxService.sendMediaMessage(conversa.id, arquivo, 'A proposta completa, em PDF.');
      }
      toast.success(
        anexarPdf
          ? `${mensagens.length} mensagens + o PDF enviados pelo hub`
          : `${mensagens.length} mensagens enviadas pelo hub`,
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Não consegui enviar pelo hub. Use o botão do WhatsApp.');
    } finally {
      setEnviando(null);
    }
  };

  /**
   * Manda SÓ o PDF na conversa. Existe porque o envio real raramente é de uma
   * vez: manda-se o texto, o cliente responde, e o anexo vai depois — ou as
   * mensagens já foram pelo WhatsApp pessoal e falta só o documento.
   */
  const enviarSoPdf = async () => {
    const numero = numeroLimpo();
    if (!escolhida && !numero) return toast.error('Escolha a conversa no hub ou informe o WhatsApp com DDD.');
    if (!escolhida && !canalId) return toast.error('Nenhum canal de WhatsApp ativo para enviar.');
    try {
      setEnviandoPdf(true);
      const conversa = escolhida ?? (await inboxService.startConversation(canalId, numero!));
      const pdf = await montarPdf();
      const arquivo = new File([pdf.output('blob')], nomeArquivoPdf(), { type: 'application/pdf' });
      await inboxService.sendMediaMessage(conversa.id, arquivo, 'A proposta completa, em PDF.');
      toast.success('PDF enviado pelo hub');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Não consegui enviar o PDF pelo hub.');
    } finally {
      setEnviandoPdf(false);
    }
  };

  const copiar = (t: string, aviso = 'Mensagem copiada') => {
    navigator.clipboard.writeText(t).then(() => toast.success(aviso)).catch(() => toast.error('Não consegui copiar'));
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
          <ThemeToggle className="inline-flex items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800" />
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
                    <th className="py-1.5 text-right font-semibold">Você pode receber</th>
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
                <b>Estimativa, não garantia.</b> O valor é maior que o cobrado porque considera os <b>juros</b> que
                incidiram sobre a cobrança durante o contrato, a devolução do que já foi pago e a redução das parcelas
                que faltam — <b>se</b> o pedido for acolhido pelo juízo. Nenhum resultado pode ser prometido
                (art. 41 do Código de Ética e Disciplina da OAB).
              </p>
            </div>
          </Slide>

          {/* 3 · OS NÚMEROS */}
          <Slide>
            <SlideKicker>Os números do seu caso</SlideKicker>
            <div className="rounded-2xl bg-gradient-to-br from-[#1a1206] via-[#2a1d0a] to-[#101820] p-7 ring-1 ring-[#B7791F]/25">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#e0b872]">O que se pode buscar · estimativa</p>
              <p className="mt-1 font-serif text-6xl font-bold leading-none text-white">{fmtBRL(c.P)}</p>
              <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-4">
                <div><p className="text-[11px] uppercase tracking-wide text-white/50">Devolução do que já pagou</p><p className="font-serif text-2xl font-bold text-white">{fmtBRL(dados.restituicao)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-white/50">Redução das parcelas que faltam</p><p className="font-serif text-2xl font-bold text-white">{fmtBRL(dados.economiaFutura)}</p></div>
              </div>
            </div>
            {dados.parcelaAtual - dados.parcelaNova > 0.5 && (
              <div className="mt-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/60 p-7 dark:border-emerald-400/25 dark:bg-emerald-900/10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">A sua parcela</p>
                <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
                  <div><p className="text-xs text-zinc-500">hoje</p><p className="font-serif text-3xl font-bold text-zinc-400 line-through">{fmtBRL(dados.parcelaAtual)}</p></div>
                  <div><p className="text-xs text-zinc-500">se a revisão for acolhida</p><p className="font-serif text-5xl font-bold leading-none text-emerald-700 dark:text-emerald-400">{fmtBRL(dados.parcelaNova)}</p></div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-zinc-500">a menos por mês, no cenário estimado</p>
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
                <p className="mt-3 text-xs text-zinc-500">E no fim, {pct(pctExitoPadrao)} do que vier a receber, já abatida a entrada</p>
                <p className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.saldoPadrao)}<span className="ml-1 text-xs font-normal text-zinc-400">estimado</span></p>
                <div className="mt-auto border-t border-[#B7791F]/20 pt-3">
                  <div className="flex items-baseline justify-between"><span className="text-xs text-zinc-500">Total estimado</span><span className="font-serif text-xl font-bold text-[#B7791F]">{fmtBRL(c.padrao)}</span></div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-xs text-emerald-700 dark:text-emerald-400">Fica com você, do que receber</span><span className="font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(c.liquidoPadrao)}</span></div>
                </div>
              </div>

              {/* OPÇÃO 2 — meio a meio, como na RMC.
                  🚨 SEM VALOR LIQUIDADO. O que se divide é o RESULTADO, e ele só
                  se conhece na sentença. Número fechado aqui vira promessa de
                  resultado — vedada pelo art. 41 do Código de Ética — e ainda
                  prende o escritório a uma projeção que pode não se confirmar. */}
              <div className="flex flex-col rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-600 dark:bg-zinc-800/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Opção 2 · meio a meio</p>
                <p className="mt-2 text-xs text-zinc-500">Você paga agora</p>
                <p className="font-serif text-3xl font-bold text-emerald-700 dark:text-emerald-400">Nada</p>
                <p className="mt-3 text-xs text-zinc-500">E no fim</p>
                <p className="font-serif text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                  Dividimos<br />meio a meio
                </p>
                <div className="mt-auto border-t border-zinc-200 pt-3 dark:border-zinc-600">
                  <div className="flex items-baseline justify-between"><span className="text-xs text-zinc-500">Honorários</span><span className="font-serif text-lg font-bold text-zinc-700 dark:text-zinc-200">metade do resultado</span></div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-xs text-emerald-700 dark:text-emerald-400">Fica com você, do que receber</span><span className="font-serif text-lg font-bold text-emerald-700 dark:text-emerald-400">a outra metade</span></div>
                </div>
              </div>
            </div>

            <ExitoExplica proveito={c.P} pctExito={pctExitoPadrao} exito={c.exitoPadrao} />
            <p className="mt-3 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              A diferença entre as duas é só <b>quando</b> você paga. Na <b>Opção 1</b> a entrada barateia o total,
              porque divide o risco com o escritório. Na <b>Opção 2</b> você não tira nada do bolso agora e o
              escritório só recebe se você receber. Em nenhuma das duas o valor final está fechado:
              <b> o que se divide é o resultado da ação</b>, e ele só se conhece na sentença. Os números desta
              proposta são <b>estimativa técnica</b> — não são, e não podem ser, promessa de resultado.
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
                  <p className="text-[12px] text-white/60">+ {pct(pctExitoPadrao)} do que vier a receber</p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Opção 2</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-white">Nada agora</p>
                  <p className="text-[12px] text-white/60">dividimos meio a meio o que você receber</p>
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

        {/* ── ENVIO AO CLIENTE — no-print: não entra no PDF ── */}
        <div className="no-print mx-auto mt-6 max-w-3xl rounded-2xl border border-emerald-500/30 bg-white p-6 dark:border-emerald-400/20 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Mandar a proposta pelo WhatsApp</p>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {mensagens.length} mensagens curtas, uma ideia em cada. Mande na ordem — a última é a pergunta que faz o cliente responder.
          </p>

          {/* ── DESTINATÁRIO: conversa do hub (padrão) ou número digitado ── */}
          <div className="mt-4 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            {([['hub', 'Escolher do hub'], ['numero', 'Digitar número']] as const).map(([k, rot]) => (
              <button
                key={k}
                onClick={() => { setModo(k); setEscolhida(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${modo === k ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                {rot}
              </button>
            ))}
          </div>

          {modo === 'hub' ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
                  <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-600" />
                  Só as minhas
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[12px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="ATIVAS">Ativas (pendente + aberta + aguardando)</option>
                  <option value="PENDING">Só pendentes</option>
                  <option value="OPEN">Só abertas</option>
                  <option value="WAITING">Só aguardando</option>
                  <option value="TODAS">Todas</option>
                </select>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou telefone"
                  className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                {carregando && <p className="p-3 text-[12px] text-zinc-400">Carregando conversas…</p>}
                {!carregando && conversas.length === 0 && (
                  <p className="p-3 text-[12px] text-zinc-400">Nenhuma conversa com esses filtros. Tire o “só as minhas” ou mude o status.</p>
                )}
                {conversas.map((cv) => {
                  const sel = escolhida?.id === cv.id;
                  return (
                    <button
                      key={cv.id}
                      onClick={() => setEscolhida(sel ? null : cv)}
                      className={`flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-800 ${sel ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COR[cv.status] ?? 'bg-zinc-400'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                          {cv.contact?.name || cv.contact?.phone || 'sem nome'}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-400">
                          {cv.contact?.phone ?? '—'} · {STATUS_ROTULO[cv.status] ?? cv.status}
                          {cv.assignedTo?.name ? ` · ${cv.assignedTo.name}` : ' · sem responsável'}
                        </span>
                      </span>
                      {sel && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={fone}
                onChange={(e) => setFone(e.target.value)}
                placeholder="WhatsApp do cliente com DDD"
                inputMode="tel"
                className="w-60 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {canais.length > 1 && (
                <select
                  value={canalId}
                  onChange={(e) => setCanalId(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {canais.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={enviarPeloHub}
              disabled={enviando !== null || (!escolhida && (!canalId || !fone))}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {enviando !== null
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {enviando > mensagens.length ? 'Enviando o PDF…' : `Enviando ${enviando}/${mensagens.length}…`}</>
                : <><Send className="h-4 w-4" /> Enviar {mensagens.length}{anexarPdf ? ' + PDF' : ''} {escolhida ? `para ${(escolhida.contact?.name || '').split(' ')[0] || 'o contato'}` : 'pelo hub'}</>}
            </button>
            <button
              onClick={enviarSoPdf}
              disabled={enviandoPdf || enviando !== null || (!escolhida && (!canalId || !fone))}
              title="Para quando as mensagens já foram e falta só o anexo"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              {enviandoPdf
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando o PDF…</>
                : <><FileText className="h-4 w-4" /> Enviar só o PDF</>}
            </button>
            <button
              onClick={() => abrirWhatsapp(mensagens[0])}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <MessageCircle className="h-4 w-4" /> Abrir no meu WhatsApp
            </button>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={anexarPdf} onChange={(e) => setAnexarPdf(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-600" />
              Anexar o PDF ao final
            </label>
            {msgs !== null && (
              <button onClick={() => setMsgs(null)} className="text-[12px] text-zinc-400 underline hover:text-zinc-600">
                voltar ao texto gerado
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            {canais.length
              ? 'Pelo hub as oito saem em sequência, do número oficial do escritório, e a conversa fica atribuída a você com a IA pausada — senão o robô responde o cliente no seu lugar. O botão do WhatsApp é a alternativa: abre a conversa no seu número com a 1ª mensagem, e as demais vão pelo copiar.'
              : 'Nenhum canal de WhatsApp ativo encontrado — sobra o envio pelo seu WhatsApp: a 1ª vai pelo botão, as demais pelo copiar de cada bolha.'}
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            {mensagens.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-right text-[11px] font-bold text-zinc-400">{i + 1}</span>
                <textarea
                  value={m}
                  onChange={(e) => {
                    const prox = [...mensagens];
                    prox[i] = e.target.value;
                    setMsgs(prox);
                  }}
                  rows={Math.min(8, m.split('\n').length + 1)}
                  className="flex-1 rounded-xl rounded-tl-sm border border-zinc-200 bg-emerald-50/50 p-3 text-[12.5px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-emerald-900/10 dark:text-zinc-200"
                />
                <button
                  onClick={() => copiar(m, `Mensagem ${i + 1} copiada`)}
                  title={`Copiar a mensagem ${i + 1}`}
                  className="mt-1 shrink-0 rounded-lg border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {foraDeHora && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Fora do horário comercial. Proposta que chega de madrugada costuma ser lida como golpe — vale enviar a partir das 8h.
            </p>
          )}
          <p className="mt-3 text-[11px] text-zinc-400">
            Com “anexar o PDF” marcado, ele vai sozinho depois da última mensagem. O parecer interno NÃO vai junto.
          </p>
        </div>
      </div>
    </div>
  );
}

const STATUS_ROTULO: Record<string, string> = {
  PENDING: 'pendente', OPEN: 'aberta', WAITING: 'aguardando', BOT: 'com o robô', CLOSED: 'encerrada',
};
const STATUS_COR: Record<string, string> = {
  PENDING: 'bg-amber-500', OPEN: 'bg-emerald-500', WAITING: 'bg-sky-500', BOT: 'bg-violet-500', CLOSED: 'bg-zinc-400',
};

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
