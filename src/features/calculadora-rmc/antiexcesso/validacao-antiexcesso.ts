/**
 * Validação antiexcesso do cumprimento de sentença RMC/RCC — FONTE ÚNICA das
 * regras C1–C11. Framework-free e SEM IMPORTS: este arquivo é o canônico
 * (chat-bullq-api) e é copiado, byte a byte, para o web
 * (chat-bullq-web/src/features/calculadora-rmc/antiexcesso/validacao-antiexcesso.ts)
 * por `scripts/sync-antiexcesso.sh`. Um teste exige os dois idênticos, para que
 * as regras nunca existam em duas versões divergentes.
 *
 * POR QUE ESTE MÓDULO EXISTE
 * --------------------------
 * Autos 0801287-29.2024.8.20.5130 (MAGNUS): a memória de cálculo lançou DOZE
 * descontos onde havia prova de NOVE, cinco deles em 2020 numa relação iniciada
 * em 01/07/2022. A aritmética estava impecável — os doze fatores INPC batiam na
 * sexta casa decimal — e o valor mesmo assim estava errado em R$ 2.549,39. O
 * defeito não estava na conta, estava no INSUMO. Este módulo torna impossível
 * emitir relatório sobre competência que não pode existir.
 *
 * NÃO existe flag de "ignorar validação". Erro de C2 (competência anterior ao
 * contrato) se corrige relendo o extrato do órgão pagador, nunca editando o
 * insumo para calar o validador.
 */

export type Severidade = 'erro' | 'aviso';
export type CodigoOcorrencia =
  | 'C0'
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'C5'
  | 'C6'
  | 'C7'
  | 'C8'
  | 'C9'
  | 'C10'
  | 'C11';

export interface Ocorrencia {
  codigo: CodigoOcorrencia;
  severidade: Severidade;
  mensagem: string;
  /** caminho do campo culpado — ex.: 'descontos[2].competencia', 'honorarios.base' */
  campo?: string;
}

/** Uma competência de desconto lida no extrato do órgão pagador. */
export interface DescontoAntiexcesso {
  /** competência do desconto, AAAA-MM */
  competencia: string;
  valor: number;
  /** id do documento nos autos + página. Obrigatório (C1). */
  fonte?: string;
}

export interface HonorariosAntiexcesso {
  percentual: number;
  /** base declarada explicitamente — LEIA O DISPOSITIVO (C7) */
  base?: 'causa_atualizada' | 'causa_nominal' | 'condenacao';
  valorCausa?: number;
  /** termo inicial da correção do valor da causa, AAAA-MM */
  termoCorrecaoCausa?: string;
}

export interface CompensacaoAntiexcesso {
  valor: number;
  /** atualizar a compensação? Só com previsão expressa no título (C8). */
  atualizar?: boolean;
  justificativaTitulo?: string;
  /** disponibilização da compensação, AAAA-MM-DD (para a simulação C11) */
  dataDisponibilizacao?: string;
}

export interface CalculoAntiexcesso {
  cliente?: string;
  processo?: string;
  /** datas AAAA-MM-DD */
  contrato: string;
  citacao: string;
  sentenca: string;
  eventoDanoso: string;
  dataBase: string;
  descontos: DescontoAntiexcesso[];
  dobro?: boolean;
  jurosMes?: number;
  danoMoral?: number;
  honorarios?: HonorariosAntiexcesso;
  compensacao?: CompensacaoAntiexcesso;
  /** multa/honorários do art. 523, §1º somados ao total? (C6) */
  incluiMulta523?: boolean;
}

// ─────────────────────────────────────────────────────────── utilidades de mês
function distMeses(ymA: string, ymB: string): number {
  const [aA, mA] = ymA.split('-').map(Number);
  const [aB, mB] = ymB.split('-').map(Number);
  return (aB - aA) * 12 + (mB - mA);
}

