import { useCallback, useRef } from 'react';

/**
 * "Puxar" o kanban pro lado: arrastar o fundo (espaço vazio) faz scroll
 * horizontal, igual ao Astrea/Trello. NÃO sequestra clique/arraste de card
 * (dnd-kit) — só inicia o pan quando o mousedown cai fora de elementos
 * interativos (botões, links, inputs, cards marcados com [data-no-drag-scroll]).
 *
 * Uso:
 *   const ds = useDragScroll();
 *   <div ref={ds.ref} {...ds.handlers} className="overflow-x-auto cursor-grab">…</div>
 */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const st = useRef({ down: false, startX: 0, startLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, textarea, select, [role="button"], [data-no-drag-scroll]')) {
      return; // deixa o card/botão receber o evento
    }
    st.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft };
    el.classList.add('cursor-grabbing', 'select-none');
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !st.current.down) return;
    el.scrollLeft = st.current.startLeft - (e.pageX - st.current.startX);
  }, []);

  const stop = useCallback(() => {
    const el = ref.current;
    st.current.down = false;
    el?.classList.remove('cursor-grabbing', 'select-none');
  }, []);

  return {
    ref,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp: stop,
      onMouseLeave: stop,
    },
  };
}
