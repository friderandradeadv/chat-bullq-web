/**
 * Multa (astreinte) por descumprimento da TUTELA — valoração para o cumprimento
 * de sentença.
 *
 * Regra do escritório: antes de pedir o cumprimento de sentença, confere-se
 * SEMPRE (a) se houve tutela deferida nos autos e (b) se o réu cumpriu. Se não
 * cumpriu, a multa fixada na decisão se executa no MESMO cumprimento, junto com
 * a condenação — CPC 537, § 4º (devida desde o dia do descumprimento e enquanto a decisão não
 * for cumprida) e § 2º (revertida ao exequente).
 *
 * Duas escolhas conservadoras, de propósito (protocolo antiexcesso):
 *  1. O período corre do VENCIMENTO do prazo dado na decisão (data + prazoDias),
 *     nunca da data da decisão em si. Se o réu foi intimado depois, informe a
 *     data da intimação em `dataInicioCumprimento` — o prazo corre dela.
 *  2. A multa NÃO recebe juros de mora: ela já pune dia a dia o mesmo atraso.
 *     Cumular juros sobre o período seria contar duas vezes. Correção monetária,
 *     sim — e só a partir do FIM do período (a data do débito gerado), o que
 *     também corrige para menos.
 */

export type MultaTipo = 'diaria' | 'fixa';

export interface AstreinteInput {
  /** a tutela foi deferida? sem tutela deferida não há multa a executar */
  deferida: boolean;
  /** o réu cumpriu a obrigação? */
  cumprida: boolean;
  /** data da decisão que deferiu a tutela — 'YYYY-MM-DD' */
  data?: string;
  /** data da intimação do réu, se conhecida (o prazo corre dela) */
  dataInicioCumprimento?: string;
  /** prazo em dias dado ao réu (0 = imediato) */
  prazoDias?: number;
  /** cominação: multa diária ou multa fixa por descumprimento */
  multaTipo?: MultaTipo;
  /** valor da multa (por dia, se diária) */
  multaValor?: number;
  /** teto/limite fixado na decisão (0 ou undefined = sem teto) */
  multaTeto?: number;
  /** data em que o réu cumpriu (cessou o desconto / baixou a reserva) */
  dataCumprimento?: string;
  /** data-base do cálculo — fim do período quando o descumprimento persiste */
  termoFinal: string;
  /** valor da multa já liquidado por decisão judicial (vence o cálculo) */
  multaLiquidada?: number;
}

export interface AstreinteResultado {
  /** valor da multa a executar */
  valor: number;
  /** dias de descumprimento contados */
  dias: number;
  /** início do período (vencimento do prazo) — 'YYYY-MM-DD' */
  inicio: string;
  /** fim do período — 'YYYY-MM-DD' */
  fim: string;
  /** o descumprimento continua na data-base (multa ainda correndo) */
  emCurso: boolean;
  /** o teto fixado na decisão limitou o valor */
  limitadaPeloTeto: boolean;
  /** o valor veio de decisão que já liquidou a multa */
  liquidadaPorDecisao: boolean;
  /** descrição pronta para a linha de débito / quadro de valores */
  descricao: string;
}

const DIA_MS = 86_400_000;

function diasEntre(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / DIA_MS);
}

function somaDias(iso: string, n: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (isNaN(t)) return iso;
  return new Date(t + n * DIA_MS).toISOString().slice(0, 10);
}

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const round2 = (x: number) => Math.round((x + 1e-9) * 100) / 100;

/**
 * Valora a multa por descumprimento da tutela. Devolve `null` quando não há
 * multa a executar: tutela não deferida, réu cumpriu no prazo, decisão sem
 * cominação de multa, ou dados insuficientes para contar o período.
 */
export function calcularAstreinte(inp: AstreinteInput): AstreinteResultado | null {
  if (!inp.deferida) return null;

  // Decisão que já liquidou a multa: o valor fixado vence qualquer recontagem.
  if (inp.multaLiquidada != null && inp.multaLiquidada > 0) {
    const fim = inp.dataCumprimento || inp.termoFinal;
    return {
      valor: round2(inp.multaLiquidada),
      dias: 0,
      inicio: inp.dataInicioCumprimento || inp.data || fim,
      fim,
      emCurso: false,
      limitadaPeloTeto: false,
      liquidadaPorDecisao: true,
      descricao: `Multa por descumprimento da tutela — valor liquidado em decisão judicial (CPC 537, § 3º)`,
    };
  }

  const valorMulta = inp.multaValor ?? 0;
  if (!inp.multaTipo || valorMulta <= 0) return null;

  const base = inp.dataInicioCumprimento || inp.data;
  if (!base) return null;
  const inicio = somaDias(base, Math.max(0, inp.prazoDias ?? 0));

  const fim = inp.cumprida && inp.dataCumprimento ? inp.dataCumprimento : inp.termoFinal;
  // Cumpriu dentro do prazo (ou antes dele) → nada a executar.
  const dias = diasEntre(inicio, fim);
  if (dias <= 0) return null;
  // Cumprimento marcado como "sim" sem data: não há como medir atraso → nada.
  if (inp.cumprida && !inp.dataCumprimento) return null;

  const emCurso = !inp.cumprida;
  const bruto = inp.multaTipo === 'diaria' ? valorMulta * dias : valorMulta;
  const teto = inp.multaTeto && inp.multaTeto > 0 ? inp.multaTeto : null;
  const limitadaPeloTeto = teto != null && bruto > teto;
  const valor = round2(limitadaPeloTeto ? teto! : bruto);

  const descricao =
    inp.multaTipo === 'diaria'
      ? `Multa por descumprimento da tutela — ${dias} dia(s) × ${brl(valorMulta)} ` +
        `(${dataBr(inicio)} a ${dataBr(fim)})${limitadaPeloTeto ? `, limitada ao teto de ${brl(teto!)}` : ''}` +
        `${emCurso ? ' — descumprimento em curso' : ''}`
      : `Multa fixa por descumprimento da tutela — ${brl(valorMulta)} ` +
        `(descumprida em ${dataBr(inicio)})`;

  return {
    valor,
    dias,
    inicio,
    fim,
    emCurso,
    limitadaPeloTeto,
    liquidadaPorDecisao: false,
    descricao,
  };
}

/**
 * A multa vira uma linha de débito do cálculo. `incideJuros: false` pelo motivo
 * explicado no topo do arquivo; a data é o FIM do período (correção só dali).
 */
export function astreinteComoDebito(r: AstreinteResultado): {
  tipo: string;
  descricao: string;
  data: string;
  valor: number;
  incideJuros: boolean;
} {
  return {
    tipo: 'astreinte',
    descricao: r.descricao,
    data: r.fim,
    valor: r.valor,
    incideJuros: false,
  };
}
