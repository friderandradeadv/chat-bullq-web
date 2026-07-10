'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Scale, Info, AlertTriangle } from 'lucide-react';
import { maskCurrencyBR } from '@/lib/masks';
import { calcularSuperendiv } from '@/features/calculadora-superendividamento/superendividamento';

const ACCENT = '#7048E8';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const parseBRL = (s: string) => { let t = String(s).replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const INPUT = 'h-10 w-full rounded-lg border border-[#cfd3e0] bg-white px-3 text-sm text-[#101820] outline-none focus:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

export default function SuperendividamentoPage() {
  const [rendaBruta, setRendaBruta] = useState('');
  const [descontos, setDescontos] = useState('');
  const [consignado, setConsignado] = useState('');
  const [naoConsignado, setNaoConsignado] = useState('');
  const [outras, setOutras] = useState('');
  const [thrPct, setThrPct] = useState('35');
  const [minEx, setMinEx] = useState('600');

  const r = useMemo(() => calcularSuperendiv({
    rendaBruta: parseBRL(rendaBruta), descontos: parseBRL(descontos),
    consignado: parseBRL(consignado), naoConsignado: parseBRL(naoConsignado), outras: parseBRL(outras),
    comprometimentoTriagem: (Number(thrPct.replace(/\D/g, '')) || 35) / 100,
    minimoExistencialValor: parseBRL(minEx) || 600,
  }), [rendaBruta, descontos, consignado, naoConsignado, outras, thrPct, minEx]);

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <a href="/juridico/calculos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Calculadoras</a>
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}1a`, color: ACCENT }}><Scale className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Superendividamento — mínimo existencial</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Análise segmentada da renda (Lei 14.181/21, CDC art. 54-A).</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Renda bruta mensal"><input value={rendaBruta} onChange={(e) => setRendaBruta(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Descontos obrigatórios (INSS/IR)"><input value={descontos} onChange={(e) => setDescontos(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Parcelas consignadas (mês)"><input value={consignado} onChange={(e) => setConsignado(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Não consignadas — cartão/empréstimo/cheque especial (mês)"><input value={naoConsignado} onChange={(e) => setNaoConsignado(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Fora do plano — financ. imóvel/veículo, pensão, tributo (mês)"><input value={outras} onChange={(e) => setOutras(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Triagem — comprometimento (%)"><input value={thrPct} onChange={(e) => setThrPct(e.target.value)} inputMode="numeric" placeholder="35" className={INPUT} /></Field>
          <Field label="Mínimo existencial (R$ — Decreto 11.567/23)"><input value={minEx} onChange={(e) => setMinEx(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 600,00" className={INPUT} /></Field>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e3e8ef] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${r.caracterizado ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
            {r.caracterizado ? <AlertTriangle className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
            {r.caracterizado ? `Comprometimento de ${pct(r.pctComprometido)} — acima do teto (${pct(r.thr)}): indício de superendividamento` : `Comprometimento de ${pct(r.pctComprometido)} — dentro do teto (${pct(r.thr)})`}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Renda líquida" value={brl(r.rendaLiquida)} accent="#64748b" />
            <Stat label="Total comprometido" value={brl(r.totalComprometido)} sub={pct(r.pctComprometido)} accent={ACCENT} />
            <Stat label="Renda livre" value={brl(r.rendaLivre)} accent={r.rendaLivre < 0 ? '#b3271e' : '#166534'} />
            <Stat label="Disponível acima do mínimo" value={brl(r.disponivelAcimaMinimo)} sub={`mín. existencial: ${brl(r.minimoExistencial)}`} accent="#228BE6" />
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Entram no <b>plano</b> só as dívidas de consumo (consignado + não consignado = {brl(r.dividasNoPlano)}); financiamento de imóvel/veículo, pensão e tributos ficam de fora do plano, mas contam no comprometimento. Plano: até <b>60 meses</b>, 1ª parcela em até <b>180 dias</b> (a validar).
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-600">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            São coisas diferentes: o <b>comprometimento de 35%</b> é só uma triagem do método (não é lei); o <b>mínimo existencial</b> é um valor fixo — R$ 600 pelo Decreto 11.567/2023 (contestado no STF, ADPF 1006). Ambos editáveis. Triagem/estimativa, não decisão jurídica.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>{children}</label>;
}
function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[#eef2f8] bg-[#fafbfc] px-3 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-400">{sub}</p>}
    </div>
  );
}
