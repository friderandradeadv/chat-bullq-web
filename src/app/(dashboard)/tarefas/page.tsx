'use client';

import { ClipboardList, Plus } from 'lucide-react';

export default function TarefasPage() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tarefas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Organize lembretes e pendências vinculados aos seus atendimentos.
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
        <ClipboardList className="h-12 w-12 text-zinc-200 dark:text-zinc-700" />
        <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Gestão de tarefas em breve
        </p>
        <p className="mt-1 max-w-sm text-xs text-zinc-400 dark:text-zinc-500">
          Você poderá criar tarefas, definir responsáveis e prazos, e vinculá-las
          diretamente às conversas dos clientes.
        </p>
      </div>
    </div>
  );
}
