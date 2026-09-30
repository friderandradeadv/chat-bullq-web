// PDF da PRESTAÇÃO DE CONTAS DO ADVOGADO — o espelho, para quem dividiu o trabalho, do
// documento que o cliente recebe. Mesmo motor dos outros dois (html2canvas + pdf-lib) e
// mesmo padrão visual, para que os três documentos do mesmo alvará se reconheçam.
//
// O que ele diz e o Pix seco não dizia: DE ONDE veio cada parcela do que o escritório
// recebeu. Num caso comum o alvará inteiro cai na nossa conta e depois se reparte. Mas há
// o desenho em que o tribunal deposita ao escritório só a SUCUMBÊNCIA (art. 23 do EAOAB —
// é nossa, não passa pelo cliente) e a condenação vai direto para a conta do cliente, que
// então repassa o contratual. As duas parcelas nascem em lugares diferentes e a fatia do
// advogado incide sobre a soma; sem isso escrito, ele não tem como conferir nada.
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas-pro';
import { anexoHref, type RepasseAdvogadoDados } from '../services/financeiro.service';

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (n: number | null) => (n == null ? '' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);

function buildHtml(d: RepasseAdvogadoDados): string {
  const F = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
  const cell = `padding:11px 14px;font-size:12.5px;color:#20262f;border-bottom:1px solid #eef0f3`;
  const val = `padding:11px 14px;font-size:12.5px;text-align:right;white-space:nowrap;border-bottom:1px solid #eef0f3;font-variant-numeric:tabular-nums`;
  const secNum = `color:#C1272D;font-weight:800;font-size:15px;margin-right:8px`;
  const secTit = `color:#1f2733;font-weight:800;font-size:15px`;
  const secSub = `color:#7b8798;font-style:italic;font-size:12.5px;margin:3px 0 12px`;
  let sec = 0;
  const nSec = () => String(++sec).padStart(2, '0');

  const sub = ['Ação judicial', d.processo.autos ? `Autos nº ${esc(d.processo.autos)}` : ''].filter(Boolean).join(' · ');
  const linha2 = `Cliente: ${esc(d.processo.cliente || '-')}${d.processo.reu ? `&nbsp;&nbsp;·&nbsp;&nbsp;Réu: ${esc(d.processo.reu)}` : ''}`;
  const pago = d.advogado.repassado;

  // Verbas do título — só aparecem quando o demonstrativo foi declarado. É o que prova que
  // a base do contratual não foi escolhida: ela sai do que o juiz mandou pagar.
  const verbas = (d.credito.verbas ?? []).filter((v) => Number(v.valor) !== 0);
  const natRot: Record<string, string> = {
    proveito: '',
    reembolso_cliente: ' <span style="color:#6b7480">(devolução de custas do cliente — fora da base)</span>',
    reembolso_escritorio: ' <span style="color:#6b7480">(devolução de despesa do escritório — fora da base)</span>',
    sucumbencia_nossa: ' <span style="color:#6b7480">(verba do escritório, paga pela parte contrária)</span>',
  };
  const verbasHtml = verbas.length ? `
      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">${nSec()}</span><span style="${secTit}">O crédito, verba por verba</span></div>
        <div style="${secSub}">O que a decisão mandou pagar, parcela por parcela — é daqui que sai todo o resto.</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden">
          ${verbas.map((x) => {
            const n = Math.round(Number(x.valor) * 100) / 100;
            const abate = n < 0;
            const rot = abate ? ' <span style="color:#6b7480">(abatimento determinado no título)</span>' : (natRot[String(x.natureza)] ?? '');
            return `<tr><td style="${cell}">${esc(x.label)}${rot}</td><td style="${val}">(${abate ? '−' : '+'}) ${brl(Math.abs(n))}</td></tr>`;
          }).join('')}
          <tr style="background:#eef4fb"><td style="${cell};border-bottom:none;font-weight:800">Crédito total do processo</td><td style="${val};border-bottom:none;font-weight:800">(=) ${brl(d.credito.bruto)}</td></tr>
        </table>
      </div>` : '';

  // Execução parcial: o parceiro precisa saber que ainda há verba a receber — a fatia dele
  // de hoje não é a fatia final do caso.
  const ex = d.execucao && d.execucao.remanescente > 0 ? d.execucao : null;

  return `
  <div style="width:794px;background:#fff;font-family:${F};color:#20262f;box-sizing:border-box">
    <div data-b style="background:#1f2126;padding:26px 34px 22px;border-radius:12px">
      <span style="display:inline-block;background:#C1272D;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:5px">Frider Andrade&nbsp;<span style="color:#fff">▪</span>&nbsp;Advogados</span>
      <div style="color:#fff;font-size:29px;font-weight:800;margin:13px 0 7px;letter-spacing:-.01em">Prestação de contas<span style="color:#C1272D">.</span></div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">Repasse ao advogado · ${esc(d.advogado.nome)}</div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${esc(sub)}</div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${linha2}</div>
    </div>
    <div style="padding:22px 34px 14px">
      <div data-b style="background:${pago ? '#eef4fb' : '#e9f7ef'};border:1px solid ${pago ? '#9dbbdd' : '#7cc79a'};border-left:5px solid ${pago ? '#2b6cb0' : '#2f9e57'};border-radius:10px;padding:15px 20px">
        <div style="color:${pago ? '#2b6cb0' : '#2f7d4f'};font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase">${pago ? 'Valor repassado a você' : 'Valor a repassar a você'}</div>
        <div style="color:${pago ? '#2b6cb0' : '#1f8a4c'};font-size:31px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums">${brl(d.advogado.valor)}</div>
        <div style="color:${pago ? '#2b6cb0' : '#2f7d4f'};font-size:11.5px;margin-top:6px">${d.advogado.pct != null ? `${pct(d.advogado.pct)} do honorário do escritório neste processo (${brl(d.nosso.total)})` : `fatia acordada sobre o honorário do escritório (${brl(d.nosso.total)})`}${pago && d.advogado.repasseData ? ` · pago em ${esc(d.advogado.repasseData)}` : ''}</div>
      </div>

      ${verbasHtml}

      <div data-b style="margin-top:28px">
        <div><span style="${secNum}">${nSec()}</span><span style="${secTit}">O que o escritório recebeu, e de onde</span></div>
        <div style="${secSub}">O honorário do escritório tem duas origens distintas — e elas não entram pela mesma porta.</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden">
          ${d.origens.map((o) => `<tr><td style="${cell}">${esc(o.rotulo)} <span style="color:#6b7480">(${esc(o.quemPagou)})</span></td><td style="${val}">(+) ${brl(o.valor)}</td></tr>`).join('')}
          <tr style="background:#eef4fb"><td style="${cell};border-bottom:none;font-weight:800">Honorário do escritório neste processo</td><td style="${val};border-bottom:none;font-weight:800">(=) ${brl(d.nosso.total)}</td></tr>
        </table>
        <div style="margin-top:14px;display:flex;gap:14px">
          ${d.origens.map((o) => `
          <div style="flex:1;border:1px solid #e3e6eb;border-radius:10px;padding:14px 16px">
            <div style="font-weight:800;font-size:13px;color:#1f2733;margin-bottom:6px">${esc(o.rotulo)}</div>
            <div style="font-size:12px;line-height:1.55;color:#4a515c">${esc(o.explicacao)}</div>
            <div style="font-size:11.5px;font-weight:700;color:#C1272D;margin-top:9px">${brl(o.valor)}</div>
          </div>`).join('')}
        </div>
        ${d.clienteRecebeuDireto ? `
        <div data-b style="margin-top:14px;background:#fff8ec;border:1px solid #f0d6a8;border-left:4px solid #d99c2b;border-radius:9px;padding:13px 16px">
          <div style="font-weight:800;font-size:12.5px;color:#7a5a12;margin-bottom:5px">Por que o crédito do processo é maior que o valor acima</div>
          <div style="font-size:12px;line-height:1.6;color:#6b5324">Neste caso o dinheiro não entrou todo pela conta do escritório. A condenação (${brl(d.credito.base)}) foi depositada <b>diretamente na conta do cliente</b>; ao escritório o tribunal pagou apenas a sucumbência, e o honorário contratual veio por <b>repasse do próprio cliente</b>. Por isso o crédito total do processo (${brl(d.credito.bruto)}) não é a base da sua fatia — ela incide sobre o honorário do escritório, ${brl(d.nosso.total)}.</div>
        </div>` : ''}
      </div>

      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">${nSec()}</span><span style="${secTit}">Como se chegou à sua fatia</span></div>
        <div style="${secSub}">Do honorário do escritório até o valor que sai para você.</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden">
          <tr><td style="${cell}">Honorário do escritório neste processo <span style="color:#6b7480">(contratual + sucumbência)</span></td><td style="${val}">(+) ${brl(d.nosso.total)}</td></tr>
          <tr style="background:#f5f8fc"><td style="${cell}"><b>${esc(d.advogado.nome)}</b>${d.advogado.pct != null ? ` <span style="color:#6b7480">(${pct(d.advogado.pct)})</span>` : ''}</td><td style="${val};font-weight:800;color:#1f8a4c">(−) ${brl(d.advogado.valor)}</td></tr>
          ${d.outros.map((o) => `<tr><td style="${cell}">${esc(o.nome)}</td><td style="${val}">(−) ${brl(o.valor)}</td></tr>`).join('')}
          <tr style="background:#eef4fb"><td style="${cell};border-bottom:none;font-weight:800">Fica com o escritório${d.escritorio.pct != null ? ` <span style="font-weight:400;color:#6b7480">(${pct(d.escritorio.pct)})</span>` : ''}</td><td style="${val};border-bottom:none;font-weight:800">(=) ${brl(d.escritorio.valor)}</td></tr>
        </table>
        <div style="font-size:12px;line-height:1.6;color:#4a515c;margin-top:10px">A fatia incide sobre o honorário do escritório — nunca sobre o crédito bruto do processo, que em boa parte é dinheiro do cliente. As despesas do caso já adiantadas pelo escritório, quando houver, são reembolso e também não entram nessa base.</div>
      </div>

      ${ex ? `
      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">${nSec()}</span><span style="${secTit}">O caso ainda não acabou</span></div>
        <div style="${secSub}">Este recebimento é parcial — haverá nova prestação.</div>
        <div style="font-size:12.5px;line-height:1.6">Executamos no processo ${brl(ex.totalExecutado)} e recebemos ${brl(ex.recebido)}. Falta ${brl(ex.remanescente)}, que continua em cobrança. Quando entrar, a mesma divisão se repete e você recebe um documento como este.</div>
      </div>` : ''}

      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">${nSec()}</span><span style="${secTit}">Considerações finais</span></div>
        <div style="font-size:12.5px;line-height:1.6;margin-top:10px">${pago
          ? `O valor de <b>${brl(d.advogado.valor)}</b> já foi transferido${d.advogado.repasseData ? ` em ${esc(d.advogado.repasseData)}` : ''}.`
          : `O valor de <b>${brl(d.advogado.valor)}</b> será transferido para a sua conta.`} Qualquer divergência nesses números, é só apontar — o demonstrativo do processo está à disposição.</div>
        ${d.anexos?.length ? `<div style="font-size:12.5px;line-height:1.6;margin-top:8px">Seguem anexos a este documento: ${esc([
          d.anexos.some((a) => a.origem === 'alvara') ? 'o alvará do processo' : '',
          d.anexos.some((a) => a.origem === 'comprovante') ? 'o comprovante da transferência da sua parte' : '',
        ].filter(Boolean).join(' e '))}.</div>` : ''}
        <div style="font-size:12.5px;line-height:1.6;margin-top:8px">Obrigado pelo trabalho neste caso.</div>
        <div style="margin-top:18px;font-size:12px;color:#7b8798">Atenciosamente,</div>
        <div style="margin-top:4px;font-weight:800;color:#1f2126;font-size:13px">FRIDER ANDRADE <span style="color:#C1272D">▪</span> ADVOGADOS</div>
        <div style="font-size:11px;color:#9aa6b6">Seus direitos. Nossa prioridade.</div>
      </div>
    </div>
  </div>`;
}

