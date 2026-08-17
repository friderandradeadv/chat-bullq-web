'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Banknote, Search, RefreshCw, LayoutGrid, List, Copy, CalendarClock, Clock, Plus, FileText, Scale, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanCard, type KanbanData, type KanbanPhase, type PartyDetail,
} from '@/features/legal-cases/services/legal-cases.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { tagCor, BankFocusModal } from '@/features/legal-cases/components/bancos-reus-editor';
import { NovoCasoDialog } from '@/features/legal-cases/components/novo-caso-dialog';
import { PhaseHeader, AddPhaseColumn } from '@/features/legal-cases/components/kanban-card-bits';
import { applyCardSort, kanbanCardKeys, loadPhaseSort, savePhaseSort, type CardSort, type SortKeys } from '@/features/legal-cases/lib/kanban-sort';
import { fireConfetti, isTerminalPhase, shouldCelebrate, terminalCardClass } from '@/features/legal-cases/lib/kanban-terminal';
import { usePhaseDrag, applyPhaseDrag, type PhaseDrag } from '@/features/legal-cases/lib/phase-drag';
import { useAuthStore } from '@/stores/auth-store';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { FunilRepbBoard } from '@/features/legal-cases/components/funil-repb-board';
import { matchesKanbanSearch } from '@/features/legal-cases/lib/kanban-search';

const KEY = ['legal-cases', 'kanban', 'repb'];
const ACCENT = '#B7791F'; // gold/âmbar — trilha REPB (reestruturação de passivo bancário)

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDias = (d: number | null) => (d == null ? '—' : d >= 365 ? `${Math.floor(d / 365)}a` : d >= 30 ? `${Math.floor(d / 30)}m` : `${d}d`);

// ── Visão POR BANCO: cada banco réu (Party OPPONENT) vira um card distribuído nas
// colunas de fase conforme a SITUAÇÃO dele. Mapa situação↔fase (arrastar o card =
// mudar a situação do banco). Fases sem situação natural caem no default.
const SIT_TO_PHASE: Record<string, string> = {
  'Em análise': 'repb_investigativa', 'Malote enviado': 'repb_provisionamento', Negociando: 'repb_negociacao',
  'Acordo fechado': 'repb_concluido', Judicializado: 'repb_acao_judicial', 'Sem acordo': 'repb_inviavel',
};
const PHASE_TO_SIT: Record<string, string> = {
  repb_novo_cliente: 'Em análise', repb_docs_faltantes: 'Em análise', repb_investigativa: 'Em análise',
  repb_provisionamento: 'Malote enviado', repb_negociacao: 'Negociando', repb_acao_judicial: 'Judicializado',
  repb_acordo: 'Acordo fechado', repb_concluido: 'Acordo fechado', repb_inviavel: 'Sem acordo',
};
const SIT_BADGE: Record<string, string> = {
  'Em análise': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  'Malote enviado': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Negociando: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'Acordo fechado': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Judicializado: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'Sem acordo': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};
const normNome = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parseBRL = (s: string | null | undefined) => { let t = String(s ?? '').replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };

