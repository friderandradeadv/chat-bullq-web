import { _brl as brl, esc } from '@/lib/print-pdf';
import type { ResultadoRescisao } from '../services/calculadora-rescisao.service';
import { printHtml } from './pdf-planilha';

/**
 * PRODUTO C — Simulação/confronto de TRCT. Reproduz o TRCT em duas colunas:
 * o que a EMPRESA lançou (coluna "Pago") × o que era DEVIDO, destacando a
 * diferença (o sonegado). É a peça de confronto (spec §5-C).
 */
const n2 = (n: number) => brl(n).replace('R$', '').trim();
const gerado = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function gerarConfrontoTrct(res: ResultadoRescisao) {
  const id = res.identificacao;
  const linhas = res.verbas
    .map((v) => {
      const dif = v.diferenca;
      const cls = dif > 0.005 ? 'dif' : dif < -0.005 ? 'neg' : '';
      return `<tr class="${cls}">
        <td>${esc(v.nome)}</td>
        <td class="r">${n2(v.pago)}</td>
        <td class="r">${n2(v.devido)}</td>
        <td class="r"><b>${n2(dif)}</b></td>
      </tr>`;
    })
    .join('');
  const totPago = res.verbas.reduce((s, v) => s + v.pago, 0);
  const totDevido = res.verbas.reduce((s, v) => s + v.devido, 0);

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Confronto de TRCT</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: Helvetica, Arial, sans-serif; color:#1a1a1a; font-size: 10px; margin:0; }
    .hd { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1.2px solid #444; padding-bottom:5px; margin-bottom:10px; }
    .em { font-size:15px; font-weight:700; letter-spacing:.5px; }
    .sub { font-size:8px; color:#666; }
    h1 { font-size:13px; text-align:center; margin:6px 0 4px; }
    .cli { text-align:center; font-size:9px; color:#555; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:.5px solid #999; padding:4px 6px; }
    th { background:#e0e0e0; font-size:9px; }
    .r { text-align:right; }
    tr.dif td { background:#fef3c7; }
    tr.dif td:last-child { color:#7c2d12; font-weight:700; }
    tr.neg td { background:#eef2ff; }
    .tot td { background:#1a1a1a; color:#fff; font-weight:700; }
    .leg { font-size:8px; color:#666; margin-top:8px; }
    .foot { margin-top:14px; font-size:7px; color:#888; text-align:right; }
  </style></head><body>
  <div class="hd"><div><div class="em">${esc(id.emitente)}</div><div class="sub">Confronto de TRCT — o que a empresa lançou × o que era devido</div></div>
    <div style="text-align:right;font-size:8px">Processo: ${esc(id.processo || 'a distribuir')}<br>Cálculo: ${esc(id.calculo)}</div></div>
  <h1>SIMULAÇÃO DE TRCT — DEMONSTRATIVO DE DIFERENÇAS</h1>
  <div class="cli">${esc(id.reclamante || '—')} × ${esc(id.reclamado || '—')} · Período: ${esc(id.periodo_calculo)}</div>
  <table>
    <thead><tr><th>Rubrica</th><th class="r">Empresa lançou (TRCT)</th><th class="r">Devido</th><th class="r">Diferença</th></tr></thead>
    <tbody>${linhas}
      <tr class="tot"><td>TOTAL</td><td class="r">${n2(totPago)}</td><td class="r">${n2(totDevido)}</td><td class="r">${n2(totDevido - totPago)}</td></tr>
    </tbody>
  </table>
  <div class="leg">Em <b>amarelo</b>, as rubricas com diferença a postular (devido &gt; pago) — o sonegado. Regra de ouro (spec §2.1): a diferença entre devido e pago é o que se postula; nunca se soma o TRCT ao pedido.</div>
  <div class="foot">Frider Andrade · Advogados · gerado eletronicamente · ${gerado()}</div>
  </body></html>`;

  printHtml(html);
}
