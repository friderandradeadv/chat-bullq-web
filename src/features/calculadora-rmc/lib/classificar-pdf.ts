/**
 * Classifica um PDF NO NAVEGADOR (pdfjs, primeiras páginas) para a área única
 * de upload da calculadora: HISCON, HISCRE, sentença, inicial ou cálculo do
 * escritório. Sem custo de IA — regex sobre o texto extraído, com FALLBACK pelo
 * NOME do arquivo quando o pdfjs não consegue ler o texto (PDFs "WPTools" do
 * TJ, escaneados, etc. — extração vazia deixaria tudo como "desconhecido").
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

/** Classifica pelo CONTEÚDO (texto extraído). null = não deu p/ decidir. */
function porConteudo(t: string): TipoDocCalc | null {
  // HISCON — Histórico de Empréstimo Consignado (Meu INSS): metadados dos contratos
  if (
    t.includes('HISTORICO DE EMPRESTIMO CONSIGNADO') ||
    t.includes('EMPRESTIMOS BANCARIOS') ||
    (t.includes('RESERVADO ATUALIZADO') && t.includes('VALOR LIMITE'))
  )
    return 'hiscon';

  // HISCRE — Histórico de Créditos (rubricas 217 RMC / 268 cartão, mês a mês)
  if (
    t.includes('HISTORICO DE CREDITO') ||
    t.includes('EMPRESTIMO SOBRE A RMC') ||
    t.includes('CONSIGNACAO - CARTAO') ||
    t.includes('CONSIGNACAO CARTAO')
  )
    return 'hiscre';

  // Cálculo da inicial — relatório da calculadora (escritório/CJ) ou memorial.
  if (
    !t.includes('EXCELENTISSIMO') &&
    (t.includes('EVOLUCAO DO SALDO DEVEDOR') ||
      t.includes('EVOLUCAO DAS PARCELAS') ||
      t.includes('MEMORIAL DE CALCULO'))
  )
    return 'calculo';

  // Sentença / acórdão (o dispositivo "julgo…" é a assinatura mais confiável)
  if (
    /JULG\w* (PARCIALMENTE )?(IM)?PROCEDENTE/.test(t) ||
    /\bACORDAO\b/.test(t) ||
    /ANTE O EXPOSTO/.test(t) ||
    /DISPOSITIVO/.test(t) ||
    (/\bSENTENCA\b/.test(t) && (t.includes('VISTOS') || t.includes('JULGO')))
  )
    return 'sentenca';

  // Petição inicial (endereçamento + pedidos/valor da causa)
  if (
    t.includes('EXCELENTISSIMO') ||
    (t.includes('VALOR DA CAUSA') && (t.includes('DOS PEDIDOS') || t.includes('REQUERIMENTOS')))
  )
    return 'inicial';

  return null;
}

/** Classifica pelo NOME do arquivo (fallback quando o texto falha). */
function porNome(nome: string): TipoDocCalc | null {
  const n = norm(nome);
  if (n.includes('HISCON')) return 'hiscon';
  if (n.includes('HISCRE')) return 'hiscre';
  if (n.includes('MEMORIAL') || n.includes('CALCULO') || n.includes('PLANILHA')) return 'calculo';
  // sentença tem prioridade sobre acórdão/ED; "SENT" pega "SENTENCA"/"SENTENÇA"
  if (n.includes('SENTENC') || n.includes('ACORDAO') || n.includes('SENT ')) return 'sentenca';
  if (n.includes('INICIAL') || n.includes('PETICAO')) return 'inicial';
  return null;
}

export async function classificarPdf(
  file: File,
): Promise<{ tipo: TipoDocCalc; nome: string; via: 'conteudo' | 'nome' | 'desconhecido' }> {
  const nome = file.name;
  let t = '';
  try {
    t = norm(await textoPrimeirasPaginas(file));
  } catch {
    /* pdfjs falhou de vez — cai no nome abaixo */
  }
  const porTexto = t ? porConteudo(t) : null;
  if (porTexto) return { tipo: porTexto, nome, via: 'conteudo' };

  // Texto ilegível/insuficiente (WPTools, escaneado) → tenta pelo nome.
  const porArquivo = porNome(nome);
  if (porArquivo) return { tipo: porArquivo, nome, via: 'nome' };

  return { tipo: 'desconhecido', nome, via: 'desconhecido' };
}
