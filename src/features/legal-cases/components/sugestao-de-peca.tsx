'use client';

import { useState } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DossieReplica } from './dossie-replica';
import { CumprimentoCs } from './cumprimento-cs';

/**
 * O QUE A PUBLICAÇÃO PEDE, e o que dá para fazer com isso.
 *
 * O classificador do DJEN já lê a publicação e grava a `action` na tarefa. Daqui
 * o card mostra a peça sugerida, o estado da família e um campo para o advogado
 * dizer o que quer. Nada disso adivinha: o catálogo vem do servidor.
 *
 * 🚨 SUGERIR NÃO É MONTAR, e a diferença não é retórica. No OTAIR o card dizia
 * "o réu não reverteu a decisão e o crédito do cliente está exigível", e a
 * sentença mandava apenas cancelar um cartão: quem lesse só a publicação teria
 * montado execução de quantia certa com confiança. Por isso aqui está escrito
 * "a publicação sugere", e quem confirma são os autos, dentro de cada família.
 *
 * 🚨 O BOTÃO SÓ APARECE ONDE HÁ CAMINHO. Botão igual em toda família ensinaria
 * que toda família monta, e a primeira que não montasse pareceria defeito. As
 * que não montam dizem POR QUÊ, com a medida: quantas bases, quantos
 * marcadores, o que falta.
 */
type Familia = {
  acao: string; rotulo: string; skill: string | null;
  estado: 'pronta' | 'triagem' | 'base-sem-preenchedor' | 'sem-base' | 'nao-e-peca';
  porque?: string;
};

const SELO: Record<Familia['estado'], { texto: string; classe: string }> = {
  'pronta': { texto: 'pronta', classe: 'text-emerald-700 dark:text-emerald-400' },
  'triagem': { texto: 'leio a decisão e aponto o vício', classe: 'text-sky-700 dark:text-sky-400' },
  'base-sem-preenchedor': { texto: 'base pronta, preenchimento pendente', classe: 'text-amber-700 dark:text-amber-400' },
  'sem-base': { texto: 'sem base', classe: 'text-zinc-500 dark:text-zinc-400' },
  'nao-e-peca': { texto: 'não produz petição', classe: 'text-zinc-500 dark:text-zinc-400' },
};

export function SugestaoDePeca({ caseId, acao, recorte }: {
  caseId: string;
  acao: string | null;
  recorte?: string | null;
}) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const { data } = useQuery({
    queryKey: ['pecas', 'familias'],
    queryFn: async (): Promise<Familia[]> => {
      const { data } = await api.get('/legal-cases/pecas/familias');
      return ((data?.data ?? data)?.familias ?? []) as Familia[];
    },
    staleTime: 10 * 60_000,
  });

  const familia = data?.find((f) => f.acao === acao) ?? null;
  if (!acao || !familia) return null;

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post(`/legal-cases/${caseId}/peca/instrucao`, { acao, instrucao: texto });
      setSalvo(true);
      toast.success('Anotado. Entra na montagem desta peça.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui guardar');
    } finally { setSalvando(false); }
  };

  const selo = SELO[familia.estado];

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <FileText className="h-3.5 w-3.5" /> A publicação sugere: {familia.rotulo}
        </p>
        <span className={`shrink-0 text-[10px] font-medium ${selo.classe}`}>{selo.texto}</span>
      </div>

      {recorte && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          “{recorte.trim().slice(0, 220)}”
        </p>
      )}

      {familia.estado !== 'pronta' && familia.porque && (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {familia.porque}.
        </p>
      )}

      {/* o campo existe em TODA família, inclusive nas que ainda não montam:
          é nas peças abertas que ele mais serve, e guardado ele está lá no dia
          em que a família for ligada */}
      <div className="mt-2.5">
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setSalvo(false); }}
          rows={2}
          placeholder="O que você quer nesta peça? (ex.: ataca pela ausência de ICP; pede só a conversão, sem dano moral)"
          className="w-full resize-y rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-[11px]
                     leading-4 outline-none placeholder:text-zinc-400 focus:border-zinc-400
                     dark:border-zinc-700 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
        />
        {texto.trim() && (
          <button
            onClick={salvar}
            disabled={salvando || salvo}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#7C3AED' }}
          >
            {salvando ? <Loader2 className="h-3 w-3 animate-spin" />
              : salvo ? <Check className="h-3 w-3" /> : null}
            {salvo ? 'anotado' : 'Anotar'}
          </button>
        )}
      </div>

      {familia.acao === 'replica' && (
        <div className="mt-2.5"><DossieReplica caseId={caseId} sempreVisivel /></div>
      )}
      {familia.acao === 'cumprimento' && (
        <div className="mt-2.5"><CumprimentoCs caseId={caseId} sempreVisivel /></div>
      )}
    </div>
  );
}
