'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, ChevronDown, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { maskCurrencyBR } from '@/lib/masks';
import {
  calcularProvisao, diasDesde, CARTEIRAS, OPERACOES, INSTITUICOES,
  type Carteira, type Instituicao,
} from '@/features/calculadora-provisionamento/provisionamento';

// Calculadora de provisionamento EMBUTIDA na ficha do card REPB (centraliza tudo
// no kanban — sem abrir outra aba). Reaproveita o motor oficial (Res. BCB 352) e
// salva direto nos campos da fase Em Provisionamento.

const ACCENT = '#B7791F';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const parseBRL = (s: string) => { let t = String(s).replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const INPUT = 'h-8 w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 text-[13px] text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';

export function RepbProvisaoInline({ caseId, cliente, banco, saldoInicial }: { caseId: string; cliente?: string; banco?: string; saldoInicial?: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [saldoStr, setSaldoStr] = useState(saldoInicial ? maskCurrencyBR(saldoInicial) : '');
  const [operacao, setOperacao] = useState(OPERACOES[0].label);
  const [carteira, setCarteira] = useState<Carteira>(OPERACOES[0].carteira);
  const [dataPgto, setDataPgto] = useState('');
  const [diasManual, setDiasManual] = useState('');
  const [instituicao, setInstituicao] = useState<Instituicao>('banco');
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);

  const saldo = parseBRL(saldoStr);
  const dias = useMemo(() => {
    if (diasManual.trim() !== '') return Math.max(0, Number(diasManual.replace(/\D/g, '')) || 0);
    return diasDesde(dataPgto) ?? 0;
  }, [diasManual, dataPgto]);
  const r = useMemo(() => calcularProvisao({ saldoDevedor: saldo, carteira, dias, instituicao }), [saldo, carteira, dias, instituicao]);

  const onOperacao = (label: string) => { setOperacao(label); const o = OPERACOES.find((x) => x.label === label); if (o) setCarteira(o.carteira); };

  const salvar = async () => {
    setSalvando(true);
    try {
      await Promise.all([
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'saldo_devedor', brl(saldo)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'valor_provisionado', brl(r.valorProvisionado)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'pct_provisionado', pct(r.provisaoAplicadaPct)),
        legalCasesService.saveFaseField(caseId, 'repb_provisionamento', 'proposta_acordo', brl(r.propostaAcordo)),
      ]);
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
      setSalvouOk(true);
      toast.success('Provisionamento salvo na fase');
    } catch { toast.error('Erro ao salvar'); } finally { setSalvando(false); }
  };

  const url = `/juridico/calculos/provisionamento?case=${caseId}&cliente=${encodeURIComponent(cliente ?? '')}&banco=${encodeURIComponent(banco ?? '')}`;

  return (
    <div className="mt-5 rounded-lg border border-[#e3e8ef] bg-[#fafbfc] dark:border-zinc-800 dark:bg-zinc-900/40">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Banknote className="h-4 w-4 text-[#B7791F]" />
        <span className="text-sm font-semibold text-[#101820] dark:text-zinc-100">Calculadora de provisionamento</span>
        {!aberto && saldo > 0 && <span className="text-[11px] text-zinc-400">{pct(r.provisaoAplicadaPct)} · {brl(r.valorProvisionado)}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 text-zinc-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="border-t border-[#e3e8ef] px-3 py-3 dark:border-zinc-800">
          <p className="mb-2.5 text-[11px] text-zinc-400">Res. BCB 352 (Anexo I/II) — quanto o banco já provisionou e a proposta de acordo.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Saldo devedor
              <input value={saldoStr} onChange={(e) => setSaldoStr(maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} />
            </label>
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Instituição
              <select value={instituicao} onChange={(e) => setInstituicao(e.target.value as Instituicao)} className={INPUT}>
                {INSTITUICOES.map((i) => <option key={i.id} value={i.id}>{i.id === 'banco' ? 'Banco' : i.id === 'cooperativa' ? 'Cooperativa' : 'Fundo garantidor'}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Operação
              <select value={operacao} onChange={(e) => onOperacao(e.target.value)} className={INPUT}>
                {OPERACOES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Carteira
              <select value={carteira} onChange={(e) => setCarteira(e.target.value as Carteira)} className={INPUT}>
                {CARTEIRAS.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Último pagamento
              <input type="date" value={dataPgto} onChange={(e) => { setDataPgto(e.target.value); setDiasManual(''); }} className={INPUT} />
            </label>
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">ou dias de atraso
              <input value={diasManual} onChange={(e) => setDiasManual(e.target.value)} inputMode="numeric" placeholder={dataPgto ? `${dias}` : 'ex.: 240'} className={INPUT} />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[#eef2f8] bg-white p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
            <div><p className="text-[9px] uppercase tracking-wide text-zinc-400">Provisionado</p><p className="text-sm font-bold tabular-nums" style={{ color: ACCENT }}>{brl(r.valorProvisionado)}</p><p className="text-[10px] text-zinc-400">{pct(r.provisaoAplicadaPct)}</p></div>
            <div><p className="text-[9px] uppercase tracking-wide text-zinc-400">Proposta</p><p className="text-sm font-bold tabular-nums text-emerald-600">{brl(r.propostaAcordo)}</p><p className="text-[10px] text-zinc-400">{pct(r.propostaPct)}</p></div>
            <div><p className="text-[9px] uppercase tracking-wide text-zinc-400">Desconto</p><p className="text-sm font-bold tabular-nums text-sky-600">{brl(r.descontoValor)}</p><p className="text-[10px] text-zinc-400">{pct(r.descontoPct)}</p></div>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-zinc-400">{r.dias} dias · {r.faixaLabel} · {r.estagio.label.split(' — ')[0]}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={salvar} disabled={salvando || saldo <= 0} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>
              <Save className="h-3.5 w-3.5" /> {salvando ? 'Salvando…' : salvouOk ? 'Salvo ✓' : 'Salvar na fase'}
            </button>
            <a href={url} target="_blank" rel="noreferrer" title="Abrir em tela cheia" className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </div>
      )}
    </div>
  );
}
