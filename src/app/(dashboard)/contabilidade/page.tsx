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
  Info, Landmark, TrendingUp, AlertTriangle, CheckCircle2, Clock, Download, Loader2, Upload, X, Trash2, Plus,
  ChevronLeft, ChevronRight, Calendar, Wallet,
} from 'lucide-react';
import { apurar, calcularInssProlabore, type AnexoId } from '@/features/contabilidade/lib/simples';
import {
  contabilidadeService, derivarPainelLocal, type PainelContabil, type CompetenciaApurada, type GuiaStatus, type DocumentoContabil,
} from '@/features/contabilidade/services/contabilidade.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import {
  EMPRESA, COMPETENCIAS, SNAPSHOT_CAPTURA, DECLARACOES_ANUAIS, GUIA_LABEL, compLabel,
} from '@/features/contabilidade/data/contabilizei';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
const dt = (s?: string) => (s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : '—');

type View = 'visao' | 'imposto-real' | 'apuracao' | 'notas' | 'prolabore' | 'obrigacoes' | 'documentos';
const TABS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'imposto-real', label: 'Imposto do mês', icon: TrendingUp },
  { key: 'apuracao', label: 'Calculadora', icon: Calculator },
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
  const [view, setView] = useState<View>('imposto-real');
  const [importOpen, setImportOpen] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ['contabilidade', 'painel'],
    queryFn: () => contabilidadeService.painel(),
    retry: false,
  });

  // Fallback local: backend indisponível/vazio → apura a captura no cliente.
  const painelLocal = useMemo(() => derivarPainelLocal(EMPRESA, COMPETENCIAS), []);
  const usandoFallback = isError || !data || !Array.isArray(data.competencias) || data.competencias.length === 0;
  const painel = usandoFallback ? painelLocal : data;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Calculator className="h-5 w-5" />
              </span>
              Contabilidade
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Impostos, notas e obrigações do escritório — apuração do Simples Nacional.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-right text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">{painel.empresa.razaoSocial}</p>
            <p className="text-zinc-500">
              {painel.empresa.cnpj} · {painel.empresa.regime} · Anexo {painel.empresa.anexo} · ISS {painel.empresa.municipioISS}
            </p>
          </div>
        </header>

        {/* Aviso permanente: aba é só controle, não substitui a Contabilizei */}
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <p>
            <b>A contabilidade oficial fica na Contabilizei.</b> Aqui é só o seu controle — o imposto do mês
            <b> aparece sozinho</b> a partir do que você lança no Financeiro. Você não precisa operar nada.
            {' '}<button onClick={() => setImportOpen(true)} className="underline decoration-dotted underline-offset-2 hover:text-indigo-600">atualizar dados da Contabilizei</button>.
          </p>
        </div>

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
          {view === 'imposto-real' && <ImpostoReal painel={painel} />}
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

