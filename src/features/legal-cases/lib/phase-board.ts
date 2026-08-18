import type { KanbanPhase } from '../services/legal-cases.service';

// Os 4 quadros jurídicos. Cada card só pode ser movido entre as fases DO SEU
// quadro — a transferência entre quadros é por ação específica (ex.: protocolar
// leva do Pré-Processual pro Judicial), não pelo seletor de fase.
// Quadros base + qualquer quadro CUSTOM (chave board_*). O `(string & {})` mantém
// o autocomplete dos base sem travar a atribuição de uma chave custom.
export type Board = 'pre' | 'judicial' | 'banco' | 'inss' | 'plan' | 'repb' | 'repbc' | (string & {});

/**
 * A qual quadro uma fase pertence. Quando o backend já informa o `board` da fase
 * (quadros custom), ele MANDA; senão deriva pelo prefixo/lane (repbc_* → Funil
 * REPB; repb_* → REPB; plan_* → Planejamento; banco_* → Bancária; inss_admin →
 * INSS; lane pre → Pré; resto → Judicial).
 */
export function boardOfPhase(key: string, lane?: 'pre' | 'judicial', board?: string | null): Board {
  if (board) return board; // quadro custom informado pelo backend
  if (key.startsWith('repbc_')) return 'repbc';
  if (key.startsWith('repb_')) return 'repb';
  if (key.startsWith('plan_')) return 'plan';
  if (key.startsWith('banco_')) return 'banco';
  if (key === 'inss_admin') return 'inss';
  if (lane === 'pre') return 'pre';
  return 'judicial';
}

/** Fases de um quadro (para o seletor de mover — só o quadro do card). */
export function phasesOfBoard(all: KanbanPhase[], board: Board): KanbanPhase[] {
  return all.filter((p) => boardOfPhase(p.key, (p as any).lane, (p as any).board) === board);
}

/** Rota do quadro de cada board. Estava duplicada em 3 telas (ficha do processo,
 *  painel do chat, atalho "Ver no Kanban") — agora sai daqui. */
export const BOARD_ROUTE: Record<string, string> = {
  judicial: '/juridico/kanban',
  pre: '/juridico/pre-processual',
  banco: '/juridico/fase-bancaria',
  inss: '/juridico/inss-administrativo',
  plan: '/juridico/planejamento',
  repb: '/juridico/repb',
  repbc: '/juridico/repb-funil',
};

/** Rota do quadro onde ESTA fase mora (quadro custom cai em /juridico/board/<key>). */
export function boardHrefOfPhase(
  key: string | null | undefined,
  lane?: 'pre' | 'judicial',
  board?: string | null,
): string {
  const b = boardOfPhase(key ?? '', lane, board);
  return BOARD_ROUTE[b] ?? `/juridico/board/${b}`;
}
