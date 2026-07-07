import { imprimirDocumento, _brl as brl, _dm as dm, esc } from '@/lib/print-pdf';
import type { ResultadoRmc, ResultadoCs, Cenario } from '../services/calculadora-rmc.service';

export interface MetaRmc {
  tipo: string;
  banco?: string;
  numeroContrato?: string;
  nomeCalculo?: string;
}

const pctBr = (n: number | undefined) => `${(n ?? 0).toFixed(4).replace('.', ',')}%`;

/** Renderiza um HTML já montado num iframe oculto e dispara a impressão. */
function imprimirHtml(html: string) {
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

/**
 * PDF DEDICADO do Cumprimento de Sentença sobre a revisão de RMC/RCC — o que se
 * protocola na execução (principal já atualizado + sucumbência + multa do 523).
 * Mesmo layout branded do relatório de RMC (tema violeta).
 */
export function gerarPdfCsExecucao(
  cs: ResultadoCs,
  meta: MetaRmc & { indiceCorrecao?: string; sucumbenciaLabel?: string },
) {
  const nome = meta.nomeCalculo || [meta.tipo, meta.banco].filter(Boolean).join(' - ') || 'Cumprimento de Sentença';
  const gerado = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const s = cs.sucumbencia;
  const kv = (k: string, v: string, cls = '') =>
    `<div class="kv ${cls}"><span>${esc(k)}</span><span>${v}</span></div>`;

  const sucLabel =
    meta.sucumbenciaLabel ??
    `${pctBr(s.percentual)} ${
      s.base === 'valorCausa'
        ? `sobre o valor da causa (${brl(s.valorCausaAtualizado ?? s.valorCausa ?? 0)})`
        : s.base === 'diferenca'
          ? 'sobre a diferença'
          : 'sobre a condenação (restituição)'
    }`;

  const dados =
    kv('Nome do cálculo', esc(nome)) +
    kv('Tipo de contrato', meta.tipo) +
    (meta.banco ? kv('Banco', esc(meta.banco)) : '') +
    (meta.numeroContrato ? kv('Nº do contrato', esc(meta.numeroContrato)) : '') +
    (meta.indiceCorrecao ? kv('Índice de correção', meta.indiceCorrecao) : '') +
    kv('Principal atualizado até', dm(cs.termoFinal));

  const resultado =
    kv('Principal (repetição do indébito)', brl(cs.principal)) +
    kv(`Honorários sucumbenciais — ${sucLabel}`, brl(s.valor)) +
    (cs.multa523.moratoria > 0 ? kv('Multa moratória 10% (art. 523, CPC)', brl(cs.multa523.moratoria)) : '') +
    (cs.multa523.honorarios > 0 ? kv('Honorários 10% (art. 523, CPC)', brl(cs.multa523.honorarios)) : '') +
    kv('TOTAL (execução)', brl(cs.total), 'total');

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
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .sec{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid}
  .sec>h2{font-size:10.5px;margin:0;padding:7px 11px;background:#f5f3ff;color:#374151;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:.04em}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:6px 11px;font-size:10px}
  .kv:nth-child(even){background:#faf9fe}
  .kv span:first-child{color:#6b7280}
  .kv span:last-child{font-weight:700;text-align:right}
  .res .kv.total{background:#ede9fe;border-top:1px solid #ddd6fe}
  .res .kv.total span{color:#4c1d95;font-size:12px}
  .foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af}
  @page{size:A4 portrait;margin:12mm}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="head">
    <div class="brand">FRIDER ANDRADE<small>ADVOGADOS</small></div>
    <div class="meta">Relatório gerado em ${gerado}<br>Cumprimento de Sentença</div>
  </div>
  <h1>Cumprimento de Sentença — Revisão de RMC / RCC</h1>
  <p class="sub">${esc(nome)}</p>
  <div class="grid">
    <div class="sec"><h2>Dados</h2>${dados}</div>
    <div class="sec res"><h2>Execução</h2>${resultado}</div>
  </div>
  <div class="foot">Frider Andrade | Advogados · cálculo gerado eletronicamente · ${gerado}</div>
</body></html>`;
  imprimirHtml(html);
}

/** Gera o PDF do cálculo de RMC/RCC — mostra o valor SIMPLES e o valor EM DOBRO. */
export function gerarPdfRmc(res: ResultadoRmc, meta: MetaRmc) {
  const cfg = res.config;
  const nome = meta.nomeCalculo || [meta.tipo, meta.banco].filter(Boolean).join(' - ') || 'Cálculo de RMC/RCC';
  const simples = res.cenarios.find((c) => c.id === 'apenasConversao');
  const dobro = res.cenarios.find((c) => c.id === 'conversaoDobro');

  const kv = (k: string, v: string) => `<tr><td>${esc(k)}</td><td style="text-align:left">${esc(v)}</td></tr>`;
  const resumo = (c?: Cenario) =>
    `<td>${brl(c?.resumo.saldoConversao)}</td><td>${brl(c?.resumo.restituicao)}</td><td>${brl(c?.resumo.total)}</td>`;

  let cs = '';
  if (res.cs) {
    const s = res.cs.sucumbencia;
    const rows = [
      `<tr><td>Principal (repetição do indébito)</td><td>${brl(res.cs.principal)}</td></tr>`,
      `<tr><td>Honorários sucumbenciais (${esc(String(s.percentual).replace('.', ','))}%)</td><td>${brl(s.valor)}</td></tr>`,
    ];
    if (res.cs.multa523.moratoria > 0) rows.push(`<tr><td>Multa moratória 10% (art. 523)</td><td>${brl(res.cs.multa523.moratoria)}</td></tr>`);
    if (res.cs.multa523.honorarios > 0) rows.push(`<tr><td>Honorários 10% (art. 523)</td><td>${brl(res.cs.multa523.honorarios)}</td></tr>`);
    rows.push(`<tr class="total"><td>TOTAL (execução)</td><td>${brl(res.cs.total)}</td></tr>`);
    cs = `<h2>Cumprimento de Sentença</h2><table>${rows.join('')}</table>`;
  }

  const corpo = `
    <h1>Cálculo de Revisão de RMC / RCC</h1>
    <p class="sub">Conversão em empréstimo + restituição (CDC 42) &middot; índices do BACEN</p>
    <table class="kv">
      ${kv('Nome', nome)}
      ${kv('Tipo', meta.tipo)}
      ${kv('Banco', meta.banco || '—')}
      ${kv('Nº do contrato', meta.numeroContrato || '—')}
      ${kv('Valor do empréstimo', brl(cfg.valorEmprestimo))}
      ${kv('Taxa de conversão', `${String(cfg.taxaConversao).replace('.', ',')}% a.m.`)}
      ${kv('Juros de mora', `${String(cfg.jurosMora).replace('.', ',')}% a.m.`)}
      ${kv('Índice de correção', cfg.indiceCorrecao)}
      ${kv('Data-base', dm(cfg.dataBase))}
      ${kv('Modulação STJ (Tema 929)', cfg.modulacaoStj ? 'Sim' : 'Não')}
    </table>
    <h2>Resultado</h2>
    <table class="blue">
      <thead><tr><th>Método</th><th>Saldo da conversão</th><th>Restituição</th><th>TOTAL</th></tr></thead>
      <tbody>
        <tr><td><b>Restituição SIMPLES</b></td>${resumo(simples)}</tr>
        <tr><td><b>Restituição EM DOBRO (CDC 42)</b></td>${resumo(dobro)}</tr>
      </tbody>
    </table>
    ${cs}
  `;
  imprimirDocumento(nome, corpo);
}
