'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Scissors, Loader2, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type CaseDetail,
  type DocumentosDaInicial,
} from '@/features/legal-cases/services/legal-cases.service';

/**
 * O que o hub recortou sozinho quando o card chegou em MONTAR INICIAL.
 *
 * Por que existe: o recorte já rodava, mas em silêncio. Os três PDFs apareciam
 * na pasta "PARA A INICIAL" do Drive e o card não dizia nada — nem que tinha
 * rodado, nem quantas páginas sobraram, nem que faltou o print do MIR. Quem
 * montava a peça ia conferir no Drive justamente para descobrir se valia a pena
 * ir ao Drive.
 *
 * O que ele mostra sai de `metadata.documentosDaInicial`, gravado pelo mesmo
 * serviço que corta — a tela não recalcula nada, e por isso não tem como
 * discordar do que está na pasta.
 */

const ROTULO: Record<string, string> = { AP: 'aposentadoria', PM: 'pensão por morte' };

/** Enquanto o recorte roda, o card é relido de tempos em tempos. */
const POLL_MS = 8000;
/** Depois disso, "preparando" não é mais espera: é coisa que não terminou. */
const DESISTE_MS = 10 * 60 * 1000;

export function DocumentosDaInicial({ caso }: { caso: CaseDetail }) {
  const qc = useQueryClient();
  const [refazendo, setRefazendo] = useState(false);
  const d = (caso.metadata as any)?.documentosDaInicial as DocumentosDaInicial | undefined;

  const idade = d?.em ? Date.now() - Date.parse(d.em) : 0;
  const travado = d?.estado === 'preparando' && idade > DESISTE_MS;
  const rodando = (d?.estado === 'preparando' && !travado) || refazendo;

  // Recorta em segundo plano: sem reler o card, o painel ficaria parado no
  // "preparando" até alguém fechar e reabrir a gaveta.
  useEffect(() => {
    if (d?.estado !== 'preparando' || travado) return;
    const t = setInterval(
      () => qc.invalidateQueries({ queryKey: ['legal-case', caso.id] }),
      POLL_MS,
    );
    return () => clearInterval(t);
  }, [d?.estado, travado, caso.id, qc]);

  // 🚨 Depois dos hooks, nunca antes: sair mais cedo pularia o useEffect acima
  // e o React derruba a gaveta com "rendered fewer hooks than expected" no
  // primeiro card que mudasse de fase com ela aberta.
  //
  // Card que passou por MONTAR INICIAL antes desta função não tem o que
  // mostrar, e oferecer o preparo lá adiante — já em revisão, com a peça
  // pronta — seria botão para desfazer trabalho feito.
  if (!d && caso.legalPhase !== 'montar_inicial') return null;

  async function refazer() {
    // 🚨 O Drive NÃO sobrescreve arquivo de mesmo nome. Refazer sem tirar os
    // anteriores da frente acertaria os números desta tela e deixaria na pasta
    // o recorte velho — então o que se confirma aqui é a substituição.
    const temAntes = (d?.feitos?.length ?? 0) > 0;
    if (
      temAntes &&
      !confirm(
        'Refazer o recorte?\n\nOs PDFs gerados antes vão para a lixeira do Drive ' +
          '(dá para recuperar por 30 dias) e o recorte novo entra no lugar. ' +
          'Os extratos originais não são tocados.',
      )
    )
      return;
    setRefazendo(true);
    try {
      const r = await legalCasesService.prepararDocumentosDaInicial(caso.id, temAntes);
      qc.invalidateQueries({ queryKey: ['legal-case', caso.id] });
      if (r.ok) toast.success('Extratos recortados de novo');
      else toast.warning(r.motivo ?? 'Não consegui preparar os extratos.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui refazer o recorte.');
    } finally {
      setRefazendo(false);
    }
  }

  const botao = (
    <button
      onClick={refazer}
      disabled={rodando}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#cfe0ed] px-2.5 py-1 text-[11px] font-medium text-[#48626f] transition hover:border-[#2f6f8f] hover:text-[#2f6f8f] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-400 dark:hover:text-zinc-200"
    >
      {refazendo ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      {d?.feitos?.length ? 'Refazer o recorte' : 'Preparar os extratos'}
    </button>
  );

  return (
    <div className="mt-5 rounded-lg border border-[#cfe0ed] bg-[#f7fafc] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-center gap-1.5">
        <Scissors className="h-3.5 w-3.5 shrink-0 text-[#48626f] dark:text-zinc-400" />
        <p className="flex-1 text-sm font-medium text-[#101820] dark:text-zinc-200">
          Extratos prontos para a inicial
        </p>
        {d?.beneficio && (
          <span className="text-[10px] text-[#7d95a2] dark:text-zinc-500">
            {ROTULO[d.beneficio] ?? d.beneficio}
          </span>
        )}
      </div>

      {/* Card antigo, de antes do recorte automático: não há o que mostrar,
          mas há o que fazer. */}
      {!d ? (
        <>
          <p className="mt-1.5 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
            Este card entrou em MONTAR INICIAL antes do recorte automático. Dá para
            cortar o HISCON e o HISCRE e montar o JG agora.
          </p>
          {botao}
        </>
      ) : rodando ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[#48626f] dark:text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Recortando o HISCON e o HISCRE e montando o JG… leva cerca de um minuto.
        </p>
      ) : travado ? (
        <>
          <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            O preparo começou e não terminou. A API pode ter reiniciado no meio.
          </p>
          {botao}
        </>
      ) : (
        <>
          {!d.ok && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {d.motivo ?? 'Não consegui preparar os extratos.'}
            </p>
          )}

          {d.pasta && (
            <p className="mt-1.5 text-[10px] leading-4 text-[#48626f] dark:text-zinc-500">
              {d.pasta}
            </p>
          )}

          {d.feitos?.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {d.feitos.map((f) => (
                <li key={f.nome} className="flex items-start gap-1.5 text-[11px] leading-4">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[#101820] dark:text-zinc-300">
                    <span className="font-medium">{f.nome}</span>
                    <span className="text-[#48626f] dark:text-zinc-400">
                      {' · '}
                      {f.de !== f.paginas
                        ? `${f.de} → ${f.paginas} páginas`
                        : `${f.paginas} página${f.paginas === 1 ? '' : 's'}`}
                    </span>
                    {f.detalhe && (
                      <span className="text-[#7d95a2] dark:text-zinc-500"> · {f.detalhe}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* 🚨 Isto não é detalhe: arquivo de mesmo nome é PULADO pelo Drive,
              então a pasta ficou com o recorte anterior e os números acima são
              de um PDF que não está lá. */}
          {(d.repetidos?.length ?? 0) > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <span className="font-medium">{d.repetidos!.join(' · ')}</span> já estava na
                pasta e não foi sobrescrito: o que está no Drive é o recorte anterior.
                Use “Refazer o recorte” para substituir.
              </span>
            </p>
          )}

          {d.avisos?.map((a) => (
            <p
              key={a}
              className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {a}
            </p>
          ))}

          {(d.substituidos?.length ?? 0) > 0 && (
            <p className="mt-1.5 text-[10px] leading-4 text-[#7d95a2] dark:text-zinc-500">
              Foram para a lixeira do Drive, para dar lugar ao recorte novo:{' '}
              {d.substituidos!.join(' · ')}
            </p>
          )}

          {botao}
        </>
      )}
    </div>
  );
}
