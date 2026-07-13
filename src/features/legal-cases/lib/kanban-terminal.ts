// Fim de processo/ciclo nos kanbans (estilo Trello/Pipefy): ao mover um card
// para uma fase TERMINAL (CONCLUÍDO, ARQUIVADO, INVIÁVEL, PERDIDO, TRÂNSITO…)
// solta confete e o card fica "apagado" (cinza/dessaturado). Compartilhado por
// TODOS os boards (funil, passivo, planejamento, pré-processual, judicial, INSS).

import type { KanbanPhase } from '@/features/legal-cases/services/legal-cases.service';

/** Fase de desfecho: o backend marca `terminal` nas fases de fim; fases custom
 *  arquivadas (status ARCHIVED) também contam. */
export function isTerminalPhase(phase?: { terminal?: boolean; status?: string } | null): boolean {
  if (!phase) return false;
  return phase.terminal === true || phase.status === 'ARCHIVED';
}

/** Desfecho NEGATIVO (perda/abandono/inviável/desistência/arquivo). Não comemora. */
export function isLossPhase(phase?: { key?: string; label?: string } | null): boolean {
  if (!phase) return false;
  const s = `${phase.key ?? ''} ${phase.label ?? ''}`.toLowerCase();
  return /perdid|perda|abandon|inviav|desist|arquiv/.test(s);
}

/** Comemora com confete? Só desfecho POSITIVO de fim de ciclo (evita confete em
 *  perda/abandono). Ex.: CONCLUÍDO, CONTRATO FECHADO, TRÂNSITO, AÇÕES VENCIDAS. */
export function shouldCelebrate(phase?: { terminal?: boolean; status?: string; key?: string; label?: string } | null): boolean {
  if (!phase) return false;
  if (isLossPhase(phase)) return false;
  // fase de fim marcada terminal, OU fechamento explícito do funil (contrato fechado)
  return phase.terminal === true || phase.key === 'repbc_contrato_fechado';
}

/** Classe Tailwind do card em fase terminal — apagado, como o Pipefy. */
export const terminalCardClass = 'opacity-60 saturate-[0.4] grayscale-[0.35]';

/** Confete Trello-style. Self-contained (sem dependência), SSR-safe e respeita
 *  prefers-reduced-motion. Dispare 1× ao mover um card para uma fase terminal. */
export function fireConfetti(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const colors = ['#E8590C', '#B7791F', '#005efc', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
  const N = 150;
  // dois jatos, saindo das bases esquerda/direita (estilo canvas-confetti)
  const parts = Array.from({ length: N }, (_, i) => {
    const fromLeft = i < N / 2;
    return {
      x: fromLeft ? W * 0.15 : W * 0.85,
      y: H + 10,
      vx: (fromLeft ? 1 : -1) * (Math.random() * 6 + 3),
      vy: -(Math.random() * 15 + 12),
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    };
  });

  const gravity = 0.42;
  const DURATION = 2600;
  let start = 0;
  let raf = 0;
  const tick = (t: number) => {
    if (!start) start = t;
    const elapsed = t - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
    for (const p of parts) {
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < DURATION) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}
