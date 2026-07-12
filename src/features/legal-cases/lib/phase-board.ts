import type { KanbanPhase } from '../services/legal-cases.service';

// Os 4 quadros jurídicos. Cada card só pode ser movido entre as fases DO SEU
// quadro — a transferência entre quadros é por ação específica (ex.: protocolar
// leva do Pré-Processual pro Judicial), não pelo seletor de fase.
export type Board = 'pre' | 'judicial' | 'banco' | 'inss' | 'plan' | 'repb' | 'repbc';

/** A qual quadro uma fase pertence (repbc_* → Funil REPB; repb_* → REPB; plan_* → Planejamento; banco_* → Bancária; inss_admin → INSS; lane pre → Pré; resto → Judicial). */
export function boardOfPhase(key: string, lane?: 'pre' | 'judicial'): Board {
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
  return all.filter((p) => boardOfPhase(p.key, (p as any).lane) === board);
}
