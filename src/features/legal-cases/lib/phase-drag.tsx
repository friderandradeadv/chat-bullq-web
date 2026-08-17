'use client';

// Arrastar a FASE (coluna inteira) de um lugar pro outro no kanban — segurar o
// cabeçalho da coluna e soltar onde ela deve ficar, estilo Pipefy/Trello.
//
// Por que ponteiro "na mão" e não dnd-kit: os quadros já rodam um DndContext pros
// CARDS; aninhar um segundo contexto (colunas) faz os dois sensores brigarem pelo
// mesmo pointerdown. Aqui o arraste da coluna nasce só no cabeçalho, que não é
// draggable de card nenhum, então os dois convivem sem se ver.
//
// Uso (igual nos 6 quadros):
//   const drag = usePhaseDrag({ enabled: canManage, accent: '#e11970', scrollRef: dragScroll.ref,
//     onDrop: (k, alvo, onde) => applyPhaseDrag(qc, KEY, k, alvo, onde) });
//   <div ref={drag.columnRef(phase.key)} style={drag.columnStyle(phase.key)} …>
//     <PhaseHeader … drag={drag.handle(phase.key)} />

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { legalCasesService, type KanbanData } from '../services/legal-cases.service';

/** Distância (px) que o ponteiro precisa andar pra virar arraste — abaixo disso é clique. */
const LIMIAR = 6;
/** No toque: segurar este tempo antes de o arraste armar (senão é rolagem do dedo). */
const SEGURAR_MS = 320;
/** Faixa da borda que liga a rolagem automática enquanto arrasta. */
const BORDA = 90;
const VELOCIDADE = 16;

export interface PhaseDragHandle {
  /** esta coluna é a que está sendo arrastada */
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  /** true logo após um arraste — o clique que vem junto NÃO deve abrir o rename */
  blockedClick: () => boolean;
}

export interface PhaseDrag {
  /** fase sendo arrastada (null = ninguém) */
  dragKey: string | null;
  /** ref da coluna — mede a posição pra saber onde soltar */
  columnRef: (key: string) => (el: HTMLElement | null) => void;
  /** props do "pegador" (cabeçalho da fase); undefined quando não pode reordenar */
  handle: (key: string) => PhaseDragHandle | undefined;
  /** realce da coluna: barra no lado onde a fase vai cair, ou opacidade na arrastada */
  columnStyle: (key: string) => React.CSSProperties | undefined;
}

