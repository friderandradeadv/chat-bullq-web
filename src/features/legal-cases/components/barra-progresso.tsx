'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export type Progresso = {
  op: 'documentos' | 'inicial' | 'protocolo' | 'coleta' | string;
  passo: string;
  n: number | null;
  total: number | null;
  pct: number | null;
  status: 'rodando' | 'ok' | 'erro' | string;
  erro: string | null;
  em: string;
};

const NOME: Record<string, string> = {
  documentos: 'Preparando documentos',
  inicial: 'Montando a inicial',
  protocolo: 'Protocolando',
  coleta: 'Coletando no Meu INSS',
};

/**
 * BARRA DE PROGRESSO DAS OPERAÇÕES LONGAS.
 *
 * 🚨 POR QUE EXISTE. Antes, entre o clique e o resultado o card ficava imóvel
 * por minutos — e imóvel não distingue "trabalhando" de "travado". A coleta já
 * narrava por texto num toast; o escritório pediu em 29/09/2026 barra com
 * porcentagem, e nas TRÊS operações (documentos, inicial, protocolo).
 *
 * 🚨 SEM `pct` A BARRA NÃO FINGE. Quando a operação não sabe quantos passos tem,
 * mostra-se uma faixa em movimento, não uma barra parada em número inventado:
 * barra que mente sobre "quanto falta" é pior que barra nenhuma.
 *
 * Ela se atualiza sozinha enquanto está rodando (3s), e para de consultar assim
 * que termina — não fica batendo no servidor à toa.
 */
export function BarraProgresso({
  caseId,
  inicial,
  compacta = false,
}: {
  caseId: string;
  inicial?: Progresso | null;
  compacta?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['legal-cases', caseId, 'progresso'],
    queryFn: async (): Promise<Progresso | null> => {
      const { data } = await api.get(`/legal-cases/${caseId}`);
      const c = data?.data ?? data;
      return ((c?.metadata as any)?.progresso ?? null) as Progresso | null;
    },
    // 🚨 `initialData: null` NÃO É "sem dado inicial": para o react-query, null é
    // um dado já carregado e fresco, então a primeira busca NUNCA acontece. O
    // sintoma medido em 29/09/2026: a barra só aparecia no card depois que o
    // advogado abria o card uma vez (o que remonta o componente). `undefined` é
    // o valor que significa "não tenho nada, vá buscar".
    initialData: inicial ?? undefined,
    // 🚨 E PRECISA INSISTIR MESMO PARADA. Antes só repetia com status
    // 'rodando' — ou seja, uma operação que COMEÇASSE depois da tela aberta
    // jamais apareceria, que é justo o caso de quem pede "quero ver trabalhando".
    // Também não é terminal o 'ok' em "esperando sua assinatura": o vigia muda
    // esse estado minutos depois, quando o advogado assina.
    refetchInterval: (q) => {
      const d = q.state.data as Progresso | null | undefined;
      if (d?.status === 'rodando') return 3000;
      return d ? 10000 : 20000;
    },
    staleTime: 1500,
  });

  const p = data;
  if (!p) return null;

  const titulo = NOME[p.op] ?? 'Trabalhando';
  const rodando = p.status === 'rodando';
  const erro = p.status === 'erro';
  const pct = typeof p.pct === 'number' ? p.pct : null;

  const cor = erro
    ? 'bg-red-500'
    : p.status === 'ok'
      ? 'bg-emerald-500'
      : 'bg-blue-500';

  return (
    <div
      className={
        compacta
          ? 'rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900/60'
          : 'rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60'
      }
    >
      <div className="flex items-center gap-2">
        {erro ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
        ) : p.status === 'ok' ? (
          <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-blue-500" />
        )}

        <span className={`${compacta ? 'text-[11px]' : 'text-xs'} font-medium text-neutral-800 dark:text-neutral-100`}>
          {titulo}
        </span>

        <span className={`${compacta ? 'text-[11px]' : 'text-xs'} flex-1 truncate text-neutral-600 dark:text-neutral-400`}>
          · {erro ? p.erro || 'falhou' : p.passo}
        </span>

        {pct != null && (
          <span className={`${compacta ? 'text-[11px]' : 'text-xs'} tabular-nums font-semibold text-neutral-700 dark:text-neutral-200`}>
            {pct}%
          </span>
        )}
        {pct == null && p.total == null && p.n != null && (
          <span className="text-[11px] tabular-nums text-neutral-500">{p.n}</span>
        )}
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        {pct != null ? (
          <div
            className={`h-full rounded-full ${cor} transition-[width] duration-500 ease-out`}
            style={{ width: `${pct}%` }}
          />
        ) : (
          // sem total conhecido: faixa pulsando, sem número inventado
          <div className={`h-full w-1/3 rounded-full ${cor} ${rodando ? 'animate-pulse' : ''}`} />
        )}
      </div>

      {p.n != null && p.total != null && (
        <div className="mt-1 text-[11px] tabular-nums text-neutral-500">
          passo {p.n} de {p.total}
        </div>
      )}

    </div>
  );
}
