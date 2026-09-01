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
  /** coluna sob o ponteiro durante o arraste (para destacá-la) */
  alvo: string | null;
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
  const [alvo, setAlvo] = useState<string | null>(null);
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
    fantasma: null as HTMLElement | null, // clone que acompanha o cursor
    pegX: 0,  // onde no card o usuário pegou — o clone segue por esse ponto,
    pegY: 0,  // senão o card "pula" para o canto no primeiro movimento

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
    s.fantasma?.remove();
    s.fantasma = null;
    if (s.started) {
      s.bloqueiaClique = Date.now() + 400;
      document.body.classList.remove('select-none');
      document.body.style.cursor = '';
      if (soltar && s.id && s.index >= 0) onDrop(s.id, s.faseAlvo || s.phase, s.index, s.phase);
    }
    s.id = null; s.started = false; s.armed = false; s.index = -1; s.faseAlvo = '';
    setDragId(null);
    setSlot(null);
    setAlvo(null);
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
    setAlvo((p) => (p === s.faseAlvo ? p : s.faseAlvo));
    const alvo = dropSlotAt(s.faseAlvo, s.ponteiroY, s.id);
    s.index = alvo.index;
    setSlot((p) => (p?.cardId === alvo.cardId && p?.side === alvo.side ? p : { cardId: alvo.cardId, side: alvo.side }));
  }, [colunaSob]);

  /**
   * Clone do card que acompanha o cursor. Sem ele o arraste "não acontece" na
   * tela: o original só esmaecia e, em coluna VAZIA, não havia marca nenhuma —
   * a maioria das colunas de um pipeline está vazia. É nó de DOM (não estado
   * React) porque a posição muda a cada pointermove: re-render a 120Hz travaria
   * o quadro inteiro.
   */
  const criarFantasma = useCallback((cardId: string) => {
    const s = st.current;
    const el = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardId)}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true) as HTMLElement;
    g.removeAttribute('data-card-id'); // não pode ser alvo de mira nem de clique
    g.style.cssText = `position:fixed;left:0;top:0;width:${r.width}px;margin:0;pointer-events:none;z-index:9999;opacity:.97;transform:translate(${r.left}px,${r.top}px) rotate(2deg);box-shadow:0 14px 32px rgba(0,0,0,.30);transition:none`;
    document.body.appendChild(g);
    s.fantasma = g;
    s.pegX = s.x - r.left;
    s.pegY = s.y - r.top;
  }, []);

  const moverFantasma = useCallback((x: number, y: number) => {
    const g = st.current.fantasma;
    if (g) g.style.transform = `translate(${x - st.current.pegX}px,${y - st.current.pegY}px) rotate(2deg)`;
  }, []);

  const iniciar = useCallback(() => {
    const s = st.current;
    if (s.started || !s.id) return;
    s.started = true;
    criarFantasma(s.id);
    document.body.classList.add('select-none');
    document.body.style.cursor = 'grabbing';
    setDragId(s.id);
    if (!s.raf) s.raf = requestAnimationFrame(autoScroll);
  }, [autoScroll, criarFantasma]);

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
      moverFantasma(e.clientX, e.clientY);
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
      st.current.fantasma?.remove();
      st.current.fantasma = null;
    };
  }, [encerrar, iniciar, mirar, moverFantasma]);

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
          s.id = cardId; s.phase = phaseKey; s.x = e.clientX; s.y = e.clientY;
          s.ponteiroX = e.clientX; s.ponteiroY = e.clientY;
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

  return { dragId, alvo, handle, cardStyle };
}
