/**
 * Gera um "PDF" renderizando o documento estilizado num iframe oculto (mesma
 * página, já em UTF-8 — acentuação correta) e disparando a impressão do
 * navegador (o usuário escolhe "Salvar como PDF"). Sem dependência externa — o
 * build do web usa yarn --frozen-lockfile, então evitamos libs novas.
 */
const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, "Segoe UI", sans-serif; color: #1f2937; font-size: 12.5px; line-height: 1.55; padding: 8px 6px; }
  h1 { font-size: 19px; margin: 0 0 3px; letter-spacing: -0.2px; }
  .sub { color: #6b7280; font-size: 12px; margin: 0 0 18px; }
  h2 { font-size: 13.5px; margin: 22px 0 8px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  th, td { padding: 7px 9px; text-align: right; border-bottom: 1px solid #eef0f2; vertical-align: top; }
  th { background: #f3f4f6; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; font-weight: 700; }
  td:first-child, th:first-child { text-align: left; }
  table.kv td { border: 0; padding: 4px 9px; }
  table.kv td:first-child { color: #6b7280; font-weight: 600; width: 230px; }
  tr.total td { font-weight: 800; background: #ede9fe; font-size: 15px; color: #4c1d95; padding-top: 10px; padding-bottom: 10px; }
  table.blue th { background: #1d4ed8; color: #fff; }
  table.violet th { background: #6d28d9; color: #fff; }
  .foot { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
  @page { size: A4 portrait; margin: 16mm; }
`;

export function imprimirDocumento(titulo: string, corpoHtml: string) {
  const dataStr = new Date().toLocaleDateString('pt-BR');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${corpoHtml}<div class="foot">Frider Andrade Advogados &middot; gerado em ${dataStr}</div></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    alert('Não consegui abrir a impressão. Tente novamente.');
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  const doPrint = () => {
    win.focus();
    win.print();
    setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 1500);
  };
  // dá tempo do layout/fontes renderizarem antes de imprimir
  if (doc.readyState === 'complete') setTimeout(doPrint, 350);
  else win.addEventListener('load', () => setTimeout(doPrint, 250));
}

export const _brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);
export const _dm = (iso: string) => (iso || '').split('-').reverse().join('/');
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
