'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { activitiesService, ENTITY_TYPE } from '@/features/activities/services/activities.service';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { EventInput, DatesSetArg, EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, MapPin, RefreshCw,
  MoreVertical, Search, Tag, Check, CalendarClock, ExternalLink, CalendarDays,
  ClipboardList, Pencil, MessageSquare, Paperclip, List, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { calendarService, type CalendarEvent, type EventKind } from '@/features/calendar/services/calendar.service';
import { deadlinesService, type Deadline } from '@/features/deadlines/services/deadlines.service';
import { tasksService, type Task } from '@/features/tasks/services/tasks.service';
import { membersService } from '@/features/settings/services/members.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inputCls, Field, ASTREA_BLUE, CnjNumber } from '../processos/page';

const EV_PENDING = { bg: '#DAF3FF', text: '#1D6BB7' };
const EV_TIMED = { bg: '#D3F8E5', text: '#1D6BB7' };
const EV_DONE = { bg: '#F1F3F4', text: '#6C757D' };

type Src = 'prazo' | 'tarefa' | 'evento';
const TYPE_TAG: Record<Src, { label: string; bg: string }> = {
  prazo: { label: 'Prazo', bg: '#CE0000' },
  tarefa: { label: 'Tarefa', bg: '#23CBFF' },
  evento: { label: 'Evento', bg: '#02883C' },
};
const KIND_LABEL: Record<EventKind, string> = { audiencia: 'Audiência', reuniao: 'Reunião', pericia: 'Perícia', tarefa: 'Tarefa', outro: 'Outro' };
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };

type ViewMode = 'list' | 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
const VIEW_LABEL: Record<ViewMode, string> = { list: 'Em lista', timeGridDay: 'Por dia', timeGridWeek: 'Por semana', dayGridMonth: 'Por mês' };
const VIEW_KEY = 'agenda:view';

const pad = (n: number) => String(n).padStart(2, '0');
const toDatetimeLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const initials = (name: string | null) => { if (!name) return 'Eu'; const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'Eu'; };

interface Activity {
  id: string; source: Src; rawId: string; title: string; date: string;
  hasTime: boolean; done: boolean; cancelled: boolean; fatal: boolean;
  caseId: string | null; caseTitle: string | null; cnj: string | null;
  responsibleId: string | null; responsibleName: string | null; createdName: string | null;
  priorityLabel: string | null; completedAt: string | null; description: string | null;
}

