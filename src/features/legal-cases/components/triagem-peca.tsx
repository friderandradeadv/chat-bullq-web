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
  /* o segundo passo, decidido no servidor pela família (familias-de-peca.ts) */
  podeMontar?: boolean | null; rotuloMontagem?: string | null;
};

export function TriagemPeca({ caseId, acao, rotulo, monta}: {
  caseId: string; acao: string; rotulo: string;
  monta?: { rotulo: string } | null}) {
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
  const [montando, setMontando] = useState(false);

  /**
   * 🚨 A TRIAGEM DE CONTRARRAZÕES TEM UM SEGUNDO PASSO, E ELE NÃO TINHA BOTÃO.
   *
   * O Mac já sabe montar a contrarrazão inteira: base da skill, blocos de
   * mérito roteados pelas teses que esta triagem mediu, timbrado e entrega na
   * Mesa. Faltava a porta — o advogado clicava em "Rodar triagem" três vezes
   * seguidas, ela respondia "cabe" nas três, e a fila de montagem nunca
   * recebia pedido nenhum. Medido em 10/11/2026, no caso da MARIA JOSÉ.
   *
   * O botão só aparece quando a triagem FECHOU e disse que CABE: montar o que
   * não cabe é gastar prazo com peça que não existe.
   *
   * 🚨 E QUEM DECIDE NÃO É ESTE ARQUIVO (10/11/2026). A primeira versão testava
   * aqui o nome da ação (`acao.includes('contrarraz')`), e isso punha a regra
   * em dois donos: a API dizendo quem monta e o navegador dizendo quem ganha
   * botão. O preço é calado — o botão some e o advogado volta a clicar em
   * "Rodar de novo", que é como o caso da MARIA JOSÉ rodou quatro triagens sem
   * produzir peça nenhuma. Agora a família declara `monta` no catálogo da API,
   * o estado da triagem traz `podeMontar` e `rotuloMontagem`, e o card só
   * pergunta. Família nova ganha o botão sem tocar no front.
   */
  const montarPeca = async () => {
    setMontando(true);
    try {
      const { data } = await api.post(`/legal-cases/${caseId}/peca/montar`, { acao });
      const r = (data?.data ?? data) as { ok?: boolean; motivo?: string };
      if (r?.ok === false) { toast.error(r.motivo ?? 'não consegui pedir a montagem'); return; }
      toast.success('Na fila do Mac. Ele monta a contrarrazão e entrega na Mesa.');
      qc.invalidateQueries({ queryKey: ['peca', caseId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui pedir a montagem');
    } finally {
      setMontando(false);
    }
  };

  /* enquanto o Mac trabalha, o card acompanha — e para de perguntar quando
     termina, para não ficar batendo no hub para sempre.

     🚨 IMPASSE MEDIDO EM 11/11/2026: o card só perguntava enquanto JÁ SABIA
     que havia trabalho (`naFila`). Com o drawer aberto e nenhum estado em
     cache, `naFila` era falso, o polling não ligava, e a triagem fechava sem
     o card ficar sabendo — o botão de montar só aparecia depois de recarregar
     a página. O advogado via a barra verde dizer "pronta" e o bloco abaixo
     continuar oferecendo "Rodar triagem".

     Então ele também pergunta quando NÃO TEM estado nenhum: é exatamente a
     situação em que não dá para saber se há trabalho. Com teto, para não
     bater no hub para sempre num card que de fato nunca teve triagem. */
  const [tentativas, setTentativas] = useState(0);
  useEffect(() => {
    if (!caseId) return;
    const semEstado = !est?.status;
    if (!naFila && !semEstado) return;
    if (semEstado && !naFila && tentativas >= 40) return;   // ~5 min
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['triagem', caseId] });
      if (!naFila) setTentativas((n) => n + 1);
    }, naFila ? 5000 : 8000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc, est?.status, tentativas]);

  /* a triagem é desta ação? se o card trocou de classe, o relatório velho
     não serve — mostrar relatório de outra peça seria pior que não mostrar */
  const desteAcao = !est?.acao || est.acao === acao;
  const mostra = desteAcao ? est : null;

  /* 🚨 QUEM SABE A FAMÍLIA É O CARD, NÃO O REGISTRO DA TRIAGEM (11/11/2026).
     O `podeMontar` da API se apoia em `triagem.acao` — que só existe DEPOIS de
     a triagem rodar. Num card novo não havia ação gravada, a API não achava a
     família no catálogo e o botão de montar não nascia: o advogado via só
     "Rodar triagem", que é exatamente o segundo passo que o escritório mandou
     eliminar. O card, esse, já sabe: a publicação sugere a família.

     O que barra continua sendo medição: `cabe === false` é a triagem dizendo
     que a peça não existe, e aí não há botão. Durante a leitura também não,
     para não enfileirar duas montagens. */
  const podeMontar = Boolean(monta) && mostra?.cabe !== false && !naFila;
  const rotuloMontar = monta?.rotulo ?? mostra?.rotuloMontagem ?? 'Montar a peça';

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
        {/* 🚨 UM BOTÃO SÓ QUANDO DÁ PARA MONTAR (11/11/2026, determinação do
            escritório: "tem que ter um botão só, de montar a contrarrazão, que
            já lê o dossiê, autos, etc"). Desde hoje o montar refaz a cadeia
            inteira — renova os autos passados de 24h, relê, roda a triagem e
            só então monta. Com isso o "Rodar de novo" virou um segundo
            caminho para a mesma coisa, e dois botões que fazem o mesmo é
            convite a clicar no errado. Ele volta a aparecer quando NÃO dá para
            montar (não cabe, ou família sem montador), que é quando reler os
            autos ainda é um ato em si. */}
        {!podeMontar && (
        <button
          onClick={pedir}
          disabled={pedindo || naFila}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {(pedindo || naFila) && <Loader2 className="h-3 w-3 animate-spin" />}
          {naFila ? 'lendo os autos…' : jaRodou ? 'Rodar de novo' : 'Rodar triagem'}
        </button>
        )}
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
      {/* 🚨 O BOTÃO DE MONTAR NÃO MORA DENTRO DO RESULTADO (11/11/2026).
          Ele estava aninhado na caixa `jaRodou`, desenhada só DEPOIS de a
          triagem fechar — então, num card novo, a condição podia ser
          verdadeira e ninguém via o botão. A condição estava certa; errada
          estava a CASA dela.

          Fora da caixa ele aparece desde o primeiro acesso: o clique refaz a
          triagem e monta em seguida. Tendo ela rodado e dito que NÃO cabe,
          `podeMontar` é falso e o botão não nasce. */}
      {podeMontar && (
        <>
          <button
            onClick={montarPeca}
            disabled={montando}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700
                       px-2.5 py-1 text-[11px] font-semibold text-white
                       disabled:opacity-50 hover:bg-emerald-800"
          >
            {montando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {montando ? 'pedindo…' : rotuloMontar}
          </button>
          {/* 🚨 o que o Mac NÃO faz tem de estar escrito aqui, não só no
              relatório: ele repõe as teses que têm bloco na prateleira, e
              hoje são 6 das 10. As outras continuam sendo do advogado. */}
          <p className="mt-1 text-[10px] leading-4 opacity-80">
            Ele monta os capítulos que têm bloco na biblioteca e diz, no card, quais
            teses ficaram sem. O que você escreveu em “O que você quer nesta peça?”
            só tira capítulo, nunca escreve texto.
          </p>
        </>
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
