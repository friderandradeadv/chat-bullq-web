// Ordem MANUAL dos cards dentro da fase — arrastar o card pra cima/baixo.
// A ordem é do ESCRITÓRIO (org.settings.kanbanCardOrder, via API), igual à das
// colunas: quem arrasta muda pra todo mundo. Só vale quando a coluna está em
// "Padrão (manual)"; nas outras ordenações a regra escolhida manda.

import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { legalCasesService, type KanbanData } from '../services/legal-cases.service';

/** Marcadores no DOM que o cálculo do ponto de soltura procura. */
export const colAttr = (phaseKey: string) => ({ 'data-phase-col': phaseKey });
export const cardAttr = (id: string) => ({ 'data-card-id': id });

/**
 * Onde o card cai numa coluna, a partir do Y do ponteiro: percorre os cards
 * MONTADOS e compara com o meio de cada um. Lê o DOM em vez de guardar refs
 * porque os boards montam o card de 6 jeitos diferentes — o atributo
 * `data-card-id` é o contrato único entre eles.
 * Retorna o índice de inserção (0 = topo), já ignorando o card arrastado.
 */
export function dropIndexAt(phaseKey: string, clientY: number, draggedId: string, root: ParentNode = document): number {
  const col = root.querySelector(`[data-phase-col="${CSS.escape(phaseKey)}"]`);
  if (!col) return -1;
  const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]'));
  let i = 0;
  for (const el of cards) {
    if (el.dataset.cardId === draggedId) continue;
    const r = el.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
    i++;
  }
  return i; // soltou abaixo de todos → fim da coluna
}

/**
 * Igual ao `dropIndexAt`, mas devolve também QUAL card marca a posição — o
 * arraste sem dnd-kit usa isso pra desenhar a linha de onde o card vai cair.
 */
export function dropSlotAt(
  phaseKey: string,
  clientY: number,
  draggedId: string,
  root: ParentNode = document,
): { index: number; cardId: string | null; side: 'top' | 'bottom' } {
  const col = root.querySelector(`[data-phase-col="${CSS.escape(phaseKey)}"]`);
  if (!col) return { index: -1, cardId: null, side: 'top' };
  const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]')).filter(
    (el) => el.dataset.cardId !== draggedId,
  );
  let i = 0;
  for (const el of cards) {
    const r = el.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return { index: i, cardId: el.dataset.cardId ?? null, side: 'top' };
    i++;
  }
  const ultimo = cards[cards.length - 1];
  return { index: i, cardId: ultimo?.dataset.cardId ?? null, side: 'bottom' };
}

/** Lista de ids com `id` reinserido na posição `index` (sem duplicar). */
export function idsWithMove(ids: string[], id: string, index: number): string[] {
  const sem = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(index, sem.length));
  return [...sem.slice(0, at), id, ...sem.slice(at)];
}

/**
 * Grava a ordem da fase: mexe no cache na hora (o card já fica no lugar novo) e
 * persiste. Erro → recarrega o quadro e avisa.
 */
export async function persistCardOrder(
  qc: QueryClient,
  queryKey: readonly unknown[],
  phase: string,
  ids: string[],
) {
  qc.setQueryData<KanbanData>(queryKey, (old) =>
    old ? { ...old, cardOrder: { ...(old.cardOrder ?? {}), [phase]: ids } } : old,
  );
  try {
    await legalCasesService.saveCardOrder(phase, ids);
  } catch (e: any) {
    qc.invalidateQueries({ queryKey });
    toast.error(e?.response?.data?.message || 'Erro ao salvar a ordem dos cards');
  }
}

/** Aviso único quando a coluna está ordenada por regra — aí não dá pra ordenar à mão. */
export function avisoOrdenacaoAtiva(sortLabel: string) {
  toast.info(`Esta fase está ordenada por "${sortLabel}" — troque para “Padrão (manual)” no ⋮ da fase para ordenar arrastando.`);
}
