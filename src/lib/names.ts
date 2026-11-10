// Formatação de nomes de pessoas e empresas — "Primeira Letra Maiúscula",
// tratando ALL CAPS, conectores em minúsculo (de, da, dos…), nomes com hífen
// e preservando SIGLAS / formas societárias em MAIÚSCULO (S/A, LTDA, BMG, ABCB…).

const NAME_MINOR = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della',
  'van', 'von', 'y', 'a', 'o', 'as', 'os',
]);

// Tokens que ficam SEMPRE em maiúsculo: formas societárias + siglas comuns
// (bancos/financeiras que aparecem como parte adversa em RMC/RCC). Comparados
// já sem pontuação (s/a → sa, ltda. → ltda).
const UPPER_TOKENS = new Set([
  // formas societárias + sufixos de financeira
  'sa', 'ltda', 'me', 'epp', 'eireli', 'eirelli', 'mei', 'cia', 'ss',
  'cfi', 'scfi', 'dtvm', 'ctvm', 'scd', 'scm',
  // bancos / financeiras / siglas do domínio
  'bmg', 'pan', 'bv', 'brb', 'c6', 'abcb', 'hsbc', 'bb', 'cef', 'bndes',
  'brde', 'ccb', 'rmc', 'rcc', 'inss',
]);

// Vogais (com acento) — token sem NENHUMA vogal é quase sempre sigla (BMG, BV,
// HSBC, MRV). Real sobrenome PT-BR sempre tem vogal, então nomes ficam a salvo.
const VOWEL = /[aeiouáàâãéêíóôõúü]/i;

/** Formata UM token respeitando siglas, formas societárias e conectores. */
function fmtToken(word: string, isFirst: boolean): string {
  const low = word.toLowerCase();
  const bare = low.replace(/[.\-/]/g, ''); // p/ casar "s/a", "ltda."
  if (UPPER_TOKENS.has(low) || UPPER_TOKENS.has(bare)) return word.toUpperCase();
  // sigla: 2+ letras sem vogal (BMG, BV, HSBC, MRV) → mantém maiúsculo
  const letters = word.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 2 && !VOWEL.test(letters)) return word.toUpperCase();
  // conector no meio fica minúsculo
  if (!isFirst && NAME_MINOR.has(low)) return low;
  // capitaliza o início e cada parte após hífen/apóstrofo (D'Ávila, Saint-Clair)
  return low.replace(/(^|[-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * "EULER FRANCA CAMPOS" → "Euler Franca Campos"; "BANCO BMG S/A" → "Banco BMG S/A";
 * "ASBAPI – ASSOCIAÇÃO…" → "ASBAPI – Associação…". A sigla à frente de um travessão
 * que expande o nome (padrão "SIGLA – Nome por extenso") fica em MAIÚSCULO mesmo
 * tendo vogal — só quando é UM único token curto (evita mexer em "Master Prev – …").
 */
export function titleCaseName(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const tokens = s.split(/\s+/);
  const dashNext = tokens.length >= 3 && /^[–—-]$/.test(tokens[1]);
  const lead = tokens[0].replace(/[^\p{L}0-9]/gu, '');
  const leadAcr = dashNext && lead.length >= 2 && lead.length <= 7 && !NAME_MINOR.has(tokens[0].toLowerCase());
  return tokens.map((w, i) => (i === 0 && leadAcr ? w.toUpperCase() : fmtToken(w, i === 0))).join(' ');
}

/**
 * 🚨 DOBRA O TEXTO PARA BUSCA: minúsculas e SEM ACENTO (10/11/2026).
 *
 * Nasceu de uma busca que falhou na cara do advogado: ele digitou
 * "jose carlos alves" e o hub respondeu *"Nenhum processo ou cliente
 * encontrado"* — com o José Carlos Alves Lima cadastrado, com processo e com
 * conversa aberta. A comparação era `toLowerCase().includes(q)`, sensível a
 * acento, e quem procura cliente digita corrido.
 *
 * ⚠️ MORA AQUI, e não em cada tela, porque o mesmo `toLowerCase()` está em mais
 * de uma dúzia de buscas do hub. Copiar a correção em todas seria a mesma regra
 * em doze pontas — e, no dia em que uma mudar, as outras onze divergem calado.
 * Quem precisar de busca que ignora acento importa daqui.
 *
 * NFD separa a letra do acento e a faixa ̀-ͯ apaga só os acentos,
 * preservando ç → c, que é o que espera quem digita "goncalves".
 */
export const dobraParaBusca = (s: string | null | undefined): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
