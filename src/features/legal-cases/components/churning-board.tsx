'use client';

/**
 * O QUADRO DAS OFERTAS DE CHURNING.
 *
 * 🚨 POR QUE EXISTE (22/10/2026). A análise da cadeia passou a rodar no
 * servidor e, numa tarde, quinze clientes ganharam oferta. Só que a oferta mora
 * no card que o cliente JÁ TEM, e esses cards estão espalhados pela fase
 * judicial: suspenso, provas, recurso, sentença. Revisar virou caçar card por
 * nome, um a um. Pergunta dele, exatamente: *"onde faço pra revisar isso?"*.
 *
 * 🚨 E NÃO SE ARRASTA CARD AQUI, de propósito. Nos outros quadros arrastar move
 * de fase; aqui a coluna é o estado da OFERTA, e passar de "a revisar" para
 * "enviada" significa falar com o cliente. Mensagem ao cliente sai de um clique
 * dentro do card, na conversa que já existe, nunca de um gesto no quadro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, LayoutGrid, List, Loader2, Recycle, RefreshCw, Search, Send, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { LinhaDoTempoDaOferta } from './linha-do-tempo-da-oferta';
import { PreviaEmBolhas } from './previa-em-bolhas';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { VincularContatoCliente } from '@/features/legal-cases/components/vincular-contato-cliente';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';

const ACCENT = '#e8590c';

/** As colunas são o estado da oferta, na ordem em que o trabalho anda. */
const COLUNAS: { chave: string; titulo: string; ajuda: string }[] = [
  { chave: 'analisada', titulo: 'A REVISAR', ajuda: 'o hub mediu a cadeia; falta você ler e decidir' },
  { chave: 'enviada', titulo: 'ENVIADA', ajuda: 'a oferta foi ao cliente, aguardando resposta' },
  { chave: 'aceita', titulo: 'ACEITA', ajuda: 'o cliente topou; os cards dos réus nascem daqui' },
  { chave: 'recusada', titulo: 'RECUSADA', ajuda: 'o cliente disse não' },
];

/**
 * ⚠️ QUINTA CÓPIA DESTE FORMATADOR no mesmo diretório (acordo-panel,
 * avanco-fase-modals, case-detail-drawer, bancos-reus-editor). Fica local para
 * não misturar faxina com o conserto que o escritório está esperando; vale uma
 * limpeza à luz do dia, num commit só dela.
 */
const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Oferta = {
  caseId: string; cliente: string; card: string; fase: string | null;
  grupo: string; status: string; resumo: string | null; indicios: number;
  refis: number; emBranco: number; declarados: number;
  portao: string | null; protocolaSemExtrato: boolean;
  analisadaEm: string | null; enviadaEm: string | null; respondidaEm?: string | null; temConversa: boolean;
  /**
   * 🚨 O CASO EM DINHEIRO, guardado desde a análise (30/10/2026). É o que deixa
   * este card dizer de quanto se trata sem abrir nada — como o card do Refin já
   * faz. `null` nas ofertas analisadas antes desta marca.
   */
  dinheiro?: { recebido: number; parcelaMensal: number; jaDescontado: number; aindaFalta: number } | null;
  /** O texto já composto pelo servidor. Sem ele, o painel ainda manda reanalisar. */
  mensagem?: string | null;
  /** A cadeia sai pela mensagem única da campanha da carteira (quadro Refin). */
  naCampanhaRefin?: boolean;
  /** O churning deste cliente já saiu por outro card: esta oferta sobrou. */
  jaOfertadoEmOutroCard?: boolean;
};

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

