'use client';

// Arrastar o CARD nos quadros que NÃO têm dnd-kit (o AdminBoard: CS e Repasse,
// Execução, INSS, Bancária, quadros personalizados).
//
// Nasceu só como ORDEM dentro da coluna, porque nesses quadros a coluna era uma
// trilha (INSS, Bancária) e não uma fase movível. Deixou de ser verdade em
// 31/08/2026, quando CS e Repasse e Execução viraram pipelines de rito com 16 e
// 17 colunas: um kanban de rito em que não se arrasta o card entre colunas está
// travado. Agora o arraste também TROCA DE COLUNA — quem recebe o drop decide o
// que fazer, comparando a fase de origem com a de destino.
//
// Nos quadros que já têm dnd-kit nos cards (Judicial, Pré, Planejamento, Funil),
// a ordem sai do próprio `onDragEnd` — dois sistemas de ponteiro no mesmo card
// brigariam pelo mesmo `pointerdown`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { dropSlotAt } from './card-order';

const LIMIAR = 6;      // px pra virar arraste (abaixo disso é clique/abrir ficha)
const SEGURAR_MS = 320; // no toque: segurar antes de armar (senão é rolagem)
const BORDA = 60;       // faixa que liga a rolagem vertical da coluna
const VELOCIDADE = 12;

export interface CardDragHandle {
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  /** true logo após um arraste — o clique que vem junto NÃO abre a ficha */
  blockedClick: () => boolean;
}

export interface CardDrag {
  dragId: string | null;
  handle: (cardId: string, phaseKey: string) => CardDragHandle | undefined;
  /** visual do card: esmaecido se é o arrastado; linha se marca onde vai cair */
  cardStyle: (cardId: string) => React.CSSProperties | undefined;
}

export function useCardDrag({
  enabled = true,
  accent,
  onDrop,
}: {
  enabled?: boolean;
  accent: string;
  /** `destino` pode ser diferente de `origem`: aí é troca de fase, não reordenação. */
  onDrop: (cardId: string, destino: string, index: number, origem: string) => void;
}): CardDrag {
  const [dragId, setDragId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ cardId: string | null; side: 'top' | 'bottom' } | null>(null);
  const st = useRef({
    id: null as string | null,
    phase: '',          // coluna de ORIGEM (onde o arraste começou)
    faseAlvo: '',       // coluna sob o ponteiro AGORA
    x: 0,
    y: 0,
    started: false,
    armed: false,
    timer: 0 as any,
    index: -1,
    ponteiroX: 0,
    ponteiroY: 0,
    bloqueiaClique: 0,
    raf: 0,
  });

  // Rolagem da COLUNA quando o card chega perto do topo/rodapé dela.
  const autoScroll = useCallback(() => {
    const s = st.current;
    if (!s.started) { s.raf = 0; return; }
    const col = document.querySelector<HTMLElement>(`[data-phase-col="${CSS.escape(s.faseAlvo || s.phase)}"]`);
    if (col) {
      const r = col.getBoundingClientRect();
      if (s.ponteiroY < r.top + BORDA) col.scrollTop -= VELOCIDADE;
      else if (s.ponteiroY > r.bottom - BORDA) col.scrollTop += VELOCIDADE;
    }
    s.raf = requestAnimationFrame(autoScroll);
  }, []);

  const encerrar = useCallback((soltar: boolean) => {
    const s = st.current;
    clearTimeout(s.timer);
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    if (s.started) {
      s.bloqueiaClique = Date.now() + 400;
      document.body.classList.remove('select-none');
      document.body.style.cursor = '';
      if (soltar && s.id && s.index >= 0) onDrop(s.id, s.faseAlvo || s.phase, s.index, s.phase);
    }
    s.id = null; s.started = false; s.armed = false; s.index = -1; s.faseAlvo = '';
    setDragId(null);
    setSlot(null);
  }, [onDrop]);

  /** Coluna sob o ponteiro. Fora de qualquer uma, mantém a última mirada — o
   *  card não deve "voltar" para a origem só porque o dedo passou pelo vão. */
  const colunaSob = useCallback((x: number, y: number): string => {
    const s = st.current;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-phase-col]'))) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top - 80 && y <= r.bottom) {
        return el.dataset.phaseCol || s.faseAlvo || s.phase;
      }
    }
    return s.faseAlvo || s.phase;
  }, []);

  const mirar = useCallback(() => {
    const s = st.current;
    if (!s.id) return;
    s.faseAlvo = colunaSob(s.ponteiroX, s.ponteiroY);
    const alvo = dropSlotAt(s.faseAlvo, s.ponteiroY, s.id);
    s.index = alvo.index;
    setSlot((p) => (p?.cardId === alvo.cardId && p?.side === alvo.side ? p : { cardId: alvo.cardId, side: alvo.side }));
  }, [colunaSob]);

  const iniciar = useCallback(() => {
    const s = st.current;
    if (s.started || !s.id) return;
    s.started = true;
    document.body.classList.add('select-none');
    document.body.style.cursor = 'grabbing';
    setDragId(s.id);
    if (!s.raf) s.raf = requestAnimationFrame(autoScroll);
  }, [autoScroll]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (!s.id) return;
      s.ponteiroX = e.clientX;
      s.ponteiroY = e.clientY;
      if (!s.started) {
        const anda = Math.hypot(e.clientX - s.x, e.clientY - s.y) > LIMIAR;
        if (!s.armed) { if (anda) encerrar(false); return; }
        if (!anda) return;
        iniciar();
      }
      e.preventDefault();
      mirar();
    };
    const up = () => encerrar(true);
    const cancel = () => encerrar(false);
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') encerrar(false); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', tecla);
      clearTimeout(st.current.timer);
      if (st.current.raf) cancelAnimationFrame(st.current.raf);
      document.body.classList.remove('select-none');
      document.body.style.cursor = '';
    };
  }, [encerrar, iniciar, mirar]);

  const handle = useCallback(
    (cardId: string, phaseKey: string): CardDragHandle | undefined => {
      if (!enabled) return undefined;
      return {
        dragging: dragId === cardId,
        blockedClick: () => Date.now() < st.current.bloqueiaClique,
        onPointerDown: (e: React.PointerEvent) => {
          if (e.button !== 0) return;
          // Controle dentro do card (caixinha de seleção, copiar CNJ…) manda mais.
          if ((e.target as HTMLElement).closest('button, input, a, select, textarea, [role="button"]:not([data-card-id])')) return;
          const s = st.current;
          s.id = cardId; s.phase = phaseKey; s.x = e.clientX; s.y = e.clientY; s.ponteiroY = e.clientY;
          s.started = false; s.index = -1;
          if (e.pointerType === 'touch') {
            s.armed = false;
            clearTimeout(s.timer);
            s.timer = setTimeout(() => { s.armed = true; iniciar(); mirar(); }, SEGURAR_MS);
          } else {
            s.armed = true;
          }
        },
      };
    },
    [enabled, dragId, iniciar, mirar],
  );

  const cardStyle = useCallback(
    (cardId: string): React.CSSProperties | undefined => {
      if (!dragId) return undefined;
      if (dragId === cardId) return { opacity: 0.45 };
      if (slot?.cardId !== cardId) return undefined;
      return { boxShadow: `inset 0 ${slot.side === 'top' ? '' : '-'}3px 0 0 ${accent}` };
    },
    [dragId, slot, accent],
  );

  return { dragId, handle, cardStyle };
}
