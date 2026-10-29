'use client';

/**
 * A CAMPANHA DA CARTEIRA QUE PERDEU A RMC (28/10/2026).
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
 * o veredito AJUIZAR do HISCON, e não entra quando já saiu ao cliente por outro
 * card (o cruzamento com o quadro do Churning é feito no servidor).
 *
 * O formato é o do quadro do Churning, a pedido: *"uma visualização parecida,
 * pelo menos"*. Quadro para trabalhar um caso, lista para percorrer cem.
 *
 * 🚨 O ENVIO É CLIQUE, UM CLIENTE POR VEZ, na conversa que já existe. O botão
 * "analisar" lê documentos; nenhum botão deste quadro fala com mais de um
 * cliente. A inicial contra a Meta afirma ao juízo que os scripts de envio em
 * lote saíram de operação. E não se arrasta card: passar de coluna aqui é falar
 * com o cliente.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check, ExternalLink, LayoutGrid, List, Loader2, RefreshCw, ScanSearch, Search, Send, Square, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { VincularContatoCliente } from '@/features/legal-cases/components/vincular-contato-cliente';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';

const ACCENT = 'rgb(25,118,210)';

type Item = {
  caseId: string; cliente: string; card: string; reu: string | null; resultado: string;
  caixa: string | null; rotulo: string; status: string; resumo: string | null;
  estimativa: { dobro: number; danoMoral: number; total: number; ate: string | null } | null;
  /** O foro da inicial pelo pagador do benefício (29/10/2026); null antes de ler de novo o HISCON. */
  foro?: 'jef' | 'jec' | 'estadual' | null;
  pagador?: string | null;
  ultimaCompetencia: string | null; temConversa: boolean;
  analisadaEm: string | null; enviadaEm: string | null; cardRefin: string | null;
  churning: { ofertado: boolean; grupo: string | null; contratos: number; veredito: string | null;
    statusNoChurning: string | null; motivo: string | null } | null;
  oferecivel: boolean;
  /** O churning da mensagem saiu ao cliente por outro card depois da análise. */
  reanalisar?: boolean;
};

const aberta = (i: Item) => i.status === 'analisada' || i.status === 'nova';
const semDocumento = (i: Item) => !i.caixa || i.caixa === 'hiscon-antigo' || i.caixa === 'sem-hiscon';

/** As colunas, na ordem em que o trabalho anda. */
const COLUNAS: { chave: string; titulo: string; ajuda: string; de: (i: Item) => boolean }[] = [
  { chave: 'pronta', titulo: 'OFERTA PRONTA', ajuda: 'refin e/ou churning medidos no HISCON: leia a mensagem e envie',
    de: (i) => i.oferecivel && aberta(i) },
  { chave: 'enviada', titulo: 'ENVIADA', ajuda: 'a oferta foi ao cliente, aguardando resposta',
    de: (i) => i.status === 'enviada' },
  { chave: 'aceita', titulo: 'ACEITA', ajuda: 'o cliente topou; o card de refin vai para "montar inicial"',
    de: (i) => i.status === 'aceita' },
  { chave: 'recusada', titulo: 'RECUSADA', ajuda: 'o cliente disse não',
    de: (i) => i.status === 'recusada' },
  { chave: 'documento', titulo: 'FALTA HISCON', ajuda: 'não analisado, sem HISCON na pasta ou extrato antes de 11/2023',
    de: (i) => !i.oferecivel && aberta(i) && semDocumento(i) },
  { chave: 'fora', titulo: 'FORA', ajuda: 'sem refin nem churning viável, refin depois da IN 158 ou já tem card',
    de: (i) => !i.oferecivel && aberta(i) && !semDocumento(i) },
];

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

