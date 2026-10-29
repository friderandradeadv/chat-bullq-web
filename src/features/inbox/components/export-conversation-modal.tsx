'use client';

import { useState } from 'react';
import { X, FileText, Printer, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { buscarConversaExportada, montarTxt, nomeDoArquivo } from '../conversa-exportada';

/** Exporta a conversa completa do cliente: .txt no formato do WhatsApp ou a
 *  versão de impressão (abre em aba própria, com mídias e transcrições). */
export function ExportConversationModal({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [transcrever, setTranscrever] = useState(true);
  const [baixando, setBaixando] = useState(false);

  const baixarTxt = async () => {
    setBaixando(true);
    try {
      const conversa = await buscarConversaExportada(conversationId, { transcrever });
      const blob = new Blob([montarTxt(conversa)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeDoArquivo(conversa, 'txt');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const faltam = conversa.stats.audios - conversa.stats.audiosTranscribed;
      toast.success(
        `Conversa exportada (${conversa.stats.messages} mensagens)` +
          (faltam > 0 ? ` — ${faltam} áudio(s) sem transcrição` : ''),
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Não consegui exportar a conversa');
    } finally {
      setBaixando(false);
    }
  };

  const abrirImpressao = () => {
    const params = new URLSearchParams({ id: conversationId, t: transcrever ? '1' : '0' });
    window.open(`/documentos/conversa?${params}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Exportar conversa</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                A conversa completa do cliente, em todos os números do escritório.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            onClick={baixarTxt}
            disabled={baixando}
            className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-zinc-700"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {baixando ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Texto (.txt) igual ao WhatsApp</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {baixando
                  ? 'Montando… com muitos áudios para transcrever pode levar alguns minutos.'
                  : 'Data, hora, autor e mensagem, com a transcrição dos áudios e o link das mídias.'}
              </p>
            </div>
          </button>

          <button
            onClick={abrirImpressao}
            disabled={baixando}
            className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-zinc-700"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Versão para impressão</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Como o print da tela do WhatsApp, com fotos, documentos e áudios transcritos. Imprime ou salva em PDF.
              </p>
            </div>
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={transcrever}
            onChange={(e) => setTranscrever(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-primary"
          />
          Transcrever os áudios que ainda não foram transcritos (os já transcritos entram sempre)
        </label>
      </div>
    </div>
  );
}
