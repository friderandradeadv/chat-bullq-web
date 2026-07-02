'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { legalCasesService } from '../services/legal-cases.service';
import { DropZone } from '@/components/drop-zone';

export type TipoPeca = 'replica' | 'especificacao' | 'recurso';

const META: Record<TipoPeca, { label: string; doc: string; hint: string }> = {
  replica: {
    label: 'Réplica',
    doc: 'a contestação do banco',
    hint: 'A IA lê a contestação e rebate, ponto a ponto, as teses do réu (preliminares + mérito) reforçando os argumentos da inicial.',
  },
  especificacao: {
    label: 'Especificação de provas',
    doc: 'a réplica já protocolada',
    hint: 'A IA lê a réplica e decide: sem perícia pedida → alegações finais + julgamento antecipado; com perícia → especificação pertinente.',
  },
  recurso: {
    label: 'Recurso de Apelação',
    doc: 'a sentença',
    hint: 'A IA lê a sentença, identifica os fundamentos da improcedência e monta as razões de apelação atacando cada ponto.',
  },
};

/** Converte o base64 do .docx num download no navegador. */
function baixarDocx(base64: string, fileName: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'peca.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Modal que gera por IA uma peça (réplica/especificação/recurso) sobre o timbrado.
 * Permite subir o documento-base (contestação/réplica/sentença), escolher o produto
 * e passar instruções. Ao gerar, baixa o .docx e anexa nos Anexos do card.
 */
export function GerarPecaDialog({
  caseId,
  tipo,
  onClose,
  onGenerated,
}: {
  caseId: string;
  tipo: TipoPeca;
  onClose: () => void;
  onGenerated?: () => void;
}) {
  const meta = META[tipo];
  const [file, setFile] = useState<File | null>(null);
  const [produto, setProduto] = useState<string | null>(null);
  const [instrucoes, setInstrucoes] = useState('');
  const [busy, setBusy] = useState(false);

  const gerar = async () => {
    setBusy(true);
    try {
      let docBase64: string | undefined;
      if (file) {
        docBase64 = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error('falha ao ler o arquivo'));
          fr.readAsDataURL(file);
        });
      }
      const r = await legalCasesService.gerarPeca(caseId, {
        tipo,
        produto: produto || undefined,
        docBase64,
        docNome: file?.name,
        instrucoes: instrucoes.trim() || undefined,
      });
      baixarDocx(r.docxBase64, r.fileName);
      toast.success(`${meta.label} gerada e anexada nos Anexos do card. Confira as teses e as lacunas “[ • ]” antes do protocolo.`);
      onGenerated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Erro ao gerar ${meta.label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Gerar {meta.label} (IA)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{meta.hint}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload do documento-base */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">
          Documento-base — suba {meta.doc}
        </p>
        <DropZone
          accept="application/pdf,.pdf"
          multiple={false}
          disabled={busy}
          onFiles={(fs) => setFile(fs[0] ?? null)}
          overlayLabel={`Soltar ${meta.doc}`}
          className="mb-3 block"
        >
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm ${file ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400' : 'border-[#cfe0ed] text-[#005efc] dark:border-zinc-700'} ${busy ? 'opacity-50' : 'hover:bg-[#005efc]/5'}`}>
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{file ? file.name : `Clique ou arraste o PDF de ${meta.doc}`}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; setFile(f); }}
            />
          </label>
        </DropZone>
        <p className="mb-3 -mt-2 text-[11px] text-zinc-400">Opcional, mas recomendado — sem o documento a IA trabalha só com os dados do processo e deixa mais lacunas.</p>

        {/* Produto */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">Produto (opcional)</p>
        <div className="mb-3 flex gap-1.5">
          {['RMC', 'RCC'].map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => setProduto(produto === p ? null : p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${produto === p ? 'border-[#005efc] bg-[#005efc]/10 text-[#005efc]' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Instruções */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">Instruções para a IA (opcional)</p>
        <textarea
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          disabled={busy}
          rows={2}
          placeholder="Ex.: enfatizar a ausência de assinatura ICP-Brasil; pedir perícia grafotécnica."
          className="mb-4 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#7048E8] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">Cancelar</button>
          <button
            onClick={gerar}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {busy ? 'Gerando… (uns 20s)' : `Gerar ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
