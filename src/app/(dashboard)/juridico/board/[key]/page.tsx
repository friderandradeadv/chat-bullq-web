'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { AdminBoard } from '@/features/legal-cases/components/admin-board';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { legalCasesService, type KanbanCard } from '@/features/legal-cases/services/legal-cases.service';
import { boardOfPhase } from '@/features/legal-cases/lib/phase-board';

/** Lado do cliente na execução. Card sem o campo (ficha antiga) = exequente. */
type Polo = 'exequente' | 'executado';
const poloDoCard = (c: KanbanCard): Polo => (c.polo === 'executado' ? 'executado' : 'exequente');

/**
 * "CS e Repasse" × "Execução" — derivado da FASE, no servidor. A coluna é a
 * verdade: card em cumprimento é CS e Repasse, card em execução é processo de
 * execução. Sem campo a preencher, e por isso sem como o card contradizer a
 * própria coluna. Ver tipo-execucao.ts na API.
 */
type Tipo = 'cumprimento' | 'execucao';
const tipoDoCard = (c: KanbanCard): Tipo => (c.tipo === 'execucao' ? 'execucao' : 'cumprimento');
/** Colunas de cada visão — as de desfecho ficam na CS e Repasse (a padrão). */
const FASES_EXECUCAO = new Set(['em_execucao']);

