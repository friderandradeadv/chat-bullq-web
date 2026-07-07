import { _brl as brl, _dm as dm, esc } from '@/lib/print-pdf';
import type { ResultadoCs } from '../services/calculadora-cs.service';

const pct = (n: number | undefined) => `${(n ?? 0).toFixed(4).replace('.', ',')}%`;
const num = (n: number) => String(n).replace('.', ',');

/**
 * PDF DETALHADO do Cumprimento de Sentença / Atualização de Débitos — memória de
 * cálculo completa no padrão do escritório (cabeçalho Frider Andrade, parâmetros,
 * tabela verba a verba com correção e juros discriminados, resumo dos totais).
 * Renderiza num iframe oculto e dispara a impressão ("Salvar como PDF").
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

  // ── Parâmetros do cálculo (tudo que entrou na conta) ──────────────────────
  const parametros =
    kv('Índice de correção', cfg.indiceCorrecao) +
    kv('Termo final (data do cálculo)', dm(cfg.termoFinal)) +
    kv('Correção pro rata die', cfg.proRataDie ? 'Sim' : 'Não') +
    kv('Juros de mora', `${num(cfg.jurosMora)}% ao mês${cfg.jurosCapitalizado ? ' (capitalizados)' : ' (simples)'}`) +
    kv(
      'Juros a partir de',
      cfg.jurosInicial === 'vencimento' ? 'vencimento de cada verba' : `data fixa — ${dm(cfg.jurosInicial)}`,
    ) +
    kv('Multa sobre o principal', cfg.multaPct > 0 ? `${num(cfg.multaPct)}%` : '—') +
    kv(
      'Honorários sucumbenciais',
      cfg.honorarios ? `${pct(cfg.honorarios.percentual)} ${honBaseLabel}` : '—',
    ) +
    (cfg.honorarios?.base === 'fixa' && cfg.honorarios.atualizarQuantia
      ? kv('Valor da causa corrigido desde', dm(cfg.honorarios.quantiaData ?? ''))
      : '') +
    kv('Multa do art. 523 (moratória 10%)', cfg.multaMoratoria523 ? 'Sim' : 'Não') +
    kv('Honorários do art. 523 (10%)', cfg.honorarios523 ? 'Sim' : 'Não');

  // ── Resumo dos totais (componente a componente) ───────────────────────────
  const resumo =
    kv('Débitos corrigidos', brl(t.debitosCorrigido)) +
    (t.creditosCorrigido > 0 ? kv('(−) Créditos/pagamentos corrigidos', `− ${brl(t.creditosCorrigido)}`) : '') +
    kv('Principal (base de juros/honorários)', brl(t.principal)) +
    (t.jurosMora !== 0 ? kv(`Juros de mora (${num(cfg.jurosMora)}% a.m.)`, brl(t.jurosMora)) : '') +
    (t.multa > 0 ? kv(`Multa (${num(cfg.multaPct)}%)`, brl(t.multa)) : '') +
    (t.honorarios > 0
      ? kv(opts?.honorariosLabel ?? `Honorários sucumbenciais (${pct(cfg.honorarios?.percentual)})`, brl(t.honorarios))
      : '') +
    (t.multa523Moratoria > 0 ? kv('Multa moratória 10% (art. 523, CPC)', brl(t.multa523Moratoria)) : '') +
    (t.multa523Honorarios > 0 ? kv('Honorários 10% (art. 523, CPC)', brl(t.multa523Honorarios)) : '') +
    kv('TOTAL GERAL', brl(t.totalGeral), 'total');

  // ── Tabela verba a verba (memória detalhada de correção + juros) ──────────
  const linha = (l: ResultadoCs['debitos'][number], credito = false) => {
    // jurosPct é a fração acumulada (juros mês a mês); meses ≈ jurosPct / (jurosMora/100)
    const taxaMes = cfg.jurosMora / 100;
    const meses = taxaMes > 0 && l.jurosPct > 0 ? Math.round(l.jurosPct / taxaMes) : 0;
    return (
      `<tr class="${credito ? 'c' : ''}">` +
      `<td class="l">${credito ? '− ' : ''}${esc(l.descricao)}</td>` +
      `<td class="ct">${dm(l.data)}</td>` +
      `<td>${brl(l.valor)}</td>` +
      `<td>${l.fator.toFixed(6).replace('.', ',')}</td>` +
      `<td>${brl(l.corrigido)}</td>` +
      `<td class="ct">${meses > 0 ? `${meses}m` : '—'}</td>` +
      `<td>${l.jurosPct > 0 ? pct(l.jurosPct * 100) : '—'}</td>` +
      `<td>${l.juros ? brl(l.juros) : '—'}</td>` +
      `<td>${credito ? '−' : ''}${brl(l.total)}</td></tr>`
    );
  };
  const itens = [
    ...res.debitos.map((l) => linha(l)),
    ...res.creditos.map((l) => linha(l, true)),
  ].join('');
  const somaCorrigido = brl(t.debitosCorrigido - t.creditosCorrigido);
  const somaJuros = brl(t.jurosMora);
  const somaTotal = brl(t.principal + t.jurosMora);

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
  table{width:100%;border-collapse:collapse;font-size:8.2px;margin-top:4px}
  thead{display:table-header-group}
  th{background:#6d28d9;color:#fff;font-weight:700;padding:5px 4px;text-align:right;vertical-align:bottom;line-height:1.12}
  td{padding:4px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  th:first-child,td.l{text-align:left}
  td.ct{text-align:center}
  tr.c td{background:#fef2f2;color:#991b1b}
  tfoot td{border-top:2px solid #6d28d9;font-weight:800;background:#f5f3ff}
  .secfull{margin-top:14px;border:none;border-radius:0;overflow:visible;break-inside:auto}
  .secfull>h2{border:1px solid #e5e7eb;border-bottom:none;border-radius:8px 8px 0 0}
  .nota{margin-top:10px;font-size:8.5px;color:#9ca3af;line-height:1.5}
  .foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af}
  @page{size:A4 landscape;margin:11mm}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="head">
    <div class="brand">FRIDER ANDRADE<small>ADVOGADOS</small></div>
    <div class="meta">Relatório gerado em ${gerado}<br>Cumprimento de Sentença · memória de cálculo</div>
  </div>
  <h1>Cumprimento de Sentença — Atualização de Débitos</h1>
  <p class="sub">${esc(nome)}</p>
  <div class="grid">
    <div class="sec"><h2>Parâmetros do cálculo</h2>${parametros}</div>
    <div class="sec res"><h2>Resumo dos totais</h2>${resumo}</div>
  </div>
  <div class="sec secfull"><h2>Memória de cálculo — verba a verba</h2>
    <table>
      <thead><tr>
        <th>Descrição</th><th>Termo inicial</th><th>Valor original</th>
        <th>Fator (${esc(cfg.indiceCorrecao)})</th><th>Valor corrigido</th>
        <th>Meses juros</th><th>% juros</th><th>Valor juros</th><th>Total</th>
      </tr></thead>
      <tbody>${itens}</tbody>
      <tfoot><tr>
        <td class="l">TOTAIS</td><td></td><td></td><td></td>
        <td>${somaCorrigido}</td><td></td><td></td><td>${somaJuros}</td><td>${somaTotal}</td>
      </tr></tfoot>
    </table>
  </div>
  <div class="nota">
    Correção monetária pela tabela do índice ${esc(cfg.indiceCorrecao)} da data de cada verba (termo inicial) até o termo final (${dm(cfg.termoFinal)}).
    Juros de mora ${cfg.jurosCapitalizado ? 'compostos' : 'simples'} de ${num(cfg.jurosMora)}% ao mês sobre o valor corrigido, contados ${cfg.jurosInicial === 'vencimento' ? 'do vencimento de cada verba' : `de ${dm(cfg.jurosInicial)}`}.
    ${cfg.honorarios ? `Honorários sucumbenciais de ${pct(cfg.honorarios.percentual)} ${honBaseLabel}.` : ''}
    ${cfg.multaMoratoria523 || cfg.honorarios523 ? 'Multa e honorários do art. 523 do CPC (10% + 10%) incidem sobre o principal na hipótese de não pagamento em 15 dias.' : ''}
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
