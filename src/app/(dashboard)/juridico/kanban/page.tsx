'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Columns3, Clock, Scale, Search, RefreshCw, CalendarClock, Copy, LayoutGrid, List, Plus, Download, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase,
} from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { CasesListView } from '@/features/legal-cases/components/cases-list-view';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { PhaseHeader, AddPhaseColumn } from '@/features/legal-cases/components/kanban-card-bits';
import { applyCardSort, kanbanCardKeys, loadPhaseSort, savePhaseSort, type CardSort } from '@/features/legal-cases/lib/kanban-sort';
import { fireConfetti, isTerminalPhase, shouldCelebrate, terminalCardClass } from '@/features/legal-cases/lib/kanban-terminal';
import { membersService } from '@/features/settings/services/members.service';
import { useAuthStore } from '@/stores/auth-store';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';
import { matchesKanbanSearch } from '@/features/legal-cases/lib/kanban-search';

// queryKey por lane: cada board escopa a busca no servidor à sua trilha; keys
// distintas evitam que o cache de um board sirva os cards de outro.
const KEY = ['legal-cases', 'kanban', 'judicial'];
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif";

// Cor da borda esquerda (4px) + dot da área, por área jurídica.
const AREA_DOT: Record<string, string> = {
  'Bancário': '#228BE6', 'Previdenciário': '#7048e8', 'Trabalhista': '#f08c00',
  'Consumidor': '#e64980', 'Cível': '#868e96',
};
const areaDot = (a: string | null) => AREA_DOT[a ?? 'Cível'] ?? '#868e96';

function cleanProduto(s: string | null): string | null {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
}

// Etiqueta de PRODUTO — hex exatos do Pipefy (com fallbacks coerentes).
function produtoColor(p: string | null): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/TRABALH|RESCIS|FERIAS|RECLAMA|VERBAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  if (/PORTABIL/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/REVISIONAL|CONSIGNAD/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/CONSUMID|DANO|INDENIZ|VOO|FRAUDE|NULID|OBRIGACAO|MONITORIA|ANULA/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}

// Badge de resultado da ação (vencemos/perdemos/parcial) — vem do "Vencemos a
// ação?" do trânsito em julgado ou do resultado da sentença.
function resultadoBadge(v: string | null): { label: string; bg: string; fg: string } | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('parcial')) return { label: 'Parcial', bg: '#f59f00', fg: '#fff' };
  if (s === 'não' || s === 'nao' || s.includes('improcedente')) return { label: '✗ Perdemos', bg: '#e03131', fg: '#fff' };
  if (s === 'sim' || s.includes('procedente')) return { label: '✓ Vencemos', bg: '#2f9e44', fg: '#fff' };
  return null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

type SortKey = 'prazo' | 'alfabetica' | 'movimentacao' | 'recente' | 'valor';
const SORT_LABEL: Record<SortKey, string> = {
  prazo: 'Próximo prazo', alfabetica: 'Cliente (A–Z)', movimentacao: 'Última movimentação', recente: 'Adicionado por último', valor: 'Maior valor',
};
const tms = (d: string | null | undefined) => (d ? new Date(d).getTime() : 0);