function ymSeguinte(ym: string): string {
  let [a, m] = ym.split('-').map(Number);
  m += 1;
  if (m === 13) {
    a += 1;
    m = 1;
  }
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

function ehDataISO(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ehCompetencia(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

/**
 * As travas C1–C10. Cada uma nasceu de um ponto que a defesa explorou.
 *
 * @param calc  o insumo do cálculo
 * @param mesesIndiceDisponivel  conjunto de meses AAAA-MM com índice publicado
 *   (para C10). No servidor vem do IndicesService/BACEN; no navegador, da mesma
 *   série. Se omitido, C10 não roda (a autoridade final é o servidor).
 *
 * A simulação C11 (ótica do executado) NÃO está aqui: ela exige apurar o total
 * duas vezes e é adicionada por quem tem o motor de cálculo à mão
 * (ver simularExecutado no cumprimento-engine).
 */
export function validar(
  calc: CalculoAntiexcesso,
  mesesIndiceDisponivel?: ReadonlySet<string>,
): Ocorrencia[] {
  const ocs: Ocorrencia[] = [];
  const erro = (codigo: CodigoOcorrencia, mensagem: string, campo?: string) =>
    ocs.push({ codigo, severidade: 'erro', mensagem, campo });
  const aviso = (codigo: CodigoOcorrencia, mensagem: string, campo?: string) =>
    ocs.push({ codigo, severidade: 'aviso', mensagem, campo });

  // datas base
  if (!ehDataISO(calc.contrato))
    erro('C1', 'data do contrato ausente ou fora de AAAA-MM-DD.', 'contrato');
  if (!ehDataISO(calc.dataBase))
    erro('C1', 'data-base ausente ou fora de AAAA-MM-DD.', 'dataBase');

  const descontos = calc.descontos ?? [];
  if (descontos.length === 0) {
    erro(
      'C0',
      'nenhuma competência lançada. Sem desconto comprovado não há o que executar.',
      'descontos',
    );
    // segue para checar honorários/compensação/multa mesmo sem descontos
  }

  const ymContrato = ehDataISO(calc.contrato) ? calc.contrato.slice(0, 7) : null;
  const ymDataBase = ehDataISO(calc.dataBase) ? calc.dataBase.slice(0, 7) : null;
  const ultimoIndice =
    mesesIndiceDisponivel && mesesIndiceDisponivel.size
      ? Array.from(mesesIndiceDisponivel).sort().slice(-1)[0]
      : null;

  const vistas = new Map<string, number>(); // competência -> índice (1-based) da 1ª aparição
  descontos.forEach((d, idx) => {
    const rot = `parcela ${idx + 1} (${d.competencia || 'sem competência'})`;
    const campoBase = `descontos[${idx}]`;

    // C1 — prova documental identificada
    if (!String(d.fonte ?? '').trim())
      erro(
        'C1',
        `${rot} sem campo 'fonte'. Desconto só existe com id do documento nos autos e página.`,
        `${campoBase}.fonte`,
      );

    // C1 — formato da competência
    if (!ehCompetencia(d.competencia)) {
      erro('C1', `${rot} com competência fora do formato AAAA-MM.`, `${campoBase}.competencia`);
      return; // sem competência válida, as demais travas não se aplicam a esta linha
    }

    // C2 — a trava do caso MAGNUS: competência anterior ao contrato
    if (ymContrato && distMeses(ymContrato, d.competencia) < 0)
      erro(
        'C2',
        `${rot} é ANTERIOR ao contrato (${ymContrato}). Desconto não pode preceder a relação que o originou: releia o extrato do órgão pagador antes de qualquer conta.`,
        `${campoBase}.competencia`,
      );

    // C3 — competência repetida
    if (vistas.has(d.competencia))
      erro(
        'C3',
        `competência ${d.competencia} lançada duas vezes (parcelas ${vistas.get(d.competencia)} e ${idx + 1}).`,
        `${campoBase}.competencia`,
      );
    else vistas.set(d.competencia, idx + 1);

    // C4 — competência posterior à data-base
    if (ymDataBase && distMeses(d.competencia, ymDataBase) < 0)
      erro(
        'C4',
        `${rot} é posterior à data-base (${calc.dataBase}).`,
        `${campoBase}.competencia`,
      );

    // C10 — índice INPC publicado para TODO o período a corrigir (do mês
    // seguinte ao desconto até o último índice publicado). Varre a cadeia e
    // acusa o primeiro mês faltante — não extrapola.
    if (mesesIndiceDisponivel && ultimoIndice) {
      let mes = ymSeguinte(d.competencia);
      while (distMeses(mes, ultimoIndice) >= 0) {
        if (!mesesIndiceDisponivel.has(mes)) {
          erro(
            'C10',
            `sem índice INPC para ${mes}. Atualize a série antes de calcular — não extrapole.`,
            `${campoBase}.competencia`,
          );
          break;
        }
        mes = ymSeguinte(mes);
      }
    }
  });

  // C5 — buraco na sequência (aviso: interrupção real existe)
  const ordenadas = Array.from(vistas.keys()).sort();
  for (let i = 1; i < ordenadas.length; i++) {
    const salto = distMeses(ordenadas[i - 1], ordenadas[i]);
    if (salto > 1)
      aviso(
        'C5',
        `salto de ${salto - 1} mês(es) entre ${ordenadas[i - 1]} e ${ordenadas[i]}. Se houve interrupção real, guarde a prova; se não, falta competência.`,
        'descontos',
      );
  }

  // C6 — multa e honorários do art. 523, §1º somados ao total
  if (calc.incluiMulta523)
    erro(
      'C6',
      'a multa e os honorários do art. 523, §1º, do CPC estão somados ao total. Eles só nascem com o transcurso in albis: retire do cálculo e ressalve na peça.',
      'incluiMulta523',
    );

  // C7 — base dos honorários declarada explicitamente
  const hon = calc.honorarios;
  if (hon) {
    if (
      hon.base !== 'causa_atualizada' &&
      hon.base !== 'causa_nominal' &&
      hon.base !== 'condenacao'
    )
      erro(
        'C7',
        "base dos honorários ausente ou inválida. Leia o dispositivo: '10% sobre o valor atualizado da causa' não é 'sobre a condenação'. Declare entre causa_atualizada, causa_nominal e condenacao.",
        'honorarios.base',
      );
  }

  // C8 — compensação atualizada só com justificativa de previsão no título
  const comp = calc.compensacao;
  if (comp?.atualizar && !String(comp.justificativaTitulo ?? '').trim())
    erro(
      'C8',
      'compensação marcada para atualizar sem justificativa no título. Título que fixou quantia certa não se corrige (art. 509, §4º, do CPC).',
      'compensacao.atualizar',
    );

  // C9 — data-base não anterior à última competência
  if (ymDataBase && ordenadas.length) {
    const ultimaComp = ordenadas[ordenadas.length - 1];
    if (distMeses(ultimaComp, ymDataBase) < 0)
      erro(
        'C9',
        `data-base (${calc.dataBase}) anterior à última competência (${ultimaComp}).`,
        'dataBase',
      );
  }

  return ocs;
}

/** Há alguma ocorrência de severidade 'erro'? (o servidor recusa a emissão) */
export function temErro(ocs: readonly Ocorrencia[]): boolean {
  return ocs.some((o) => o.severidade === 'erro');
}
