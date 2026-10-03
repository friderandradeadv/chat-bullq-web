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
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  MouseSensor,
  useDndMonitor,
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
 * MEDIDAS DE REFERÊNCIA DO ARRASTE.
 *
 * 🚨 POR QUE MEDIR UMA VEZ, E NÃO A CADA QUADRO (30/09/2026). O escritório
 * relatou o vão "tremendo" perto das bordas. A causa é um laço de
 * realimentação: o cartão tem `transition-[...,transform] duration-200`, então
 * `getBoundingClientRect()` devolve a posição NO MEIO da animação, enquanto
 * `el.style.transform` já diz o valor FINAL. Descontar um do outro dá um topo
 * que não existe em lugar nenhum; o índice oscila, o vão pula, o pulo dispara
 * nova animação, e assim por diante.
 *
 * Perto das bordas é pior porque entra o auto-scroll do dnd-kit: a coluna rola
 * sozinha e os cartões passam sob um ponteiro parado.
 *
 * A saída é a do `@dnd-kit/sortable`: medir o layout ORIGINAL, antes de
 * qualquer vão, e trabalhar sempre em cima dele. As medidas ficam em
 * coordenadas de CONTEÚDO da coluna (`top - topo da coluna + scrollTop`), que
 * não mudam quando a coluna rola — só o ponteiro se move dentro delas, que é
 * exatamente o que se quer.
 *
 * 🚨 As medidas NÃO são apagadas no `fechar()`. O `onDragEnd` das páginas fecha
 * o vão ANTES de chamar `indiceDeQueda` para saber onde o card caiu; limpando
 * ali, o pouso seria calculado com o vão já se fechando, e podia discordar do
 * vão que a pessoa viu. Elas vivem até o arraste seguinte, que as substitui.
 */
/**
 * O Y REAL DO PONTEIRO.
 *
 * 🚨 `activatorEvent.clientY + delta.y` NÃO é onde o dedo está durante o
 * auto-scroll (30/09/2026). O `delta` do dnd-kit é o transform do nó arrastado,
 * e ele JÁ embute o ajuste de rolagem — é o que mantém a cópia colada no
 * ponteiro enquanto a coluna anda sozinha. Somando-o à posição inicial, a
 * rolagem entra na conta DUAS vezes: o `y` cresce sem o dedo sair do lugar, o
 * índice corre à frente e o vão treme. É o defeito que aparece justamente perto
 * das bordas, que é onde o auto-scroll liga.
 *
 * O ponteiro de verdade vem do evento do navegador. Parado o dedo, o valor não
 * muda — e a coluna rolando sob ele muda o índice pela via certa, que é o
 * `scrollTop` dentro de `baseDa`.
 *
 * O ouvinte é passivo, só escreve um número, e é ligado na primeira medição
 * (nunca no import: `window` não existe no SSR do Next).
 */
let ponteiroX: number | null = null;
let ponteiroY: number | null = null;
let ouvindo = false;

function ouvirPonteiro(): void {
  if (ouvindo || typeof window === 'undefined') return;
  ouvindo = true;
  const anota = (ev: Event) => {
    const t = ev as PointerEvent & { touches?: TouchList };
    const p = t.touches?.length ? t.touches[0] : t;
    if (p && typeof p.clientY === 'number') {
      ponteiroX = p.clientX;
      ponteiroY = p.clientY;
    }
  };
  window.addEventListener('pointermove', anota, { passive: true });
  window.addEventListener('touchmove', anota, { passive: true });
}

/** Y do ponteiro; sem evento do navegador ainda, cai na conta antiga. */
export function yDoPonteiro(e: { activatorEvent?: unknown; delta: { y: number } }): number {
  if (ponteiroY != null) return ponteiroY;
  return ((e.activatorEvent as PointerEvent | undefined)?.clientY ?? 0) + e.delta.y;
}

