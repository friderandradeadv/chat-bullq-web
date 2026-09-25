'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/**
 * Solta aqui os documentos do INSS e o hub faz o resto.
 *
 * Por que existe: o arquivo baixado do Meu INSS chega com o nome cru
 * (`extrato_emprestimo_consignado_completo_160426.pdf` é o HISCON,
 * `historico-creditos (4).pdf` é o HISCRE) e alguém baixava, renomeava e
 * arrastava para o Drive à mão — quando arrastava. O card ficava em
 * "info_faltantes" com os documentos já na pasta do cliente, soltos na raiz.
 *
 * Aqui o reconhecimento é pelo CONTEÚDO do PDF, nunca pelo nome: o nome é
 * justamente o que não se pode usar. A espécie do benefício (AP/PM) sai da capa
 * do HISCON e vale para o HISCRE e o IR do mesmo lote, que não a trazem.
 */

type Resultado = Awaited<ReturnType<typeof legalCasesService.arquivarDocumentosEmLote>>;

export function IntakeDocumentos({
  caseId,
  onMovido,
}: {
  caseId: string;
  onMovido?: () => void;
}) {
  const [sobre, setSobre] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  // 🚨 A MESMA PISCADA DA APROVAÇÃO. O botão que faz o card ANDAR avisa com o
  // corpo antes de avisar com texto: cresce, ganha anel e sombra por 900ms. É a
  // convenção já usada em "Aprovada para protocolo" (fase-fields.tsx) — sem ela
  // o card sumia da fase sem nada acontecer na tela (25/09/2026).
  const [piscou, setPiscou] = useState(false);
  const qc = useQueryClient();
  const [r, setR] = useState<Resultado | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // 🚨 O QUE FALTA SE LÊ, NÃO SE PERGUNTA. Antes a fase tinha dois campos
  // manuais — "Quais documentos faltantes?" e a lista "Obter documentos" — que
  // pediam ao advogado o que o hub já enxerga na pasta do Drive (onde o kit
  // assinado e os anexos da conversa também são espelhados). Removidos em
  // 25/09/2026: quem responde é esta consulta.
  const [check, setCheck] = useState<{ faltam: string[]; temTudo: boolean } | null>(null);
  const [olhando, setOlhando] = useState(true);

  const conferir = useCallback(async () => {
    setOlhando(true);
    try {
      setCheck(await legalCasesService.documentosFaltantes(caseId));
    } catch {
      setCheck(null); // não invento: sem resposta, não afirmo que está completo
    } finally {
      setOlhando(false);
    }
  }, [caseId]);

  useEffect(() => { void conferir(); }, [conferir]);

  async function enviar(files: FileList | File[] | null) {
    const lista = Array.from(files ?? []);
    if (!lista.length) return;
    setEnviando(true);
    try {
      const res = await legalCasesService.arquivarDocumentosEmLote(caseId, lista);
      setR(res);
      const n = res.arquivados.length;
      if (n) toast.success(`${n} documento${n > 1 ? 's' : ''} arquivado${n > 1 ? 's' : ''} no Drive`);
      else if (res.repetidos.length) toast.info('Esses documentos já estavam na pasta.');
      else toast.warning('Nada foi arquivado — veja o que o hub não reconheceu.');
      void conferir();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui arquivar os documentos.');
    } finally {
      setEnviando(false);
    }
  }

  async function moverParaMontar() {
    setPiscou(true);
    setMovendo(true);
    try {
      await legalCasesService.movePhase(caseId, 'montar_inicial');
      // 🚨 RECARREGAR O QUADRO, NÃO SÓ AVISAR. O toast dizia "movido" e o card
      // continuava na coluna antiga até um F5 — o hub afirmava uma coisa e
      // mostrava outra (25/09/2026). `onMovido` fecha a gaveta; quem atualiza o
      // kanban é a invalidação, a mesma que a aprovação de fase já fazia.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['legal-cases'] }),
        qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }),
      ]);
      toast.success('Card movido para MONTAR INICIAL');
      onMovido?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui mover o card.');
    } finally {
      setMovendo(false);
      setTimeout(() => setPiscou(false), 900);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#cfe0ed] bg-[#f7fafc] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-center gap-1.5">
        <FileUp className="h-3.5 w-3.5 shrink-0 text-[#48626f] dark:text-zinc-400" />
        <p className="flex-1 text-sm font-medium text-[#101820] dark:text-zinc-200">
          Documentos faltantes
        </p>
      </div>

      {olhando ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#48626f] dark:text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" /> conferindo a pasta do cliente…
        </p>
      ) : check?.temTudo ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3 shrink-0" /> Está tudo na pasta do Drive.
        </p>
      ) : check?.faltam?.length ? (
        <div className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3 w-3 shrink-0" /> Falta na pasta do cliente:
          </p>
          <ul className="mt-0.5 list-disc pl-5">
            {check.faltam.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-[#7d95a2] dark:text-zinc-500">
          não consegui ler a pasta do cliente agora
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          void enviar(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={`mt-2 cursor-pointer rounded-md border border-dashed p-4 text-center transition ${
          sobre
            ? 'border-[#2f6f8f] bg-[#eaf3f8] dark:border-zinc-400 dark:bg-zinc-700/40'
            : 'border-[#cfe0ed] dark:border-zinc-600'
        }`}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            void enviar(e.target.files);
            e.target.value = '';
          }}
        />
        {enviando ? (
          <p className="flex items-center justify-center gap-2 text-xs text-[#48626f] dark:text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lendo os documentos e arquivando no Drive…
          </p>
        ) : (
          <>
            <p className="text-xs font-medium text-[#101820] dark:text-zinc-200">
              Arraste HISCON, HISCRE, IR e o print do Portal MIR
            </p>
            <p className="mt-0.5 text-[11px] text-[#7d95a2] dark:text-zinc-500">
              pode soltar todos de uma vez, com o nome que vier do portal
            </p>
          </>
        )}
      </div>

      <button
        onClick={moverParaMontar}
        disabled={movendo}
        className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-emerald-700 disabled:opacity-60 ${
          piscou ? 'scale-105 shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300' : ''
        }`}
      >
        {movendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {movendo ? 'Movendo…' : 'Documentos OK — montar inicial'}
      </button>
      {/* 🚨 O BOTÃO NÃO SE BLOQUEIA, MAS NÃO MENTE. O advogado pode saber de algo
          que a pasta não mostra (documento que virá, peça que dispensa aquele
          extrato). O hub avisa e deixa a decisão com ele. */}
      {!olhando && check && !check.temTudo && check.faltam.length > 0 && (
        <p className="mt-1 text-center text-[10px] text-[#7d95a2] dark:text-zinc-500">
          ainda falta documento na pasta — só siga se for de propósito
        </p>
      )}

      {r && (
        <div className="mt-2 space-y-1.5 text-[11px]">
          {r.beneficio && (
            <p className="text-[#48626f] dark:text-zinc-400">
              Benefício reconhecido:{' '}
              <span className="font-medium">
                {r.beneficio === 'PM' ? 'pensão por morte' : 'aposentadoria'}
              </span>
            </p>
          )}

          {r.arquivados.map((a) => (
            <p key={a.nome} className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-px h-3 w-3 shrink-0" />
              <span>
                <span className="font-medium">{a.nome}</span>
                {a.de && <span className="text-[#7d95a2] dark:text-zinc-500"> — era “{a.de}”</span>}
              </span>
            </p>
          ))}

          {r.repetidos.map((x) => (
            <p key={x.nome} className="text-[#7d95a2] dark:text-zinc-500">
              {x.nome} já estava na pasta — não sobrescrevi
            </p>
          ))}

          {r.naoReconhecidos.map((x) => (
            <p key={x.nome} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              <span>
                <span className="font-medium">{x.nome}</span>: {x.motivo}
              </span>
            </p>
          ))}

          {r.faltam.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              Ainda falta: <span className="font-medium">{r.faltam.join(' · ')}</span>
            </p>
          )}

          {r.prontoParaMontar && (
            <button
              onClick={moverParaMontar}
              disabled={movendo}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md bg-[#2f6f8f] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#25596f] disabled:opacity-60"
            >
              {movendo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Está tudo na pasta — mover para MONTAR INICIAL
            </button>
          )}
        </div>
      )}
    </div>
  );
}
