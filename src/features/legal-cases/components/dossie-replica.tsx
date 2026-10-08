'use client';

import { useEffect, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/**
 * O DOSSIÊ DA RÉPLICA — um clique, e os autos chegam lidos.
 *
 * O Mac abre os autos no PJe (na janela em que o advogado já está logado), baixa
 * o processo completo e devolve os fatos MEDIDOS: quem contestou e em que
 * folhas, natureza do contrato, trilha de aceites com os intervalos, faturas
 * cruzadas com o HISCON mês a mês, preliminares na ordem em que vieram.
 *
 * 🚨 O DOSSIÊ NÃO MONTA A PEÇA, E DIZER ISSO AQUI É PARTE DO DESENHO. Quem
 * escolhe as peças da biblioteca é a skill e quem a opera — e um botão que
 * prometesse "montar a réplica" faria o advogado parar de conferir a escolha,
 * que é justamente a parte que é juízo.
 *
 * 🚨 O HUB NÃO SABE ENTRAR NO PJe, DE PROPÓSITO: o certificado é do advogado.
 * Por isso o trabalho é do Mac, e por isso "esperando a janela logada" é um
 * estado NORMAL deste bloco — não é falha.
 */
type Replica = {
  status?: string; cnj?: string; pedidoEm?: string; etapa?: string | null; etapaEm?: string;
  erro?: string | null; dossieEm?: string; paginas?: number; documentos?: number;
  documentId?: string; pdfCaminho?: string | null; dossieCaminho?: string | null;
};

export function DossieReplica({ caseId, replica, cnj }: {
  caseId: string;
  /** `metadata.replica` — o estado do último pedido. */
  replica?: Replica | null;
  cnj?: string | null;
}) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);
  const naFila = replica?.status === 'pendente';

  // 🚨 ENQUANTO ESTÁ NA FILA, O CARD SE ATUALIZA SOZINHO. Sem isto o advogado
  // pede e tem de fechar e reabrir o card para saber se saiu — e, pior, para
  // descobrir que o vigia está esperando o login dele. Mesma lição da coleta.
  // Baixar 519 páginas e indexá-las leva ~30s; 6s mostra os passos sem
  // consultar nada quando o bloco está parado.
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
      const r = await legalCasesService.pedirDossieReplica(caseId);
      // 🚨 `ok:false` É RECADO, NÃO ERRO. Card sem CNJ não tem autos para
      // baixar — e pintar isso de vermelho faria parecer defeito o que é
      // cadastro incompleto.
      if (r?.ok === false) toast.warning(r.motivo ?? 'não deu para pedir o dossiê');
      else toast.success('Pedido na fila — o Mac abre os autos no PJe.');
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui pedir o dossiê');
    } finally {
      setPedindo(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <FileSearch className="h-3.5 w-3.5" /> Dossiê da réplica
        </p>
        <button
          onClick={pedir}
          disabled={pedindo || naFila}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#0F766E' }}
        >
          {pedindo || naFila
            ? <><Loader2 className="h-3 w-3 animate-spin" /> {naFila ? 'na fila…' : 'pedindo…'}</>
            : (replica?.status === 'dossie-pronto' ? 'Refazer o dossiê' : 'Ler os autos')}
        </button>
      </div>

      <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
        O Mac baixa o processo completo do PJe e devolve os fatos medidos. A
        escolha das peças continua sua.
        {cnj ? '' : ' Este card não tem CNJ — sem ele não há autos para baixar.'}
      </p>

      {replica?.status === 'pendente' && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          {/* 🚨 O PASSO, NÃO "na fila". Entre o clique e o dossiê passam uns 30s
              (e mais, se a Área de download do PJe tiver de montar o PDF); card
              imóvel não distingue trabalhando de travado. */}
          {replica.etapa ?? 'Na fila — o Mac pega em segundos.'}
        </p>
      )}

      {replica?.status === 'dossie-pronto' && (
        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-[11px] leading-4 font-medium text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300">
          ✓ {replica.documentos} documentos lidos em {replica.paginas} páginas — o
          dossiê está nos Anexos deste card.
        </p>
      )}

      {replica?.status === 'erro' && (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] leading-4 font-medium text-rose-800 dark:bg-rose-900/25 dark:text-rose-300">
          ⚠ Não li os autos: {replica.erro ?? 'motivo não registrado'}
        </p>
      )}
    </div>
  );
}
