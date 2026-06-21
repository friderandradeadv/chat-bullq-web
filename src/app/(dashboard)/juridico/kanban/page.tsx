'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Columns3, Clock, Scale, Search, RefreshCw, CalendarClock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase,
} from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';

const KEY = ['legal-cases', 'kanban'];
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif";

// Cor da borda esquerda (4px) + dot da área, por área jurídica.
const AREA_DOT: Record<string, string> = {
  'Bancário': '#228BE6', 'Previdenciário': '#7048e8', 'Trabalhista': '#f08c00',
  'Consumidor': '#e64980', 'Cível': '#868e96',
};
const areaDot = (a: string | null) => AREA_DOT[a ?? 'Cível'] ?? '#868e96';

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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

export default function FaseJudicialKanbanPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [produto, setProduto] = useState('');
  const [resp, setResp] = useState('');
  const [showFora, setShowFora] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: KEY,
    queryFn: () => legalCasesService.kanban({}),
    refetchInterval: 30_000,
  });

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
  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (area && c.areaJuridica !== area) return false;
      if (produto && c.produto !== produto) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (q) {
        const hay = `${c.title} ${c.cnj ?? ''} ${c.client ?? ''} ${c.opponent ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, search, area, produto, resp]);

  const byPhase = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of filtered) (map[c.phase] ??= []).push(c);
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const ap = a.proximoPrazo?.dueDate ? new Date(a.proximoPrazo.dueDate).getTime() : Infinity;
        const bp = b.proximoPrazo?.dueDate ? new Date(b.proximoPrazo.dueDate).getTime() : Infinity;
        return ap - bp;
      });
    }
    return map;
  }, [filtered]);

  const FORA = new Set(['arquivado', 'abandonado', 'perdidos_valeska']);
  const visiblePhases = useMemo(
    () => phases.filter((p) => p.lane !== 'pre' && (showFora || !FORA.has(p.key))),
    [phases, showFora],
  );

  const active = cards.find((c) => c.id === activeId) ?? null;

  const move = async (card: KanbanCard, toPhase: string) => {
    if (card.phase === toPhase) return;
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, cards: old.cards.map((x) => (x.id === card.id ? { ...x, phase: toPhase } : x)) } : old,
    );
    try {
      await legalCasesService.movePhase(card.id, toPhase);
      const label = phases.find((p) => p.key === toPhase)?.label ?? toPhase;
      toast.success(`Movido para "${label}"`);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(err?.response?.data?.message || 'Erro ao mover o processo');
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    const card = cards.find((x) => x.id === e.active.id);
    if (to && card && phases.some((p) => p.key === to)) move(card, to);
  };

  return (
    <div className="flex h-full flex-col bg-[#fafafa] dark:bg-zinc-950 text-[#101820] dark:text-zinc-200" style={{ fontFamily: INTER }}>
      <div className="shrink-0 border-b border-[#dbeaf5] dark:border-zinc-800 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Columns3 className="h-5 w-5 text-[#e11970]" />
          <h1 className="text-xl font-bold text-[#101820] dark:text-zinc-100">Fase Judicial</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] font-normal text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">
            {filtered.length} processos
          </span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Arraste os processos entre as fases. O quadro se move sozinho conforme as publicações do DJEN.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, réu, CNJ…"
              className="h-9 w-60 rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          <Select value={area} onChange={setArea} placeholder="Todas as áreas" options={areas} />
          <Select value={produto} onChange={setProduto} placeholder="Todos os produtos" options={produtos} />
          <Select value={resp} onChange={setResp} placeholder="Todos os responsáveis" valueMap={resps} />
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showFora} onChange={(e) => setShowFora(e.target.checked)} className="accent-[#e11970]" />
            Mostrar arquivados/abandonados
          </label>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto py-4 pl-6 pr-4">
          {isLoading && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
          {!isLoading && visiblePhases.map((phase) => (
            <Column key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} phases={phases} onMove={move} onOpen={setOpenCaseId} />
          ))}
        </div>
        <DragOverlay>{active ? <Card c={active} phases={phases} onMove={move} overlay /> : null}</DragOverlay>
      </DndContext>

      {openCaseId && (
        <CaseDetailDrawer caseId={openCaseId} phases={phases} onClose={() => setOpenCaseId(null)} />
      )}
    </div>
  );
}

function Select({
  value, onChange, placeholder, options, valueMap,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; options?: string[];
  valueMap?: { id: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 max-w-[180px] rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <option value="">{placeholder}</option>
      {(valueMap ?? (options ?? []).map((o) => ({ id: o, name: o }))).map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

function Column({
  phase, items, phases, onMove, onOpen,
}: {
  phase: KanbanPhase; items: KanbanCard[]; phases: KanbanPhase[];
  onMove: (c: KanbanCard, to: string) => void; onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      {/* Header da fase (40px) — nome magenta + badge de contagem */}
      <div className="flex h-10 items-center gap-2 px-1">
        <h2 className="truncate text-sm font-medium text-[#e11970] dark:text-[#f06595]">{phase.label}</h2>
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] font-normal text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded border px-1.5 pb-2 pt-3 transition-colors ${
          isOver ? 'border-[#e11970] bg-[#e11970]/5' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-zinc-800 dark:bg-zinc-900/40'
        }`}
      >
        {items.length === 0 && (
          <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">
            Vazio
          </p>
        )}
        {items.map((c) => <Card key={c.id} c={c} phases={phases} onMove={onMove} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function Card({
  c, phases, onMove, onOpen, overlay,
}: {
  c: KanbanCard; phases: KanbanPhase[]; onMove: (c: KanbanCard, to: string) => void; onOpen?: (id: string) => void; overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const down = useRef<{ x: number; y: number } | null>(null);
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const slaEstourado = c.slaDias > 0 && c.diasNaFase != null && c.diasNaFase > c.slaDias;
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const style: React.CSSProperties = {
    borderLeftWidth: 4,
    borderLeftColor: areaDot(c.areaJuridica),
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
      className={`cursor-pointer touch-none rounded border border-[#cfe0ed] bg-white py-3 pl-2 pr-3 shadow-sm transition-shadow hover:shadow-[0_4px_6px_0_rgba(102,102,102,.09),0_9px_14px_0_rgba(102,102,102,.06)] active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 ${
        isDragging && !overlay ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      {/* Etiquetas: produto (cor) + área (cinza) */}
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        {c.produto && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>
            {c.produto}
          </span>
        )}
        {c.areaJuridica && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: 'rgb(209,209,209)', color: '#101820' }}>
            {c.areaJuridica}
          </span>
        )}
      </div>

      {/* Cliente (título, CAPS, clicável) × parte adversa */}
      <p className="mt-2 break-words pr-5 text-sm font-semibold uppercase leading-5 text-[#101820] hover:underline dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
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
}
