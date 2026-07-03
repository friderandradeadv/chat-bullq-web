'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Workflow, Search, RefreshCw, User, FileCheck2, X, LayoutGrid, List, Scale, Copy, CalendarClock, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase,
} from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { CasesListView } from '@/features/legal-cases/components/cases-list-view';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { PhaseHeader } from '@/features/legal-cases/components/kanban-card-bits';
import { useAuthStore } from '@/stores/auth-store';
import { useDragScroll } from '@/lib/use-drag-scroll';

const KEY = ['legal-cases', 'kanban', 'pre'];
const INPUT = 'h-[38px] w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200';

function cleanProduto(s: string | null): string | null {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
}
function produtoColor(p: string | null): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/TRABALH|RESCIS|FERIAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD|CONSUMID/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

export default function PreProcessualPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  // Abre direto a ficha quando vier ?case=<id> (link "Ver no Kanban" do chat).
  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setOpenCaseId(cid);
  }, []);
  const [protocolarId, setProtocolarId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [resp, setResp] = useState('');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [novo, setNovo] = useState(false);
  const dragScroll = useDragScroll();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban({ lane: 'pre' }), refetchInterval: 60_000 });
  // Exclui a trilha bancária (banco_*): ela tem board próprio (Fase Bancária).
  const phases = (data?.phases ?? []).filter((p) => p.lane === 'pre' && !p.key.startsWith('banco_'));
  const cards = data?.cards ?? [];

  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const preKeys = new Set(phases.map((p) => p.key));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (!preKeys.has(c.phase)) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (q && !`${c.title} ${c.client ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, search, resp, phases]);

  const byPhase = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of filtered) (map[c.phase] ??= []).push(c);
    return map;
  }, [filtered]);

  const active = cards.find((c) => c.id === activeId) ?? null;

  // Só sócios (OWNER/ADMIN) renomeiam as fases — igual à Fase Judicial.
  const activeOrg = useAuthStore((s) => s.organizations.find((o) => o.id === s.activeOrgId));
  const canRename = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';
  const renamePhase = async (key: string, label: string) => {
    qc.setQueryData<KanbanData>(KEY, (old) =>
      old ? { ...old, phases: old.phases.map((p) => (p.key === key ? { ...p, label } : p)) } : old,
    );
    try {
      await legalCasesService.renamePhaseLabel(key, label);
      toast.success('Fase renomeada');
    } catch (err: any) {
      qc.invalidateQueries({ queryKey: KEY });
      toast.error(err?.response?.data?.message || 'Só sócios podem renomear fases');
    }
  };

  const move = async (card: KanbanCard, to: string) => {
    if (card.phase === to) return;
    qc.setQueryData<KanbanData>(KEY, (old) => old ? { ...old, cards: old.cards.map((x) => x.id === card.id ? { ...x, phase: to } : x) } : old);
    try { await legalCasesService.movePhase(card.id, to); qc.invalidateQueries({ queryKey: KEY }); }
    catch { qc.invalidateQueries({ queryKey: KEY }); toast.error('Erro ao mover'); }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as string | undefined;
    const card = cards.find((x) => x.id === e.active.id);
    if (to && card && preKeys.has(to)) move(card, to);
  };

  return (
    <div className="flex h-full flex-col bg-[#fafafa] dark:bg-zinc-950 text-[#101820] dark:text-zinc-200">
      <div className="shrink-0 border-b border-[#dbeaf5] dark:border-zinc-800 px-4 pt-6 pb-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[#e11970]" />
          <h1 className="text-xl font-bold text-[#101820] dark:text-zinc-100">Pré-Processual</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{filtered.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">Do fechamento do contrato até o protocolo. Ao protocolar, o processo migra para a Fase Judicial.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…"
              className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <select value={resp} onChange={(e) => setResp(e.target.value)} className="h-9 max-w-[200px] rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="">Todos os responsáveis</option>
            {resps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => setNovo(true)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#005efc] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo processo
          </button>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'bg-[#e11970] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><LayoutGrid className="h-4 w-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'bg-[#e11970] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><List className="h-4 w-4" /> Lista</button>
          </div>
        </div>
      </div>

      {view === 'lista' ? (
        <CasesListView byPhase={byPhase} phases={phases} onOpen={setOpenCaseId} accent="#e11970" />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
          <div ref={dragScroll.ref} {...dragScroll.handlers} className="flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto py-4 pl-4 pr-4 lg:pl-6">
            {isLoading && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
            {!isLoading && phases.map((phase) => (
              <Column key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} onOpen={setOpenCaseId} onProtocolar={setProtocolarId} onChanged={() => qc.invalidateQueries({ queryKey: KEY })} canRename={canRename} onRename={renamePhase} />
            ))}
          </div>
          <DragOverlay>{active ? <Card c={active} /> : null}</DragOverlay>
        </DndContext>
      )}

      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={data?.phases ?? []} onClose={() => setOpenCaseId(null)} />}
      {protocolarId && <ProtocolarDialog caseId={protocolarId} onClose={() => setProtocolarId(null)} onDone={() => { setProtocolarId(null); qc.invalidateQueries({ queryKey: KEY }); }} />}
      {novo && <NovoCasoDialog targetPhase="novos_clientes" phases={phases} onClose={() => setNovo(false)} onCreated={() => { setNovo(false); qc.invalidateQueries({ queryKey: KEY }); }} />}
    </div>
  );
}

function Column({ phase, items, onOpen, onProtocolar, onChanged, canRename, onRename }: { phase: KanbanPhase; items: KanbanCard[]; onOpen: (id: string) => void; onProtocolar: (id: string) => void; onChanged: () => void; canRename: boolean; onRename: (key: string, label: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const isProtocolo = phase.key === 'protocolo';
  return (
    <div className="flex min-h-0 w-[280px] shrink-0 flex-col">
      <div className="flex h-10 items-center gap-2 px-1">
        <PhaseHeader phase={phase} canRename={canRename} onRename={onRename} />
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border px-1.5 pb-2 pt-3 transition-colors ${isOver ? 'border-[#e11970] bg-[#e11970]/5' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-zinc-800 dark:bg-zinc-900/40'}`}>
        {items.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {items.map((c) => <Card key={c.id} c={c} onOpen={onOpen} onProtocolar={isProtocolo ? onProtocolar : undefined} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function Card({ c, onOpen, onProtocolar, onChanged }: { c: KanbanCard; onOpen?: (id: string) => void; onProtocolar?: (id: string) => void; onChanged?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const down = useRef<{ x: number; y: number } | null>(null);
  const prod = produtoColor(c.produto);
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onPointerDownCapture={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => { if (!onOpen) return; const d = down.current; if (d && Math.abs(e.clientX - d.x) < 6 && Math.abs(e.clientY - d.y) < 6) onOpen(c.id); }}
      className={`cursor-pointer touch-none rounded border border-[#cfe0ed] bg-white py-2.5 pl-2 pr-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 ${isDragging ? 'opacity-40' : ''}`}>
      {/* Etiquetas: produto (cor) + área (cinza) */}
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        {c.produto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{cleanProduto(c.produto)}</span>}
        {c.areaJuridica && (cleanProduto(c.produto) ?? '').toLowerCase().trim() !== c.areaJuridica.toLowerCase().trim() && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: 'rgb(209,209,209)', color: '#101820' }}>{c.areaJuridica}</span>}
      </div>
      {/* Cliente × parte adversa (banco) */}
      <p className="mt-2 break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}
      {/* Nº processo (copiável) */}
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" /><span className="truncate">{c.cnj}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº do processo copiado'); }} onPointerDown={(e) => e.stopPropagation()} title="Copiar nº" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></button>
        </p>
      )}
      {/* Valor da causa */}
      {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
      {/* Próximo prazo */}
      {c.proximoPrazo && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
        </span>
      )}
      {/* Rodapé: relógios + Protocolar + avatar */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400" title="Tempo na fase atual"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onProtocolar && (
            <button onClick={(e) => { e.stopPropagation(); onProtocolar(c.id); }} onPointerDown={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full bg-[#005efc] px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"><FileCheck2 className="h-3 w-3" /> Protocolar</button>
          )}
          {c.responsible && (c.responsible.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.responsible.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{iniciais}</span>)}
        </div>
      </div>
    </div>
  );
}

