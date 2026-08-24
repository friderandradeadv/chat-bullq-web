'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CalendarClock, Captions, CheckCircle2, ChevronDown, Circle, ClipboardCheck, Copy,
  ExternalLink, GraduationCap, Landmark, LayoutGrid, MessageSquare, PlayCircle, Rocket,
  Scale, Search, ShieldCheck, Sparkles, Video,
} from 'lucide-react';
import { TRILHAS, OBRIGATORIAS, TOTAL_AULAS, TOTAL_MINUTOS, promptCompleto } from '@/features/academia/content';
import { ManualRender } from '@/features/academia/components/manual-render';
import type { Aula, Trilha } from '@/features/academia/types';
import { useAuthStore } from '@/stores/auth-store';

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const STORAGE = 'academia:concluidas';

const ICONES: Record<string, React.ElementType> = {
  Rocket, LayoutGrid, Sparkles, CalendarClock, Scale, Landmark, MessageSquare, ShieldCheck,
};

function iconeDa(t: Trilha) {
  return ICONES[t.icone] ?? BookOpen;
}

/** Embed do vídeo da aula — Drive (/preview) ou URL direta. */
function VideoAula({ aula, cor }: { aula: Aula; cor: string }) {
  if (!aula.video) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-5 text-sm"
        style={{ borderColor: `${cor}66`, background: `${cor}0A` }}
      >
        <Video className="h-5 w-5 shrink-0" style={{ color: cor }} />
        <div>
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">Vídeo em produção</p>
          <p className="text-zinc-500 dark:text-zinc-400">
            O manual escrito abaixo já é completo e vale sozinho.
          </p>
        </div>
      </div>
    );
  }

  // Drive não deixa legendar: o vídeo vive dentro do player do Google, num
  // iframe que não aceita faixa de texto nossa. Fica como estava.
  if (aula.video.fonte === 'drive') {
    return (
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
        <iframe
          src={`https://drive.google.com/file/d/${aula.video.id}/preview`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="aspect-video w-full"
          title={aula.titulo}
        />
      </div>
    );
  }

  // mp4 nosso: player nativo, que aceita legenda e funciona bem no celular.
  const { url, legendas } = aula.video;
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
        <video
          key={url}
          src={url}
          controls
          playsInline
          preload="metadata"
          /* Sem isto a faixa de legenda de outro domínio é bloqueada — e falha calada. */
          crossOrigin="anonymous"
          className="aspect-video w-full"
        >
          {legendas && (
            <track kind="captions" src={legendas} srcLang="pt-BR" label="Português (Brasil)" default />
          )}
          Seu navegador não toca vídeo. Abra o arquivo direto: {url}
        </video>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Captions className="h-3.5 w-3.5" />
        {legendas
          ? 'Legenda em português — ligue no ícone de legendas do player.'
          : 'Sem legenda ainda neste vídeo.'}
      </p>
    </div>
  );
}