export function ChurningBoard() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  /**
   * 🚨 O CARD ABRE O PAINEL, NÃO O PROCESSO INTEIRO (30/10/2026). Ordem do
   * escritório, com os dois quadros lado a lado: *"quero os cards de churning
   * igual do refin, com a prévia de mensagem"*. Abrir o card inteiro obrigava a
   * procurar o bloco "Ação adicional" lá embaixo para ver a mensagem e enviar.
   * O processo continua a um clique, no botão "card" do painel.
   */
  const [oferta, setOferta] = useState<string | null>(null);

  /**
   * 🚨 O RECORTE DA FILA (30/10/2026). Pedido do escritório com 138 cards na
   * coluna A REVISAR: *"quero a opção de filtrar os clientes, que dependem de
   * extrato, que não dependem, etc"*. Com a fila inteira à frente, o que decide
   * por onde começar não é o nome — é se a ação anda sem esperar documento, se
   * falta WhatsApp para poder enviar, e se aquela oferta sai por outro lugar.
   *
   * Os recortes usam EXATAMENTE os campos que os selos do card já mostram. Se o
   * filtro usasse outra conta, o card diria uma coisa e a lista outra.
   */
  const [recorte, setRecorte] = useState<
    'todos' | 'sem-extrato' | 'com-extrato' | 'sem-whatsapp' | 'no-refin' | 'ja-ofertado'
  >('todos');
  /**
   * 🚨 O VARREDOR DAS OFERTAS SEM TEXTO (30/10/2026). As analisadas ANTES desta
   * data não guardam dinheiro nem mensagem: abrir cada card e clicar "Analisar
   * cadeia" seriam 138 cliques e 138 leituras de HISCON para ver o que o hub já
   * tinha medido. Aqui o servidor faz tudo — mede e compõe —, e isto só pede,
   * UM DE CADA VEZ, para não afogar a VPS (o build simultâneo de três sessões já
   * derrubou o site por horas).
   *
   * Não fala com cliente nenhum: só relê documento e grava no card.
   */
  const [completando, setCompletando] = useState<{ feitos: number; total: number } | null>(null);
  const pararRef = useRef(false);

  /**
   * Relê e completa as ofertas de "A REVISAR" que ainda não têm a mensagem
   * guardada. Uma por vez; dá para parar no meio. O erro de cada uma aparece
   * nominalmente — "veja a pasta" não serve quando falta o HISCON de um só.
   */
  const completarPendentes = async (fila: Oferta[]) => {
    pararRef.current = false;
    setCompletando({ feitos: 0, total: fila.length });
    const erros: string[] = [];
    for (let i = 0; i < fila.length; i++) {
      if (pararRef.current) break;
      await legalCasesService
        .registrarOfertaChurning(fila[i].caseId, { status: 'analisada', grupo: fila[i].grupo })
        .catch((e: any) => {
          erros.push(`${fila[i].cliente.split(' ')[0]}: ${e?.response?.data?.message || 'não consegui ler o HISCON'}`);
        });
      setCompletando({ feitos: i + 1, total: fila.length });
      if ((i + 1) % 5 === 0) refetch();
    }
    setCompletando(null);
    refetch();
    if (erros.length) toast.error(erros.join(' · '), { duration: 15000 });
  };
  const [vincular, setVincular] = useState<{ caseId: string; cliente: string } | null>(null);
  /* 🚨 QUADRO PARA TRABALHAR UM CASO, LISTA PARA PERCORRER CEM (22/10/2026).
     A varredura deixou 103 ofertas na coluna A REVISAR, e card em coluna é
     bom para abrir um caso e ruim para descer por cem: a mesma informação em
     linha lê muito mais rápido. Pergunta dele: "é pra ler no kanban mesmo?".
     A escolha fica lembrada no navegador porque é preferência de quem lê, não
     estado do trabalho; se o storage falhar (aba anônima, dado bloqueado), cai
     no quadro e nada quebra. */
  const [modo, setModo] = useState<'quadro' | 'lista'>('quadro');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('churning-modo');
      if (v === 'lista' || v === 'quadro') setModo(v);
    } catch { /* sem storage: fica no quadro */ }
  }, []);
  const trocarModo = (v: 'quadro' | 'lista') => {
    setModo(v);
    try { window.localStorage.setItem('churning-modo', v); } catch { /* idem */ }
  };

  // As fases existem para o seletor do card; o quadro em si não as usa.
  const { data: kanban } = useQuery({
    queryKey: ['legal-cases', 'kanban', 'judicial'],
    queryFn: () => legalCasesService.kanban({ lane: 'judicial' }),
    refetchOnWindowFocus: false,
  });
  const fases = kanban?.phases ?? [];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['churning', 'ofertas'],
    queryFn: () => legalCasesService.quadroDeOfertasChurning(),
    refetchOnWindowFocus: false,
  });

  const itens: Oferta[] = useMemo(() => {
    const todos = (data?.itens ?? []) as Oferta[];
    const q = busca.trim().toLowerCase();
    const peneira = (o: Oferta) => {
      if (recorte === 'sem-extrato') return o.protocolaSemExtrato === true;
      if (recorte === 'com-extrato') return o.protocolaSemExtrato !== true;
      if (recorte === 'sem-whatsapp') return !o.temConversa;
      if (recorte === 'no-refin') return o.naCampanhaRefin === true;
      if (recorte === 'ja-ofertado') return o.jaOfertadoEmOutroCard === true;
      return true;
    };
    const recortados = todos.filter(peneira);
    if (!q) return recortados;
    return recortados.filter((o) =>
      `${o.cliente} ${o.grupo} ${o.card}`.toLowerCase().includes(q));
  }, [data, busca, recorte]);

  const porColuna = (chave: string) => itens.filter((o) => (o.status || 'analisada') === chave);

  /**
   * As que ainda não têm a mensagem guardada — analisadas antes de 30/10/2026.
   * Conta sobre TODAS, não sobre o filtro da busca: o botão diz quantas faltam
   * no acervo, não quantas aparecem na tela agora.
   */
  const emOferta = oferta ? itens.find((i) => i.caseId === oferta) ?? null : null;

  /**
   * Quantas caem em cada recorte. Sai de TODOS os itens, não do filtro em vigor:
   * o número ao lado da opção tem de dizer quantas existem, não quantas sobraram
   * do recorte anterior.
   */
  const quantos = useMemo(() => {
    const t = (data?.itens ?? []) as Oferta[];
    return {
      todos: t.length,
      'sem-extrato': t.filter((o) => o.protocolaSemExtrato === true).length,
      'com-extrato': t.filter((o) => o.protocolaSemExtrato !== true).length,
      'sem-whatsapp': t.filter((o) => !o.temConversa).length,
      'no-refin': t.filter((o) => o.naCampanhaRefin === true).length,
      'ja-ofertado': t.filter((o) => o.jaOfertadoEmOutroCard === true).length,
    } as Record<string, number>;
  }, [data]);

  const semMensagem = useMemo(
    () => ((data?.itens ?? []) as Oferta[])
      .filter((o) => (o.status || 'analisada') === 'analisada'
        && !String(o.mensagem ?? '').trim()
        && !!String(o.grupo ?? '').trim()),
    [data],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h1 className="text-lg font-semibold text-[#101820] dark:text-zinc-100">Churning</h1>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
          {itens.length}
        </span>
        <p className="text-xs text-[#48626f] dark:text-zinc-400">
          reciclagem de contratos: o que o hub mediu e ainda não virou ação
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
          {/* O recorte da fila: ver o comentário em `recorte`. O contador de cada
              opção sai da MESMA peneira, para o número bater com a lista. */}
          <select
            value={recorte}
            onChange={(e) => setRecorte(e.target.value as typeof recorte)}
            title="Recortar a fila pelo que decide por onde começar"
            className={`h-8 rounded-lg border px-2 text-xs dark:bg-zinc-900 ${recorte === 'todos'
              ? 'border-[#cfe0ed] text-[#48626f] dark:border-zinc-700 dark:text-zinc-300'
              : 'border-[#e11970] font-semibold text-[#e11970]'}`}
          >
            <option value="todos">todas as ofertas ({quantos['todos'] ?? 0})</option>
            <option value="sem-extrato">não depende do extrato ({quantos['sem-extrato'] ?? 0})</option>
            <option value="com-extrato">depende do extrato ({quantos['com-extrato'] ?? 0})</option>
            <option value="sem-whatsapp">sem WhatsApp vinculado ({quantos['sem-whatsapp'] ?? 0})</option>
            <option value="no-refin">na campanha Refin ({quantos['no-refin'] ?? 0})</option>
            <option value="ja-ofertado">já ofertado em outro card ({quantos['ja-ofertado'] ?? 0})</option>
          </select>
          {/* Quadro × lista: a mesma ordem e o mesmo clique, formatos diferentes. */}
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
          {/* 🚨 COMPLETAR AS ANTIGAS. As ofertas analisadas antes de 30/10/2026 não
              guardam dinheiro nem mensagem: o painel delas ainda manda reanalisar,
              uma a uma. Isto relê e completa, UMA DE CADA VEZ, e não fala com
              cliente nenhum. Some quando não há mais nenhuma. */}
          {completando ? (
            <button onClick={() => { pararRef.current = true; }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              {completando.feitos}/{completando.total} — parar
            </button>
          ) : semMensagem.length > 0 ? (
            <button onClick={() => completarPendentes(semMensagem)}
              title="Relê o HISCON de cada oferta que ainda não tem a mensagem guardada, uma de cada vez. Não envia nada a ninguém."
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs font-semibold text-[#1b6ec2] hover:bg-zinc-50 dark:border-zinc-700 dark:text-sky-300 dark:hover:bg-zinc-800">
              <Recycle className="h-3 w-3" /> completar {semMensagem.length}
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
        <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Lendo as ofertas…</p>
      ) : modo === 'lista' ? (
        <ListaDeOfertas
          itens={itens}
          onAbrir={setOferta}
          onVincular={(caseId, cliente) => setVincular({ caseId, cliente })}
        />
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {COLUNAS.map((col) => {
            const lista = porColuna(col.chave);
            return (
              <div key={col.chave} className="flex w-[310px] shrink-0 flex-col">
                <div className="flex items-center gap-1.5 px-1 pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
                    {col.titulo}
                  </h2>
                  <span className="text-xs font-semibold text-[#48626f] dark:text-zinc-400">{lista.length}</span>
                </div>
                <p className="px-1 pb-2 text-[10px] leading-3 text-[#48626f] dark:text-zinc-500">{col.ajuda}</p>

                <div className="flex flex-1 flex-col gap-2">
                  {lista.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#cfe0ed] p-4 text-center text-xs text-[#48626f] dark:border-zinc-700 dark:text-zinc-500">
                      Vazio
                    </div>
                  ) : lista.map((o) => (
                    // 🚨 NÃO é <button>: dentro do card há o botão de vincular o
                    // WhatsApp, e botão dentro de botão é HTML inválido (o
                    // navegador descarta o de dentro, e o clique vai para o card).
                    <div
                      key={o.caseId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOferta(o.caseId)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOferta(o.caseId); } }}
                      className="cursor-pointer rounded-lg border border-[#cfe0ed] bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:border-transparent dark:bg-[#1E2226]"
                    >
                      <p className="line-clamp-2 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">
                        {o.cliente}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {o.grupo}</p>
                      {o.naCampanhaRefin && (
                        <p className="mt-1 inline-block rounded bg-[#e3f0fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#1565c0] dark:bg-sky-500/15 dark:text-sky-300"
                          title="Este cliente perdeu a RMC: a oferta vai junto com a do refin, numa mensagem só, pelo quadro Refin.">
                          na campanha Refin: envie por lá
                        </p>
                      )}
                      {o.jaOfertadoEmOutroCard && (
                        <p className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400"
                          title="A oferta de churning deste cliente já saiu por outro card. Não envie esta.">
                          já ofertado por outro card
                        </p>
                      )}

                      {/* 🚨 O NÚMERO QUE DECIDE, no próprio card: quantos
                          refinanciamentos e em quantos o banco declarou ter
                          liberado dinheiro. Zero declarado é o cenário em que a
                          tese anda. */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {o.refis} refi{o.refis === 1 ? '' : 's'}
                        </span>
                        {o.declarados > 0 ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
                            {o.declarados} com valor declarado
                          </span>
                        ) : o.refis > 0 ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            nada liberado
                          </span>
                        ) : null}
                        {/* 🚨 O QUE O CLIENTE SENTIU, em dinheiro: é por ele que o
                            advogado decide por onde começar, e é o que o card do
                            Refin já mostrava. Só aparece quando a análise o mediu. */}
                        {o.dinheiro && (
                          <span
                            title={`entrou na conta ${brl(o.dinheiro.recebido)} · sai ${brl(o.dinheiro.parcelaMensal)}/mês · já descontado ${brl(o.dinheiro.jaDescontado)} · ainda falta ${brl(o.dinheiro.aindaFalta)}`}
                            className="rounded bg-[#eaf3fb] px-1.5 py-0.5 font-semibold text-[#1b6ec2] dark:bg-sky-500/15 dark:text-sky-300"
                          >
                            {brl(o.dinheiro.aindaFalta)} a pagar
                          </span>
                        )}
                      </div>

                      {/* O portão do extrato, que decide se a ação espera documento. */}
                      {o.portao ? (
                        <p className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium ${
                          o.protocolaSemExtrato
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'}`}>
                          {o.protocolaSemExtrato
                            ? <><ShieldCheck className="h-3 w-3" /> não depende do extrato</>
                            : <><ShieldAlert className="h-3 w-3" /> depende do extrato</>}
                        </p>
                      ) : null}

                      <p className="mt-1.5 truncate text-[10px] text-[#48626f] dark:text-zinc-500">
                        {o.card}
                        {o.fase ? ` · ${o.fase.replace(/_/g, ' ')}` : ''}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[10px] text-[#48626f] dark:text-zinc-500">
                        {dia(o.enviadaEm) ? `enviada ${dia(o.enviadaEm)}` : dia(o.analisadaEm) ? `medida ${dia(o.analisadaEm)}` : ''}
                        {!o.temConversa && (
                          // 🚨 CLICÁVEL de propósito: a oferta existe e não há
                          // por onde falar com o cliente, então o aviso é o
                          // próprio caminho do conserto, não um rótulo.
                          <button
                            onClick={(e) => { e.stopPropagation(); setVincular({ caseId: o.caseId, cliente: o.cliente }); }}
                            className="inline-flex items-center gap-0.5 rounded px-1 font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                          >
                            <Users className="h-3 w-3" /> vincular WhatsApp
                          </button>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚨 O DRAWER PRECISA DAS FASES para o seletor de fase funcionar: aqui
          vão as da trilha judicial e as do pré-processual juntas, porque a
          oferta vive tanto num card em recurso quanto num card em montagem. */}
      {vincular && (
        <VincularContatoCliente
          caseId={vincular.caseId}
          clienteNome={vincular.cliente}
          onClose={() => setVincular(null)}
          onVinculado={() => refetch()}
        />
      )}

      {emOferta && (
        <PainelDaOfertaChurning
          o={emOferta}
          onFechar={() => setOferta(null)}
          onAbrirCard={() => setAberto(emOferta.caseId)}
          onMudou={() => refetch()}
        />
      )}

      {aberto && (
        <CaseDetailDrawer
          caseId={aberto}
          phases={[
            ...phasesOfBoard(fases, 'judicial'),
            ...phasesOfBoard(fases, 'pre'),
          ]}
          onClose={() => { setAberto(null); refetch(); }}
        />
      )}
    </div>
  );
}

/**
 * A MESMA OFERTA EM LINHA.
 *
 * 🚨 POR QUE EXISTE (22/10/2026). A varredura do acervo deixou **103 ofertas**
 * na coluna A REVISAR. Card é bom para trabalhar um caso e ruim para percorrer
 * cem: cada um ocupa seis linhas de tela, e o olho reconstrói a comparação a
 * cada rolagem. Em linha, as quatro colunas que decidem ficam alinhadas, e dá
 * para descer de cima para baixo.
 *
 * Mesma ordem do quadro (cadeia maior primeiro), mesmo clique para abrir, mesmo
 * botão de vincular WhatsApp. O que muda é só a forma.
 */
function ListaDeOfertas({
  itens, onAbrir, onVincular,
}: {
  itens: Oferta[];
  onAbrir: (id: string) => void;
  onVincular: (caseId: string, cliente: string) => void;
}) {
  if (!itens.length) {
    return (
      <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">
        Nenhuma oferta para mostrar.
      </p>
    );
  }
  const rotulo = (chave: string) =>
    COLUNAS.find((c) => c.chave === chave)?.titulo ?? chave.toUpperCase();

  return (
    <div className="flex-1 overflow-auto px-4 pb-4">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#f3f7fa] text-left text-[10px] font-bold uppercase tracking-wide text-[#48626f] dark:bg-zinc-900 dark:text-zinc-400">
            <th className="rounded-l-lg px-2.5 py-2">Cliente</th>
            <th className="px-2.5 py-2">Banco</th>
            <th className="px-2.5 py-2 text-right" title="Refinanciamentos na cadeia">Refis</th>
            <th className="px-2.5 py-2 text-right" title="Refinanciamentos em que o banco declara ter liberado dinheiro">Declarados</th>
            <th className="px-2.5 py-2">Extrato</th>
            <th className="px-2.5 py-2">Estado</th>
            <th className="rounded-r-lg px-2.5 py-2">WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => (
            <tr
              key={o.caseId}
              onClick={() => onAbrir(o.caseId)}
              className="cursor-pointer border-b border-[#eef3f7] hover:bg-[#f8fbfd] dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <td className="px-2.5 py-2">
                <p className="font-semibold uppercase leading-4 text-[#101820] dark:text-zinc-100">{o.cliente}</p>
                <p className="truncate text-[10px] text-[#48626f] dark:text-zinc-500">{o.card}</p>
              </td>
              <td className="px-2.5 py-2 text-[#48626f] dark:text-zinc-300">
                {o.grupo}
                {o.naCampanhaRefin && (
                  <span className="ml-1.5 rounded bg-[#e3f0fb] px-1 py-0.5 text-[10px] font-semibold text-[#1565c0] dark:bg-sky-500/15 dark:text-sky-300">
                    via Refin
                  </span>
                )}
                {o.jaOfertadoEmOutroCard && (
                  <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
                    já ofertado
                  </span>
                )}
              </td>
              <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-[#101820] dark:text-zinc-100">{o.refis}</td>
              {/* 🚨 ZERO DECLARADO É O NÚMERO BOM, e por isso ele sai em verde:
                  é a cadeia que gira sem liberar dinheiro. Vermelho é o banco
                  dizendo que pagou, que é onde o extrato passa a decidir. */}
              <td className={`px-2.5 py-2 text-right font-semibold tabular-nums ${
                o.declarados > 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'}`}>
                {o.declarados}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {o.portao ? (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    o.protocolaSemExtrato
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'}`}>
                    {o.protocolaSemExtrato
                      ? <><ShieldCheck className="h-3 w-3" /> não depende</>
                      : <><ShieldAlert className="h-3 w-3" /> depende</>}
                  </span>
                ) : <span className="text-[11px] text-zinc-400">não medido</span>}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-[#48626f] dark:text-zinc-400">
                {rotulo(o.status || 'analisada')}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {o.temConversa ? (
                  <span className="text-[11px] text-[#48626f] dark:text-zinc-500">ligado</span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onVincular(o.caseId, o.cliente); }}
                    className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                  >
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
 * O PAINEL DA OFERTA DE CHURNING — o gêmeo do `PainelDaOferta` do refin.
 *
 * 🚨 POR QUE EXISTE (30/10/2026). Pedido do escritório: *"quero os cards de
 * churning igual do refin, com a prévia de mensagem"*. Até aqui o card abria o
 * processo inteiro e a mensagem ficava num bloco lá embaixo, que só aparecia
 * depois de reanalisar. Agora o painel mostra onde o cliente está, o texto
 * pronto e o botão — e o processo continua a um clique, no botão "card".
 *
 * ⚠️ O ENVIO É O MESMO do bloco da ficha (`oferta-churning.tsx`): primeiro a
 * mensagem vai pela conversa do cliente, depois registra-se o andamento. Mudou
 * um, muda o outro — e, antes de uma terceira tela precisar disto, vale extrair
 * o envio para um lugar só.
 */
function PainelDaOfertaChurning({ o, onFechar, onAbrirCard, onMudou }: {
  o: Oferta; onFechar: () => void; onAbrirCard: () => void; onMudou: () => void;
}) {
  const [texto, setTexto] = useState<string>(String(o.mensagem ?? ''));
  const [ocupado, setOcupado] = useState(false);
  /**
   * 🚨 A PRÉVIA ABRE EM BOLHAS (30/10/2026). Aprovar num campo de texto e mandar
   * em seis bolhas é aprovar uma coisa e enviar outra. O campo continua a um
   * clique, porque revisar o texto é trabalho do advogado.
   */
  const [vendo, setVendo] = useState<'bolhas' | 'texto'>('bolhas');
  const enviada = String(o.status ?? 'analisada') === 'enviada';
  const respondida = ['aceita', 'recusada'].includes(String(o.status ?? ''));

  const enviar = async () => {
    if (!texto.trim()) return;
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
        // Igual aos ensaios: uma bolha por parágrafo, no ritmo do servidor.
        emBolhas: true,
      });
      await legalCasesService.registrarOfertaChurning(o.caseId, { status: 'enviada', mensagem: texto.trim() });
      toast.success('Oferta enviada ao cliente');
      onMudou();
      onFechar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui enviar a mensagem.');
    } finally {
      setOcupado(false);
    }
  };

  /** Relê o HISCON desta oferta e grava dinheiro e mensagem. Não envia nada. */
  const completarEsta = async () => {
    setOcupado(true);
    try {
      const r: any = await legalCasesService.registrarOfertaChurning(o.caseId, {
        status: 'analisada', grupo: o.grupo,
      });
      const nova = String(r?.oferta?.mensagem ?? '').trim();
      if (!nova) {
        toast.error('Li o HISCON e não consegui montar a mensagem — abra o card e veja a pasta.');
        return;
      }
      setTexto(nova);
      toast.success('Mensagem pronta.');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler o HISCON da pasta.');
    } finally {
      setOcupado(false);
    }
  };

  const responder = async (status: 'aceita' | 'recusada') => {
    setOcupado(true);
    try {
      await legalCasesService.registrarOfertaChurning(o.caseId, { status });
      toast.success(status === 'aceita'
        ? 'Aceita: os réus entraram em "contratos a impugnar" e o card foi para "montar inicial".'
        : 'Recusa registrada.');
      onMudou();
      onFechar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui registrar a resposta.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    /* 🚨 A CASCA É A MESMA DO REFIN (30/10/2026). Eu a tinha inventado —
       `fixed inset-y-0 right-0` sem sobreposição — e a barra de navegação de
       baixo passava POR CIMA: o botão de enviar saía cortado. *"parece meio
       bugado, cortado, incompleto"*. Copiar a casca que já funciona é mais
       barato e mais seguro que descobrir o z-index certo. */
    /* 🚨 RESERVA A BARRA DE BAIXO (30/10/2026). Sem isto o painel vai até a
       borda da janela e o botão de enviar some sob a barra de atalhos. A altura
       mora em `--dock-h` (globals.css), porque muda com o modo de navegação e
       com a safe-area do aparelho.
       ⚠️ Comentário de BLOCO. Comentário de JSX entre chaves, antes do elemento
       raiz e dentro do `return (`, NÃO é comentário: é expressão, e o build
       quebra com "Property assignment expected". E não se escreve a sequência
       de fechar comentário dentro de um comentário — ela o encerra ali mesmo,
       que foi o segundo erro desta mesma correção. */
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      style={{ paddingBottom: 'var(--dock-h, 0px)' }}
      onClick={onFechar}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex items-start justify-between gap-2 border-b border-[#e3eef7] p-4 dark:border-zinc-800">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[#101820] dark:text-zinc-100">{o.cliente}</h3>
          <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">
            {o.grupo}{o.dinheiro ? ` · ${brl(o.dinheiro.aindaFalta)} a pagar` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onAbrirCard} title="Abrir o card do processo"
            className="rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-300">
            card
          </button>
          <button onClick={onFechar} title="Fechar"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <LinhaDoTempoDaOferta o={o} />

        {texto.trim() ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">
                a mensagem {enviada || respondida ? 'enviada' : 'que vai ao cliente'}
              </p>
              <button
                type="button"
                onClick={() => setVendo(vendo === 'bolhas' ? 'texto' : 'bolhas')}
                className="rounded-md border border-[#cfe0ed] px-2 py-0.5 text-[10px] font-semibold text-[#4b5863] hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-300"
              >
                {vendo === 'bolhas' ? 'editar o texto' : 'ver como vai chegar'}
              </button>
            </div>
            {vendo === 'bolhas' ? (
              <PreviaEmBolhas texto={texto} />
            ) : (
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-[#cfe0ed] p-2 text-xs leading-5 text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            )}
          </>
        ) : (
          /* Oferta medida antes de 30/10/2026: o texto não foi guardado. O botão
             "completar" do cabeçalho resolve todas de uma vez. */
          /* 🚨 COMPLETAR SEM SAIR DAQUI (30/10/2026). Mandar o advogado ao botão
             do cabeçalho — ou pior, ao card — quando ele já está com a oferta
             aberta é obrigá-lo a sair para voltar. Relê o HISCON desta e só
             desta; não fala com cliente nenhum. */
          <div className="rounded-lg border border-dashed border-[#cfe0ed] p-3 dark:border-zinc-700">
            <p className="text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
              Esta oferta foi medida antes de a mensagem passar a ser guardada.
            </p>
            <button onClick={completarEsta} disabled={ocupado}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-semibold text-[#1b6ec2] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-sky-300 dark:hover:bg-zinc-800">
              {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Recycle className="h-3 w-3" />}
              {ocupado ? 'lendo o HISCON…' : 'completar esta oferta'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[#e3eef7] p-3 dark:border-zinc-800">
        {respondida ? (
          <p className="text-[11px] text-[#48626f] dark:text-zinc-400">
            Resposta registrada. Reabra pelo card se precisar ofertar outro grupo.
          </p>
        ) : enviada ? (
          <div className="flex items-center gap-2">
            <button onClick={() => responder('aceita')} disabled={ocupado}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> cliente aceitou
            </button>
            <button onClick={() => responder('recusada')} disabled={ocupado}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#cfe0ed] px-3 py-2 text-xs font-semibold text-[#4b5863] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              <X className="h-3.5 w-3.5" /> recusou
            </button>
          </div>
        ) : (
          <>
            <button onClick={enviar} disabled={ocupado || !texto.trim() || !o.temConversa}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#005efc] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar a {o.cliente.split(' ')[0]} pelo WhatsApp
            </button>
            <p className="mt-1 text-center text-[10px] text-[#48626f] dark:text-zinc-400">
              {!o.temConversa ? 'vincule o WhatsApp antes' : 'vai pela conversa dele'}
            </p>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
