'use client';

// Apresentação de vendas REPB (mostrada na reunião de fechamento). Estrutura de
// ANCORAGEM DE PREÇO (modelo da proposta revisional do escritório): value stack
// com preços de tabela (âncora alta) → proposta especial (queda) → oferta para
// fechar NA reunião (irrecusável, com parcelamento + urgência) → casos reais.
// Visual sóbrio/requintado. Tudo é ESTIMATIVA — nunca promessa de resultado
// (OAB art. 41); os disclaimers ficam explícitos.

import { useMemo, useRef, useState } from 'react';
import { X, Printer, Sliders, ShieldCheck, Upload, Loader2, Check, Landmark, Clock, Scale, TrendingDown, Award, Download } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard } from '../services/legal-cases.service';

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = reject;
  r.readAsDataURL(file);
});

const fmtBRL = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const round100 = (v: number) => Math.round(v / 100) * 100;

function parseValor(s?: string | null): number {
  if (!s) return 0;
  const t = s.toLowerCase().replace(/\s+/g, ' ');
  const num = parseFloat(t.replace(/[^0-9,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(num)) return 0;
  if (/\bmilh/.test(t)) return Math.round(num * 1_000_000);
  if (/\bmil\b/.test(t)) return Math.round(num * 1_000);
  return Math.round(num);
}

// Value stack: serviços do trabalho REPB com preço de mercado individual (âncora).
const SERVICOS: [string, number][] = [
  ['Auditoria técnica dos contratos e extratos bancários', 3800],
  ['Levantamento completo (SCR / Registrato / BACEN)', 1500],
  ['Dossiê técnico + parecer de provisionamento', 4500],
  ['Malotes extrajudiciais (protocolos BACEN / Consumidor.gov)', 2500],
  ['Negociação estratégica banco a banco', 6000],
  ['Elaboração e formalização dos acordos', 3500],
  ['Ações judiciais quando necessário (revisional / superendividamento)', 5000],
  ['Acompanhamento completo até a quitação', 4000],
];
const SERVICOS_BASE = SERVICOS.reduce((a, [, v]) => a + v, 0); // 30.800
function porteMult(d: number): number {
  if (d >= 1_000_000) return 2.8;
  if (d >= 500_000) return 2.0;
  if (d >= 300_000) return 1.6;
  if (d >= 100_000) return 1.3;
  return 1.0;
}

const CASOS_DEFAULT = 'Empresa do setor alimentício (PR) · dívida de aproximadamente R$ 243 mil com uma cooperativa de crédito, renegociada e quitada por R$ 150 mil — economia de cerca de R$ 93 mil para o cliente.';

export function ApresentacaoVendasRepb({ card, onClose }: { card: KanbanCard; onClose: () => void }) {
  const nome = (card.client ?? card.title ?? 'Cliente').toUpperCase();
  const d0 = parseValor(card.leadValor);
  const vt0 = round100(SERVICOS_BASE * porteMult(d0));

  const [divida, setDivida] = useState(d0);
  const [pctDesconto, setPctDesconto] = useState(40);
  const [valorTabela, setValorTabela] = useState(vt0);
  const [pctExitoTabela, setPctExitoTabela] = useState(30);
  const [entradaPadrao, setEntradaPadrao] = useState(round100(vt0 * 0.25));
  const [pctExitoPadrao, setPctExitoPadrao] = useState(20);
  const [entradaHoje, setEntradaHoje] = useState(round100(vt0 * 0.14));
  const [parcelasHoje, setParcelasHoje] = useState(4);
  const [pctExitoHoje, setPctExitoHoje] = useState(15);
  const [bancos, setBancos] = useState(card.leadBancos ?? '');
  const [resumo, setResumo] = useState(card.leadResumo ?? '');
  const [casos, setCasos] = useState(CASOS_DEFAULT);
  const [salvando, setSalvando] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const c = useMemo(() => {
    const D = Math.max(0, divida);
    const acordo = round100(D * (1 - pctDesconto / 100));
    const economia = D - acordo;
    const exitoTabela = Math.round((economia * pctExitoTabela) / 100);
    const exitoPadrao = Math.round((economia * pctExitoPadrao) / 100);
    const exitoHoje = Math.round((economia * pctExitoHoje) / 100);
    const anchor = valorTabela + exitoTabela;
    const padrao = entradaPadrao + exitoPadrao;
    const oferta = entradaHoje + exitoHoje;
    const liquido = economia - oferta;
    const liquidoPadrao = economia - padrao;
    const economizaVsPadrao = Math.max(0, padrao - oferta);
    const descTabela = valorTabela > 0 ? Math.round((1 - entradaPadrao / valorTabela) * 100) : 0;
    const parcela = parcelasHoje > 0 ? Math.round(entradaHoje / parcelasHoje) : entradaHoje;
    return { D, acordo, economia, exitoTabela, exitoPadrao, exitoHoje, anchor, padrao, oferta, liquido, liquidoPadrao, economizaVsPadrao, descTabela, parcela };
  }, [divida, pctDesconto, valorTabela, pctExitoTabela, entradaPadrao, pctExitoPadrao, entradaHoje, pctExitoHoje, parcelasHoje]);

  const stack = useMemo(() => {
    const f = SERVICOS_BASE > 0 ? valorTabela / SERVICOS_BASE : 1;
    return SERVICOS.map(([n, base]) => ({ n, v: round100(base * f) }));
  }, [valorTabela]);

  const casosList = casos.split('\n').map((s) => s.trim()).filter(Boolean);

  const salvar = async () => {
    setSalvando(true);
    try {
      await legalCasesService.saveFaseField(card.id, 'repbc_reuniao_agendada', 'apresentacao',
        { divida, pctDesconto, valorTabela, pctExitoTabela, entradaPadrao, pctExitoPadrao, entradaHoje, parcelasHoje, pctExitoHoje, bancos, resumo, casos, geradoEm: new Date().toISOString() });
      toast.success('Dados salvos');
    } catch { toast.error('Não consegui salvar'); } finally { setSalvando(false); }
  };

  const extrairDePdf = async (file: File) => {
    setExtraindo(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await legalCasesService.extrairDividaRepb(card.id, b64);
      if (r.dividaTotal != null) { setDivida(r.dividaTotal); const nv = round100(SERVICOS_BASE * porteMult(r.dividaTotal)); setValorTabela(nv); setEntradaPadrao(round100(nv * 0.25)); setEntradaHoje(round100(nv * 0.14)); }
      if (r.bancos?.length) setBancos(r.bancos.map((b) => b.valor != null ? `${b.nome} (${fmtBRL(b.valor)})` : b.nome).join(', '));
      if (r.resumo) setResumo(r.resumo);
      toast.success('Dados extraídos do documento');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui extrair a dívida do PDF');
    } finally { setExtraindo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // Baixa o SLIDE como PDF direto (sem o diálogo de impressão do navegador).
  // html2canvas-pro suporta as cores oklch do Tailwind v4; jsPDF monta o A4 e
  // fatia em páginas se o slide for mais alto que uma folha.
  const baixarPdf = async () => {
    const el = slideRef.current;
    if (!el) return;
    setBaixandoPdf(true);
    try {
      await salvar();
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      let position = 0;
      let heightLeft = imgH;
      pdf.addImage(img, 'JPEG', 0, position, pw, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        position -= ph;
        pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, position, pw, imgH);
        heightLeft -= ph;
      }
      const safe = (nome || 'cliente').replace(/[^\p{L}\p{N} .-]/gu, '').trim() || 'cliente';
      pdf.save(`Proposta REPB - ${safe}.pdf`);
    } catch (e) {
      toast.error('Não consegui gerar o PDF. Use "Imprimir" e salve como PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950">
      {/* Barra de topo — some na impressão */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Sliders className="h-4 w-4 text-[#B7791F]" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Apresentação de vendas — {nome}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={baixarPdf} disabled={baixandoPdf} className="inline-flex items-center gap-1 rounded-lg bg-[#B7791F] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{baixandoPdf ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF…</> : <><Download className="h-4 w-4" /> Baixar PDF</>}</button>
          <button onClick={() => { salvar(); window.print(); }} title="Imprimir (salvar como PDF pelo navegador)" className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"><Printer className="h-4 w-4" /> Imprimir</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{salvando ? 'Salvando…' : 'Salvar dados'}</button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Painel de ajuste — some na impressão */}
      <div className="no-print shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Dívida total (R$)"><input type="number" value={divida || ''} onChange={(e) => setDivida(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Desconto-alvo (%)"><input type="number" value={pctDesconto} onChange={(e) => setPctDesconto(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Valor de tabela (R$)"><input type="number" value={valorTabela || ''} onChange={(e) => setValorTabela(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Êxito tabela (%)"><input type="number" value={pctExitoTabela} onChange={(e) => setPctExitoTabela(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Entrada padrão (R$)"><input type="number" value={entradaPadrao || ''} onChange={(e) => setEntradaPadrao(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Êxito padrão (%)"><input type="number" value={pctExitoPadrao} onChange={(e) => setPctExitoPadrao(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Entrada p/ fechar hoje (R$)"><input type="number" value={entradaHoje || ''} onChange={(e) => setEntradaHoje(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Parcelas (hoje)"><input type="number" value={parcelasHoje} onChange={(e) => setParcelasHoje(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Êxito hoje (%)"><input type="number" value={pctExitoHoje} onChange={(e) => setPctExitoHoje(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Bancos"><input value={bancos} onChange={(e) => setBancos(e.target.value)} className={INPUT} /></Field>
          <div className="col-span-2 sm:col-span-3 lg:col-span-2"><Field label="Casos reais (um por linha)"><textarea value={casos} onChange={(e) => setCasos(e.target.value)} rows={2} className={INPUT + ' h-auto py-1.5'} /></Field></div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) extrairDePdf(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={extraindo} className="inline-flex items-center gap-1.5 rounded-lg border border-[#B7791F]/40 bg-[#B7791F]/5 px-3 py-1.5 text-sm font-semibold text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-60">{extraindo ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo…</> : <><Upload className="h-4 w-4" /> Extrair de um PDF (contrato/extrato)</>}</button>
          <p className="text-xs text-zinc-400">Ajuste os números do caso. Tudo é <b>estimativa para negociação</b> — a apresentação deixa isso explícito e não promete resultado.</p>
        </div>
      </div>

      {/* Slides — impressão */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div ref={slideRef} className="mx-auto flex max-w-3xl flex-col gap-6 bg-white p-1 dark:bg-zinc-950">

          {/* 1 · CAPA */}
          <Slide dark>
            <div className="flex h-full flex-col justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e0b872]">Frider Andrade · Advogados</p>
              <div>
                <p className="font-serif text-sm uppercase tracking-[0.2em] text-white/60">Proposta preparada para</p>
                <h1 className="mt-1 font-serif text-4xl font-bold leading-tight text-white">{nome}</h1>
                <div className="mt-5 h-px w-24 bg-[#B7791F]" />
                <p className="mt-5 font-serif text-2xl leading-snug text-white/90">Reestruturação Estratégica<br />de Passivo Bancário</p>
                {bancos && <p className="mt-3 text-sm text-white/70">Dívidas em: {bancos}</p>}
              </div>
              <p className="text-xs text-white/50">Auditoria · Provisionamento · Negociação com desconto</p>
            </div>
          </Slide>

          {/* 2 · O PROBLEMA (perda) */}
          <Slide>
            <SlideKicker>A sua situação hoje</SlideKicker>
            {resumo && <p className="mb-5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{resumo}</p>}
            <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 dark:border-zinc-700 dark:from-zinc-800/60 dark:to-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Dívida bancária total (aprox.)</p>
              <p className="mt-1 font-serif text-5xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.D)}</p>
              {bancos && <p className="mt-3 text-sm text-zinc-500">Distribuída entre: <b className="text-zinc-700 dark:text-zinc-200">{bancos}</b></p>}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-lg border-l-4 border-[#c22e00] bg-[#c22e00]/5 p-4">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#c22e00]" />
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Enquanto nada é feito, os <b>juros seguem correndo</b> e o saldo cresce todos os meses — além do risco de execuções, protestos e negativação. Cada mês parado é dinheiro que sai do seu bolso.</p>
            </div>
          </Slide>

          {/* 3 · MÉTODO (autoridade) */}
          <Slide>
            <SlideKicker>Como devolvemos o seu controle</SlideKicker>
            <ol className="space-y-3.5">
              {[
                [Scale, 'Auditoria dos contratos', 'Revisamos juros, capitalização, tarifas e seguros de cada contrato — o que estiver fora da lei vira argumento de negociação ou de revisão judicial.'],
                [Landmark, 'Análise do provisionamento do banco', 'Todo banco é obrigado a reservar (provisionar) a perda das dívidas em atraso. Quanto mais provisionada, mais desconto ele tende a aceitar. É o nosso trunfo técnico.'],
                [TrendingDown, 'Negociação banco a banco', 'Com o dossiê técnico em mãos, buscamos acordo com desconto em cada banco — no ritmo certo (fechamento de balanço, janelas de negociação).'],
                [ShieldCheck, 'Ação judicial quando necessário', 'Revisional, superendividamento (Lei 14.181/21), exibição de documentos ou defesa — para destravar contratos ou proteger o seu patrimônio.'],
              ].map(([Ic, t, d], i) => {
                const Icon = Ic as any;
                return (
                  <li key={i} className="flex gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B7791F]/10 text-[#B7791F]"><Icon className="h-5 w-5" /></span>
                    <div><p className="font-serif text-lg font-semibold text-zinc-800 dark:text-zinc-100">{t as string}</p><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d as string}</p></div>
                  </li>
                );
              })}
            </ol>
          </Slide>

          {/* 4 · PROJEÇÃO */}
          <Slide>
            <SlideKicker>O que buscamos para você</SlideKicker>
            <p className="mb-5 text-sm text-zinc-500">Projeção de negociação (estimativa), considerando um desconto-alvo de <b className="text-zinc-700 dark:text-zinc-200">{pct(pctDesconto)}</b>:</p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Dívida hoje" value={fmtBRL(c.D)} />
              <Stat label="Acordo estimado" value={fmtBRL(c.acordo)} />
              <Stat label="Economia buscada" value={fmtBRL(c.economia)} good />
            </div>
            <div className="mt-4 rounded-lg border border-[#B7791F]/30 bg-[#B7791F]/5 p-3.5 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              É sobre essa <b>economia</b> — o quanto conseguirmos <b>abater da sua dívida</b> — que incide o nosso <b>êxito</b>: um <b>percentual</b> (você vê o valor na proposta), nunca sobre o total da dívida. Quanto maior a economia, melhor para você — e o êxito acompanha esse resultado. Justamente por isso o valor do êxito <b>varia com a negociação</b>.
            </div>
            <p className="mt-3 text-xs text-zinc-400">O desconto real depende do provisionamento de cada banco e da negociação — por isso falamos em <b>objetivo</b>, nunca em garantia.</p>
          </Slide>

          {/* 5 · CASOS REAIS (prova social — cria o desejo ANTES de mostrar o preço) */}
          {casosList.length > 0 && (
            <Slide>
              <SlideKicker>Casos reais do escritório</SlideKicker>
              <p className="mb-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">Empresas e pessoas que estavam na mesma situação que você — e hoje respiram aliviadas:</p>
              <div className="space-y-3">
                {casosList.map((cs, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-[#B7791F]" />
                    <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-200">{cs}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">O mesmo trabalho técnico pode reorganizar o seu passivo. Veja o que está incluído — e por quanto.</p>
              <p className="mt-2 text-xs text-zinc-400">Resultados de casos reais já conduzidos pelo escritório. Cada caso é único e depende das suas particularidades — não constituem garantia de resultado.</p>
            </Slide>
          )}

          {/* 6 · VALUE STACK (âncora) */}
          <Slide>
            <SlideKicker>Tudo o que está incluído no seu trabalho</SlideKicker>
            <p className="mb-4 text-sm text-zinc-500">Cada serviço tem um valor de mercado individual — veja o que você recebe:</p>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stack.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2">
                  <span className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300"><Check className="h-4 w-4 shrink-0 text-[#B7791F]" /> {s.n}</span>
                  <span className="shrink-0 text-sm font-semibold text-zinc-500 line-through decoration-zinc-300">{fmtBRL(s.v)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300"><Check className="h-4 w-4 shrink-0 text-[#B7791F]" /> Atendimento direto com o Dr. Matheus e a Dra. Kauani</span>
                <span className="shrink-0 text-xs font-semibold uppercase text-[#B7791F]">incluso</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 p-5 dark:bg-black">
              <span className="font-serif text-lg text-white">Valor de tabela dos serviços</span>
              <span className="font-serif text-3xl font-bold text-[#e0b872]">{fmtBRL(valorTabela)}</span>
            </div>
          </Slide>

          {/* 7 · PROPOSTA ESPECIAL (ancoragem/queda) */}
          <Slide>
            <SlideKicker>A sua proposta</SlideKicker>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-700">
              <span className="text-sm text-zinc-500">Valor de tabela + {pct(pctExitoTabela)} de êxito</span>
              <span className="text-xl font-semibold text-zinc-400 line-through">{fmtBRL(c.anchor)}</span>
            </div>
            <div className="rounded-2xl border-2 border-[#B7791F]/40 bg-[#B7791F]/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#B7791F]">Proposta especial para o seu caso</p>
              <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-zinc-500">Entrada (para dar início ao trabalho)</p>
                  <p className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(entradaPadrao)}</p>
                  <p className="text-[11px] font-semibold text-[#c22e00]">−{c.descTabela}% sobre o valor de tabela</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">+ Êxito ({pct(pctExitoPadrao)})</p>
                  <p className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(c.exitoPadrao)}</p>
                  <p className="text-[11px] text-zinc-500">só sobre a economia obtida</p>
                </div>
              </div>
              <ExitoExplica economia={c.economia} pctExito={pctExitoPadrao} exito={c.exitoPadrao} />
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#B7791F]/20 pt-4">
                <div className="rounded-xl bg-[#B7791F]/10 p-4">
                  <p className="text-xs text-zinc-500">Total de honorários (estimado)</p>
                  <p className="mt-0.5 font-serif text-2xl font-bold text-[#B7791F]">{fmtBRL(c.padrao)}</p>
                  <p className="text-[11px] text-zinc-400">entrada + êxito, na projeção</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-900/15">
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Economia líquida estimada para você</p>
                  <p className="mt-0.5 font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(c.liquidoPadrao)}</p>
                  <p className="text-[11px] text-emerald-700/60 dark:text-emerald-400/60">economia buscada − honorários</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {['Todos os serviços da tabela', 'Dossiê e parecer técnico', 'Negociação com todos os bancos', 'Acompanhamento até a quitação'].map((x) => (
                  <span key={x} className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"><Check className="h-3.5 w-3.5 shrink-0 text-[#B7791F]" /> {x}</span>
                ))}
              </div>
            </div>
          </Slide>

          {/* 8 · OFERTA PARA FECHAR HOJE (irrecusável + urgência + valores definidos) */}
          <Slide dark>
            <div className="flex h-full flex-col">
              <span className="self-start rounded-full bg-[#c22e00] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">Oferta exclusiva · válida nesta reunião</span>
              <h2 className="mt-4 font-serif text-3xl font-bold text-white">Condição para fechar hoje</h2>
              <div className="mt-5 rounded-2xl border border-[#B7791F]/40 bg-white/5 p-6">
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="text-xs text-white/60">Entrada hoje</p>
                    <p className="font-serif text-4xl font-bold text-[#e0b872]">{fmtBRL(entradaHoje)}</p>
                    {parcelasHoje > 1 && <p className="text-[11px] text-white/70">ou {parcelasHoje}× de {fmtBRL(c.parcela)}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-white/60">+ Êxito ({pct(pctExitoHoje)})</p>
                    <p className="font-serif text-4xl font-bold text-[#e0b872]">{fmtBRL(c.exitoHoje)}</p>
                    <p className="text-[11px] text-white/70">só sobre a economia obtida</p>
                  </div>
                </div>
                <ExitoExplica economia={c.economia} pctExito={pctExitoHoje} exito={c.exitoHoje} dark />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#B7791F]/20 pt-4">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-white/60">Total de honorários hoje (estimado)</p>
                    <p className="mt-0.5 font-serif text-2xl font-bold text-[#e0b872]">{fmtBRL(c.oferta)}</p>
                    {c.economizaVsPadrao > 0 && <p className="text-[11px] text-[#e0b872]/80">{fmtBRL(c.economizaVsPadrao)} a menos que a proposta padrão</p>}
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-4">
                    <p className="text-xs text-emerald-300/80">Economia líquida estimada para você</p>
                    <p className="mt-0.5 font-serif text-2xl font-bold text-emerald-300">{fmtBRL(c.liquido)}</p>
                    <p className="text-[11px] text-emerald-300/60">economia buscada − honorários</p>
                  </div>
                </div>
              </div>
              <p className="mt-auto pt-5 text-sm text-white/80">Você investe menos do que <b className="text-white">uma parcela mensal</b> das suas dívidas — e começamos amanhã. <span className="text-[#e0b872]">Válida somente para assinatura nesta reunião.</span></p>
            </div>
          </Slide>

          {/* 9 · CTA + assinatura + disclaimer */}
          <Slide>
            <SlideKicker>O próximo passo é seu</SlideKicker>
            <p className="mb-5 font-serif text-2xl leading-snug text-zinc-800 dark:text-zinc-100">O banco cobrou juros altos por anos.<br /><span className="text-[#B7791F]">É hora de reorganizar o seu passivo — em condições justas.</span></p>
            <ol className="mb-6 space-y-2 text-[15px] text-zinc-700 dark:text-zinc-200">
              <li>1. Assinatura do contrato de honorários e da procuração.</li>
              <li>2. Início imediato da auditoria e do levantamento (SCR/contratos).</li>
              <li>3. Negociação banco a banco, com você acompanhando cada etapa.</li>
            </ol>
            <div className="rounded-xl border border-[#B7791F]/30 bg-[#B7791F]/5 p-5">
              <p className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-100">Frider Andrade — Advogados</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Dr. Matheus Frider Andrade · OAB/PR 108.351 · Dra. Kauani Castro Macorim</p>
              <p className="text-sm text-zinc-500">(44) 99157-4212 · Maringá/PR</p>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span>Os valores desta apresentação são <b>estimativas para fins de negociação</b> e podem variar conforme o provisionamento de cada banco e o andamento das tratativas. O escritório atua com dedicação e técnica, mas <b>não promete resultado</b> (Código de Ética da OAB, art. 41). Documento de uso interno na reunião de fechamento.</span>
            </div>
          </Slide>
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } .print-slide { box-shadow: none !important; } }`}</style>
    </div>
  );
}

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-zinc-500">{label}</span>{children}</label>;
}
function Slide({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <section className={`print-slide flex min-h-[440px] flex-col rounded-2xl p-9 shadow-sm ${dark ? 'bg-gradient-to-br from-[#1a1206] via-[#2a1d0a] to-[#101820] ring-1 ring-[#B7791F]/20' : 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`} style={{ pageBreakAfter: 'always' }}>
      {children}
    </section>
  );
}
function SlideKicker({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100"><span className="border-b-2 border-[#B7791F] pb-1">{children}</span></h2>;
}
function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${good ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/15' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40'}`}>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-serif text-xl font-bold ${good ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
    </div>
  );
}

// Explica que o êxito é um PERCENTUAL sobre a economia (não um valor fixo). Mostra
// a conta com os números reais do caso e avisa que varia conforme a negociação.
// Serve tanto no slide claro (proposta) quanto no escuro (fechar hoje).
function ExitoExplica({ economia, pctExito, exito, dark }: { economia: number; pctExito: number; exito: number; dark?: boolean }) {
  return (
    <div className={`mt-3 rounded-lg border p-3.5 text-[12px] leading-relaxed ${dark ? 'border-[#B7791F]/30 bg-white/5 text-white/75' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300'}`}>
      <p>
        O êxito é <b>{pct(pctExito)} sobre a economia</b> — ou seja, sobre o quanto conseguirmos <b>abater da sua dívida</b>, nunca sobre o valor total dela.
      </p>
      <p className={`mt-1.5 font-semibold ${dark ? 'text-[#e0b872]' : 'text-[#B7791F]'}`}>
        Ex.: economia de {fmtBRL(economia)} × {pct(pctExito)} = {fmtBRL(exito)} de êxito
      </p>
      <p className={`mt-1.5 ${dark ? 'text-white/55' : 'text-zinc-400'}`}>
        Esse número é uma <b>estimativa</b> pela projeção atual e <b>varia com a negociação</b>: se conseguirmos um desconto maior, a sua economia sobe e o êxito acompanha; se for menor, cai junto. O fixo é sempre o <b>percentual</b>, não o valor — porque ele incide sobre o que você <b>efetivamente economizar</b>.
      </p>
    </div>
  );
}
