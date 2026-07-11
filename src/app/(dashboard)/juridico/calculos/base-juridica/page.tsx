'use client';

import { ArrowLeft, ShieldCheck, CircleAlert, BadgeCheck } from 'lucide-react';
import {
  PROVISAO, ESTAGIOS, PRAZOS, MINIMO_EXISTENCIAL, REFERENCIAS, validarNormas,
} from '@/features/calculadora-provisionamento/normas-repb';

const ACCENT = '#9a6a12';
const CART = ['C1', 'C2', 'C3', 'C4', 'C5'];
const pctStr = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function StatusPill({ status }: { status: 'validado' | 'pendente' }) {
  return status === 'validado'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><BadgeCheck className="h-3 w-3" />validado</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><CircleAlert className="h-3 w-3" />a validar</span>;
}

export default function BaseJuridicaPage() {
  const golden = validarNormas();
  const nValid = REFERENCIAS.filter((r) => r.status === 'validado').length;
  const nPend = REFERENCIAS.length - nValid;
  const anexoI = PROVISAO.valores.anexoI;
  const anexoII = PROVISAO.valores.anexoII;
  const prazos = Object.entries(PRAZOS.valores);

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <a href="/juridico/calculos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Calculadoras</a>
        <header className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}1a`, color: ACCENT }}><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Base jurídica do REPB</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">A fonte única e versionada de tudo que é lei no módulo. Mudou a norma? Atualiza aqui.</p>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{nValid} validadas</span>
          {nPend > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{nPend} a validar</span>}
          <span className={`rounded-full px-2.5 py-1 font-semibold ${golden.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>
            {golden.ok ? 'Tabelas conferem (golden ✓)' : `Falha nas tabelas: ${golden.falhas.join(', ')}`}
          </span>
        </div>

        {/* Provisão — Anexo I */}
        <Bloco titulo="Provisão — Anexo I (inadimplido > 90 dias)" fonte={PROVISAO.fonte} status={PROVISAO.status} vigencia={PROVISAO.vigencia}>
          <p className="mb-2 text-[12px] text-zinc-500 dark:text-zinc-400">% por meses a partir do mês do inadimplemento × carteira. O crédito "já morreu" na contabilidade — daí a margem de acordo.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] tabular-nums">
              <thead><tr className="text-[10px] uppercase tracking-wide" style={{ color: ACCENT }}><th className="px-2 py-1 text-left">Mês</th>{CART.map((c) => <th key={c} className="px-2 py-1 text-right">{c}</th>)}</tr></thead>
              <tbody>
                {anexoI.map((row, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1 text-left text-zinc-500">{i === 0 ? '< 1 mês' : i >= 21 ? '≥ 21 m' : `${i}–${i + 1} m`}</td>
                    {row.map((v, j) => <td key={j} className="px-2 py-1 text-right">{pctStr(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloco>

        {/* Provisão — Anexo II */}
        <Bloco titulo="Provisão — Anexo II (atraso 0–90 dias)" fonte={PROVISAO.fonte} status={PROVISAO.status} vigencia={PROVISAO.vigencia}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] tabular-nums">
              <thead><tr className="text-[10px] uppercase tracking-wide" style={{ color: ACCENT }}><th className="px-2 py-1 text-left">Atraso</th>{CART.map((c) => <th key={c} className="px-2 py-1 text-right">{c}</th>)}</tr></thead>
              <tbody>
                {anexoII.map((f, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1 text-left text-zinc-500">{f.label}</td>
                    {f.p.map((v, j) => <td key={j} className="px-2 py-1 text-right">{pctStr(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloco>

        {/* Estágios */}
        <Bloco titulo="Estágios de risco" fonte={ESTAGIOS.fonte} status={ESTAGIOS.status} vigencia={ESTAGIOS.vigencia}>
          <ul className="space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">
            <li><b>Estágio 1:</b> {ESTAGIOS.valores.s1}</li>
            <li><b>Estágio 2:</b> {ESTAGIOS.valores.s2}</li>
            <li><b>Estágio 3:</b> {ESTAGIOS.valores.s3}</li>
          </ul>
        </Bloco>

        {/* Prazos */}
        <Bloco titulo="Prazos" fonte={PRAZOS.fonte} status={PRAZOS.status} vigencia={PRAZOS.vigencia}>
          <ul className="space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">
            {prazos.map(([k, v]) => (
              <li key={k}><b className="tabular-nums">{v.dias} {v.uteis ? 'dias úteis' : 'dias'}</b> — {v.nota}</li>
            ))}
          </ul>
        </Bloco>

        {/* Mínimo existencial */}
        <Bloco titulo="Mínimo existencial / superendividamento" fonte={MINIMO_EXISTENCIAL.fonte} status={MINIMO_EXISTENCIAL.status} vigencia={MINIMO_EXISTENCIAL.vigencia}>
          <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
            <b>Mínimo existencial (piso fixo):</b> R$ {MINIMO_EXISTENCIAL.valores.valorFixo.toLocaleString('pt-BR')} · <b>Triagem de comprometimento:</b> {pctStr(MINIMO_EXISTENCIAL.valores.comprometimentoTriagem * 100)} da renda líquida.
          </p>
          <p className="mt-1 text-[11px] text-amber-600">São coisas diferentes: o comprometimento (35%) é triagem do método; o mínimo existencial é o valor fixo protegido por lei (contestado no STF, ADPF 1006).</p>
        </Bloco>

        {/* Referências */}
        <div className="mt-6">
          <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">Leis, súmulas e temas</h2>
          <p className="mb-3 text-[12px] text-zinc-500 dark:text-zinc-400">Cada uma com a nuance que importa (modulação, superação, teto contestado).</p>
          <div className="space-y-1.5">
            {REFERENCIAS.map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded-lg border border-[#e3e8ef] bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{r.label}</p>
                  <p className="text-[12px] leading-4 text-zinc-500 dark:text-zinc-400">{r.tema}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[11px] text-zinc-400">Fonte versionada em <code>normas-repb.ts</code>. Ao mudar a lei, crie uma nova versão com a nova vigência — os cálculos antigos continuam reproduzíveis.</p>
      </div>
    </div>
  );
}

function Bloco({ titulo, fonte, status, vigencia, children }: { titulo: string; fonte: string; status: 'validado' | 'pendente'; vigencia: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-[#e3e8ef] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
          <p className="text-[11px] text-zinc-400">{fonte} · vigência {vigencia}</p>
        </div>
        <StatusPill status={status} />
      </div>
      {children}
    </section>
  );
}
