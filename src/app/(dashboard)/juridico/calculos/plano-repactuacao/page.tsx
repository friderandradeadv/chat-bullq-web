'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ListChecks, Plus, Trash2, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { maskCurrencyBR } from '@/lib/masks';
import { calcularPlano, type Credor } from '@/features/calculadora-superendividamento/plano-repactuacao';

const ACCENT = '#7C3AED';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseBRL = (s: string) => { let t = String(s ?? '').replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const INPUT = 'h-9 w-full rounded-lg border border-[#d6d3e0] bg-white px-2.5 text-sm text-[#101820] outline-none focus:border-[#7C3AED] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

type Row = { nome: string; valor: string; parcela: string };

export default function PlanoRepactuacaoPage() {
  const [renda, setRenda] = useState('');
  const [pctStr, setPctStr] = useState('35');
  const [rows, setRows] = useState<Row[]>([{ nome: '', valor: '', parcela: '' }, { nome: '', valor: '', parcela: '' }]);

  const credores: Credor[] = rows.map((r) => ({ nome: r.nome, valor: parseBRL(r.valor), parcela: parseBRL(r.parcela) }));
  const r = useMemo(() => calcularPlano({
    rendaLiquida: parseBRL(renda),
    comprometimentoPct: (Number(pctStr.replace(/\D/g, '')) || 35) / 100,
    credores,
  }), [renda, pctStr, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addRow = () => setRows((rs) => [...rs, { nome: '', valor: '', parcela: '' }]);
  const delRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <a href="/juridico/calculos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Calculadoras</a>
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}1a`, color: ACCENT }}><ListChecks className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Plano de repactuação (superendividamento)</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Distribui os {pctStr || 35}% da renda entre os credores e projeta o plano — CDC art. 104-A/B (máx. 5 anos).</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Renda líquida mensal"><input value={renda} onChange={(e) => setRenda(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></Field>
          <Field label="Limite pleiteado (% da renda)"><input value={pctStr} onChange={(e) => setPctStr(e.target.value)} inputMode="numeric" placeholder="35" className={INPUT} /></Field>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e3e8ef] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Credores</p>
            <span className="text-[11px] text-zinc-400">valor a repactuar (após abater o já pago) + parcela mensal atual</span>
            <button onClick={addRow} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#7C3AED]/40 px-2 py-1 text-[12px] font-semibold" style={{ color: ACCENT }}><Plus className="h-3.5 w-3.5" /> Credor</button>
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <input value={row.nome} onChange={(e) => setRow(i, { nome: e.target.value })} placeholder="Banco / instituição" className={INPUT} />
                <input value={row.valor} onChange={(e) => setRow(i, { valor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="Valor a repactuar" className={`${INPUT} w-36 text-right`} />
                <input value={row.parcela} onChange={(e) => setRow(i, { parcela: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="Parcela atual" className={`${INPUT} w-32 text-right`} />
                <button onClick={() => delRow(i)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Resultado */}
        <div className="mt-6 rounded-2xl border border-[#e3e8ef] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${r.totalRepactuar === 0 ? 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50' : r.dentroDoTeto ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
            {r.totalRepactuar === 0 ? <Info className="h-4 w-4" /> : r.dentroDoTeto ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {r.totalRepactuar === 0 ? 'Preencha a renda e os credores.'
              : r.dentroDoTeto ? `Plano viável: quita em ${r.mesesTotais} meses (dentro dos 60 do art. 104-A).`
              : `Impagável em 60 meses (projeta ${r.mesesTotais}) — reduza mais o principal (art. 104-B §4º) ou reveja o valor a repactuar.`}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Depósito mensal (limite)" value={brl(r.disponivelMensal)} sub={`${pctStr || 35}% da renda`} accent={ACCENT} big />
            <Stat label="Total a repactuar" value={brl(r.totalRepactuar)} sub={`${r.credores.length} credor(es)`} accent="#334155" />
            <Stat label="Prazo do plano" value={`${r.mesesTotais} meses`} sub={r.dentroDoTeto ? 'dentro do teto legal' : 'acima de 60 (5 anos)'} accent={r.dentroDoTeto ? '#166534' : '#b3271e'} big />
          </div>

          {r.credores.some((c) => c.valor > 0) && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="text-[11px] uppercase tracking-wide text-zinc-400"><th className="px-2 py-1.5 text-left">Credor</th><th className="px-2 py-1.5 text-right">A repactuar</th><th className="px-2 py-1.5 text-right">Parcela inicial</th><th className="px-2 py-1.5 text-right">Quita em</th></tr></thead>
                <tbody>
                  {r.credores.map((c, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 text-left">{c.nome}</td>
                      <td className="px-2 py-1.5 text-right text-zinc-500">{brl(c.valor)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold" style={{ color: ACCENT }}>{brl(c.parcelaInicial)}</td>
                      <td className="px-2 py-1.5 text-right">{c.meses} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O depósito mensal é distribuído entre os credores pela <b>proporção da parcela atual</b>; quando um quita, o valor é <b>readequado</b> entre os demais (as "fases" do plano). Sem juros — paga-se o valor repactuado. O <b>valor a repactuar</b> já deve considerar o abatimento do que foi pago e a garantia do principal (art. 104-B §4º / 54-D §único) — decisão do advogado.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>{children}</label>;
}
function Stat({ label, value, sub, accent, big }: { label: string; value: string; sub?: string; accent: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-[#eef2f8] bg-[#fafbfc] px-3 py-3 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${big ? 'text-lg' : 'text-base'}`} style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
    </div>
  );
}
