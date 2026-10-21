'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, FileSearch, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * O BOTÃO QUE RODA A TRIAGEM, e o relatório que volta.
 *
 * 🚨 A TRIAGEM NÃO MONTA PEÇA: ela LÊ os autos e responde. Por isso o desfecho
 * é um texto para o advogado ler, e o card tem de mostrá-lo — relatório que
 * fica só no terminal do Mac é relatório que ninguém lê.
 *
 * 🚨 E PORTÃO FECHADO NÃO É ERRO. "Não achei acórdão, logo não cabe REsp" é a
 * triagem acertando, e é o desfecho mais comum. Vai em âmbar, não em vermelho:
 * vermelho que não é erro ensina a ignorar vermelho.
 */
type Estado = {
  status?: string | null; acao?: string | null; rotulo?: string | null;
  etapa?: string | null; erro?: string | null; cabe?: boolean | null;
  resumo?: string | null; relatorio?: string | null;
  concluidoEm?: string | null; temAutos?: boolean;
};

export function TriagemPeca({ caseId, acao, rotulo }: {
  caseId: string; acao: string; rotulo: string;
}) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);
  const [aberto, setAberto] = useState(false);

  const { data: est } = useQuery({
    queryKey: ['triagem', caseId],
    queryFn: async (): Promise<Estado> => {
      const { data } = await api.get(`/legal-cases/${caseId}/peca/triagem`);
      return (data?.data ?? data) as Estado;
    },
    enabled: !!caseId,
    staleTime: 10_000,
  });

  const naFila = est?.status === 'pendente';

  /* enquanto o Mac trabalha, o card acompanha — e para de perguntar quando
     termina, para não ficar batendo no hub para sempre */
  useEffect(() => {
    if (!naFila || !caseId) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['triagem', caseId] });
    }, 5000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc]);

  /* a triagem é desta ação? se o card trocou de classe, o relatório velho
     não serve — mostrar relatório de outra peça seria pior que não mostrar */
  const desteAcao = !est?.acao || est.acao === acao;
  const mostra = desteAcao ? est : null;

  const pedir = async () => {
    setPedindo(true);
    try {
      const { data } = await api.post(`/legal-cases/${caseId}/peca/triagem`, { acao });
      const r = (data?.data ?? data) as { ok?: boolean; motivo?: string };
      if (r?.ok === false) { toast.error(r.motivo ?? 'não consegui pedir'); return; }
      toast.success('Na fila. O Mac vai ler os autos e devolver aqui.');
      qc.invalidateQueries({ queryKey: ['triagem', caseId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui pedir a triagem');
    } finally { setPedindo(false); }
  };

  const jaRodou = mostra?.status === 'pronta' || mostra?.status === 'nao-cabe';

  return (
    <div className="mt-2.5 rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
          <FileSearch className="h-3.5 w-3.5" /> Triagem de {rotulo.toLowerCase()}
        </p>
        <button
          onClick={pedir}
          disabled={pedindo || naFila}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {(pedindo || naFila) && <Loader2 className="h-3 w-3 animate-spin" />}
          {naFila ? 'lendo os autos…' : jaRodou ? 'Rodar de novo' : 'Rodar triagem'}
        </button>
      </div>

      {naFila && mostra?.etapa && (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {mostra.etapa}
        </p>
      )}

      {/* 🚨 o não-cabe vem em ÂMBAR: é resposta, não falha */}
      {jaRodou && (
        <div
          className={`mt-2 rounded-md p-2 text-[11px] leading-4 ${
            mostra?.cabe
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <p className="font-medium">
            {mostra?.cabe ? 'Cabe — li os autos' : 'Parou no cabimento'}
          </p>
          {mostra?.resumo && <p className="mt-0.5">{mostra.resumo}</p>}
        </div>
      )}

      {jaRodou && mostra?.relatorio && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {aberto ? 'esconder o relatório' : 'ver o relatório inteiro'}
          </button>
          {aberto && (
            <pre className="mt-1.5 max-h-96 overflow-auto rounded-md bg-zinc-50 p-2 text-[10px] leading-[1.35] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {mostra.relatorio}
            </pre>
          )}
        </>
      )}

      {mostra?.status === 'erro' && mostra?.erro && (
        <p className="mt-2 rounded-md bg-rose-50 p-2 text-[11px] leading-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {mostra.erro}
        </p>
      )}

      {!jaRodou && !naFila && mostra?.status !== 'erro' && (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          Leio os autos aqui do Mac e devolvo o relatório neste card. Preciso do processo em
          PDF: solte no card ou arraste para a pasta AUTOS.
        </p>
      )}
    </div>
  );
}