/** Um segmento do cabeçalho (Exequente×Executado, Cumprimento×Execução). */
function Segmentado<T extends string>({ valor, onMuda, opcoes, cor }: {
  valor: T;
  onMuda: (v: T) => void;
  opcoes: { v: T; label: string; n: number; dica: string }[];
  cor: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-[#cfe0ed] bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {opcoes.map((o) => (
        <button
          key={o.v}
          onClick={() => onMuda(o.v)}
          title={o.dica}
          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
            valor === o.v ? 'text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
          style={valor === o.v ? { background: cor } : undefined}
        >
          {o.label}
          <span className={`ml-1.5 text-xs ${valor === o.v ? 'text-white/80' : 'text-zinc-400'}`}>{o.n}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Quadro CUSTOM do jurídico (vertical criada pelo escritório sem deploy). Reusa o
 * AdminBoard: colunas = as fases do quadro (org.settings.kanbanPhases.custom com
 * `board` = esta chave), cards escopados no servidor por `lane` = a chave. Gestão
 * de fases inline (criar/renomear/reordenar/excluir) e "Novo caso" pra popular.
 */
export default function CustomBoardPage() {
  const params = useParams();
  const key = String(params?.key ?? '');
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  // Execução & Repasse é o pipeline do DINHEIRO, e o quadro nasceu para responder
  // "o que temos a receber". Um cumprimento em que o cliente é o EXECUTADO (defesa,
  // dativo) não é receita e embaralhava essa leitura — mas também não podia sumir.
  // Daí as duas visões: Exequente (padrão) × Executado.
  const [polo, setPolo] = useState<Polo>('exequente');
  // 2º eixo: execução é PROCESSO autônomo, cumprimento de sentença é FASE do
  // processo que já existe (CPC). Sem esta separação o sistema não tinha onde pôr
  // uma execução e ela caía em qualquer coluna — duas estavam em "AGUARDANDO
  // SENTENÇA", e execução não tem sentença.
  const [tipo, setTipo] = useState<Tipo>('cumprimento');

  const { data: boards, isLoading } = useQuery({
    queryKey: ['legal-cases', 'boards'],
    queryFn: () => legalCasesService.getBoards(),
  });
  const board = boards?.find((b) => b.key === key);

  // Fases do quadro (opções do dialog "Novo caso") — compartilha o cache do AdminBoard.
  const { data: kb } = useQuery({
    queryKey: ['legal-cases', 'kanban', key],
    queryFn: () => legalCasesService.kanban({ lane: key }),
    enabled: !!board,
  });
  // Execução & Repasse mostra também o DESFECHO (Ações Vencidas/Perdidas) — as mesmas
  // colunas do Fase Judicial, ao vivo — pra ver o que graduou/encerrou sem trocar de quadro.
  const noQuadro = (p: { key: string; lane?: 'pre' | 'judicial'; board?: string | null }) =>
    boardOfPhase(p.key, p.lane, p.board) === key || (key === 'execucao' && (p.key === 'acoes_vencidas' || p.key === 'acoes_perdidas'));
  // A visão escolhida também escolhe as COLUNAS: mostrar a coluna de execução
  // dentro de "CS e Repasse" (sempre vazia ali) só ocuparia espaço e faria o
  // usuário duvidar do filtro.
  const naVisao = (p: { key: string; lane?: 'pre' | 'judicial'; board?: string | null }) =>
    noQuadro(p) && (key !== 'execucao' || (tipo === 'execucao') === FASES_EXECUCAO.has(p.key));
  const boardPhases = useMemo(
    () =>
      (kb?.phases ?? [])
        .filter(noQuadro)
        .sort((a, b) => a.order - b.order)
        .map((p) => ({ key: p.key, label: p.label })),
    [kb, key],
  );

  // O toggle só existe no quadro da execução — nos demais, polo não quer dizer nada.
  const temPolo = key === 'execucao';
  // Cada contador é medido DENTRO do recorte do outro eixo: com "Executado"
  // selecionado, o número ao lado de "Execução" tem de ser o de execuções em que
  // somos a defesa, não o da carteira toda — senão o usuário clica num número e
  // cai numa coluna vazia.
  const porPolo = useMemo(() => {
    const n: Record<Polo, number> = { exequente: 0, executado: 0 };
    for (const c of kb?.cards ?? []) if (tipoDoCard(c) === tipo) n[poloDoCard(c)]++;
    return n;
  }, [kb, tipo]);
  const porTipo = useMemo(() => {
    const n: Record<Tipo, number> = { cumprimento: 0, execucao: 0 };
    for (const c of kb?.cards ?? []) if (poloDoCard(c) === polo) n[tipoDoCard(c)]++;
    return n;
  }, [kb, polo]);
  const filtrarPorPolo = useCallback(
    (c: KanbanCard) => !temPolo || (poloDoCard(c) === polo && tipoDoCard(c) === tipo),
    [temPolo, polo, tipo],
  );

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!board) {
    return (
      <div className="p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Quadro não encontrado — ele pode ter sido excluído.
      </div>
    );
  }

  return (
    <>
      <AdminBoard
        title={board.name}
        subtitle="Quadro personalizado"
        icon={LayoutGrid}
        accent={board.color || '#6741d9'}
        lane={key}
        filter={filtrarPorPolo}
        toolbar={
          temPolo ? (
            <div className="flex flex-wrap items-center gap-2">
              <Segmentado
                valor={tipo}
                onMuda={setTipo}
                cor={board.color || '#2F9E44'}
                opcoes={[
                  { v: 'cumprimento', label: 'CS e Repasse', n: porTipo.cumprimento,
                    dica: 'Cumprimento de sentença até a prestação de contas — e as prateleiras de desfecho' },
                  { v: 'execucao', label: 'Execução', n: porTipo.execucao,
                    dica: 'Processos na coluna EM EXECUÇÃO — a busca de bens (SISBAJUD/RENAJUD)' },
                ]}
              />
              <Segmentado
                valor={polo}
                onMuda={setPolo}
                cor={board.color || '#2F9E44'}
                opcoes={[
                  { v: 'exequente', label: 'Exequente', n: porPolo.exequente,
                    dica: 'Somos credores — é o que o escritório tem a receber' },
                  { v: 'executado', label: 'Executado', n: porPolo.executado,
                    dica: 'Somos a defesa do executado — não entra no que temos a receber' },
                ]}
              />
            </div>
          ) : undefined
        }
        columnsFromPhases={(p) => naVisao(p)}
        manageBoard={key}
        drawerBoard={key}
        onNewCard={boardPhases.length ? () => setNovo(true) : undefined}
        emptyHint="Este quadro ainda não tem fases. Crie a primeira coluna no botão “+” ao final."
      />
      {novo && (
        <NovoCasoDialog
          phases={boardPhases}
          targetPhase={boardPhases[0]?.key}
          onClose={() => setNovo(false)}
          onCreated={() => {
            setNovo(false);
            qc.invalidateQueries({ queryKey: ['legal-cases', 'kanban', key] });
          }}
        />
      )}
    </>
  );
}
