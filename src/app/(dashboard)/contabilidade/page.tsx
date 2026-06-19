'use client';

import { Calculator, Info } from 'lucide-react';

export default function ContabilidadePage() {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <Calculator className="h-5 w-5" />
          </span>
          Contabilidade
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Documentos contábeis, impostos e obrigações do escritório.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-800 dark:text-amber-200/90">
            Em construção. Defina comigo o que entra aqui (guias/impostos, balancetes, notas,
            integração contábil) e eu monto.
          </p>
        </div>
      </div>
    </div>
  );
}
