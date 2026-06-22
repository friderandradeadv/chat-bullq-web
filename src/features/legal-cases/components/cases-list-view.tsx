'use client';

import type { KanbanCard, KanbanPhase } from '../services/legal-cases.service';

/**
 * Visão em LISTA dos cards do Kanban jurídico (Fase Judicial / Pré-Processual).
 * Agrupa por fase (na ordem das fases), seções com cabeçalho fixo. Read-only —
 * clicar abre o processo. Reaproveita os mesmos dados do quadro.
 */
export function CasesListView({
  byPhase,
  phases,
  onOpen,
  accent = '#e11970',
}: {
  byPhase: Record<string, KanbanCard[]>;
  phases: KanbanPhase[];
  onOpen: (id: string) => void;
  accent?: string;
}) {
  const comAlgo = phases.filter((p) => (byPhase[p.key] ?? []).length > 0);
  if (comAlgo.length === 0) return <p className="px-6 py-10 text-sm text-zinc-400">Nenhum processo.</p>;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      {comAlgo.map((p) => {
        const items = byPhase[p.key] ?? [];
        return (
          <div key={p.key} className="mt-5 first:mt-3">
            <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-[#fafafa] px-1 py-1.5 dark:bg-zinc-950">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
              <h3 className="text-sm font-semibold" style={{ color: accent }}>{p.label}</h3>
              <span className="rounded bg-[#edeff3] px-1.5 text-xs text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
            </div>
            <ul className="overflow-hidden rounded-lg border border-[#dcdfe5] bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {items.map((c) => <CaseRow key={c.id} c={c} onOpen={onOpen} />)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CaseRow({ c, onOpen }: { c: KanbanCard; onOpen: (id: string) => void }) {
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  return (
    <li className="border-b border-[#eef2f8] last:border-0 dark:border-zinc-800">
      <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#101820] dark:text-zinc-100">
            {c.client || c.title}
            {c.opponent ? <span className="font-normal text-zinc-400"> × {c.opponent}</span> : null}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {c.cnj && <span>{c.cnj}</span>}
            {c.produto && <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 font-medium text-[#1971c2] dark:text-[#74c0fc]">{c.produto}</span>}
            {c.areaJuridica && <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800 dark:text-zinc-300">{c.areaJuridica}</span>}
            {c.responsible && <span>{c.responsible.name}</span>}
          </div>
        </div>
        {c.proximoPrazo && (
          <span className={`shrink-0 text-xs ${overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
            {new Date(c.proximoPrazo.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        )}
      </button>
    </li>
  );
}
