import type { ResultadoRevisional } from './services/calculadora-revisional.service';

/** Parcela fixa (Price) de um principal a uma taxa mensal (fração). */
export function price(pv: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i <= 0) return pv / n;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

export interface ProveitoDaTese {
  principal: number;
  /** quanto a parcela cai se essa rubrica sair do financiamento */
  reducao: number;
  restituicaoSimples: number;
  restituicaoDobro: number;
  economiaFutura: number;
  /** o que o cliente efetivamente recebe por essa tese */
  proveito: number;
}

/**
 * 🚨 O VALOR DE UMA TESE NÃO É O VALOR DA RUBRICA. Tirar R$ 668 do principal não
 * devolve R$ 668: devolve a REDUÇÃO DA PARCELA vezes o prazo — e essa redução já
 * carrega o juro que incidiu sobre a rubrica durante todo o contrato. É por isso
 * que o juro embutido nos encargos não entra como linha somável à parte: somá-lo
 * contaria o mesmo dinheiro duas vezes.
 */
export function porTese(res: ResultadoRevisional, principal: number): ProveitoDaTese {
  const cfg = res.config;
  const i = res.taxas.contratoMensalPct / 100;
  const n = cfg.numeroParcelas;
  const pagas = Math.min(cfg.parcelasPagas, n);
  const vincendas = Math.max(0, n - pagas);
  const reducao = Math.max(0, cfg.valorParcela - price(Math.max(0, cfg.valorLiberado - principal), i, n));
  const restituicaoSimples = reducao * pagas;
  const restituicaoDobro = restituicaoSimples * 2;
  const economiaFutura = reducao * vincendas;
  const base = cfg.dobro ? restituicaoDobro : restituicaoSimples;
  return { principal, reducao, restituicaoSimples, restituicaoDobro, economiaFutura, proveito: base + economiaFutura };
}

/** "R$ 1.234,56" → 1234.56 */
export function brlNum(v: string): number {
  return Number(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

export interface ProveitoTotal {
  principalIndevido: number;
  parcelaAtual: number;
  parcelaNova: number;
  reducao: number;
  restituicao: number;
  economiaFutura: number;
  proveito: number;
  pagas: number;
  vincendas: number;
}

/**
 * O PACOTE INTEIRO: tira do principal tudo o que é irregular e, se os juros
 * forem abusivos, recalcula também pela taxa de referência.
 *
 * 🚨 A PARCELA NOVA NÃO SAI DO `res.resumo`. Aquele número é só da tese de
 * juros: num contrato ABAIXO da média do BACEN ele é MAIOR que a parcela
 * cobrada, e a apresentação chegou a mostrar "sua parcela: de R$ 1.656 para
 * R$ 1.663" como se fosse benefício. A parcela nova é a do principal limpo.
 */
export function proveitoTotal(res: ResultadoRevisional, principalIndevido: number): ProveitoTotal {
  const cfg = res.config;
  const n = cfg.numeroParcelas;
  const pagas = Math.min(cfg.parcelasPagas, n);
  const vincendas = Math.max(0, n - pagas);
  const taxa = (res.taxas.abusivo ? res.taxas.referenciaMensalPct : res.taxas.contratoMensalPct) / 100;
  const parcelaNova = price(Math.max(0, cfg.valorLiberado - principalIndevido), taxa, n);
  const reducao = Math.max(0, cfg.valorParcela - parcelaNova);
  const restituicaoSimples = reducao * pagas;
  const restituicao = cfg.dobro ? restituicaoSimples * 2 : restituicaoSimples;
  const economiaFutura = reducao * vincendas;
  return {
    principalIndevido,
    parcelaAtual: cfg.valorParcela,
    parcelaNova: cfg.valorParcela - reducao,
    reducao,
    restituicao,
    economiaFutura,
    proveito: restituicao + economiaFutura,
    pagas,
    vincendas,
  };
}
