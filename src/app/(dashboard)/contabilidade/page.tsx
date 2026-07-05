'use client';

// Aba Contábil — replica a apuração da Contabilizei (Simples Nacional, Anexo IV, advocacia).
// Consome GET /contabilidade/painel (react-query) com FALLBACK local (data/contabilizei.ts)
// enquanto o backend não está deployado/populado. Importação via modal (cola o JSON da captura).
// Motor validado ao centavo (fev/2026). Dois fluxos: DAS (sobre receita) + DARF-INSS (fixo/mês).

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calculator, LayoutDashboard, Receipt, Users, CalendarClock, FolderOpen, FileText,
  Info, Landmark, TrendingUp, AlertTriangle, CheckCircle2, Clock, Download, Loader2, Upload, X, Database,
} from 'lucide-react';
import { apurar, type AnexoId } from '@/features/contabilidade/lib/simples';
import {
  contabilidadeService, derivarPainelLocal, type PainelContabil, type CompetenciaApurada, type GuiaStatus,
} from '@/features/contabilidade/services/contabilidade.service';
import {
  EMPRESA, COMPETENCIAS, SNAPSHOT_CAPTURA, DECLARACOES_ANUAIS, GUIA_LABEL, compLabel,
} from '@/features/contabilidade/data/contabilizei';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
const dt = (s?: string) => (s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : '—');

type View = 'visao' | 'apuracao' | 'notas' | 'prolabore' | 'obrigacoes' | 'documentos';
const TABS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'apuracao', label: 'Apuração', icon: Calculator },
  { key: 'notas', label: 'Notas fiscais', icon: Receipt },
  { key: 'prolabore', label: 'Pró-labore / INSS', icon: Users },
  { key: 'obrigacoes', label: 'Obrigações', icon: CalendarClock },
  { key: 'documentos', label: 'Documentos', icon: FolderOpen },
];

