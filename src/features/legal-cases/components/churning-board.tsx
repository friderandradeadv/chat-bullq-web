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
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
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

type Oferta = {
  caseId: string; cliente: string; card: string; fase: string | null;
  grupo: string; status: string; resumo: string | null; indicios: number;
  refis: number; emBranco: number; declarados: number;
  portao: string | null; protocolaSemExtrato: boolean;
  analisadaEm: string | null; enviadaEm: string | null; temConversa: boolean;
};

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

export function ChurningBoard() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [vincular, setVincular] = useState<{ caseId: string; cliente: string } | null>(null);

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
    if (!q) return todos;
    return todos.filter((o) =>
      `${o.cliente} ${o.grupo} ${o.card}`.toLowerCase().includes(q));
  }, [data, busca]);

  const porColuna = (chave: string) => itens.filter((o) => (o.status || 'analisada') === chave);

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
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reler
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Lendo as ofertas…</p>
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
                      onClick={() => setAberto(o.caseId)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(o.caseId); } }}
                      className="cursor-pointer rounded-lg border border-[#cfe0ed] bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:border-transparent dark:bg-[#1E2226]"
                    >
                      <p className="line-clamp-2 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">
                        {o.cliente}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {o.grupo}</p>

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
