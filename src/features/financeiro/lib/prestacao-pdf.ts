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
  // Se o contratual saiu ABAIXO do % do contrato, foi reduzido (art. 50 da OAB: o escritório não
  // pode ficar com mais que o cliente). Detecta comparando o honorário pago com o cheio do contrato.
  // Decomposição: reembolsos e descontos só aparecem quando existem, então a prestação de um
  // caso simples sai exatamente como sempre saiu.
  const reembCli = Math.round((d.reembCli ?? 0) * 100) / 100;
  const reembEsc = Math.round((d.reembEsc ?? 0) * 100) / 100;
  const deducoes = (d.deducoes ?? []).filter((x) => Number(x.valor) > 0);
  const temExtras = reembCli > 0 || reembEsc > 0 || deducoes.length > 0;
  const honCheio = d.honPct && d.condenacao ? Math.round(d.condenacao * (d.honPct / 100) * 100) / 100 : null;
  const reduziu = honCheio != null && d.hon < honCheio - 0.01;
  const nosso = Math.round((d.suc + d.hon) * 100) / 100; // o que fica com o escritório (contratual + sucumbência)
  const respeitaTeto = nosso <= d.liquido + 0.01; // escritório não ficou com mais que o cliente
  const honCap = reduziu
    ? `Reduzido para ${brl(d.hon)} — abaixo dos ${d.honPct}% do contrato (${brl(honCheio!)})`
    : (d.honPct ? `${d.honPct}% sobre a condenação (${brl(d.condenacao)}) = ${brl(d.hon)}` : `Total: ${brl(d.hon)}`);
  // PAGAMENTO PARCIAL: o banco depositou menos que o executado. Sem este bloco o cliente
  // recebe um documento que parece encerrar o caso, quando ainda se briga pelo resto.
  const ex = d.execucao && d.execucao.remanescente > 0 ? d.execucao : null;
  const pctFalta = ex && ex.totalExecutado > 0 ? Math.round((ex.remanescente / ex.totalExecutado) * 100) : 0;
  const pctPago = 100 - pctFalta;
  const sub = [`Ação judicial`, d.autos ? `Autos nº ${esc(d.autos)}` : ''].filter(Boolean).join(' · ');
  const linha2 = `Cliente: ${esc(d.cliente || '-')}${d.reu ? `&nbsp;&nbsp;·&nbsp;&nbsp;Réu: ${esc(d.reu)}` : ''}`;
  const F = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
  const cell = `padding:11px 14px;font-size:12.5px;color:#20262f;border-bottom:1px solid #eef0f3`;
  const val = `padding:11px 14px;font-size:12.5px;text-align:right;white-space:nowrap;border-bottom:1px solid #eef0f3;font-variant-numeric:tabular-nums`;
  const secNum = `color:#C1272D;font-weight:800;font-size:15px;margin-right:8px`;
  const secTit = `color:#1f2733;font-weight:800;font-size:15px`;
  const secSub = `color:#7b8798;font-style:italic;font-size:12.5px;margin:3px 0 12px`;
  return `
  <div style="width:794px;background:#fff;font-family:${F};color:#20262f;box-sizing:border-box">
    <div data-b style="background:#1f2126;padding:26px 34px 22px;border-radius:12px">
      <span style="display:inline-block;background:#C1272D;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:5px">Frider Andrade&nbsp;<span style="color:#fff">▪</span>&nbsp;Advogados</span>
      <div style="color:#fff;font-size:29px;font-weight:800;margin:13px 0 7px;letter-spacing:-.01em">Prestação de contas<span style="color:#C1272D">.</span></div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${esc(sub)}</div>
      <div style="color:#b8c1d1;font-size:12.5px;line-height:1.5">${linha2}</div>
    </div>
    <div style="padding:22px 34px 14px">
      <div data-b style="background:#e9f7ef;border:1px solid #7cc79a;border-left:5px solid #2f9e57;border-radius:10px;padding:15px 20px">
        <div style="color:#2f7d4f;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase">Valor líquido que será transferido a você${ex ? ' agora' : ''}</div>
        <div style="color:#1f8a4c;font-size:31px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums">${brl(d.liquido)}</div>
        ${ex ? `<div style="color:#2f7d4f;font-size:11.5px;margin-top:6px">Este é um <b>pagamento parcial</b>. O processo continua, e ainda cobramos ${brl(ex.remanescente)} do banco.</div>` : ''}
      </div>

      <div data-b style="margin-top:28px">
        <div><span style="${secNum}">01</span><span style="${secTit}">Como chegamos a esse valor</span></div>
        <div style="${secSub}">Do valor depositado no alvará até o que é efetivamente seu.</div>
        <div style="font-size:12.5px;margin-bottom:12px">A parte contrária depositou <b>${brl(d.bruto)}</b> no alvará judicial. Veja como esse valor se divide:</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden">
          <tr><td style="${cell}">Valor total depositado (alvará)</td><td style="${val}">(+) ${brl(d.bruto)}</td></tr>
          <tr><td style="${cell}">Honorários sucumbenciais <span style="color:#6b7480">(pagos pela parte contrária, por lei — não saem do seu bolso)</span></td><td style="${val}">(-) ${brl(d.suc)}</td></tr>
          ${reembEsc > 0 ? `<tr><td style="${cell}">Despesas processuais adiantadas pelo escritório <span style="color:#6b7480">(devolução)</span></td><td style="${val}">(-) ${brl(reembEsc)}</td></tr>` : ''}
          ${reembCli > 0 ? `<tr><td style="${cell}">Reembolso das custas que <b>você</b> adiantou <span style="color:#6b7480">(volta integral para você, sem desconto de honorários)</span></td><td style="${val}">(-) ${brl(reembCli)}</td></tr>` : ''}
          <tr style="background:#f5f8fc"><td style="${cell}">${temExtras ? 'Valor da sua condenação <span style="color:#6b7480">(base dos honorários contratuais)</span>' : 'Valor da sua condenação'}</td><td style="${val}">(=) ${brl(d.condenacao)}</td></tr>
          <tr><td style="${cell}">Honorários contratuais do escritório${d.honPct ? ` <span style="color:#6b7480">(${d.honPct}% conforme contrato)</span>` : ''}</td><td style="${val}">(-) ${brl(d.hon)}</td></tr>
          ${temExtras ? `<tr style="background:#f5f8fc"><td style="${cell}">Sua parte da condenação</td><td style="${val}">(=) ${brl(Math.round((d.condenacao - d.hon) * 100) / 100)}</td></tr>` : ''}
          ${reembCli > 0 ? `<tr><td style="${cell}">Reembolso das custas que você adiantou</td><td style="${val}">(+) ${brl(reembCli)}</td></tr>` : ''}
          ${deducoes.map((x) => `<tr><td style="${cell}">${esc(x.label)}${x.cnjIncidente ? ` <span style="color:#6b7480">(autos nº ${esc(x.cnjIncidente)})</span>` : ''}</td><td style="${val}">(-) ${brl(x.valor)}</td></tr>`).join('')}
          <tr style="background:#eef4fb"><td style="${cell};border-bottom:none;font-weight:800">Valor líquido a transferir para você</td><td style="${val};border-bottom:none;font-weight:800;color:#1f8a4c">(=) ${brl(d.liquido)}</td></tr>
        </table>
      </div>

      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">02</span><span style="${secTit}">Entendendo as verbas</span></div>
        <div style="${secSub}">Por que o depósito é maior do que você recebe. São duas partes distintas.</div>
        <div style="display:flex;gap:14px">
          <div style="flex:1;border:1px solid #e3e6eb;border-radius:10px;padding:14px 16px">
            <div style="font-weight:800;font-size:13px;color:#1f2733;margin-bottom:6px">Honorários de sucumbência</div>
            <div style="font-size:12px;line-height:1.55;color:#4a515c">Verba que a lei obriga a parte que perdeu a pagar diretamente ao advogado da parte vencedora (art. 85 do CPC). Não sai do seu bolso — esse dinheiro nunca foi seu.</div>
            <div style="font-size:11.5px;font-weight:700;color:#C1272D;margin-top:9px">${sucCap}</div>
          </div>
          <div style="flex:1;border:1px solid #e3e6eb;border-radius:10px;padding:14px 16px">
            <div style="font-weight:800;font-size:13px;color:#1f2733;margin-bottom:6px">Honorários contratuais</div>
            <div style="font-size:12px;line-height:1.55;color:#4a515c">Honorários de êxito previstos no contrato que você assinou. Incidem apenas sobre a sua condenação — não sobre o total do alvará.</div>
            <div style="font-size:11.5px;font-weight:700;color:#C1272D;margin-top:9px">${honCap}</div>
          </div>
        </div>
        <div data-b style="margin-top:14px;background:#f7f9fc;border:1px solid #e3e6eb;border-left:4px solid #1f2126;border-radius:9px;padding:13px 16px">
          <div style="font-weight:800;font-size:12.5px;color:#1f2733;margin-bottom:5px">Por que este valor é seu</div>
          <div style="font-size:12px;line-height:1.6;color:#4a515c">Este valor é seu por direito: corresponde à sua condenação (${brl(d.condenacao)}) menos os honorários contratuais que você aceitou em contrato. A sucumbência não entra nessa conta — a lei manda a parte contrária pagá-la diretamente ao escritório (art. 85 do CPC), e por isso ela nunca reduz o que é seu.${deducoes.length ? ` Os valores descontados acima são obrigações suas que o escritório quita diretamente do alvará, com comprovante juntado à sua pasta — não são honorários.` : ''}${respeitaTeto ? ` Seguimos ainda o art. 50 do Código de Ética da OAB: os honorários do escritório (contratuais somados à sucumbência) <b>não superam</b> o que fica com você.` : ''}${reduziu ? ` Neste caso, para respeitar esse limite, <b>reduzimos os honorários contratuais</b> abaixo do previsto no contrato — de modo que você não recebesse menos que o escritório.` : ''}</div>
        </div>
      </div>

      ${ex ? `
      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">03</span><span style="${secTit}">O que ainda vamos buscar</span></div>
        <div style="${secSub}">Este pagamento é parcial. A diferença segue em cobrança na Justiça.</div>
        <div style="font-size:12.5px;line-height:1.6;margin-bottom:12px">Executamos no processo um crédito de <b>${brl(ex.totalExecutado)}</b>. O banco depositou <b>${brl(ex.recebido)}</b>, que é o que estamos repassando agora. Falta <b>${brl(ex.remanescente)}</b>, ${pctFalta}% do total, e é isso que continuamos cobrando.</div>
        <div style="display:flex;height:20px;border-radius:5px;overflow:hidden;border:1px solid #e3e6eb">
          <div style="width:${pctPago}%;background:#2f9e57"></div><div style="width:${pctFalta}%;background:#C1272D"></div>
        </div>
        <div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:#6b7480">
          <div style="flex:1"><span style="color:#2f9e57">■</span> Recebido agora · ${brl(ex.recebido)}</div>
          <div style="flex:1;text-align:right"><span style="color:#C1272D">■</span> Em cobrança · ${brl(ex.remanescente)}</div>
        </div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e3e6eb;border-radius:10px;overflow:hidden;margin-top:14px">
          <tr><td style="${cell}">Valor total que executamos no processo</td><td style="${val}">${brl(ex.totalExecutado)}</td></tr>
          <tr><td style="${cell}">Valor que o banco depositou e estamos repassando agora</td><td style="${val}">(-) ${brl(ex.recebido)}</td></tr>
          <tr style="background:#fdf0f0"><td style="${cell};border-bottom:none;font-weight:800">Valor que continua em cobrança na Justiça</td><td style="${val};border-bottom:none;font-weight:800;color:#C1272D">(=) ${brl(ex.remanescente)}</td></tr>
        </table>
        <div style="font-size:12.5px;line-height:1.6;margin-top:12px">Receber esta parte <b>não encerra o processo</b> e não significa que aceitamos o valor pago: o levantamento é feito sobre o que o próprio banco reconheceu como devido, e a diferença continua sendo discutida. Quando houver decisão sobre o restante, você recebe uma nova prestação de contas como esta.</div>
      </div>` : ''}

      <div data-b style="margin-top:26px">
        <div><span style="${secNum}">${ex ? '04' : '03'}</span><span style="${secTit}">Considerações finais</span></div>
        <div style="font-size:12.5px;line-height:1.6;margin-top:10px">O valor de <b>${brl(d.liquido)}</b> será transferido para a sua conta. Qualquer dúvida sobre esses números ou sobre o andamento do caso, estamos à disposição para explicar com calma.</div>
        <div style="font-size:12.5px;line-height:1.6;margin-top:8px">${ex ? 'Seguimos com o processo até o pagamento integral. Obrigado pela confiança!' : 'Foi um prazer lutar pelos seus direitos. Obrigado pela confiança!'}</div>
        <div style="margin-top:18px;font-size:12px;color:#7b8798">Atenciosamente,</div>
        <div style="margin-top:4px;font-weight:800;color:#1f2126;font-size:13px">FRIDER ANDRADE <span style="color:#C1272D">▪</span> ADVOGADOS</div>
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
  const root = host.firstElementChild as HTMLElement;
  // Pontos de quebra SEGUROS: os elementos marcados com data-b (banda, hero, seções e a caixa
  // "por que"). A página só quebra no topo de um deles — nunca no meio de uma tabela/card.
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
  const S = full.width / 794;                 // escala real do canvas (≈ 2)
  // Margem de página uniforme nas 4 bordas — o conteúdo respeita a folha, com topo/rodapé/lados iguais.
  const MARG_LAT = 26, MARG_TOPO = 30, MARG_BASE = 30; // pt
  const larguraPt = A4W - 2 * MARG_LAT;       // área útil de conteúdo (largura)
  const sf = larguraPt / full.width;          // pt por px-canvas (o 794 vira `larguraPt`)
  const pxPorPagina = (A4H - MARG_TOPO - MARG_BASE) / sf; // px-canvas que cabem na altura útil
  const quebras = topos.map((t) => t * S).concat([full.height]); // candidatos (px-canvas) + o fim
  let y = 0;
  while (y < full.height - 1) {
    // maior ponto-de-quebra que ainda cabe na página; se nenhum couber (bloco > 1 página), corta forçado.
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
    const hpt = sliceH * sf;                   // altura da faixa em pt (≤ altura útil)
    const page = pdf.addPage([A4W, A4H]);
    page.drawImage(img, { x: MARG_LAT, y: A4H - MARG_TOPO - hpt, width: larguraPt, height: hpt }); // dentro da margem
    y = end;
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
