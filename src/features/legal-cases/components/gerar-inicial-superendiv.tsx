'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

// Gera a PETIÇÃO INICIAL de superendividamento por IA (POST /legal-cases/:id/peca/gerar,
// tipo 'superendividamento'), no timbrado do escritório, listando todos os bancos réus
// do card. Baixa o .docx e anexa nos Anexos do processo. É um RASCUNHO — revisar.

function baixarDocx(base64: string, nome: string) {
  const bin = atob(base64.replace(/^data:[^;]+;base64,/, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome || 'inicial-superendividamento.docx';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function GerarInicialSuperendiv({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    setLoading(true);
    try {
      const r = await legalCasesService.gerarPeca(caseId, { tipo: 'superendividamento' });
      if (r.docxBase64) baixarDocx(r.docxBase64, r.fileName);
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
      toast.success('Inicial gerada e anexada. Revise as teses e as lacunas "[ • ]" antes de protocolar.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao gerar a inicial');
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#7C3AED]" />
        <p className="text-[13px] font-semibold text-[#101820] dark:text-zinc-100">Inicial de superendividamento (IA)</p>
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">Redige a petição do art. 104-A do CDC com todos os bancos réus do card, no timbrado. Rascunho — revisar antes de protocolar.</p>
      <button onClick={gerar} disabled={loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#7C3AED' }}>
        {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redigindo (1–2 min)…</> : <>Gerar inicial (IA)</>}
      </button>
    </div>
  );
}
