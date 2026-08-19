/**
 * Escolhe o TRECHO do depoimento que vale a pena mostrar quando só cabe um
 * pedaço (cartão do Início, prévia, resumo).
 *
 * Por que existe: cliente não começa agradecendo. O Jayme abriu explicando o
 * histórico do desconto — "ele tava descontando de mim R$ 107, desde 2022…" —
 * e só no fim veio "eu queria só te agradecer muito aí a vocês, eu tava
 * precisando demais, não esperava, vou até dormir melhor hoje". Cortar pelo
 * começo mostra a contabilidade e esconde a gratidão, que é o motivo do cartão
 * existir.
 *
 * A regra: ancora na ÚLTIMA frase com sinal de gratidão, leva até o fim da
 * mensagem e, se ainda couber, completa para trás. Sem sinal nenhum, mostra o
 * fecho — que quase sempre é onde a pessoa resume o que sentiu.
 */

const SINAIS =
  /(obrigad|agrade[çc]|gratid[ãa]o|aben[çc]o|n[ãa]o\s+esperava|dormir\s+melhor|precisando|maravilh|parab[ée]ns|feliz|gra[çc]as\s+a|alegria|al[íi]vio|brilhante|recomend|indic|valeu|deus)/i;

/** Quebra em frases sem lookbehind (compatibilidade ampla de navegador). */
function emFrases(texto: string): string[] {
  return texto.match(/[^.!?…\n]+[.!?…]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [texto];
}

export function trechoDeGratidao(mensagem: string, max = 300): string {
  const original = (mensagem ?? '').trim();
  if (!original) return '';
  // Coube inteiro: devolve o ORIGINAL, com as quebras de linha. Bloco de vários
  // balões (o Gilvan mandou três) tem que continuar em três linhas — achatar
  // tudo numa linha só descaracteriza a fala.
  if (original.replace(/\s+/g, ' ').length <= max) return original;
  const texto = original.replace(/\s+/g, ' ');

  const frases = emFrases(texto);

  // Âncora: a última frase que soa a agradecimento.
  let ancora = -1;
  frases.forEach((f, i) => {
    if (SINAIS.test(f)) ancora = i;
  });
  if (ancora === -1) return '…' + texto.slice(-max).trimStart();

  const escolhidas: string[] = [];
  let tamanho = 0;

  // Da âncora até o fim — o fecho é o que queremos preservar inteiro.
  for (let i = ancora; i < frases.length; i++) {
    const f = frases[i];
    if (tamanho + f.length + 1 > max && escolhidas.length > 0) break;
    escolhidas.push(f);
    tamanho += f.length + 1;
  }
  // Sobrou espaço: completa para trás, dando contexto ao agradecimento.
  for (let i = ancora - 1; i >= 0; i--) {
    const f = frases[i];
    if (tamanho + f.length + 1 > max) break;
    escolhidas.unshift(f);
    tamanho += f.length + 1;
  }

  const cortouOInicio = escolhidas[0] !== frases[0];
  return (cortouOInicio ? '…' : '') + escolhidas.join(' ');
}
