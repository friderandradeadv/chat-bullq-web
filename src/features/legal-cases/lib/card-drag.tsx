'use client';

// Arrastar o CARD pra cima/baixo dentro da fase, nos quadros que NÃO têm dnd-kit
// (o AdminBoard: Execução & Repasse, INSS, Bancária, quadros personalizados).
// Lá o card nunca foi arrastável — a trilha não é fase movível —, então aqui o
// arraste é só de ORDEM: nunca troca o card de coluna.
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
  onDrop: (cardId: string, phaseKey: string, index: number) => void;
}): CardDrag {
  const [dragId, setDragId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ cardId: string | null; side: 'top' | 'bottom' } | null>(null);
  const st = useRef({
    id: null as string | null,
    phase: '',
    x: 0,
    y: 0,
    started: false,
    armed: false,
    timer: 0 as any,
    index: -1,
    ponteiroY: 0,
    bloqueiaClique: 0,
    raf: 0,
  });

  // Rolagem da COLUNA quando o card chega perto do topo/rodapé dela.
  const autoScroll = useCallback(() => {
    const s = st.current;
    if (!s.started) { s.raf = 0; return; }
    const col = document.querySelector<HTMLElement>(`[data-phase-col="${CSS.escape(s.phase)}"]`);
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
      if (soltar && s.id && s.index >= 0) onDrop(s.id, s.phase, s.index);
    }
    s.id = null; s.started = false; s.armed = false; s.index = -1;
    setDragId(null);
    setSlot(null);
  }, [onDrop]);

  const mirar = useCallback(() => {
    const s = st.current;
    if (!s.id) return;
    const alvo = dropSlotAt(s.phase, s.ponteiroY, s.id);
    s.index = alvo.index;
    setSlot((p) => (p?.cardId === alvo.cardId && p?.side === alvo.side ? p : { cardId: alvo.cardId, side: alvo.side }));
  }, []);

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