export default function FaseJudicialKanbanPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  // Abre direto a ficha quando vier ?case=<id> (link "Ver no Kanban" do chat).
  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [produto, setProduto] = useState('');
  const [resp, setResp] = useState('');
  const [phaseSel, setPhaseSel] = useState<string[]>([]);
  const [tagSel, setTagSel] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('prazo');
  const [showFora, setShowFora] = useState(true); // arquivados/abandonados VISÍVEIS por padrão (desmarque pra esconder)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [novo, setNovo] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Quantos filtros estão ativos (badge do botão "Filtros"). Busca e ordenação não contam.
  const activeFilters = [area, produto, resp].filter(Boolean).length + (phaseSel.length ? 1 : 0) + (tagSel.length ? 1 : 0) + (!showFora ? 1 : 0);
  const limparFiltros = () => { setArea(''); setProduto(''); setResp(''); setPhaseSel([]); setTagSel([]); setShowFora(true); };
  const dragScroll = useDragScroll();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: KEY,
    queryFn: () => legalCasesService.kanban({ lane: 'judicial' }),
    refetchInterval: 60_000,
  });
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });

  const phases = data?.phases ?? [];
  const cards = data?.cards ?? [];

  const areas = useMemo(
    () => Array.from(new Set(cards.map((c) => c.areaJuridica).filter(Boolean))).sort() as string[],
    [cards],
  );
  const produtos = useMemo(
    () => Array.from(new Set(cards.map((c) => c.produto).filter(Boolean))).sort() as string[],
    [cards],
  );
  // Responsáveis do filtro: deduplica por ID e ESCONDE quem não é "assignable"
  // (perfil Admin, logins duplicados) — assim o "Matheus" duplicado e o "Admin
  // Frider" somem do dropdown. O badge no card ainda mostra o nome real.
  const hiddenRespIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) if (m.assignable === false) s.add(m.user.id);
    return s;
  }, [members]);
  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible && !hiddenRespIds.has(c.responsible.id)) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, hiddenRespIds]);
  const phaseOptions = useMemo(
    () => phases.filter((p) => p.lane !== 'pre').map((p) => ({ id: p.key, name: p.label })),
    [phases],
  );
  const tagOptions = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    for (const c of cards) for (const t of c.tags ?? []) m.set(t.id, t);
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (area && c.areaJuridica !== area) return false;
      if (produto && c.produto !== produto) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (tagSel.length && !(c.tags ?? []).some((t) => tagSel.includes(t.id))) return false;
      if (!matchesKanbanSearch(c, search, [c.title, c.cnj, c.client, c.opponent])) return false;
      return true;
    });
  }, [cards, search, area, produto, resp, tagSel]);

  const byPhase = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of filtered) (map[c.phase] ??= []).push(c);
    const cmp = (a: KanbanCard, b: KanbanCard) => {
      switch (sortBy) {
        case 'alfabetica': return (a.client ?? a.title ?? '').localeCompare(b.client ?? b.title ?? '', 'pt-BR');
        case 'movimentacao': return tms(b.ultimoAndamento?.date) - tms(a.ultimoAndamento?.date);
        case 'recente': return tms(b.createdAt) - tms(a.createdAt);
        case 'valor': return (b.value ?? 0) - (a.value ?? 0);
        default: {
          const ap = a.proximoPrazo?.dueDate ? new Date(a.proximoPrazo.dueDate).getTime() : Infinity;
          const bp = b.proximoPrazo?.dueDate ? new Date(b.proximoPrazo.dueDate).getTime() : Infinity;
          return ap - bp;
        }
      }
    };
    for (const k of Object.keys(map)) map[k].sort(cmp);
    return map;
  }, [filtered, sortBy]);

  const FORA = new Set(['arquivado', 'abandonado', 'perdidos_valeska']);
  const visiblePhases = useMemo(() => {
    let ph = phases.filter((p) => p.lane !== 'pre' && (showFora || !FORA.has(p.key)));
    if (phaseSel.length) ph = ph.filter((p) => phaseSel.includes(p.key));
    return ph;
  }, [phases, showFora, phaseSel]);
  // Fases DESTE quadro (Judicial) — o seletor de mover fase só mostra estas, nunca
  // fases de outro kanban (Pré/Bancária/INSS). Transferência entre quadros é por
  // ação (ex.: protocolar), não pelo dropdown.
  const boardPhases = useMemo(() => phasesOfBoard(phases, 'judicial'), [phases]);

  const active = cards.find((c) => c.id === activeId) ?? null;

  // Só sócios (dono/OWNER ou ADMIN) renomeiam as fases.
  const activeOrg = useAuthStore((s) => s.organizations.find((o) => o.id === s.activeOrgId));
  const isOwner = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';
  // Handlers estáveis (useCallback) — sem isso o React.memo do Card não segura, e
  // cada refetch/tecla re-renderiza as ~centenas de cards.
  const onChanged = useCallback(() => qc.invalidateQueries({ queryKey: KEY }), [qc]);

  const renamePhase = useCallback(async (key: string, label: string) => {
    // Otimista: atualiza o label no cache do board na hora.
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, phases: old.phases.map((p) => (p.key === key ? { ...p, label } : p)) } : old,
    );
    try {
      await legalCasesService.renamePhaseLabel(key, label);
      toast.success('Fase renomeada');
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(err?.response?.data?.message || 'Só o dono do escritório pode renomear fases');
    }
  }, [qc]);

  const deletePhase = useCallback(async (phase: KanbanPhase) => {
    const msg = phase.custom
      ? `Excluir a fase "${phase.label}"? Só é possível se não houver processos nela.`
      : `Esconder a fase "${phase.label}" do quadro? Os processos nela continuam existindo — você reexibe em Configurações › Fases.`;
    if (!confirm(msg)) return;
    try {
      const res = await legalCasesService.deletePhase(phase.key);
      toast.success(res.mode === 'hidden' ? 'Fase escondida' : 'Fase excluída');
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao remover fase');
    }
  }, [qc]);

  const reorderPhaseCol = useCallback(async (phase: KanbanPhase, dir: 'left' | 'right') => {
    const i = visiblePhases.findIndex((p) => p.key === phase.key);
    const nb = visiblePhases[dir === 'left' ? i - 1 : i + 1];
    if (!nb) return;
    try { await legalCasesService.reorderPhase(phase.key, nb.key); qc.invalidateQueries({ queryKey: KEY }); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Só sócios podem reordenar fases'); }
  }, [qc, visiblePhases]);

  const move = useCallback(async (card: KanbanCard, toPhase: string) => {
    if (card.phase === toPhase) return;
    if (shouldCelebrate(qc.getQueryData<KanbanData>(KEY)?.phases.find((p) => p.key === toPhase))) fireConfetti();
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === card.id ? { ...x, phase: toPhase } : x)) } : old,
    );
    try {
      await legalCasesService.movePhase(card.id, toPhase);
      // Lê o label do cache (não do closure) pra manter o handler estável.
      const label = qc.getQueryData<KanbanData>(KEY)?.phases.find((p) => p.key === toPhase)?.label ?? toPhase;
      toast.success(`Movido para "${label}"`);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(err?.response?.data?.message || 'Erro ao mover o processo');
    }
  }, [qc]);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    const card = cards.find((x) => x.id === e.active.id);
    if (to && card && phases.some((p) => p.key === to)) move(card, to);
  };

  // Exporta a lista FILTRADA (as mesmas linhas que aparecem no quadro/lista) em CSV.
  const exportCsv = () => {
    const phaseLabel = (k: string) => phases.find((p) => p.key === k)?.label ?? k;
    const headers = ['Cliente', 'Parte adversa', 'Produto', 'Área', 'Etiquetas', 'CNJ', 'Valor', 'Fase', 'Responsável', 'Próximo prazo', 'Dias no processo', 'Dias na fase'];
    const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = filtered.map((c) => [
      c.client ?? c.title,
      c.opponent ?? '',
      cleanProduto(c.produto) ?? '',
      c.areaJuridica ?? '',
      (c.tags ?? []).map((t) => t.name).join(', '),
      c.cnj ?? '',
      c.value != null ? c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      phaseLabel(c.phase),
      c.responsible?.name ?? '',
      c.proximoPrazo ? fmtDate(c.proximoPrazo.dueDate) : '',
      c.diasNoProcesso ?? '',
      c.diasNaFase ?? '',
    ].map(cell).join(';'));
    const csv = '﻿' + [headers.join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `processos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} processos exportados`);
  };

  return (
    // lg:!pt-12 encolhe o respiro global do topo (o `.under-bar > *` põe 3.75rem;
    // 3rem basta pra passar a barra de vidro) e o cabeçalho vira UMA linha —
    // o quadro sobe e os cards ganham altura, sem esmagar nada.
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#fafafa] dark:bg-zinc-950 text-[#101820] dark:text-zinc-200 max-lg:overflow-y-auto lg:!pt-12" style={{ fontFamily: INTER }}>
      <div className="shrink-0 border-b border-[#dbeaf5] dark:border-zinc-800 px-4 py-2 lg:px-6">
        {/* Título + busca + filtros + ações na MESMA linha (quebra se faltar espaço) */}
        <div className="flex flex-wrap items-center gap-2">
          <Columns3 className="h-4 w-4 shrink-0 text-[#e11970]" />
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Fase Judicial</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] font-normal text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">
            {filtered.length} processos
          </span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
          {/* dica curta inline (só em telas bem largas, pra não empurrar a linha) */}
          <span className="hidden truncate text-xs text-zinc-400 2xl:inline">· o quadro se move sozinho conforme as publicações do DJEN</span>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, réu, CNJ, CPF…"
              className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          {/* Filtros num painel (não polui a barra): área, produto, responsável,
              fases, etiquetas, ordenação e arquivados. Busca fica fora. */}
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium dark:bg-zinc-900 ${activeFilters ? 'border-[#e11970] bg-[#e11970]/5 text-[#e11970]' : 'border-[#cfe0ed] bg-white text-[#101820] dark:border-zinc-700 dark:text-zinc-300'}`}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {activeFilters > 0 && <span className="rounded-full bg-[#e11970] px-1.5 text-[11px] font-semibold text-white">{activeFilters}</span>}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setFiltersOpen(false)} />
                <div className="absolute left-0 top-11 z-30 w-[280px] rounded-lg border border-[#cfe0ed] bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="space-y-2.5">
                    <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Área</p><Select value={area} onChange={setArea} placeholder="Todas as áreas" options={areas} full /></div>
                    <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Produto</p><Select value={produto} onChange={setProduto} placeholder="Todos os produtos" options={produtos} full /></div>
                    <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Responsável</p><Select value={resp} onChange={setResp} placeholder="Todos os responsáveis" valueMap={resps} full /></div>
                    <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fases</p><MultiSelect label="Selecionar fases" options={phaseOptions} selected={phaseSel} onChange={setPhaseSel} full /></div>
                    <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Etiquetas</p><MultiSelect label="Selecionar etiquetas" options={tagOptions} selected={tagSel} onChange={setTagSel} full /></div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ordenar por</p>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
                      </select>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                      <input type="checkbox" checked={showFora} onChange={(e) => setShowFora(e.target.checked)} className="accent-[#e11970]" />
                      Mostrar arquivados/abandonados
                    </label>
                    {activeFilters > 0 && (
                      <button onClick={limparFiltros} className="w-full rounded-lg border border-[#e11970] py-1.5 text-xs font-semibold text-[#e11970] hover:bg-[#e11970]/5">Limpar filtros ({activeFilters})</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setNovo(true)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#005efc] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo processo
          </button>
          <button onClick={exportCsv} title="Exportar a lista filtrada (CSV)" className="inline-flex items-center gap-1 rounded-lg border border-[#cfe0ed] bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'bg-[#e11970] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><LayoutGrid className="h-4 w-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'bg-[#e11970] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><List className="h-4 w-4" /> Lista</button>
          </div>
        </div>
      </div>

      {view === 'lista' ? (
        <CasesListView byPhase={byPhase} phases={visiblePhases} onOpen={setOpenCaseId} accent="#e11970" />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
          <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
            {isLoading && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
            {!isLoading && visiblePhases.map((phase, i) => (
              <Column key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} phases={boardPhases} onMove={move} onOpen={setOpenCaseId} onChanged={onChanged} canRename={isOwner} onRename={renamePhase} onDelete={deletePhase} onMoveLeft={isOwner && i > 0 ? () => reorderPhaseCol(phase, 'left') : undefined} onMoveRight={isOwner && i < visiblePhases.length - 1 ? () => reorderPhaseCol(phase, 'right') : undefined} />
            ))}
            {!isLoading && isOwner && <AddPhaseColumn board="judicial" accent="#e11970" onAdded={onChanged} />}
          </div>
          <DragOverlay>{active ? <Card c={active} phases={boardPhases} onMove={move} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {openCaseId && (
        <CaseDetailDrawer caseId={openCaseId} phases={boardPhases} onClose={() => setOpenCaseId(null)} />
      )}
      {novo && <NovoCasoDialog targetPhase="admissao" phases={visiblePhases} onClose={() => setNovo(false)} onCreated={() => { setNovo(false); qc.invalidateQueries({ queryKey: KEY }); }} />}
    </div>
  );
}

function Select({
  value, onChange, placeholder, options, valueMap, full,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; options?: string[];
  valueMap?: { id: string; name: string }[]; full?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 ${full ? 'w-full' : 'max-w-[180px]'}`}
    >
      <option value="">{placeholder}</option>
      {(valueMap ?? (options ?? []).map((o) => ({ id: o, name: o }))).map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

// Filtro multi-seleção (popover com checkboxes) — usado para Fases e Etiquetas.
function MultiSelect({
  label, options, selected, onChange, full,
}: {
  label: string; options: { id: string; name: string; color?: string }[]; selected: string[]; onChange: (v: string[]) => void; full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-sm dark:bg-zinc-900 ${full ? 'w-full justify-between' : ''} ${selected.length ? 'border-[#e11970] bg-[#e11970]/5 text-[#e11970]' : 'border-[#cfe0ed] bg-white text-[#101820] dark:border-zinc-700 dark:text-zinc-300'}`}
      >
        {label}{selected.length ? ` (${selected.length})` : ''} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-[#cfe0ed] bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {options.length === 0 && <p className="px-2 py-2 text-xs text-zinc-400">Nada disponível</p>}
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="mb-1 w-full rounded px-2 py-1 text-left text-xs font-medium text-[#e11970] hover:bg-[#e11970]/5">Limpar seleção</button>
            )}
            {options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="accent-[#e11970]" />
                {o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />}
                <span className="truncate text-[#101820] dark:text-zinc-300">{o.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Quantos cards uma coluna monta de início. Colunas gordas (100+ cards) montando
// tudo de uma vez — cada card é um draggable do dnd-kit — travavam a aba. O resto
// entra sob demanda com "ver mais", sem perder nada.
const COLUNA_INICIAL = 20;

function Column({
  phase, items, phases, onMove, onOpen, onChanged, canRename, onRename, onDelete, onMoveLeft, onMoveRight,
}: {
  phase: KanbanPhase; items: KanbanCard[]; phases: KanbanPhase[];
  onMove: (c: KanbanCard, to: string) => void; onOpen: (id: string) => void;
  onChanged: () => void; canRename: boolean; onRename: (key: string, label: string) => void;
  onDelete: (phase: KanbanPhase) => void;
  onMoveLeft?: () => void; onMoveRight?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const [limit, setLimit] = useState(COLUNA_INICIAL);
  const [sort, setSort] = useState<CardSort>(() => loadPhaseSort(phase.key));
  // Reseta o limite quando o conjunto de cards muda (filtro/refetch/troca de fase).
  useEffect(() => { setLimit(COLUNA_INICIAL); }, [phase.key, items.length]);
  const sortedItems = useMemo(() => applyCardSort(items, sort, kanbanCardKeys), [items, sort]);
  const shown = sortedItems.length > limit ? sortedItems.slice(0, limit) : sortedItems;
  const rest = sortedItems.length - shown.length;
  return (
    <div className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#e11970] bg-[#e11970]/5 dark:bg-[#e11970]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      {/* Header da fase — DENTRO do painel escuro (englobado, tom vai até o nome) */}
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <PhaseHeader phase={phase} canRename={canRename} onRename={onRename} onDelete={() => onDelete(phase)} onMoveLeft={onMoveLeft} onMoveRight={onMoveRight} sort={sort} onSort={(s) => { setSort(s); savePhaseSort(phase.key, s); }} />
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] font-normal text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {items.length === 0 && (
          <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">
            Vazio
          </p>
        )}
        {shown.map((c) => <Card key={c.id} c={c} phases={phases} onMove={onMove} onOpen={onOpen} onChanged={onChanged} />)}
        {rest > 0 && (
          <button
            onClick={() => setLimit((l) => l + 50)}
            className="rounded border border-dashed border-[#cfd6de] py-2 text-center text-xs font-medium text-[#4b5863] hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + {rest} mais
          </button>
        )}
      </div>
    </div>
  );
}

const Card = memo(function Card({
  c, phases, onMove, onOpen, onChanged, overlay,
}: {
  c: KanbanCard; phases: KanbanPhase[]; onMove: (c: KanbanCard, to: string) => void; onOpen?: (id: string) => void; onChanged?: () => void; overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const down = useRef<{ x: number; y: number } | null>(null);
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const slaEstourado = c.slaDias > 0 && c.diasNaFase != null && c.diasNaFase > c.slaDias;
  const prod = produtoColor(c.produto);
  const terminal = isTerminalPhase(phases.find((p) => p.key === c.phase));
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const style: React.CSSProperties = {
    borderLeftWidth: 4,
    borderLeftColor: areaDot(c.areaJuridica),
    // Virtualização nativa de PAINT: o navegador não faz layout/paint dos cards
    // fora da tela (colunas/linhas não visíveis) — some com o engasgo de montar
    // centenas de cards. contain-intrinsic-size reserva ~altura pro scroll não pular.
    ...(overlay ? {} : { contentVisibility: 'auto', containIntrinsicSize: '0 116px' } as React.CSSProperties),
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        if (overlay || !onOpen) return;
        const d = down.current;
        if (d && Math.abs(e.clientX - d.x) < 6 && Math.abs(e.clientY - d.y) < 6) onOpen(c.id);
      }}
      className={`cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-[0_4px_6px_0_rgba(102,102,102,.09),0_9px_14px_0_rgba(102,102,102,.06)] active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${
        isDragging && !overlay ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''} ${terminal && !overlay ? terminalCardClass : ''}`}
    >
      {/* Etiquetas: produto (cor) + área (cinza) */}
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        {c.produto && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>
            {cleanProduto(c.produto)}
          </span>
        )}
        {c.areaJuridica && (cleanProduto(c.produto) ?? '').toLowerCase().trim() !== c.areaJuridica.toLowerCase().trim() && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: 'rgb(209,209,209)', color: '#101820' }}>
            {c.areaJuridica}
          </span>
        )}
        {(() => {
          const r = resultadoBadge(c.vencemos);
          return r ? (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: r.bg, color: r.fg }}>
              {r.label}
            </span>
          ) : null;
        })()}
        {/* Etiquetas jurídicas (EntityTag, incl. migradas do Astrea) NÃO vão na face
            do card — enchiam demais e misturavam com produto/área (fix 406b46f, que
            regrediu). Ficam só produto + área aqui; a edição/visão das etiquetas é na
            ficha (drawer). O filtro/export por etiqueta continua funcionando. */}
      </div>

      {/* Cliente (título, CAPS) × parte adversa */}
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words pr-5 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-1 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}

      {/* Nº processo (copiável) */}
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.cnj}</span>
          <button
            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº do processo copiado'); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Copiar nº do processo"
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"
          >
            <Copy className="h-3 w-3" />
          </button>
        </p>
      )}

      {/* Valor · data protocolo */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {c.value != null && c.value > 0 ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</span>
        ) : <span />}
        {c.dataProtocolo && (
          <span className="text-[10px] text-[#48626f] dark:text-zinc-500">prot. {fmtDate(c.dataProtocolo)}</span>
        )}
      </div>

      {/* Vencimento */}
      {c.proximoPrazo && (
        overdue ? (
          <span className="mt-2 inline-flex h-5 items-center gap-1 rounded bg-[#c22e00] px-1.5 text-xs font-normal text-white" style={{ textShadow: 'rgba(0,0,0,0.25) 0px 1px 0px' }}>
            <CalendarClock className="h-3.5 w-3.5" /> Venc {fmtDate(c.proximoPrazo.dueDate)}
            {c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
          </span>
        ) : (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-400">
            <CalendarClock className="h-3.5 w-3.5" /> Vence {fmtDate(c.proximoPrazo.dueDate)}
            {c.proximoPrazo.type === 'FATAL' && <span className="font-semibold text-[#c22e00]">· fatal</span>}
          </p>
        )
      )}

      {/* Rodapé: 3 relógios + mover + avatar */}
      <div className="mt-1.5 flex items-center justify-between border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <div className="flex items-center text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400">
          <span className="mr-1.5 inline-flex items-center gap-0.5" title="Tempo no processo">
            <Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNoProcesso)}
          </span>
          <span className={`mr-1.5 inline-flex items-center gap-0.5 ${slaEstourado ? 'text-[#c22e00]' : ''}`} title="Tempo na fase atual">
            <Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}
          </span>
          {c.slaDias > 0 && (
            <span className={`inline-flex items-center gap-0.5 ${slaEstourado ? 'text-[#c22e00]' : 'opacity-60'}`} title="Prazo configurado da fase (SLA)">
              <Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {c.slaDias}d
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <select
            value={c.phase}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onMove(c, e.target.value)}
            title="Mover para fase"
            className="h-5 max-w-[16px] cursor-pointer appearance-none rounded border-0 bg-transparent text-[10px] text-[#48626f] hover:text-[#e11970] focus:outline-none"
          >
            {phases.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {c.responsible && (
            c.responsible.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.responsible.avatarUrl} alt={c.responsible.name} className="h-4 w-4 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#4a90e2] text-[8px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">{iniciais}</span>
            )
          )}
        </div>
      </div>
    </div>
  );
});
