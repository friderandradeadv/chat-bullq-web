/**
 * O ARRASTE DO KANBAN, EM UM LUGAR SÓ.
 *
 * 🚨 POR QUE CENTRALIZAR (29/09/2026). O escritório tem SETE quadros que
 * arrastam card, e eles tinham CINCO configurações diferentes: uns com
 * `PointerSensor`, outros com `Mouse` + `Touch`; uns com `closestCenter`, outros
 * sem detecção nenhuma; nenhum com `measuring`. Arrastar parecia uma coisa no
 * Pré-Processual e outra no REPB, e "ficou travado" não tinha onde ser
 * consertado.
 *
 * As causas do travamento, medidas no quadro do Pré-Processual:
 *
 * 1. **A colisão era por área, não por ponteiro.** O padrão do dnd-kit exige que
 *    os retângulos se sobreponham; com card estreito e coluna larga, a coluna só
 *    "acende" quando boa parte do card já entrou nela. Quem arrasta olha para o
 *    DEDO: `pointerWithin` acende a coluna sob o ponteiro.
 * 2. **As colunas eram medidas uma vez.** Sem `MeasuringStrategy.Always`, a
 *    lista que muda de altura durante o arraste deixa o alvo defasado.
 * 3. **O pouso tinha ricochete.** A curva antiga terminava em 1.22: passava do
 *    ponto e voltava, o que em movimento curto lê como tranco.
 * 4. **O card só mudava de coluna depois da rede.** A cópia pousava na posição
 *    ANTIGA e o card "subia" depois — ver `pintarAgora`.
 * 5. **Os cards não abriam espaço.** Ver `useVaoKanban`.
 */
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';

/**
 * Mouse por DISTÂNCIA, dedo por ESPERA.
 *
 * 🚨 Não troque por `PointerSensor` sozinho: no celular, qualquer rolagem da
 * coluna virava arraste e o card saía junto com o dedo sem querer (25/09/2026).
 * O `tolerance` perdoa o tremor da mão durante a espera. 160ms é o bastante para
 * separar rolar de arrastar sem o atraso que fazia o card demorar a colar.
 */
export function useSensoresKanban() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
}

/**
 * O alvo é a coluna sob o PONTEIRO. Saindo de todas elas (arrastando pela borda
 * do quadro, ou entre colunas), cai no canto mais próximo em vez de ficar sem
 * alvo — sem esse resgate o card "descola" e volta para o lugar.
 */
export const colisaoKanban: CollisionDetection = (args) => {
  const sobOPonteiro = pointerWithin(args);
  return sobOPonteiro.length ? sobOPonteiro : closestCorners(args);
};

/** Colunas remedidas durante o arraste, não só ao começar. */
export const medicaoKanban = {
  droppable: { strategy: MeasuringStrategy.Always },
} as const;

/** O pouso: desacelera e para, sem ricochete. */
export const pousoKanban: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
};

/**
 * A cópia que viaja com o ponteiro. `kanban-pegar` (em globals.css) é a animação
 * de PEGAR, que não existia: o card aparecia já inclinado e maior, de um quadro
 * para o outro. `will-change` mantém a cópia na GPU.
 */
export const classeCartaoArrastado =
  'pointer-events-none touch-none cursor-grabbing shadow-xl ring-1 ring-black/5 ' +
  'will-change-transform animate-[kanban-pegar_140ms_cubic-bezier(0.2,0,0,1)_both]';

/**
 * Aplica a mudança e força o React a PINTAR antes de seguir.
 *
 * 🚨 POR QUE ISTO EXISTE. O `DragOverlay` pousa animando até a posição do card
 * REAL de mesmo id. Se, ao soltar, o card ainda está na coluna de origem —
 * porque o `setActiveId(null)` vinha primeiro e a mudança de fase esperava a
 * rede — a cópia voa de volta para o lugar antigo, some, e o card aparece na
 * fase nova um instante depois. Era o "delay para subir" que o escritório
 * apontou em 29/09/2026.
 *
 * A ordem certa é: move otimista no cache DENTRO daqui, depois `setActiveId(null)`,
 * e a rede por último, sem ninguém esperando.
 *
 * 🚨 `flushSync` LANÇA se for chamado de dentro de um ciclo de vida do React, e
 * o dnd-kit chama o `onDragEnd` do fluxo dele. Lançar ali derrubaria o soltar
 * inteiro — daí o resgate: sem o flush, o card ainda vai para a coluna certa, só
 * perde o pouso animado. Degradar é aceitável; quebrar o arraste não.
 */
export function pintarAgora(fn: () => void) {
  try {
    flushSync(fn);
  } catch {
    fn();
  }
}

