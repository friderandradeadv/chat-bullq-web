'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, FileText, Loader2, Send, X } from 'lucide-react';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';

/**
 * Barra de REVISÃO da prestação de contas, aberta a partir do Financeiro (?prestacao=<txId>).
 * Mostra o texto sugerido (editável) + o PDF, e aprova/agenda. O ENVIO em si é o ESPECIALIZADO
 * (template fora de 24h, texto editado dentro de 24h, registro probatório) — aqui é só a revisão
 * humana antes de disparar.
 */
export function PrestacaoApprovalBar({
  txId, conversationId, agendarDefault, onDone,
}: { txId: string; conversationId: string; agendarDefault?: boolean; onDone: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['prestacao-rascunho', txId],
    queryFn: () => financeiroService.prestacaoRascunho(txId),
    staleTime: 0,
  });
  const [texto, setTexto] = useState<string | null>(null);
  const [agendando, setAgendando] = useState(!!agendarDefault);
  const [quando, setQuando] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-t border-zinc-200 bg-violet-50/60 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-violet-900/10">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando a prévia da prestação…
      </div>
    );
  }
  if (!data || data.conversationId !== conversationId) return null; // rascunho de outro cliente / expirado
  const value = texto ?? data.texto;

  const aprovar = async (agendarAt?: string) => {
    setBusy(true);
    try {
      const r = await financeiroService.aprovarPrestacao(txId, { texto: value, agendarAt });
      if (r.agendado && r.quando) toast.success(`Envio agendado para ${new Date(r.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ✅`);
      else toast.success('Prestação enviada ao cliente ✅');
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não foi possível aprovar.');
    } finally { setBusy(false); }
  };

  const confirmarAgendamento = () => {
    if (!quando) { toast.error('Escolha a data e a hora do envio.'); return; }
    const iso = new Date(quando).toISOString();
    if (new Date(iso).getTime() < Date.now()) { toast.error('Escolha um horário no futuro.'); return; }
    aprovar(iso);
  };

  const jaAgendada = !!data.agendarAt && !data.enviadaEm;

  return (
    <div className="border-t border-violet-200 bg-violet-50/70 px-4 py-2.5 dark:border-violet-900/40 dark:bg-violet-900/15">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          <FileText className="h-3.5 w-3.5" /> Prestação de contas — revisar e aprovar
        </span>
        <div className="flex items-center gap-2">
          <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-300 hover:bg-violet-50 dark:bg-zinc-900 dark:text-violet-300 dark:ring-violet-800">
            <FileText className="h-3 w-3" /> ver PDF
          </a>
          <button onClick={onDone} title="Fechar (não envia)" className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {jaAgendada && (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5" /> Já agendada para {new Date(data.agendarAt!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Você pode reenviar agora ou reagendar abaixo.
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-lg border border-violet-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-zinc-800 outline-none focus:border-violet-400 dark:border-violet-900/40 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <p className="mt-1 text-[10px] text-zinc-400">O texto editado vale dentro da janela de 24h. Fora dela o envio sai pelo template aprovado (o PDF vai junto de qualquer forma).</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={() => aprovar()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Aprovar e enviar agora
        </button>
        {!agendando ? (
          <button onClick={() => setAgendando(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20">
            <Clock className="h-4 w-4" /> Agendar
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-violet-400 dark:border-violet-800 dark:bg-zinc-900 dark:text-zinc-100" />
            <button onClick={confirmarAgendamento} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar
            </button>
            <button onClick={() => setAgendando(false)} disabled={busy} className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
