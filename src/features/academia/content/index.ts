import type { Trilha } from '../types';
import { COMECE_POR_AQUI } from './00-comece-por-aqui';
import { HUB } from './01-hub';
import { CLAUDE } from './02-claude';
import { PRAZOS } from './03-prazos';
import { FASE_JUDICIAL } from './04-fase-judicial';
import { TESES } from './05-teses';
import { CLIENTE } from './06-cliente';
import { ETICA } from './07-etica';

/** A biblioteca inteira, na ordem em que se faz. */
export const TRILHAS: Trilha[] = [
  COMECE_POR_AQUI,
  HUB,
  CLAUDE,
  PRAZOS,
  FASE_JUDICIAL,
  TESES,
  CLIENTE,
  ETICA,
];

/** Trilhas obrigatórias na primeira semana — na ordem do roteiro dia a dia
 *  da aula "Sua primeira semana" (dia 1 cultura, 2 hub, 3 tese, 4 Claude, 5 prazo). */
export const OBRIGATORIAS = ['comece', 'hub', 'teses', 'claude', 'prazos'];

export const TOTAL_AULAS = TRILHAS.reduce((n, t) => n + t.aulas.length, 0);
export const TOTAL_MINUTOS = TRILHAS.reduce(
  (n, t) => n + t.aulas.reduce((m, a) => m + a.minutos, 0),
  0,
);
