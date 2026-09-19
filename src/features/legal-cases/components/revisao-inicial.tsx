'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, ExternalLink, Loader2, Check, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type CaseDetail } from '@/features/legal-cases/services/legal-cases.service';
import { calculadoraRmcService } from '@/features/calculadora-rmc/services/calculadora-rmc.service';

/**
 * Conferência antes do protocolo.
 *
 * O advogado não protocola confiando no kanban: ele quer ver a peça e os anexos
 * na ORDEM em que vão subir. Essa ordem não é estética — é a sequência de
 * protocolo do escritório, um PDF numerado por documento, para que quem
 * peticiona suba na sequência sem decidir nada.
 *
 * Aqui a lista sai da mesma fonte que manda na pasta (`protocolo/conferir`), e
 * não de uma cópia — assim a tela não pode discordar do Drive.
 *
 * As observações ficam no card: é onde o pedido de ajuste sobrevive ao fim da
 * conversa e chega a quem vai corrigir.
 */
export function RevisaoInicial({ caso }: { caso: CaseDetail }) {
  const qc = useQueryClient();
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tocado, setTocado] = useState(false);

  const cliente = caso.parties?.find((p) => p.role === 'CLIENT') ?? null;
  const adversa = caso.parties?.find((p) => p.role !== 'CLIENT') ?? null;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['conferencia-protocolo', caso.id, adversa?.name],
    queryFn: () => calculadoraRmcService.conferirProtocolo(cliente!.id, adversa!.name),
    enabled: !!cliente?.id && !!adversa?.name,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Observações já gravadas no card entram no campo, para editar em vez de
  // reescrever. `tocado` evita que um refetch apague o que está sendo digitado.
  const salvas = ((caso.metadata as any)?.revisaoInicial?.observacoes ?? '') as string;
  useEffect(() => { if (!tocado) setObs(salvas); }, [salvas, tocado]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await legalCasesService.salvarRevisaoInicial(caso.id, obs);
      qc.invalidateQueries({ queryKey: ['legal-case', caso.id] });
      setTocado(false);
      toast.success(obs.trim() ? 'Observações salvas no card' : 'Observações limpas');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui salvar as observações.');
    } finally { setSalvando(false); }
  };

  if (!cliente || !adversa) return null;

  const faltam = data?.faltam ?? [];
  const pronta = !isLoading && !error && faltam.length === 0;

  return (
    <div className="mt-5 rounded-lg border border-[#cfe0ed] bg-[#f7fafc] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-center gap-1.5">
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-[#48626f] dark:text-zinc-400" />
        <p className="flex-1 text-sm font-medium text-[#101820] dark:text-zinc-200">
          Revisão antes do protocolo
        </p>
        {!isLoading && !error && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pronta
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'}`}>
            {pronta ? 'pronta' : `faltam ${faltam.length}`}
          </span>
        )}
        <button type="button" onClick={() => refetch()} disabled={isFetching} title="Reler a pasta"
          className="text-zinc-400 hover:text-[#1b6ec2] disabled:opacity-40">
          <Loader2 className={`h-3 w-3 ${isFetching ? 'animate-spin' : 'hidden'}`} />
        </button>
      </div>

      {isLoading ? (
        <p className="mt-2 text-[11px] text-[#48626f] dark:text-zinc-400">Lendo a pasta do réu…</p>
      ) : error ? (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          {(error as any)?.response?.data?.message || 'Não consegui ler a pasta de protocolo deste réu.'}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[10px] leading-4 text-[#48626f] dark:text-zinc-500">
            {data?.trilha?.join(' › ')}
          </p>

          {/* A ordem é a do protocolo: é assim que os anexos sobem. */}
          <ol className="mt-2 space-y-0.5">
            {(data?.itens ?? []).map((i) => (
              <li key={i.nome} className="flex items-start gap-1.5 text-[11px] leading-4">
                <span className={`mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border ${
                  i.presente ? 'border-emerald-500 bg-emerald-500'
                  : i.obrigatorio ? 'border-red-400' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {i.presente && <Check className="h-2 w-2 text-white" />}
                </span>
                <span className={i.presente
                  ? 'text-[#101820] dark:text-zinc-300'
                  : i.obrigatorio ? 'font-medium text-red-600 dark:text-red-400' : 'text-[#48626f] dark:text-zinc-500'}>
                  {i.arquivo || i.nome}
                  {!i.presente && !i.obrigatorio && ' · opcional'}
                </span>
              </li>
            ))}
          </ol>

          {data?.avisoDocx && (
            <p className="mt-2 flex items-start gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {data.avisoDocx}
            </p>
          )}

          {/* O link da pasta vem do conferidor quando ele o traz; sem ele, o
              caminho impresso acima já diz onde procurar no Drive. */}
          {(data as any)?.webViewLink && (
            <a href={(data as any).webViewLink} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">
              <ExternalLink className="h-3 w-3" /> Abrir a pasta no Drive
            </a>
          )}
        </>
      )}

      {/* O que precisa mudar. Fica no card, não na conversa. */}
      <div className="mt-2">
        <textarea
          value={obs}
          onChange={(e) => { setTocado(true); setObs(e.target.value); }}
          rows={3}
          placeholder="O que precisa mudar antes de protocolar? (fica salvo no card)"
          className="w-full rounded-md border border-[#cfe0ed] bg-white px-2 py-1.5 text-[12px] leading-5 text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#48626f] dark:text-zinc-500">
            {salvas && !tocado ? 'observações salvas' : tocado ? 'não salvo' : 'sem observações'}
          </span>
          <button type="button" onClick={salvar} disabled={salvando || !tocado}
            className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300">
            {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar observações
          </button>
        </div>
      </div>
    </div>
  );
}
