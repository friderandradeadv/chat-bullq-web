'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, Download, FileSearch, Info, Loader2, Upload, XCircle,
} from 'lucide-react';
import {
  calculadoraRmcService,
  type ContextoHiscon,
  type HisconResultado,
  type VereditoAcao,
} from '@/features/calculadora-rmc/services/calculadora-rmc.service';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

// A UF muda o veredito: em MG a decadência do art. 178, II, do CC é reconhecida
// de ofício e derruba a anulatória por erro; fora dela, o mesmo contrato vira
// reposicionamento de tese em vez de descarte.
const VEREDITO: Record<VereditoAcao, { rotulo: string; classe: string }> = {
  AJUIZAR: {
    rotulo: 'Ajuizar',
    classe: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  REPOSICIONAR_TESE: {
    rotulo: 'Reposicionar tese',
    classe: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  },
  INDICIO_FRACO: {
    rotulo: 'Indício fraco',
    classe: 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  },
  NAO_AJUIZAR: {
    rotulo: 'Não ajuizar',
    classe: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  },
};

const NIVEL = {
  BLOQUEIO: { icon: XCircle, classe: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40', tinta: 'text-red-700 dark:text-red-300' },
  ALERTA: { icon: AlertTriangle, classe: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40', tinta: 'text-amber-700 dark:text-amber-300' },
  INFORMATIVO: { icon: Info, classe: 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900', tinta: 'text-zinc-600 dark:text-zinc-400' },
} as const;

export default function HisconPage() {
  const ref = useRef<HTMLInputElement>(null);
  const [ctx, setCtx] = useState<ContextoHiscon>({});
  const [res, setRes] = useState<HisconResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (f: File) => calculadoraRmcService.extrairHiscon(f, ctx),
    onSuccess: (r) => { setRes(r); setErro(null); },
    onError: (e: unknown) => {
      setRes(null);
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o HISCON.');
    },
  });

  // Averbação não é contrato: o HISCON registra a mesma operação duas vezes
  // quando ela migra entre instituições do mesmo grupo. A contagem deduplica
  // POR GRUPO — número de contrato se repete entre bancos diferentes, e
  // deduplicar globalmente fundiria réus distintos.
  //
  // A chave é o CÓDIGO do banco, nunca o nome: `contratos[].banco` vem cru do
  // HISCON ("739 -BANCOCETELEM S A") e `instituicoes[].nome` vem do registry
  // ("Banco Cetelem S.A."). Casar por nome falha em silêncio e devolve a
  // contagem de averbações disfarçada de contagem de contratos.
  const contratosUnicos = useMemo(() => {
    if (!res?.contratos || !res?.reus) return null;
    const grupoDe = new Map<string, string>();
    for (const g of res.reus.reus) {
      for (const i of g.instituicoes) if (i.codigo) grupoDe.set(i.codigo, g.grupoNome);
    }
    const porGrupo = new Map<string, Set<string>>();
    for (const c of res.contratos) {
      const cod = /^(\d{3})\s*-/.exec(c.banco ?? '')?.[1];
      const g = (cod && grupoDe.get(cod)) || c.banco || '?';
      if (!porGrupo.has(g)) porGrupo.set(g, new Set());
      porGrupo.get(g)!.add(c.contrato ?? '');
    }
    return porGrupo;
  }, [res]);

  const totalUnicos = useMemo(
    () => (contratosUnicos ? [...contratosUnicos.values()].reduce((s, v) => s + v.size, 0) : null),
    [contratosUnicos],
  );

  const baixarJson = () => {
    if (!res) return;
    const blob = new Blob([JSON.stringify(res, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analise-hiscon-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pa = res?.planoAcao;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
          <FileSearch className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Análise de HISCON</h1>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            Quantas ações o caso comporta, contra quem, e quais não valem a pena. A leitura é pela
            geometria do PDF; os indícios são calculados por regra e servem de subsídio, não de parecer.
          </p>
        </div>
      </header>

      {/* -------------------------------------------------- entrada */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">UF do foro</span>
            <select
              value={ctx.uf ?? ''}
              onChange={(e) => setCtx({ ...ctx, uf: e.target.value || undefined })}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">não informada</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Valor pretendido</span>
            <input
              type="number" inputMode="decimal" placeholder="ex.: 30000"
              onChange={(e) => setCtx({ ...ctx, valorPretendido: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Salário mínimo</span>
            <input
              type="number" inputMode="decimal" placeholder="ex.: 1621"
              onChange={(e) => setCtx({ ...ctx, salarioMinimo: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              onChange={(e) => setCtx({ ...ctx, precisaGrafotecnica: e.target.checked || undefined })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span className="pb-1.5 text-zinc-600 dark:text-zinc-400">Cliente nega a assinatura</span>
          </label>
        </div>

        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Sem a UF e o valor, os gates de decadência e de foro respondem que não foram avaliados,
          em vez de chutar.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <input
            ref={ref} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setArquivo(f.name); mut.mutate(f); }
              e.target.value = '';
            }}
          />
          <button
            onClick={() => ref.current?.click()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {mut.isPending ? 'Lendo o HISCON…' : 'Enviar HISCON (PDF)'}
          </button>
          {arquivo && <span className="text-sm text-zinc-500 dark:text-zinc-400">{arquivo}</span>}
          {res && (
            <button
              onClick={baixarJson}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Download className="h-4 w-4" /> Baixar análise (JSON)
            </button>
          )}
        </div>

        {erro && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}
      </section>

      {res && (
        <>
          {/* ---------------------------------------------- resumo */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Averbações lidas', String(res.contratos.length)],
              ['Contratos distintos', totalUnicos != null ? String(totalUnicos) : '—'],
              ['Réus (grupos)', res.reus ? `${res.reus.totalGrupos} de ${res.reus.totalInstituicoes} instituições` : '—'],
              ['Leitura', res.metodo === 'coordenadas' ? 'geometria do PDF' : 'IA (conferir)'],
            ].map(([r, v]) => (
              <div key={r} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">{r}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{v}</div>
              </div>
            ))}
          </section>

          {totalUnicos != null && totalUnicos !== res.contratos.length && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Averbação não é contrato: o HISCON registra a mesma operação duas vezes quando ela migra
              entre instituições do mesmo grupo. A diferença aqui é de {res.contratos.length - totalUnicos}.
            </p>
          )}

          {/* ---------------------------------------------- gates */}
          {!!res.gates?.gates?.length && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Antes de ajuizar
              </h2>
              {res.gates.gates.map((g) => {
                const n = NIVEL[g.nivel] ?? NIVEL.INFORMATIVO;
                const Icon = n.icon;
                return (
                  <div key={g.id} className={`rounded-xl border p-3 ${n.classe}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.tinta}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{g.titulo}</div>
                        {g.descricao && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{g.descricao}</p>}
                        {g.acao && <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{g.acao}</p>}
                        {g.fundamento && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{g.fundamento}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* ------------------------------------------ plano de ação */}
          {pa && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Plano de ação
                </h2>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {pa.resumo.aAjuizar} a ajuizar · {pa.resumo.aReposicionar} a reposicionar ·{' '}
                  {pa.resumo.indicioFraco} com indício fraco · {pa.resumo.aDescartar} a descartar
                </span>
              </div>

              {!!pa.diagnostico?.length && (
                <ul className="space-y-1 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  {pa.diagnostico.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-600" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {pa.acoes.map((a) => {
                  const v = VEREDITO[a.veredito];
                  const uni = contratosUnicos?.get(a.grupo)?.size;
                  return (
                    <div key={a.grupo} className={`rounded-xl border p-3 ${v.classe}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{a.grupo}</div>
                          <div className="mt-0.5 text-xs opacity-80">{a.instituicoes.join(' · ')}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-xs font-medium">
                          {v.rotulo}
                        </span>
                      </div>

                      <p className="mt-2 text-sm">{a.porque}</p>

                      {!!a.indicios?.length && (
                        <p className="mt-2 text-xs opacity-90">
                          <span className="font-semibold">Indícios:</span>{' '}
                          {a.indicios.slice(0, 4).map((i) => `${i.titulo} (${i.n})`).join(' · ')}
                        </p>
                      )}

                      <p className="mt-2 text-xs">
                        <span className="font-semibold">Próximo passo:</span> {a.proximoPasso}
                      </p>

                      <div className="mt-2 border-t border-current/15 pt-2 text-xs opacity-80">
                        {a.averbacoes} averbações
                        {uni != null && uni !== a.averbacoes ? ` (${uni} contratos)` : ''} ·{' '}
                        {a.dentroDoPrazo} no prazo · {a.decaidos} decaídas
                        {a.cartoesAtivos ? ` · ${a.cartoesAtivos} cartão(ões) ativo(s)` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---------------------------------------------- avisos */}
          {!!res.avisos?.length && (
            <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Avisos da leitura</h2>
              <ul className="mt-1 space-y-1">
                {[...res.avisos.reduce(
                  (m, a) => m.set(a, (m.get(a) ?? 0) + 1),
                  new Map<string, number>(),
                )].map(([a, n]) => (
                  <li key={a} className="text-xs text-zinc-600 dark:text-zinc-400">
                    • {a}{n > 1 && <span className="font-medium"> ({n}×)</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="pb-4 text-xs text-zinc-500 dark:text-zinc-500">
            Indícios calculados a partir de dados medidos do HISCON. Não constituem parecer jurídico,
            não afirmam fraude e não prometem resultado. A conferência contra o documento original é
            obrigatória antes de qualquer uso judicial.
          </p>
        </>
      )}
    </div>
  );
}
