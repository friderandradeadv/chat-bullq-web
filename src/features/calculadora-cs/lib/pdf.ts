import { _brl as brl, _dm as dm, esc } from '@/lib/print-pdf';
import type { ResultadoCs } from '../services/calculadora-cs.service';

const pct = (n: number | undefined) => `${(n ?? 0).toFixed(4).replace('.', ',')}%`;

/**
 * PDF do Cumprimento de Sentença / Atualização de Débitos — relatório no padrão
 * do escritório (mesmo layout do cálculo de RMC/RCC: cabeçalho Frider Andrade,
 * grid Dados × Resultado, tabela dos débitos). Renderiza num iframe oculto e
 * dispara a impressão do navegador ("Salvar como PDF"). Sem lib externa.
 */
export function gerarPdfCs(res: ResultadoCs, opts?: { honorariosLabel?: string }) {
  const cfg = res.config;
  const t = res.totais;
  const nome = res.nomeCalculo || 'Cumprimento de Sentença';
  const gerado = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const kv = (k: string, v: string, cls = '') =>
    `<div class="kv ${cls}"><span>${esc(k)}</span><span>${v}</span></div>`;

  const honBaseLabel =
    cfg.honorarios?.base === 'fixa'
      ? `sobre o valor da causa (${brl(res.honorariosBase)})`
      : cfg.honorarios?.base === 'debitos'
        ? 'sobre os débitos corrigidos'
        : 'sobre o principal corrigido';

  const dados =
    kv('Nome do cálculo', esc(nome)) +
    kv('Índice de correção', cfg.indiceCorrecao) +
    kv('Termo final', dm(cfg.termoFinal)) +
    kv('Juros de mora', `${String(cfg.jurosMora).replace('.', ',')}% a.m.${cfg.jurosCapitalizado ? ' (capitalizados)' : ''}`) +
    kv('Juros a partir de', cfg.jurosInicial === 'vencimento' ? 'vencimento de cada verba' : dm(cfg.jurosInicial)) +
    (cfg.multaPct > 0 ? kv('Multa', `${String(cfg.multaPct).replace('.', ',')}%`) : '') +
    (cfg.honorarios ? kv('Honorários', `${pct(cfg.honorarios.percentual)} ${honBaseLabel}`) : '');

  const resultado =
    kv('Principal (débitos − créditos corrigidos)', brl(t.principal)) +
    (t.jurosMora !== 0 ? kv(`Juros de mora (${pct(cfg.jurosMora)} a.m.)`, brl(t.jurosMora)) : '') +
    (t.multa > 0 ? kv(`Multa (${pct(cfg.multaPct)})`, brl(t.multa)) : '') +
    (t.honorarios > 0
      ? kv(opts?.honorariosLabel ?? `Honorários sucumbenciais (${pct(cfg.honorarios?.percentual)})`, brl(t.honorarios))
      : '') +
    (t.multa523Moratoria > 0 ? kv('Multa moratória 10% (art. 523, CPC)', brl(t.multa523Moratoria)) : '') +
    (t.multa523Honorarios > 0 ? kv('Honorários 10% (art. 523, CPC)', brl(t.multa523Honorarios)) : '') +
    kv('TOTAL', brl(t.totalGeral), 'total');

  const linhaItem = (l: ResultadoCs['debitos'][number], credito = false) =>
    `<tr class="${credito ? 'c' : ''}"><td class="l">${credito ? '− ' : ''}${esc(l.descricao)}</td>` +
    `<td class="ct">${dm(l.data)}</td><td>${brl(l.valor)}</td>` +
    `<td>${l.fator.toFixed(6).replace('.', ',')}</td><td>${brl(l.corrigido)}</td>` +
    `<td>${l.juros ? brl(l.juros) : '—'}</td><td>${credito ? '−' : ''}${brl(l.total)}</td></tr>`;
  const itens = [
    ...res.debitos.map((l) => linhaItem(l)),
    ...res.creditos.map((l) => linhaItem(l, true)),
  ].join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(nome)} — Cumprimento de Sentença</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:26px 30px;font-size:11px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6d28d9;padding-bottom:10px;margin-bottom:16px}
  .brand{font-size:16px;font-weight:800;color:#6d28d9;letter-spacing:.02em}
  .brand small{display:block;font-size:8.5px;font-weight:600;color:#6b7280;letter-spacing:.18em;margin-top:2px}
  .meta{text-align:right;font-size:9px;color:#9ca3af;line-height:1.5}
  h1{font-size:14px;margin:0 0 4px;color:#111827}
  .sub{font-size:10px;color:#6b7280;margin:0 0 16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
  .sec{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid}
  .sec>h2{font-size:10.5px;margin:0;padding:7px 11px;background:#f5f3ff;color:#374151;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:.04em}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:5px 11px;font-size:10px}
  .kv:nth-child(even){background:#faf9fe}
  .kv span:first-child{color:#6b7280}
  .kv span:last-child{font-weight:700;text-align:right}
  .res .kv.total{background:#ede9fe;border-top:1px solid #ddd6fe}
  .res .kv.total span{color:#4c1d95;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:8.4px;margin-top:4px}
  thead{display:table-header-group}
  th{background:#6d28d9;color:#fff;font-weight:700;padding:5px 4px;text-align:right;vertical-align:bottom;line-height:1.15}
  td{padding:4px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  th:first-child,td.l{text-align:left}
  td.ct{text-align:center}
  tr.c td{background:#fef2f2;color:#991b1b}
  .secfull{margin-top:14px;border:none;border-radius:0;overflow:visible;break-inside:auto}
  .secfull>h2{border:1px solid #e5e7eb;border-bottom:none;border-radius:8px 8px 0 0}
  .foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af}
  @page{size:A4 portrait;margin:12mm}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="head">
    <div class="brand">FRIDER ANDRADE<small>ADVOGADOS</small></div>
    <div class="meta">Relatório gerado em ${gerado}<br>Cumprimento de Sentença</div>
  </div>
  <h1>Cumprimento de Sentença — Atualização de Débitos</h1>
  <p class="sub">${esc(nome)}</p>
  <div class="grid">
    <div class="sec"><h2>Dados do cálculo</h2>${dados}</div>
    <div class="sec res"><h2>Resultado</h2>${resultado}</div>
  </div>
  <div class="sec secfull"><h2>Débitos e créditos atualizados</h2>
    <table>
      <thead><tr><th>Descrição</th><th>Termo inicial</th><th>Valor</th><th>Fator</th><th>Corrigido</th><th>Juros</th><th>Total</th></tr></thead>
      <tbody>${itens}</tbody>
    </table>
  </div>
  <div class="foot">Frider Andrade | Advogados · cálculo gerado eletronicamente · ${gerado}</div>
</body></html>`;

  // Renderiza num iframe oculto e imprime (mesma página, UTF-8 correto).
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
  if (doc.readyState === 'complete') setTimeout(doPrint, 350);
  else win.addEventListener('load', () => setTimeout(doPrint, 250));
}
