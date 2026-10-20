'use client';

import { useEffect, useState } from 'react';
import { Scale, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { BarraProgresso } from './barra-progresso';

/**
 * O CUMPRIMENTO DE SENTENÇA — um clique, e a conta sai dos autos.
 *
 * O Mac lê os autos, tira do HISCON cada competência com id de documento e
 * página, apura pelo `conferir_calculo.py` (que recusa insumo defeituoso) e
 * devolve a petição e a memória de cálculo.
 *
 * 🚨 ESTE BLOCO TEM TRÊS DESFECHOS, NÃO DOIS, e o do meio é o que faz ele
 * valer. Além de pronto e erro existe ESPERANDO: o índice de correção sai do
 * capítulo de juros da SENTENÇA, e quando ele não é inequívoco o Mac PARA e
 * lista o que falta, em vez de escolher. Foi palpite de índice que fez a conta
 * da LURDES sair três vezes errada. Lacuna aqui não é falha do robô — é a
 * parte que é juízo, e ela aparece em amarelo, não em vermelho.
 *
 * 🚨 O HUB NÃO ENTRA NO PORTAL, de propósito: o certificado é do advogado. Em
 * tribunal que não se baixa por robô (o e-SAJ do TJSP, por exemplo), o estado
 * normal é "esperando os autos" — ele arrasta o PDF para ~/Desktop/AUTOS.
 */
type Cumprimento = {
  status?: string; cnj?: string; reu?: string | null; pedidoEm?: string;
  etapa?: string | null; erro?: string | null;
  faltam?: string[] | null; esperandoDesde?: string;
  total?: number; parcelas?: number | null;
  peca?: string | null; memoria?: string | null; mesa?: string | null;
  amarelo?: boolean; prontoEm?: string;
};

const real = (n: number) =>
  `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function CumprimentoCs({ caseId, cumprimento: dado, sempreVisivel = false }: {
  caseId: string;
  /** `metadata.cumprimento`. Omitir faz o bloco buscar sozinho. */
  cumprimento?: Cumprimento | null;
  sempreVisivel?: boolean;
}) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);

  // o bloco se basta: no card da agenda o pai só sabe o caseId
  const precisaBuscar = dado === undefined;
  const { data: caso } = useQuery({
    queryKey: ['legal-case', caseId],
    queryFn: () => legalCasesService.get(caseId),
    enabled: precisaBuscar && !!caseId,
    staleTime: 10_000,
  });
  const cs: Cumprimento | null = precisaBuscar
    ? (((caso as any)?.metadata?.cumprimento ?? null) as Cumprimento | null)
    : (dado ?? null);
  const fase = (caso as any)?.legalPhase as string | undefined;
  const naFila = cs?.status === 'pendente';

  // enquanto está na fila, o card se atualiza sozinho
  useEffect(() => {
    if (!naFila || !caseId) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    }, 6000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc]);

  const pedir = async () => {
    setPedindo(true);
    try {
      const r = await legalCasesService.pedirCumprimento(caseId);
      // `ok:false` é recado, não erro: card sem CNJ não tem autos para ler
      if (r?.ok === false) toast.warning(r.motivo ?? 'não deu para pedir');
      else toast.success('Pedido na fila — o Mac lê os autos e apura a conta.');
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui pedir o cumprimento');
    } finally {
      setPedindo(false);
    }
  };

  if (!sempreVisivel && !cs && fase !== 'cumprimento') return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Cumprimento de sentença</span>
        </div>
        <button
          onClick={pedir}
          disabled={pedindo || naFila}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5
                     text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          {pedindo || naFila ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {naFila ? 'na fila' : cs ? 'refazer' : 'Montar cumprimento'}
        </button>
      </div>

      {naFila && (
        <div className="mt-3">
          <BarraProgresso caseId={caseId} />
          <p className="mt-2 text-xs text-muted-foreground">
            {cs?.etapa ?? 'na fila do Mac'}
          </p>
        </div>
      )}

      {/* 🚨 ESPERANDO É AMARELO, NÃO VERMELHO. É pedido de leitura humana. */}
      {cs?.status === 'esperando' && (
        <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 p-3
                        dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            {cs.faltam?.length
              ? `Li os autos. Faltam ${cs.faltam.length} dado(s) que só saem da leitura da sentença:`
              : 'Esperando os autos completos em PDF.'}
          </p>
          {cs.faltam?.length ? (
            <ul className="mt-2 space-y-1">
              {cs.faltam.map((f, i) => (
                <li key={i} className="text-xs text-amber-900/90 dark:text-amber-200/90">• {f}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
              Baixe o processo completo e arraste o PDF para <code>~/Desktop/AUTOS</code>.
            </p>
          )}
        </div>
      )}

      {cs?.status === 'pronto' && (
        <div className="mt-3 space-y-1.5">
          <p className="text-sm font-semibold">{real(cs.total ?? 0)}</p>
          <p className="text-xs text-muted-foreground">
            {cs.parcelas ? `${cs.parcelas} competência(s) apurada(s) · ` : ''}
            peça e memória de cálculo prontas
          </p>
          {cs.mesa && (
            <p className="text-xs text-muted-foreground">na Mesa: <code>{cs.mesa}</code></p>
          )}
          {cs.amarelo && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              🟡 a peça saiu com pendência em amarelo — confira antes de protocolar
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            no protocolo: 01. a petição, 02. a memória
          </p>
        </div>
      )}

      {cs?.status === 'erro' && (
        <p className="mt-3 text-xs text-destructive">{cs.erro}</p>
      )}
    </div>
  );
}
