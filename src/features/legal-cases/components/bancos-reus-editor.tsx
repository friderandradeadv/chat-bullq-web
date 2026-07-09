'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Gavel } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type PartyDetail } from '@/features/legal-cases/services/legal-cases.service';
import { maskCurrencyBR } from '@/lib/masks';
import { maskCpfCnpj } from '@/lib/masks';

// Bancos RÉUS do caso REPB = múltiplas partes OPPONENT (viram parte adversa de
// verdade → alimentam Jurimetria/Partes Adversas). Cada banco carrega o detalhe
// em Party.metadata: operação, saldo devedor e situação do acordo.

const SITUACOES = ['Em análise', 'Malote enviado', 'Negociando', 'Acordo fechado', 'Judicializado', 'Sem acordo'];
const SIT_COR: Record<string, string> = {
  'Em análise': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  'Malote enviado': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Negociando: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'Acordo fechado': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Judicializado: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'Sem acordo': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};
const INPUT = 'h-8 w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 text-[13px] text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';

type Draft = { name: string; document: string; operacao: string; saldoDevedor: string; situacao: string; obs: string };
const toDraft = (p: PartyDetail): Draft => ({
  name: p.name ?? '', document: p.document ?? '',
  operacao: p.metadata?.operacao ?? '', saldoDevedor: p.metadata?.saldoDevedor ?? '',
  situacao: p.metadata?.situacao ?? 'Em análise', obs: p.metadata?.obs ?? '',
});

export function BancosReusEditor({ caseId, parties, onChanged }: { caseId: string; parties: PartyDetail[]; onChanged: () => void }) {
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  const [adding, setAdding] = useState(false);

  const addBanco = async () => {
    setAdding(true);
    try {
      await legalCasesService.addParty(caseId, { name: 'Novo banco', role: 'OPPONENT', metadata: { situacao: 'Em análise' } });
      onChanged();
    } catch { toast.error('Erro ao adicionar banco'); } finally { setAdding(false); }
  };

  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-[#B7791F]" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Bancos réus</p>
        <span className="rounded bg-[#edeff3] px-1.5 text-[12px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{reus.length}</span>
        <button onClick={addBanco} disabled={adding} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#B7791F]/40 px-2 py-1 text-[12px] font-semibold text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Banco
        </button>
      </div>

      {reus.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#dcdfe5] py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">Nenhum banco réu cadastrado</p>}

      <div className="mt-2 space-y-2.5">
        {reus.map((p) => <BancoRow key={p.id} party={p} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function BancoRow({ party, onChanged }: { party: PartyDetail; onChanged: () => void }) {
  const [d, setD] = useState<Draft>(toDraft(party));
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setD(toDraft(party)); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: Draft) => {
    setD(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        await legalCasesService.updateParty(party.id, {
          name: next.name.trim() || 'Banco', role: 'OPPONENT', document: next.document.trim() || undefined,
          metadata: { operacao: next.operacao, saldoDevedor: next.saldoDevedor, situacao: next.situacao, obs: next.obs },
        });
        onChanged();
      } catch { toast.error('Erro ao salvar banco'); }
    }, 600);
  };
  const remove = async () => {
    if (!confirm(`Remover o banco réu "${party.name}"?`)) return;
    try { await legalCasesService.removeParty(party.id); onChanged(); }
    catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2">
        <input value={d.name} onChange={(e) => save({ ...d, name: e.target.value })} placeholder="Banco / instituição" className={`${INPUT} font-medium`} />
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIT_COR[d.situacao] ?? ''}`}>{d.situacao}</span>
        <button onClick={remove} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">CNPJ
          <input value={d.document} onChange={(e) => save({ ...d, document: maskCpfCnpj(e.target.value) })} className={INPUT} />
        </label>
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Operação
          <input value={d.operacao} onChange={(e) => save({ ...d, operacao: e.target.value })} placeholder="Cartão, empréstimo…" className={INPUT} />
        </label>
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Saldo devedor
          <input value={d.saldoDevedor} onChange={(e) => save({ ...d, saldoDevedor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} />
        </label>
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Situação
          <select value={d.situacao} onChange={(e) => save({ ...d, situacao: e.target.value })} className={INPUT}>
            {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <input value={d.obs} onChange={(e) => save({ ...d, obs: e.target.value })} placeholder="Observações" className={`${INPUT} mt-2`} />
    </div>
  );
}
