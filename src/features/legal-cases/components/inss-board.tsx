'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { produtoColor, areaColor } from '@/features/legal-cases/lib/etiqueta-cores';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Search, RefreshCw, Scale, Copy, CalendarClock, Clock, Stethoscope, Scale as ScaleIcon, Loader2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase } from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { CasesListView } from '@/features/legal-cases/components/cases-list-view';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';
import { useKanbanBulk, KanbanBulkBar, KanbanColumnSelect, KanbanSelectBox, KanbanSelectTrigger, type KanbanBulk } from '@/features/legal-cases/components/kanban-bulk';
import { matchesKanbanSearch } from '@/features/legal-cases/lib/kanban-search';

// inss_admin está na trilha 'pre' — escopa a busca por lane (mesma key/cache do
// board Pré-processual, que puxa os mesmos cards).
const KEY = ['legal-cases', 'kanban', 'pre'];
const ACCENT = '#7048e8';
// Fase judicial de destino ao "entrar com o processo" após indeferimento.
const JUDICIAL_TARGET = 'montar_inicial';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

function cleanProduto(s: string | null): string | null {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
}

// Situações do requerimento — colunas do kanban. `key` vazio = "Em análise"
// (metadata.faseData.inss_admin.resultado ausente).
type Resultado = '' | 'deferido' | 'recurso' | 'indeferido';
const norm = (v: string | null): Resultado => {
  const s = (v ?? '').toLowerCase();
  if (s.includes('defer') && !s.includes('indefer')) return 'deferido';
  if (s.includes('recurs')) return 'recurso';
  if (s.includes('indefer')) return 'indeferido';
  return '';
};
const COLS: { key: Resultado; dropId: string; label: string; color: string }[] = [
  { key: '', dropId: 'res:analise', label: 'Em análise', color: '#868e96' },
  { key: 'deferido', dropId: 'res:deferido', label: 'Deferido', color: '#2f9e44' },
  { key: 'recurso', dropId: 'res:recurso', label: 'Em recurso', color: '#f59f00' },
  { key: 'indeferido', dropId: 'res:indeferido', label: 'Indeferido', color: '#e03131' },
];
const DROP_TO_RES: Record<string, Resultado> = Object.fromEntries(COLS.map((c) => [c.dropId, c.key]));

/**
 * Board do INSS administrativo — kanban com as mesmas regras dos outros: colunas
 * arrastáveis (aqui = situação do requerimento), toggle Kanban|Lista, drag-scroll
 * e card padrão. Arrastar um card entre colunas grava o resultado; no indeferido,
 * o card ganha "Entrar com o judicial" (move o processo para a Fase Judicial).
 */
export function InssBoard() {
  const qc = useQueryClient();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragScroll = useDragScroll();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban({ lane: 'pre' }), refetchInterval: 60_000 });

  // Seleção em massa (caixinha no card + barra de ações no rodapé).
  const bulk = useKanbanBulk();
  const inss = useMemo(() => {
    return (data?.cards ?? []).filter((c) => {
      if (c.phase !== 'inss_admin') return false;
      if (!matchesKanbanSearch(c, search, [c.title, c.client, c.opponent])) return false;
      return true;
    });
  }, [data, search]);

  const byRes = useMemo(() => {
    const m: Record<Resultado, KanbanCard[]> = { '': [], deferido: [], recurso: [], indeferido: [] };
    for (const c of inss) m[norm(c.inssResultado)].push(c);
    return m;
  }, [inss]);

  const setResultado = async (id: string, value: Resultado) => {
    const card = inss.find((c) => c.id === id);
    if (card && norm(card.inssResultado) === value) return;
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === id ? { ...x, inssResultado: value || null } : x)) } : old,
    );
    try {
      await legalCasesService.saveFaseField(id, 'inss_admin', 'resultado', value || null);
      const lbl = COLS.find((c) => c.key === value)?.label ?? 'Em análise';
      toast.success(`Marcado como "${lbl}"`);
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(e?.response?.data?.message || 'Erro ao salvar o resultado');
    }
  };

  const entrarJudicial = async (c: KanbanCard) => {
    if (!confirm(`Entrar com o processo judicial de ${(c.client ?? c.title)}?\nO card sai do INSS administrativo e vai para a Fase Judicial (Montar Inicial).`)) return;
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === c.id ? { ...x, phase: JUDICIAL_TARGET } : x)) } : old,
    );
    try {
      await legalCasesService.movePhase(c.id, JUDICIAL_TARGET);
      toast.success('Processo movido para a Fase Judicial (Montar Inicial)');
      qc.invalidateQueries({ queryKey: KEY });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(e?.response?.data?.message || 'Erro ao mover o processo');
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    if (to && to in DROP_TO_RES) setResultado(e.active.id as string, DROP_TO_RES[to]);
  };

  // Lista (mesma tabela dos outros kanbans): situações viram "fases".
  const listaPhases = COLS.map((c) => ({ key: c.dropId, label: c.label } as unknown as KanbanPhase));
  const listaByPhase = Object.fromEntries(COLS.map((c) => [c.dropId, byRes[c.key]])) as Record<string, KanbanCard[]>;

  const active = inss.find((c) => c.id === activeId) ?? null;

  return (
    // lg:!pt-12 encolhe o respiro global do topo (o `.under-bar > *` põe 3.75rem;
    // 3rem basta pra passar a barra de vidro) e o cabeçalho vira UMA linha —
    // o quadro sobe e os cards ganham altura, sem esmagar nada.
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#fafafa] text-[#101820] dark:bg-zinc-950 dark:text-zinc-200 max-lg:overflow-y-auto lg:!pt-12">
      <div className="shrink-0 border-b border-[#dbeaf5] px-4 py-2 lg:px-6 dark:border-zinc-800">
        {/* Título + dica + busca + ações na MESMA linha (quebra se faltar espaço) */}
        <div className="flex flex-wrap items-center gap-2">
          <Stethoscope className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">INSS — Administrativo</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{inss.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
          <span className="hidden truncate text-xs text-zinc-400 2xl:inline">· arraste os cards entre as situações — no indeferimento, você entra com a ação judicial em um clique</span>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, CPF…"
              className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'bg-[#7048e8] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><LayoutGrid className="h-4 w-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'bg-[#7048e8] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><List className="h-4 w-4" /> Lista</button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-6 text-sm text-zinc-400">Carregando…</p>
      ) : inss.length === 0 ? (
        <div className="px-6 py-10">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Nenhum processo na fase administrativa do INSS. Quando um card entrar na etapa PROCESSO ADMINISTRATIVO - INSS, ele aparece aqui.
          </div>
        </div>
      ) : view === 'lista' ? (
        <CasesListView byPhase={listaByPhase} phases={listaPhases} onOpen={setOpenCaseId} accent={ACCENT} />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
          <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
            {COLS.map((col) => (
              <Column key={col.dropId} col={col} items={byRes[col.key]} bulk={bulk} onOpen={setOpenCaseId} onEntrarJudicial={entrarJudicial} />
            ))}
          </div>
          <DragOverlay>{active ? <InssCard c={active} onEntrarJudicial={entrarJudicial} overlay /> : null}</DragOverlay>
          {/* As colunas daqui são o RESULTADO do requerimento (metadata), não fases —
              então o destino do "mover em massa" é a própria fase do INSS ou uma fase
              do Pré-Processual (mesma trilha 'pre', de onde estes cards vieram). */}
          <KanbanBulkBar
            bulk={bulk}
            cards={inss}
            phases={[...phasesOfBoard(data?.phases ?? [], 'inss'), ...phasesOfBoard(data?.phases ?? [], 'pre')]}
            queryKey={KEY}
            accent={ACCENT}
          />
        </DndContext>
      )}

      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={phasesOfBoard(data?.phases ?? [], 'inss')} onClose={() => setOpenCaseId(null)} />}
    </div>
  );
}

