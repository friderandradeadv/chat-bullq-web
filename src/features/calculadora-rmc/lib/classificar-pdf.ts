/**
 * Classifica um PDF NO NAVEGADOR (pdfjs, primeiras páginas) para a área única
 * de upload da calculadora: HISCON, HISCRE, sentença, inicial ou cálculo do
 * escritório. Sem custo de IA — só regex sobre o texto extraído.
 */
export type TipoDocCalc =
  | 'hiscon'
  | 'hiscre'
  | 'sentenca'
  | 'inicial'
  | 'calculo'
  | 'desconhecido';

async function textoPrimeirasPaginas(file: File, maxPaginas = 4): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = Math.min(doc.numPages, maxPaginas);
  const parts: string[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(
      content.items.map((it: any) => (typeof it.str === 'string' ? it.str : '')).join(' '),
    );
  }
  try {
    await doc.destroy();
  } catch {
    /* melhor esforço */
  }
  return parts.join('\n').replace(/\s+/g, ' ');
}

/** Maiúsculas sem acento, p/ casar regex independente de grafia. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

export async function classificarPdf(
  file: File,
): Promise<{ tipo: TipoDocCalc; nome: string }> {
  const nome = file.name;
  let t = '';
  try {
    t = norm(await textoPrimeirasPaginas(file));
  } catch {
    return { tipo: 'desconhecido', nome };
  }
  if (!t) return { tipo: 'desconhecido', nome };

  // HISCON — Histórico de Empréstimo Consignado (Meu INSS): metadados dos contratos
  if (
    t.includes('HISTORICO DE EMPRESTIMO CONSIGNADO') ||
    t.includes('EMPRESTIMOS BANCARIOS') ||
    (t.includes('RESERVADO ATUALIZADO') && t.includes('VALOR LIMITE'))
  )
    return { tipo: 'hiscon', nome };

  // HISCRE — Histórico de Créditos (rubricas 217 RMC / 268 cartão, mês a mês)
  if (
    t.includes('HISTORICO DE CREDITO') ||
    t.includes('EMPRESTIMO SOBRE A RMC') ||
    t.includes('CONSIGNACAO - CARTAO') ||
    t.includes('CONSIGNACAO CARTAO')
  )
    return { tipo: 'hiscre', nome };

  // Cálculo do escritório (relatório gerado pela própria calculadora)
  if (t.includes('EVOLUCAO DO SALDO DEVEDOR') && t.includes('FRIDER ANDRADE'))
    return { tipo: 'calculo', nome };

  // Sentença / acórdão (o dispositivo "julgo…" é a assinatura mais confiável)
  if (
    /JULGO (PARCIALMENTE )?(IM)?PROCEDENTE/.test(t) ||
    /\bACORDAO\b/.test(t) ||
    (/\bSENTENCA\b/.test(t) && (t.includes('VISTOS') || t.includes('DISPOSITIVO')))
  )
    return { tipo: 'sentenca', nome };

  // Petição inicial (endereçamento + pedidos/valor da causa)
  if (
    t.includes('EXCELENTISSIMO') ||
    (t.includes('VALOR DA CAUSA') && (t.includes('DOS PEDIDOS') || t.includes('REQUERIMENTOS')))
  )
    return { tipo: 'inicial', nome };

  return { tipo: 'desconhecido', nome };
}
