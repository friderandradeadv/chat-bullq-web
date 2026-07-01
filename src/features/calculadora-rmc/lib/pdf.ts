import { imprimirDocumento, _brl as brl, _dm as dm, esc } from '@/lib/print-pdf';
import type { ResultadoRmc, Cenario } from '../services/calculadora-rmc.service';

export interface MetaRmc {
  tipo: string;
  banco?: string;
  numeroContrato?: string;
  nomeCalculo?: string;
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
      `<tr><td>Honorários sucumbenciais (${esc(String(s.percentual).replace('.', ','))}%${s.base === 'valorCausa' ? ` sobre valor da causa ${brl(s.valorCausaAtualizado ?? s.valorCausa ?? 0)}` : ''})</td><td>${brl(s.valor)}</td></tr>`,
    ];
    if (res.cs.multa523.moratoria > 0) rows.push(`<tr><td>Multa moratória 10% (art. 523)</td><td>${brl(res.cs.multa523.moratoria)}</td></tr>`);
    if (res.cs.multa523.honorarios > 0) rows.push(`<tr><td>Honorários 10% (art. 523)</td><td>${brl(res.cs.multa523.honorarios)}</td></tr>`);
    rows.push(`<tr class="total"><td>TOTAL GERAL (execução)</td><td>${brl(res.cs.total)}</td></tr>`);
    cs = `<h2>Cumprimento de Sentença</h2><table>${rows.join('')}</table>`;
  }

  const linhas = dobro?.linhas ?? [];
  let evo = '';
  if (linhas.length) {
    const body = linhas
      .map(
        (l) =>
          `<tr><td style="text-align:center">${l.numero}</td><td style="text-align:center">${dm(l.data)}</td><td>${brl(l.valorDebitado)}</td><td>${brl(l.saldoAnterior)}</td><td>${brl(l.juros)}</td><td>${brl(l.amortizacao)}</td><td>${brl(l.saldoAtual)}</td><td>${brl(l.valorRestituir)}</td><td>${brl(l.valorCorrigido)}</td><td>${brl(l.jurosMoraValor)}</td><td>${brl(l.valorAtualizado)}</td></tr>`,
      )
      .join('');
    evo = `<h2>Evolução do saldo devedor (restituição em dobro)</h2><table class="evo blue"><thead><tr><th>Nº</th><th>Data</th><th>Debitado</th><th>Saldo ant.</th><th>Juros</th><th>Amortiz.</th><th>Saldo</th><th>A restituir</th><th>Corrigido</th><th>Juros mora</th><th>Atualizado</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  const corpo = `
    <h1>Cálculo de Revisão de RMC / RCC</h1>
    <p class="sub">Conversão em empréstimo + restituição (CDC 42) · índices do BACEN</p>
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
      <thead><tr><th>Método</th><th>Saldo da conversão</th><th>Restituição</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td><b>Restituição SIMPLES</b></td>${resumo(simples)}</tr>
        <tr><td><b>Restituição EM DOBRO (CDC 42)</b></td>${resumo(dobro)}</tr>
      </tbody>
    </table>
    ${cs}
    ${evo}
  `;
  imprimirDocumento(nome, corpo);
}
