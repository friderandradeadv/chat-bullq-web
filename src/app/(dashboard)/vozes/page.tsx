'use client';

import { AudioLines } from 'lucide-react';

export default function VozesPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Vozes</h1>
        <p className="text-xs text-zinc-500">
          Configure as vozes usadas nas respostas em áudio dos seus agentes.
        </p>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 px-8 py-16 text-center dark:border-zinc-800">
          <AudioLines className="mx-auto h-10 w-10 text-zinc-400" />
          <h3 className="mt-4 text-lg font-semibold">Em breve</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Aqui você vai escolher e personalizar as vozes que os seus agentes
            usam para responder mensagens de áudio.
          </p>
        </div>
      </div>
    </div>
  );
}