const STATUS_CFG: Record<GuiaStatus, { label: string; cls: string; icon: React.ElementType }> = {
  PAGO: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
  A_PAGAR: { label: 'A pagar', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  EM_ATRASO: { label: 'Em atraso', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', icon: AlertTriangle },
  CALCULANDO: { label: 'Calculando', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', icon: Loader2 },
  ERRO_PROCESSAR_GUIA: { label: 'Erro', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', icon: AlertTriangle },
};

// helpers de achatamento (competências → listas planas)
type GuiaFlat = { comp: string; tipo: string; valor: number; status: GuiaStatus; vencimento?: string };
const guiasDe = (p: PainelContabil): GuiaFlat[] =>
  p.competencias.flatMap((c) => (c.guias ?? []).map((g) => ({ ...g, comp: c.comp })));
const notasDe = (p: PainelContabil) =>
  p.competencias.flatMap((c) => (c.notas ?? []).map((n) => ({ ...n, comp: c.comp })));
const declDe = (p: PainelContabil) =>
  p.competencias.flatMap((c) => (c.declaracoes ?? []).map((d) => ({ ...d, comp: c.comp })));

export default function ContabilidadePage() {
  const [view, setView] = useState<View>('visao');
  const [importOpen, setImportOpen] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ['contabilidade', 'painel'],
    queryFn: () => contabilidadeService.painel(),
    retry: false,
  });

  // Fallback local: backend indisponível/vazio → apura a captura no cliente.
  const painelLocal = useMemo(() => derivarPainelLocal(EMPRESA, COMPETENCIAS), []);
  const usandoFallback = isError || !data || data.competencias.length === 0;
  const painel = usandoFallback ? painelLocal : data;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Calculator className="h-5 w-5" />
              </span>
              Contabilidade
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Impostos, notas e obrigações do escritório — apuração do Simples Nacional.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" /> Importar da Contabilizei
            </button>
            <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-right text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{painel.empresa.razaoSocial}</p>
              <p className="text-zinc-500">
                {painel.empresa.cnpj} · {painel.empresa.regime} · Anexo {painel.empresa.anexo} · ISS {painel.empresa.municipioISS}
              </p>
            </div>
          </div>
        </header>

        {usandoFallback && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <Database className="h-3.5 w-3.5" />
            Mostrando os dados capturados localmente — importe para persistir no hub (backend ainda não populado).
          </p>
        )}

        <nav className="mt-5 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5">
          {view === 'visao' && <VisaoGeral painel={painel} onGo={setView} />}
          {view === 'apuracao' && <Apuracao painel={painel} />}
          {view === 'notas' && <Notas painel={painel} />}
          {view === 'prolabore' && <ProLabore painel={painel} />}
          {view === 'obrigacoes' && <Obrigacoes painel={painel} />}
          {view === 'documentos' && <Documentos />}
        </div>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}
function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      {children}
    </span>
  );
}
function StatusPill({ status }: { status: GuiaStatus }) {
  const s = STATUS_CFG[status];
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ${s.cls}`}>
      <Icon className={`h-3 w-3 ${status === 'CALCULANDO' ? 'animate-spin' : ''}`} /> {s.label}
    </span>
  );
}
const ultimaComReceita = (p: PainelContabil): CompetenciaApurada | undefined =>
  p.competencias.filter((c) => c.receita > 0).slice(-1)[0];

// ─── Visão geral ────────────────────────────────────────────────────────────────
function VisaoGeral({ painel, onGo }: { painel: PainelContabil; onGo: (v: View) => void }) {
  const inss = painel.competencias.slice(-1)[0]?.inss;
  const ultDas = ultimaComReceita(painel);
  const guias = guiasDe(painel);
  const totalPago = guias.filter((g) => g.status === 'PAGO').reduce((s, g) => s + g.valor, 0);
  const receita = notasDe(painel).reduce((s, n) => s + n.valorServico, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-zinc-500">INSS s/ pró-labore (fixo/mês)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(inss?.total ?? 0)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">DARF Unificado · vence dia 20</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">DAS (só em mês com nota)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(ultDas?.das?.das ?? 0)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{ultDas ? `${compLabel(ultDas.comp)} (${brl(ultDas.receita)})` : 'sem receita'}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Recolhido (série)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(totalPago)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-500"><TrendingUp className="h-3 w-3" /> {guias.length} guias</p>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm dark:border-indigo-900/40 dark:bg-indigo-900/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <p className="text-indigo-900/90 dark:text-indigo-200/90">
          <b>Dois fluxos independentes.</b> O <b>DAS</b> incide sobre a receita (4,50% do faturamento) e só
          aparece em mês com nota emitida. O <b>DARF Unificado (INSS)</b> incide sobre o pró-labore fixo e sai
          <b> todo mês</b>. No Anexo IV o INSS patronal fica fora do DAS. Confira na{' '}
          <button onClick={() => onGo('apuracao')} className="font-semibold underline">apuração</button>.
        </p>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Série de guias</h3>
          <button onClick={() => onGo('obrigacoes')} className="text-xs text-indigo-600 hover:underline">ver todas</button>
        </div>
        <ul className="space-y-2">
          {guias.slice().reverse().slice(0, 5).map((g, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
              <span className="flex items-center gap-2">
                <span className="text-zinc-700 dark:text-zinc-200">{GUIA_LABEL[g.tipo] ?? g.tipo}</span>
                <span className="text-xs text-zinc-400">{compLabel(g.comp)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{brl(g.valor)}</span>
                <StatusPill status={g.status} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          Faturamento acumulado na série: {brl(receita)}. Meses sem nota não geram DAS — só o DARF do INSS.
        </p>
      </Card>
    </div>
  );
}

// ─── Apuração (calculadora: DAS + INSS pró-labore) ──────────────────────────────
function Apuracao({ painel }: { painel: PainelContabil }) {
  const ult = ultimaComReceita(painel);
  const [receitaMes, setReceitaMes] = useState<number>(ult?.receita ?? 6377.94);
  const [rbt12, setRbt12] = useState<number>(ult?.rbt12 ?? ult?.receita ?? 6377.94);
  const [anexo, setAnexo] = useState<AnexoId>(painel.empresa.anexo);
  const [proLabore, setProLabore] = useState<number>(painel.empresa.proLabore);

  const das = useMemo(() => apurar({ receitaMes, rbt12, anexo }), [receitaMes, rbt12, anexo]);
  const inssTotal = useMemo(() => {
    const base = Math.min(proLabore, painel.resumo.tetoInss);
    return { segurado: Math.round(base * 0.11 * 100) / 100, patronal: Math.round(base * 0.20 * 100) / 100, base };
  }, [proLabore, painel.resumo.tetoInss]);
  const inssSum = inssTotal.segurado + inssTotal.patronal;
  const totalMes = das.das + inssSum;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Calculator className="h-4 w-4 text-indigo-500" /> Apuração da competência
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Faturamento do mês"><MoneyInput value={receitaMes} onChange={setReceitaMes} /></Field>
          <Field label="RBT12 (receita 12 meses)"><MoneyInput value={rbt12} onChange={setRbt12} /></Field>
          <Field label="Anexo">
            <select value={anexo} onChange={(e) => setAnexo(e.target.value as AnexoId)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {(['III', 'IV', 'V'] as AnexoId[]).map((a) => <option key={a} value={a}>Anexo {a}</option>)}
            </select>
          </Field>
          <Field label="Pró-labore"><MoneyInput value={proLabore} onChange={setProLabore} /></Field>
        </div>
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
          Total a recolher no mês: <b className="text-zinc-900 dark:text-zinc-100">{brl(totalMes)}</b>
          {'  '}= DAS {brl(das.das)} + DARF INSS {brl(inssSum)}. Valores conferidos com fev/2026.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500">DAS — Simples Nacional</p>
            <Tag>sobre receita</Tag>
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{brl(das.das)}</p>
          <dl className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            <Row k={`Faixa ${das.faixa} · nominal`} v={pct(das.aliquotaNominal)} />
            <Row k="Parcela a deduzir" v={brl(das.parcelaDeduzir)} />
            <Row k="Alíquota efetiva" v={pct(das.aliquotaEfetiva)} bold />
          </dl>
          <ul className="mt-3 space-y-1 border-t border-indigo-200/50 pt-2 text-sm dark:border-indigo-900/30">
            {das.tributos.map((t) => (
              <li key={t.codigo} className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">
                  <span className="mr-1.5 text-[10px] tabular-nums text-zinc-400">{t.codigo}</span>{t.nome}
                </span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-100">{brl(t.valor)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-emerald-50/40 dark:bg-emerald-900/10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500">DARF Unificado — INSS s/ pró-labore</p>
            <Tag>fixo/mês</Tag>
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(inssSum)}</p>
          <dl className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            <Row k="Base (pró-labore)" v={brl(inssTotal.base)} />
            <Row k="Teto INSS 2026" v={brl(painel.resumo.tetoInss)} />
          </dl>
          <ul className="mt-3 space-y-1 border-t border-emerald-200/50 pt-2 text-sm dark:border-emerald-900/30">
            <li className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-300"><span className="mr-1.5 text-[10px] tabular-nums text-zinc-400">1099</span>CP Segurado (11%)</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-100">{brl(inssTotal.segurado)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-300"><span className="mr-1.5 text-[10px] tabular-nums text-zinc-400">1138</span>CP Patronal (20%)</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-100">{brl(inssTotal.patronal)}</span>
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-zinc-400">IRRF só incide sobre pró-labore &gt; R$ 5.000 (tabela progressiva).</p>
        </Card>
      </div>

      {das.avisos.length > 0 && (
        <div className="space-y-1.5">
          {das.avisos.map((a, i) => (
            <p key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
function MoneyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-3 dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-sm text-zinc-400">R$</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-transparent px-2 py-2 text-sm tabular-nums outline-none" />
    </div>
  );
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{k}</dt>
      <dd className={`tabular-nums ${bold ? 'font-bold text-zinc-900 dark:text-zinc-100' : ''}`}>{v}</dd>
    </div>
  );
}

// ─── Notas fiscais ──────────────────────────────────────────────────────────────
function Notas({ painel }: { painel: PainelContabil }) {
  const notas = notasDe(painel);
  const total = notas.reduce((s, n) => s + n.valorServico, 0);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Receipt className="h-4 w-4 text-indigo-500" /> Notas emitidas
        </h3>
        <span className="text-sm tabular-nums text-zinc-500">Total: {brl(total)}</span>
      </div>
      {notas.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">Nenhuma nota na série.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-400 dark:border-zinc-800">
              <th className="py-2 font-medium">Nº</th>
              <th className="py-2 font-medium">Competência</th>
              <th className="py-2 text-right font-medium">Valor serviço</th>
              <th className="py-2 text-center font-medium">Anexo</th>
              <th className="py-2 text-right font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50">
                <td className="py-2 text-zinc-500">{n.numero}</td>
                <td className="py-2 text-zinc-700 dark:text-zinc-200">{compLabel(n.comp)}</td>
                <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">{brl(n.valorServico)}</td>
                <td className="py-2 text-center text-zinc-500">{n.anexo ?? '—'}</td>
                <td className="py-2 text-right">
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{n.situacao ?? '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        A nota alimenta a base do DAS (receita × 4,50%). A emissão de NFS-e (efeito real) fica fora — aqui é leitura.
      </p>
    </Card>
  );
}

// ─── Pró-labore / INSS ──────────────────────────────────────────────────────────
function ProLabore({ painel }: { painel: PainelContabil }) {
  const inss = painel.competencias.slice(-1)[0]?.inss
    ?? { base: painel.empresa.proLabore, segurado: 0, patronal: 0, total: 0 };
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        <Users className="h-4 w-4 text-indigo-500" /> Pró-labore e INSS — {painel.empresa.socio}
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500">Pró-labore</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{brl(inss.base)}</p>
          <p className="text-xs text-zinc-400">fixo/mês</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500">CP Segurado (1099) · 11%</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{brl(inss.segurado)}</p>
          <p className="text-xs text-zinc-400">descontado do sócio</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500">CP Patronal (1138) · 20%</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{brl(inss.patronal)}</p>
          <p className="text-xs text-zinc-400">fora do DAS (Anexo IV)</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <span className="text-zinc-700 dark:text-zinc-200">Total DARF Unificado (INSS)</span>
        <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(inss.total)}</span>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Sociedade individual, sem empregados — só o pró-labore do sócio. IRRF só acima de R$ 5.000.
        Teto de contribuição INSS 2026: {brl(painel.resumo.tetoInss)}.
      </p>
    </Card>
  );
}

// ─── Obrigações / calendário ────────────────────────────────────────────────────
function Obrigacoes({ painel }: { painel: PainelContabil }) {
  const guias = guiasDe(painel);
  const decl = declDe(painel);
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <CalendarClock className="h-4 w-4 text-indigo-500" /> Guias por competência
        </h3>
        <ul className="space-y-2">
          {guias.slice().reverse().map((g, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2.5 text-sm dark:border-zinc-800">
              <span className="flex items-center gap-2">
                <span className="text-zinc-700 dark:text-zinc-200">{GUIA_LABEL[g.tipo] ?? g.tipo}</span>
                <span className="text-xs text-zinc-400">comp. {compLabel(g.comp)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{brl(g.valor)}</span>
                <span className="text-xs text-zinc-400">venc. {dt(g.vencimento)}</span>
                <StatusPill status={g.status} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <FileText className="h-4 w-4 text-indigo-500" /> Declarações transmitidas
        </h3>
        <ul className="space-y-2">
          {[...decl.map((d) => ({ tipo: d.tipo, quando: compLabel(d.comp), situacao: d.situacao })),
            ...DECLARACOES_ANUAIS.map((d) => ({ tipo: d.tipo, quando: `exercício ${d.ano}`, situacao: d.situacao }))]
            .map((d, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
              <span className="text-zinc-700 dark:text-zinc-200">{d.tipo}<span className="ml-2 text-xs text-zinc-400">{d.quando}</span></span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{d.situacao}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          PGDAS gera o DAS · DCTFWeb cobre o DARF do INSS · DEFIS é a declaração anual (até 31/03).
          DAS/DARF vencem dia 20 do mês seguinte.
        </p>
      </Card>
    </div>
  );
}

// ─── Documentos ─────────────────────────────────────────────────────────────────
function Documentos() {
  const docs = [
    { nome: 'PGDASD-DAS fev-2026.pdf', tipo: 'Guia DAS', data: '2026-03-01' },
    { nome: 'DARF Unificado fev-2026.pdf', tipo: 'Guia INSS', data: '2026-03-01' },
    { nome: 'DEFIS recibo 2025.pdf', tipo: 'Declaração', data: '2026-03-28' },
  ];
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        <FolderOpen className="h-4 w-4 text-indigo-500" /> Documentos contábeis <Tag>referência</Tag>
      </h3>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {docs.map((d, i) => (
          <li key={i} className="flex items-center justify-between py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-zinc-400" />
              <span className="text-zinc-700 dark:text-zinc-200">{d.nome}</span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{d.tipo}</span>
            </span>
            <span className="flex items-center gap-3 text-xs text-zinc-400">
              {dt(d.data)}
              <button className="flex items-center gap-1 text-indigo-600 hover:underline"><Download className="h-3.5 w-3.5" /> baixar</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-400">
        Os PDFs da Contabilizei vêm por URL assinada temporária (GCS, ~30 min) — no backend a gente baixa e arquiva por competência.
      </p>
    </Card>
  );
}

// ─── Modal de importação ────────────────────────────────────────────────────────
function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(() => JSON.stringify(SNAPSHOT_CAPTURA, null, 2));
  const [previa, setPrevia] = useState<{ meses: number; comReceita: number } | null>(null);

  function parse(): { empresa?: any; competencias?: any[] } | null {
    try {
      const obj = JSON.parse(texto);
      if (!obj || typeof obj !== 'object') throw new Error('formato');
      return obj;
    } catch {
      toast.error('JSON inválido — confira o conteúdo colado.');
      return null;
    }
  }

  const conferir = useMutation({
    mutationFn: async () => {
      const payload = parse();
      if (!payload) throw new Error('json');
      return contabilidadeService.importar(payload, false);
    },
    onSuccess: (res: any) => {
      const comps = res?.competencias ?? [];
      setPrevia({ meses: comps.length, comReceita: comps.filter((c: any) => c.receita > 0).length });
      toast.success('Prévia gerada — confira e importe.');
    },
    onError: () => toast.error('Não foi possível conferir (backend indisponível?).'),
  });

  const importar = useMutation({
    mutationFn: async () => {
      const payload = parse();
      if (!payload) throw new Error('json');
      return contabilidadeService.importar(payload, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contabilidade', 'painel'] });
      toast.success('Importado e persistido no hub.');
      onClose();
    },
    onError: () => toast.error('Falha ao importar (backend precisa estar deployado).'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <Upload className="h-5 w-5 text-indigo-500" /> Importar da Contabilizei
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-sm text-zinc-500">
          Cole o JSON <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{ empresa, competencias }'}</code> capturado
          pelo Claude in Chrome. Já vem preenchido com a captura atual — edite se quiser.
        </p>
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setPrevia(null); }}
          spellCheck={false}
          className="h-64 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800"
        />
        {previa && (
          <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
            Prévia: {previa.meses} competências ({previa.comReceita} com receita). Clique em Importar para persistir.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => conferir.mutate()} disabled={conferir.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {conferir.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Conferir
          </button>
          <button onClick={() => importar.mutate()} disabled={importar.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {importar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Importar
          </button>
        </div>
      </div>
    </div>
  );
}
