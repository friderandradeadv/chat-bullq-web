import type { Aula, Trilha } from '../types';
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

/**
 * Regras que valem para TODOS os vídeos. Ficam aqui, e não copiadas em cada
 * prompt, para não existir a versão desatualizada de uma delas.
 *
 * A regra do texto na tela nasceu de erro medido: o 1º vídeo gerado saiu com
 * narração em português mas com os rótulos "Law firm" e "Cultura a casa" nos
 * slides. O modelo traduz a fala e esquece a arte.
 */
export const REGRAS_FIXAS = [
  'REGRAS FIXAS (valem para todos os vídeos da Academia):',
  '- Idioma: português do Brasil na narração E em todo texto que aparecer na tela. Nenhum rótulo, título, legenda ou palavra solta em inglês nos slides.',
  '- Nunca prometa resultado processual (art. 41 do Código de Ética da OAB). Use linguagem de objetivo: "o que buscamos é", "o objetivo da ação é".',
  '- Não cite nome de cliente, número de processo nem valor recebido.',
  '- Fale apenas das ferramentas que a fonte descreve como em uso hoje.',
  '- O escritório se chama "Frider Andrade - Advogados". Nunca "Advocacia".',
].join('\n');

/** O prompt como ele deve ser colado no NotebookLM: o da aula + as regras fixas. */
export function promptCompleto(aula: Aula): string {
  return aula.promptVideo ? `${aula.promptVideo}\n\n${REGRAS_FIXAS}` : '';
}

export const TOTAL_AULAS = TRILHAS.reduce((n, t) => n + t.aulas.length, 0);
export const TOTAL_MINUTOS = TRILHAS.reduce(
  (n, t) => n + t.aulas.reduce((m, a) => m + a.minutos, 0),
  0,
);
