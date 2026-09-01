'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft } from 'lucide-react';
import { legalCasesService } from '../services/legal-cases.service';
import { boardOfPhase, phasesOfBoard } from '../lib/phase-board';
import type { KanbanPhase } from '../services/legal-cases.service';

/**
 * Mover o card de fase MANUALMENTE (ex.: corrigir um auto-move errado do DJEN),
 * a partir da agenda. Mostra SÓ as fases do quadro em que o card está (o board é
 * deduzido da fase atual) — nunca fases de outro kanban.
 */
export function MoverFaseManual({ caseId, onMoved }: { caseId: string; onMoved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const cfgQ = useQuery({ queryKey: ['phases-config'], queryFn: () => legalCasesService.getPhaseConfig(), enabled: open, staleTime: 5 * 60 * 1000 });
  const caseQ = useQuery({ queryKey: ['case-lite', caseId], queryFn: () => legalCasesService.get(caseId), enabled: open });

  const all = (cfgQ.data?.resolved ?? []) as unknown as KanbanPhase[];
  const atual = (caseQ.data as any)?.legalPhase as string | undefined;
  const lane = all.find((p) => p.key === atual)?.lane;
  const board = atual ? boardOfPhase(atual, lane) : 'judicial';
  const opts = phasesOfBoard(all, board);
  const loading = cfgQ.isLoading || caseQ.isLoading;

  const move = async (key: string) => {
    if (!key || key === atual) { setOpen(false); return; }
    setBusy(true);
    try {
      // ÚNICO caminho que avisa o cliente: aqui a fase está à vista e a escolha
      // é deliberada (ver a nota em movePhase).
      await legalCasesService.movePhase(caseId, key, { avisarCliente: true });
      toast.success(`Card movido para "${opts.find((o) => o.key === key)?.label ?? key}"`);
      setOpen(false);
      onMoved?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao mover o processo');
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[#495057] hover:text-[#228BE6] dark:text-zinc-400">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Mover fase manualmente
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {loading ? (
        <span className="text-xs text-zinc-400">carregando fases…</span>
      ) : (
        <select
          defaultValue={atual ?? ''}
          disabled={busy}
          onChange={(e) => move(e.target.value)}
          className="h-8 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {opts.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      )}
      <button onClick={() => setOpen(false)} disabled={busy} className="text-xs font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Cancelar</button>
    </div>
  );
}
