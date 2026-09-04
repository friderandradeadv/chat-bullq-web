'use client';

// Aba Contabilidade — CONFERÊNCIA, não segunda contabilidade.
//
// Reescrita em 04/09/2026 depois de "está defasada, os números não batem".
// Duas causas, as duas de arquitetura:
//
//  1. A base do imposto era a ENTRADA DE CAIXA do Financeiro. Em ago/2026 isso
//     somava R$ 42.854 (com alvará do cliente, transferência entre contas
//     próprias, estorno e reembolso) contra R$ 18.546 de honorário — a aba pedia
//     DAS de ~1.928 quando a guia real veio 761,18. Agora a base é
//     `receitaTributavel` (só honorário nosso), calculada no backend.
//  2. Metade da tela vinha de um snapshot importado à mão da Contabilizei, que
//     parou em mai/2026 e envelheceu em silêncio — e a contabilidade nem é mais
//     aquela. Agora a aba só lê fonte VIVA: o Financeiro (estimativa) e as guias
//     que a contabilidade manda no WhatsApp (valor real, via recebedor). Não há
//     mais fallback local com dados embutidos: sem backend, a tela diz que está
//     sem dados em vez de mostrar número velho como se fosse de hoje.
//
// Três seções, uma fonte por seção: Mês atual · Histórico · Documentos.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calculator, FolderOpen, FileText, Info, Landmark, TrendingUp, AlertTriangle,
  CheckCircle2, Download, Loader2, Upload, Trash2, Plus, ChevronLeft, ChevronRight,
  Calendar, Wallet, MessageSquare, Users, CalendarClock,
} from 'lucide-react';
import { apurar, calcularInssProlabore } from '@/features/contabilidade/lib/simples';
import {
  contabilidadeService, type PainelContabil, type DocumentoContabil, type InboxContabil,
} from '@/features/contabilidade/services/contabilidade.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
const dt = (s?: string) => (s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : '—');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const compLabel = (comp: string) => { const [y, m] = comp.split('-'); return `${MESES[Number(m) - 1] ?? m}/${y}`; };

type View = 'mes' | 'historico' | 'documentos';
const TABS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: 'mes', label: 'Mês atual', icon: Calculator },
  { key: 'historico', label: 'Histórico', icon: TrendingUp },
  { key: 'documentos', label: 'Documentos', icon: FolderOpen },
];

/** Guia REAL por competência, tirada do cofre (o recebedor arquiva com valor). */
function useGuiasReais(painel: PainelContabil | undefined) {
  return useMemo(() => {
    const das = new Map<string, DocumentoContabil>();
    const inss = new Map<string, DocumentoContabil>();
    for (const d of painel?.documentos ?? []) {
      if (d.valor == null) continue;
      if (d.tipo === 'Guia DAS') das.set(d.comp, d);
      if (d.tipo === 'Guia INSS') inss.set(d.comp, d);
    }
    return { das, inss };
  }, [painel]);
}

export default function ContabilidadePage() {
  const [view, setView] = useState<View>('mes');

  const { data: painel, isError, isLoading } = useQuery({
    queryKey: ['contabilidade', 'painel'],
    queryFn: () => contabilidadeService.painel(),
    retry: false,
  });

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-5xl p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Calculator className="h-5 w-5" />
              </span>
              Contabilidade
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Conferência dos impostos do escritório — Simples Nacional, Anexo IV.
            </p>
          </div>
          {painel?.empresa?.cnpj && (
            <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-right text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{painel.empresa.razaoSocial}</p>
              <p className="text-zinc-500">
                {painel.empresa.cnpj} · Anexo {painel.empresa.anexo} · ISS {painel.empresa.municipioISS}
              </p>
            </div>
          )}
        </header>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <p>
            <b>Quem apura é a sua contabilidade; aqui é conferência.</b> A guia que ela manda no WhatsApp entra
            sozinha, com o <b>valor real</b>, e ao lado dela fica a <b>estimativa</b> que o hub calcula sobre o
            honorário lançado no Financeiro. Quando as duas destoam, é sinal de lançamento faltando ou nota não
            emitida — é essa diferença que vale olhar.
          </p>
        </div>

        <nav className="mt-5 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button key={t.key} onClick={() => setView(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5">
          {isLoading && <Card><p className="text-sm text-zinc-500">Carregando…</p></Card>}
          {isError && (
            <Card>
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Não consegui falar com o servidor. Prefiro não mostrar número nenhum a mostrar número velho:
                recarregue a página daqui a pouco.
              </p>
            </Card>
          )}
          {painel && view === 'mes' && <MesAtual painel={painel} />}
          {painel && view === 'historico' && <Historico painel={painel} />}
          {view === 'documentos' && <Documentos />}
        </div>
      </div>
    </div>
  );
}