export function RefinBoard() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [oferta, setOferta] = useState<string | null>(null);
  const [vincular, setVincular] = useState<{ caseId: string; cliente: string } | null>(null);
  const [analisando, setAnalisando] = useState<{ feitos: number; total: number } | null>(null);
  const parar = useRef(false);

  // Quadro × lista, lembrado no navegador como no quadro do Churning.
  const [modo, setModo] = useState<'quadro' | 'lista'>('quadro');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('refin-modo');
      if (v === 'lista' || v === 'quadro') setModo(v);
    } catch { /* sem storage: fica no quadro */ }
  }, []);
  const trocarModo = (v: 'quadro' | 'lista') => {
    setModo(v);
    try { window.localStorage.setItem('refin-modo', v); } catch { /* idem */ }
  };

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
    return q
      ? todos.filter((o) => `${o.cliente} ${o.reu ?? ''} ${o.card} ${o.churning?.grupo ?? ''}`.toLowerCase().includes(q))
      : todos;
  }, [data, busca]);

  const naoAnalisados = itens.filter((i) => !i.caixa);
  const emOferta = oferta ? itens.find((i) => i.caseId === oferta) ?? null : null;

  /**
   * Lê o HISCON de cada um, UM DE CADA VEZ, e mostra o andamento. Só lê
   * documentos: não fala com cliente nenhum.
   */
  const analisarPendentes = async () => {
    parar.current = false;
    const fila = [...naoAnalisados];
    setAnalisando({ feitos: 0, total: fila.length });
    const erros: string[] = [];
    for (let i = 0; i < fila.length; i++) {
      if (parar.current) break;
      await legalCasesService.analisarOfertaRefin(fila[i].caseId).catch((e: any) => {
        erros.push(`${fila[i].cliente.split(' ')[0]}: ${e?.response?.data?.message || 'não consegui ler o HISCON'}`);
      });
      setAnalisando({ feitos: i + 1, total: fila.length });
      if ((i + 1) % 5 === 0) refetch();
    }
    setAnalisando(null);
    refetch();
    // O motivo de cada um: "veja a pasta" não serve quando falta o réu no card.
    if (erros.length) toast.error(erros.join(' · '), { duration: 15000 });
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
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            {([['quadro', LayoutGrid, 'Quadro'], ['lista', List, 'Lista']] as const).map(([v, Icone, rotulo]) => (
              <button
                key={v}
                onClick={() => trocarModo(v)}
                title={rotulo}
                className={`inline-flex h-8 items-center gap-1 px-2 text-xs font-semibold ${
                  modo === v
                    ? 'bg-[#101820] text-white dark:bg-zinc-200 dark:text-zinc-900'
                    : 'bg-white text-[#48626f] hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}
              >
                <Icone className="h-3.5 w-3.5" /> {rotulo}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reler
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Lendo a carteira…</p>
      ) : modo === 'lista' ? (
        <ListaDeOfertas
          itens={itens}
          onAbrir={setOferta}
          onVincular={(caseId, cliente) => setVincular({ caseId, cliente })}
        />
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {COLUNAS.map((col) => {
            const lista = itens.filter(col.de);
            return (
              <div key={col.chave} className="flex w-[310px] shrink-0 flex-col">
                <div className="flex items-center gap-1.5 px-1 pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>{col.titulo}</h2>
                  <span className="text-xs font-semibold text-[#48626f] dark:text-zinc-400">{lista.length}</span>
                </div>
                <p className="px-1 pb-2 text-[10px] leading-3 text-[#48626f] dark:text-zinc-500">{col.ajuda}</p>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2">
                  {lista.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#cfe0ed] p-4 text-center text-xs text-[#48626f] dark:border-zinc-700 dark:text-zinc-500">
                      Vazio
                    </div>
                  ) : lista.map((o) => (
                    <CardDaOferta
                      key={o.caseId}
                      o={o}
                      onAbrir={() => setOferta(o.caseId)}
                      onVincular={() => setVincular({ caseId: o.caseId, cliente: o.cliente })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emOferta && (
        <PainelDaOferta
          o={emOferta}
          onFechar={() => setOferta(null)}
          onAbrirCard={() => setAberto(emOferta.caseId)}
          onMudou={() => refetch()}
        />
      )}

      {vincular && (
        <VincularContatoCliente
          caseId={vincular.caseId}
          clienteNome={vincular.cliente}
          onClose={() => setVincular(null)}
          onVinculado={() => refetch()}
        />
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

const ROTULO_DO_FORO: Record<string, { curto: string; longo: string }> = {
  jef: { curto: 'JEF', longo: 'Juizado Especial Federal, contra o banco e o INSS (pagador do benefício é outro banco)' },
  jec: { curto: 'JEC', longo: 'Juizado Especial Cível estadual, só contra o banco (pagador do benefício é a própria Ré)' },
  estadual: { curto: 'VARA', longo: 'Vara cível estadual' },
};

/** Onde a inicial do refin vai sair. Some antes de o HISCON ser lido de novo. */
function Foro({ o }: { o: Item }) {
  const r = o.caixa === 'pronta' && o.foro ? ROTULO_DO_FORO[o.foro] : null;
  if (!r) return null;
  return (
    <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
      title={`${r.longo}${o.pagador ? `. Pago em: ${o.pagador}` : ''}`}>
      {r.curto}
    </span>
  );
}

/** As teses do cliente, em etiquetas: o que a mensagem vai oferecer. */
function Teses({ o }: { o: Item }) {
  return (
    <>
      {o.caixa === 'pronta' && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: ACCENT }}>REFIN</span>
      )}
      {o.churning?.ofertado && (
        <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
          title={`${o.churning.contratos} contratos no ${o.churning.grupo}: veredito ${o.churning.veredito}`}>
          CHURNING · {o.churning.grupo}
        </span>
      )}
    </>
  );
}

/**
 * Extinta sem mérito não faz coisa julgada material; improcedente faz, e o
 * banco vai alegá-la (art. 508 do CPC). Por isso a cor: verde é o caso limpo.
 */
function Acao({ o }: { o: Item }) {
  return o.resultado === 'extinto'
    ? <span className="text-emerald-700 dark:text-emerald-400">ação extinta</span>
    : <span className="text-amber-700 dark:text-amber-400">ação perdida</span>;
}

function CardDaOferta({ o, onAbrir, onVincular }: { o: Item; onAbrir: () => void; onVincular: () => void }) {
  return (
    // NÃO é <button>: dentro há o botão de vincular o WhatsApp.
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      className="cursor-pointer rounded-lg border border-[#cfe0ed] bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:border-transparent dark:bg-[#1E2226]"
    >
      <p className="line-clamp-2 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{o.cliente}</p>
      <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {o.reu ?? 'sem réu'} · <Acao o={o} /></p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Teses o={o} />
        <Foro o={o} />
        {o.caixa === 'pronta' && o.estimativa ? (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title={`Refin: dobro dos descontos até ${o.estimativa.ate ?? '?'} + dano moral. Não soma o churning.`}>
            {reais(o.estimativa.total)}
          </span>
        ) : null}
      </div>
      {o.reanalisar && (
        <p className="mt-1.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
          o churning já saiu por outro card: leia o HISCON de novo
        </p>
      )}
      {!o.oferecivel && (o.churning?.motivo || o.caixa) ? (
        <p className="mt-1.5 line-clamp-2 text-[10px] text-[#48626f] dark:text-zinc-500">
          {o.rotulo}{o.churning?.motivo ? ` · churning: ${o.churning.motivo}` : ''}
        </p>
      ) : null}
      <p className="mt-1.5 flex items-center gap-2 text-[10px] text-[#48626f] dark:text-zinc-500">
        {dia(o.enviadaEm) ? `enviada ${dia(o.enviadaEm)}` : dia(o.analisadaEm) ? `lida ${dia(o.analisadaEm)}` : 'não lida'}
        {!o.temConversa && (
          <button
            onClick={(e) => { e.stopPropagation(); onVincular(); }}
            className="inline-flex items-center gap-0.5 rounded px-1 font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
          >
            <Users className="h-3 w-3" /> vincular WhatsApp
          </button>
        )}
      </p>
    </div>
  );
}

/** A mesma oferta em linha, para percorrer cem. */
function ListaDeOfertas({ itens, onAbrir, onVincular }: {
  itens: Item[]; onAbrir: (id: string) => void; onVincular: (caseId: string, cliente: string) => void;
}) {
  if (!itens.length) {
    return <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Nenhum card de RMC/RCC perdida ou extinta.</p>;
  }
  const coluna = (o: Item) => COLUNAS.find((c) => c.de(o))?.titulo ?? '—';
  return (
    <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#f3f7fa] text-left text-[10px] font-bold uppercase tracking-wide text-[#48626f] dark:bg-zinc-900 dark:text-zinc-400">
            <th className="rounded-l-lg px-2.5 py-2">Cliente</th>
            <th className="px-2.5 py-2">Ação perdida</th>
            <th className="px-2.5 py-2">Teses</th>
            <th className="px-2.5 py-2 text-right" title="Refin: dobro dos descontos + dano moral. Não soma o churning.">Refin</th>
            <th className="px-2.5 py-2">Estado</th>
            <th className="rounded-r-lg px-2.5 py-2">WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => (
            <tr key={o.caseId} onClick={() => onAbrir(o.caseId)}
              className="cursor-pointer border-b border-[#eef3f7] hover:bg-[#f8fbfd] dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="px-2.5 py-2">
                <p className="font-semibold uppercase leading-4 text-[#101820] dark:text-zinc-100">{o.cliente}</p>
                {o.reanalisar && <p className="text-[10px] font-semibold text-red-700 dark:text-red-400">churning já saiu por outro card</p>}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-[#48626f] dark:text-zinc-300">
                {o.reu ?? 'sem réu'} · <Acao o={o} />
              </td>
              <td className="px-2.5 py-2"><span className="flex flex-wrap gap-1"><Teses o={o} /><Foro o={o} /></span></td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums text-[#101820] dark:text-zinc-100">
                {o.caixa === 'pronta' && o.estimativa ? reais(o.estimativa.total) : ''}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-[#48626f] dark:text-zinc-400">{coluna(o)}</td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {o.temConversa ? (
                  <span className="text-[11px] text-[#48626f] dark:text-zinc-500">ligado</span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onVincular(o.caseId, o.cliente); }}
                    className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10">
                    <Users className="h-3 w-3" /> vincular
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A OFERTA DE UM CLIENTE: o que foi medido, a mensagem (editável) e os botões.
 * Abre ao clicar no card ou na linha.
 */
function PainelDaOferta({ o, onFechar, onAbrirCard, onMudou }: {
  o: Item; onFechar: () => void; onAbrirCard: () => void; onMudou: () => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const temRefin = o.caixa === 'pronta';
  const temChurning = o.churning?.ofertado === true;
  const podeEnviar = o.oferecivel && aberta(o) && !o.reanalisar;

  useEffect(() => {
    let vivo = true;
    setTexto(null);
    legalCasesService.get(o.caseId)
      .then((c: any) => { if (vivo) setTexto(String(c?.metadata?.ofertaRefin?.mensagem ?? '')); })
      .catch(() => { if (vivo) setTexto(''); });
    return () => { vivo = false; };
  }, [o.caseId, o.analisadaEm]);

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
        toast.error('Sem conversa vinculada a este cliente: vincule o WhatsApp antes.');
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
          ? 'Aceita no refin. O churning segue pela escada do robô no card de campanha do cliente.'
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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onFechar}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-[#eef3f7] p-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold uppercase text-[#101820] dark:text-zinc-100">{o.cliente}</p>
            <p className="text-xs text-[#48626f] dark:text-zinc-400">× {o.reu ?? 'sem réu'} · <Acao o={o} /></p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Teses o={o} /></div>
          </div>
          <button onClick={onAbrirCard} title="Abrir o card da ação"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] dark:border-zinc-700 dark:text-zinc-300">
            <ExternalLink className="h-3 w-3" /> card
          </button>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar">
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs text-[#48626f] dark:text-zinc-400">
          <div className="space-y-1">
            {temRefin && o.resumo && <p><b className="text-[#101820] dark:text-zinc-200">Refin:</b> {o.resumo}</p>}
            {temRefin && o.estimativa && (
              <p>Estimativa do refin: {reais(o.estimativa.total)} (dobro {reais(o.estimativa.dobro)} até {o.estimativa.ate ?? '?'} + dano moral {reais(o.estimativa.danoMoral)})</p>
            )}
            {temRefin && o.foro && ROTULO_DO_FORO[o.foro] && (
              <p>Foro da inicial: {ROTULO_DO_FORO[o.foro].longo}{o.pagador ? `. Pago em: ${o.pagador}` : ''}</p>
            )}
            {!temRefin && <p><b className="text-[#101820] dark:text-zinc-200">Refin:</b> {o.rotulo}</p>}
            {o.churning && (
              <p><b className="text-[#101820] dark:text-zinc-200">Churning:</b>{' '}
                {temChurning
                  ? `${o.churning.contratos} contratos no ${o.churning.grupo} (veredito ${o.churning.veredito})`
                  : o.churning.motivo ?? 'fora'}
              </p>
            )}
            {o.reanalisar && (
              <p className="font-semibold text-red-700 dark:text-red-400">
                O churning deste cliente saiu por outro card depois da análise. Leia o HISCON de novo para a mensagem sair sem ele.
              </p>
            )}
          </div>

          {o.oferecivel && (
            texto === null ? (
              <p>Carregando a mensagem…</p>
            ) : (
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={!podeEnviar}
                rows={16}
                className="w-full rounded-lg border border-[#cfe0ed] bg-white p-2 text-sm leading-5 text-[#101820] disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#eef3f7] p-4 dark:border-zinc-800">
          {podeEnviar && (
            <>
              <button disabled={ocupado || !texto?.trim() || !o.temConversa} onClick={enviar}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: ACCENT }}>
                {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Enviar a {o.cliente.split(' ')[0]} pelo WhatsApp
              </button>
              <span className="text-[11px] text-[#48626f] dark:text-zinc-500">
                {!o.temConversa ? 'vincule o WhatsApp antes' : 'vai pela conversa dele'}
                {temRefin ? '; nasce o card de refin em "informações faltantes"' : ''}
                {temChurning ? "; o churning entra na escada do robô pelo card de campanha do cliente" : ""}
              </span>
            </>
          )}
          {o.status === 'enviada' && (
            <>
              <button disabled={ocupado} onClick={() => responder('aceita')}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
                <Check className="h-3 w-3" /> aceitou
              </button>
              <button disabled={ocupado} onClick={() => responder('recusada')}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                <X className="h-3 w-3" /> recusou
              </button>
            </>
          )}
          {aberta(o) && (
            <button disabled={ocupado} onClick={analisar} title="Lê de novo o HISCON da pasta"
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg border border-[#cfe0ed] px-3 text-xs text-[#48626f] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanSearch className="h-3 w-3" />} ler HISCON de novo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