// ── Estilo dos cards espelhando o Fase Judicial: borda esquerda 4px por área +
// etiquetas produto (cor)/área (cinza). Helpers copiados do kanban judicial.
const AREA_DOT: Record<string, string> = { 'Bancário': '#228BE6', 'Previdenciário': '#7048e8', 'Trabalhista': '#f08c00', 'Consumidor': '#e64980', 'Cível': '#868e96', REPB: '#B7791F' };
const areaDot = (a: string | null) => AREA_DOT[a ?? 'Cível'] ?? '#B7791F';
const cleanProduto = (s: string | null): string | null => { if (!s) return s; const t = s.trim(); if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } } return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim(); };
function produtoColor(p: string | null): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/REPB|REESTRUT|PASSIVO/.test(s)) return { bg: 'rgb(183,121,31)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/REVISIONAL|CONSIGNAD|PORTABIL/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}

export default function RepbPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [resp, setResp] = useState('');
  const [foco, setFoco] = useState(''); // filtro por cliente ('' = todos): mostra só os cards daquele cliente
  const [focoBanco, setFocoBanco] = useState<string | null>(null); // bankId clicado → abre o drawer nele
  const [bankModal, setBankModal] = useState<{ caseId: string; bankId: string } | null>(null); // modal focado num banco
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [tab, setTab] = useState<'passivo' | 'funil'>('funil');

  // ?case=<id> abre a ficha do card (link do chat); ?foco=<id> entra no kanban de bancos daquele cliente.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const cid = q.get('case');
    if (cid) setOpenCaseId(cid);
    const f = q.get('foco');
    if (f) { setFoco(f); setView('kanban'); }
  }, []);
  const [novo, setNovo] = useState(false);
  const dragScroll = useDragScroll();

  const { data, isLoading, isFetching } = useQuery({ queryKey: KEY, queryFn: () => legalCasesService.kanban({ lane: 'repb' }), refetchInterval: 60_000 });
  const phases = (data?.phases ?? []).filter((p) => p.key.startsWith('repb_')).sort((a, b) => a.order - b.order);
  const cards = data?.cards ?? [];

  const resps = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards) if (c.responsible) m.set(c.responsible.id, c.responsible.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const clientes = useMemo(
    () => cards.filter((c) => c.phase?.startsWith('repb_')).map((c) => ({ id: c.id, nome: (c.client ?? c.title ?? 'Cliente') })).sort((a, b) => a.nome.localeCompare(b.nome)),
    [cards],
  );
  const focoNome = clientes.find((c) => c.id === foco)?.nome ?? '';

  const repbKeys = new Set(phases.map((p) => p.key));
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (!repbKeys.has(c.phase)) return false;
      if (resp && c.responsible?.id !== resp) return false;
      if (!matchesKanbanSearch(c, search, [c.title, c.client])) return false;
      return true;
    });
  }, [cards, search, resp, phases]);

  // Só sócios (OWNER/ADMIN) renomeiam as fases — igual aos demais quadros.
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
  const deletePhase = async (phase: KanbanPhase) => {
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
  };
  const reorderPhaseCol = async (phase: KanbanPhase, dir: 'left' | 'right') => {
    const i = phases.findIndex((p) => p.key === phase.key);
    const nb = phases[dir === 'left' ? i - 1 : i + 1];
    if (!nb) return;
    try {
      await legalCasesService.reorderPhase(phase.key, nb.key);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Só sócios podem reordenar fases');
    }
  };
  // Arrastar a COLUNA (segurar o cabeçalho da fase e soltar na posição nova).
  const phaseDrag = usePhaseDrag({
    enabled: canRename,
    accent: ACCENT,
    scrollRef: dragScroll.ref,
    onDrop: (k, alvo, onde) => applyPhaseDrag(qc, KEY, k, alvo, onde),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#fafafa] dark:bg-zinc-950 text-[#101820] dark:text-zinc-200 max-lg:overflow-y-auto lg:!pt-12">
      {/* Toggle Passivo | Funil de vendas — o Funil é a fase comercial pré-contrato. */}
      <div className="shrink-0 border-b border-[#dbeaf5] px-4 py-3 dark:border-zinc-800 lg:px-6">
        <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
          <button onClick={() => setTab('funil')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold ${tab === 'funil' ? 'bg-[#E8590C] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><Megaphone className="h-4 w-4" /> Funil de vendas</button>
          <button onClick={() => setTab('passivo')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold ${tab === 'passivo' ? 'bg-[#B7791F] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}><Banknote className="h-4 w-4" /> Passivo</button>
        </div>
      </div>

      {tab === 'funil' ? <FunilRepbBoard embedded /> : (<>
      <div className="shrink-0 border-b border-[#dbeaf5] dark:border-zinc-800 px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <Banknote className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">REPB — Reestruturação de Passivo</h1>
          <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{filtered.length}</span>
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
          <span className="hidden truncate text-xs text-zinc-400 2xl:inline">· auditoria da dívida + provisionamento (Res. CMN 4.966/21) até o acordo — o card sobe automático ao assinar o contrato REPB</span>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, CPF…"
              className="h-9 w-full rounded-lg border border-[#cfe0ed] bg-white pl-8 pr-3 text-sm text-[#101820] placeholder:text-zinc-400 focus:border-[#4a90e2] focus:outline-none sm:w-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <select value={resp} onChange={(e) => setResp(e.target.value)} className="h-9 max-w-[200px] rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="">Todos os responsáveis</option>
            {resps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => setNovo(true)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#005efc] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
          {/* Filtro por cliente: '' = todos os cards; escolher um = visão EXCLUSIVA daquele cliente */}
          <select value={foco} onChange={(e) => setFoco(e.target.value)} title="Filtrar o kanban por cliente" className={`h-9 max-w-[220px] rounded-lg border px-2 text-sm dark:bg-zinc-900 ${foco ? 'border-[#B7791F] bg-[#B7791F]/10 font-semibold text-[#B7791F]' : 'border-[#cfe0ed] bg-white text-[#101820] dark:border-zinc-700 dark:text-zinc-300'}`}>
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'kanban' ? 'text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`} style={view === 'kanban' ? { background: ACCENT } : undefined}><LayoutGrid className="h-4 w-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${view === 'lista' ? 'text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`} style={view === 'lista' ? { background: ACCENT } : undefined}><List className="h-4 w-4" /> Lista</button>
          </div>
        </div>
      </div>

      {foco && view === 'kanban' && (
        <div className="shrink-0 border-b border-[#dbeaf5] bg-[#B7791F]/5 px-4 py-1.5 text-[12px] text-[#48626f] dark:border-zinc-800 dark:text-zinc-400 lg:px-6">
          Visão exclusiva de <b className="text-[#B7791F]">{focoNome}</b> — só os cards (cliente × banco) deste cliente.
          <button onClick={() => setFoco('')} className="ml-2 font-semibold text-[#B7791F] hover:underline">← ver todos os clientes</button>
        </div>
      )}

      {view === 'lista' ? (
        <ClienteListView clientes={filtered} phases={phases} onOpenKanban={(id) => { setFoco(id); setView('kanban'); }} onOpenFicha={(id) => router.push(`/juridico/repb/${id}`)} accent={ACCENT} />
      ) : (
        <UnifiedRepbBoard
          clientes={filtered} foco={foco} phases={phases}
          onOpenBank={(cid, bid) => setBankModal({ caseId: cid, bankId: bid })}
          onOpenCase={(cid) => setOpenCaseId(cid)}
          onMovedCase={() => qc.invalidateQueries({ queryKey: KEY })}
          canRename={canRename} onRename={renamePhase} onDelete={deletePhase} onReorder={reorderPhaseCol}
          phaseDrag={phaseDrag} scroll={dragScroll}
        />
      )}

      {/* Só as fases do REPB no seletor de mover (nunca de outro quadro). */}
      {openCaseId && <CaseDetailDrawer caseId={openCaseId} phases={phases} focusBankId={focoBanco} onClose={() => { setOpenCaseId(null); setFocoBanco(null); }} />}
      {bankModal && <BankFocusModal caseId={bankModal.caseId} bankId={bankModal.bankId} onClose={() => setBankModal(null)} />}
      {novo && <NovoCasoDialog targetPhase="repb_novo_cliente" phases={phases} onClose={() => setNovo(false)} onCreated={() => { setNovo(false); qc.invalidateQueries({ queryKey: KEY }); }} />}
      </>)}
    </div>
  );
}

function Column({ phase, items, onOpen, canRename, onRename, onDelete }: { phase: KanbanPhase; items: KanbanCard[]; onOpen: (id: string) => void; canRename: boolean; onRename: (key: string, label: string) => void; onDelete: (phase: KanbanPhase) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  return (
    <div className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#B7791F] bg-[#B7791F]/5 dark:bg-[#B7791F]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <PhaseHeader phase={phase} canRename={canRename} onRename={onRename} onDelete={() => onDelete(phase)} />
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {items.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {items.map((c) => <Card key={c.id} c={c} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function Card({ c, terminal, onOpen }: { c: KanbanCard; terminal?: boolean; onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const iniciais = (c.responsible?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const overdue = !!c.proximoPrazo && new Date(c.proximoPrazo.dueDate).getTime() < Date.now();
  const slaEstourado = c.slaDias > 0 && c.diasNaFase != null && c.diasNaFase > c.slaDias;
  const prod = produtoColor(c.produto ?? 'REPB');
  const prodLabel = cleanProduto(c.produto) ?? 'REPB';
  const style: React.CSSProperties = { borderLeftWidth: 4, borderLeftColor: areaDot(c.areaJuridica ?? 'Bancário'), ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}) };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => onOpen?.(c.id)}
      className={`relative cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-[0_4px_6px_0_rgba(102,102,102,.09),0_9px_14px_0_rgba(102,102,102,.06)] active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging ? 'opacity-40' : ''} ${terminal ? terminalCardClass : ''}`}>
      {/* Etiquetas: produto (cor) + área (cinza) */}
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{prodLabel}</span>
        {c.areaJuridica && prodLabel.toLowerCase().trim() !== c.areaJuridica.toLowerCase().trim() && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: 'rgb(209,209,209)', color: '#101820' }}>{c.areaJuridica}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words pr-5 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
      {c.opponent && <p className="mt-1 truncate text-xs text-[#48626f] dark:text-zinc-400">× {c.opponent}</p>}
      {c.cnj && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#48626f] dark:text-zinc-500">
          <Scale className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.cnj}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.cnj!); toast.success('Nº copiado'); }} onPointerDown={(e) => e.stopPropagation()} title="Copiar" className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"><Copy className="h-3 w-3" /></button>
        </p>
      )}
      {c.value != null && c.value > 0 && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(c.value)}</p>}
      {c.proximoPrazo && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 text-[11px] ${overdue ? 'h-5 bg-[#c22e00] text-white' : 'text-[#48626f] dark:text-zinc-400'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Venc' : 'Vence'} {fmtDate(c.proximoPrazo.dueDate)}{c.proximoPrazo.type === 'FATAL' && <span className="font-semibold">· fatal</span>}
        </span>
      )}
      {/* Rodapé: 3 relógios + avatar (igual Fase Judicial) */}
      <div className="mt-1.5 flex items-center justify-between border-t border-[#eef2f8] pt-1.5 dark:border-zinc-800">
        <div className="flex items-center text-[10px] font-semibold text-[#4b5863] dark:text-zinc-400">
          <span className="mr-1.5 inline-flex items-center gap-0.5" title="Tempo no caso"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNoProcesso)}</span>
          <span className={`mr-1.5 inline-flex items-center gap-0.5 ${slaEstourado ? 'text-[#c22e00]' : ''}`} title="Tempo na fase"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {fmtDias(c.diasNaFase)}</span>
          {c.slaDias > 0 && <span className={`inline-flex items-center gap-0.5 ${slaEstourado ? 'text-[#c22e00]' : 'opacity-60'}`} title="SLA da fase"><Clock className="h-3.5 w-3.5 text-[#ff6f00]" /> {c.slaDias}d</span>}
        </div>
        {c.responsible && (c.responsible.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.responsible.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900" />
          : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">{iniciais}</span>)}
      </div>
    </div>
  );
}

// ── Visão POR BANCO: distribui os bancos réus de UM cliente nas colunas de fase,
// pela situação de cada banco. Arrastar = mudar a situação (updateParty). Clicar
// abre a ficha do cliente. Não cria Cases — os "cards" são as partes OPPONENT.
function BancoBoard({ caseId, phases, onOpenBank, scroll }: { caseId: string; phases: KanbanPhase[]; onOpenBank: (caseId: string, bankId: string) => void; scroll: ReturnType<typeof useDragScroll> }) {
  const qc = useQueryClient();
  const { data: detail, isLoading } = useQuery({ queryKey: ['legal-cases', 'detail', caseId], queryFn: () => legalCasesService.get(caseId) });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const reus = useMemo(() => (detail?.parties ?? []).filter((p) => p.role === 'OPPONENT'), [detail]);
  const malotes = ((detail?.metadata as any)?.faseData?.repb_malotes?.lista ?? []) as any[];
  const malCount = (p: PartyDetail) => malotes.filter((mm: any) => (mm.bancoId ? mm.bancoId === p.id : (normNome(mm.banco) && (normNome(p.name).includes(normNome(mm.banco)) || normNome(mm.banco).includes(normNome(p.name)))))).length;

  const byPhase = useMemo(() => {
    const map: Record<string, PartyDetail[]> = {};
    for (const p of reus) { const ph = SIT_TO_PHASE[(p.metadata as any)?.situacao ?? 'Em análise'] ?? 'repb_investigativa'; (map[ph] ??= []).push(p); }
    return map;
  }, [reus]);

  const moveBank = async (party: PartyDetail, phaseKey: string) => {
    const sit = PHASE_TO_SIT[phaseKey]; if (!sit) return;
    if (((party.metadata as any)?.situacao ?? 'Em análise') === sit) return;
    qc.setQueryData<any>(['legal-cases', 'detail', caseId], (old: any) => (old ? { ...old, parties: old.parties.map((x: any) => (x.id === party.id ? { ...x, metadata: { ...(x.metadata ?? {}), situacao: sit } } : x)) } : old));
    try {
      await legalCasesService.updateParty(party.id, { name: party.name || 'Banco', role: 'OPPONENT', document: party.document ?? undefined, metadata: { ...((party.metadata as any) ?? {}), situacao: sit } });
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    } catch { qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); toast.error('Erro ao mover banco'); }
  };
  const onDragEnd = (e: DragEndEvent) => { setActiveId(null); const to = e.over?.id as string | undefined; const party = reus.find((x) => x.id === e.active.id); if (to && party) moveBank(party, to); };
  const activeParty = reus.find((p) => p.id === activeId) ?? null;

  if (isLoading) return <p className="px-6 pt-3 text-sm text-zinc-400">Carregando bancos…</p>;
  if (!reus.length) return <p className="px-6 pt-3 text-sm text-zinc-400">Este cliente não tem bancos réus cadastrados.</p>;

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
      <div ref={scroll.ref} {...scroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
        {phases.map((phase) => <BancoColumn key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} malCount={malCount} onOpen={(bid) => onOpenBank(caseId, bid)} />)}
      </div>
      <DragOverlay>{activeParty ? <BancoCard party={activeParty} malCount={malCount} /> : null}</DragOverlay>
    </DndContext>
  );
}

function BancoColumn({ phase, items, malCount, onOpen }: { phase: KanbanPhase; items: PartyDetail[]; malCount: (p: PartyDetail) => number; onOpen: (bankId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const total = items.reduce((a, p) => a + parseBRL((p.metadata as any)?.saldoDevedor), 0);
  return (
    <div className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#B7791F] bg-[#B7791F]/5 dark:bg-[#B7791F]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <span className="truncate text-[13px] font-semibold text-[#101820] dark:text-zinc-200">{phase.label}</span>
        {total > 0 && <span className="text-[11px] text-zinc-400">{fmtMoney(total)}</span>}
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {items.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {items.map((p) => <BancoCard key={p.id} party={p} malCount={malCount} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function BancoCard({ party, malCount, onOpen }: { party: PartyDetail; malCount: (p: PartyDetail) => number; onOpen?: (bankId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: party.id });
  const m: any = party.metadata ?? {};
  const nMal = malCount(party);
  const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={() => onOpen?.(party.id)}
      className={`relative cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-[#101820] dark:text-zinc-100">{party.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIT_BADGE[m.situacao ?? 'Em análise'] ?? ''}`}>{m.situacao ?? 'Em análise'}</span>
      </div>
      {m.saldoDevedor && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{m.saldoDevedor}</p>}
      {m.operacao && <p className="mt-0.5 truncate text-[11px] text-[#48626f] dark:text-zinc-500">{m.operacao}</p>}
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${tagCor(t)}`}>{t}</span>)}
          {tags.length > 4 && <span className="text-[9px] text-zinc-400">+{tags.length - 4}</span>}
        </div>
      )}
      {(nMal > 0 || m.acordoFez === 'Sim') && (
        <div className="mt-2 flex items-center gap-2 border-t border-[#eef2f8] pt-1.5 text-[10px] text-[#4b5863] dark:border-zinc-800 dark:text-zinc-400">
          {nMal > 0 && <span>📋 {nMal} malote{nMal === 1 ? '' : 's'}</span>}
          {m.acordoFez === 'Sim' && <span className="text-emerald-600 dark:text-emerald-400">✓ acordo</span>}
        </div>
      )}
    </div>
  );
}

// ── Board "Bancos" (aba): TODOS os bancos de TODOS os clientes REPB, distribuídos
// nas colunas de fase pela situação. Busca os detalhes de cada caso (parties) e
// achata os bancos. Arrastar = mudar situação; clicar = abrir a ficha no banco.
type BancoGlobal = { party: PartyDetail; caseId: string; cliente: string };
function BancosGlobalBoard({ clientes, phases, onOpenBank, scroll }: { clientes: KanbanCard[]; phases: KanbanPhase[]; onOpenBank: (caseId: string, bankId: string) => void; scroll: ReturnType<typeof useDragScroll> }) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const results = useQueries({ queries: clientes.map((c) => ({ queryKey: ['legal-cases', 'detail', c.id], queryFn: () => legalCasesService.get(c.id), staleTime: 30_000 })) });
  const loading = results.some((r) => r.isLoading);

  const bancos = useMemo(() => {
    const arr: BancoGlobal[] = [];
    results.forEach((r, i) => {
      const d: any = r.data; if (!d) return;
      const cliente = (clientes[i]?.client ?? clientes[i]?.title ?? 'Cliente');
      for (const p of d.parties as PartyDetail[]) if (p.role === 'OPPONENT') arr.push({ party: p, caseId: d.id, cliente });
    });
    return arr;
  }, [results, clientes]);

  const byPhase = useMemo(() => {
    const map: Record<string, BancoGlobal[]> = {};
    for (const b of bancos) { const ph = SIT_TO_PHASE[(b.party.metadata as any)?.situacao ?? 'Em análise'] ?? 'repb_investigativa'; (map[ph] ??= []).push(b); }
    return map;
  }, [bancos]);

  const moveBank = async (caseId: string, party: PartyDetail, phaseKey: string) => {
    const sit = PHASE_TO_SIT[phaseKey]; if (!sit) return;
    if (((party.metadata as any)?.situacao ?? 'Em análise') === sit) return;
    qc.setQueryData<any>(['legal-cases', 'detail', caseId], (old: any) => (old ? { ...old, parties: old.parties.map((x: any) => (x.id === party.id ? { ...x, metadata: { ...(x.metadata ?? {}), situacao: sit } } : x)) } : old));
    try { await legalCasesService.updateParty(party.id, { name: party.name || 'Banco', role: 'OPPONENT', document: party.document ?? undefined, metadata: { ...((party.metadata as any) ?? {}), situacao: sit } }); qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); }
    catch { qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); toast.error('Erro ao mover banco'); }
  };
  const onDragEnd = (e: DragEndEvent) => { setActiveId(null); const to = e.over?.id as string | undefined; const b = bancos.find((x) => x.party.id === e.active.id); if (to && b) moveBank(b.caseId, b.party, to); };
  const activeB = bancos.find((b) => b.party.id === activeId) ?? null;

  if (loading && !bancos.length) return <p className="px-6 pt-3 text-sm text-zinc-400">Carregando bancos de todos os clientes…</p>;
  if (!bancos.length) return <p className="px-6 pt-3 text-sm text-zinc-400">Nenhum banco réu cadastrado nos clientes REPB.</p>;

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
      <div ref={scroll.ref} {...scroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
        {phases.map((phase) => <BancoGlobalColumn key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} onOpen={onOpenBank} />)}
      </div>
      <DragOverlay>{activeB ? <BancoGlobalCard b={activeB} /> : null}</DragOverlay>
    </DndContext>
  );
}

function BancoGlobalColumn({ phase, items, onOpen }: { phase: KanbanPhase; items: BancoGlobal[]; onOpen: (caseId: string, bankId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const total = items.reduce((a, b) => a + parseBRL((b.party.metadata as any)?.saldoDevedor), 0);
  return (
    <div className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#B7791F] bg-[#B7791F]/5 dark:bg-[#B7791F]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <span className="truncate text-[13px] font-semibold text-[#101820] dark:text-zinc-200">{phase.label}</span>
        {total > 0 && <span className="text-[11px] text-zinc-400">{fmtMoney(total)}</span>}
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {items.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {items.map((b) => <BancoGlobalCard key={b.party.id} b={b} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function BancoGlobalCard({ b, onOpen }: { b: BancoGlobal; onOpen?: (caseId: string, bankId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: b.party.id });
  const m: any = b.party.metadata ?? {};
  const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
  const style: React.CSSProperties = { borderLeftWidth: 4, borderLeftColor: '#B7791F', ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}) };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={() => onOpen?.(b.caseId, b.party.id)}
      className={`cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging ? 'opacity-40' : ''}`}>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-400">{b.cliente}</p>
      <div className="mt-0.5 flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-[#101820] dark:text-zinc-100">{b.party.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIT_BADGE[m.situacao ?? 'Em análise'] ?? ''}`}>{m.situacao ?? 'Em análise'}</span>
      </div>
      {m.saldoDevedor && <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{m.saldoDevedor}</p>}
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${tagCor(t)}`}>{t}</span>)}
          {tags.length > 4 && <span className="text-[9px] text-zinc-400">+{tags.length - 4}</span>}
        </div>
      )}
    </div>
  );
}

// ── KANBAN UNIFICADO: 1 board, card = CLIENTE × BANCO RÉU (estilo Fase Judicial),
// posicionado pela fase (situação do banco). Cliente SEM bancos ainda = 1 card do
// cliente na fase do caso. `foco` (filtro por cliente) = visão exclusiva. Arrastar
// card de banco muda a situação; card de cliente muda a fase do caso.
type UItem =
  | { kind: 'bank'; id: string; caseId: string; cliente: string; produto: string | null; area: string | null; party: PartyDetail }
  | { kind: 'case'; id: string; caseId: string; card: KanbanCard };

function UnifiedRepbBoard({ clientes, foco, phases, onOpenBank, onOpenCase, onMovedCase, canRename, onRename, onDelete, onReorder, phaseDrag, scroll }: {
  clientes: KanbanCard[]; foco: string; phases: KanbanPhase[];
  onOpenBank: (caseId: string, bankId: string) => void; onOpenCase: (caseId: string) => void; onMovedCase: () => void;
  canRename: boolean; onRename: (key: string, label: string) => void; onDelete: (phase: KanbanPhase) => void;
  onReorder: (phase: KanbanPhase, dir: 'left' | 'right') => void;
  phaseDrag?: PhaseDrag;
  scroll: ReturnType<typeof useDragScroll>;
}) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const alvo = foco ? clientes.filter((c) => c.id === foco) : clientes;
  const results = useQueries({ queries: alvo.map((c) => ({ queryKey: ['legal-cases', 'detail', c.id], queryFn: () => legalCasesService.get(c.id), staleTime: 30_000 })) });

  const items = useMemo(() => {
    const arr: UItem[] = [];
    alvo.forEach((c, i) => {
      const d: any = results[i]?.data;
      const cliente = (c.client ?? c.title ?? 'Cliente');
      const banks = d ? (d.parties as PartyDetail[]).filter((p) => p.role === 'OPPONENT') : [];
      if (banks.length) { for (const p of banks) arr.push({ kind: 'bank', id: p.id, caseId: c.id, cliente, produto: c.produto, area: c.areaJuridica, party: p }); }
      else arr.push({ kind: 'case', id: c.id, caseId: c.id, card: c });
    });
    return arr;
  }, [alvo, results]);

  const byPhase = useMemo(() => {
    const map: Record<string, UItem[]> = {};
    for (const it of items) { const ph = it.kind === 'bank' ? (SIT_TO_PHASE[(it.party.metadata as any)?.situacao ?? 'Em análise'] ?? 'repb_investigativa') : it.card.phase; (map[ph] ??= []).push(it); }
    return map;
  }, [items]);

  const moveItem = async (it: UItem, to: string) => {
    if (it.kind === 'bank') {
      const sit = PHASE_TO_SIT[to]; if (!sit || ((it.party.metadata as any)?.situacao ?? 'Em análise') === sit) return;
      if (shouldCelebrate(phases.find((p) => p.key === to))) fireConfetti();
      qc.setQueryData<any>(['legal-cases', 'detail', it.caseId], (old: any) => (old ? { ...old, parties: old.parties.map((x: any) => (x.id === it.party.id ? { ...x, metadata: { ...(x.metadata ?? {}), situacao: sit } } : x)) } : old));
      try { await legalCasesService.updateParty(it.party.id, { name: it.party.name || 'Banco', role: 'OPPONENT', document: it.party.document ?? undefined, metadata: { ...((it.party.metadata as any) ?? {}), situacao: sit } }); qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', it.caseId] }); }
      catch { qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', it.caseId] }); toast.error('Erro ao mover banco'); }
    } else {
      if (it.card.phase === to) return;
      if (shouldCelebrate(phases.find((p) => p.key === to))) fireConfetti();
      try { await legalCasesService.movePhase(it.card.id, to); onMovedCase(); } catch { toast.error('Erro ao mover'); }
    }
  };
  const onDragEnd = (e: DragEndEvent) => { setActiveId(null); const to = e.over?.id as string | undefined; const it = items.find((x) => x.id === e.active.id); if (to && it) moveItem(it, to); };
  const activeItem = items.find((x) => x.id === activeId) ?? null;
  const loading = results.some((r) => r.isLoading);

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
      <div ref={scroll.ref} {...scroll.handlers} className="flex cursor-grab gap-5 overflow-x-auto pb-3 pt-2 pl-4 pr-4 lg:min-h-0 lg:flex-1 lg:pl-6">
        {loading && !items.length && <p className="px-2 text-sm text-zinc-400">Carregando…</p>}
        {phases.map((phase, i) => <UnifiedColumn key={phase.key} phase={phase} items={byPhase[phase.key] ?? []} onOpenBank={onOpenBank} onOpenCase={onOpenCase} canRename={canRename} onRename={onRename} onDelete={onDelete} phaseDrag={phaseDrag} onMoveLeft={canRename && i > 0 ? () => onReorder(phase, 'left') : undefined} onMoveRight={canRename && i < phases.length - 1 ? () => onReorder(phase, 'right') : undefined} />)}
        {canRename && <AddPhaseColumn board="repb" accent={ACCENT} onAdded={onMovedCase} />}
      </div>
      <DragOverlay>{activeItem ? (activeItem.kind === 'bank' ? <UnifiedBankCard it={activeItem} /> : <Card c={activeItem.card} />) : null}</DragOverlay>
    </DndContext>
  );
}

// Ordenação para os itens mistos do REPB (banco × caso): banco usa o nome do
// cliente e as datas da parte; caso reaproveita as chaves do KanbanCard.
function uItemKeys(it: UItem): SortKeys {
  if (it.kind === 'bank') {
    const p: any = it.party;
    const t = (s?: string | null) => (s ? new Date(s).getTime() || 0 : 0);
    return { title: it.cliente ?? '', created: t(p?.createdAt), updated: t(p?.updatedAt), due: null };
  }
  return kanbanCardKeys(it.card);
}

function UnifiedColumn({ phase, items, onOpenBank, onOpenCase, canRename, onRename, onDelete, phaseDrag, onMoveLeft, onMoveRight }: {
  phase: KanbanPhase; items: UItem[]; onOpenBank: (caseId: string, bankId: string) => void; onOpenCase: (caseId: string) => void;
  canRename: boolean; onRename: (key: string, label: string) => void; onDelete: (phase: KanbanPhase) => void;
  phaseDrag?: PhaseDrag; onMoveLeft?: () => void; onMoveRight?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const [sort, setSort] = useState<CardSort>(() => loadPhaseSort(phase.key));
  const sorted = useMemo(() => applyCardSort(items, sort, uItemKeys), [items, sort]);
  const total = items.reduce((a, it) => a + (it.kind === 'bank' ? parseBRL((it.party.metadata as any)?.saldoDevedor) : (it.card.value ?? 0)), 0);
  return (
    <div ref={phaseDrag?.columnRef(phase.key)} style={phaseDrag?.columnStyle(phase.key)} className={`flex min-h-0 w-[280px] shrink-0 flex-col rounded-xl border transition-colors ${isOver ? 'border-[#B7791F] bg-[#B7791F]/5 dark:bg-[#B7791F]/10' : 'border-[#dcdfe5] bg-[#f2f2f2] dark:border-transparent dark:bg-black/55'}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5 pt-1">
        <PhaseHeader phase={phase} canRename={canRename} onRename={onRename} onDelete={() => onDelete(phase)} drag={phaseDrag?.handle(phase.key)} onMoveLeft={onMoveLeft} onMoveRight={onMoveRight} sort={sort} onSort={(s) => { setSort(s); savePhaseSort(phase.key, s); }} />
        {total > 0 && <span className="text-[11px] text-zinc-400">{fmtMoney(total)}</span>}
        <span className="ml-auto rounded bg-[#edeff3] px-1 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2.5 px-2.5 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {sorted.length === 0 && <p className="rounded border border-dashed border-[#dcdfe5] py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">Vazio</p>}
        {sorted.map((it) => it.kind === 'bank'
          ? <UnifiedBankCard key={it.id} it={it} terminal={isTerminalPhase(phase)} onOpen={() => onOpenBank(it.caseId, it.party.id)} />
          : <Card key={it.id} c={it.card} terminal={isTerminalPhase(phase)} onOpen={() => onOpenCase(it.card.id)} />)}
      </div>
    </div>
  );
}

function UnifiedBankCard({ it, terminal, onOpen }: { it: Extract<UItem, { kind: 'bank' }>; terminal?: boolean; onOpen?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: it.id });
  const m: any = it.party.metadata ?? {};
  const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
  const prod = produtoColor(it.produto ?? 'REPB'); const prodLabel = cleanProduto(it.produto) ?? 'REPB';
  const style: React.CSSProperties = { borderLeftWidth: 4, borderLeftColor: areaDot(it.area ?? 'Bancário'), ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}) };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onOpen}
      className={`cursor-pointer touch-none rounded-lg border border-[#cfe0ed] bg-white py-3 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-[0_4px_6px_0_rgba(102,102,102,.09),0_9px_14px_0_rgba(102,102,102,.06)] active:cursor-grabbing dark:border-transparent dark:bg-[#1E2226] ${isDragging ? 'opacity-40' : ''} ${terminal ? terminalCardClass : ''}`}>
      <div className="-ml-1 flex flex-wrap items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3" style={{ background: prod.bg, color: prod.fg }}>{prodLabel}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-3 ${SIT_BADGE[m.situacao ?? 'Em análise'] ?? ''}`}>{m.situacao ?? 'Em análise'}</span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{it.cliente.toUpperCase()}</p>
      <p className="mt-1 truncate text-xs text-[#48626f] dark:text-zinc-400">× {it.party.name}</p>
      {m.saldoDevedor && <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{m.saldoDevedor}</p>}
      {tags.length > 0 && <div className="mt-1.5 flex gap-1 overflow-hidden">{tags.slice(0, 3).map((t) => <span key={t} className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium ${tagCor(t)}`}>{t}</span>)}{tags.length > 3 && <span className="shrink-0 text-[9px] text-zinc-400">+{tags.length - 3}</span>}</div>}
    </div>
  );
}

