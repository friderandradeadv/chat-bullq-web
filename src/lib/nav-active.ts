/**
 * A rota do item de navegação está ativa?
 *
 * 🚨 NUNCA por prefixo de TEXTO. `pathname.startsWith(href)` acende dois itens
 * quando um href é prefixo do outro — foi o que aconteceu em 31/08/2026 ao criar
 * o quadro `/juridico/board/exec` ao lado do `/juridico/board/execucao`: estando
 * no segundo, os DOIS ficavam azuis. O corte tem de ser no limite de SEGMENTO.
 */
export const isRotaAtiva = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);
