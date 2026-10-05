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
  | { ok: true; aviso?: string; org?: { pastaBanco?: string } | null }
  | { ok: false; motivo: 'jg-incompleto'; faltas: string[] }
  | { ok: false; motivo: 'documento-curto'; detalhe: string }
  | { ok: false; motivo: 'sem-calculo'; detalhe: string; pastaCriada: boolean }
  | { ok: false; motivo: 'abortado' }
  | { ok: false; motivo: 'erro'; detalhe: string };

export function produtoDoCard(produto?: string | null, area?: string | null): 'RMC' | 'RCC' {
  return `${produto ?? ''} ${area ?? ''}`.toUpperCase().includes('RCC') ? 'RCC' : 'RMC';
}

/**
 * A TESE do card, pela etiqueta — a mesma regra do `inicial/teses.ts` da API.
 *
 * 🚨 Olha TODAS as etiquetas e testa churning ANTES de RMC/RCC, porque o cliente
 * de churning quase sempre é cliente de RMC e o card carrega as duas palavras em
 * campos diferentes (`produto` = "RMC", `area` = "Churning"). `produtoDoCard`
 * acima devolve só 'RMC'|'RCC' e por isso NÃO serve para esta decisão.
 */
/**
 * AS INICIAIS QUE ESTE CARD PODE MONTAR — espelho de `montaveisDoCard` da API.
 *
 * 🚨 Uma de cada vez, nunca em lote: cada tese é uma AÇÃO, com réu, pasta e
 * petição próprios. É a mesma razão pela qual o card "RMC | RCC" sempre rendeu
 * duas pastas, e não uma.
 */
export type Montavel = { tese: 'rmc' | 'churning'; rotulo: string; produto?: 'RMC' | 'RCC' };

/**
 * TODAS as iniciais que o escritório sabe montar hoje.
 *
 * 🚨 O seletor mostra TODAS, sempre — não só as que a etiqueta do card oferece.
 * Primeira versão escondia o seletor quando havia uma tese só, e o advogado não
 * o viu no card do JOSÉ BATISTA (etiquetado só "Churning"): *"não vi o seletor
 * de inicial"*. Esconder a escolha para poupar um clique tirou dele a resposta
 * para "o que este botão vai montar?", que é a pergunta que o seletor existe
 * para responder.
 *
 * As que a etiqueta oferece vêm destacadas; as outras seguem clicáveis, porque
 * a escolha explícita vence a etiqueta na API (`?tese=`).
 */
export const TODAS_AS_INICIAIS: Montavel[] = [
  { tese: 'rmc', rotulo: 'RMC', produto: 'RMC' },
  { tese: 'rmc', rotulo: 'RCC', produto: 'RCC' },
  { tese: 'churning', rotulo: 'Churning' },
];

