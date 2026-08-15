// Gera o PDF da prestação de contas NO NAVEGADOR, renderizando HTML/CSS real (html2canvas) —
// visual idêntico ao layout do escritório (banda escura, hero verde, seções, tabela, cards) —
// e monta o PDF com pdf-lib, anexando o alvará/comprovante ao final. Sem Chromium/servidor.
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas-pro';
import { anexoHref, type PrestacaoDados } from '../services/financeiro.service';

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildHtml(d: PrestacaoDados): string {
  const baseTxt = d.sucBaseTipo === 'Valor da causa' ? 'o valor atualizado da causa' : d.sucBaseTipo === 'Proveito econômico' ? 'o proveito econômico' : 'o valor da condenação';
  const baseVal = (d.sucBaseTipo === 'Valor da causa' || d.sucBaseTipo === 'Proveito econômico') ? d.valorCausa : d.condenacao;
  const sucCap = d.sucPct && baseVal ? `${d.sucPct}% sobre ${baseTxt} (${brl(baseVal)}) = ${brl(d.suc)}` : `Total: ${brl(d.suc)}`;
  const honCap = d.honPct ? `${d.honPct}% sobre a condenação (${brl(d.condenacao)}) = ${brl(d.hon)}` : `Total: ${brl(d.hon)}`;
  const sub = [`Ação judicial`, d.autos ? `Autos nº ${esc(d.autos)}` : ''].filter(Boolean).join(' · ');
  const linha2 = `Cliente: ${esc(d.cliente || '-')}${d.reu ? `&nbsp;&nbsp;·&nbsp;&nbsp;Réu: ${esc(d.reu)}` : ''}`;
  const F = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
  const cell = `padding:11px 14px;font-size:12.5px;color:#20262f;border-bottom:1px solid #eef0f3`;
  const val = `padding:11px 14px;font-size:12.5px;text-align:right;white-space:nowrap;border-bottom:1px solid #eef0f3;font-variant-numeric:tabular-nums`;
  const secNum = `color:#9aa6b6;font-weight:800;font-size:15px;margin-right:8px`;
  const secTit = `color:#1f2733;font-weight:800;font-size:15px`;
  const secSub = `color:#7b8798;font-style:italic;font-size:12.5px;margin:3px 0 12px`;
  return `
  <div style="width:794px;background:#fff;font-family:${F};color:#20262f;box-sizing:border-box">
    <div style="background:#2b3242;padding:26px 40px 22px">
      <span style="display:inline-block;background:#3f6db0;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:5px">Frider Andrade · Advogados</span>
      <div style="color:#fff;font-size:29px;font-weight:800;margin:13px 0 7px;letter-spacing:-.01em">Prestação de contas</div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${esc(sub)}</div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${linha2}</div>
    </div>
    <div style="padding:26px 40px 34px">
      <div style="background:#e9f7ef;border:1px solid #7cc79a;border-left:5px solid #2f9e57;border-radius:10px;padding:15px 20px">
        <div style="color:#2f7d4f;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase">Valor líquido que será transferido a você</div>
        <div style="color:#1f8a4c;font-size:31px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums">${brl(d.liquido)}</div>
      </div>

      <div style="margin-top:28px">
        <div><span style="${secNum}">01</span><span style="${secTit}">Como chegamos a esse valor</span></div>
        <div style="${secSub}">Do valor depositado no alvará até o que é efetivamente seu.</div>
        <div style="font-size:12.5px;margin-bottom:12px">A parte contrária depositou <b>${brl(d.bruto)}</b> no alvará judicial. Veja como esse valor se divide:</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden">
          <tr><td style="${cell}">Valor total depositado (alvará)</td><td style="${val}">(+) ${brl(d.bruto)}</td></tr>
          <tr><td style="${cell}">Honorários sucumbenciais <span style="color:#6b7480">(pagos pela parte contrária, por lei — não saem do seu bolso)</span></td><td style="${val}">(-) ${brl(d.suc)}</td></tr>
          <tr style="background:#f5f8fc"><td style="${cell}">Valor da sua condenação</td><td style="${val}">(=) ${brl(d.condenacao)}</td></tr>
          <tr><td style="${cell}">Honorários contratuais do escritório${d.honPct ? ` <span style="color:#6b7480">(${d.honPct}% conforme contrato)</span>` : ''}</td><td style="${val}">(-) ${brl(d.hon)}</td></tr>
          <tr style="background:#eef4fb"><td style="${cell};border-bottom:none;font-weight:800">Valor líquido a transferir para você</td><td style="${val};border-bottom:none;font-weight:800;color:#1f8a4c">(=) ${brl(d.liquido)}</td></tr>
        </table>
      </div>

      <div style="margin-top:26px">
        <div><span style="${secNum}">02</span><span style="${secTit}">Entendendo as verbas</span></div>
        <div style="${secSub}">Por que o depósito é maior do que você recebe. São duas partes distintas.</div>
        <div style="display:flex;gap:14px">
          <div style="flex:1;border:1px solid #e3e6eb;border-radius:10px;padding:14px 16px">
            <div style="font-weight:800;font-size:13px;color:#1f2733;margin-bottom:6px">Honorários de sucumbência</div>
            <div style="font-size:12px;line-height:1.55;color:#4a515c">Verba que a lei obriga a parte que perdeu a pagar diretamente ao advogado da parte vencedora (art. 85 do CPC). Não sai do seu bolso — esse dinheiro nunca foi seu.</div>
            <div style="font-size:11.5px;font-weight:700;color:#3f6db0;margin-top:9px">${sucCap}</div>
          </div>
          <div style="flex:1;border:1px solid #e3e6eb;border-radius:10px;padding:14px 16px">
            <div style="font-weight:800;font-size:13px;color:#1f2733;margin-bottom:6px">Honorários contratuais</div>
            <div style="font-size:12px;line-height:1.55;color:#4a515c">Honorários de êxito previstos no contrato que você assinou. Incidem apenas sobre a sua condenação — não sobre o total do alvará.</div>
            <div style="font-size:11.5px;font-weight:700;color:#3f6db0;margin-top:9px">${honCap}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:26px">
        <div><span style="${secNum}">03</span><span style="${secTit}">Considerações finais</span></div>
        <div style="font-size:12.5px;line-height:1.6;margin-top:10px">O valor de <b>${brl(d.liquido)}</b> será transferido para a sua conta. Qualquer dúvida sobre esses números ou sobre o andamento do caso, estamos à disposição para explicar com calma.</div>
        <div style="font-size:12.5px;line-height:1.6;margin-top:8px">Foi um prazer lutar pelos seus direitos. Obrigado pela confiança!</div>
        <div style="margin-top:18px;font-size:12px;color:#7b8798">Atenciosamente,</div>
        <div style="margin-top:4px;font-weight:800;color:#2b3242;font-size:13px">FRIDER ANDRADE · ADVOGADOS</div>
        <div style="font-size:11px;color:#9aa6b6">Seus direitos. Nossa prioridade.</div>
      </div>
    </div>
  </div>`;
}