/**
 * Índice de queda sob o ponteiro, DESCONTANDO o vão já aberto.
 *
 * 🚨 `getBoundingClientRect()` inclui o `transform`. Com o vão aberto, os cards
 * abaixo do ponto estão deslocados: a medida muda, o índice muda junto, o vão
 * pula para outro lugar e a coluna treme. O `@dnd-kit/sortable` resolve medindo
 * o layout ORIGINAL; aqui o mesmo efeito vem de subtrair o deslocamento que nós
 * mesmos aplicamos.
 *
 * Usa `[data-phase-col]` e `[data-card-id]` — os mesmos atributos de
 * `card-order.ts`. Quadro sem eles não abre vão (devolve -1) e continua
 * funcionando no resto.
 */
export function indiceDeQueda(coluna: string, y: number, arrastado: string): number {
  const col = document.querySelector(`[data-phase-col="${CSS.escape(coluna)}"]`);
  if (!col) return -1;
  let i = 0;
  for (const el of Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]'))) {
    if (el.dataset.cardId === arrastado) continue;
    const r = el.getBoundingClientRect();
    const m = /translate3d\(\s*0(?:px)?\s*,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
    const topReal = r.top - (m ? parseFloat(m[1]) : 0);
    if (y < topReal + r.height / 2) return i;
    i++;
  }
  return i; // abaixo de todos → fim da coluna
}

export type VaoKanban = { coluna: string; idx: number; h: number };

/**
 * O VÃO QUE SE ABRE SOB O PONTEIRO.
 *
 * Pedido do escritório em 30/09/2026: arrastando por cima dos cards, eles têm de
 * abrir espaço no ponto em que o card vai cair. É o comportamento do
 * `@dnd-kit/sortable`, que não dá para adotar sem refazer os quadros inteiros —
 * seleção em massa, arraste de coluna e regras de ordenação estão penduradas no
 * `useDraggable`/`useDroppable` atuais.
 *
 * O deslocamento é `transform`, não margem: transform não reflui o layout, então
 * a coluna não é remedida a cada pixel do ponteiro. E o estado só muda quando o
 * ALVO muda — o ponteiro dispara `onDragMove` dezenas de vezes por segundo, e um
 * `setState` por evento repintaria a coluna toda.
 */
export function useVaoKanban(aceita: (colunaId: string) => boolean) {
  const [vao, setVao] = useState<VaoKanban | null>(null);
  const altura = useRef(0);

  const aoIniciar = (e: DragStartEvent) => {
    altura.current = e.active.rect.current.initial?.height ?? 96;
  };

  const aoMover = (e: DragMoveEvent) => {
    const to = e.over?.id as string | undefined;
    if (!to || !aceita(to)) {
      if (vao) setVao(null);
      return;
    }
    const y = ((e.activatorEvent as PointerEvent | undefined)?.clientY ?? 0) + e.delta.y;
    const idx = indiceDeQueda(to, y, e.active.id as string);
    if (idx < 0) {
      if (vao) setVao(null);
      return;
    }
    if (vao && vao.coluna === to && vao.idx === idx) return;
    setVao({ coluna: to, idx, h: altura.current });
  };

  return { vao, aoIniciar, aoMover, fechar: () => setVao(null) };
}

/** Respiro entre cards (o `gap-2.5` das colunas), somado à altura do vão. */
const RESPIRO = 10;

/**
 * Casa cada item da coluna com o quanto ele desce para abrir o vão.
 *
 * O card ARRASTADO não desce (ele já está desbotado no lugar dele) e não conta
 * na posição — é a mesma regra de `indiceDeQueda`, e as duas contas TÊM de
 * concordar: se o vão abrisse num índice e o card caísse em outro, a animação
 * mentiria sobre o resultado.
 */
export function comVao<T extends { id: string }>(
  itens: T[],
  coluna: string,
  vao: VaoKanban | null,
  arrastadoId: string | null,
): { item: T; desloca: number }[] {
  const aqui = vao && vao.coluna === coluna ? vao : null;
  let n = 0;
  return itens.map((item) => {
    const ehOArrastado = item.id === arrastadoId;
    const desloca = !ehOArrastado && aqui && n >= aqui.idx ? aqui.h + RESPIRO : 0;
    if (!ehOArrastado) n += 1;
    return { item, desloca };
  });
}

/** O `style` do card deslocado. `undefined` quando não há vão, para não sujar o DOM. */
export const estiloDoVao = (desloca: number) =>
  desloca ? { transform: `translate3d(0, ${desloca}px, 0)` } : undefined;