/**
 * A LISTA ROLA ENQUANTO O CARD ESTÁ NA MÃO.
 *
 * 🚨 POR QUE ISTO EXISTE (02/10/2026). Pedido do escritório: "a animação de
 * arrastar card não me deixa rolar verticalmente". Eram DOIS defeitos
 * diferentes, que pareciam um só.
 *
 * 1. **A roda do mouse não chegava na coluna.** O `DragOverlay` do dnd-kit
 *    desenha um `<div position:fixed>` do tamanho do card colado no ponteiro, e
 *    esse `div` NÃO tem `pointer-events:none` (só o card lá dentro tem). Com o
 *    cursor sempre em cima dele, o `wheel` tinha como alvo a cópia — que não
 *    rola — e subia a árvore até o `body`, que no desktop também não rola. Daí
 *    a sensação de roda "morta" durante o arraste. Aqui a roda é tratada na
 *    mão: acha a lista sob o ponteiro e rola ela.
 *
 * 2. **O auto-scroll do dnd-kit nunca ligava nas colunas.** O
 *    `getScrollableAncestors` dele pula o PRÓPRIO elemento (`if (node !==
 *    element)`), e o nó que ele consulta durante o arraste é o `over` — que nos
 *    nossos quadros é exatamente o `div` com `overflow-y-auto` da coluna. Ou
 *    seja: a única lista que interessa era a única excluída da conta. Por isso
 *    encostar na borda de cima/baixo não fazia nada. Aqui a borda é medida na
 *    mão, por quadro de animação.
 *
 * A lista é descoberta por `elementsFromPoint`, não por `[data-phase-col]`:
 * metade dos quadros do escritório (tarefas, INSS, admin, REPB) não põe esse
 * atributo, e a regra "primeiro elemento sob o ponteiro que rola na vertical"
 * vale em todos eles — inclusive na página inteira no celular. A cópia do
 * arraste aparece na lista do `elementsFromPoint` e é descartada por não rolar.
 *
 * 🚨 Quem rola tem de AVISAR: o vão (`useVaoKanban`) é recalculado a partir do
 * ponteiro, e com o dedo parado e a coluna andando sob ele o índice muda sem
 * que nenhum evento do dnd-kit dispare. Sem o aviso, o vão fica aberto no lugar
 * errado e o card cai onde a pessoa não viu.
 */

/** Faixa, em px, a partir da borda da lista em que a rolagem automática liga. */
const ZONA_DE_BORDA = 72;
/** Rolagem máxima por quadro de animação, no limite da borda. */
const VELOCIDADE_MAX = 18;

const assinantesDaRolagem = new Set<() => void>();

/** Avisado a cada rolagem feita durante o arraste. Devolve o cancelamento. */
export function inscreverNaRolagem(fn: () => void): () => void {
  assinantesDaRolagem.add(fn);
  return () => {
    assinantesDaRolagem.delete(fn);
  };
}

function avisarRolagem(): void {
  assinantesDaRolagem.forEach((fn) => fn());
}

function rolaNaVertical(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const ov = getComputedStyle(el).overflowY;
  return ov === 'auto' || ov === 'scroll' || ov === 'overlay';
}

/**
 * A lista sob o ponteiro. Guardada entre quadros: com o dedo parado na borda,
 * o `elementsFromPoint` seria refeito 60 vezes por segundo para dar sempre a
 * mesma resposta.
 */
let listaEmCache: { x: number; y: number; el: HTMLElement | null } | null = null;

function listaEm(x: number, y: number): HTMLElement | null {
  const c = listaEmCache;
  if (c && Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2 && (!c.el || c.el.isConnected)) return c.el;
  let achada: HTMLElement | null = null;
  for (const el of document.elementsFromPoint(x, y)) {
    if (rolaNaVertical(el)) {
      achada = el;
      break;
    }
  }
  listaEmCache = { x, y, el: achada };
  return achada;
}