/** Renderiza o HTML offscreen, vira imagem e monta o PDF (paginado A4) + anexa o alvará. Retorna Blob. */
export async function gerarPrestacaoPdf(d: PrestacaoDados): Promise<Blob> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none';
  host.innerHTML = buildHtml(d);
  document.body.appendChild(host);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(host.firstElementChild as HTMLElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  } finally {
    document.body.removeChild(host);
  }
  const pngBytes = await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();

  const pdf = await PDFDocument.create();
  const A4W = 595.28, A4H = 841.89;
  const img = await pdf.embedPng(pngBytes);
  const scale = A4W / img.width;
  const imgHpt = img.height * scale;
  const nPages = Math.max(1, Math.ceil(imgHpt / A4H));
  for (let i = 0; i < nPages; i++) {
    const page = pdf.addPage([A4W, A4H]);
    page.drawImage(img, { x: 0, y: A4H * (i + 1) - imgHpt, width: A4W, height: imgHpt });
  }

  // Anexa o alvará/comprovante (PDF → páginas; imagem → página cheia)
  for (const a of d.anexos) {
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
        const s = Math.min(A4W / aimg.width, (A4H - 60) / aimg.height, 1);
        p.drawImage(aimg, { x: (A4W - aimg.width * s) / 2, y: A4H - 30 - aimg.height * s, width: aimg.width * s, height: aimg.height * s });
      }
    } catch {
      /* anexo com problema — ignora e segue */
    }
  }

  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: 'application/pdf' });
}
