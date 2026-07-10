'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Sigma, Info, AlertTriangle } from 'lucide-react';
import { maskCurrencyBR } from '@/lib/masks';
import { calcularPE, pdArrasto, FRAME, PORTES } from '@/features/calculadora-perda-esperada/perda-esperada';

const ACCENT = '#0E7490';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const parseBRL = (s: string) => { let t = String(s).replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const num = (s: string) => Number(String(s).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const INPUT = 'h-10 w-full rounded-lg border border-[#cfd3e0] bg-white px-3 text-sm text-[#101820] outline-none focus:border-[#0E7490] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

export default function PerdaEsperadaPage() {
  const [porte, setPorte] = useState('S1');
  const [totalOps, setTotalOps] = useState('');
  const [emDefault, setEmDefault] = useState('');
  const [ead, setEad] = useState('');
  const [lgdPct, setLgdPct] = useState('45');
  const [pdManual, setPdManual] = useState('');

  const pdArr = useMemo(() => pdArrasto(num(totalOps), num(emDefault)), [totalOps, emDefault]);
  const pd = pdManual.trim() !== '' ? Math.min(1, (num(pdManual)) / 100) : pdArr;
  const r = useMemo(() => calcularPE({ ead: parseBRL(ead), pd, lgd: Math.min(1, num(lgdPct) / 100) }), [ead, pd, lgdPct]);
  const metodologia = PORTES.find((p) => p.id === porte)?.metodologia ?? 'completa';

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <a href="/juridico/calculos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Calculadoras</a>
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}1a`, color: ACCENT }}><Sigma className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Perda Esperada (PE) & diagnóstico FRAME</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">PE = PD × LGD × EAD — metodologia completa (bancos S1–S3). Res. CMN 4.966/21.</p>
          </div>
        </header>

        {/* FRAME */}
        <div className="mb-5 rounded-2xl border border-[#e3e8ef] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>Diagnóstico FRAME</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FRAME.map((f) => (
              <div key={f.letra} className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${ACCENT}1a`, color: ACCENT }}>{f.letra}</span>
                <div><p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{f.titulo}</p><p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{f.guia}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Porte do banco"><select value={porte} onChange={(e) => setPorte(e.target.value)} className={INPUT}>{PORTES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="Exposição total — EAD (saldo bruto)"><input value={ead} onChange={(e) => setEad(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Total de operações do cliente"><input value={totalOps} onChange={(e) => setTotalOps(e.target.value)} inputMode="numeric" placeholder="ex.: 21" className={INPUT} /></Field>
          <Field label="Operações em default (> 90 dias)"><input value={emDefault} onChange={(e) => setEmDefault(e.target.value)} inputMode="numeric" placeholder="ex.: 3" className={INPUT} /></Field>
          <Field label="PD — probabilidade de default (%)"><input value={pdManual} onChange={(e) => setPdManual(e.target.value)} inputMode="decimal" placeholder={`${(pdArr * 100).toFixed(1)} (arrasto ${emDefault || 0}/${totalOps || 0})`} className={INPUT} /></Field>
          <Field label="LGD — perda dada default (%)"><input value={lgdPct} onChange={(e) => setLgdPct(e.target.value)} inputMode="decimal" placeholder="45" className={INPUT} /></Field>
        </div>

        {metodologia === 'simplificada' && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {porte} usa a metodologia <b>simplificada</b> (Anexo, Res. 309/352). Para esse porte, use a <a href="/juridico/calculos/provisionamento" className="underline">calculadora de Provisionamento</a> — mais precisa. A PE aqui vale para os bancões (S1–S3).
          </p>
        )}

        {/* Resultado */}
        <div className="mt-6 rounded-2xl border border-[#e3e8ef] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">PD {pct(pd)}{pdManual.trim() === '' ? ' (arrasto)' : ''}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">LGD {pct(Math.min(1, num(lgdPct) / 100))}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">provisão ≈ {pct(r.pctModerado)} da exposição</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Cenário otimista" value={brl(r.peOtimista)} accent="#2F9E44" />
            <Stat label="Cenário moderado" value={brl(r.peModerado)} accent={ACCENT} big />
            <Stat label="Cenário pessimista" value={brl(r.pePessimista)} accent="#b3271e" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[#0E7490]/8 px-3 py-2 dark:bg-[#0E7490]/15">
            <span className="text-[12px] text-zinc-600 dark:text-zinc-300"><b>Pós-arrasto</b> (portfólio no estágio 3, PD 100%): provisão ≈ <b className="tabular-nums" style={{ color: ACCENT }}>{brl(Math.min(1, num(lgdPct) / 100) * parseBRL(ead))}</b></span>
            <button type="button" onClick={() => setPdManual('100')} className="shrink-0 rounded-md border border-[#0E7490]/40 px-2 py-1 text-[11px] font-semibold" style={{ color: ACCENT }}>Aplicar arrasto</button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <b>Arrasto</b>: com {emDefault || 0} de {totalOps || 0} operações em default, o portfólio inteiro é levado ao estágio 3 (Res. 4.966) e a PD vai a <b>100%</b> — clique "Aplicar arrasto" para provisionar sobre a <b>exposição total</b>. A PD do arrasto ({pct(pdArr)}) mostra só a concentração atual. Os 3 cenários fazem o ajuste prospectivo (PD ±20%) que a norma exige.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-600">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Estimativa para argumentação — o banco calcula PD/LGD com modelos internos próprios. O número exato do provisionamento é do banco; aqui é a base técnica para a negociação.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>{children}</label>;
}
function Stat({ label, value, accent, big }: { label: string; value: string; accent: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-[#eef2f8] bg-[#fafbfc] px-3 py-3 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${big ? 'text-xl' : 'text-base'}`} style={{ color: accent }}>{value}</p>
    </div>
  );
}
