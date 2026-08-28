// PDF da GUIA PARA O CONTADOR, renderizado no navegador (html2canvas + pdf-lib), no mesmo
// padrão visual da prestação de contas. O contador recebe um documento, não um bloco de texto
// colado no WhatsApp — e o que é receita do escritório fica separado do que é dinheiro do
// cliente, que é o erro clássico: notar o alvará inteiro e pagar imposto sobre valor alheio.
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas-pro';
import type { GuiaContabil } from '../services/financeiro.service';

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildHtml(g: GuiaContabil): string {
  const cell = 'padding:9px 12px;border-bottom:1px solid #e8ecf1;font-size:12.5px;color:#333a45';
  const val = `${cell};text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap`;
  const rot = 'font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a94a3';
  const dado = 'font-size:12.5px;color:#1f2126;margin-top:2px';
  const secNum = 'color:#C1272D;font-weight:800;font-size:13px;margin-right:6px';
  const secTit = 'font-weight:800;font-size:13.5px;color:#1f2126';
  const linha = (r: string, v: string, falta = false) =>
    `<div style="margin-bottom:9px"><div style="${rot}">${esc(r)}</div><div style="${dado}${falta ? ';color:#b4232a;font-weight:700' : ''}">${falta ? '⚠️ não cadastrado' : esc(v)}</div></div>`;

  return `<div style="width:794px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#1f2126">
    <div data-b style="background:#1f2126;padding:26px 34px 22px">
      <span style="display:inline-block;background:#C1272D;color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.09em;padding:4px 9px;border-radius:4px">FRIDER ANDRADE ▪ ADVOGADOS</span>
      <div style="color:#fff;font-size:25px;font-weight:800;margin-top:12px">Guia para emissão de nota<span style="color:#C1272D">.</span></div>
      <div style="color:#aeb8c6;font-size:11.5px;margin-top:5px">Competência ${esc(g.competencia || '—')}${g.dataRecebimento ? ` · recebido em ${esc(g.dataRecebimento)}` : ''}</div>
    </div>
    <div style="padding:22px 34px 30px">
      <div data-b style="border:1.4px solid #1f8a4c;background:#f2fbf5;border-radius:10px;padding:14px 18px">
        <div style="${rot};color:#1f8a4c">Valor a notar</div>
        <div style="color:#1f8a4c;font-size:29px;font-weight:800;font-variant-numeric:tabular-nums">${brl(g.valores.baseNota)}</div>
        <div style="font-size:11.5px;color:#3f7d5c;margin-top:3px">honorário contratual ${brl(g.valores.contratual)} + sucumbência ${brl(g.valores.sucumbencia)}</div>
      </div>

      ${g.faltando.length ? `<div style="margin-top:12px;border:1px solid #e6b800;background:#fff9e6;border-radius:8px;padding:10px 14px;font-size:11.5px;color:#7a5c00">
        <b>Falta cadastrar:</b> ${esc(g.faltando.join(', '))}. A guia vai assim mesmo, mas o contador precisará desses dados.
      </div>` : ''}

      <div data-b style="margin-top:24px">
        <div><span style="${secNum}">01</span><span style="${secTit}">Tomador do serviço (cliente)</span></div>
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:0 26px">
          <div>
            ${linha('Nome', g.tomador.nome, !g.tomador.nome)}
            ${linha('CPF / CNPJ', g.tomador.documento, !g.tomador.documento)}
          </div>
          <div>
            ${linha('Endereço', g.tomador.endereco, !g.tomador.endereco)}
            ${g.tomador.email ? linha('E-mail', g.tomador.email) : ''}
          </div>
        </div>
      </div>

      <div data-b style="margin-top:14px">
        <div><span style="${secNum}">02</span><span style="${secTit}">Processo</span></div>
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:0 26px">
          <div>${linha('Autos', g.processo.autos || '—')}${g.processo.juizo ? linha('Juízo', g.processo.juizo) : ''}</div>
          <div>${g.processo.reu ? linha('Parte adversa', g.processo.reu) : ''}${g.prestador.cnpj ? linha('Prestador', `${g.prestador.razaoSocial || 'Frider Andrade'} · CNPJ ${g.prestador.cnpj}`) : ''}</div>
        </div>
      </div>

      <div data-b style="margin-top:14px">
        <div><span style="${secNum}">03</span><span style="${secTit}">Composição do valor a notar</span></div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;border:1px solid #e8ecf1;border-radius:8px;overflow:hidden">
          <tr><td style="${cell}">Honorário contratual${g.valores.contratual ? '' : ''}</td><td style="${val}">${brl(g.valores.contratual)}</td></tr>
          <tr><td style="${cell}">Honorário de sucumbência <span style="color:#6b7480">(art. 23 da Lei 8.906/94 — pago pela parte contrária, receita do escritório)</span></td><td style="${val}">${brl(g.valores.sucumbencia)}</td></tr>
          <tr style="background:#f2fbf5"><td style="${cell};border-bottom:none;font-weight:800">Base da nota fiscal</td><td style="${val};border-bottom:none;font-weight:800;color:#1f8a4c">${brl(g.valores.baseNota)}</td></tr>
        </table>
        <div style="margin-top:10px;font-size:11.5px;color:#4a515c"><b>Discriminação sugerida:</b> “Honorários advocatícios${g.processo.autos ? ` — ação judicial nº ${esc(g.processo.autos)}` : ''}”.</div>
      </div>

      <div data-b style="margin-top:18px;border-left:3px solid #C1272D;background:#fbf6f6;border-radius:0 8px 8px 0;padding:12px 16px">
        <div style="font-weight:800;font-size:12.5px;margin-bottom:6px">Não entra na nota</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="${cell};border-bottom:1px solid #eee0e0">Valor bruto depositado no alvará</td><td style="${val};border-bottom:1px solid #eee0e0">${brl(g.valores.bruto)}</td></tr>
          <tr><td style="${cell};border-bottom:${g.valores.reembolsoCustas > 0 ? '1px solid #eee0e0' : 'none'}">Repassado ao cliente</td><td style="${val};border-bottom:${g.valores.reembolsoCustas > 0 ? '1px solid #eee0e0' : 'none'}">${brl(g.valores.repasseCliente)}</td></tr>
          ${g.valores.reembolsoCustas > 0 ? `<tr><td style="${cell};border-bottom:none">Reembolso de custas adiantadas pelo cliente</td><td style="${val};border-bottom:none">${brl(g.valores.reembolsoCustas)}</td></tr>` : ''}
        </table>
        <div style="font-size:11.5px;color:#7a4a4a;margin-top:8px">Esses valores passaram pela conta do escritório mas <b>não são receita</b>: pertencem ao cliente. Notar o alvará inteiro faria o escritório pagar imposto sobre dinheiro alheio.</div>
      </div>

      <div style="margin-top:20px;font-size:11px;color:#9aa6b6">Documento gerado pelo sistema do escritório a partir do lançamento do alvará. Em caso de dúvida sobre a composição, consulte a prestação de contas do mesmo processo.</div>
    </div>
  </div>`;
}

/** Renderiza offscreen, vira imagem e monta o PDF A4 paginado. Retorna Blob. */
export async function gerarGuiaContabilPdf(g: GuiaContabil): Promise<Blob> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none';
  host.innerHTML = buildHtml(g);
  document.body.appendChild(host);
  const root = host.firstElementChild as HTMLElement;
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
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
