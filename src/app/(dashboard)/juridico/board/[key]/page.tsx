'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { AdminBoard } from '@/features/legal-cases/components/admin-board';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { boardOfPhase } from '@/features/legal-cases/lib/phase-board';

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
  const boardPhases = useMemo(
    () =>
      (kb?.phases ?? [])
        .filter((p) => boardOfPhase(p.key, p.lane, p.board) === key)
        .sort((a, b) => a.order - b.order)
        .map((p) => ({ key: p.key, label: p.label })),
    [kb, key],
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
        filter={() => true}
        columnsFromPhases={(p) => boardOfPhase(p.key, p.lane, p.board) === key}
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
