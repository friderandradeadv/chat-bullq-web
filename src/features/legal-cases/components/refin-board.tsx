'use client';

/**
 * A CAMPANHA DO REFINANCIAMENTO DO CARTÃO (28/10/2026).
 *
 * Pedido do escritório: oferecer a ação de refin aos clientes da base cuja RMC
 * foi improcedente ou extinta sem mérito. A tese é fato distinto: não se
 * discute a contratação do cartão, discute-se o saldo que o banco refinanciou
 * sozinho.
 *
 * A lista vem da carteira (`resultadoReal` do card) e cada cliente cai numa
 * caixa depois que o hub lê o HISCON da pasta: oferta pronta, HISCON antigo
 * (que não alcança 11/2023), sem HISCON, sem refin.
 *
 * Desde 29/10/2026 a mesma leitura mede também o CHURNING do cliente, e quem
 * tem as duas teses recebe uma mensagem só com as duas. O churning só entra com
 * o veredito AJUIZAR do HISCON.
 *
 * 🚨 O ENVIO É CLIQUE, UM CLIENTE POR VEZ, na conversa que já existe. O botão
 * "analisar" lê documentos; nenhum botão deste quadro fala com mais de um
 * cliente. A inicial contra a Meta afirma ao juízo que os scripts de envio em
 * lote saíram de operação.
 */
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, ScanSearch, Search, Send, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';

const ACCENT = 'rgb(25,118,210)';

type Item = {
  caseId: string; cliente: string; card: string; reu: string | null; resultado: string;
  caixa: string | null; rotulo: string; status: string; resumo: string | null;
  estimativa: { dobro: number; danoMoral: number; total: number; ate: string | null } | null;
  ultimaCompetencia: string | null; temConversa: boolean;
  analisadaEm: string | null; enviadaEm: string | null; cardRefin: string | null;
  churning: { ofertado: boolean; grupo: string | null; contratos: number; veredito: string | null;
    statusNoChurning: string | null; motivo: string | null } | null;
  oferecivel: boolean;
};

/** As seções, na ordem em que o trabalho anda. */
const SECOES: { chave: string; titulo: string; ajuda: string; de: (i: Item) => boolean }[] = [
  { chave: 'pronta', titulo: 'Oferta pronta', ajuda: 'refin e/ou churning medidos no HISCON: leia a mensagem e envie',
    de: (i) => i.oferecivel && (i.status === 'analisada' || i.status === 'nova') },
  { chave: 'enviada', titulo: 'Enviada', ajuda: 'aguardando a resposta do cliente',
    de: (i) => i.oferecivel && i.status === 'enviada' },
  { chave: 'aceita', titulo: 'Aceita', ajuda: 'o card de refin foi para "montar inicial"',
    de: (i) => i.status === 'aceita' },
  { chave: 'hiscon-antigo', titulo: 'Pedir HISCON novo', ajuda: 'o extrato arquivado termina antes de 11/2023',
    de: (i) => i.caixa === 'hiscon-antigo' && !i.oferecivel },
  { chave: 'nova', titulo: 'Não analisada', ajuda: 'o hub ainda não leu o HISCON deste cliente',
    de: (i) => !i.caixa },
  { chave: 'sem-hiscon', titulo: 'Sem HISCON na pasta', ajuda: 'colete o extrato antes',
    de: (i) => i.caixa === 'sem-hiscon' },
  { chave: 'fora', titulo: 'Fora da campanha', ajuda: 'sem refin nem churning viável, refin depois da IN 158, já tem card ou recusou',
    de: (i) => (['sem-refin', 'posterior-in158', 'ja-tem-card'].includes(i.caixa ?? '') && !i.oferecivel)
      || i.status === 'recusada' },
];

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