/** Renderiza o HTML offscreen, vira imagem e monta o PDF A4 paginado. Retorna Blob. */
export async function gerarRepasseAdvogadoPdf(d: RepasseAdvogadoDados, onAnexoFalhou?: (nomes: string[]) => void): Promise<Blob> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none';
  host.innerHTML = buildHtml(d);
  document.body.appendChild(host);
  const root = host.firstElementChild as HTMLElement;
  // Quebra só no topo de um bloco marcado — nunca no meio de uma tabela ou de um card.
  const rootTop = root.getBoundingClientRect().top;
  const marcados = Array.from(root.querySelectorAll('[data-b]')) as HTMLElement[];
  const topos = (marcados.length ? marcados : [root]).map((b) => b.getBoundingClientRect().top - rootTop);

  let full: HTMLCanvasElement;
  try {
    full = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  } finally {
    document.body.removeChild(host);
  }

  const pdf = await PDFDocument.create();
  const A4W = 595.28, A4H = 841.89;
  const S = full.width / 794;
  const MARG_LAT = 26, MARG_TOPO = 30, MARG_BASE = 30;
  const larguraPt = A4W - 2 * MARG_LAT;
  const sf = larguraPt / full.width;
  const pxPorPagina = (A4H - MARG_TOPO - MARG_BASE) / sf;
  const quebras = topos.map((t) => t * S).concat([full.height]);
  let y = 0;
  while (y < full.height - 1) {
    const cabem = quebras.filter((b) => b > y + 1 && b <= y + pxPorPagina);
    const end = cabem.length ? Math.max(...cabem) : Math.min(y + pxPorPagina, full.height);
    const sliceH = Math.max(1, Math.round(end - y));
    const cut = document.createElement('canvas');
    cut.width = full.width; cut.height = sliceH;
    const ctx = cut.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cut.width, cut.height);
    ctx.drawImage(full, 0, y, full.width, sliceH, 0, 0, full.width, sliceH);
    const png = await (await fetch(cut.toDataURL('image/png'))).arrayBuffer();
    const img = await pdf.embedPng(png);
    const hpt = sliceH * sf;
    const page = pdf.addPage([A4W, A4H]);
    page.drawImage(img, { x: MARG_LAT, y: A4H - MARG_TOPO - hpt, width: larguraPt, height: hpt });
    y = end;
  }
  // ANEXA o alvará e o comprovante da transferência (PDF → páginas; imagem → página cheia).
  // Falha de anexo NÃO pode passar calada: o PDF sai com cara de completo e o advogado recebe
  // a prestação sem a prova do pagamento. Quem chama decide o que fazer, mas fica sabendo.
  const falhas: string[] = [];
  for (const a of d.anexos ?? []) {
    try {
      const bytes = await (await fetch(anexoHref(a as any))).arrayBuffer();
      const isPdf = /pdf/i.test(a.mime) || /\.pdf$/i.test(a.name);
      if (isPdf) {
        const donor = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await pdf.copyPages(donor, donor.getPageIndices());
        pages.forEach((p) => pdf.addPage(p));
      } else if (/png|jpe?g/i.test(a.mime) || /\.(png|jpe?g)$/i.test(a.name)) {
        const aimg = (/png/i.test(a.mime) || /\.png$/i.test(a.name)) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const p = pdf.addPage([A4W, A4H]);
        const sc = Math.min(A4W / aimg.width, (A4H - 60) / aimg.height, 1);
        p.drawImage(aimg, { x: (A4W - aimg.width * sc) / 2, y: A4H - 30 - aimg.height * sc, width: aimg.width * sc, height: aimg.height * sc });
      }
    } catch (e) {
      falhas.push(a.name || 'anexo');
      console.error('[repasse-advogado] anexo não entrou no PDF:', a.name, e);
    }
  }
  if (falhas.length) onAnexoFalhou?.(falhas);

  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: 'application/pdf' });
}

/** Nome do arquivo que o advogado recebe — cliente + advogado, para não virar "documento.pdf". */
export function nomeRepasseAdvogadoPdf(d: RepasseAdvogadoDados): string {
  const limpo = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '-');
  return `prestacao-de-contas-${limpo(d.advogado.nome) || 'advogado'}-${limpo(d.processo.cliente) || 'processo'}.pdf`;
}
