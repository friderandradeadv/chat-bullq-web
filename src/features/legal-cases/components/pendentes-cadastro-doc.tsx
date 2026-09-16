'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type PendenteCadastroDoc,
} from '@/features/legal-cases/services/legal-cases.service';
import { CadastroPorDocumento } from './cadastro-por-documento';

/**
 * Faixa dos protocolos que chegaram pelo WhatsApp e ainda esperam conferência.
 * O trabalho pesado (baixar, ler, cruzar com a base) já foi feito quando o
 * documento chegou; aqui é só abrir, olhar e confirmar.
 *
 * Some sozinha quando não há nada pendente — não ocupa espaço no dia a dia.
 */
export function PendentesCadastroDoc({ onChange }: { onChange: () => void }) {
  const qc = useQueryClient();
  const [abrindo, setAbrindo] = useState<PendenteCadastroDoc | null>(null);

  const { data: pendentes = [] } = useQuery({
    queryKey: ['cadastro-doc-pendentes'],
    queryFn: () => legalCasesService.pendentesCadastroDoc(),
    refetchInterval: 60_000,
  });

  const descartar = useMutation({
    mutationFn: (messageId: string) => legalCasesService.descartarCadastroDoc(messageId),
    onSuccess: () => {
      toast.success('Pendência descartada');
      qc.invalidateQueries({ queryKey: ['cadastro-doc-pendentes'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao descartar'),
  });

  const comLeitura = pendentes.filter((p) => p.leitura);
  if (!comLeitura.length) return null;

  return (
    <>
      <div className="mx-4 mt-3 rounded-xl border border-[#228BE6]/40 bg-[#228BE6]/5 p-3 lg:mx-8">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1c7ed6]">
          <MessageSquare className="h-3.5 w-3.5" />
          {comLeitura.length === 1
            ? '1 protocolo chegou pelo WhatsApp e espera conferência'
            : `${comLeitura.length} protocolos chegaram pelo WhatsApp e esperam conferência`}
        </p>
        <ul className="mt-2 space-y-1.5">
          {comLeitura.map((p) => {
            const f = p.leitura!.ficha;
            return (
              <li
                key={p.messageId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <span className="min-w-0">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {f.title || p.arquivo || 'Documento'}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {f.cnjNumber || 'sem número lido'}
                    {p.remetente ? ` · de ${p.remetente}` : ''}
                    {p.leitura!.existente ? ' · completa um processo que já existe' : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setAbrindo(p)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1c7ed6]"
                  >
                    <ScanLine className="h-3.5 w-3.5" /> Conferir
                  </button>
                  <button
                    onClick={() => descartar.mutate(p.messageId)}
                    disabled={descartar.isPending}
                    title="Não era papel de processo — tirar daqui"
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {abrindo?.leitura && (
        <CadastroPorDocumento
          pendente={{
            messageId: abrindo.messageId,
            arquivo: abrindo.arquivo,
            remetente: abrindo.remetente,
            leitura: abrindo.leitura,
          }}
          onClose={() => setAbrindo(null)}
          onDone={() => {
            setAbrindo(null);
            qc.invalidateQueries({ queryKey: ['cadastro-doc-pendentes'] });
            onChange();
          }}
        />
      )}
    </>
  );
}
