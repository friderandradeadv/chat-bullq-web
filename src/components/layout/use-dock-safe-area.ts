'use client';

import { useEffect } from 'react';

// ── Barra inferior × Dock do macOS ──────────────────────────────────────────
// A barra do MODO SIMPLES é `fixed bottom-0`: cola no rodapé da JANELA. Quando a
// janela não está em tela cheia e o Dock do macOS fica por cima do rodapé, a
// barra some atrás dele (só aparece inteira em tela cheia, quando o Dock recolhe).
// O navegador NÃO expõe o Dock como safe-area no desktop (env(safe-area-inset-*)
// = 0), então medimos na mão: `screen.availHeight` já é a área ÚTIL da tela (sem
// Dock/menu), logo o quanto o rodapé da janela passa dessa área é exatamente o
// quanto o Dock cobre. Publicamos isso em `--dock-safe` pra barra e o conteúdo
// subirem só o necessário (e nada quando não há Dock cobrindo, ex.: tela cheia).
export function useDockSafeArea() {
  useEffect(() => {
    const root = document.documentElement;
    const compute = () => {
      let px = 0;
      try {
        const s = window.screen as Screen & { availTop?: number };
        const availBottom = (s.availTop ?? 0) + s.availHeight;
        const winBottom = window.screenY + window.outerHeight;
        const overlap = winBottom - availBottom;
        // Ignora ruído (< 8px) e trava num teto são pra nunca "comer" o conteúdo
        // caso alguma tela/monitor reporte coordenadas estranhas.
        if (Number.isFinite(overlap) && overlap > 8) px = Math.min(overlap, 96);
      } catch {
        /* screen indisponível → mantém 0 */
      }
      root.style.setProperty('--dock-safe', `${px}px`);
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('focus', compute);

    // Arrastar a janela pra trás do Dock NÃO dispara 'resize'/'focus', então um
    // tick leve (só enquanto a aba está visível) recalcula nesse caso.
    let poll: number | undefined;
    const start = () => { if (poll == null) poll = window.setInterval(compute, 1500); };
    const stop = () => { if (poll != null) { clearInterval(poll); poll = undefined; } };
    const onVis = () => {
      if (document.hidden) { stop(); return; }
      compute();
      start();
    };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) start();

    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('focus', compute);
      document.removeEventListener('visibilitychange', onVis);
      stop();
      root.style.removeProperty('--dock-safe');
    };
  }, []);
}