function Column({
  col, items, bulk, onOpen, onEntrarJudicial,
}: {
  col: { key: Resultado; dropId: string; label: string; color: string };
  items: KanbanCard[];
  bulk: KanbanBulk;
  onOpen: (id: string) => void;
  onEntrarJudicial: (c: KanbanCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.dropId });
  return (
    <div className={`group/col flex min-h-0 w-[300px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#7048e8] bg-[#7048e8]/5 dark:bg-[#7048e8]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
        <h2 className="truncate text-sm font-medium" style={{ color: col.color }}>{col.label}</h2>
        <KanbanSelectTrigger bulk={bulk} accent={ACCENT} />
        <span className="ml-auto flex items-center gap-1.5">
          <KanbanColumnSelect bulk={bulk} ids={items.map((c) => c.id)} accent={ACCENT} />
          <span className="rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
        </span>
      </div>
      <div ref={setNodeRef}
        className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {items.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {items.map((c) => <InssCard key={c.id} c={c} bulk={bulk} colIds={items.map((x) => x.id)} onOpen={onOpen} onEntrarJudicial={onEntrarJudicial} />)}
      </div>
    </div>
  );
}

function InssCard({
  c, bulk, colIds, onOpen, onEntrarJudicial, overlay,
}: {
  c: KanbanCard;
  bulk?: KanbanBulk;
  colIds?: string[];
  onOpen?: (id: string) => void;
  onEntrarJudicial: (c: KanbanCard) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const down = useRef<{ x: number; y: number } | null>(null);
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const indeferido = norm(c.inssResultado) === 'indeferido';
  const [busy, setBusy] = useState(false);
  const style: React.CSSProperties = {
    borderLeftWidth: 4, borderLeftColor: ACCENT,
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
      className={`group relative cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging && !overlay ? 'opacity-40' : ''} ${overlay ? 'rotate-2 shadow-lg' : ''} ${bulk?.has(c.id) ? 'ring-2 ring-[#7048e8]' : ''}`}
    >
      {bulk && !overlay && <KanbanSelectBox bulk={bulk} id={c.id} colIds={colIds} accent={ACCENT} />}
      {/* pr-5 reserva o canto da caixinha de seleção */}
      <div className="-ml-1 flex flex-wrap items-center gap-1 pr-5">
        {c.produto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{cleanProduto(c.produto)}</span>}
        {/* Etiquetas (EntityTag/Astrea) NÃO vão na face do card — só na ficha (fix 406b46f). */}
      </div>

      <p className="mt-2 break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}

      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" /><span className="truncate">{c.cnj}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº copiado'); }} onPointerDown={(e) => e.stopPropagation()} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></button>
        </p>
      )}

      {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
      {c.proximoPrazo && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
        </span>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400" title="Tempo na fase"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
        {c.responsible && (c.responsible.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.responsible.avatarUrl} alt="" title={c.responsible.name} className="h-5 w-5 rounded-full object-cover" />
          : <span title={c.responsible.name} className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>)}
      </div>

      {indeferido && !overlay && (
        <button
          disabled={busy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={async (e) => { e.stopPropagation(); setBusy(true); try { await onEntrarJudicial(c); } finally { setBusy(false); } }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#7048e8] px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScaleIcon className="h-3.5 w-3.5" />} Entrar com o judicial
        </button>
      )}
    </div>
  );
}