function ProtocolarDialog({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  const [cnj, setCnj] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await legalCasesService.protocolar(caseId, {
        cnj: cnj.trim() || undefined,
        value: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : undefined,
        dataProtocolo: data || undefined,
      });
      toast.success('Protocolado — movido para Admissão da inicial');
      if (res.aviso?.enviado) {
        toast.success(res.aviso.motivo || 'Cliente avisado no WhatsApp (nº do processo + áudio /protocolo2)');
      } else if (res.aviso) {
        toast.warning(`Aviso ao cliente não enviado: ${res.aviso.motivo ?? 'motivo desconhecido'}`);
      }
      onDone();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao protocolar'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[420px] max-w-[94vw] rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
        <button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        <h3 className="text-base font-bold text-[#101820] dark:text-zinc-100">Protocolar processo</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Preencha os dados do protocolo. O processo migra para a Fase Judicial (Admissão da inicial).</p>
        <div className="mt-4 space-y-3">
          <Field label="Número do processo (CNJ)"><input value={cnj} onChange={(e) => setCnj(e.target.value)} placeholder="0000000-00.0000.0.00.0000" className={INPUT} /></Field>
          <Field label="Valor da causa (R$)"><input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="10.000,00" className={INPUT} /></Field>
          <Field label="Data do protocolo"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#cfe0ed] px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#005efc] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Protocolando…' : 'Protocolar'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#48626f] dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
