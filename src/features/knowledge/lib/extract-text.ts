/**
 * Extrai texto de um arquivo NO NAVEGADOR (sem dependência de PDF no servidor).
 * - .txt / text/*  → lê direto.
 * - .pdf           → pdfjs-dist (worker via unpkg, versão casada).
 * Reusado tanto no upload manual quanto no import dos PDFs do LíderHub.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
  if (!isPdf) {
    // txt, md, csv, etc.
    return (await file.text()).trim();
  }
  const buf = await file.arrayBuffer();
  return extractPdfText(buf);
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join('\n\n').trim();
}