/** Um quadro de rolagem automática: só rola se o ponteiro está na faixa da borda. */
function rolarUmQuadro(): void {
  const x = ponteiroX;
  const y = ponteiroY;
  if (x == null || y == null) return;
  const lista = listaEm(x, y);
  if (!lista) return;
  const r = lista.getBoundingClientRect();
  const peloAlto = r.top + ZONA_DE_BORDA - y;
  const peloBaixo = y - (r.bottom - ZONA_DE_BORDA);
  let fator = 0;
  if (peloAlto > 0) fator = -Math.min(1, peloAlto / ZONA_DE_BORDA);
  else if (peloBaixo > 0) fator = Math.min(1, peloBaixo / ZONA_DE_BORDA);
  if (!fator) return;
  const antes = lista.scrollTop;
  lista.scrollTop = antes + fator * VELOCIDADE_MAX;
  if (lista.scrollTop !== antes) avisarRolagem();
}

function aoGirarARoda(ev: WheelEvent): void {
  ponteiroX = ev.clientX;
  ponteiroY = ev.clientY;
  const lista = listaEm(ev.clientX, ev.clientY);
  if (!lista) return;
  // `deltaMode`: 0 = px, 1 = linhas, 2 = páginas. Sem a conversão, a roda de
  // mouse (que costuma vir em linhas) andaria 3px por clique.
  const passo =
    ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * lista.clientHeight : ev.deltaY;
  const antes = lista.scrollTop;
  lista.scrollTop = antes + passo;
  // Sempre segura o evento: chegando ao fim da lista, deixar passar faria a
  // página rolar atrás do arraste, e aí o card e o ponteiro se desencontram.
  ev.preventDefault();
  if (lista.scrollTop !== antes) avisarRolagem();
}

let quadro = 0;

function laco(): void {
  rolarUmQuadro();
  quadro = requestAnimationFrame(laco);
}

export function ligarRolagemDoArraste(e?: { activatorEvent?: unknown }): void {
  if (typeof window === 'undefined' || quadro) return;
  ouvirPonteiro();
  // Semente: o `pointermove` só vai escrever no primeiro movimento, e o arraste
  // pode começar já na borda.
  const a = e?.activatorEvent as { clientX?: number; clientY?: number } | undefined;
  if (ponteiroX == null && typeof a?.clientX === 'number' && typeof a?.clientY === 'number') {
    ponteiroX = a.clientX;
    ponteiroY = a.clientY;
  }
  listaEmCache = null;
  window.addEventListener('wheel', aoGirarARoda, { passive: false, capture: true });
  quadro = requestAnimationFrame(laco);
}

export function desligarRolagemDoArraste(): void {
  if (typeof window === 'undefined') return;
  if (quadro) cancelAnimationFrame(quadro);
  quadro = 0;
  listaEmCache = null;
  window.removeEventListener('wheel', aoGirarARoda, { capture: true });
}

/**
 * Liga a rolagem durante o arraste SEM tocar nos `onDrag*` da página: basta
 * pôr `<RolagemNoArraste />` dentro do `<DndContext>`. São nove quadros com
 * cinco jeitos diferentes de tratar o soltar; entrar em cada um deles era
 * convite para quebrar um e não perceber.
 */
export function RolagemNoArraste(): null {
  useDndMonitor({
    onDragStart: (e) => ligarRolagemDoArraste(e),
    onDragEnd: desligarRolagemDoArraste,
    onDragCancel: desligarRolagemDoArraste,
  });
  // Desmontar no meio do arraste (troca de aba, filtro que esvazia o quadro)
  // deixaria o `requestAnimationFrame` rodando para sempre.
  useEffect(() => desligarRolagemDoArraste, []);
  return null;
}

type MedidaColuna = { itens: { id: string; top: number; h: number }[] };
let medidas: Map<string, MedidaColuna> | null = null;

/** Topo do conteúdo da coluna, em coordenadas de viewport. */
const baseDa = (col: HTMLElement) => col.getBoundingClientRect().top - col.scrollTop;

