'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Leva o overlay para o <body>. Sem isso o modal herda o contexto de empilhamento
 * do painel (`isolate` no layout) e a barra de abas do mobile (z-30, fora dele)
 * fica POR CIMA do modal — tampando o rodapé — e o arraste no fundo rola a página
 * da agenda junto com o modal (o "scroll bufando" no iPhone).
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

/**
 * Modal dos diálogos de criação (agenda, prazos, tarefas, eventos).
 * Morava dentro da página da agenda; saiu para cá para que o MESMO diálogo de
 * prazo rode na agenda e na ficha do processo sem arrastar o FullCalendar junto.
 * `dvh` (não `vh`): no Safari do iPhone o `vh` conta a área ATRÁS das barras do
 * navegador, e o fim do modal ficava fora da tela. `overscroll-contain` impede
 * que o fim da rolagem do modal passe a rolar a página de trás.
 */
export function Modal({ title, children, onClose, wide, headerRight }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; headerRight?: React.ReactNode }) {
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 touch-none bg-black/50" onClick={onClose} />
      <div className={`relative z-50 w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <div className="flex items-center gap-1">
            {headerRight}
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
    </ModalPortal>
  );
}
