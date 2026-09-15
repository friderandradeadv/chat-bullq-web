'use client';

import { X } from 'lucide-react';

/**
 * Modal dos diálogos de criação (agenda, prazos, tarefas, eventos).
 * Morava dentro da página da agenda; saiu para cá para que o MESMO diálogo de
 * prazo rode na agenda e na ficha do processo sem arrastar o FullCalendar junto.
 */
export function Modal({ title, children, onClose, wide, headerRight }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; headerRight?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-50 w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}>
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
  );
}