// ─── Imposto do mês (apuração automática a partir do Financeiro) ────────────────
function ImpostoReal({ painel }: { painel: PainelContabil }) {
  const anexo = painel.empresa.anexo;
  const inss = calcularInssProlabore(painel.empresa.proLabore);
  const inssMes = inss.total;

  const { data: fin, isLoading, isError } = useQuery({
    queryKey: ['contabilidade', 'financeiro-receita'],
    queryFn: () => financeiroService.dashboard(),
    retry: false,
  });

  // ── Apuração do MÊS (pra emitir/registrar a DAS) ──
  const [mesSel, setMesSel] = useState(compAtual());
  const [receitaEdit, setReceitaEdit] = useState<number | null>(null);
  const receitaFin = useMemo(() => {
    const m = (fin?.meses ?? []).find((x: any) => x.key === mesSel);
    return m ? Math.round((m.receita || 0) * 100) / 100 : 0;
  }, [fin, mesSel]);
  const receitaUsar = receitaEdit ?? receitaFin;
  const rbt12Sel = useMemo(() => {
    const ms = (fin?.meses ?? []).filter((m: any) => !m.projecao).sort((a: any, b: any) => a.key.localeCompare(b.key));
    const i = ms.findIndex((m: any) => m.key === mesSel);
    const base = i >= 0 ? ms.slice(Math.max(0, i - 12), i) : ms.slice(-12);
    return base.reduce((s: number, x: any) => s + (x.receita || 0), 0) || receitaUsar;
  }, [fin, mesSel, receitaUsar]);
  const dasSel = receitaUsar > 0 ? apurar({ receitaMes: receitaUsar, rbt12: rbt12Sel, anexo }) : null;
  const totalMesSel = (dasSel?.das ?? 0) + inssMes;
  const vencComp = shiftComp(mesSel, 1);
  const vencimento = `${vencComp}-20`;

  // meses REAIS (exclui projeções futuras) com receita
  const linhas = useMemo(() => {
    const meses = (fin?.meses ?? []).filter((m: any) => !m.projecao).sort((a: any, b: any) => a.key.localeCompare(b.key));
    // comps que já têm guia de DAS registrada no cofre/painel
    const dasRegistrado = new Set(
      painel.competencias.filter((c) => (c.guias ?? []).some((g) => g.tipo === 'DAS')).map((c) => c.comp),
    );
    return meses.map((m: any, i: number) => {
      const receita = Math.round((m.receita || 0) * 100) / 100;
      const rbt12 = meses.slice(Math.max(0, i - 12), i).reduce((s: number, x: any) => s + (x.receita || 0), 0) || receita;
      const das = receita > 0 ? apurar({ receitaMes: receita, rbt12, anexo }).das : 0;
      return { comp: m.key, receita, das, pago: dasRegistrado.has(m.key) };
    });
  }, [fin, painel, anexo]);

  const comReceita = linhas.filter((l) => l.receita > 0);
  const totalDevido = comReceita.reduce((s, l) => s + l.das, 0);
  const emAberto = comReceita.filter((l) => !l.pago);
  const totalAberto = emAberto.reduce((s, l) => s + l.das, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm dark:border-indigo-900/40 dark:bg-indigo-900/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <p className="text-indigo-900/90 dark:text-indigo-200/90">
          <b>Apuração automática.</b> O DAS de cada mês é calculado direto do que você faturou no{' '}
          <b>Financeiro</b> (× 4,5%). Toda vez que você lança um honorário lá, o imposto do mês aparece aqui —
          sem digitar nada. Some o INSS fixo de {brl(inssMes)}/mês.
        </p>
      </div>

      {/* Apuração do mês — pra emitir/registrar a DAS */}
      <Card className="border-indigo-200 dark:border-indigo-900/40">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Calculator className="h-4 w-4 text-indigo-500" /> Apuração do mês
          </h3>
          <div className="flex items-center gap-2">
            <input type="month" value={mesSel} onChange={(e) => { setMesSel(e.target.value); setReceitaEdit(null); }}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500">Faturou no mês</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(receitaUsar)}</p>
            <p className="text-[11px] text-zinc-400">do seu Financeiro</p>
          </div>
          <div className="rounded-lg bg-indigo-50/60 p-3 dark:bg-indigo-900/15">
            <p className="text-xs text-zinc-500">DAS (Simples)</p>
            <p className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{brl(dasSel?.das ?? 0)}</p>
            <p className="text-[11px] text-zinc-400">{dasSel ? pct(dasSel.aliquotaEfetiva) : '—'} · faixa {dasSel?.faixa ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-emerald-50/50 p-3 dark:bg-emerald-900/15">
            <p className="text-xs text-zinc-500">DARF INSS</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(inssMes)}</p>
            <p className="text-[11px] text-zinc-400">fixo (pró-labore)</p>
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500">Total a recolher</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(totalMesSel)}</p>
            <p className="text-[11px] text-zinc-400">vence {dt(vencimento)}</p>
          </div>
        </div>

        {dasSel && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
            {dasSel.tributos.map((t) => (
              <li key={t.codigo} className="tabular-nums"><span className="text-zinc-400">{t.nome}</span> {brl(t.valor)}</li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-zinc-400">
          Atualiza sozinho conforme você lança no Financeiro. Estes são os valores que a Contabilizei deve gerar no mês — serve pra você conferir.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-zinc-500">DAS total devido (período)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(totalDevido)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{comReceita.length} meses com receita</p>
        </Card>
        <Card className={totalAberto > 0 ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-900/10' : ''}>
          <p className="text-xs text-zinc-500">DAS em aberto (sem guia)</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${totalAberto > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>{brl(totalAberto)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{emAberto.length} meses sem DAS registrado</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">INSS fixo / mês</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(inssMes)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">todo mês, independe de receita</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <TrendingUp className="h-4 w-4 text-indigo-500" /> DAS por mês (do seu faturamento)
        </h3>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-zinc-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-zinc-400">Não consegui ler o Financeiro agora.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-400 dark:border-zinc-800">
                <th className="py-2 font-medium">Mês</th>
                <th className="py-2 text-right font-medium">Faturou</th>
                <th className="py-2 text-right font-medium">DAS (4,5%)</th>
                <th className="py-2 text-right font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {comReceita.slice().reverse().map((l) => (
                <tr key={l.comp} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50">
                  <td className="py-2 text-zinc-700 dark:text-zinc-200">{compLabel(l.comp)}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{brl(l.receita)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{brl(l.das)}</td>
                  <td className="py-2 text-right">
                    {l.pago
                      ? <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">registrado</span>
                      : <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">em aberto</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-zinc-400">
          "Em aberto" = mês com faturamento mas sem guia de DAS registrada aqui — provável DAS a regularizar.
          Base = sua receita do Financeiro; confirme que é honorário seu (não o bruto do alvará).
        </p>
      </Card>
    </div>
  );
}

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
const DOC_TIPOS = ['Guia DAS', 'Guia INSS', 'Recibo PGDAS', 'Recibo DCTFWeb', 'DEFIS', 'Nota fiscal', 'Extrato/Folha', 'Recibo pró-labore', 'Honorários contador', 'Outro'];
const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const compAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const shiftComp = (comp: string, delta: number) => {
  const [y, m] = comp.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function DocRow({ d, onRemove, removing }: { d: DocumentoContabil; onRemove: () => void; removing: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
        <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-zinc-700 hover:underline dark:text-zinc-200">{d.nome}</a>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{d.tipo}</span>
        <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">{fmtBytes(d.size)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-zinc-400">
        {d.valor != null && <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(d.valor)}</span>}
        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline"><Download className="h-3.5 w-3.5" /> abrir</a>
        <button onClick={onRemove} disabled={removing} className="text-rose-500 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </span>
    </li>
  );
}

function Documentos() {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['contabilidade', 'documentos'],
    queryFn: () => contabilidadeService.listDocumentos(),
    retry: false,
  });

  const [comp, setComp] = useState(compAtual());
  const [tipo, setTipo] = useState(DOC_TIPOS[0]);
  const [valor, setValor] = useState(0);
  const [arquivo, setArquivo] = useState<{ nome: string; mime: string; base64: string } | null>(null);

  // navegação de período (calendário) + "ver todos"
  const [verTodos, setVerTodos] = useState(false);
  const periodos = useMemo(() => [...new Set(docs.map((d) => d.comp))].sort((a, b) => b.localeCompare(a)), [docs]);
  const [cursor, setCursor] = useState<string | null>(null);
  const periodo = cursor ?? periodos[0] ?? compAtual();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 20MB).'); return; }
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    setArquivo({ nome: f.name, mime: f.type || 'application/pdf', base64 });
  }

  const upload = useMutation({
    mutationFn: () => contabilidadeService.addDocumento({ comp, tipo, nome: arquivo!.nome, mime: arquivo!.mime, base64: arquivo!.base64, valor: valor > 0 ? valor : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contabilidade', 'documentos'] });
      setArquivo(null); setValor(0);
      toast.success('Guia arquivada.');
    },
    onError: () => toast.error('Falha ao arquivar (backend indisponível?).'),
  });

  const remover = useMutation({
    mutationFn: (id: string) => contabilidadeService.removeDocumento(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contabilidade', 'documentos'] }); toast.success('Removido.'); },
    onError: () => toast.error('Falha ao remover.'),
  });

  const doMes = useMemo(() => docs.filter((d) => d.comp === periodo).sort((a, b) => a.tipo.localeCompare(b.tipo)), [docs, periodo]);
  const grupos = useMemo(() => {
    const map = new Map<string, DocumentoContabil[]>();
    for (const d of docs) { const a = map.get(d.comp) ?? []; a.push(d); map.set(d.comp, a); }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [docs]);
  const somaValor = (lista: DocumentoContabil[]) => lista.reduce((s, d) => s + (d.valor ?? 0), 0);
  const totalMes = somaValor(doMes);
  const totalGeral = somaValor(docs);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Upload className="h-4 w-4 text-indigo-500" /> Arquivar guia / recibo
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Competência">
            <input type="month" value={comp} onChange={(e) => setComp(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </Field>
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {DOC_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Quanto paguei (opcional)"><MoneyInput value={valor} onChange={setValor} /></Field>
          <Field label="Arquivo (PDF/imagem/XML)">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700/50">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{arquivo ? arquivo.nome : 'escolher arquivo…'}</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xml,application/pdf,image/*,application/xml" className="hidden" onChange={onPick} />
            </label>
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={() => upload.mutate()} disabled={!arquivo || upload.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Arquivar
          </button>
        </div>
      </Card>

      <Card>
        {/* barra de período (calendário) */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => { setVerTodos(false); setCursor(shiftComp(periodo, -1)); }}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <Calendar className="h-4 w-4 text-indigo-500" /> {verTodos ? 'Todos os períodos' : compLabel(periodo)}
            </span>
            <button onClick={() => { setVerTodos(false); setCursor(shiftComp(periodo, 1)); }}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setVerTodos((v) => !v)}
              className={`ml-1 rounded-lg px-2 py-1 text-xs font-medium ${verTodos ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>Todos</button>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm dark:bg-emerald-900/15">
            <Wallet className="h-4 w-4 text-emerald-500" />
            <span className="text-zinc-500">Paguei {verTodos ? 'no total' : 'no mês'}:</span>
            <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(verTodos ? totalGeral : totalMes)}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-zinc-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>
        ) : docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            Nenhuma guia arquivada ainda. Baixe as guias/recibos e suba no formulário acima — ficam guardadas por competência.
          </p>
        ) : verTodos ? (
          <div className="space-y-4">
            {grupos.map(([g, lista]) => (
              <div key={g}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{compLabel(g)}</p>
                  {somaValor(lista) > 0 && <p className="text-xs tabular-nums text-zinc-400">{brl(somaValor(lista))}</p>}
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {lista.map((d) => <DocRow key={d.id} d={d} onRemove={() => remover.mutate(d.id)} removing={remover.isPending} />)}
                </ul>
              </div>
            ))}
          </div>
        ) : doMes.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">Nenhum documento em {compLabel(periodo)}. Use ‹ › para navegar ou "Todos".</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {doMes.map((d) => <DocRow key={d.id} d={d} onRemove={() => remover.mutate(d.id)} removing={remover.isPending} />)}
          </ul>
        )}

        <p className="mt-3 text-xs text-zinc-400">
          Guias e recibos ficam permanentes aqui, por competência. Informe "quanto paguei" pra ver o total do mês.
        </p>
      </Card>
    </div>
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
