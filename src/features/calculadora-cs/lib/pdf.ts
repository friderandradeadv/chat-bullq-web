import { imprimirDocumento, _brl as brl, _dm as dm, esc } from '@/lib/print-pdf';
import type { ResultadoCs } from '../services/calculadora-cs.service';

/** Gera o PDF do cálculo de Cumprimento de Sentença / Atualização de Débitos. */
export function gerarPdfCs(res: ResultadoCs) {
  const cfg = res.config;
  const nome = res.nomeCalculo || 'Cumprimento de Sentença';
  const kv = (k: string, v: string) => `<tr><td>${esc(k)}</td><td style="text-align:left">${esc(v)}</td></tr>`;

  const linhaItem = (l: ResultadoCs['debitos'][number], credito = false) =>
    `<tr><td>${credito ? '− ' : ''}${esc(l.descricao)}</td><td style="text-align:center">${dm(l.data)}</td><td>${brl(l.valor)}</td><td>${l.fator.toFixed(4).replace('.', ',')}</td><td>${brl(l.corrigido)}</td><td>${l.juros ? brl(l.juros) : '—'}</td><td>${credito ? '-' : ''}${brl(l.total)}</td></tr>`;
  const itens = [...res.debitos.map((l) => linhaItem(l)), ...res.creditos.map((l) => linhaItem(l, true))].join('');

  const t = res.totais;
  const tot: string[] = [`<tr><td>Principal (débitos − créditos corrigidos)</td><td>${brl(t.principal)}</td></tr>`];
  if (t.jurosMora !== 0) tot.push(`<tr><td>Juros de mora (${esc(String(cfg.jurosMora).replace('.', ','))}% a.m.)</td><td>${brl(t.jurosMora)}</td></tr>`);
  if (t.multa > 0) tot.push(`<tr><td>Multa (${esc(String(cfg.multaPct).replace('.', ','))}%)</td><td>${brl(t.multa)}</td></tr>`);
  if (t.honorarios > 0)
    tot.push(
      `<tr><td>Honorários sucumbenciais (${esc(String(cfg.honorarios?.percentual ?? 0).replace('.', ','))}%)</td><td>${brl(t.honorarios)}</td></tr>`,
    );
  if (t.multa523Moratoria > 0) tot.push(`<tr><td>Multa moratória 10% (art. 523, CPC)</td><td>${brl(t.multa523Moratoria)}</td></tr>`);
  if (t.multa523Honorarios > 0) tot.push(`<tr><td>Honorários 10% (art. 523, CPC)</td><td>${brl(t.multa523Honorarios)}</td></tr>`);
  tot.push(`<tr class="total"><td>TOTAL</td><td>${brl(t.totalGeral)}</td></tr>`);

  const corpo = `
    <h1>Cumprimento de Sentença — Atualização de Débitos</h1>
    <p class="sub">${esc(nome)}</p>
    <table class="kv">
      ${kv('Índice de correção', cfg.indiceCorrecao)}
      ${kv('Termo final', dm(cfg.termoFinal))}
      ${kv('Juros de mora', `${String(cfg.jurosMora).replace('.', ',')}% a.m.${cfg.jurosCapitalizado ? ' (capitalizados)' : ''}`)}
      ${kv('Multa', `${String(cfg.multaPct).replace('.', ',')}%`)}
    </table>
    <h2>Débitos e créditos atualizados</h2>
    <table class="violet">
      <thead><tr><th>Descrição</th><th>Termo inicial</th><th>Valor</th><th>Fator</th><th>Corrigido</th><th>Juros</th><th>Total</th></tr></thead>
      <tbody>${itens}</tbody>
    </table>
    <h2>Resultado</h2>
    <table>${tot.join('')}</table>
  `;
  imprimirDocumento(nome, corpo);
}