// Lista rica de CLIENTES (tipo lista de contatos): filtro por fase, ordenação, e
// 2 ações por linha — ▸ Kanban (bancos daquele cliente) e 📄 Ficha completa.
function ClienteListView({ clientes, phases, onOpenKanban, onOpenFicha, accent }: {
  clientes: KanbanCard[]; phases: KanbanPhase[]; onOpenKanban: (id: string) => void; onOpenFicha: (id: string) => void; accent: string;
}) {
  const [faseF, setFaseF] = useState('');
  const [ordem, setOrdem] = useState<'valor' | 'nome' | 'recente'>('valor');
  const contFase = (k: string) => clientes.filter((c) => c.phase === k).length;
  const fasesComCards = phases.filter((p) => contFase(p.key) > 0);

  const lista = useMemo(() => {
    const arr = faseF ? clientes.filter((c) => c.phase === faseF) : [...clientes];
    arr.sort((a, b) =>
      ordem === 'nome' ? (a.client ?? a.title ?? '').localeCompare(b.client ?? b.title ?? '')
        : ordem === 'recente' ? new Date(b.legalPhaseAt ?? 0).getTime() - new Date(a.legalPhaseAt ?? 0).getTime()
          : (b.value ?? 0) - (a.value ?? 0),
    );
    return arr;
  }, [clientes, faseF, ordem]);
  const faseLabel = (k: string) => phases.find((p) => p.key === k)?.label ?? k;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 lg:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Barra de filtro/ordenação */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFaseF('')} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${faseF === '' ? 'border-[#B7791F] bg-[#B7791F]/10 text-[#B7791F]' : 'border-[#e3e8ef] text-zinc-500 hover:border-[#B7791F]/40 dark:border-zinc-700 dark:text-zinc-400'}`}>Todas as fases <span className="opacity-60">{clientes.length}</span></button>
          {fasesComCards.map((p) => (
            <button key={p.key} onClick={() => setFaseF(p.key)} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${faseF === p.key ? 'border-[#B7791F] bg-[#B7791F]/10 text-[#B7791F]' : 'border-[#e3e8ef] text-zinc-500 hover:border-[#B7791F]/40 dark:border-zinc-700 dark:text-zinc-400'}`}>{p.label} <span className="opacity-60">{contFase(p.key)}</span></button>
          ))}
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as any)} className="ml-auto h-7 rounded-md border border-[#cfe0ed] bg-white px-1.5 text-[12px] text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="valor">Maior dívida</option>
            <option value="nome">Nome (A–Z)</option>
            <option value="recente">Movimentado recente</option>
          </select>
        </div>

        {lista.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">Nenhum cliente. Use a busca acima ou “+ Novo cliente”.</p>}

        <div className="divide-y divide-[#eef2f8] overflow-hidden rounded-xl border border-[#e3e8ef] bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40">
          {lista.map((c) => (
            <div key={c.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-[#B7791F]/5 sm:px-4">
              <button onClick={() => onOpenFicha(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: accent }}><Banknote className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#101820] dark:text-zinc-100">{(c.client ?? c.title)?.toUpperCase()}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="rounded-full bg-[#edeff3] px-1.5 py-px text-[10px] font-medium text-[#48626f] dark:bg-zinc-800 dark:text-zinc-300">{faseLabel(c.phase)}</span>
                    <span>{c.responsible?.name ?? 'Sem responsável'}</span>
                  </p>
                </div>
                {c.value != null && c.value > 0 && <span className="hidden shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 sm:block">{fmtMoney(c.value)}</span>}
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => onOpenKanban(c.id)} title="Ver kanban dos bancos" className="inline-flex items-center gap-1 rounded-md border border-[#e3e8ef] px-2 py-1 text-[12px] font-medium text-[#48626f] hover:border-[#B7791F]/40 hover:text-[#B7791F] dark:border-zinc-700 dark:text-zinc-400"><LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">Kanban</span></button>
                <button onClick={() => onOpenFicha(c.id)} title="Abrir ficha completa" className="inline-flex items-center gap-1 rounded-md bg-[#B7791F] px-2 py-1 text-[12px] font-semibold text-white hover:opacity-90"><FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ficha</span></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
