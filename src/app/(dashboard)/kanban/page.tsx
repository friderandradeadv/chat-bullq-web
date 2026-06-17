'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { KanbanSquare, MessageSquare, Users, Phone, GripVertical } from 'lucide-react';
import {
  contactsService,
  type FunnelBoard,
  type FunnelCard as TCard,
  type FunnelColumn,
} from '@/features/contacts/services/contacts.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { departmentsService } from '@/features/settings/services/departments.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { ConversationDialog } from '@/features/inbox/components/conversation-dialog';
import { avatarColor, avatarInitials, chipTextColor } from '@/lib/avatar';
import { formatPhone } from '@/lib/brazil-states';
import { relativeTime, cn } from '@/lib/utils';

export default function KanbanPage() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  const [dept, setDept] = useState(''); // '' = Todos
  const [activeCard, setActiveCard] = useState<TCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<FunnelColumn | null>(null);
  const [viewConvId, setViewConvId] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: () => departmentsService.list(),
  });

  const boardKey = ['funnel-board', orgId, dept];
  const { data: board, isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: () => contactsService.funnelBoard(dept || undefined),
    refetchInterval: 20_000,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // cardId → statusId (origem) pro handler de mover.
  const cardStatus = useMemo(() => {
    const m = new Map<string, string>();
    if (board) {
      for (const sid of Object.keys(board.cards)) {
        for (const c of board.cards[sid]) m.set(c.id, sid);
      }
    }
    return m;
  }, [board]);

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (data?.type === 'card') setActiveCard(data.card as TCard);
    else if (data?.type === 'column') {
      setActiveColumn(board?.columns.find((c) => c.id === data.columnId) ?? null);
    }
  };

  // Reordena as COLUNAS (status do funil) e persiste o sortOrder de cada uma.
  const handleColumnReorder = async (draggedId: string, overId: string) => {
    if (!board || draggedId === overId) return;
    const ids = board.columns.map((c) => c.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(overId);
    if (from === -1 || to === -1) return;
    const reordered = [...board.columns];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    qc.setQueryData<FunnelBoard>(boardKey, (prev) =>
      prev ? { ...prev, columns: reordered } : prev,
    );
    try {
      await Promise.all(
        reordered.map((c, i) => contactStatusesService.update(c.id, { sortOrder: i } as any)),
      );
      toast.success('Ordem do funil salva');
      qc.invalidateQueries({ queryKey: ['funnel-board', orgId] });
      qc.invalidateQueries({ queryKey: ['contact-statuses', orgId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar a ordem');
      qc.invalidateQueries({ queryKey: boardKey });
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const wasColumn = (e.active.data.current as any)?.type === 'column';
    const draggedColumnId = (e.active.data.current as any)?.columnId as string | undefined;
    setActiveCard(null);
    setActiveColumn(null);
    const { active, over } = e;
    if (!over || !board) return;

    // Reordenação de COLUNA
    if (wasColumn && draggedColumnId) {
      await handleColumnReorder(draggedColumnId, over.id as string);
      return;
    }

    // Mover CARD entre status
    const contactId = active.id as string;
    const toStatus = over.id as string;
    const fromStatus = cardStatus.get(contactId);
    if (!fromStatus || fromStatus === toStatus) return;
    if (!board.cards[toStatus]) return;

    // Otimista: move o card de coluna e ajusta as contagens.
    qc.setQueryData<FunnelBoard>(boardKey, (prev) => {
      if (!prev) return prev;
      const cards = { ...prev.cards };
      const src = [...(cards[fromStatus] ?? [])];
      const i = src.findIndex((c) => c.id === contactId);
      if (i === -1) return prev;
      const [moved] = src.splice(i, 1);
      cards[fromStatus] = src;
      cards[toStatus] = [{ ...moved, statusId: toStatus }, ...(cards[toStatus] ?? [])];
      const columns = prev.columns.map((col) =>
        col.id === fromStatus
          ? { ...col, count: Math.max(0, col.count - 1) }
          : col.id === toStatus
            ? { ...col, count: col.count + 1 }
            : col,
      );
      return { ...prev, cards, columns };
    });

    try {
      await contactStatusesService.setContactStatus(contactId, toStatus);
      const col = board.columns.find((c) => c.id === toStatus);
      toast.success(`Movido para "${col?.name ?? 'status'}"`);
      qc.invalidateQueries({ queryKey: ['funnel-board', orgId] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao mover');
      qc.invalidateQueries({ queryKey: boardKey });
    }
  };

  const totalCards = board?.columns.reduce((a, c) => a + c.count, 0) ?? 0;

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <KanbanSquare className="h-4 w-4" />
          </span>
          Funil
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-400">{totalCards} no funil</span>
          {/* Seletor de workspace (departamento) */}
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white py-1.5 px-2.5 text-sm font-medium text-zinc-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="">Todos os departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Board */}
      {isLoading || !board ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
          Carregando funil…
        </div>
      ) : board.columns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <KanbanSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhum status no funil</p>
          <p className="mt-1 text-xs text-zinc-400">Crie status em Configurações → Status para montar o funil.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-3 overflow-x-auto p-4 min-h-0">
            {board.columns.map((col) => (
              <Column
                key={col.id}
                column={col}
                cards={board.cards[col.id] ?? []}
                onCardClick={(c) => c.conversationId && setViewConvId(c.conversationId)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <Card card={activeCard} dragging />
            ) : activeColumn ? (
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-lg ring-1 ring-primary/30 dark:bg-zinc-800">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeColumn.color }} />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{activeColumn.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ConversationDialog
        open={!!viewConvId}
        conversationId={viewConvId}
        onClose={() => setViewConvId(null)}
      />
    </div>
  );
}

function Column({
  column,
  cards,
  onCardClick,
}: {
  column: FunnelBoard['columns'][number];
  cards: TCard[];
  onCardClick: (c: TCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });
  return (
    <div className={cn('flex w-72 shrink-0 flex-col rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60', isDragging && 'opacity-40')}>
      <div className="flex items-center gap-1.5 px-2 py-2.5">
        <button
          ref={setDragRef}
          {...listeners}
          {...attributes}
          title="Arraste para reordenar o funil"
          className="cursor-grab touch-none rounded p-0.5 text-zinc-300 hover:bg-zinc-200 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:bg-zinc-800"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{column.name}</span>
        <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {column.count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors min-h-[80px] rounded-lg',
          isOver && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/30',
        )}
      >
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-zinc-400">Vazio</p>
        ) : (
          cards.map((c) => <Card key={c.id} card={c} onClick={() => onCardClick(c)} />)
        )}
        {column.count > cards.length && (
          <p className="px-2 py-1 text-center text-[10px] text-zinc-400">
            +{column.count - cards.length} (refine por departamento)
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ card, onClick, dragging }: { card: TCard; onClick?: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { type: 'card', card },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const color = avatarColor(card.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'cursor-grab rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800',
        (isDragging || dragging) && 'opacity-60 shadow-lg',
      )}
    >
      <div className="flex items-center gap-2">
        {card.avatarUrl ? (
          <img src={card.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-black/5" />
        ) : (
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ring-1 ring-black/5"
            style={{ backgroundColor: color }}
          >
            {avatarInitials(card.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
            {card.name || 'Sem nome'}
          </p>
          {card.phone && (
            <p className="flex items-center gap-1 truncate text-[11px] text-zinc-400">
              <Phone className="h-2.5 w-2.5 shrink-0" />
              <span className="tracking-tight">{formatPhone(card.phone)}</span>
            </p>
          )}
        </div>
      </div>
      {(card.tags.length > 0 || card.conversationId) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {card.tags.slice(0, 2).map((t) => (
            <span
              key={t.id}
              className="truncate rounded px-1.5 py-px text-[9px] font-semibold"
              style={{ backgroundColor: t.color, color: chipTextColor(t.color) }}
            >
              {t.name}
            </span>
          ))}
          {card.conversationId && (
            <MessageSquare className="ml-auto h-3 w-3 text-zinc-300 dark:text-zinc-600" />
          )}
        </div>
      )}
    </div>
  );
}
