import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/**
 * A sequência que monta a inicial, em UM lugar só.
 *
 * Disparada de três telas — o botão da fase, o lote do kanban e a pílula do card
 * — e cada cópia seria uma chance de a ORDEM divergir. E a ordem importa: os
 * documentos são recortados ANTES da peça, senão o pacote sai com o HISCON
 * inteiro, de 82 páginas.
 */
export type ResultadoMontagem =
  | { ok: true; aviso?: string }
  | { ok: false; motivo: 'sem-calculo'; detalhe: string; pastaCriada: boolean }
  | { ok: false; motivo: 'abortado' }
  | { ok: false; motivo: 'erro'; detalhe: string };

export function produtoDoCard(produto?: string | null, area?: string | null): 'RMC' | 'RCC' {
  return `${produto ?? ''} ${area ?? ''}`.toUpperCase().includes('RCC') ? 'RCC' : 'RMC';
}

export async function montarInicialCompleta(
  caseId: string,
  produto: 'RMC' | 'RCC',
  opts: {
    signal?: AbortSignal;
    temCalculo?: boolean;
    /** Segue mesmo com o cálculo NEGATIVO (sem indébito) — exige decisão humana. */
    permitirNegativo?: boolean;
    onEtapa?: (e: string) => void;
  } = {},
): Promise<ResultadoMontagem> {
  const { signal, onEtapa } = opts;
  const abortou = () => !!signal?.aborted;
  let avisoDoCalculo: string | null = null;
  try {
    // 🚨 O CÁLCULO ESCOLHE O PEDIDO. O sinal da restituição decide a base:
    // positivo é cartão QUITADO e pede o indébito EM DOBRO; zero ou negativo é
    // EM ABERTO. Sem cálculo o gerador lê restituição 0 e conclui "em aberto"
    // por FALTA DE DADO, não por medição — e o dobro some do pedido de um
    // cliente quitado sem que nada na peça pronta denuncie a troca.
    if (!opts.temCalculo) {
      onEtapa?.('Calculando…');
      const r = await legalCasesService
        .calcularAutomatico(caseId, produto, signal)
        .catch((e: any) => ({ ok: false as const, motivo: e?.response?.data?.message || 'erro ao calcular' }));

      if (!r.ok) {
        // 🚨 A PASTA VAI ASSIM MESMO. Recusar a montagem e não deixar nada no
        // Drive obriga o advogado a criar a pasta à mão para arquivar o que
        // falta — e foi o que aconteceu com os dois cards de APOSENTADORIA da
        // MARIA CLIRENE em 24/09/2026: sem HISCON, sem pasta, sem onde pôr o
        // HISCON. Organizar aqui cria a estrutura do benefício e o
        // `01. PETIÇÃO INICIAL`, então o documento que falta tem endereço.
        onEtapa?.('Preparando a pasta…');
        const pastaCriada = await legalCasesService
          .organizarPastaInicial(caseId)
          .then(() => true)
          .catch(() => false);
        return { ok: false, motivo: 'sem-calculo', detalhe: (r as any).motivo ?? '', pastaCriada };
      }

      // 🚨 NEGATIVO NÃO É PENDÊNCIA: É A RESPOSTA. Regra do escritório, repetida
      // em 25/09/2026: não havendo restituição, a ação é de CONVERSÃO + DANO
      // MORAL, no modelo "em aberto" — que é exatamente o que o sinal do saldo
      // já manda o gerador escolher. Eu vinha RECUSANDO a montagem nesse caso e
      // devolvendo a decisão ao advogado; era erro meu, e parava peça que devia
      // sair. O que o negativo exige é AVISO, não freio: o card diz em que
      // modelo a peça saiu, para ninguém supor que há dobro no pedido.
      const total = Number((r as any).total);
      avisoDoCalculo =
        Number.isFinite(total) && total <= 0
          ? `cálculo ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — ` +
            'sem indébito a restituir: a peça saiu no modelo EM ABERTO, com conversão e dano moral, sem dobro.'
          : null;
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
    return { ok: true, ...(avisoDoCalculo ? { aviso: avisoDoCalculo } : {}) };
  } catch (e: any) {
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || abortou()) {
      return { ok: false, motivo: 'abortado' };
    }
    return { ok: false, motivo: 'erro', detalhe: e?.response?.data?.message || 'Não consegui completar a montagem.' };
  }
}

/** Texto do aviso quando a montagem foi RECUSADA — some da tela só no clique. */
export function porqueNaoMontou(nome: string, r: ResultadoMontagem): string | null {
  if (r.ok) return null;
  if (r.motivo === 'sem-calculo') {
    // 🚨 NEM TODO "SEM CÁLCULO" É FALTA DE HISCON. Em 25/09/2026 o BACEN
    // devolveu 502 na série da taxa e o card mandou o advogado "arquivar o
    // HISCON" — documento que estava lá, e providência que não resolveria
    // nada. Conselho errado é pior que conselho nenhum: manda trabalhar à toa
    // e esconde a causa real.
    const d = r.detalhe || 'sem HISCON para calcular';
    const bacenFora = /SGS|BACEN|25468/i.test(d);
    const ehDoHiscon = /HISCON/i.test(d);
    const causa = bacenFora
      ? 'o BACEN não respondeu a série da taxa de conversão (SGS 25468). Isso é fora do hub — tente de novo em alguns minutos'
      : d;
    const oQueFazer = ehDoHiscon
      ? (r.pastaCriada
          ? ' A pasta do réu foi criada: arquive o HISCON lá e clique de novo.'
          : ' Arquive o HISCON na pasta do cliente.')
      : '';
    return `${nome}: não montei — ${causa}.${oQueFazer}` +
      ' Sem cálculo a peça sairia "em aberto" e o dobro sumiria do pedido.';
  }

  if (r.motivo === 'erro') return `${nome}: ${r.detalhe}`;
  return null;
}
