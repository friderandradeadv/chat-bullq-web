'use client';

import { AudioLines, Plus } from 'lucide-react';

export default function VozesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Vozes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Configure as vozes usadas pela IA para enviar áudios aos clientes.
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
        >
          <Plus className="h-4 w-4" /> Nova voz
        </button>
      </div>

      <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
        <AudioLines className="h-12 w-12 text-zinc-200 dark:text-zinc-700" />
        <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Vozes de IA em breve
        </p>
        <p className="mt-1 max-w-sm text-xs text-zinc-400 dark:text-zinc-500">
          Escolha e personalize vozes para que seus agentes respondam por áudio no
          WhatsApp, deixando o atendimento mais humano.
        </p>
      </div>
    </div>
  );
}
