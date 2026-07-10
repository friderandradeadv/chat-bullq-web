// Motor do PLANO DE REPACTUAÇÃO (superendividamento, CDC art. 104-A/B).
// Réplica do método do curso TABM (PLANO.docx): o consumidor deposita um valor
// mensal fixo (o limite pleiteado = 35% da renda líquida, preservando o mínimo
// existencial) e esse valor é distribuído entre os credores PROPORCIONALMENTE ao
// peso de cada dívida. À medida que uma dívida é quitada, o percentual é
// READEQUADO entre as remanescentes (as "fases" do plano). Sem juros — a
// repactuação paga o principal/valor repactuado. Teto legal: 5 anos (60 meses).
//
// IMPORTANTE: o `valor` de cada credor é o valor A REPACTUAR (após a análise
// jurídica — abatimento do que já foi pago e garantia do principal, art. 104-B
// §4º / 54-D §único). Essa redução é decisão do advogado; aqui só simulamos o
// pagamento do valor informado. Estimativa para montar a proposta.

export interface Credor { nome: string; valor: number; parcela?: number }
export interface ParcelaCredor { nome: string; valor: number; parcelaInicial: number; meses: number; quitado: boolean }
export interface PlanoResultado {
  disponivelMensal: number;
  totalRepactuar: number;
  mesesTotais: number;
  dentroDoTeto: boolean;   // ≤ 60 meses
  credores: ParcelaCredor[];
  fases: number;           // nº de readequações (uma dívida quitada = nova fase)
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const CENTAVO = 0.01;

/**
 * Simula mês a mês: distribui o `disponivelMensal` entre as dívidas ativas
 * proporcionalmente ao seu peso (valor original), realocando a sobra de quem
 * quitaria no mês. Retorna a parcela inicial de cada um, os meses até quitar e
 * o total de meses. Cap de segurança em 240 meses.
 */
export function calcularPlano(input: { rendaLiquida: number; comprometimentoPct: number; credores: Credor[] }): PlanoResultado {
  const disponivel = r2(Math.max(0, input.rendaLiquida) * Math.max(0, input.comprometimentoPct));
  // Peso da distribuição = parcela mensal ATUAL (método Andressa) quando informada;
  // senão, o próprio valor a repactuar. É o que define a % de cada credor.
  const base = input.credores.filter((c) => (c.valor || 0) > 0).map((c) => ({ nome: c.nome || 'Credor', valor: r2(c.valor), saldo: r2(c.valor), peso: r2((c.parcela && c.parcela > 0) ? c.parcela : c.valor) }));
  const totalRepactuar = r2(base.reduce((s, c) => s + c.valor, 0));
  const out: ParcelaCredor[] = base.map((c) => ({ nome: c.nome, valor: c.valor, parcelaInicial: 0, meses: 0, quitado: false }));

  if (disponivel <= 0 || !base.length) {
    return { disponivelMensal: disponivel, totalRepactuar, mesesTotais: 0, dentroDoTeto: totalRepactuar === 0, credores: out, fases: 0 };
  }

  let mes = 0; let fases = 0; let ativosAntes = base.length;
  while (base.some((c) => c.saldo > CENTAVO) && mes < 240) {
    mes++;
    // aloca o orçamento do mês proporcionalmente ao peso, realocando sobras.
    let orcamento = disponivel;
    const alocado = new Map<string, number>();
    let ativos = base.filter((c) => c.saldo > CENTAVO);
    let guard = 0;
    while (orcamento > CENTAVO && ativos.length && guard++ < 50) {
      const somaPesos = ativos.reduce((s, c) => s + c.peso, 0) || 1;
      let sobra = 0;
      const restantes: typeof ativos = [];
      for (const c of ativos) {
        const quota = orcamento * (c.peso / somaPesos);
        const jaAloc = alocado.get(c.nome) ?? 0;
        const podePagar = c.saldo - jaAloc;
        if (quota >= podePagar - CENTAVO) { alocado.set(c.nome, jaAloc + podePagar); sobra += quota - podePagar; }
        else { alocado.set(c.nome, jaAloc + quota); restantes.push(c); }
      }
      orcamento = sobra;
      ativos = restantes;
    }
    for (const c of base) {
      const pg = alocado.get(c.nome) ?? 0;
      if (pg > 0) c.saldo = r2(c.saldo - pg);
      if (mes === 1) { const o = out.find((x) => x.nome === c.nome && x.valor === c.valor); if (o) o.parcelaInicial = r2(pg); }
    }
    // marca meses de quitação
    for (const c of base) {
      if (c.saldo <= CENTAVO) { const o = out.find((x) => x.nome === c.nome && x.valor === c.valor && !x.quitado); if (o) { o.quitado = true; o.meses = mes; } }
    }
    const ativosAgora = base.filter((c) => c.saldo > CENTAVO).length;
    if (ativosAgora < ativosAntes) { fases++; ativosAntes = ativosAgora; }
  }
  for (const o of out) if (!o.quitado) o.meses = mes;

  return {
    disponivelMensal: disponivel,
    totalRepactuar,
    mesesTotais: mes,
    dentroDoTeto: mes <= 60,
    credores: out,
    fases,
  };
}
