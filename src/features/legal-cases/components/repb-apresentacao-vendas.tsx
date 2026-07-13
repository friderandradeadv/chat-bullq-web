'use client';

// Gerador de APRESENTAÇÃO DE VENDAS específica do caso REPB (mostrada na reunião
// de fechamento). Puxa os dados do lead (dívida, bancos, resumo), calcula os
// honorários no modelo do escritório (entrada % sobre a dívida + êxito % sobre a
// economia) e a economia projetada, e monta slides imprimíveis (PDF via imprimir).
// Tudo é ESTIMATIVA para negociação — nunca promessa de resultado (OAB art. 41).

import { useMemo, useRef, useState } from 'react';
import { X, Printer, Sliders, ShieldCheck, Upload, Loader2 } from 'lucide-react';
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

// Melhor esforço pra extrair um número de "R$ 240.000", "240 mil", "240000"…
function parseValor(s?: string | null): number {
  if (!s) return 0;
  const t = s.toLowerCase().replace(/\s+/g, ' ');
  const num = parseFloat(t.replace(/[^0-9,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(num)) return 0;
  if (/\bmilh/.test(t)) return Math.round(num * 1_000_000);
  if (/\bmil\b/.test(t)) return Math.round(num * 1_000);
  return Math.round(num);
}

export function ApresentacaoVendasRepb({ card, onClose }: { card: KanbanCard; onClose: () => void }) {
  const nome = (card.client ?? card.title ?? 'Cliente').toUpperCase();
  const [divida, setDivida] = useState<number>(() => parseValor(card.leadValor));
  const [pctEntrada, setPctEntrada] = useState(6);
  const [pctExito, setPctExito] = useState(10);
  const [pctDesconto, setPctDesconto] = useState(40); // desconto ALVO estimado no acordo
  const [bancos, setBancos] = useState(card.leadBancos ?? '');
  const [resumo, setResumo] = useState(card.leadResumo ?? '');
  const [salvando, setSalvando] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const extrairDePdf = async (file: File) => {
    setExtraindo(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await legalCasesService.extrairDividaRepb(card.id, b64);
      if (r.dividaTotal != null) setDivida(r.dividaTotal);
      if (r.bancos?.length) setBancos(r.bancos.map((b) => b.valor != null ? `${b.nome} (${fmtBRL(b.valor)})` : b.nome).join(', '));
      if (r.resumo) setResumo(r.resumo);
      toast.success('Dados extraídos do documento');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui extrair a dívida do PDF');
    } finally { setExtraindo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const calc = useMemo(() => {
    const D = Math.max(0, divida);
    const acordo = Math.round(D * (1 - pctDesconto / 100));
    const economia = D - acordo;
    const entrada = Math.round(D * (pctEntrada / 100));
    const exito = Math.round(economia * (pctExito / 100));
    const honorarios = entrada + exito;
    const liquidoCliente = economia - honorarios; // quanto o cliente economiza líquido
    return { D, acordo, economia, entrada, exito, honorarios, liquidoCliente };
  }, [divida, pctEntrada, pctExito, pctDesconto]);

  const salvarConfig = async () => {
    setSalvando(true);
    try {
      await legalCasesService.saveFaseField(card.id, 'repbc_reuniao_agendada', 'apresentacao',
        { divida, pctEntrada, pctExito, pctDesconto, bancos, resumo, geradoEm: new Date().toISOString() });
    } catch { /* silencioso — a apresentação funciona mesmo sem salvar */ } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950">
      {/* Barra de topo — some na impressão */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Sliders className="h-4 w-4 text-[#E8590C]" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Apresentação de vendas — {nome}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { salvarConfig(); window.print(); }} className="inline-flex items-center gap-1 rounded-lg bg-[#E8590C] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </button>
          <button onClick={salvarConfig} disabled={salvando} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
            {salvando ? 'Salvando…' : 'Salvar dados'}
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Painel de ajuste — some na impressão */}
      <div className="no-print shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Field label="Dívida total (R$)"><input type="number" value={divida || ''} onChange={(e) => setDivida(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Desconto alvo (%)"><input type="number" value={pctDesconto} onChange={(e) => setPctDesconto(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Entrada (% da dívida)"><input type="number" value={pctEntrada} onChange={(e) => setPctEntrada(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Êxito (% da economia)"><input type="number" value={pctExito} onChange={(e) => setPctExito(Number(e.target.value))} className={INPUT} /></Field>
          <Field label="Bancos"><input value={bancos} onChange={(e) => setBancos(e.target.value)} className={INPUT} /></Field>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) extrairDePdf(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={extraindo} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8590C]/40 bg-[#E8590C]/5 px-3 py-1.5 text-sm font-semibold text-[#E8590C] hover:bg-[#E8590C]/10 disabled:opacity-60">
            {extraindo ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo…</> : <><Upload className="h-4 w-4" /> Extrair de um PDF (contrato/extrato)</>}
          </button>
          <p className="text-xs text-zinc-400">Sobe um contrato/extrato/SCR e a IA preenche dívida, bancos e resumo. Tudo é <b>estimativa para negociação</b> — não promete resultado.</p>
        </div>
      </div>

      {/* Slides — o que vai pra impressão */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* Capa */}
          <Slide accent>
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Frider Andrade Advogados</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-white">Reestruturação Estratégica de Passivo Bancário</h1>
              <p className="mt-4 text-lg text-white/90">Proposta de trabalho para</p>
              <p className="text-2xl font-bold text-white">{nome}</p>
              {bancos && <p className="mt-3 text-sm text-white/80">Dívidas em: {bancos}</p>}
            </div>
          </Slide>

          {/* O problema */}
          <Slide>
            <SlideTitle>A situação hoje</SlideTitle>
            {resumo && <p className="mb-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{resumo}</p>}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="text-sm text-zinc-500">Dívida bancária total aproximada</p>
              <p className="mt-1 text-4xl font-bold text-zinc-900 dark:text-zinc-100">{fmtBRL(calc.D)}</p>
              {bancos && <p className="mt-2 text-sm text-zinc-500">Distribuída entre: <b className="text-zinc-700 dark:text-zinc-200">{bancos}</b></p>}
            </div>
            <p className="mt-4 text-sm text-zinc-500">Juros altos, cobranças e o risco de a dívida crescer travam a vida financeira — de uma pessoa ou de uma empresa. Existe um caminho técnico para reverter isso.</p>
          </Slide>

          {/* O método */}
          <Slide>
            <SlideTitle>Como trabalhamos (o método REPB)</SlideTitle>
            <ol className="space-y-3">
              {[
                ['Auditoria dos contratos', 'Revisamos juros, capitalização, tarifas e seguros de cada contrato bancário — o que estiver fora da lei vira argumento de negociação ou de revisão judicial.'],
                ['Análise do provisionamento do banco', 'Todo banco é obrigado a “provisionar” (reservar) a perda das dívidas em atraso. Quanto mais provisionada está a sua dívida, mais desconto o banco tende a aceitar num acordo.'],
                ['Negociação banco a banco', 'Com o dossiê técnico em mãos, buscamos acordo com desconto em cada banco — extrajudicialmente primeiro, no ritmo certo (fechamento de balanço, janelas de negociação).'],
                ['Ação judicial quando necessário', 'Revisional, superendividamento (Lei 14.181/21), exibição de documentos ou defesa — para destravar contratos ou proteger o cliente.'],
              ].map(([t, d], i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8590C]/10 text-sm font-bold text-[#E8590C]">{i + 1}</span>
                  <div><p className="font-semibold text-zinc-800 dark:text-zinc-100">{t}</p><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d}</p></div>
                </li>
              ))}
            </ol>
          </Slide>

          {/* A projeção */}
          <Slide>
            <SlideTitle>O que buscamos para você</SlideTitle>
            <p className="mb-4 text-sm text-zinc-500">Projeção de negociação (estimativa) considerando um desconto-alvo de <b>{pct(pctDesconto)}</b>:</p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Dívida hoje" value={fmtBRL(calc.D)} tone="neutral" />
              <Stat label="Acordo estimado" value={fmtBRL(calc.acordo)} tone="neutral" />
              <Stat label="Economia buscada" value={fmtBRL(calc.economia)} tone="good" />
            </div>
            <p className="mt-4 text-xs text-zinc-400">O desconto real depende do provisionamento de cada banco e da negociação — por isso falamos em <b>objetivo</b>, não em garantia.</p>
          </Slide>

          {/* Honorários */}
          <Slide>
            <SlideTitle>Nossos honorários</SlideTitle>
            <p className="mb-4 text-sm text-zinc-500">Modelo alinhado ao seu resultado: uma entrada e um percentual só sobre a economia que conseguirmos.</p>
            <div className="space-y-3">
              <HonRow titulo={`Entrada — ${pct(pctEntrada)} sobre a dívida`} sub="Para dar início ao trabalho (auditoria, dossiê, malotes)." valor={fmtBRL(calc.entrada)} />
              <HonRow titulo={`Êxito — ${pct(pctExito)} sobre a economia`} sub="Só incide sobre o quanto reduzirmos da sua dívida." valor={fmtBRL(calc.exito)} />
              <div className="flex items-center justify-between rounded-xl border-2 border-[#E8590C]/30 bg-[#E8590C]/5 p-4">
                <div><p className="font-bold text-zinc-800 dark:text-zinc-100">Total de honorários (estimado)</p><p className="text-xs text-zinc-500">Na projeção acima</p></div>
                <p className="text-2xl font-bold text-[#E8590C]">{fmtBRL(calc.honorarios)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-900/15">
                <div><p className="font-bold text-emerald-800 dark:text-emerald-300">Economia líquida estimada para você</p><p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">Economia buscada − honorários</p></div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtBRL(calc.liquidoCliente)}</p>
              </div>
            </div>
          </Slide>

          {/* Próximos passos + disclaimer */}
          <Slide>
            <SlideTitle>Próximos passos</SlideTitle>
            <ol className="mb-5 space-y-2 text-[15px] text-zinc-700 dark:text-zinc-200">
              <li>1. Assinatura do contrato de honorários e da procuração.</li>
              <li>2. Reunião de documentos: contratos, extratos e SCR/Registrato.</li>
              <li>3. Início da auditoria + análise do provisionamento.</li>
              <li>4. Negociação banco a banco, com você acompanhando cada etapa.</li>
            </ol>
            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40">
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

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#E8590C] dark:border-zinc-700 dark:text-zinc-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-zinc-500">{label}</span>{children}</label>;
}

function Slide({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`print-slide flex min-h-[420px] flex-col rounded-2xl p-8 shadow-sm ${accent ? 'bg-gradient-to-br from-[#B7791F] to-[#E8590C]' : 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`} style={{ pageBreakAfter: 'always' }}>
      {children}
    </section>
  );
}
function SlideTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100"><span className="border-b-4 border-[#E8590C] pb-1">{children}</span></h2>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${tone === 'good' ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/15' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40'}`}>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
    </div>
  );
}
function HonRow({ titulo, sub, valor }: { titulo: string; sub: string; valor: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div><p className="font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</p><p className="text-xs text-zinc-500">{sub}</p></div>
      <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{valor}</p>
    </div>
  );
}
