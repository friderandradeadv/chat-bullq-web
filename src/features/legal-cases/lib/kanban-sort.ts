// Ordenação dos cards DENTRO de uma coluna do kanban (estilo Pipefy "Ordenar
// cards da fase"). É preferência de VISUALIZAÇÃO, então mora no localStorage do
// usuário (por fase) — não muda nada no servidor nem afeta os colegas.

import type { KanbanCard } from '../services/legal-cases.service';

export type CardSort = 'manual' | 'due' | 'created' | 'created_desc' | 'updated' | 'alpha';

export const SORT_OPTIONS: { id: CardSort; label: string }[] = [
  { id: 'manual', label: 'Padrão (manual)' },
  { id: 'due', label: 'Vencimento (mais próximo)' },
  { id: 'created', label: 'Criação (mais antigo)' },
  { id: 'created_desc', label: 'Criação (mais recente)' },
  { id: 'updated', label: 'Última atualização' },
  { id: 'alpha', label: 'Alfabética (A–Z)' },
];

/** Campos que a ordenação usa — cada board mapeia seu item para isto. */
export interface SortKeys {
  title: string;
  created: number;   // epoch ms (0 = sem data)
  updated: number;   // epoch ms
  due: number | null; // epoch ms do próximo prazo (null = sem prazo → vai pro fim)
}

const ts = (s?: string | null): number => (s ? new Date(s).getTime() || 0 : 0);

export function kanbanCardKeys(c: KanbanCard): SortKeys {
  return {
    title: c.title ?? '',
    created: ts(c.createdAt),
    updated: ts(c.updatedAt),
    due: c.proximoPrazo?.dueDate ? ts(c.proximoPrazo.dueDate) : null,
  };
}

/** Aplica a ordenação escolhida sem mutar o array original. */
export function applyCardSort<T>(items: T[], sort: CardSort, keys: (it: T) => SortKeys): T[] {
  if (sort === 'manual') return items;
  const arr = [...items];
  arr.sort((a, b) => {
    const ka = keys(a), kb = keys(b);
    switch (sort) {
      case 'alpha':
        return ka.title.localeCompare(kb.title, 'pt-BR', { sensitivity: 'base' });
      case 'created':
        return ka.created - kb.created; // mais antigo primeiro (o que está parado há mais tempo sobe)
      case 'created_desc':
        return kb.created - ka.created; // mais recente primeiro (o que entrou por último sobe)
      case 'updated':
        return kb.updated - ka.updated; // mexido há pouco primeiro
      case 'due': {
        if (ka.due == null && kb.due == null) return 0;
        if (ka.due == null) return 1;  // sem prazo vai pro fim
        if (kb.due == null) return -1;
        return ka.due - kb.due;        // prazo mais próximo primeiro
      }
      default:
        return 0;
    }
  });
  return arr;
}

// ── Persistência por usuário (localStorage), por fase ────────────────────────
const PREFIX = 'bullq:phase-sort:';

export function loadPhaseSort(phaseKey: string): CardSort {
  if (typeof window === 'undefined') return 'manual';
  const v = window.localStorage.getItem(PREFIX + phaseKey);
  return v === 'due' || v === 'created' || v === 'created_desc' || v === 'updated' || v === 'alpha' ? v : 'manual';
}

export function savePhaseSort(phaseKey: string, sort: CardSort): void {
  if (typeof window === 'undefined') return;
  if (sort === 'manual') window.localStorage.removeItem(PREFIX + phaseKey);
  else window.localStorage.setItem(PREFIX + phaseKey, sort);
}
