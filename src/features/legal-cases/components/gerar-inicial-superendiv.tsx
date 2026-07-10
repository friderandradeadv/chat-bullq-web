'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

// Gera peças de REPB por IA (POST /legal-cases/:id/peca/gerar), no timbrado, e baixa
// o .docx + anexa nos Anexos do card. Dois tipos:
//  • superendividamento → petição inicial (art. 104-A CDC), lista os bancos réus;
//  • parecer → parecer técnico de auditoria contratual (juros × BACEN, capitalização,
//    encargos, venda casada, cláusulas abusivas) — leia o(s) contrato(s) anexado(s).
// Rascunho da IA — revisar as lacunas "[ • ]" antes de usar.

function baixarDocx(base64: string, nome: string) {
  const bin = atob(base64.replace(/^data:[^;]+;base64,/, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome || 'peca.docx';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
const toB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(f); });

export function GerarPecaRepb({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<'' | 'superendividamento' | 'parecer'>('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const gerar = async (tipo: 'superendividamento' | 'parecer') => {
    setLoading(tipo);
    try {
      const docs = tipo === 'parecer' && files.length ? await Promise.all(files.map(toB64)) : undefined;
      const r = await legalCasesService.gerarPeca(caseId, {
        tipo,
        docsBase64: docs,
        docsNomes: tipo === 'parecer' && files.length ? files.map((f) => f.name) : undefined,
      });
      if (r.docxBase64) baixarDocx(r.docxBase64, r.fileName);
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
      toast.success('Peça gerada e anexada. Revise as teses e as lacunas "[ • ]" antes de usar.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao gerar a peça');
    } finally { setLoading(''); }
  };

  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#7C3AED]" />
        <p className="text-[13px] font-semibold text-[#101820] dark:text-zinc-100">Gerar peça (IA)</p>
        <span className="text-[10px] text-zinc-400">no timbrado · rascunho</span>
      </div>

      <button onClick={() => gerar('superendividamento')} disabled={!!loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#7C3AED' }}>
        {loading === 'superendividamento' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redigindo (1–2 min)…</> : 'Inicial de superendividamento'}
      </button>

      <div className="mt-2 rounded-md border border-[#e3e8ef] p-2 dark:border-zinc-800">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Parecer técnico (auditoria)</p>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <Paperclip className="h-3 w-3" /> {files.length ? `${files.length} contrato(s)` : 'Anexar contrato (PDF)'}
        </button>
        {files.length > 0 && <button onClick={() => setFiles([])} className="ml-1 rounded p-1 text-zinc-400 hover:text-red-600"><X className="h-3 w-3" /></button>}
        <button onClick={() => gerar('parecer')} disabled={!!loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#7C3AED]/40 px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ color: '#7C3AED' }}>
          {loading === 'parecer' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Auditando (1–2 min)…</> : 'Gerar parecer técnico'}
        </button>
        <p className="mt-1 text-[10px] text-zinc-400">Sem o contrato anexado, o parecer sai como roteiro com lacunas "[ • ]".</p>
      </div>
    </div>
  );
}
