/**
 * O ARRASTE DO KANBAN, EM UM LUGAR SÓ.
 *
 * 🚨 POR QUE CENTRALIZAR (29/09/2026). O escritório tem SETE quadros que
 * arrastam card, e eles tinham CINCO configurações diferentes: uns com
 * `PointerSensor`, outros com `Mouse` + `Touch`; uns com `closestCenter`, outros
 * sem detecção nenhuma; nenhum com `measuring`. O resultado é que arrastar
 * parecia uma coisa no Pré-Processual e outra no REPB, e "ficou travado" não
 * tinha um lugar para ser consertado.
 *
 * As três causas do travamento, medidas no quadro do Pré-Processual:
 *
 * 1. **A colisão era por área, não por ponteiro.** O padrão do dnd-kit exige que
 *    os retângulos se sobreponham de verdade; com card estreito e coluna larga,
 *    a coluna só "acende" quando boa parte do card já entrou nela. Quem arrasta
 *    olha para o DEDO, não para a caixa: `pointerWithin` acende a coluna sob o
 *    ponteiro, que é o que a mão espera.
 * 2. **As colunas eram medidas uma vez.** Sem `MeasuringStrategy.Always`, a
 *    lista que muda de altura enquanto se arrasta deixa o alvo defasado — a
 *    coluna certa não reage, a de baixo reage no lugar dela.
 * 3. **O pouso tinha ricochete.** A curva antiga terminava em 1.22, ou seja,
 *    passava do ponto e voltava. Em movimento curto isso não lê como suavidade,
 *    lê como tranco.
 *
 * O `delay` do toque desceu de 220ms para 160ms: o suficiente para separar
 * rolar de arrastar (a razão de existir, ver o comentário do sensor no quadro),
 * sem a espera que fazia o card "demorar a colar no dedo".
 */
import {
  MouseSensor,
  TouchSensor,
  MeasuringStrategy,
  closestCorners,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';

/**
 * Mouse por DISTÂNCIA, dedo por ESPERA.
 *
 * 🚨 Não troque por `PointerSensor` sozinho: no celular, qualquer rolagem da
 * coluna virava arraste e o card saía junto com o dedo sem querer (25/09/2026).
 * O `tolerance` perdoa o tremor da mão durante a espera.
 */
export function useSensoresKanban() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
}

/**
 * O alvo é a coluna sob o PONTEIRO. Saindo de todas elas (arrastando pela borda
 * do quadro, ou entre colunas), cai no canto mais próximo em vez de não ter
 * alvo nenhum — sem esse resgate o card "descola" e volta para o lugar.
 */
export const colisaoKanban: CollisionDetection = (args) => {
  const sobOPonteiro = pointerWithin(args);
  return sobOPonteiro.length ? sobOPonteiro : closestCorners(args);
};

/** Colunas remedidas durante o arraste, não só ao começar. */
export const medicaoKanban = {
  droppable: { strategy: MeasuringStrategy.Always },
} as const;

/**
 * O pouso: desacelera e para. Sem ricochete — a curva antiga terminava em 1.22
 * e o card passava do lugar antes de voltar.
 */
export const pousoKanban: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
};

/**
 * A cópia que viaja com o ponteiro. `kanban-pegar` é a animação de PEGAR, que
 * não existia: o card aparecia já inclinado e maior, de um quadro para o outro.
 * `will-change` mantém a cópia na GPU, senão cada quadro dela repinta a árvore.
 */
export const classeCartaoArrastado =
  'pointer-events-none touch-none cursor-grabbing shadow-xl ring-1 ring-black/5 ' +
  'will-change-transform animate-[kanban-pegar_140ms_cubic-bezier(0.2,0,0,1)_both]';
