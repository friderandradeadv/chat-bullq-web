/**
 * O QUE A COLETA PRECISA TER TRAZIDO — espelho do módulo da API.
 *
 * 🚨 Regra do escritório (13/11/2026): HISCON e HISCRE são a prova do CASO e
 * continuam obrigatórios; `IR.pdf` e `PORTAL MIR.png` provam RENDA, e *"se tem
 * IR, não precisa de portal e vice versa"* — um fecha a vaga do outro.
 *
 * ⚠️ ESPELHO de `inicial/documentos-da-coleta.ts`, na API. São dois pacotes,
 * sem import entre eles: mudou lá, muda aqui. O número tem de ser o MESMO que
 * decide se o card anda — barra cheia com card parado é a ferramenta se
 * contradizendo na cara de quem trabalha.
 */

const chave = (s: unknown) => String(s ?? '').trim().toUpperCase();

export const DO_CASO = ['HISCON.PDF', 'HISCRE.PDF'] as const;
export const DE_RENDA = ['IR.PDF', 'PORTAL MIR.PNG'] as const;
export const VAGAS = DO_CASO.length + 1;

export interface ProgressoDaColeta {
  tem: number;
  de: number;
  faltam: string[];
  completa: boolean;
}

/** ⚠️ Nome EXATO, nunca "contém": `IR` casa dentro de `PORTAL MIR.PNG`. */
export function progressoDaColeta(nomes: unknown): ProgressoDaColeta {
  const vieram = new Set((Array.isArray(nomes) ? nomes : []).map(chave));
  const faltam: string[] = [];
  let tem = 0;
  for (const d of DO_CASO) {
    if (vieram.has(d)) tem += 1;
    else faltam.push(d);
  }
  if (DE_RENDA.some((d) => vieram.has(d))) tem += 1;
  else faltam.push(`${DE_RENDA[0]} ou ${DE_RENDA[1]}`);
  return { tem, de: VAGAS, faltam, completa: tem >= VAGAS };
}