// ─── Mês atual ──────────────────────────────────────────────────────────────────
function MesAtual({ painel }: { painel: PainelContabil }) {
  const anexo = painel.empresa.anexo;
  const inss = calcularInssProlabore(painel.empresa.proLabore || 0);
  const guias = useGuiasReais(painel);

  const { data: fin, isLoading } = useQuery({
    queryKey: ['contabilidade', 'financeiro-receita'],
    queryFn: () => financeiroService.dashboard(),
    retry: false,
  });

  const [mesSel, setMesSel] = useState(compAtual());
  const [simulado, setSimulado] = useState<number | null>(null);

  // Base do Simples = honorário NOSSO (backend: `receitaTributavel`). Entrada de
  // caixa não serve: alvará do cliente e transferência entre contas próprias
  // passam pela conta sem ser faturamento.
  const receitaMes = useMemo(() => {
    const m = (fin?.meses ?? []).find((x: any) => x.key === mesSel);
    return m ? Math.round((m.receitaTributavel ?? 0) * 100) / 100 : 0;
  }, [fin, mesSel]);
  const receita = simulado ?? receitaMes;

  const rbt12 = useMemo(() => {
    const ms = (fin?.meses ?? []).filter((m: any) => !m.projecao).sort((a: any, b: any) => a.key.localeCompare(b.key));
    const i = ms.findIndex((m: any) => m.key === mesSel);
    const base = i >= 0 ? ms.slice(Math.max(0, i - 12), i) : ms.slice(-12);
    return base.reduce((s: number, x: any) => s + (x.receitaTributavel ?? 0), 0) || receita;
  }, [fin, mesSel, receita]);

  const est = receita > 0 ? apurar({ receitaMes: receita, rbt12, anexo }) : null;
  const docDas = guias.das.get(mesSel) ?? null;
  const dasReal = docDas?.valor ?? null;
  const docInss = guias.inss.get(mesSel) ?? null;
  const inssReal = docInss?.valor ?? null;
  const inssVale = inssReal ?? inss.total;
  const dasVale = dasReal ?? est?.das ?? 0;
  const vencimento = `${shiftComp(mesSel, 1)}-20`;
  const diferenca = dasReal != null && est ? dasReal - est.das : null;

  return (
    <div className="space-y-4">
      <Card className={dasReal != null ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-indigo-200 dark:border-indigo-900/40'}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Calculator className="h-4 w-4 text-indigo-500" /> Apuração de {compLabel(mesSel)}
          </h3>
          <input type="month" value={mesSel} onChange={(e) => { setMesSel(e.target.value); setSimulado(null); }}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500">Faturamento tributável</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? '…' : brl(receita)}
            </p>
            <p className="text-[11px] text-zinc-400">{simulado != null ? 'simulado' : 'honorários do Financeiro'}</p>
          </div>
          <div className="rounded-lg bg-indigo-50/60 p-3 dark:bg-indigo-900/15">
            <p className="text-xs text-zinc-500">DAS {dasReal != null ? '· guia real' : '· estimativa'}</p>
            <p className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{brl(dasVale)}</p>
            <p className="text-[11px] text-zinc-400">
              {dasReal != null ? 'da guia que a contabilidade mandou' : est ? `${pct(est.aliquotaEfetiva)} · faixa ${est.faixa}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50/50 p-3 dark:bg-emerald-900/15">
            <p className="text-xs text-zinc-500">DARF INSS {inssReal != null ? '· guia real' : '· fixo'}</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(inssVale)}</p>
            <p className="text-[11px] text-zinc-400">pró-labore de {brl(painel.empresa.proLabore || 0)}</p>
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500">Total a recolher</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(dasVale + inssVale)}</p>
            <p className="text-[11px] text-zinc-400">vence {dt(vencimento)}</p>
          </div>
        </div>

        {/* Estimativa × guia real — é aqui que aparece lançamento faltando */}
        {dasReal != null && est && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-300">
              A estimativa do hub era <b className="tabular-nums">{brl(est.das)}</b> · a guia veio{' '}
              <b className="tabular-nums">{brl(dasReal)}</b>
            </span>
            <span className="flex items-center gap-3">
              <span className={`tabular-nums font-semibold ${Math.abs(diferenca ?? 0) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {Math.abs(diferenca ?? 0) < 1 ? 'bate' : `${(diferenca ?? 0) > 0 ? '+' : ''}${brl(diferenca ?? 0)}`}
              </span>
              {docDas && (
                <a href={docDas.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                  <Download className="h-3.5 w-3.5" /> ver a guia
                </a>
              )}
            </span>
          </div>
        )}
        {dasReal == null && (
          <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
            Ainda não chegou a guia desta competência. O número acima é <b>estimativa</b> sobre o honorário
            lançado no Financeiro — quando a contabilidade mandar o PDF no WhatsApp, o valor real toma o lugar
            aqui sozinho.
          </p>
        )}

        {est && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
            {est.tributos.map((t) => (
              <li key={t.codigo} className="tabular-nums"><span className="text-zinc-400">{t.nome}</span> {brl(t.valor)}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Simulador — era a aba "Calculadora" */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <TrendingUp className="h-4 w-4 text-indigo-500" /> E se o faturamento fosse outro?
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Faturamento do mês"><MoneyInput value={receita} onChange={(v) => setSimulado(v)} /></Field>
          <Field label="RBT12 (12 meses anteriores)">
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm tabular-nums text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">{brl(rbt12)}</p>
          </Field>
          <Field label="DAS resultante">
            <p className="rounded-lg bg-indigo-50/60 px-3 py-2 text-sm font-semibold tabular-nums text-indigo-700 dark:bg-indigo-900/15 dark:text-indigo-300">
              {brl(est?.das ?? 0)}
            </p>
          </Field>
        </div>
        {simulado != null && (
          <button onClick={() => setSimulado(null)} className="mt-2 text-xs text-indigo-600 hover:underline">
            voltar para o faturamento real do mês
          </button>
        )}
      </Card>

      {/* Pró-labore / INSS — era aba própria */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Users className="h-4 w-4 text-indigo-500" /> Pró-labore e INSS{painel.empresa.socio ? ` — ${painel.empresa.socio}` : ''}
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
        <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Sociedade individual, sem empregados — só o pró-labore do sócio. Teto do INSS em 2026:{' '}
          {brl(painel.resumo.tetoInss)}.
        </p>
      </Card>
    </div>
  );
}

// ─── Histórico ──────────────────────────────────────────────────────────────────
function Historico({ painel }: { painel: PainelContabil }) {
  const qc = useQueryClient();
  const anexo = painel.empresa.anexo;
  const guias = useGuiasReais(painel);
  const { data: fin } = useQuery({
    queryKey: ['contabilidade', 'financeiro-receita'],
    queryFn: () => financeiroService.dashboard(),
    retry: false,
  });

  const linhas = useMemo(() => {
    const meses = (fin?.meses ?? []).filter((m: any) => !m.projecao).sort((a: any, b: any) => a.key.localeCompare(b.key));
    return meses.map((m: any, i: number) => {
      const receita = Math.round((m.receitaTributavel ?? 0) * 100) / 100;
      const base = meses.slice(Math.max(0, i - 12), i).reduce((s: number, x: any) => s + (x.receitaTributavel ?? 0), 0) || receita;
      const est = receita > 0 ? apurar({ receitaMes: receita, rbt12: base, anexo }).das : 0;
      const real = guias.das.get(m.key)?.valor ?? null;
      return { comp: m.key, receita, est, real };
    }).reverse();
  }, [fin, guias, anexo]);

  const comMovimento = linhas.filter((l) => l.receita > 0 || l.real != null);
  const recolhido = comMovimento.reduce((s, l) => s + (l.real ?? 0), 0);
  const estimado = comMovimento.reduce((s, l) => s + l.est, 0);
  const semGuia = comMovimento.filter((l) => l.real == null && l.est > 0);

  // Série importada à mão (Contabilizei) que sobrou no banco: a tela não lê mais
  // dela, mas enquanto existir é dado velho ocupando espaço — o botão apaga.
  const serieAntiga = painel.competencias ?? [];
  const limpar = useMutation({
    mutationFn: async () => { for (const c of serieAntiga) await contabilidadeService.removeCompetencia(c.comp); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contabilidade', 'painel'] }); toast.success('Série antiga removida.'); },
    onError: () => toast.error('Não consegui remover (só sócio pode).'),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-zinc-500">Recolhido de verdade</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(recolhido)}</p>
          <p className="text-[11px] text-zinc-400">soma das guias que chegaram</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Estimado pelo hub</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{brl(estimado)}</p>
          <p className="text-[11px] text-zinc-400">sobre o honorário lançado</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Meses sem guia arquivada</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{semGuia.length}</p>
          <p className="text-[11px] text-zinc-400">faturaram, mas a guia não está aqui</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <CalendarClock className="h-4 w-4 text-indigo-500" /> Mês a mês
        </h3>
        {!comMovimento.length ? (
          <p className="text-sm text-zinc-500">Sem faturamento lançado no Financeiro ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 text-left font-medium">Competência</th>
                  <th className="py-2 text-right font-medium">Faturamento</th>
                  <th className="py-2 text-right font-medium">DAS estimado</th>
                  <th className="py-2 text-right font-medium">DAS da guia</th>
                  <th className="py-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {comMovimento.map((l) => {
                  const dif = l.real != null ? l.real - l.est : null;
                  return (
                    <tr key={l.comp} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50">
                      <td className="py-2 text-zinc-700 dark:text-zinc-200">{compLabel(l.comp)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{brl(l.receita)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-500">{brl(l.est)}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-zinc-800 dark:text-zinc-100">
                        {l.real != null ? brl(l.real) : <span className="text-xs font-normal text-zinc-400">não chegou</span>}
                      </td>
                      <td className={`py-2 text-right tabular-nums text-xs ${dif == null ? 'text-zinc-300' : Math.abs(dif) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {dif == null ? '—' : Math.abs(dif) < 1 ? 'bate' : `${dif > 0 ? '+' : ''}${brl(dif)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          "Não chegou" quer dizer só que a guia daquele mês não está no cofre — pode ter sido paga fora do hub.
          Peça o PDF à contabilidade pelo WhatsApp e ele entra sozinho.
        </p>
      </Card>

      {serieAntiga.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              Sobrou no banco uma <b>série importada à mão</b> ({serieAntiga.length} competências, de{' '}
              {compLabel(serieAntiga[0].comp)} a {compLabel(serieAntiga[serieAntiga.length - 1].comp)}). A tela
              não lê mais dela — o histórico acima vem do Financeiro e das guias reais.
            </p>
            <button onClick={() => limpar.mutate()} disabled={limpar.isPending}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {limpar.isPending ? 'Removendo…' : 'Remover série antiga'}
            </button>
          </div>
        </Card>
      )}
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

/**
 * Recebedor contábil: a guia que a contabilidade manda no WhatsApp vira despesa
 * a pagar e cai no cofre sozinha. O card existe para o sócio VER que está ligado
 * e trocar o número da contabilidade sem depender de deploy — e para conferir,
 * pelo histórico, o que entrou sem ninguém digitar.
 */
/** O que cada papel vira — a mesma tabela do backend (contabil-inbox REGRAS). */
const DESTINOS: { doc: string; vai: string }[] = [
  { doc: 'Guia do DAS', vai: 'contas a pagar (Impostos e Taxas) + cofre' },
  { doc: 'DARF/GPS do INSS', vai: 'contas a pagar (GPS - INSS) + cofre' },
  { doc: 'Boleto dos honorários', vai: 'contas a pagar (Contador) + cofre' },
  { doc: 'Relatório do PGDAS', vai: 'só cofre' },
  { doc: 'Nota fiscal, DCTFWeb, DEFIS', vai: 'só cofre' },
  { doc: 'Recibo de pró-labore, folha', vai: 'só cofre' },
];

function Recebedor() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ['contabilidade', 'inbox'], queryFn: () => contabilidadeService.getInbox(), retry: false });
  const { data: recebidos = [] } = useQuery({ queryKey: ['contabilidade', 'recebidos'], queryFn: () => contabilidadeService.listRecebidos(), retry: false });

  const [numeros, setNumeros] = useState<string | null>(null);
  const valorAtual = (cfg?.remetentes ?? []).join(', ');
  const editado = numeros !== null && numeros !== valorAtual;

  const salvar = useMutation({
    mutationFn: (dto: Partial<InboxContabil>) => contabilidadeService.setInbox(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contabilidade', 'inbox'] }); setNumeros(null); toast.success('Recebedor atualizado.'); },
    onError: () => toast.error('Não consegui salvar (backend indisponível?).'),
  });

  if (!cfg) return null;
  const fone = (v: string) => {
    const d = v.replace(/\D/g, '');
    const s = d.startsWith('55') ? d.slice(2) : d;
    return s.length >= 10 ? `(${s.slice(0, 2)}) ${s.slice(2, -4)}-${s.slice(-4)}` : v;
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <MessageSquare className="h-4 w-4 text-indigo-500" /> Recebimento automático
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cfg.ativo
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
              {cfg.ativo ? 'ligado' : 'pausado'}
            </span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            O que a contabilidade mandar no WhatsApp {(cfg.remetentes ?? []).map(fone).join(' ou ') || '(sem número)'} entra
            sozinho, na competência certa. Documento de outro CNPJ, PDF sem valor legível e valor que não bate com a
            linha digitável são <b>arquivados mas não lançados</b> — nesses o hub avisa para você lançar à mão.
          </p>
          <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-[11px] text-zinc-500 sm:grid-cols-2 dark:text-zinc-400">
            {DESTINOS.map((d) => (
              <li key={d.doc} className="flex items-baseline gap-1.5">
                <span className="text-zinc-400">·</span>
                <span><b className="font-medium text-zinc-600 dark:text-zinc-300">{d.doc}</b> → {d.vai}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => salvar.mutate({ ativo: !cfg.ativo })}
          disabled={salvar.isPending}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${cfg.ativo
            ? 'border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {cfg.ativo ? 'Pausar' : 'Ligar'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Número(s) da contabilidade (com DDI, separados por vírgula)">
          <div className="flex gap-2">
            <input
              value={numeros ?? valorAtual}
              onChange={(e) => setNumeros(e.target.value)}
              placeholder="5544988327879"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            {editado && (
              <button
                onClick={() => salvar.mutate({ remetentes: (numeros ?? '').split(',').map((x) => x.trim()).filter(Boolean) })}
                disabled={salvar.isPending}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                Salvar
              </button>
            )}
          </div>
        </Field>
        <Field label="Últimos documentos que entraram sozinhos">
          {recebidos.length ? (
            <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
              {recebidos.slice(0, 3).map((r) => (
                <li key={r.hash} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.tipo} · {compLabel(r.comp)}</span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {r.valor != null ? brl(r.valor) : '—'} · {r.txId ? 'lançada' : 'arquivado'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">Nada ainda — a próxima guia que a contabilidade mandar aparece aqui.</p>
          )}
        </Field>
      </div>
    </Card>
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
      <Recebedor />

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

