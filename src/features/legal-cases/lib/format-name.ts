// Formatação de nomes/áreas/juízo para as telas jurídicas.
// Corrige o que vem em CAPS do intake (Camila/desmembramento) e o `area` bruto
// que às vezes chega como JSON (`["Bancário","RCC"]`) de dados legados/importados.

// Conectivos que ficam em minúscula no meio do nome (não no início).
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della', 'van', 'von', 'y']);
// Siglas/sufixos societários que permanecem em CAIXA ALTA.
const MANTER_UPPER = new Set(['S/A', 'S.A', 'S.A.', 'LTDA', 'LTDA.', 'ME', 'EPP', 'EIRELI', 'MEI', 'S/S', 'CEF', 'BV']);
const TEM_VOGAL = /[aeiouáéíóúâêôûãõàäëïöü]/i;

/**
 * Title Case para nomes brasileiros (pessoas e bancos):
 * "FLÁVIO ROBERTO DE MEDEIROS" → "Flávio Roberto de Medeiros";
 * "BANCO BMG S/A" → "Banco BMG S/A" (sigla curta sem vogal e sufixo S/A ficam em caixa alta).
 */
export function properName(raw: string | null | undefined): string {
  if (!raw) return '';
  const limpo = raw.trim();
  if (!limpo) return '';
  return limpo
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (MANTER_UPPER.has(up)) return up;
      // Acrônimo curto sem vogal (BMG, HSBC, BTG) → mantém em caixa alta.
      if (w.length <= 4 && !TEM_VOGAL.test(w)) return up;
      if (i > 0 && CONECTIVOS.has(w)) return w;
      // Capitaliza a 1ª letra e cada parte após hífen/barra (nome composto).
      return w.replace(/(^|[-/])([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}

/**
 * Rótulo legível de área/assunto. Aceita texto puro ("RMC"), lista com colchetes
 * (`["Bancário","RCC"]` → "Bancário · RCC") ou vírgulas, sempre limpo.
 */
export function cleanAreaLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  const t = String(raw).trim();
  if (t.startsWith('[')) {
    try {
      const a = JSON.parse(t);
      if (Array.isArray(a)) return a.filter(Boolean).map(String).join(' · ');
    } catch { /* cai no fallback textual abaixo */ }
  }
  return t
    .replace(/^\[|\]$/g, '')
    .replace(/"/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Nome do processo no padrão do escritório: "Autor × Réu" (ambos Title Case).
 * Sem réu, devolve só o autor. Sem autor, cai no título já gravado (Title Case).
 */
export function processoNome(clienteNome: string | null | undefined, reuNome: string | null | undefined, fallbackTitle?: string | null): string {
  const autor = properName(clienteNome);
  const reu = properName(reuNome);
  if (autor && reu) return `${autor} × ${reu}`;
  if (autor) return autor;
  return properName(fallbackTitle) || (fallbackTitle ?? '').trim();
}

/**
 * Juízo na ordem do escritório: "1ª Vara Cível de Maringá/PR". Best-effort e
 * NÃO-destrutivo — normaliza o sufixo de UF para "/PR" e limpa "Comarca de/Foro
 * de" redundantes; se não reconhecer o padrão, devolve o texto original limpo.
 */
export function formatJuizo(raw: string | null | undefined): string {
  if (!raw) return '';
  let t = cleanAreaLabel(raw).replace(/ · /g, ' - ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // UF ao final em várias grafias (" - PR", ", PR", " / PR", " PR") → "/PR".
  t = t.replace(/\s*[-,/]?\s*\b([A-Z]{2})\b\s*$/, (m, uf) => `/${uf}`);
  // Remove "Comarca de"/"Foro de" duplicados quando já há "de <cidade>".
  t = t.replace(/\b(Comarca|Foro)\s+de\s+/gi, (m, _p, off) => (/\bde\s+\S/i.test(t.slice(0, off)) ? '' : m));
  return t.replace(/\s+\//, '/').replace(/\s{2,}/g, ' ').trim();
}
