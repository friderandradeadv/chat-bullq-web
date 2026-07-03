'use client';

import type { KanbanCard, KanbanPhase } from '../services/legal-cases.service';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const cleanProduto = (s: string | null) => {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
};

/**
 * Visão em LISTA (tabela, estilo Pipefy) dos cards do Kanban jurídico.
 * Colunas: partes (cliente × adversa), produto/área, CNJ, valor, fase, responsável,
 * próximo prazo. Ordenado pela ordem das fases. Read-only — clicar abre o processo.
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
  const rows = phases.flatMap((p) => (byPhase[p.key] ?? []).map((c) => ({ c, fase: p.label })));
  if (rows.length === 0) return <p className="px-6 py-10 text-sm text-zinc-400">Nenhum processo.</p>;

  const th = 'sticky top-0 z-10 border-b border-[#dcdfe5] bg-[#fafafa] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7785] dark:border-zinc-800 dark:bg-zinc-950';
  const td = 'border-b border-[#eef2f8] px-3 py-2.5 align-top dark:border-zinc-800';

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 lg:px-6">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={th}>Cliente × Parte adversa</th>
            <th className={th}>Produto / Área</th>
            <th className={th}>Processo (CNJ)</th>
            <th className={`${th} text-right`}>Valor</th>
            <th className={th}>Fase</th>
            <th className={th}>Responsável</th>
            <th className={th}>Próximo prazo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, fase }) => {
            const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
            const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40">
                <td className={td}>
                  <div className="font-medium text-[#101820] dark:text-zinc-100">{c.client || c.title}</div>
                  {c.opponent && <div className="text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</div>}
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {c.produto && <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1971c2] dark:text-[#74c0fc]">{cleanProduto(c.produto)}</span>}
                    {c.areaJuridica && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{c.areaJuridica}</span>}
                  </div>
                </td>
                <td className={`${td} whitespace-nowrap text-xs text-[#48626f] dark:text-zinc-400`}>{c.cnj || <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                <td className={`${td} whitespace-nowrap text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400`}>{c.value != null && c.value > 0 ? fmtMoney(c.value) : ''}</td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium" style={{ color: accent }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />{fase}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {c.responsible ? (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      {c.responsible.avatarUrl
                        ? // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.responsible.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>}
                      {c.responsible.name}
                    </span>
                  ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                </td>
                <td className={`${td} whitespace-nowrap text-xs ${overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
                  {c.proximoPrazo ? <>{fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && ' · fatal'}</> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