/** Fotografa o layout de todas as colunas. Chamado no início do arraste. */
export function medirColunas(): void {
  ouvirPonteiro();
  const m = new Map<string, MedidaColuna>();
  document.querySelectorAll<HTMLElement>('[data-phase-col]').forEach((col) => {
    const chave = col.dataset.phaseCol;
    if (!chave) return;
    const base = baseDa(col);
    const itens = Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.cardId ?? '', top: r.top - base, h: r.height };
      })
      .filter((x) => x.id);
    m.set(chave, { itens });
  });
  medidas = m;
}

/**
 * Índice de queda sob o ponteiro, pelo layout ORIGINAL da coluna.
 *
 * Usa `[data-phase-col]` e `[data-card-id]` — os mesmos atributos de
 * `card-order.ts`. Quadro sem eles não abre vão (devolve -1) e continua
 * funcionando no resto.
 *
 * Sem medida guardada (ou com a coluna tendo mudado de tamanho no meio do
 * arraste, o que acontece quando um card entra por movimento otimista), mede na
 * hora descontando o transform aplicado — é o comportamento antigo, menos
 * estável, mas melhor do que devolver lixo.
 */
export function indiceDeQueda(coluna: string, y: number, arrastado: string): number {
  const col = document.querySelector<HTMLElement>(`[data-phase-col="${CSS.escape(coluna)}"]`);
  if (!col) return -1;
  const base = baseDa(col);
  const noConteudo = y - base;

  const guardadas = medidas?.get(coluna);
  const naTela = col.querySelectorAll('[data-card-id]').length;
  const itens =
    guardadas && guardadas.itens.length === naTela
      ? guardadas.itens
      : Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]')).map((el) => {
          const r = el.getBoundingClientRect();
          const m = /translate3d\(\s*0(?:px)?\s*,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
          return {
            id: el.dataset.cardId ?? '',
            top: r.top - base - (m ? parseFloat(m[1]) : 0),
            h: r.height,
          };
        });

  let i = 0;
  for (const it of itens) {
    if (it.id === arrastado) continue;
    if (noConteudo < it.top + it.h / 2) return i;
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
  // 🚨 Quem está sob o ponteiro AGORA, para refazer a conta quando a coluna
  // rola sozinha (ver `inscreverNaRolagem`): o dnd-kit não dispara `onDragMove`
  // por rolagem de lista que ele nem enxerga como rolável.
  const alvo = useRef<{ coluna: string; arrastado: string } | null>(null);
  const vaoAgora = useRef<VaoKanban | null>(null);
  vaoAgora.current = vao;

  /** Recalcula o vão para `coluna` a partir do Y informado. */
  const recalcular = (coluna: string, arrastado: string, y: number) => {
    const idx = indiceDeQueda(coluna, y, arrastado);
    const atual = vaoAgora.current;
    if (idx < 0) {
      if (atual) setVao(null);
      return;
    }
    if (atual && atual.coluna === coluna && atual.idx === idx) return;
    setVao({ coluna, idx, h: altura.current });
  };

  // Dedo parado + coluna andando = índice novo sem evento nenhum do dnd-kit.
  useEffect(
    () =>
      inscreverNaRolagem(() => {
        const a = alvo.current;
        if (!a || ponteiroY == null) return;
        recalcular(a.coluna, a.arrastado, ponteiroY);
      }),
    // `recalcular` só lê refs e `setVao` (estável): reinscrever a cada render
    // trocaria o ouvinte no meio do arraste sem ganho nenhum.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const aoIniciar = (e: DragStartEvent) => {
    altura.current = e.active.rect.current.initial?.height ?? 96;
    alvo.current = null;
    medirColunas(); // fotografa o layout ANTES de qualquer vão — ver `medidas`
  };

  const aoMover = (e: DragMoveEvent) => {
    const to = e.over?.id as string | undefined;
    if (!to || !aceita(to)) {
      alvo.current = null;
      if (vao) setVao(null);
      return;
    }
    alvo.current = { coluna: to, arrastado: e.active.id as string };
    recalcular(to, e.active.id as string, yDoPonteiro(e));
  };

  return {
    vao,
    aoIniciar,
    aoMover,
    fechar: () => {
      alvo.current = null;
      setVao(null);
    },
  };
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
