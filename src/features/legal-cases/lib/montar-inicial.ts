import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/**
 * A sequência que monta a inicial, em UM lugar só.
 *
 * Ela é disparada de três telas — o botão da fase (drawer), o lote do kanban e o
 * botãozinho do card — e cada cópia que existisse seria uma chance de a ordem
 * divergir. E a ORDEM importa: os documentos são recortados ANTES da peça,
 * senão o pacote sai com o HISCON inteiro, de 82 páginas.
 */
export type ResultadoMontagem =
  | { ok: true }
  | { ok: false; motivo: 'sem-calculo'; detalhe: string }
  | { ok: false; motivo: 'abortado' }
  | { ok: false; motivo: 'erro'; detalhe: string };

export function produtoDoCard(produto?: string | null, area?: string | null): 'RMC' | 'RCC' {
  return `${produto ?? ''} ${area ?? ''}`.toUpperCase().includes('RCC') ? 'RCC' : 'RMC';
}

export async function montarInicialCompleta(
  caseId: string,
  produto: 'RMC' | 'RCC',
  opts: { signal?: AbortSignal; temCalculo?: boolean; onEtapa?: (e: string) => void } = {},
): Promise<ResultadoMontagem> {
  const { signal, onEtapa } = opts;
  const abortou = () => !!signal?.aborted;
  try {
    // 🚨 O CÁLCULO ESCOLHE O PEDIDO. O sinal da restituição decide a base:
    // positivo é cartão QUITADO e pede o indébito EM DOBRO; zero ou negativo é
    // EM ABERTO. Sem cálculo o gerador lê restituição 0 e conclui "em aberto"
    // por FALTA DE DADO, não por medição — e o dobro some do pedido de um
    // cliente quitado sem que nada na peça pronta denuncie a troca. Por isso
    // aqui é TRAVA: falhou o cálculo, não se monta.
    if (!opts.temCalculo) {
      onEtapa?.('Calculando…');
      const r = await legalCasesService
        .calcularAutomatico(caseId, produto, signal)
        .catch((e: any) => ({ ok: false as const, motivo: e?.response?.data?.message || 'erro ao calcular' }));
      if (!r.ok) return { ok: false, motivo: 'sem-calculo', detalhe: (r as any).motivo ?? '' };
    }
    if (abortou()) return { ok: false, motivo: 'abortado' };

    // Documentos ANTES da peça: o recorte do HISCON/HISCRE e o JG composto vivem
    // em "PARA A INICIAL", e é de lá que a pasta do protocolo tira o que vai.
    onEtapa?.('Preparando os documentos…');
    await legalCasesService.prepararDocumentosDaInicial(caseId, false, signal).catch(() => undefined);
    if (abortou()) return { ok: false, motivo: 'abortado' };

    onEtapa?.('Gerando a inicial…');
    await legalCasesService.gerarInicial(caseId, produto, signal);
    if (abortou()) return { ok: false, motivo: 'abortado' };

    // A pasta falhar não desfaz a peça: ela já está anexada ao card.
    onEtapa?.('Organizando a pasta…');
    await legalCasesService.organizarPastaInicial(caseId).catch(() => undefined);
    if (abortou()) return { ok: false, motivo: 'abortado' };

    onEtapa?.('Movendo para revisão…');
    await legalCasesService.movePhase(caseId, 'revisao_inicial');
    return { ok: true };
  } catch (e: any) {
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || abortou()) {
      return { ok: false, motivo: 'abortado' };
    }
    return { ok: false, motivo: 'erro', detalhe: e?.response?.data?.message || 'Não consegui completar a montagem.' };
  }
}
