'use client';

import { useEffect, useRef, useState } from 'react';
import { Scale, Loader2, Upload } from 'lucide-react';
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
 * 🚨 TRÊS DESFECHOS, NÃO DOIS, e o do meio é o que faz o botão valer. Além de
 * pronto e erro existe ESPERANDO: o índice de correção sai do capítulo de
 * juros da SENTENÇA, e quando ele não é inequívoco o Mac PARA e lista o que
 * falta, em vez de escolher. Lacuna aqui não é falha do robô — é a parte que é
 * juízo, e aparece em AMARELO, nunca em vermelho: vermelho onde não houve
 * falha ensina o advogado a ignorar vermelho.
 *
 * 🚨 A ÁREA DE ARRASTAR EXISTE PORQUE O PORTAL NEM SEMPRE ENTREGA. O e-SAJ do
 * TJSP não dá os autos por robô — o botão "Visualizar autos" nasce pedindo
 * senha de liberação quando o advogado não está habilitado (medido em
 * 20/10/2026). Ele baixa à mão, solta o PDF aqui, e a corrente roda.
 *
 * 🚨 AS CORES SÃO AS DO IRMÃO (`dossie-replica.tsx`), não tokens genéricos.
 * A primeira versão usava `bg-card`/`border-border`/`hover:bg-accent`, e no
 * modo escuro o bloco saía lavado, alheio ao resto do card — *"no modo escuro
 * as cores estão horríveis"*. Bloco novo veste a roupa do vizinho.
 */
type Cumprimento = {
  status?: string; cnj?: string; reu?: string | null; pedidoEm?: string;
  etapa?: string | null; erro?: string | null;
  faltam?: string[] | null; esperandoDesde?: string;
  total?: number; parcelas?: number | null;
  peca?: string | null; memoria?: string | null; mesa?: string | null;
  amarelo?: boolean; prontoEm?: string;
  autos?: { nome?: string; bytes?: number; enviadoEm?: string } | null;
};

const real = (n: number) =>
  `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const mb = (n?: number) => (n ? `${(n / 1048576).toFixed(1)} MB` : '');

export function CumprimentoCs({ caseId, cumprimento: dado, sempreVisivel = false }: {
  caseId: string;
  cumprimento?: Cumprimento | null;
  sempreVisivel?: boolean;
}) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const cnj = (caso as any)?.cnjNumber as string | undefined;
  const naFila = cs?.status === 'pendente';

  useEffect(() => {
    if (!naFila || !caseId) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    }, 6000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc]);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
    qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
  };

  const pedir = async () => {
    setPedindo(true);
    try {
      const r = await legalCasesService.pedirCumprimento(caseId);
      if (r?.ok === false) toast.warning(r.motivo ?? 'não deu para pedir');
      else toast.success('Pedido na fila — o Mac lê os autos e apura a conta.');
      atualizar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui pedir o cumprimento');
    } finally { setPedindo(false); }
  };

  const enviar = async (f?: File | null) => {
    if (!f) return;
    setEnviando(true);
    try {
      const r = await legalCasesService.enviarAutosCumprimento(caseId, f);
      if (r?.ok === false) toast.warning(r.motivo ?? 'não deu para receber os autos');
      else toast.success(r?.naFila
        ? 'Autos recebidos — já estão na fila do Mac.'
        : 'Autos recebidos. Falta o CNJ no card para entrar na fila.');
      atualizar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui enviar os autos');
    } finally { setEnviando(false); }
  };

  if (!sempreVisivel && !cs && fase !== 'cumprimento') return null;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <Scale className="h-3.5 w-3.5" /> Cumprimento de sentença
        </p>
        <button
          onClick={pedir}
          disabled={pedindo || naFila || !cnj}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#7C3AED' }}
        >
          {pedindo || naFila
            ? <><Loader2 className="h-3 w-3 animate-spin" /> {naFila ? 'trabalhando…' : 'pedindo…'}</>
            : (cs?.status === 'pronto' ? 'Montar de novo' : 'Montar cumprimento')}
        </button>
      </div>

      <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
        O Mac lê os autos, tira do HISCON cada competência com id e página e apura pelo
        conferidor antiexcesso. A leitura da sentença continua sua.
        {cnj ? '' : ' Este card não tem CNJ — sem ele não há autos para ler.'}
      </p>

      {naFila && (
        <div className="mt-2">
          <BarraProgresso caseId={caseId} />
        </div>
      )}

      {/* a área de arrastar: para o tribunal que não entrega por robô */}
      <div
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault(); setSobre(false);
          enviar(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-2.5 cursor-pointer rounded-md border border-dashed px-3 py-3 text-center transition-colors ${
          sobre
            ? 'border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-500/10'
            : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
      >
        <input
          ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ''; }}
        />
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {enviando
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> enviando…</>
            : <><Upload className="h-3.5 w-3.5" /> Arraste aqui o PDF dos autos completos</>}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          {cs?.autos?.nome
            ? `recebido: ${cs.autos.nome} · ${mb(cs.autos.bytes)}`
            : 'para os tribunais que não entregam por robô (e-SAJ/TJSP) — e já entra na fila'}
        </p>
      </div>

      {/* 🚨 ESPERANDO É AMARELO: é pedido de leitura humana, não falha. */}
      {cs?.status === 'esperando' && (
        <div className="mt-2.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
            {cs.faltam?.length
              ? `Li os autos. Faltam ${cs.faltam.length} dado(s) que só saem da leitura da sentença:`
              : 'Esperando os autos completos em PDF.'}
          </p>
          {cs.faltam?.length ? (
            <ul className="mt-1 space-y-0.5">
              {cs.faltam.map((f, i) => (
                <li key={i} className="text-[11px] leading-4 text-amber-800 dark:text-amber-200/90">• {f}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200/90">
              Baixe o processo completo e solte o PDF na área acima.
            </p>
          )}
        </div>
      )}

      {cs?.status === 'pronto' && (
        <div className="mt-2.5 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{real(cs.total ?? 0)}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {cs.parcelas ? `${cs.parcelas} competência(s) apurada(s) · ` : ''}
            peça e memória de cálculo prontas
          </p>
          {cs.mesa && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">na Mesa: {cs.mesa}</p>
          )}
          {cs.amarelo && (
            <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              🟡 a peça saiu com pendência em amarelo — confira antes de protocolar
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            no protocolo: 01. a petição, 02. a memória
          </p>
        </div>
      )}

      {cs?.status === 'erro' && (
        <p className="mt-2.5 text-[11px] leading-4 text-red-600 dark:text-red-400">{cs.erro}</p>
      )}
    </div>
  );
}
