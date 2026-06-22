// Formatação de nomes de pessoas (clientes) — "Primeira Letra Maiúscula",
// tratando ALL CAPS, conectores em minúsculo (de, da, dos…) e nomes com hífen.

const NAME_MINOR = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della',
  'van', 'von', 'y', 'a', 'o', 'as', 'os',
]);

/** "EULER FRANCA CAMPOS" → "Euler Franca Campos"; "maria das dores" → "Maria das Dores". */
export function titleCaseName(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && NAME_MINOR.has(w)) return w; // conector no meio fica minúsculo
      // capitaliza início e cada parte após hífen/apóstrofo (D'Ávila, Saint-Clair)
      return w.replace(/(^|[-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(' ');
}
