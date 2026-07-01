/**
 * Gera um "PDF" abrindo uma janela com o documento estilizado e disparando a
 * impressão do navegador (o usuário escolhe "Salvar como PDF"). Sem dependência
 * externa — o build do web usa yarn --frozen-lockfile, então evitamos libs novas.
 */
const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 30px 34px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 11px; margin: 0 0 14px; }
  h2 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
  th, td { padding: 4px 6px; text-align: right; border-bottom: 1px solid #eee; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  td:first-child, th:first-child { text-align: left; }
  table.kv td { border: 0; padding: 2px 6px; }
  table.kv td:first-child { color: #555; font-weight: 600; width: 210px; }
  tr.total td { font-weight: 700; background: #ede9fe; font-size: 13px; }
  table.blue th { background: #2563eb; color: #fff; }
  table.violet th { background: #7c3aed; color: #fff; }
  table.evo th, table.evo td { font-size: 8px; padding: 2px 3px; }
  .foot { margin-top: 22px; color: #999; font-size: 9px; text-align: center; }
  @page { margin: 14mm; }
  @media print { body { padding: 0; } }
`;

export function imprimirDocumento(titulo: string, corpoHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Permita pop-ups neste site para gerar o PDF.');
    return;
  }
  const dataStr = new Date().toLocaleDateString('pt-BR');
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title><style>${CSS}</style></head><body>${corpoHtml}<div class="foot">Frider Andrade Advogados · gerado em ${dataStr}</div><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script></body></html>`,
  );
  w.document.close();
}

export const _brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);
export const _dm = (iso: string) => (iso || '').split('-').reverse().join('/');
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