export function RefinBoard() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState<{ feitos: number; total: number } | null>(null);
  const parar = useRef(false);

  const { data: kanban } = useQuery({
    queryKey: ['legal-cases', 'kanban', 'judicial'],
    queryFn: () => legalCasesService.kanban({ lane: 'judicial' }),
    refetchOnWindowFocus: false,
  });
  const fases = kanban?.phases ?? [];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['refin', 'ofertas'],
    queryFn: () => legalCasesService.quadroDeOfertasRefin(),
    refetchOnWindowFocus: false,
  });

  const itens: Item[] = useMemo(() => {
    const todos = (data?.itens ?? []) as Item[];
    const q = busca.trim().toLowerCase();
    return q ? todos.filter((o) => `${o.cliente} ${o.reu ?? ''} ${o.card}`.toLowerCase().includes(q)) : todos;
  }, [data, busca]);

  const naoAnalisados = itens.filter((i) => !i.caixa);

  /**
   * Lê o HISCON de cada um, UM DE CADA VEZ, e mostra o andamento. Só lê
   * documentos: não fala com cliente nenhum.
   */
  const analisarPendentes = async () => {
    parar.current = false;
    const fila = [...naoAnalisados];
    setAnalisando({ feitos: 0, total: fila.length });
    let erros = 0;
    for (let i = 0; i < fila.length; i++) {
      if (parar.current) break;
      await legalCasesService.analisarOfertaRefin(fila[i].caseId).catch(() => { erros += 1; });
      setAnalisando({ feitos: i + 1, total: fila.length });
      if ((i + 1) % 5 === 0) refetch();
    }
    setAnalisando(null);
    refetch();
    if (erros) toast.error(`${erros} card(s) não puderam ser lidos: veja a pasta do cliente.`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h1 className="text-lg font-semibold text-[#101820] dark:text-zinc-100">Refin</h1>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
          {itens.length}
        </span>
        <p className="text-xs text-[#48626f] dark:text-zinc-400">
          RMC/RCC perdida ou extinta: refin do cartão e churning dos empréstimos como ações novas
        </p>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente ou banco…"
              className="h-8 w-56 rounded-lg border border-[#cfe0ed] bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          {analisando ? (
            <button onClick={() => { parar.current = true; }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs font-semibold text-[#48626f] dark:border-zinc-700 dark:text-zinc-300">
              <Loader2 className="h-3 w-3 animate-spin" /> lendo {analisando.feitos}/{analisando.total}
              <Square className="ml-1 h-3 w-3" /> parar
            </button>
          ) : naoAnalisados.length ? (
            <button onClick={analisarPendentes} title="Lê o HISCON de cada cliente ainda não analisado, um de cada vez. Não envia nada."
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white" style={{ background: ACCENT }}>
              <ScanSearch className="h-3.5 w-3.5" /> Analisar {naoAnalisados.length} pendente{naoAnalisados.length === 1 ? '' : 's'}
            </button>
          ) : null}
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reler
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Lendo a carteira…</p>
      ) : (
        <div className="flex-1 overflow-auto px-4 pb-6">
          {SECOES.map((s) => {
            const lista = itens.filter(s.de);
            if (!lista.length) return null;
            return (
              <section key={s.chave} className="mt-4">
                <div className="flex items-baseline gap-2 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>{s.titulo}</h2>
                  <span className="text-xs font-semibold text-[#48626f] dark:text-zinc-400">{lista.length}</span>
                  <span className="text-[11px] text-[#48626f] dark:text-zinc-500">{s.ajuda}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-[#e3ecf3] dark:border-zinc-800">
                  {lista.map((o) => (
                    <Linha
                      key={o.caseId}
                      o={o}
                      expandido={expandido === o.caseId}
                      onExpandir={() => setExpandido(expandido === o.caseId ? null : o.caseId)}
                      onAbrir={() => setAberto(o.caseId)}
                      onMudou={() => refetch()}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {!itens.length && (
            <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Nenhum card de RMC/RCC perdida ou extinta.</p>
          )}
        </div>
      )}

      {aberto && (
        <CaseDetailDrawer
          caseId={aberto}
          phases={[...phasesOfBoard(fases, 'judicial'), ...phasesOfBoard(fases, 'pre')]}
          onClose={() => { setAberto(null); refetch(); }}
        />
      )}
    </div>
  );
}

/** Uma linha do quadro. Com oferta pronta, abre a mensagem e os botões. */
function Linha({ o, expandido, onExpandir, onAbrir, onMudou }: {
  o: Item; expandido: boolean; onExpandir: () => void; onAbrir: () => void; onMudou: () => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const temOferta = o.oferecivel;
  const temRefin = o.caixa === 'pronta';
  const temChurning = o.churning?.ofertado === true;

  const carregarTexto = async () => {
    if (texto !== null) return;
    const c: any = await legalCasesService.get(o.caseId);
    setTexto(String(c?.metadata?.ofertaRefin?.mensagem ?? ''));
  };

  const analisar = async () => {
    setOcupado(true);
    try {
      await legalCasesService.analisarOfertaRefin(o.caseId);
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler o HISCON da pasta.');
    } finally {
      setOcupado(false);
    }
  };

  /**
   * O ENVIO: a mensagem vai pela conversa que o hub já liga a este cliente, e
   * só depois de enviada a oferta passa a "enviada" (e nasce o card de refin).
   */
  const enviar = async () => {
    if (!texto?.trim()) return;
    setOcupado(true);
    try {
      const c: any = await legalCasesService.get(o.caseId);
      const conversa = c?.clienteConversa;
      if (!conversa?.conversationId) {
        toast.error('Sem conversa vinculada a este cliente: abra o card e vincule o WhatsApp antes.');
        return;
      }
      await inboxService.sendMessage({
        conversationId: conversa.conversationId,
        type: 'text',
        content: { text: texto.trim() },
        oneOff: true,
      });
      await legalCasesService.registrarOfertaRefin(o.caseId, { status: 'enviada', mensagem: texto.trim() });
      toast.success('Oferta enviada ao cliente');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui enviar a mensagem.');
    } finally {
      setOcupado(false);
    }
  };

  const responder = async (status: 'aceita' | 'recusada') => {
    setOcupado(true);
    try {
      await legalCasesService.registrarOfertaRefin(o.caseId, { status });
      toast.success(status === 'aceita'
        ? (temChurning
          ? 'Aceita. O aceite do churning se registra no painel de churning do card (é lá que nascem os cards dos réus).'
          : 'Aceita: o card de refin foi para "montar inicial"')
        : 'Recusa registrada');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui registrar a resposta.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="border-b border-[#eef3f7] last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-[#f8fbfd] dark:hover:bg-zinc-800/40">
        <button
          onClick={() => { if (temOferta) { onExpandir(); carregarTexto().catch(() => setTexto('')); } }}
          className={`shrink-0 text-zinc-400 ${temOferta ? '' : 'invisible'}`}
          aria-label="Abrir a oferta"
        >
          {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onAbrir}>
          <p className="truncate text-sm font-semibold uppercase text-[#101820] dark:text-zinc-100">{o.cliente}</p>
          <p className="truncate text-[11px] text-[#48626f] dark:text-zinc-500">
            × {o.reu ?? 'sem réu'} · ação {o.resultado === 'extinto' ? 'extinta' : 'perdida'}
            {temRefin && o.resumo ? ` · ${o.resumo}` : ''}
            {o.churning && !temChurning && o.churning.motivo ? ` · churning: ${o.churning.motivo}` : ''}
            {o.caixa === 'hiscon-antigo' && o.ultimaCompetencia ? ` · HISCON até ${o.ultimaCompetencia.split('-').reverse().join('/')}` : ''}
          </p>
        </div>
        {temRefin && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: ACCENT }}>
            REFIN
          </span>
        )}
        {temChurning && (
          <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white"
            title={`${o.churning?.contratos} contratos no ${o.churning?.grupo}: veredito ${o.churning?.veredito}`}>
            CHURNING · {o.churning?.grupo}
          </span>
        )}
        {temRefin && o.estimativa ? (
          <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-[#101820] dark:text-zinc-100"
            title={`Dobro dos descontos até ${o.estimativa.ate ?? '?'} + dano moral. Piso: o HISCON termina na emissão.`}>
            {reais(o.estimativa.total)}
          </span>
        ) : null}
        <span className="w-24 shrink-0 text-right text-[11px] text-[#48626f] dark:text-zinc-500">
          {dia(o.enviadaEm) ? `enviada ${dia(o.enviadaEm)}` : dia(o.analisadaEm) ? `lida ${dia(o.analisadaEm)}` : o.rotulo}
        </span>
        {!o.temConversa && <span className="shrink-0 text-[11px] font-semibold text-amber-700 dark:text-amber-400">sem WhatsApp</span>}
        {o.status === 'enviada' ? (
          <span className="flex shrink-0 gap-1">
            <button disabled={ocupado} onClick={() => responder('aceita')}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white disabled:opacity-50">
              <Check className="h-3 w-3" /> aceitou
            </button>
            <button disabled={ocupado} onClick={() => responder('recusada')}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              <X className="h-3 w-3" /> recusou
            </button>
          </span>
        ) : !o.caixa || o.caixa === 'hiscon-antigo' || o.caixa === 'sem-hiscon' ? (
          <button disabled={ocupado} onClick={analisar} title="Lê de novo o HISCON da pasta"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#cfe0ed] px-2 text-xs text-[#48626f] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanSearch className="h-3 w-3" />} ler HISCON
          </button>
        ) : null}
      </div>

      {expandido && temOferta && (
        <div className="space-y-2 bg-[#f8fbfd] px-10 pb-3 pt-1 dark:bg-zinc-900/60">
          {texto === null ? (
            <p className="text-xs text-[#48626f]">Carregando a mensagem…</p>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={o.status !== 'analisada' && o.status !== 'nova'}
              rows={10}
              className="w-full rounded-lg border border-[#cfe0ed] bg-white p-2 text-sm leading-5 text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          )}
          {(o.status === 'analisada' || o.status === 'nova') && (
            <div className="flex items-center gap-2">
              <button disabled={ocupado || !texto?.trim()} onClick={enviar}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: ACCENT }}>
                {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Enviar a {o.cliente.split(' ')[0]} pelo WhatsApp
              </button>
              <span className="text-[11px] text-[#48626f] dark:text-zinc-500">
                vai pela conversa dele
                {temRefin ? '; nasce o card de refin em "informações faltantes"' : ''}
                {temChurning ? '; a oferta de churning do card passa a "enviada"' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
