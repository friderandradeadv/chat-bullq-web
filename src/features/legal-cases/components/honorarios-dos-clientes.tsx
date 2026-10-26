'use client';

/**
 * EM QUAL OPÇÃO O CLIENTE FECHOU.
 *
 * 🚨 POR QUE EXISTE (26/10/2026). O escritório desenhou a régua da próxima
 * venda: *"se o cliente já fechou na proposta A, podemos tentar apostar nela; se
 * fechou na b, apostar nela"*. O hub passou a gravar isso sozinho na assinatura
 * e na cobrança da entrada, mas só daqui para a frente.
 *
 * Para trás não há como deduzir: medido no banco, o modelo mais assinado é o
 * `ACORDO - RMC | RCC`, com 22, e ele é o MESMO para as duas opções. Quem sabe
 * é o advogado, e esta tela existe para ele dizer, card a card.
 *
 * 🚨 E MOSTRA A FONTE DO QUE JÁ ESTÁ GRAVADO. Marcar à mão por cima de uma
 * COBRANÇA DE ENTRADA é apagar prova com palpite: a cobrança só existe porque
 * alguém pediu o link e o valor saiu da tabela. Por isso esses cards vêm com
 * aviso, e não escondidos.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, RefreshCw, Search, ShieldAlert, Wallet } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';

const ACCENT = '#005efc';

type Opcao = 'entrada' | 'meio-a-meio' | null;

type Item = {
  caseId: string;
  cliente: string;
  card: string;
  area: string | null;
  fase: string | null;
  status: string;
  opcao: Opcao;
  fonte: string | null;
  entradaCobrada: boolean;
  contratos: { nome: string; em: string }[];
};

const ROTULO: Record<string, string> = {
  entrada: 'A · entrada + 30%',
  'meio-a-meio': 'B · meio a meio',
};

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function HonorariosDosClientes() {
  const [busca, setBusca] = useState('');
  const [soSemMarca, setSoSemMarca] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const qc = useQueryClient();

  // As fases servem só ao drawer (ele move o card de fase). Mesma fonte do
  // quadro de churning, para o drawer abrir igual nas duas telas.
  const { data: kanban } = useQuery({
    queryKey: ['legal-cases', 'kanban', 'judicial'],
    queryFn: () => legalCasesService.kanban({ lane: 'judicial' }),
    refetchOnWindowFocus: false,
  });
  const fases = kanban?.phases ?? [];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['honorarios-clientes'],
    queryFn: () => legalCasesService.clientesParaMarcarHonorarios(),
    staleTime: 60_000,
  });

  const marcar = useMutation({
    mutationFn: ({ caseId, opcao }: { caseId: string; opcao: Opcao }) =>
      legalCasesService.marcarHonorariosDoCard(caseId, opcao),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['honorarios-clientes'] }),
  });

  const itens: Item[] = useMemo(() => (data?.itens ?? []) as Item[], [data]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    return itens.filter((i) => {
      if (soSemMarca && i.opcao) return false;
      if (!q) return true;
      return (
        i.cliente?.toLocaleLowerCase('pt-BR').includes(q) ||
        i.card?.toLocaleLowerCase('pt-BR').includes(q)
      );
    });
  }, [itens, busca, soSemMarca]);

  const marcados = itens.filter((i) => i.opcao).length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#101820] dark:text-zinc-200">
          <Wallet className="h-4 w-4" style={{ color: ACCENT }} />
          Opção de honorários fechada
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {marcados} de {itens.length} marcados
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="cliente ou card"
            className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-56 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={soSemMarca}
            onChange={(e) => setSoSemMarca(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          só os que faltam
        </label>
        <button
          onClick={() => refetch()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#cfe0ed] px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* 🚨 A régua em uma linha, onde se marca: quem marca precisa saber o que
          a marcação FAZ, senão vira campo preenchido por preencher. */}
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        A próxima proposta deste cliente abre pela opção marcada aqui. Sem marca, abre na A.
        Quem já pagou entrada não paga de novo: a ação seguinte vai só com o percentual.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> carregando…
        </div>
      ) : !filtrados.length ? (
        <div className="rounded-lg border border-dashed border-[#cfe0ed] p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {itens.length
            ? 'Nada aqui com esse filtro.'
            : 'Nenhum cliente com contrato assinado. Sem contrato não houve opção fechada.'}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Contrato assinado</th>
                <th className="px-3 py-2 font-medium">Como está</th>
                <th className="px-3 py-2 font-medium">Fechou em</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const salvando = marcar.isPending && marcar.variables?.caseId === i.caseId;
                return (
                  <tr
                    key={i.caseId}
                    className="border-t border-[#eef3f8] align-top hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setAberto(i.caseId)}
                        className="text-left font-medium text-[#101820] hover:underline dark:text-zinc-200"
                      >
                        {i.cliente || '(sem nome)'}
                      </button>
                      <div className="text-xs text-zinc-500">{i.card}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {i.contratos.length
                        ? i.contratos.map((c) => (
                          <div key={`${c.nome}-${c.em}`}>
                            {c.nome} <span className="text-zinc-400">· {dia(c.em)}</span>
                          </div>
                        ))
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {i.opcao ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#101820] dark:text-zinc-200">
                          <Check className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                          {ROTULO[i.opcao]}
                        </span>
                      ) : (
                        <span className="text-zinc-400">sem marca</span>
                      )}
                      {i.fonte ? <div className="text-zinc-400">{i.fonte}</div> : null}
                      {/* Prova positiva: marcar por cima disto é apagar medição. */}
                      {i.entradaCobrada ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[#b35309]">
                          <ShieldAlert className="h-3.5 w-3.5" /> entrada já cobrada
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
                        {(['entrada', 'meio-a-meio'] as const).map((op) => (
                          <button
                            key={op}
                            disabled={salvando}
                            onClick={() =>
                              marcar.mutate({ caseId: i.caseId, opcao: i.opcao === op ? null : op })
                            }
                            title={i.opcao === op ? 'clique de novo para desmarcar' : ''}
                            className={`px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${i.opcao === op
                              ? 'bg-[#005efc] text-white'
                              : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'
                              }`}
                          >
                            {ROTULO[op]}
                          </button>
                        ))}
                      </div>
                      {salvando ? (
                        <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-zinc-400" />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aberto ? (
        <CaseDetailDrawer
          caseId={aberto}
          phases={[
            ...phasesOfBoard(fases, 'judicial'),
            ...phasesOfBoard(fases, 'pre'),
          ]}
          onClose={() => { setAberto(null); refetch(); }}
        />
      ) : null}
    </div>
  );
}
