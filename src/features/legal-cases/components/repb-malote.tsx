'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

// Acompanhamento dos MALOTES EXTRAJUDICIAIS / protocolos do REPB — um por banco ×
// canal, com o funil 3x (Consumidor.gov → BACEN → AR/Ouvidoria) até a resposta.
// Persiste como um array em metadata.faseData['repb_malotes'].lista (bucket estável,
// independente da fase — via saveFaseField, sem endpoint novo).

export interface Malote {
  id: string;
  banco: string;
  canal: string;
  numero: string;
  dataEnvio: string;
  prazo: string;
  tentativa: string;
  status: string;
  obs: string;
}

const CANAIS = ['Consumidor.gov', 'BACEN (RDR)', 'AR / Correios', 'E-mail', 'Ouvidoria', 'Ação de exibição'];
const STATUS = ['Aguardando', 'Deferido', 'Indeferido', 'Parcial'];
const STATUS_COR: Record<string, string> = {
  Aguardando: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Deferido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Indeferido: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  Parcial: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.round(Math.random() * 1e6)}`);

const INPUT = 'h-8 w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 text-[13px] text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';

export function RepbMalote({ caseId, lista }: { caseId: string; lista: Malote[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Malote[]>(lista ?? []);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setRows(lista ?? []); }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: Malote[]) => {
    setRows(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        await legalCasesService.saveFaseField(caseId, 'repb_malotes', 'lista', next as any);
        qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
      } catch { toast.error('Erro ao salvar protocolo'); }
    }, 600);
  };

  const add = () => persist([...rows, { id: novoId(), banco: '', canal: 'Consumidor.gov', numero: '', dataEnvio: '', prazo: '', tentativa: '1', status: 'Aguardando', obs: '' }]);
  const upd = (id: string, patch: Partial<Malote>) => persist(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const del = (id: string) => persist(rows.filter((r) => r.id !== id));

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-[#B7791F]" />
        <h4 className="text-sm font-semibold text-[#101820] dark:text-zinc-100">Malotes / protocolos</h4>
        <span className="rounded bg-[#edeff3] px-1.5 text-[12px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{rows.length}</span>
        <button onClick={add} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#B7791F]/40 px-2 py-1 text-[12px] font-semibold text-[#B7791F] hover:bg-[#B7791F]/10">
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">Funil: Consumidor.gov → BACEN → AR/Ouvidoria. Indeferido 3× → ação de exibição de documento.</p>

      {rows.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#dcdfe5] py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">Nenhum protocolo ainda</p>}

      <div className="mt-2 space-y-2.5">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <input value={r.banco} onChange={(e) => upd(r.id, { banco: e.target.value })} placeholder="Banco / instituição" className={`${INPUT} font-medium`} />
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COR[r.status] ?? ''}`}>{r.status}</span>
              <button onClick={() => del(r.id)} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Canal
                <select value={r.canal} onChange={(e) => upd(r.id, { canal: e.target.value })} className={INPUT}>
                  {CANAIS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Tentativa (funil)
                <select value={r.tentativa} onChange={(e) => upd(r.id, { tentativa: e.target.value })} className={INPUT}>
                  <option value="1">1ª</option><option value="2">2ª</option><option value="3">3ª</option>
                </select>
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Nº protocolo
                <input value={r.numero} onChange={(e) => upd(r.id, { numero: e.target.value })} className={INPUT} />
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Status
                <select value={r.status} onChange={(e) => upd(r.id, { status: e.target.value })} className={INPUT}>
                  {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Enviado em
                <input type="date" value={r.dataEnvio} onChange={(e) => upd(r.id, { dataEnvio: e.target.value })} className={INPUT} />
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Prazo p/ resposta
                <input type="date" value={r.prazo} onChange={(e) => upd(r.id, { prazo: e.target.value })} className={INPUT} />
              </label>
            </div>
            <input value={r.obs} onChange={(e) => upd(r.id, { obs: e.target.value })} placeholder="Observações" className={`${INPUT} mt-2`} />
          </div>
        ))}
      </div>
    </div>
  );
}
