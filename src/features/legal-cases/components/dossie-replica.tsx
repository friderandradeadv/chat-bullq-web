'use client';

import { useEffect, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { BarraProgresso } from './barra-progresso';

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
  texto?: string | null;
  kap?: { pasta?: string; imagens?: number; folhas?: string; manifesto?: string; erro?: string } | null;
};

export function DossieReplica({ caseId, replica: replicaDada, cnj: cnjDado, sempreVisivel = false }: {
  caseId: string;
  /** `metadata.replica` — o estado do último pedido. Omitir faz o bloco buscar sozinho. */
  replica?: Replica | null;
  cnj?: string | null;
  /** o pai já decidiu que é hora (ex.: o drawer do processo, que filtra por fase) */
  sempreVisivel?: boolean;
}) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [verKap, setVerKap] = useState(false);

  // 🚨 O BLOCO TEM DE SE BASTAR, PORQUE ELE VIVE EM DOIS LUGARES. No drawer do
  // Processo o pai conhece o caso inteiro; no card da AGENDA — que é onde o
  // advogado de fato trabalha o prazo — o card só sabe o `caseId`. Eu montei
  // primeiro só no Processo e ele não viu nada, com razão: o pedido desde o
  // começo foi "um botão no card lá na agenda". Quando não lhe dão o estado,
  // o bloco busca. Uma query, só com o drawer aberto.
  const precisaBuscar = replicaDada === undefined;
  const { data: caso } = useQuery({
    queryKey: ['legal-case', caseId],
    queryFn: () => legalCasesService.get(caseId),
    enabled: precisaBuscar && !!caseId,
    staleTime: 10_000,
  });
  const replica: Replica | null = precisaBuscar
    ? (((caso as any)?.metadata?.replica ?? null) as Replica | null)
    : (replicaDada ?? null);
  const cnj = precisaBuscar ? ((caso as any)?.cnjNumber ?? null) : cnjDado;
  const fase = (caso as any)?.legalPhase as string | undefined;

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

  // 🚨 APARECE ONDE É ASSUNTO, E SÓ. Na fase da réplica ('08. RÉPLICA/CONTESTAÇÃO'),
  // ou quando já houve um pedido — aí o resultado tem de continuar à vista. Fora
  // disso o bloco some, como a coleta some depois de "montar inicial".
  if (!sempreVisivel && !replica && fase !== 'contestacao') return null;

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

      {/* 🚨 A MESMA BARRA DA INICIAL. Pedido do advogado, e pela razão certa:
          entre o clique e o dossiê passam uns 30s — mais, se o PJe tiver de
          montar o PDF — e card imóvel não distingue trabalhando de travado.
          A barra mostra o passo e a fração; o texto abaixo some para não dizer
          a mesma coisa duas vezes. */}
      {replica?.status === 'pendente' && (
        <div className="mt-2">
          <BarraProgresso caseId={caseId} />
        </div>
      )}

      {replica?.status === 'dossie-pronto' && (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2 py-1 dark:bg-emerald-900/25">
            <p className="text-[11px] leading-4 font-medium text-emerald-800 dark:text-emerald-300">
              ✓ {replica.documentos} documentos lidos em {replica.paginas} páginas
            </p>
            <button
              onClick={() => setAberto((v) => !v)}
              className="shrink-0 text-[11px] font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-300"
            >
              {aberto ? 'ocultar' : 'ver o dossiê'}
            </button>
          </div>

          {/* 🚨 O DOSSIÊ SE LÊ AQUI. Antes esta linha dizia "está nos Anexos
              deste card" — e era falso: o anexo nasce no PROCESSO, e os Anexos
              da agenda são da TAREFA. O advogado leu "47 documentos lidos" e
              não achou nada. Texto medido tem ~5 KB: cabe no card. */}
          {aberto && replica.texto && (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-[1.35] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
{replica.texto}
            </pre>
          )}

          {/* ── O MATERIAL DO KAP ─────────────────────────────────────────
              🚨 ATÉ AQUI É AUTOMÁTICO; O KAP NÃO É. O laudo pede o login do
              advogado e GASTA COTA (15 leituras/mês no MetaExpert, 5 créditos
              por Selfie Expert), e rotina que roda sozinha não gasta crédito —
              regra da casa. Então o fluxo para aqui, com o material pronto.

              🚨 E O MATERIAL É O CERTO: bytes ORIGINAIS extraídos de dentro do
              PDF dos autos, nunca print. Print é PNG novo — apaga o histórico
              de compressão, zera o EXIF, e o SHA-256 passa a ser do print. Um
              laudo assim o banco derruba lendo o nome do arquivo na página 1. */}
          {replica.kap?.imagens ? (
            <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 dark:border-sky-900 dark:bg-sky-950/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] leading-4 font-semibold text-sky-900 dark:text-sky-200">
                  📎 {replica.kap.imagens} imagens do contrato extraídas (fls. {replica.kap.folhas})
                </p>
                <button
                  onClick={() => setVerKap((v) => !v)}
                  className="shrink-0 text-[11px] font-semibold text-sky-900 underline underline-offset-2 dark:text-sky-200"
                >
                  {verKap ? 'ocultar' : 'ver os hashes'}
                </button>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-sky-900/80 dark:text-sky-200/80">
                Bytes originais de dentro do PDF — <strong>nunca print</strong>, que invalida o laudo.
                O SHA-256 abaixo é o que o KAP vai calcular.
              </p>
              <p className="mt-1 text-[10px] leading-4 text-sky-900/80 dark:text-sky-200/80">
                O KAP é <strong>passo conduzido</strong>: pede o seu login e gasta cota
                (15 leituras/mês no MetaExpert · 5 créditos por Selfie Expert).
                {' '}<a href="https://kaponline.com.br" target="_blank" rel="noreferrer"
                   className="font-semibold underline underline-offset-2">abrir o KAP</a>
                {' '}no Chrome logado, e peça a perícia aqui no chat.
              </p>
              {replica.kap.pasta && (
                <p className="mt-1 text-[10px] leading-4 text-sky-900/70 dark:text-sky-200/70">
                  as imagens estão no Mac, em <code className="text-[10px]">{replica.kap.pasta.replace(/^.*\/autos\//, 'autos/')}</code>
                </p>
              )}
              {verKap && replica.kap.manifesto && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre rounded-md border border-sky-200 bg-white/70 p-2 font-mono text-[10px] leading-[1.35] text-zinc-700 dark:border-sky-900 dark:bg-zinc-900/60 dark:text-zinc-300">
{replica.kap.manifesto}
                </pre>
              )}
            </div>
          ) : null}

          <p className="mt-1 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
            O arquivo também ficou nos anexos do <strong>Processo</strong>
            {replica.pdfCaminho ? <> · os autos completos estão no Mac, em <code className="text-[10px]">{replica.pdfCaminho.replace(/^.*\/autos\//, 'autos/')}</code></> : null}
          </p>
        </>
      )}

      {replica?.status === 'erro' && (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] leading-4 font-medium text-rose-800 dark:bg-rose-900/25 dark:text-rose-300">
          ⚠ Não li os autos: {replica.erro ?? 'motivo não registrado'}
        </p>
      )}
    </div>
  );
}
