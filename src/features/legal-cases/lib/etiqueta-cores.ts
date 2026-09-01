/**
 * CORES DAS ETIQUETAS dos cards — paleta ÚNICA do hub.
 *
 * 🚨 Antes de 01/09/2026 esta função existia COPIADA em SEIS arquivos (Judicial,
 * Pré-Processual, REPB, INSS, AdminBoard e a ficha do card) e as cópias já
 * tinham divergido: o Judicial conhecia Trabalhista, Consumidor, Dano, Voo,
 * Fraude e Monitória; o AdminBoard, não — por isso os cards de Execução e CS
 * apareciam com etiqueta CINZA enquanto os mesmos produtos saíam coloridos no
 * quadro ao lado. Regra que fica: cor de etiqueta se muda AQUI, num lugar só.
 *
 * O que está abaixo é o SUPERCONJUNTO das seis cópias (nenhuma cor se perdeu)
 * mais a família da execução, que não existia em nenhuma delas.
 */
export interface CorEtiqueta { bg: string; fg: string }

const CINZA: CorEtiqueta = { bg: 'rgb(209,209,209)', fg: '#101820' };

/** Cor do PRODUTO (1ª etiqueta: RMC, Contribuições, Execução de Título…). */
export function produtoColor(p: string | null | undefined): CorEtiqueta {
  const s = (p ?? '').toUpperCase();
  // ── previdenciário ──────────────────────────────────────────────────────
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  // ── trabalhista ─────────────────────────────────────────────────────────
  if (/TRABALH|RESCIS|FERIAS|RECLAMA|VERBAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  // ── execução / cobrança (novo — era o que caía no cinza) ────────────────
  // Verifica ANTES de "MONITORIA" cair no bloco de consumidor: monitória que
  // virou execução é dinheiro a cobrar, não relação de consumo.
  if (/EXECU[ÇC][ÃA]O DE T[ÍI]TULO|T[ÍI]TULO EXTRAJUDICIAL|EXECU[ÇC][ÃA]O FISCAL/.test(s)) return { bg: 'rgb(94,53,177)', fg: '#fff' };
  if (/CUMPRIMENTO DE SENTEN|^CS\b|\bCS E\b/.test(s)) return { bg: 'rgb(47,158,68)', fg: '#fff' };
  if (/HONOR[ÁA]RIO/.test(s)) return { bg: 'rgb(0,121,107)', fg: '#fff' };
  if (/MONIT[ÓO]RIA/.test(s)) return { bg: 'rgb(121,85,72)', fg: '#fff' };
  // ── bancário ────────────────────────────────────────────────────────────
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/REPB|REESTRUT|PASSIVO/.test(s)) return { bg: 'rgb(183,121,31)', fg: '#fff' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  // ── cível / consumidor ──────────────────────────────────────────────────
  if (/CONSUMID|DANO|INDENIZ|VOO|FRAUDE|NULID|OBRIGACAO|ANULA|ABUSIV/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/PROCEDIMENTO COMUM|C[ÍI]VEL/.test(s)) return { bg: 'rgb(69,123,157)', fg: '#fff' };
  // Dativo (nomeação do juízo) tem cor própria: não é produto vendido, é
  // trabalho por indicação — e é o caso em que somos a DEFESA.
  if (/DATIVO|CURADOR/.test(s)) return { bg: 'rgb(96,111,123)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA|MATERN/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return CINZA;
}

/**
 * Cor da ÁREA jurídica (2ª etiqueta: Cível, Bancário, Previdenciário…).
 * Era cinza fixo em todos os quadros — duas etiquetas cinzas lado a lado não
 * distinguem nada. Tons DESSATURADOS de propósito: a área é contexto, o produto
 * é o que se lê primeiro, e a cor não pode competir com ele.
 */
export function areaColor(a: string | null | undefined): CorEtiqueta {
  const s = (a ?? '').toUpperCase();
  if (/BANC/.test(s)) return { bg: 'rgb(215,190,190)', fg: '#5c1a1a' };
  if (/PREVID/.test(s)) return { bg: 'rgb(199,219,205)', fg: '#14452a' };
  if (/TRABALH/.test(s)) return { bg: 'rgb(240,219,190)', fg: '#6b3f05' };
  if (/C[ÍI]VEL|CIVIL/.test(s)) return { bg: 'rgb(198,213,232)', fg: '#1c3a5e' };
  if (/CONSUMID/.test(s)) return { bg: 'rgb(198,213,232)', fg: '#1c3a5e' };
  if (/TRIBUT|FISCAL/.test(s)) return { bg: 'rgb(214,205,229)', fg: '#3d2a63' };
  if (/FAM[ÍI]LIA|SUCESS/.test(s)) return { bg: 'rgb(233,206,222)', fg: '#5e2547' };
  if (/EMPRES|SOCIET/.test(s)) return { bg: 'rgb(206,222,222)', fg: '#12484a' };
  if (/CRIMIN|PENAL/.test(s)) return { bg: 'rgb(219,214,209)', fg: '#3c3229' };
  return CINZA;
}