export function usePhaseDrag({
  enabled,
  accent,
  scrollRef,
  onDrop,
}: {
  /** só sócios reordenam (o gate real é no backend) */
  enabled: boolean;
  accent: string;
  /** container com overflow-x do quadro — pra rolar sozinho perto da borda */
  scrollRef?: React.RefObject<HTMLElement | null>;
  onDrop: (key: string, targetKey: string, place: 'before' | 'after') => void;
}): PhaseDrag {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; place: 'before' | 'after' } | null>(null);
  const cols = useRef(new Map<string, HTMLElement>());
  const st = useRef({
    key: null as string | null,
    x: 0,
    y: 0,
    started: false,
    armed: false,      // no toque, só arma depois do "segurar"
    timer: 0 as any,
    over: null as { key: string; place: 'before' | 'after' } | null,
    bloqueiaClique: 0,
    ponteiroX: 0,
    raf: 0,
  });

  // Uma callback-ref FIXA por fase (cache): recriar a função a cada render faria o
  // React desmontar/remontar o ref da coluna em toda re-renderização do quadro.
  const refCache = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const columnRef = useCallback((key: string) => {
    let fn = refCache.current.get(key);
    if (!fn) {
      fn = (el: HTMLElement | null) => { if (el) cols.current.set(key, el); else cols.current.delete(key); };
      refCache.current.set(key, fn);
    }
    return fn;
  }, []);

  // Rolagem automática: arrastando perto da borda, o quadro anda sozinho.
  const autoScroll = useCallback(() => {
    const el = scrollRef?.current;
    if (!el || !st.current.started) { st.current.raf = 0; return; }
    const r = el.getBoundingClientRect();
    const x = st.current.ponteiroX;
    if (x < r.left + BORDA) el.scrollLeft -= VELOCIDADE * Math.min(1, (r.left + BORDA - x) / BORDA);
    else if (x > r.right - BORDA) el.scrollLeft += VELOCIDADE * Math.min(1, (x - (r.right - BORDA)) / BORDA);
    st.current.raf = requestAnimationFrame(autoScroll);
  }, [scrollRef]);

  const encerrar = useCallback((soltar: boolean) => {
    const s = st.current;
    clearTimeout(s.timer);
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    if (s.started) {
      s.bloqueiaClique = Date.now() + 400;
      document.body.classList.remove('select-none');
      document.body.style.cursor = '';
      if (soltar && s.key && s.over && s.over.key !== s.key) onDrop(s.key, s.over.key, s.over.place);
    }
    s.key = null; s.started = false; s.armed = false; s.over = null;
    setDragKey(null);
    setOver(null);
  }, [onDrop]);

  const iniciar = useCallback(() => {
    const s = st.current;
    if (s.started || !s.key) return;
    s.started = true;
    document.body.classList.add('select-none');
    document.body.style.cursor = 'grabbing';
    setDragKey(s.key);
    if (scrollRef && !s.raf) s.raf = requestAnimationFrame(autoScroll);
  }, [autoScroll, scrollRef]);

  const mirar = useCallback((clientX: number) => {
    const s = st.current;
    let alvo: { key: string; place: 'before' | 'after' } | null = null;
    for (const [k, el] of cols.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        alvo = { key: k, place: clientX < r.left + r.width / 2 ? 'before' : 'after' };
        break;
      }
    }
    // Fora de qualquer coluna (respiro/fim do quadro): mantém a última mira.
    if (!alvo) return;
    if (s.over?.key === alvo.key && s.over.place === alvo.place) return;
    s.over = alvo;
    setOver(alvo);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (!s.key) return;
      s.ponteiroX = e.clientX;
      if (!s.started) {
        const anda = Math.hypot(e.clientX - s.x, e.clientY - s.y) > LIMIAR;
        // Toque: enquanto não "segurou", mexer o dedo é rolagem — desiste do arraste.
        if (!s.armed) { if (anda) encerrar(false); return; }
        if (!anda) return;
        iniciar();
      }
      e.preventDefault();
      mirar(e.clientX);
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
    (key: string): PhaseDragHandle | undefined => {
      if (!enabled) return undefined;
      return {
        dragging: dragKey === key,
        blockedClick: () => Date.now() < st.current.bloqueiaClique,
        onPointerDown: (e: React.PointerEvent) => {
          if (e.button !== 0) return;
          // Controle dentro do cabeçalho (⋮, caixinha, input do rename) manda mais.
          if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
          const s = st.current;
          s.key = key; s.x = e.clientX; s.y = e.clientY; s.ponteiroX = e.clientX;
          s.started = false; s.over = null;
          if (e.pointerType === 'touch') {
            s.armed = false;
            clearTimeout(s.timer);
            s.timer = setTimeout(() => { s.armed = true; iniciar(); mirar(s.ponteiroX); }, SEGURAR_MS);
          } else {
            s.armed = true; // mouse: arrasta assim que passar do limiar
          }
        },
      };
    },
    [enabled, dragKey, iniciar, mirar],
  );

  const columnStyle = useCallback(
    (key: string): React.CSSProperties | undefined => {
      if (!dragKey) return undefined;
      if (dragKey === key) return { opacity: 0.45 };
      if (over?.key !== key) return undefined;
      const barra = `inset ${over.place === 'before' ? '' : '-'}4px 0 0 0 ${accent}`;
      return { boxShadow: barra };
    },
    [dragKey, over, accent],
  );

  return { dragKey, columnRef, handle, columnStyle };
}

/**
 * Grava a nova posição da fase: atualiza o cache na hora (a coluna já aparece no
 * lugar novo) e persiste em Configurações › Fases. Erro → recarrega e avisa.
 */
export async function applyPhaseDrag(
  qc: QueryClient,
  queryKey: readonly unknown[],
  key: string,
  targetKey: string,
  place: 'before' | 'after',
) {
  qc.setQueryData<KanbanData>(queryKey, (old) => {
    if (!old?.phases) return old;
    const lista = [...old.phases].sort((a, b) => a.order - b.order);
    const from = lista.findIndex((p) => p.key === key);
    if (from < 0) return old;
    const [movida] = lista.splice(from, 1);
    const at = lista.findIndex((p) => p.key === targetKey);
    if (at < 0) return old;
    lista.splice(place === 'before' ? at : at + 1, 0, movida);
    return { ...old, phases: lista.map((p, i) => ({ ...p, order: (i + 1) * 10 })) };
  });
  try {
    await legalCasesService.movePhaseOrder(key, targetKey, place);
    qc.invalidateQueries({ queryKey });
  } catch (e: any) {
    qc.invalidateQueries({ queryKey });
    toast.error(e?.response?.data?.message || 'Só sócios podem reordenar fases');
  }
}