export default function AcademiaPage() {
  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isSocio = role === 'OWNER' || role === 'ADMIN';

  const [trilhaId, setTrilhaId] = useState(TRILHAS[0].id);
  const [aulaId, setAulaId] = useState(TRILHAS[0].aulas[0].id);
  const [busca, setBusca] = useState('');
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [promptAberto, setPromptAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Progresso local (por navegador). Simples de propósito: não depende da API.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setFeitas(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* primeiro acesso, sem nada salvo */
    }
  }, []);

  const marcar = (chave: string) => {
    setFeitas((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      try {
        localStorage.setItem(STORAGE, JSON.stringify([...n]));
      } catch {
        /* storage bloqueado — o progresso só não persiste */
      }
      return n;
    });
  };

  const trilha = TRILHAS.find((t) => t.id === trilhaId) ?? TRILHAS[0];
  const aula = trilha.aulas.find((a) => a.id === aulaId) ?? trilha.aulas[0];
  const chave = `${trilha.id}/${aula.id}`;

  useEffect(() => {
    setPromptAberto(false);
    setCopiado(false);
  }, [chave]);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return null;
    const hits: { trilha: Trilha; aula: Aula }[] = [];
    for (const t of TRILHAS) {
      for (const a of t.aulas) {
        const alvo = `${a.titulo} ${a.resumo} ${a.manual}`.toLowerCase();
        if (alvo.includes(q)) hits.push({ trilha: t, aula: a });
      }
    }
    return hits;
  }, [busca]);

  const progresso = Math.round((feitas.size / TOTAL_AULAS) * 100);

  const abrir = (t: Trilha, a: Aula) => {
    setTrilhaId(t.id);
    setAulaId(a.id);
    setBusca('');
  };

  const copiarPrompt = async () => {
    if (!aula.promptVideo) return;
    try {
      await navigator.clipboard.writeText(promptCompleto(aula));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard negado — o texto continua visível para seleção manual */
    }
  };

  const Icone = iconeDa(trilha);

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col px-4 py-6" style={{ fontFamily: INTER }}>
      {/* Cabeçalho */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7048E8]/10 text-[#7048E8] dark:bg-[#7048E8]/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Academia Frider</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {TRILHAS.length} trilhas · {TOTAL_AULAS} aulas · cerca de {Math.round(TOTAL_MINUTOS / 60)} h de conteúdo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-[#7048E8] transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {feitas.size}/{TOTAL_AULAS}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no conteúdo…"
              className="w-56 rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-800 outline-none focus:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Trilhas e aulas */}
        <div className="min-h-0 space-y-2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
          {resultados !== null ? (
            <div className="space-y-1.5">
              <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                {resultados.length} resultado(s)
              </p>
              {resultados.map(({ trilha: t, aula: a }) => (
                <button
                  key={`${t.id}/${a.id}`}
                  onClick={() => abrir(t, a)}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span className="block font-medium text-zinc-800 dark:text-zinc-100">{a.titulo}</span>
                  <span className="text-xs text-zinc-400">{t.titulo}</span>
                </button>
              ))}
              {resultados.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-zinc-400">Nada encontrado.</p>
              )}
            </div>
          ) : (
            TRILHAS.map((t) => {
              const I = iconeDa(t);
              const aberta = t.id === trilhaId;
              const feitasNa = t.aulas.filter((a) => feitas.has(`${t.id}/${a.id}`)).length;
              return (
                <div key={t.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setTrilhaId(t.id);
                      if (!aberta) setAulaId(t.aulas[0].id);
                    }}
                    className="flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${t.cor}1A`, color: t.cor }}
                    >
                      <I className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {t.titulo}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {feitasNa}/{t.aulas.length} aulas
                        {OBRIGATORIAS.includes(t.id) && ' · obrigatória'}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-zinc-400 transition ${aberta ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {aberta && (
                    <div className="space-y-0.5 border-t border-zinc-100 p-1.5 dark:border-zinc-800">
                      {t.aulas.map((a, i) => {
                        const k = `${t.id}/${a.id}`;
                        const ativa = a.id === aulaId;
                        return (
                          <button
                            key={a.id}
                            onClick={() => setAulaId(a.id)}
                            className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                              ativa
                                ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-white/10 dark:text-white'
                                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-white/5'
                            }`}
                          >
                            {feitas.has(k) ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
                            )}
                            <span className="min-w-0 flex-1">
                              {i + 1}. {a.titulo}
                              <span className="ml-1 text-[11px] text-zinc-400">{a.minutos} min</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Aula */}
        <div className="min-h-0 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold" style={{ color: trilha.cor }}>
                <Icone className="h-4 w-4" />
                {trilha.titulo}
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{aula.titulo}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{aula.resumo}</p>
            </div>
            <button
              onClick={() => marcar(chave)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                feitas.has(chave)
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
              }`}
            >
              {feitas.has(chave) ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {feitas.has(chave) ? 'Concluída' : 'Marcar como concluída'}
            </button>
          </div>

          <div className="mb-5">
            <VideoAula aula={aula} cor={trilha.cor} />
          </div>

          {aula.acervo && (
            <a
              href={aula.acervo.url}
              target="_blank"
              rel="noreferrer"
              className="mb-5 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-600 transition hover:border-[#7048E8]/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <PlayCircle className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="flex-1">{aula.acervo.titulo}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </a>
          )}

          <ManualRender md={aula.manual} cor={trilha.cor} />

          {aula.checklist && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <ClipboardCheck className="h-4 w-4" /> Você consegue fazer sozinho
              </p>
              <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                {aula.checklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: trilha.cor }} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prompt do vídeo — só sócios, para produzir o material no NotebookLM. */}
          {isSocio && aula.promptVideo && (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
              <button
                onClick={() => setPromptAberto((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <span className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-zinc-400" /> Prompt do vídeo (NotebookLM)
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${promptAberto ? 'rotate-180' : ''}`} />
              </button>
              {promptAberto && (
                <>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    {promptCompleto(aula)}
                  </pre>
                  <button
                    onClick={() => void copiarPrompt()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#7048E8] hover:underline"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copiado ? 'Copiado' : 'Copiar prompt'}
                  </button>
                </>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-zinc-400">
            Para quem é esta trilha: {trilha.publico}
          </p>
        </div>
      </div>
    </div>
  );
}
