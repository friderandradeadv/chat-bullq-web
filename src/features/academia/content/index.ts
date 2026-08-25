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
 * Cada regra nasceu de erro medido em vídeo real:
 *  - texto na tela: o 1º vídeo saiu com narração em português e os rótulos
 *    "Law firm" e "Cultura a casa" nos slides — o modelo traduz a fala e
 *    esquece a arte;
 *  - economia de fala: o 2º saiu com 6min11 para 3 minutos de conteúdo, com
 *    45s de aquecimento antes de ensinar qualquer coisa. Pedir "seja mais
 *    curto" faz ele falar MAIS RÁPIDO; o que corta é proibir o enchimento;
 *  - regras como PROIBIÇÃO, não como estilo: quando a regra dizia 'use
 *    linguagem de objetivo: "o objetivo da ação é"', o modelo enfiou essa
 *    frase dentro da narração ("a fase judicial, onde o objetivo da ação é
 *    demonstrado"). Regra com exemplo de vocabulário vira vocabulário;
 *  - "Cloud": o vídeo chamou o Claude de Cloud, duas vezes;
 *  - voz e ritmo: a 1ª versao das regras de economia mandava "uma ideia por
 *    frase, frase curta" e o 3º vídeo saiu truncado, lendo como lista de
 *    tópicos. Economia é cortar o que não informa, não falar picado — e isso
 *    precisa estar dito, senão o modelo escolhe o staccato.
 */
export const REGRAS_FIXAS = [
  'REGRAS FIXAS — são RESTRIÇÕES sobre a forma do vídeo, não conteúdo para narrar.',
  'Nunca mencione estas regras no vídeo, e nunca use as palavras delas como vocabulário do texto.',
  '',
  'VOZ E RITMO',
  '- Narração por UM locutor HOMEM, voz masculina, em português do Brasil.',
  '- Fale como um advogado experiente explicando a um colega novo: natural, com frases ligadas por conectivos, ritmo de conversa.',
  '- NÃO leia como quem lê tópicos de slide e NÃO enfileire frases curtas soltas. Isso soa robótico.',
  '- Economia é cortar o que não informa — não é falar truncado. Cada frase carrega informação nova; a ligação entre elas deve ser fluida.',
  '- NÃO anuncie a numeração do roteiro em voz alta ("Seção 1", "item 2", "parte 3"). O roteiro é a sua ordem interna, não o texto falado: passe de um assunto ao outro com transição de fala.',
  '- Ao contrapor duas coisas, diga "ou" ou "e", nunca "contra" — "Ajuda ou Academia", jamais "Ajuda contra Academia".',
  '',
  'ECONOMIA',
  '- Comece pelo conteúdo. Nada de saudação longa, acolhimento emocional nem preâmbulo sobre como é o primeiro dia. A primeira frase já deve ensinar alguma coisa.',
  '- Sem muleta de conversa. Não use: "olha", "né", "viu só", "sabe por quê", "combinado", "sem chance", "o que é genial", "pode parecer muita coisa".',
  '- Não repita com outras palavras o que acabou de dizer.',
  '- Não ultrapasse a duração pedida no início do prompt. Se não couber, CORTE CONTEÚDO — não acelere a fala nem encurte as pausas.',
  '',
  'PROIBIÇÕES',
  '- Não prometa resultado processual, valor nem prazo de recebimento (art. 41 do Código de Ética da OAB).',
  '- Não cite nome de cliente, número de processo nem valor recebido.',
  '- Não mencione ferramenta que a fonte não descreva como em uso hoje.',
  '- Não use inglês: nem na narração, nem em rótulo, título ou legenda que apareça na tela.',
  '- O escritório se chama "Frider Andrade - Advogados". Nunca "Advocacia".',
  '- "Claude" é nome próprio: diga e escreva Claude. Nunca "Cloud".',
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