export default function AgendaPage() {
  const router = useRouter();
  const calRef = useRef<FullCalendar | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [viewMenu, setViewMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [title, setTitle] = useState('');
  const [titlePicker, setTitlePicker] = useState(false);
  const [chooser, setChooser] = useState<{ date?: Date } | null>(null);
  const [dialog, setDialog] = useState<{ type: 'evento' | 'tarefa'; date?: Date } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);

  // Filtros (Astrea): Exibir tipo + Status + Pessoa
  const [fAtiv, setFAtiv] = useState(false);
  const [fAtrib, setFAtrib] = useState(false);
  const [exibir, setExibir] = useState({ tarefas: true, eventos: true });
  const [status, setStatus] = useState<'todas' | 'aconcluir' | 'concluidas' | 'canceladas'>('todas');
  const [personId, setPersonId] = useState<string>('all');
  const [dExibir, setDExibir] = useState(exibir);
  const [dStatus, setDStatus] = useState(status);
  const [dPerson, setDPerson] = useState(personId);

  const api = () => calRef.current?.getApi();

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY)) as ViewMode | null;
    if (saved && saved in VIEW_LABEL) setMode(saved);
  }, []);

  const from = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString(); }, []);
  const to = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString(); }, []);

  const evQ = useQuery({ queryKey: ['calendar', 'agenda'], queryFn: () => calendarService.list({ from, to }) });
  const dlQ = useQuery({ queryKey: ['deadlines', 'agenda'], queryFn: () => deadlinesService.list({}) });
  const tkQ = useQuery({ queryKey: ['tasks', 'agenda'], queryFn: () => tasksService.list() });
  const mbQ = useQuery({ queryKey: ['members', 'agenda'], queryFn: () => membersService.list() });
  const refetchAll = () => { evQ.refetch(); dlQ.refetch(); tkQ.refetch(); };

  const userMap = useMemo(() => new Map((mbQ.data ?? []).map((m) => [m.user.id, m.user.name])), [mbQ.data]);

  const activities = useMemo<Activity[]>(() => {
    const out: Activity[] = [];
    for (const t of tkQ.data ?? []) {
      if (!t.dueAt) continue;
      out.push({
        id: 't_' + t.id, source: 'tarefa', rawId: t.id, title: t.title, date: t.dueAt,
        hasTime: t.dueAt.includes('T') && !/T0[09]:00:00/.test(t.dueAt) ? true : false,
        done: t.status === 'DONE', cancelled: false, fatal: t.priority === 'HIGH',
        caseId: null, caseTitle: null, cnj: null,
        responsibleId: t.assigneeId, responsibleName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
        createdName: t.createdById ? userMap.get(t.createdById) ?? null : null,
        priorityLabel: PRIORITY_LABEL[t.priority] ?? null, completedAt: t.completedAt, description: t.description,
      });
    }
    for (const d of dlQ.data ?? []) {
      out.push({
        id: 'd_' + d.id, source: 'prazo', rawId: d.id, title: d.title, date: d.dueDate,
        hasTime: false, done: d.status === 'DONE', cancelled: d.status === 'CANCELLED', fatal: d.type === 'FATAL',
        caseId: d.case?.id ?? null, caseTitle: d.case?.title ?? null, cnj: d.case?.cnjNumber ?? null,
        responsibleId: d.assignedTo?.id ?? null, responsibleName: d.assignedTo?.name ?? null,
        createdName: null, priorityLabel: null, completedAt: null, description: null,
      });
    }
    for (const e of evQ.data ?? []) {
      out.push({
        id: 'e_' + e.id, source: 'evento', rawId: e.id, title: e.title, date: e.startsAt,
        hasTime: true, done: false, cancelled: false, fatal: false,
        caseId: e.caseId, caseTitle: e.case?.title ?? null, cnj: e.case?.cnjNumber ?? null,
        responsibleId: e.assignedTo?.id ?? null, responsibleName: e.assignedTo?.name ?? null,
        createdName: null, priorityLabel: null, completedAt: null, description: e.location,
      });
    }
    return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [tkQ.data, dlQ.data, evQ.data, userMap]);

  const filtered = useMemo(() => activities.filter((a) => {
    if (a.source === 'evento' ? !exibir.eventos : !exibir.tarefas) return false;
    if (status === 'aconcluir' && (a.done || a.cancelled)) return false;
    if (status === 'concluidas' && !a.done) return false;
    if (status === 'canceladas' && !a.cancelled) return false;
    if (personId !== 'all' && a.responsibleId !== personId) return false;
    return true;
  }), [activities, exibir, status, personId]);

  const byId = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);
  const fcEvents = useMemo<EventInput[]>(() => filtered.map((a) => {
    const c = a.done || a.cancelled ? EV_DONE : a.source === 'evento' ? EV_TIMED : EV_PENDING;
    return {
      id: a.id, title: `${initials(a.responsibleName)} · ${a.title}`, start: a.date, allDay: !a.hasTime,
      backgroundColor: c.bg, borderColor: c.bg, textColor: c.text,
      classNames: [`ag-${a.source}`, (a.done || a.cancelled) ? 'ag-done' : ''].filter(Boolean),
    };
  }), [filtered]);

  const pickMode = (m: ViewMode) => { setMode(m); setViewMenu(false); try { localStorage.setItem(VIEW_KEY, m); } catch { /* */ } };
  const openCreate = (type: 'evento' | 'tarefa', date?: Date) => { setChooser(null); setAddMenu(false); setDialog({ type, date }); };
  const onDateClick = (arg: DateClickArg) => setChooser({ date: arg.date });
  const onEventClick = (arg: EventClickArg) => { const a = byId.get(arg.event.id); if (a) setDetail(a); };

  const personLabel = personId === 'all' ? 'Minhas atribuições' : (userMap.get(personId)?.split(' ')[0] ?? 'Pessoa');
  const showSidePanel = mode === 'list' || mode === 'timeGridDay';
  const isMonth = mode === 'dayGridMonth';

  return (
    <div className="flex h-full flex-col bg-[#f5f6f8] dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-[#202124] dark:text-zinc-100">Agenda</h1>
        <div className="flex items-center gap-2">
          <button onClick={refetchAll} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#DEE2E6] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Atualizar"><RefreshCw className="h-4 w-4" /></button>
          <button className="flex h-9 w-9 items-center justify-center rounded-md border border-[#DEE2E6] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Mais"><MoreVertical className="h-4 w-4" /></button>
          <div className="relative">
            <button onClick={() => setAddMenu((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-md text-white hover:opacity-90" style={{ backgroundColor: ASTREA_BLUE }} title="Adicionar"><Plus className="h-5 w-5" /></button>
            {addMenu && (<><div className="fixed inset-0 z-10" onClick={() => setAddMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button onClick={() => openCreate('tarefa')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><ClipboardList className="h-4 w-4 text-[#23CBFF]" /> Tarefa</button>
                <button onClick={() => openCreate('evento')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><CalendarDays className="h-4 w-4 text-[#02883C]" /> Evento</button>
              </div></>)}
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <FilterBtn onClick={() => setViewMenu((v) => !v)}>{VIEW_LABEL[mode]}<ChevronDown className="h-3.5 w-3.5" /></FilterBtn>
          {viewMenu && (<><div className="fixed inset-0 z-10" onClick={() => setViewMenu(false)} />
            <div className="absolute left-0 top-11 z-20 w-44 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {(Object.keys(VIEW_LABEL) as ViewMode[]).map((m) => (
                <button key={m} onClick={() => pickMode(m)} className={`block w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${mode === m ? 'font-semibold text-[#228BE6]' : 'text-zinc-700 dark:text-zinc-300'}`}>{VIEW_LABEL[m]}</button>
              ))}
            </div></>)}
        </div>

        {/* Minhas atribuições */}
        <div className="relative">
          <FilterBtn onClick={() => { setDAtribOpen(); setFAtrib((v) => !v); }} active={personId !== 'all'}>{personLabel}<ChevronDown className="h-3.5 w-3.5" /></FilterBtn>
          {fAtrib && (<><div className="fixed inset-0 z-10" onClick={() => setFAtrib(false)} />
            <div className="absolute left-0 top-11 z-20 w-[420px] rounded-lg border border-[#DEE2E6] bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Atribuição</p>
                  {['Responsáveis', 'Envolvidos', 'Quem criou'].map((l) => (
                    <label key={l} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" defaultChecked className="accent-[#228BE6]" />{l}</label>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Pessoas</p>
                  <div className="max-h-44 overflow-y-auto">
                    <label className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="person" checked={dPerson === 'all'} onChange={() => setDPerson('all')} className="accent-[#228BE6]" />Todas</label>
                    {(mbQ.data ?? []).map((m) => (
                      <label key={m.user.id} className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="person" checked={dPerson === m.user.id} onChange={() => setDPerson(m.user.id)} className="accent-[#228BE6]" />{m.user.name}</label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-4 border-t border-[#DEE2E6] pt-3 text-sm font-semibold dark:border-zinc-700">
                <button onClick={() => setFAtrib(false)} className="uppercase text-zinc-500">Cancelar</button>
                <button onClick={() => { setPersonId(dPerson); setFAtrib(false); }} className="uppercase text-[#228BE6]">Aplicar</button>
              </div>
            </div></>)}
        </div>

        {/* Todas as atividades */}
        <div className="relative">
          <FilterBtn onClick={() => { setDExibir(exibir); setDStatus(status); setFAtiv((v) => !v); }} active={!exibir.tarefas || !exibir.eventos || status !== 'todas'}>Todas as atividades<ChevronDown className="h-3.5 w-3.5" /></FilterBtn>
          {fAtiv && (<><div className="fixed inset-0 z-10" onClick={() => setFAtiv(false)} />
            <div className="absolute left-0 top-11 z-20 w-56 rounded-lg border border-[#DEE2E6] bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Exibir</p>
              <label className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={dExibir.tarefas} onChange={(e) => setDExibir({ ...dExibir, tarefas: e.target.checked })} className="accent-[#228BE6]" />Tarefas</label>
              <label className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={dExibir.eventos} onChange={(e) => setDExibir({ ...dExibir, eventos: e.target.checked })} className="accent-[#228BE6]" />Eventos</label>
              <p className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Status</p>
              {([['aconcluir', 'A concluir'], ['concluidas', 'Concluídas'], ['canceladas', 'Canceladas'], ['todas', 'Todas']] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="status" checked={dStatus === v} onChange={() => setDStatus(v)} className="accent-[#228BE6]" />{l}</label>
              ))}
              <div className="mt-3 flex justify-end gap-4 border-t border-[#DEE2E6] pt-3 text-sm font-semibold dark:border-zinc-700">
                <button onClick={() => setFAtiv(false)} className="uppercase text-zinc-500">Cancelar</button>
                <button onClick={() => { setExibir(dExibir); setStatus(dStatus); setFAtiv(false); }} className="uppercase text-[#228BE6]">Aplicar</button>
              </div>
            </div></>)}
        </div>

        <button className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[#DEE2E6] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Etiquetas"><Tag className="h-4 w-4" /></button>
        <button className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[#DEE2E6] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Buscar"><Search className="h-4 w-4" /></button>
      </div>

      {/* Conteúdo */}
      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-[#DEE2E6] px-4 py-3 dark:border-zinc-800">
            <div className="relative">
              {mode === 'list' ? (
                <span className="text-lg font-medium text-[#202124] dark:text-zinc-100">Hoje</span>
              ) : (
                <button onClick={() => setTitlePicker((v) => !v)} className="flex items-center gap-1 text-lg font-medium capitalize text-[#202124] hover:text-[#228BE6] dark:text-zinc-100">{title}<ChevronDown className="h-4 w-4" /></button>
              )}
              {titlePicker && mode !== 'list' && (<><div className="fixed inset-0 z-10" onClick={() => setTitlePicker(false)} />
                <div className="absolute left-0 top-9 z-20"><MiniCalendar initial={api()?.getDate() ?? new Date()} onPick={(d) => { api()?.gotoDate(d); setTitlePicker(false); }} /></div></>)}
            </div>
            {mode !== 'list' && (
              <div className="flex items-center gap-1">
                <button onClick={() => api()?.today()} className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Hoje</button>
                <button onClick={() => api()?.prev()} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => api()?.next()} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="h-5 w-5" /></button>
              </div>
            )}
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${isMonth ? 'agenda-month' : ''}`}>
            {mode === 'list' ? (
              <ActivityList activities={filtered} onOpen={setDetail} />
            ) : (
              <FullCalendar
                key={mode} ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={mode} locale={ptBrLocale} headerToolbar={false}
                height={isMonth ? 'auto' : '100%'} nowIndicator dayMaxEvents={isMonth ? 4 : true}
                slotMinTime="06:00:00" slotMaxTime="22:00:00" scrollTime="08:00:00"
                allDaySlot allDayText="Dia todo" eventDisplay="block" displayEventTime={false} expandRows={!isMonth}
                events={fcEvents}
                datesSet={(arg: DatesSetArg) => setTitle(arg.view.title)}
                dateClick={onDateClick} eventClick={onEventClick}
              />
            )}
          </div>
        </div>
        {showSidePanel && (<div className="w-[360px] shrink-0 overflow-y-auto"><SidePanel activities={filtered} mode={mode} onOpen={setDetail} /></div>)}
      </div>

      {chooser && (
        <Modal onClose={() => setChooser(null)} title="O que deseja criar?">
          {chooser.date && <p className="mb-4 text-sm text-zinc-500">Para {chooser.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openCreate('tarefa', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#23CBFF] hover:bg-[#23CBFF]/5 dark:border-zinc-700"><ClipboardList className="h-7 w-7 text-[#23CBFF]" /><span className="text-sm font-medium">Tarefa</span></button>
            <button onClick={() => openCreate('evento', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#02883C] hover:bg-[#02883C]/5 dark:border-zinc-700"><CalendarDays className="h-7 w-7 text-[#02883C]" /><span className="text-sm font-medium">Evento</span></button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'evento' && <CreateEventDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {dialog?.type === 'tarefa' && <CreateTaskDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {detail && <ActivityDetailModal activity={detail} onClose={() => setDetail(null)} onRefetch={refetchAll} onOpenCase={(id) => router.push(`/processos/${id}`)} onOpenConversation={(id) => router.push(`/inbox?conversationId=${id}`)} />}
    </div>
  );

  function setDAtribOpen() { setDPerson(personId); }
}

function FilterBtn({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex h-[38px] items-center gap-2 rounded-lg border bg-white px-5 text-xs font-bold uppercase tracking-wide hover:bg-zinc-50 dark:bg-zinc-900 ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-[#DEE2E6] text-[#6C757D] dark:border-zinc-700 dark:text-zinc-400'}`}>{children}</button>
  );
}

function TypeChip({ source }: { source: Src }) {
  const t = TYPE_TAG[source];
  return <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: t.bg }}>{t.label}</span>;
}

function MiniCalendar({ initial, onPick }: { initial: Date; onPick: (d: Date) => void }) {
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const today = new Date();
  return (
    <div className="w-64 rounded-lg border border-[#DEE2E6] bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="h-4 w-4 text-[#228BE6]" /></button>
        <span className="text-sm font-medium capitalize text-[#202124] dark:text-zinc-100">{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="h-4 w-4 text-[#228BE6]" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => <div key={d} className="py-1 text-zinc-400">{d}</div>)}
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i} onClick={() => onPick(new Date(year, month, d))} className={`rounded-full py-1 text-sm hover:bg-[#228BE6]/10 ${sameDay(new Date(year, month, d), today) ? 'bg-[#228BE6] font-bold text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>{d}</button>
        ))}
      </div>
    </div>
  );
}

function ActivityList({ activities, onOpen }: { activities: Activity[]; onOpen: (a: Activity) => void }) {
  const today = new Date();
  const todays = activities.filter((a) => sameDay(new Date(a.date), today));
  const list = todays.length ? todays : activities.slice(0, 40);
  return (
    <div>
      <p className="mb-3 px-1 text-sm text-zinc-500">Mostrando {list.length} {list.length === 1 ? 'atividade' : 'atividades'}</p>
      <div className="divide-y divide-[#DEE2E6] dark:divide-zinc-800">
        {list.length === 0 && <p className="px-1 py-8 text-center text-sm text-zinc-400">Nenhuma atividade.</p>}
        {list.map((a) => (
          <button key={a.id} onClick={() => onOpen(a)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${a.done ? 'border-emerald-500 bg-emerald-500 text-white' : a.fatal ? 'border-red-400' : 'border-zinc-300'}`}>{a.done && <Check className="h-3 w-3" />}</span>
            <div className="w-24 shrink-0 text-xs text-zinc-500">{new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{a.hasTime && <div className="font-medium text-zinc-700 dark:text-zinc-300">{new Date(a.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}</div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium text-[#202124] dark:text-zinc-100 ${a.done ? 'text-zinc-400 line-through' : ''}`}>{a.title}</p>
              {a.caseTitle && <p className="truncate text-xs text-zinc-500">{a.caseTitle}{a.cnj ? ` · ${a.cnj}` : ''}</p>}
              <div className="mt-1.5"><TypeChip source={a.source} /></div>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{initials(a.responsibleName)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SidePanel({ activities, mode, onOpen }: { activities: Activity[]; mode: ViewMode; onOpen: (a: Activity) => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = (iso: string) => sameDay(new Date(iso), today);
  const concluidas = activities.filter((a) => a.done && isToday(a.date)).length;
  const aConcluir = activities.filter((a) => !a.done && isToday(a.date)).length;
  const atrasadas = activities.filter((a) => !a.done && new Date(a.date) < today).length;
  const dayList = activities.filter((a) => isToday(a.date));
  return (
    <div className="flex flex-col gap-4">
      {mode === 'timeGridDay' ? (
        <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-base font-medium text-[#202124] dark:text-zinc-100">{dayList.length} {dayList.length === 1 ? 'atividade' : 'atividades'}</h3>
          <div className="space-y-3">
            {dayList.length === 0 && <p className="text-sm text-zinc-400">Sem atividades hoje.</p>}
            {dayList.map((a) => (<button key={a.id} onClick={() => onOpen(a)} className="block w-full text-left text-sm"><p className={`font-medium text-[#202124] dark:text-zinc-100 ${a.done ? 'text-zinc-400 line-through' : ''}`}>{a.title}</p>{a.caseTitle && <p className="truncate text-xs text-zinc-500">{a.caseTitle}</p>}<span className="mt-1 inline-block"><TypeChip source={a.source} /></span></button>))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-base font-medium text-[#202124] dark:text-zinc-100">Minhas atividades</h3>
          <div className="grid grid-cols-3 text-center">
            <div><div className="text-2xl font-semibold text-[#02883C]">{concluidas}</div><div className="text-xs text-zinc-500">Concluídas<br />(hoje)</div></div>
            <div><div className="text-2xl font-semibold text-[#202124] dark:text-zinc-100">{aConcluir}</div><div className="text-xs text-zinc-500">A concluir<br />(hoje)</div></div>
            <div><div className="text-2xl font-semibold text-[#E70202]">{atrasadas}</div><div className="text-xs text-zinc-500">Atrasadas<br />(total)</div></div>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-base font-medium text-[#202124] dark:text-zinc-100">Tarefas sem data e a concluir</h3>
        <p className="text-sm text-zinc-400">Nenhuma atividade encontrada.</p>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-50 w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Detalhe da atividade (layout estilo Astrea: checkbox+título, dados, abas) ──
function ActivityDetailModal({ activity, onClose, onRefetch, onOpenCase, onOpenConversation }: { activity: Activity; onClose: () => void; onRefetch: () => void; onOpenCase: (id: string) => void; onOpenConversation: (convId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(activity.done);
  const [dateISO, setDateISO] = useState(activity.date);
  const [reMenu, setReMenu] = useState(false);
  const [miniCal, setMiniCal] = useState(false);
  const [optMenu, setOptMenu] = useState(false);
  const d = new Date(dateISO);

  // Puxa a ficha do processo p/ montar "Cliente x Parte | 1º Grau - Área" (igual Astrea).
  const caseQ = useQuery({ queryKey: ['legal-case', 'agenda', activity.caseId], queryFn: () => legalCasesService.get(activity.caseId!), enabled: !!activity.caseId });
  const inst = (caseQ.data?.metadata as { astrea?: { raw?: Record<string, string> } } | undefined)?.astrea?.raw?.['Instância Atual'];
  const grade = inst ? `${String(inst).replace(/\D/g, '')}º Grau` : null;
  const procSuffix = [grade, caseQ.data?.area].filter(Boolean).join(' - ');
  const clientConv = caseQ.data?.parties?.find((p) => p.role === 'CLIENT' && p.contact?.conversations?.length)?.contact?.conversations?.[0];

  // ── Comentários + etiquetas + editar (backend novo) ──
  const entityType = ENTITY_TYPE[activity.source];
  const [titleVal, setTitleVal] = useState(activity.title);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(activity.title);
  const [commentBody, setCommentBody] = useState('');
  const [tagPicker, setTagPicker] = useState(false);
  const commentsQ = useQuery({ queryKey: ['activity-comments', activity.id], queryFn: () => activitiesService.listComments(entityType, activity.rawId) });
  const etagsQ = useQuery({ queryKey: ['activity-tags', activity.id], queryFn: () => activitiesService.listTags(entityType, activity.rawId) });
  const availTagsQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const attachedIds = new Set((etagsQ.data ?? []).map((t) => t.tagId));

  const postComment = async () => {
    if (!commentBody.trim()) return;
    setBusy(true);
    try { await activitiesService.addComment(entityType, activity.rawId, commentBody.trim()); setCommentBody(''); commentsQ.refetch(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };
  const removeComment = async (id: string) => { try { await activitiesService.deleteComment(id); commentsQ.refetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };
  const attachTag = async (tagId: string) => { try { await activitiesService.attachTag(entityType, activity.rawId, tagId); setTagPicker(false); etagsQ.refetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };
  const detachTag = async (etId: string) => { try { await activitiesService.detachTag(etId); etagsQ.refetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };
  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    setBusy(true);
    try {
      if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { title: editTitle.trim() });
      else if (activity.source === 'prazo') await deadlinesService.update(activity.rawId, { title: editTitle.trim() });
      else await calendarService.update(activity.rawId, { title: editTitle.trim() });
      setTitleVal(editTitle.trim()); setEditing(false); setOptMenu(false); toast.success('Salvo'); onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  const del = async () => {
    if (!confirm('Excluir esta atividade?')) return;
    setBusy(true);
    try {
      if (activity.source === 'tarefa') await tasksService.remove(activity.rawId);
      else if (activity.source === 'prazo') await deadlinesService.cancel(activity.rawId);
      else await calendarService.remove(activity.rawId);
      toast.success('Excluída'); onRefetch(); onClose();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  const reschedule = async (target: Date) => {
    setBusy(true);
    try {
      if (activity.hasTime) { const o = new Date(dateISO); target.setHours(o.getHours(), o.getMinutes(), 0, 0); } else target.setHours(0, 0, 0, 0);
      const iso = target.toISOString();
      if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { dueAt: iso });
      else if (activity.source === 'prazo') await deadlinesService.update(activity.rawId, { dueDate: iso });
      else await calendarService.update(activity.rawId, { startsAt: iso });
      setDateISO(iso); setReMenu(false); setMiniCal(false); toast.success('Reagendado'); onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro ao reagendar'); } finally { setBusy(false); }
  };
  const removeDate = async () => {
    setBusy(true);
    try { await tasksService.update(activity.rawId, { dueAt: null }); toast.success('Data removida'); onRefetch(); onClose(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };
  const toggleDone = async () => {
    if (activity.source === 'evento') return;
    setBusy(true);
    try {
      if (activity.source === 'tarefa') { await tasksService.update(activity.rawId, { status: done ? 'TODO' : 'DONE' }); toast.success(done ? 'Tarefa reaberta' : 'Tarefa concluída'); setDone(!done); }
      else { if (done) { await deadlinesService.update(activity.rawId, { status: 'OPEN' }); toast.success('Prazo reaberto'); setDone(false); } else { await deadlinesService.complete(activity.rawId, activity.fatal); toast.success('Prazo concluído'); setDone(true); } }
      onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  const headerType = activity.source === 'evento' ? 'Evento' : 'Tarefa';
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const nextMon = new Date(now); nextMon.setDate(now.getDate() + (((1 + 7 - now.getDay()) % 7) || 7));
  const mItem = 'block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-medium text-[#202124] dark:text-zinc-100">{headerType}</h2>
          <div className="flex items-center gap-0.5 text-zinc-400">
            {clientConv && <button onClick={() => onOpenConversation(clientConv.id)} title="Abrir conversa do cliente" className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><MessageCircle className="h-4 w-4 text-[#25D366]" /></button>}
            <div className="relative">
              <button onClick={() => setOptMenu((v) => !v)} title="Opções" className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoreVertical className="h-4 w-4" /></button>
              {optMenu && (<><div className="fixed inset-0 z-10" onClick={() => setOptMenu(false)} /><div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"><button onClick={() => { setEditTitle(titleVal); setEditing(true); setOptMenu(false); }} className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">Editar</button><button disabled={busy} onClick={del} className="block w-full px-4 py-2 text-left text-sm text-[#CE0000] hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800">Excluir</button></div></>)}
            </div>
            <button onClick={onClose} className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: TYPE_TAG[activity.source].bg }}>{TYPE_TAG[activity.source].label}</span>
          {activity.fatal && <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Fatal</span>}
          {activity.cancelled && <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500">Cancelada</span>}
          {(etagsQ.data ?? []).map((et) => (
            <span key={et.id} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: et.tag.color }}>{et.tag.name}<button onClick={() => detachTag(et.id)} title="Remover etiqueta" className="hover:opacity-70"><X className="h-3 w-3" /></button></span>
          ))}
          <div className="relative">
            <button onClick={() => setTagPicker((v) => !v)} className="inline-flex items-center gap-1 rounded border border-dashed border-[#DEE2E6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6C757D] hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"><Tag className="h-3 w-3" />Etiqueta</button>
            {tagPicker && (<><div className="fixed inset-0 z-10" onClick={() => setTagPicker(false)} />
              <div className="absolute left-0 top-7 z-20 max-h-56 w-52 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {(availTagsQ.data ?? []).filter((t) => !attachedIds.has(t.id)).map((t) => (
                  <button key={t.id} onClick={() => attachTag(t.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</button>
                ))}
                {(availTagsQ.data ?? []).filter((t) => !attachedIds.has(t.id)).length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Sem etiquetas disponíveis. Crie em “Etiquetas”.</p>}
              </div></>)}
          </div>
        </div>

        {/* Checkbox + título */}
        <div className="mb-4 flex items-start gap-3">
          <button onClick={toggleDone} disabled={busy || activity.source === 'evento'} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? 'border-[#228BE6] bg-[#228BE6] text-white' : 'border-zinc-300 dark:border-zinc-600'} disabled:opacity-40`}>{done && <Check className="h-3.5 w-3.5" />}</button>
          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditing(false); setEditTitle(titleVal); } }} className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-lg outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <button disabled={busy} onClick={saveEdit} className="rounded-md px-3 py-1 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: ASTREA_BLUE }}>Salvar</button>
              <button onClick={() => { setEditing(false); setEditTitle(titleVal); }} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Cancelar</button>
            </div>
          ) : (
            <h3 className={`flex-1 text-lg font-medium text-[#202124] dark:text-zinc-100 ${done ? 'text-zinc-400 line-through' : ''}`}>{titleVal}</h3>
          )}
        </div>

        {/* Dados */}
        <dl className="space-y-2 text-sm">
          {/* Data → menu de reagendamento (igual Astrea) */}
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-[#6C757D]">Data:</dt>
            <dd className="relative">
              <button onClick={() => { setReMenu((v) => !v); setMiniCal(false); }} className="inline-flex items-center gap-1 text-[#228BE6] hover:underline">{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}{activity.hasTime ? `, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}<ChevronDown className="h-4 w-4" /></button>
              {reMenu && (<><div className="fixed inset-0 z-10" onClick={() => { setReMenu(false); setMiniCal(false); }} />
                <div className="absolute left-0 top-7 z-20 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {miniCal ? (<div className="p-1"><MiniCalendar initial={d} onPick={(x) => reschedule(x)} /></div>) : (
                    <div className="w-64">
                      <button disabled={busy} onClick={() => reschedule(new Date())} className={mItem}>Reagendar para hoje</button>
                      <button disabled={busy} onClick={() => reschedule(tomorrow)} className={mItem}>Reagendar para amanhã</button>
                      <button disabled={busy} onClick={() => reschedule(nextMon)} className={mItem}>Reagendar para a próxima segunda</button>
                      <button disabled={busy} onClick={() => setMiniCal(true)} className={mItem}>Reagendar para algum dia</button>
                      {activity.source === 'tarefa' && (<><div className="my-1 border-t border-[#DEE2E6] dark:border-zinc-700" /><button disabled={busy} onClick={removeDate} className={`${mItem} text-[#CE0000]`}>Remover data</button></>)}
                    </div>
                  )}
                </div></>)}
            </dd>
          </div>
          {activity.caseTitle && <Row label="Processo"><button onClick={() => onOpenCase(activity.caseId!)} className="text-left font-light text-[#228BE6] hover:underline">{activity.caseTitle}{procSuffix ? `  |  ${procSuffix}` : ''}</button></Row>}
          {activity.cnj && <Row label="Número do processo"><CnjNumber value={activity.cnj} /></Row>}
          {activity.responsibleName && <Row label="Responsável">{activity.responsibleName}</Row>}
          {activity.createdName && <Row label="Criado por"><span className="text-zinc-500">{activity.createdName}</span></Row>}
          {done && activity.completedAt && <Row label=""><span className="text-zinc-500">{activity.source === 'tarefa' ? 'Tarefa concluída' : 'Prazo concluído'} em {new Date(activity.completedAt).toLocaleDateString('pt-BR')}{activity.responsibleName ? ` por ${activity.responsibleName}` : ''}</span></Row>}
          {activity.priorityLabel && <Row label="Prioridade">{activity.priorityLabel}</Row>}
          {activity.description && activity.source === 'evento' && <Row label="Local">{activity.description}</Row>}
          {activity.description && activity.source === 'tarefa' && <Row label="Descrição">{activity.description}</Row>}
        </dl>

        {/* Comentários */}
        <div className="mt-5 border-t border-[#DEE2E6] pt-4 dark:border-zinc-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Comentários</p>
          <div className="mb-3 space-y-3">
            {(commentsQ.data ?? []).length === 0 && !commentsQ.isLoading && <p className="text-sm text-zinc-400">Nenhum comentário ainda.</p>}
            {(commentsQ.data ?? []).map((c) => (
              <div key={c.id} className="group flex gap-2.5 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{initials(c.author?.name ?? null)}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-200">{c.body}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{c.author?.name ?? 'Você'} · {new Date(c.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <button onClick={() => removeComment(c.id)} title="Remover" className="self-start text-zinc-300 opacity-0 transition-opacity hover:text-[#CE0000] group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#DEE2E6] px-3 py-1.5 focus-within:border-[#228BE6] dark:border-zinc-700">
            <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') postComment(); }} placeholder="Escreva um comentário…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100" />
            <button disabled={busy || !commentBody.trim()} onClick={postComment} className="rounded-md px-3 py-1 text-xs font-bold uppercase text-[#228BE6] disabled:opacity-40">Comentar</button>
          </div>
        </div>

        {(activity.source === 'tarefa' || activity.source === 'prazo') && (
          <div className="mt-4 flex justify-end">
            {done
              ? <button disabled={busy} onClick={toggleDone} className="inline-flex items-center gap-1.5 rounded-md border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Reabrir</button>
              : <button disabled={busy} onClick={toggleDone} className="inline-flex items-center gap-1.5 rounded-md bg-[#02883C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Check className="h-4 w-4" /> Concluir</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="flex gap-2"><dt className="shrink-0 font-medium text-[#6C757D]">{label}{label ? ':' : ''}</dt><dd className="font-normal text-[#202124] dark:text-zinc-200">{children}</dd></div>);
}

function CreateEventDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<EventKind>('audiencia');
  const [startsAt, setStartsAt] = useState(date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '');
  const [location, setLocation] = useState('');
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!startsAt) return toast.error('Informe a data/hora');
    setSaving(true);
    try { await calendarService.create({ title: title.trim(), kind, startsAt: new Date(startsAt).toISOString(), location: location || undefined, caseId: caseId || undefined }); toast.success('Evento criado'); onSaved(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Novo evento" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Título *"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>{(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label="Data e hora *"><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Local"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputCls} pl-9`} placeholder="Fórum, sala, link…" /></div></Field>
        <Field label="Processo (opcional)"><select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={inputCls}><option value="">Nenhum</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Cancelar</button><button onClick={submit} disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: ASTREA_BLUE }}>{saving ? 'Salvando…' : 'Criar'}</button></div>
    </Modal>
  );
}

function CreateTaskDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [dueAt, setDueAt] = useState(date ? toDateInput(date) : toDateInput(new Date()));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try { await tasksService.create({ title: title.trim(), priority, dueAt: dueAt ? new Date(dueAt + 'T09:00:00').toISOString() : null, description: description || undefined }); toast.success('Tarefa criada'); onSaved(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Nova tarefa" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Título *"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade"><select value={priority} onChange={(e) => setPriority(e.target.value as any)} className={inputCls}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></select></Field>
          <Field label="Data"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Descrição"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900" /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Cancelar</button><button onClick={submit} disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: ASTREA_BLUE }}>{saving ? 'Salvando…' : 'Criar'}</button></div>
    </Modal>
  );
}