export function montaveisDoCard(produto?: string | null, area?: string | null): Montavel[] {
  const t = `${produto ?? ''} ${area ?? ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const out: Montavel[] = [];
  if (/CHURNING|RECICLAGEM/.test(t)) out.push({ tese: 'churning', rotulo: 'Churning' });
  if (/\bRMC\b|RESERVA DE MARGEM/.test(t)) out.push({ tese: 'rmc', rotulo: 'RMC', produto: 'RMC' });
  if (/\bRCC\b|CARTAO DE CREDITO CONSIGNADO|CARTAO CONSIGNADO/.test(t)) {
    out.push({ tese: 'rmc', rotulo: 'RCC', produto: 'RCC' });
  }
  return out.length ? out : [{ tese: 'rmc', rotulo: 'RMC', produto: 'RMC' }];
}

export function teseDoCard(produto?: string | null, area?: string | null): 'rmc' | 'churning' {
  const t = `${produto ?? ''} ${area ?? ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return /CHURNING|RECICLAGEM/.test(t) ? 'churning' : 'rmc';
}

export async function montarInicialCompleta(
  caseId: string,
  produto: 'RMC' | 'RCC',
  opts: {
    signal?: AbortSignal;
    /** Segue mesmo com o cálculo NEGATIVO (sem indébito) — exige decisão humana. */
    permitirNegativo?: boolean;
    onEtapa?: (e: string) => void;
    /**
     * Chamado com o resultado do cálculo que deu certo.
     *
     * 🚨 EXISTE PARA A UNIFICAÇÃO NÃO EMPOBRECER A FICHA (30/09/2026). Havia
     * DOIS fluxos de montagem — este e um embutido no `case-detail-drawer` — e
     * o da ficha mostrava um toast detalhado do cálculo (total, cenário,
     * contratos somados, competências, taxa do BACEN) que este não tinha.
     * Unificar sem o gancho apagaria essa informação da tela.
     */
    onCalculo?: (r: any) => void;
    /**
     * Substitui o passo da pasta. A ficha chama um envoltório que colhe os
     * avisos do que saiu da raiz do cliente e do que foi para o arquivo dele —
     * o serviço cru perde isso. Devolve o resultado para o toast final.
     */
    organizarPasta?: () => Promise<{ pastaBanco?: string } | null | undefined>;
    /**
     * As etiquetas do card (`produto` e `area`), para decidir a TESE.
     *
     * 🚨 Sem isto o botão mestre trava num card de churning. O primeiro passo é
     * o cálculo de restituição de RMC/RCC, e quando ele falha a montagem PARA
     * com "sem cálculo", sem nunca chegar na peça. A ação de churning não tem
     * esse cálculo: o valor da causa não sai dele. Omitir mantém o
     * comportamento de sempre (RMC).
     */
    etiquetas?: { produto?: string | null; area?: string | null } | null;
    /**
     * A TESE escolhida no seletor do card. Quando vem, vence a etiqueta — tanto
     * aqui (pular o cálculo) quanto na API (qual base montar). É instrução
     * humana, e instrução humana ganha de dedução.
     */
    tese?: 'rmc' | 'churning';
  } = {},
): Promise<ResultadoMontagem> {
  const { signal, onEtapa, onCalculo, organizarPasta } = opts;
  const tese = opts.tese ?? teseDoCard(opts.etiquetas?.produto, opts.etiquetas?.area);
  const abortou = () => !!signal?.aborted;
  // 🚨 O TOAST SABIA E O CARD NÃO (30/09/2026). Os primeiros passos da montagem
  // rodam AQUI, no navegador — cálculo, preparo dos documentos, preparo da
  // pasta — e só depois a API entra com `gerarInicial`, que era a única a
  // narrar. Quem clicava via o toast trabalhando e o card imóvel: "não funciona
  // quando eu seleciono entendeu? Quero que apareça no card."
  //
  // `etapa` passa a fazer as duas coisas. Sem número de passo de propósito: o
  // caminho tem desvios (documento faltando devolve o card para a fase dos
  // documentos), então numerar seria inventar um total que não se cumpre.
  const etapa = (texto: string) => {
    onEtapa?.(texto);
    legalCasesService.narrarProgresso(caseId, texto);
  };
  let avisoDoCalculo: string | null = null;
  try {
    // 🚨 O CÁLCULO ESCOLHE O PEDIDO. O sinal da restituição decide a base:
    // positivo é cartão QUITADO e pede o indébito EM DOBRO; zero ou negativo é
    // EM ABERTO. Sem cálculo o gerador lê restituição 0 e conclui "em aberto"
    // por FALTA DE DADO, não por medição — e o dobro some do pedido de um
    // cliente quitado sem que nada na peça pronta denuncie a troca.
    // 🚨 A MONTAGEM CALCULA SEMPRE. Determinação do escritório em 28/09/2026:
    // *"ao clicar para montar inicial, o cálculo deve puxar tanto do hiscre
    // quanto do hiscon — hiscon lê o contrato, o banco, o início do desconto; o
    // hiscre pega os descontos de fato, mês a mês"*. Antes a montagem PULAVA o
    // cálculo quando já havia um salvo, e cálculo salvo envelhece: o do
    // DAYCOVAL valia −R$ 1.241,85, tirado de UMA competência do HISCON num
    // contrato de 2015 que migrou de banco três vezes.
    //
    // Quem decide se refaz é o SERVIDOR (`calcularEGravar`), porque a montagem
    // em lote não conhece o metadata do card: cálculo digitado na calculadora
    // fica como está; do hub, refaz-se.
    // 🚨 CHURNING NÃO PASSA PELO CÁLCULO. A ação de churning não apura
    // restituição de RMC/RCC: o valor da causa sai da cadeia, que o advogado
    // fecha na peça. Rodar o cálculo aqui ou FALHARIA (parando a montagem
    // inteira em "sem cálculo", antes mesmo de gerar a peça) ou, pior,
    // SUCEDERIA e anexaria à ação de churning um "09. CALCULO" de RMC — prova
    // de outra tese dentro do pacote de protocolo.
    if (tese === 'churning') {
      etapa('Churning: sem cálculo de restituição, a tese é a cadeia.');
    } else {
      etapa('Calculando…');
      const r = await legalCasesService
        .calcularAutomatico(caseId, produto, signal)
        .catch((e: any) => ({ ok: false as const, motivo: e?.response?.data?.message || 'erro ao calcular' }));

      // Extrato truncado tem tratamento próprio: o card volta para a fase dos
      // documentos, porque o que falta é COLETA, não cálculo.
      if (!r.ok && /HISCRE cobre s[óo]|Recolete o HISCRE/i.test(String((r as any).motivo ?? ''))) {
        etapa('Preparando a pasta…');
        await legalCasesService.organizarPastaInicial(caseId).catch(() => undefined);
        await legalCasesService.movePhase(caseId, 'info_faltantes').catch(() => undefined);
        return { ok: false, motivo: 'documento-curto', detalhe: String((r as any).motivo) };
      }
      if (!r.ok) {
        // 🚨 A PASTA VAI ASSIM MESMO. Recusar a montagem e não deixar nada no
        // Drive obriga o advogado a criar a pasta à mão para arquivar o que
        // falta — e foi o que aconteceu com os dois cards de APOSENTADORIA da
        // MARIA CLIRENE em 24/09/2026: sem HISCON, sem pasta, sem onde pôr o
        // HISCON. Organizar aqui cria a estrutura do benefício e o
        // `01. PETIÇÃO INICIAL`, então o documento que falta tem endereço.
        etapa('Preparando a pasta…');
        const pastaCriada = await legalCasesService
          .organizarPastaInicial(caseId)
          .then(() => true)
          .catch(() => false);
        return { ok: false, motivo: 'sem-calculo', detalhe: (r as any).motivo ?? '', pastaCriada };
      }

      // O cálculo deu certo: quem chamou pode detalhá-lo na tela.
      onCalculo?.(r);

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
    etapa('Preparando os documentos…');
    // 🚨 O PREPARO FALA, E NINGUÉM ESCUTAVA. Esta linha era
    // `...prepararDocumentosDaInicial(...).catch(() => undefined)`: o retorno
    // — que traz os AVISOS, inclusive "não achei o IR" e "não achei o print do
    // Portal MIR" — era descartado, e o erro, engolido. Resultado medido em
    // 25/09/2026: de 4 clientes que passaram pela esteira, 3 tiveram o JG
    // montado SEM o informe de IR e SEM o print, e as peças chegaram a
    // "Revisão inicial" como se estivessem completas.
    const preparo = await legalCasesService
      .prepararDocumentosDaInicial(caseId, false, signal)
      .catch((e: any) => ({ avisos: [e?.response?.data?.message ?? 'não consegui preparar os documentos'] } as any));
    if (abortou()) return { ok: false, motivo: 'abortado' };

    // 🚨 JG SEM O IR E SEM O PRINT NÃO PROVA HIPOSSUFICIÊNCIA. O JG do escritório
    // é um PDF composto de TRÊS peças (HISCRE grifado + informe de rendimentos +
    // print do Portal MIR). Faltando peça, a gratuidade se defende com metade da
    // prova — e é justamente pelo bruto que ela costuma ser indeferida. Então
    // aqui a montagem PARA, como já parava sem cálculo: a pasta fica pronta, o
    // card não anda, e o aviso diz o que coletar.
    const faltas = (preparo?.avisos ?? []).filter((a: string) =>
      /Portal MIR|IR do INSS|informe/i.test(a));
    if (faltas.length) {
      etapa('Preparando a pasta…');
      await legalCasesService.organizarPastaInicial(caseId).catch(() => undefined);
      // 🚨 QUEM PRECISA DE DOCUMENTO VOLTA PARA "INFORMAÇÕES FALTANTES".
      // Determinação do escritório em 28/09/2026: o card tem de ficar na fase
      // que diz o que falta fazer nele. Parado em "montar inicial" com documento
      // faltando, ele parece pronto — e alguém clica de novo achando que foi
      // azar. Na fase de documentos, o bloco de coleta reaparece, que é
      // justamente a ferramenta de que ele precisa.
      await legalCasesService.movePhase(caseId, 'info_faltantes').catch(() => undefined);
      return { ok: false, motivo: 'jg-incompleto', faltas };
    }

    etapa('Gerando a inicial…');
    await legalCasesService.gerarInicial(caseId, produto, signal, tese);
    if (abortou()) return { ok: false, motivo: 'abortado' };

    // A pasta falhar não desfaz a peça: ela já está anexada ao card.
    onEtapa?.('Organizando a pasta…');
    const org = organizarPasta
      ? await organizarPasta().catch(() => null)
      : await legalCasesService.organizarPastaInicial(caseId).catch(() => null);
    if (abortou()) return { ok: false, motivo: 'abortado' };

    onEtapa?.('Movendo para revisão…');
    await legalCasesService.movePhase(caseId, 'revisao_inicial');
    return { ok: true, org: (org as any) ?? null, ...(avisoDoCalculo ? { aviso: avisoDoCalculo } : {}) };
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

  if (r.motivo === 'documento-curto') {
    return `${nome}: não montei — ${r.detalhe} Movi o card para "Informações faltantes": ` +
      'colete de novo pelo bloco "Coleta no Meu INSS" e mande montar outra vez.';
  }
  if (r.motivo === 'jg-incompleto') {
    return `${nome}: não montei — o JG sairia incompleto. ${r.faltas.join(' ')} ` +
      'O JG é um PDF composto de três peças (HISCRE grifado + informe de rendimentos + print do ' +
      'Portal MIR), e sem elas a gratuidade se defende com metade da prova. Movi o card para ' +
      '"Informações faltantes": colete o que falta pelo bloco "Coleta no Meu INSS" e mande ' +
      'montar de novo — a pasta já está pronta.';
  }
  if (r.motivo === 'erro') return `${nome}: ${r.detalhe}`;
  return null;
}
