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
  const porPolo = useMemo(() => {
    const n: Record<Polo, number> = { exequente: 0, executado: 0 };
    for (const c of kb?.cards ?? []) n[poloDoCard(c)]++;
    return n;
  }, [kb]);
  const filtrarPorPolo = useCallback(
    (c: KanbanCard) => !temPolo || poloDoCard(c) === polo,
    [temPolo, polo],
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
            <div className="flex items-center rounded-lg border border-[#cfe0ed] bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              {(['exequente', 'executado'] as Polo[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPolo(p)}
                  title={
                    p === 'exequente'
                      ? 'Somos credores — é o que o escritório tem a receber'
                      : 'Somos a defesa do executado — não entra no que temos a receber'
                  }
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                    polo === p
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                  style={polo === p ? { background: board.color || '#2F9E44' } : undefined}
                >
                  {p === 'exequente' ? 'Exequente' : 'Executado'}
                  <span className={`ml-1.5 text-xs ${polo === p ? 'text-white/80' : 'text-zinc-400'}`}>
                    {porPolo[p]}
                  </span>
                </button>
              ))}
            </div>
          ) : undefined
        }
        columnsFromPhases={(p) => noQuadro(p)}
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
