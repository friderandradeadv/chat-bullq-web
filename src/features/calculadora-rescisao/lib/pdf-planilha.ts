import { _brl as brl, esc } from '@/lib/print-pdf';
import type { ResultadoRescisao, VerbaOut } from '../services/calculadora-rescisao.service';

/**
 * PRODUTO B — Planilha analítica de cálculo trabalhista, 9 seções, A4 paisagem.
 * Reproduz a arquitetura de auditoria do `planilha_pjecalc.py` (padrão demonstrativo
 * pericial): resumo, dados, histórico, demonstrativo por verba com FÓRMULA LITERAL,
 * FGTS, contribuição social/SAT, eSocial S-2500, honorários e critérios numerados.
 * A coluna "valor corrigido" recebe a DIFERENÇA (devido − pago). Imprime via iframe.
 */

const n2 = (n: number) => brl(n).replace('R$', '').trim();
const gerado = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function gerarPlanilhaRescisao(res: ResultadoRescisao) {
  const id = res.identificacao;
  const enc = res.encargos as any;
  const bruto = res.totais.bruto;
  const hon = res.totais.honorarios;
  const encTotal = res.totais.encargosPrevidenciarios;

  // ── I. RESUMO DO CÁLCULO ──────────────────────────────────────────────────
  const linhasResumo = res.verbas
    .map(
      (v) =>
        `<tr><td>${esc(v.nome)}</td><td class="r">${n2(v.diferenca)}</td><td class="r">0,00</td><td class="r">${n2(v.diferenca)}</td></tr>`,
    )
    .join('');
  const resumo = `
  <table class="grid">
    <thead><tr><th>Descrição do bruto devido ao Reclamante</th><th class="r">Valor corrigido</th><th class="r">Juros</th><th class="r">Total</th></tr></thead>
    <tbody>${linhasResumo}
      <tr class="tot"><td class="r"><b>TOTAL</b></td><td class="r"><b>${n2(bruto)}</b></td><td class="r"><b>0,00</b></td><td class="r"><b>${n2(bruto)}</b></td></tr>
    </tbody>
  </table>
  <div class="two">
    <table class="grid"><thead><tr><th>Créditos do Reclamante</th><th class="r">Valor</th></tr></thead><tbody>
      <tr><td>Verbas</td><td class="r">${n2(bruto)}</td></tr>
      <tr><td>Total de descontos</td><td class="r">0,00</td></tr>
      <tr class="tot"><td><b>Líquido devido ao Reclamante</b></td><td class="r"><b>${n2(bruto)}</b></td></tr>
    </tbody></table>
    <table class="grid"><thead><tr><th>Débitos do Reclamado por credor</th><th class="r">Valor</th></tr></thead><tbody>
      <tr><td>Líquido devido ao Reclamante</td><td class="r">${n2(bruto)}</td></tr>
      <tr><td>Contribuição social sobre salários devidos</td><td class="r">${n2(encTotal)}</td></tr>
      <tr><td>Honorários do advogado do Reclamante (${n2(res.honorarios_percentual)}%)</td><td class="r">${n2(hon)}</td></tr>
      <tr class="tot"><td><b>Total devido pelo Reclamado</b></td><td class="r"><b>${n2(bruto + hon + encTotal)}</b></td></tr>
    </tbody></table>
  </div>`;

  // ── II. DADOS DO CÁLCULO ──────────────────────────────────────────────────
  const dados = `<table class="grid kv"><tbody>${Object.entries(res.dados_calculo)
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</tbody></table>`;

  // ── III. HISTÓRICO SALARIAL / FÉRIAS ──────────────────────────────────────
  const hist = res.historico_salarial.length
    ? `<table class="grid"><thead><tr><th>Mês/Ano</th><th class="r">Salário base</th></tr></thead><tbody>${res.historico_salarial
        .map(([m, s]) => `<tr><td>${esc(m)}</td><td class="r">${esc(s)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<div class="nota">Sem histórico salarial informado.</div>';
  const ferias = res.ferias.length
    ? `<table class="grid"><thead><tr><th>Relativa</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>${res.ferias
        .map((f) => `<tr><td>${esc(f[0])}</td><td>${esc(f[3])}</td><td>${esc(f[4])}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  // ── IV. DEMONSTRATIVO DE VERBAS (por rubrica, com fórmula literal) ─────────
  const verbaBloco = (v: VerbaOut) => {
    const linhas = v.linhas
      .map(
        (l) => `<tr>
        <td>${esc(l.periodo)}</td><td class="r">${esc(l.base)}</td><td class="r">${esc(l.divisor)}</td>
        <td class="r">${esc(l.multiplicador)}</td><td class="r">${esc(l.quantidade)}</td><td class="c">${esc(l.dobra)}</td>
        <td class="r">${n2(l.devido)}</td><td class="r">${n2(l.pago)}</td><td class="r">${n2(l.devido - l.pago)}</td>
        <td class="r">1,000000</td><td class="r">${n2(l.devido - l.pago)}</td></tr>`,
      )
      .join('');
    return `<div class="verba">
      <div class="vn">${esc(v.nome)}${v.estimativa ? ' <span class="est">estimativa</span>' : ''}</div>
      <div class="vi">Incidência(s): ${esc(v.inc)}${v.fonte ? ` · Fonte: ${esc(v.fonte)}` : ''}</div>
      ${v.obs ? `<div class="vo">Comentário: ${esc(v.obs)}</div>` : ''}
      <div class="vf">${esc(v.formula)}</div>
      <table class="grid sm"><thead><tr>
        <th>Período</th><th class="r">Base</th><th class="r">Divisor</th><th class="r">Mult.</th><th class="r">Qtd.</th>
        <th class="c">Dobra</th><th class="r">Devido</th><th class="r">Pago</th><th class="r">Diferença</th><th class="r">Índice</th><th class="r">Corrigido</th>
      </tr></thead><tbody>${linhas}
        <tr class="tot"><td class="r"><b>Total</b></td><td colspan="9"></td><td class="r"><b>${n2(v.diferenca)}</b></td></tr>
      </tbody></table>
    </div>`;
  };
  const demonstrativo = res.verbas.map(verbaBloco).join('');

  // ── V. FGTS · VI. CONTRIBUIÇÃO SOCIAL/SAT · VII. eSOCIAL ───────────────────
  let encHtml = '';
  if (enc && !enc.pendente) {
    encHtml = `
    <h2>VI. DEMONSTRATIVO DE CONTRIBUIÇÃO SOCIAL</h2>
    <table class="grid"><thead><tr><th>Encargo</th><th class="r">Base</th><th class="r">Alíquota</th><th class="r">Devido</th><th>Fundamento</th></tr></thead><tbody>
      <tr><td>Contribuição social — cota patronal</td><td class="r">${n2(enc.base_total)}</td><td class="r">${n2(enc.aliquota_patronal)}%</td><td class="r">${n2(enc.cota_patronal)}</td><td>${esc(enc.fundamento_patronal)}</td></tr>
      <tr><td>SAT/RAT (× FAP ${n2(enc.fap)})</td><td class="r">${n2(enc.base_total)}</td><td class="r">${n2(enc.aliquota_sat)}%</td><td class="r">${n2(enc.sat_devido)}</td><td>Art. 22, II, Lei nº 8.212/91 e Anexo V do Decreto nº 3.048/99</td></tr>
      <tr class="tot"><td colspan="3"><b>TOTAL DOS ENCARGOS PREVIDENCIÁRIOS</b></td><td class="r"><b>${n2(enc.total)}</b></td><td></td></tr>
    </tbody></table>
    <div class="nota">Fonte da alíquota do SAT/RAT: ${esc(enc.fonte_sat)}. ${esc(enc.aviso ?? '')}</div>
    <h2>VII. eSOCIAL — EVENTO S-2500</h2>
    <table class="grid"><thead><tr><th>Referência</th><th class="r">Base previdenciária</th><th class="r">Base de 13º</th><th class="r">Base de FGTS</th></tr></thead><tbody>
      <tr><td>${esc(enc.competencia_referencia ?? '—')}</td><td class="r">${n2(enc.base_mensal)}</td><td class="r">${n2(enc.base_13)}</td><td class="r">${n2(enc.base_fgts)}</td></tr>
    </tbody></table>`;
  } else if (enc?.pendente) {
    encHtml = `<h2>VI. CONTRIBUIÇÃO SOCIAL / SAT</h2><div class="nota alerta">Não gerada: alíquota do SAT/RAT ausente. Vem do Anexo V do Decreto nº 3.048/99 conforme o CNAE da ré e deve ser declarada com fonte e data de consulta (regra inviolável §6).</div>`;
  }

  // ── VIII. HONORÁRIOS · IX. CRITÉRIOS ──────────────────────────────────────
  const honHtml = `<table class="grid"><thead><tr><th>Descrição</th><th>Credor</th><th class="r">Base</th><th class="r">Alíquota</th><th class="r">Valor</th></tr></thead><tbody>
    <tr><td>Honorários advocatícios sucumbenciais</td><td>Advogado do Reclamante</td><td class="r">${n2(bruto)}</td><td class="r">${n2(res.honorarios_percentual)}%</td><td class="r">${n2(hon)}</td></tr>
  </tbody></table>`;
  const criterios = `<ol class="crit">${res.criterios.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>`;

  const alertas = res.alertas.length
    ? `<div class="nota alerta"><b>Alertas:</b> ${res.alertas.map(esc).join(' · ')}</div>`
    : '';
  const pend = res.pendencias.length
    ? `<div class="nota alerta"><b>Pendências (não exportar sem resolver):</b> ${res.pendencias.map(esc).join(' · ')}</div>`
    : '';

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(id.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 8px; margin: 0; }
    .hd { display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 1.2px solid #444; padding-bottom: 4px; margin-bottom: 8px; }
    .hd .em { font-size: 13px; font-weight: 700; letter-spacing: .5px; }
    .hd .sub { font-size: 7px; color: #666; }
    .hd .meta { font-size: 7.5px; text-align: right; line-height: 1.5; }
    h1 { font-size: 12px; text-align: center; margin: 4px 0 8px; }
    h2 { font-size: 9px; text-align: center; margin: 12px 0 4px; letter-spacing:.3px; }
    table.grid { width: 100%; border-collapse: collapse; margin: 2px 0; }
    table.grid th, table.grid td { border: .4px solid #999; padding: 2px 4px; vertical-align: middle; }
    table.grid th { background: #e0e0e0; font-weight: 700; }
    table.grid tr:nth-child(even) td { background: #f5f5f5; }
    table.grid .tot td { background: #e0e0e0 !important; }
    table.sm th, table.sm td { font-size: 7px; padding: 1.5px 3px; }
    .r { text-align: right; } .c { text-align: center; }
    .kv .k { width: 30%; font-weight: 700; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
    .verba { margin: 6px 0; page-break-inside: avoid; }
    .vn { font-size: 8.5px; font-weight: 700; }
    .vi, .vo { font-size: 7px; color: #444; }
    .vf { font-size: 7.5px; font-weight: 700; background: #e0e0e0; border: .4px solid #999; padding: 2px 4px; margin: 2px 0; }
    .est { background:#fde68a; color:#7c2d12; font-size:6.5px; padding:0 3px; border-radius:3px; font-weight:600; }
    .nota { font-size: 7px; color: #444; margin: 4px 0; }
    .nota.alerta { color: #7c2d12; background:#fef3c7; border:.4px solid #f59e0b; padding:3px 5px; border-radius:3px; }
    ol.crit { font-size: 7.5px; padding-left: 16px; } ol.crit li { margin: 2px 0; }
    .foot { margin-top: 10px; font-size: 6.5px; color: #888; text-align: right; }
  </style></head><body>
  <div class="hd">
    <div><div class="em">${esc(id.emitente)}</div><div class="sub">${esc(id.subtitulo)}</div></div>
    <div class="meta">Processo: ${esc(id.processo || 'a distribuir')}<br>Cálculo: ${esc(id.calculo)}<br>Data de liquidação: ${esc(id.data_liquidacao || '—')}</div>
  </div>
  <h1>${esc(id.titulo)}</h1>
  <table class="grid"><tbody>
    <tr><td class="k"><b>Reclamante</b></td><td>${esc(id.reclamante || '—')}</td><td class="k"><b>Período do cálculo</b></td><td>${esc(id.periodo_calculo)}</td></tr>
    <tr><td class="k"><b>Reclamado</b></td><td>${esc(id.reclamado || '—')}</td><td class="k"><b>Data de ajuizamento</b></td><td>${esc(id.data_ajuizamento || '—')}</td></tr>
  </tbody></table>
  ${pend}${alertas}
  <h2>I. RESUMO DO CÁLCULO</h2>${resumo}
  <h2>II. DADOS DO CÁLCULO</h2>${dados}
  <h2>III. HISTÓRICO SALARIAL E FÉRIAS</h2><div class="two">${hist}${ferias}</div>
  <h2>IV. DEMONSTRATIVO DE VERBAS</h2>${demonstrativo}
  ${encHtml}
  <h2>VIII. DEMONSTRATIVO DE HONORÁRIOS</h2>${honHtml}
  <h2>IX. CRITÉRIO DE CÁLCULO E FUNDAMENTAÇÃO LEGAL</h2>${criterios}
  <div class="foot">Frider Andrade · Advogados · cálculo gerado eletronicamente · ${gerado()}</div>
  </body></html>`;

  printHtml(html);
}

function printHtml(html: string) {
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

export { printHtml };
