'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { maskCurrencyBR } from '@/lib/masks';
import {
  calcularProvisao, mesesDesde, CARTEIRAS, OPERACOES, INSTITUICOES,
  type Carteira, type Instituicao,
} from '@/features/calculadora-provisionamento/provisionamento';

const ACCENT = '#B7791F';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const parseBRL = (s: string) => { let t = String(s).replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };

export default function ProvisionamentoPage() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [cliente, setCliente] = useState('');
  const [banco, setBanco] = useState('');
  const [saldoStr, setSaldoStr] = useState('');
  const [operacao, setOperacao] = useState(OPERACOES[0].label);
  const [carteira, setCarteira] = useState<Carteira>(OPERACOES[0].carteira);
  const [dataPgto, setDataPgto] = useState('');
  const [mesesManual, setMesesManual] = useState('');
  const [instituicao, setInstituicao] = useState<Instituicao>('banco');
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);

  // Pré-preenche via URL quando aberto pelo card (?case=&cliente=&banco=&saldo=).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setCaseId(sp.get('case'));
    setCliente(sp.get('cliente') ?? '');
    setBanco(sp.get('banco') ?? '');
    const saldo = sp.get('saldo');
    if (saldo) setSaldoStr(maskCurrencyBR(saldo));
  }, []);

  const saldo = parseBRL(saldoStr);
  const meses = useMemo(() => {
    if (mesesManual.trim() !== '') { const m = Number(mesesManual.replace(',', '.')); return Number.isFinite(m) ? Math.max(0, m) : 0; }
    return mesesDesde(dataPgto) ?? 0;
  }, [mesesManual, dataPgto]);

  const r = useMemo(() => calcularProvisao({ saldoDevedor: saldo, carteira, meses, instituicao }), [saldo, carteira, meses, instituicao]);

  const onOperacao = (label: string) => {
    setOperacao(label);
    const op = OPERACOES.find((o) => o.label === label);
    if (op) setCarteira(op.carteira);
  };

  const salvar = async () => {
    if (!caseId) return;
    setSalvando(true);
    try {
      await Promise.all([
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'saldo_devedor', brl(saldo)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'valor_provisionado', brl(r.valorProvisionado)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'pct_provisionado', pct(r.provisaoAplicadaPct)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'proposta_acordo', brl(r.propostaAcordo)),
      ]);
      try { new BroadcastChannel('bullq-calculo').postMessage({ caseId }); } catch { /* sem suporte */ }
      setSalvouOk(true);
      toast.success('Provisionamento salvo no card (fase Em provisionamento)');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar no processo');
    } finally { setSalvando(false); }
  };

  const capAtinge = r.provisaoBasePct > r.provisaoAplicadaPct;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <a href="/juridico/calculos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Calculadoras</a>
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}1a`, color: ACCENT }}><Banknote className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Provisionamento bancário (REPB)</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Quanto o banco já provisionou → margem de acordo. Res. CMN 4.966/21.</p>
          </div>
        </header>

        {caseId && (
          <div className="mb-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}0f`, color: ACCENT }}>
            Vinculado ao processo{cliente ? ` de ${cliente}` : ''}{banco ? ` · ${banco}` : ''} — o resultado pode ser salvo no card.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Saldo devedor (dívida)">
            <input value={saldoStr} onChange={(e) => setSaldoStr(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} />
          </Field>
          <Field label="Instituição">
            <select value={instituicao} onChange={(e) => setInstituicao(e.target.value as Instituicao)} className={INPUT}>
              {INSTITUICOES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </Field>
          <Field label="Operação (produto)">
            <select value={operacao} onChange={(e) => onOperacao(e.target.value)} className={INPUT}>
              {OPERACOES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Carteira (garantia)">
            <select value={carteira} onChange={(e) => setCarteira(e.target.value as Carteira)} className={INPUT}>
              {CARTEIRAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Data do último pagamento">
            <input type="date" value={dataPgto} onChange={(e) => { setDataPgto(e.target.value); setMesesManual(''); }} className={INPUT} />
          </Field>
          <Field label="Ou meses de atraso (manual)">
            <input value={mesesManual} onChange={(e) => setMesesManual(e.target.value)} inputMode="decimal" placeholder={dataPgto ? `${meses.toFixed(1)} (calculado)` : 'ex.: 8'} className={INPUT} />
          </Field>
        </div>

        {/* Resultado */}
        <div className="mt-6 rounded-2xl border border-[#e3e8ef] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">Atraso: {r.faixaLabel}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{r.estagio.label}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Provisionado" value={pct(r.provisaoAplicadaPct)} sub={capAtinge ? `matriz ${pct(r.provisaoBasePct)} · teto ${instituicao}` : brl(r.valorProvisionado)} accent={ACCENT} big />
            <Stat label="Proposta de acordo" value={brl(r.propostaAcordo)} sub={`${pct(r.propostaPct)} do saldo`} accent="#2F9E44" big />
            <Stat label="Desconto p/ o cliente" value={brl(r.descontoValor)} sub={pct(r.descontoPct)} accent="#228BE6" big />
          </div>

          <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O banco já reconheceu {pct(r.provisaoAplicadaPct)} da dívida como perda contábil — daí a margem de acordo.
            Janelas melhores: fechamento de balanço (out–dez), 100% provisionado, arrasto ou mudança para o Estágio 3.
            {instituicao !== 'banco' && ' Cooperativas/fundos provisionam menos (teto), então negociam menos.'}
          </p>
        </div>

        {caseId && (
          <button onClick={salvar} disabled={salvando || saldo <= 0} className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>
            <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : salvouOk ? 'Salvo no processo ✓' : 'Salvar no processo (fase Em provisionamento)'}
          </button>
        )}
      </div>
    </div>
  );
}

const INPUT = 'h-10 w-full rounded-lg border border-[#cfe0ed] bg-white px-3 text-sm text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, sub, accent, big }: { label: string; value: string; sub?: string; accent: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-[#eef2f8] bg-[#fafbfc] px-3 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${big ? 'text-xl' : 'text-base'}`} style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
    </div>
  );
}
