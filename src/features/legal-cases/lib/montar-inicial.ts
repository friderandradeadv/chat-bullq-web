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
  /**
   * `avisos` são os da PEÇA: o que o montador acusou de forma e o que o drafter
   * tirou dela por falta de lastro no HISCON. Chegam do servidor e têm de ser
   * MOSTRADOS: eram a terceira camada do mesmo furo (montador → serviço →
   * front), e o front era a única que ainda engolia (15/10/2026).
   */
  | { ok: true; aviso?: string; avisos?: string[]; org?: any }
  | { ok: false; motivo: 'jg-incompleto'; faltas: string[] }
  | { ok: false; motivo: 'documento-curto'; detalhe: string }
  | { ok: false; motivo: 'sem-calculo'; detalhe: string; pastaCriada: boolean; org?: any }
  /** O produto do card não tem tese de inicial na ferramenta. */
  | { ok: false; motivo: 'sem-tese'; detalhe: string }
  /** O preparo dos documentos não respondeu: não dá para afirmar que o JG está inteiro. */
  | { ok: false; motivo: 'preparo-sem-resposta'; detalhe: string }
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
export type Montavel = { tese: 'rmc' | 'churning' | 'seguro'; rotulo: string; produto?: 'RMC' | 'RCC' };

/**
 * A etiqueta do SEGURO PRESTAMISTA, espelho de `ETIQUETA_SEGURO` da API
 * (`inicial/teses.ts`). "Seguro Social" é o INSS, não o produto.
 */
const ETIQUETA_SEGURO = /SEGURO(?!\s+SOCIAL)|PRESTAMISTA/;

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
  // 21/10/2026: seguro prestamista embutido no empréstimo (lê o CONTRATO).
  { tese: 'seguro', rotulo: 'Seguro' },
];

export function montaveisDoCard(produto?: string | null, area?: string | null): Montavel[] {
  const t = `${produto ?? ''} ${area ?? ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const out: Montavel[] = [];
  if (/CHURNING|RECICLAGEM/.test(t)) out.push({ tese: 'churning', rotulo: 'Churning' });
  if (ETIQUETA_SEGURO.test(t)) out.push({ tese: 'seguro', rotulo: 'Seguro' });
  if (/\bRMC\b|RESERVA DE MARGEM/.test(t)) out.push({ tese: 'rmc', rotulo: 'RMC', produto: 'RMC' });
  if (/\bRCC\b|CARTAO DE CREDITO CONSIGNADO|CARTAO CONSIGNADO/.test(t)) {
    out.push({ tese: 'rmc', rotulo: 'RCC', produto: 'RCC' });
  }
  return out.length ? out : [{ tese: 'rmc', rotulo: 'RMC', produto: 'RMC' }];
}

export function teseDoCard(
  produto?: string | null, area?: string | null,
): 'rmc' | 'churning' | 'seguro' {
  const t = `${produto ?? ''} ${area ?? ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/CHURNING|RECICLAGEM/.test(t)) return 'churning';
  return ETIQUETA_SEGURO.test(t) ? 'seguro' : 'rmc';
}

/**
 * A MONTAGEM INTEIRA, NO SERVIDOR.
 *
 * 🚨 ISTO ERA A ORQUESTRAÇÃO, e ela vivia aqui dentro: cálculo, preparo dos
 * documentos, pasta e fase rodavam NO NAVEGADOR, e só a peça era da API. O
 * próprio arquivo dizia *"os primeiros passos da montagem rodam AQUI"*.
 *
 * Em 13/10/2026 a orquestração foi para `service.montarInicialCompleta`, e esta
 * função virou uma chamada. Enquanto os DOIS caminhos existiram, eles
 * divergiram: as travas novas (portão do JG que recusa preparo mudo, produto
 * sem tese, recusa por conteúdo do modelo) só existiam no servidor, e o mesmo
 * card dava resultado diferente pelo clique e pelo lote.
 *
 * A assinatura ficou igual de propósito: o quadro, o lote do quadro e a ficha
 * continuam chamando do mesmo jeito.
 */
export async function montarInicialCompleta(
  caseId: string,
  produto: 'RMC' | 'RCC',
  opts: {
    signal?: AbortSignal;
    permitirNegativo?: boolean;
    onEtapa?: (e: string) => void;
    onCalculo?: (r: any) => void;
    /**
     * @deprecated O servidor organiza a pasta. Quem quiser mostrar o que foi
     * montado lê `org` do resultado, que traz o payload inteiro.
     */
    organizarPasta?: () => Promise<any>;
    etiquetas?: { produto?: string | null; area?: string | null } | null;
    tese?: 'rmc' | 'churning' | 'seguro';
    /** O fundamento da inicial de RMC: `erro` (padrão) ou `onus`. */
    eixo?: 'erro' | 'onus';
  } = {},
): Promise<ResultadoMontagem> {
  const { signal, onEtapa, onCalculo } = opts;
  const tese = opts.tese ?? teseDoCard(opts.etiquetas?.produto, opts.etiquetas?.area);
  // 🚨 A NARRAÇÃO AGORA VEM DO CARD. O servidor escreve cada passo em
  // `metadata.progresso`, que é o que a barrinha lê; aqui só se diz que
  // começou, porque uma chamada só não tem passos para contar no cliente.
  onEtapa?.('Montando no servidor…');
  try {
    const r = await legalCasesService.montarTudoNoServidor(caseId, { tese, produto, eixo: opts.eixo, signal });
    if (signal?.aborted) return { ok: false, motivo: 'abortado' };
    if (r.calculo) onCalculo?.(r.calculo);
    if (r.ok) return { ok: true, org: r.pasta ?? null, avisos: r.avisos ?? [] };
    const motivo = r.motivo ?? 'erro';
    if (motivo === 'jg-incompleto') return { ok: false, motivo, faltas: r.faltas ?? [] };
    if (motivo === 'sem-calculo') {
      return { ok: false, motivo, detalhe: r.detalhe ?? '', pastaCriada: !!r.pasta, org: r.pasta ?? null };
    }
    if (motivo === 'documento-curto' || motivo === 'sem-tese' || motivo === 'preparo-sem-resposta') {
      return { ok: false, motivo, detalhe: r.detalhe ?? '' } as ResultadoMontagem;
    }
    return { ok: false, motivo: 'erro', detalhe: r.detalhe ?? 'Não consegui completar a montagem.' };
  } catch (e: any) {
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || signal?.aborted) {
      return { ok: false, motivo: 'abortado' };
    }
    return { ok: false, motivo: 'erro', detalhe: e?.response?.data?.message || 'Não consegui completar a montagem.' };
  }
}


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
  if (r.motivo === 'sem-tese') {
    return `${nome}: não montei — ${r.detalhe}. Esta ferramenta monta RMC/RCC e churning; `
      + 'para outro produto a inicial é de outra família.';
  }
  if (r.motivo === 'preparo-sem-resposta') {
    return `${nome}: não montei — ${r.detalhe}. Parei de propósito: lista de avisos vazia não é `
      + 'preparo limpo, e seguir daria uma peça que parece conferida sem ter sido.';
  }
  if (r.motivo === 'erro') return `${nome}: ${r.detalhe}`;
  return null;
}
