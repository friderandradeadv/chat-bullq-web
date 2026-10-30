'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
// 🚨 `api` já é nome usado nesta página (o CalendarApi do FullCalendar), e
// importar com o mesmo nome fez o `calRef.current.getApi()` virar o cliente
// HTTP no meio do arquivo. Entra com apelido.
import { api as http } from '@/lib/api';
import { activitiesService, ENTITY_TYPE } from '@/features/activities/services/activities.service';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { EventInput, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  List,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Stamp,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { calendarService, type CalendarEvent, type EventKind } from '@/features/calendar/services/calendar.service';
import { googleAgendaService, type EventoGoogle } from '@/features/google-agenda/google-agenda.service';
import { deadlinesService, type Deadline } from '@/features/deadlines/services/deadlines.service';
import { tasksService, type Task } from '@/features/tasks/services/tasks.service';
import { membersService } from '@/features/settings/services/members.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { recursosService, type Recurso } from '@/features/recursos/services/recursos.service';
import { AvancoFaseModal } from '@/features/legal-cases/components/avanco-fase-modals';
import { CommentsSection } from '@/features/activities/components/comments-section';
import { AnexosSection } from '@/features/activities/components/anexos-section';
import { SugestaoDePeca } from '@/features/legal-cases/components/sugestao-de-peca';
import { ArquivarPecaModal } from '@/features/legal-cases/components/arquivar-peca-modal';
import { MoverFaseManual } from '@/features/legal-cases/components/mover-fase-manual';
import { DisponibilidadeModal } from '@/features/calendar/components/disponibilidade-modal';
import { preferencesService } from '@/features/inbox/services/preferences.service';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { inputCls, Field, ASTREA_BLUE, CnjNumber } from '../processos/page';
import { Modal, ModalPortal } from '@/components/ui/modal';
import { TagSelector, TAG_PALETTE } from '@/features/activities/components/tag-selector';
import { CaseSearch } from '@/features/legal-cases/components/case-search';
import { CreateDeadlineDialog } from '@/features/deadlines/components/create-deadline-dialog';
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog';
import { CreateEventDialog } from '@/features/calendar/components/create-event-dialog';
import { CreateAtendimentoDialog } from '@/features/calendar/components/create-atendimento-dialog';
import { KIND_LABEL, RemindersField, reminderLabel } from '@/features/calendar/components/reminders-field';
import { ActivityDetailModal, prazoParaActivity, ExpandableText, MiniCalendar, avancoDoPrazo, capFirst, ehCardDeCumprimento, ehCardDeReplica, especieDoPrazo, isRecursoPrazo, pad, sameDay, toDateInput, toDatetimeLocal, TYPE_TAG } from '@/features/deadlines/components/activity-detail-modal';
import type { Activity, Avanco, AvancoOpt, Src } from '@/features/deadlines/components/activity-detail-modal';

const EV_PENDING = { bg: '#DAF3FF', text: '#1D6BB7' };
const EV_TIMED = { bg: '#D3F8E5', text: '#1D6BB7' };
const EV_DONE = { bg: '#F1F3F4', text: '#6C757D' };

const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };

type ViewMode = 'list' | 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
const VIEW_LABEL: Record<ViewMode, string> = { list: 'Em lista', timeGridDay: 'Por dia', timeGridWeek: 'Por semana', dayGridMonth: 'Por mês' };
const VIEW_KEY = 'agenda:view';

type StatusFilter = 'todas' | 'aconcluir' | 'concluidas' | 'canceladas';
const STATUS_VALUES: StatusFilter[] = ['todas', 'aconcluir', 'concluidas', 'canceladas'];
const STATUS_KEY = 'agenda:status';
type ExibirFilter = { tarefas: boolean; eventos: boolean };
// De onde vêm os itens: o hub, o Google Agenda ou os dois juntos.
type FonteAgenda = 'ambos' | 'hub' | 'google';
const FONTE_KEY = 'agenda:fonte';
const FONTE_LABEL: Record<FonteAgenda, string> = { ambos: 'Hub + Google', hub: 'Só o hub', google: 'Só o Google' };
// Eventos do Google que ele riscou NO HUB (no Google nada muda). Chave estável:
// conta|agenda|evento — o id de cada ocorrência de evento repetido é próprio.
const GFEITOS_KEY = 'agenda:googleFeitos';
const chaveGoogle = (g: { contaId: string; calendarId: string; id: string }) => `${g.contaId}|${g.calendarId}|${g.id}`;
// Já terminou? Com hora: o fim (ou o início, se não houver fim) ficou para trás.
// Dia inteiro: o Google manda o fim como o dia SEGUINTE, exclusivo — passou
// quando hoje já chegou nesse dia. Passado conta como feito sem ninguém clicar.
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const googlePassou = (g: { inicio: string; fim: string | null; diaInteiro: boolean }) =>
  g.diaInteiro ? (g.fim ?? g.inicio) <= hojeISO() : new Date(g.fim ?? g.inicio).getTime() < Date.now();
const EXIBIR_KEY = 'agenda:exibir';
// Só aceita o que tem a forma certa (localStorage/prefs podem vir de versão antiga).
const parseExibir = (v: unknown): ExibirFilter | null =>
  v && typeof v === 'object'
    && typeof (v as ExibirFilter).tarefas === 'boolean'
    && typeof (v as ExibirFilter).eventos === 'boolean'
    ? { tarefas: (v as ExibirFilter).tarefas, eventos: (v as ExibirFilter).eventos }
    : null;

const initials = (name: string | null) => { if (!name) return 'Eu'; const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'Eu'; };
const SEEN_NEW_KEY = 'agenda:seenNew';

function renderEventStrip(el: HTMLElement, a: Activity, isNew = false, estaPronto = false) {
  el.querySelector(':scope > .ag-tagstrip')?.remove();
  el.querySelector(':scope > .ag-newdot')?.remove();
  el.querySelector(':scope > .ag-okdot')?.remove();
  const segs = (a.done || a.cancelled)
    ? [{ color: '#CED4DA', name: 'Cumprido' }]
    : a.tags.length
      ? a.tags.slice(0, 4).map((t) => ({ color: t.color, name: t.name }))
      : [{ color: TYPE_TAG[a.source].bg, name: TYPE_TAG[a.source].label }];
  const strip = document.createElement('div');
  strip.className = 'ag-tagstrip';
  for (const s of segs) {
    const sp = document.createElement('span');
    sp.style.backgroundColor = s.color;
    sp.title = s.name;
    strip.appendChild(sp);
  }
  el.prepend(strip);
  // Cumprido/cancelado nunca leva a bolinha de "novo": o item já foi resolvido,
  // e ter sido CRIADO hoje (ex.: recriado por varredura do DJEN) não é novidade
  // que peça olhar. Gate aqui, e não no chamador, porque são dois call sites.
  if (isNew && !a.done && !a.cancelled) {
    const dot = document.createElement('span');
    dot.className = 'ag-newdot';
    dot.title = 'Adicionado hoje';
    el.appendChild(dot);
  }
  // 🚨 A BOLINHA VERDE É "A PEÇA FICOU PRONTA E VOCÊ AINDA NÃO VIU". Pedido
  // dele em 19/10/2026: *"deixe um pontinho verde ou algo verde na agenda para
  // saber que está ok, quando eu clicar na tarefa, a bolinha verde some"*. A
  // barra de progresso cumpre o papel enquanto o robô trabalha e some dois
  // minutos depois do fim — de propósito, para não mentir sobre atividade.
  // Mas quem estava longe do computador perdia o aviso inteiro. A bolinha
  // fica até ele abrir a tarefa.
  if (estaPronto && !a.done && !a.cancelled) {
    const dot = document.createElement('span');
    dot.className = 'ag-okdot';
    dot.title = 'A peça ficou pronta — abra a tarefa para ver';
    el.appendChild(dot);
  }
}

// Atividade adicionada HOJE e ainda não vista (marca/desmarca a bolinha vermelha).
const isCreatedToday = (a: Activity) => !!a.createdAt && sameDay(new Date(a.createdAt), new Date());

export default function AgendaPage() {
  const router = useRouter();
  const calRef = useRef<FullCalendar | null>(null);
  // id do evento → elemento montado (pra repintar a barra quando as tags chegam)
  const elMapRef = useRef(new Map<string, HTMLElement>());
  const [mode, setMode] = useState<ViewMode>('list');
  const [viewMenu, setViewMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [title, setTitle] = useState('');
  const [titlePicker, setTitlePicker] = useState(false);
  const [chooser, setChooser] = useState<{ date?: Date } | null>(null);
  const [dialog, setDialog] = useState<{ type: 'evento' | 'tarefa' | 'atendimento' | 'prazo'; date?: Date } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);

  // Filtros (Astrea): Exibir tipo + Status + Pessoa
  const [fAtiv, setFAtiv] = useState(false);
  const [fAtrib, setFAtrib] = useState(false);
  const [dispOpen, setDispOpen] = useState(false);
  const [exibir, setExibir] = useState<ExibirFilter>({ tarefas: true, eventos: true });
  const [fonte, setFonte] = useState<FonteAgenda>('ambos');
  const [fonteMenu, setFonteMenu] = useState(false);
  const [googleFeitos, setGoogleFeitos] = useState<Set<string>>(new Set());
  const [gDetalhe, setGDetalhe] = useState<EventoGoogle | null>(null);
  // Padrão "A concluir" só para quem NUNCA escolheu: agenda é lista do que FALTA
  // fazer. Com "todas", prazo concluído e prazo CANCELADO seguiam ocupando o dia
  // (riscados, e com a bolinha de "adicionado hoje" se tivessem nascido no dia) —
  // foi o que poluiu a agenda depois do backfill do DJEN de 18/08/2026. Assim que
  // o usuário aplica um status, a escolha DELE manda e é salva (localStorage +
  // preferências do usuário no servidor), por usuário, valendo em qualquer
  // aparelho — nunca mais volta sozinho para "A concluir".
  const [status, setStatus] = useState<StatusFilter>('aconcluir');
  const [personId, setPersonId] = useState<string>('all');
  const [dExibir, setDExibir] = useState(exibir);
  const [dStatus, setDStatus] = useState(status);
  const [dPerson, setDPerson] = useState(personId);

  // Etiquetas (filtro), busca por tarefa e menu "Mais" — estilo Astrea.
  const [fTags, setFTags] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreMenu, setMoreMenu] = useState(false);
  // Atividades novas (criadas hoje) já visualizadas → some a bolinha vermelha.
  // Persistido em localStorage; o ref espelha o estado p/ o eventDidMount (que roda
  // no mount, antes de o efeito repintar).
  const seenRef = useRef<Set<string>>(new Set());
  const [seenNew, setSeenNew] = useState<Set<string>>(new Set());
  const qcPrefs = useQueryClient();
  // Grava o objeto `agenda` INTEIRO nas preferências do usuário. O merge do
  // backend é RASO no topo, então mandar só um campo (view OU seenNew) apagaria
  // o outro — por isso sempre reenviamos o objeto completo.
  const patchAgendaPrefs = (partial: { view?: ViewMode; seenNew?: string[]; status?: StatusFilter; exibir?: ExibirFilter; fonte?: FonteAgenda; googleFeitos?: string[] }) => {
    const cur =
      (qcPrefs.getQueryData(['user-preferences']) as { agenda?: Record<string, unknown> } | undefined)
        ?.agenda ?? {};
    const nextAgenda = { ...cur, ...partial };
    qcPrefs.setQueryData(['user-preferences'], (prev: Record<string, unknown> | undefined) => ({
      ...(prev || {}),
      agenda: nextAgenda,
    }));
    preferencesService.patch({ agenda: nextAgenda }).catch(() => { /* best-effort */ });
  };
  useEffect(() => {
    try {
      const f = localStorage.getItem(FONTE_KEY) as FonteAgenda | null;
      if (f && f in FONTE_LABEL) setFonte(f);
      const gf = localStorage.getItem(GFEITOS_KEY);
      if (gf) setGoogleFeitos(new Set<string>(JSON.parse(gf)));
    } catch { /* */ }
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_NEW_KEY);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      seenRef.current = set;
      setSeenNew(set);
    } catch { /* */ }
  }, []);
  const markSeen = (id: string) => {
    if (seenRef.current.has(id)) return;
    const next = new Set(seenRef.current); next.add(id);
    seenRef.current = next; setSeenNew(next);
    // Cap p/ não crescer sem limite nas prefs (só itens de hoje viram bolinha).
    const arr = [...next].slice(-500);
    try { localStorage.setItem(SEEN_NEW_KEY, JSON.stringify(arr)); } catch { /* */ }
    // Sincroniza "já visto" entre aparelhos (leu na web → some no celular).
    patchAgendaPrefs({ seenNew: arr });
  };

  // Por padrão a agenda abre nas atribuições do usuário logado (não "Todas"),
  // igual ao Astrea. Aplica uma única vez quando o usuário fica disponível;
  // depois o filtro fica livre (o usuário pode escolher Todas ou outra pessoa).
  const meId = useAuthStore((s) => s.user?.id) ?? null;
  // Associado (AGENT): só vê a própria agenda. Trava o filtro de pessoa nele e
  // pede ao backend só o que é dele (o backend também filtra por conta própria).
  const { isSocio } = usePermissions();
  const didInitPerson = useRef(false);
  useEffect(() => {
    if (!meId) return;
    // AGENT fica sempre travado em "minhas atribuições".
    if (!isSocio) { setPersonId(meId); setDPerson(meId); return; }
    if (didInitPerson.current) return;
    didInitPerson.current = true;
    setPersonId(meId);
    setDPerson(meId);
  }, [meId, isSocio]);

  const api = () => calRef.current?.getApi();

  // 1) Restauração INSTANTÂNEA (localStorage) — evita "piscar" na lista antes de
  //    a preferência do servidor chegar.
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY)) as ViewMode | null;
    if (saved && saved in VIEW_LABEL) setMode(saved);
    const st = (typeof window !== 'undefined' && localStorage.getItem(STATUS_KEY)) as StatusFilter | null;
    if (st && STATUS_VALUES.includes(st)) { setStatus(st); setDStatus(st); }
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(EXIBIR_KEY) : null;
      const ex = raw ? parseExibir(JSON.parse(raw)) : null;
      if (ex) { setExibir(ex); setDExibir(ex); }
    } catch { /* */ }
  }, []);

  // 2) Preferência POR USUÁRIO (servidor) — segue o Matheus entre aparelhos
  //    (ex.: escolheu "por mês" no desktop → abre em "por mês" no celular).
  //    O servidor é a fonte da verdade e sobrepõe o localStorage UMA vez, só se
  //    o usuário ainda não trocou de visão nesta sessão.
  const prefsQ = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => preferencesService.get(),
    staleTime: 5 * 60 * 1000,
  });
  const didApplyServerView = useRef(false);
  useEffect(() => {
    if (didApplyServerView.current || !prefsQ.isSuccess) return;
    didApplyServerView.current = true;
    const v = (prefsQ.data?.agenda as { view?: ViewMode } | undefined)?.view;
    if (v && v in VIEW_LABEL) {
      setMode(v);
      try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
    }
  }, [prefsQ.isSuccess, prefsQ.data]);

  // 2b) MESMA lógica para o painel "Todas as atividades" — Exibir (Tarefas /
  //     Eventos) e Status ("A concluir" / "Concluídas" / "Canceladas" / "Todas"):
  //     quem escolheu "Todas" no desktop abre em "Todas" no celular. Os dois saem
  //     do MESMO botão Aplicar, então uma trava só cobre os dois; ela vira true no
  //     Aplicar para um fetch tardio de preferências não desfazer a escolha.
  const didApplyServerFiltros = useRef(false);
  useEffect(() => {
    if (didApplyServerFiltros.current || !prefsQ.isSuccess) return;
    didApplyServerFiltros.current = true;
    const ag = prefsQ.data?.agenda as { status?: StatusFilter; exibir?: unknown } | undefined;
    const st = ag?.status;
    if (st && STATUS_VALUES.includes(st)) {
      setStatus(st);
      setDStatus(st);
      try { localStorage.setItem(STATUS_KEY, st); } catch { /* */ }
    }
    const ex = parseExibir(ag?.exibir);
    if (ex) {
      setExibir(ex);
      setDExibir(ex);
      try { localStorage.setItem(EXIBIR_KEY, JSON.stringify(ex)); } catch { /* */ }
    }
  }, [prefsQ.isSuccess, prefsQ.data]);

  // 3) "Já visto" por USUÁRIO (servidor): une o conjunto do servidor ao local
  //    uma vez — quem leu na web não vê tudo como "novo" no celular.
  const didApplyServerSeen = useRef(false);
  useEffect(() => {
    if (didApplyServerSeen.current || !prefsQ.isSuccess) return;
    didApplyServerSeen.current = true;
    const arr = (prefsQ.data?.agenda as { seenNew?: string[] } | undefined)?.seenNew;
    if (arr && arr.length) {
      const merged = new Set<string>([...seenRef.current, ...arr]);
      seenRef.current = merged;
      setSeenNew(merged);
      try { localStorage.setItem(SEEN_NEW_KEY, JSON.stringify([...merged].slice(-500))); } catch { /* */ }
    }
  }, [prefsQ.isSuccess, prefsQ.data]);

  // Fonte e riscados do Google: o servidor é a verdade (segue entre aparelhos).
  // Os riscados se SOMAM aos locais — riscar no celular e no desktop não se apagam.
  const didApplyServerFonte = useRef(false);
  useEffect(() => {
    if (didApplyServerFonte.current || !prefsQ.isSuccess) return;
    didApplyServerFonte.current = true;
    const ag = prefsQ.data?.agenda as { fonte?: FonteAgenda; googleFeitos?: string[] } | undefined;
    if (ag?.fonte && ag.fonte in FONTE_LABEL) {
      setFonte(ag.fonte);
      try { localStorage.setItem(FONTE_KEY, ag.fonte); } catch { /* */ }
    }
    const doServidor = Array.isArray(ag?.googleFeitos) ? ag!.googleFeitos! : [];
    if (doServidor.length) setGoogleFeitos((cur) => new Set<string>([...cur, ...doServidor]));
  }, [prefsQ.isSuccess, prefsQ.data]);
  const pickFonte = (f: FonteAgenda) => {
    setFonte(f); setFonteMenu(false);
    didApplyServerFonte.current = true;
    try { localStorage.setItem(FONTE_KEY, f); } catch { /* */ }
    patchAgendaPrefs({ fonte: f });
  };
  const riscarGoogle = (g: EventoGoogle, feito: boolean) => {
    const next = new Set(googleFeitos);
    if (feito) next.add(chaveGoogle(g)); else next.delete(chaveGoogle(g));
    setGoogleFeitos(next);
    // Teto: ficam os mais recentes; riscado de meses atrás não pesa nas prefs.
    const arr = [...next].slice(-1000);
    try { localStorage.setItem(GFEITOS_KEY, JSON.stringify(arr)); } catch { /* */ }
    patchAgendaPrefs({ googleFeitos: arr });
    toast.success(feito ? 'Compromisso concluído no hub' : 'Compromisso reaberto');
  };

  const from = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString(); }, []);
  const to = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString(); }, []);

  // O escopo do associado é feito no BACKEND (calendar/deadlines/tasks já filtram
  // por responsável + co-responsável quando o usuário não é sócio) — não passamos
  // assignedToId aqui pra não estreitar demais (perderia os itens de co-responsável
  // do calendar). O filtro client-side abaixo trava a visão do AGENT em si mesmo.
  const evQ = useQuery({ queryKey: ['calendar', 'agenda'], queryFn: () => calendarService.list({ from, to }) });
  // Google Agenda: leitura na hora (o servidor não guarda nada do Google). Sem
  // conta ligada volta vazio; falha do Google não derruba a agenda do hub.
  const gQ = useQuery({
    queryKey: ['google-agenda', 'eventos', from, to],
    queryFn: () => googleAgendaService.eventos(from, to),
    staleTime: 2 * 60_000,
    retry: false,
  });
  const dlQ = useQuery({ queryKey: ['deadlines', 'agenda'], queryFn: () => deadlinesService.list({}) });
  const tkQ = useQuery({ queryKey: ['tasks', 'agenda'], queryFn: () => tasksService.list() });
  const mbQ = useQuery({ queryKey: ['members', 'agenda'], queryFn: () => membersService.list() });
  const tagsQ = useQuery({ queryKey: ['activity-tags-index'], queryFn: () => activitiesService.tagsIndex() });
  const legalTagsQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const refetchAll = () => { evQ.refetch(); dlQ.refetch(); tkQ.refetch(); tagsQ.refetch(); legalTagsQ.refetch(); qcPrefs.invalidateQueries({ queryKey: ['tasks', 'pending-count'] }); };

  const userMap = useMemo(() => new Map((mbQ.data ?? []).map((m) => [m.user.id, m.user.name])), [mbQ.data]);
  // entityType:entityId → etiquetas, montado do índice (1 request p/ a agenda toda).
  const tagMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }[]>();
    for (const e of tagsQ.data ?? []) {
      const k = `${e.entityType}:${e.entityId}`;
      const arr = m.get(k);
      if (arr) arr.push(e.tag); else m.set(k, [e.tag]);
    }
    return m;
  }, [tagsQ.data]);

  const activities = useMemo<Activity[]>(() => {
    const out: Activity[] = [];
    for (const t of tkQ.data ?? []) {
      if (!t.dueAt) continue;
      const dj = t.metadata?.djen;
      const td = new Date(t.dueAt);
      // "Dia todo" = tarefa SEM horário real. Cobre os formatos de data-pura do banco:
      //  • meia-noite UTC ("…T00:00:00…Z") — as tarefas de "ciência" do DJEN, que em
      //    BRT viravam "21:00" no dia ANTERIOR. Tratando como dia-todo, o calendário
      //    usa o dia UTC (slice 0,10) e elas voltam pro dia certo, sem hora.
      //  • meia-noite ou 09:00 no horário LOCAL — criação manual / prazos BRT.
      // Só os EVENTOS (audiências) têm horário real e mantêm a hora.
      const taskAllDay = /T00:00:00/.test(t.dueAt)
        || ((td.getHours() === 0 || td.getHours() === 9) && td.getMinutes() === 0);
      out.push({
        id: 't_' + t.id, source: 'tarefa', rawId: t.id, title: t.title, date: t.dueAt,
        endDate: null,
        triggerDate: null,
        tags: tagMap.get('task:' + t.id) ?? [],
        coResponsibleIds: (t.metadata as any)?.coResponsibleIds ?? [],
        reminders: null,
        createdAt: t.createdAt ?? null,
        hasTime: !taskAllDay,
        done: t.status === 'DONE', cancelled: false, fatal: t.priority === 'HIGH',
        caseId: t.case?.id ?? null, caseTitle: t.case?.title ?? null, cnj: t.case?.cnjNumber ?? null,
        responsibleId: t.assigneeId, responsibleName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
        createdName: t.createdById ? userMap.get(t.createdById) ?? null : null,
        priorityLabel: PRIORITY_LABEL[t.priority] ?? null, completedAt: t.completedAt, description: t.description,
        priority: t.priority, deadlineType: null, kind: null,
        prazoFatal: dj?.prazoFatal ?? null, recorte: dj?.recorte ?? null, tipoPublicacao: dj?.tipoPublicacao ?? null,
        faseMovida: dj?.faseMovida ?? null, dispositivo: dj?.dispositivo ?? null,
        djenAction: (dj as any)?.action ?? null, recursoSugestao: (dj as any)?.recurso ?? null,
        processosRelacionados: (dj as any)?.processosRelacionados ?? null,
      });
    }
    for (const d of dlQ.data ?? []) {
      out.push(prazoParaActivity(d, tagMap.get('deadline:' + d.id) ?? []));
    }
    for (const e of evQ.data ?? []) {
      out.push({
        id: 'e_' + e.id, source: 'evento', rawId: e.id, title: e.title, date: e.startsAt,
        endDate: e.endsAt,
        triggerDate: null,
        tags: tagMap.get('event:' + e.id) ?? [],
        coResponsibleIds: (e as any).metadata?.coResponsibleIds ?? [],
        reminders: (e.metadata?.reminders as number[] | undefined) ?? null,
        createdAt: e.createdAt ?? null,
        hasTime: true, done: !!e.metadata?.completedAt, cancelled: false, fatal: false,
        caseId: e.caseId, caseTitle: e.case?.title ?? null, cnj: e.case?.cnjNumber ?? null,
        responsibleId: e.assignedTo?.id ?? null, responsibleName: e.assignedTo?.name ?? null,
        createdName: null, priorityLabel: null, completedAt: (e.metadata?.completedAt as string) ?? null, description: e.location,
        priority: null, deadlineType: null, kind: e.kind,
        ocupadoDeOutro: e.metadata?.pessoal === true && e.assignedTo?.id !== meId,
        prazoFatal: null, recorte: null, tipoPublicacao: null,
        faseMovida: null, dispositivo: null,
        djenAction: null, recursoSugestao: null, processosRelacionados: null,
      });
    }
    return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [tkQ.data, dlQ.data, evQ.data, userMap, tagMap, meId]);

  // O painel de detalhe recebe SEMPRE a versão FRESCA da atividade — `detail` é só
  // um snapshot do clique. Sem isto, editar (processo, prioridade, descrição…) só
  // aparecia depois de fechar e reabrir o card.
  const detailLive = useMemo(() => (detail ? activities.find((a) => a.id === detail.id) ?? detail : null), [detail, activities]);

  const q = searchQuery.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const filtered = useMemo(() => activities.filter((a) => {
    if (fonte === 'google') return false;
    if (a.source === 'evento' ? !exibir.eventos : !exibir.tarefas) return false;
    if (status === 'aconcluir' && (a.done || a.cancelled)) return false;
    if (status === 'concluidas' && !a.done) return false;
    if (status === 'canceladas' && !a.cancelled) return false;
    // Filtra por pessoa como responsável OU co-responsável (envolvido) — assim o
    // associado, travado em si mesmo, também vê os itens em que é co-responsável.
    if (personId !== 'all' && a.responsibleId !== personId && !(a.coResponsibleIds ?? []).includes(personId)) return false;
    if (tagFilter.length && !a.tags.some((t) => tagFilter.includes(t.id))) return false;
    if (q) {
      const byText = a.title.toLowerCase().includes(q) || (a.caseTitle ?? '').toLowerCase().includes(q);
      const byCnj = qDigits.length >= 3 && (a.cnj ?? '').replace(/\D/g, '').includes(qDigits);
      if (!byText && !byCnj) return false;
    }
    return true;
  }), [activities, exibir, status, personId, tagFilter, q, qDigits, fonte]);

  const byId = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);
  // Repinta a barra do topo de cada evento já montado quando as etiquetas/filtro
  // mudam — as tags carregam async, depois do mount, e sem isto a barra ficava
  // presa na cor do tipo (a divisão por etiqueta "não funcionava").
  // 🚨 MESMA CHAVE DO VISOR FLUTUANTE, e isso é de propósito: o react-query
  // junta as duas assinaturas numa requisição só. A agenda não paga nada por
  // mostrar a bolinha.
  const prontosQ = useQuery({
    queryKey: ['legal-cases', 'progresso', 'ativos'],
    queryFn: async (): Promise<Array<{ caseId: string; progresso: { status: string; em: string } }>> => {
      const { data } = await http.get('/legal-cases/progresso/ativos');
      const d = data?.data ?? data;
      return (d?.itens ?? []) as Array<{ caseId: string; progresso: { status: string; em: string } }>;
    },
    refetchInterval: 15000,
    staleTime: 1500,
  });
  // caseId → a chave do "pronto" (inclui a hora, para que um trabalho NOVO
  // reacenda a bolinha mesmo que ele já tenha visto o anterior)
  const prontoPorCaso = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of prontosQ.data ?? []) {
      if (x?.progresso?.status === 'ok' && x.progresso.em) {
        m.set(x.caseId, `pronto:${x.caseId}:${x.progresso.em}`);
      }
    }
    return m;
  }, [prontosQ.data]);
  const chaveDoPronto = (a: Activity) => (a.caseId ? prontoPorCaso.get(a.caseId) : undefined);
  const estaProntoNaoVisto = (a: Activity) => {
    const k = chaveDoPronto(a);
    return !!k && !a.done && !a.cancelled && !seenNew.has(k);
  };

  useEffect(() => {
    for (const [id, el] of elMapRef.current) {
      const a = byId.get(id);
      if (a) renderEventStrip(el, a, isCreatedToday(a) && !seenNew.has(a.id), estaProntoNaoVisto(a));
    }
  }, [byId, seenNew, prontoPorCaso]);
  // A bolinha de "novo" só some quando o usuário ABRE a atividade (openDetail →
  // markSeen). Nada de auto-marcar por "só ter olhado a agenda": o Matheus quer que
  // a bolinha fique até ele clicar na tarefa.
  const fcEvents = useMemo<EventInput[]>(() => filtered.map((a): EventInput => {
    const c = a.done || a.cancelled ? EV_DONE : a.source === 'evento' ? EV_TIMED : EV_PENDING;
    // Eventos com hora precisam de FIM pra ter altura no timeGrid — sem isso o
    // FullCalendar dá altura mínima e corta o horário + título. Usa o fim real do
    // evento; quando não há, assume +1h.
    const end = a.hasTime ? (a.endDate ?? new Date(+new Date(a.date) + 3_600_000).toISOString()) : undefined;
    return {
      // Itens só-data (prazos/tarefas s/ hora) entram como data-only ('YYYY-MM-DD')
      // pra o FullCalendar não converter o UTC meia-noite e jogar pro dia anterior.
      // Iniciais do responsável só quando estou vendo "Todas" — filtrado numa
      // pessoa, "MF ·" é redundante e rouba espaço do horário/título no mês.
      id: a.id, title: personId === 'all' ? `${initials(a.responsibleName)} · ${a.title}` : a.title, start: a.hasTime ? a.date : a.date.slice(0, 10), end, allDay: !a.hasTime,
      backgroundColor: c.bg, borderColor: c.bg, textColor: c.text,
      classNames: [`ag-${a.source}`, (a.done || a.cancelled) ? 'ag-done' : ''].filter(Boolean),
      startEditable: !a.cancelled && !a.ocupadoDeOutro, // tarefas/eventos/prazos arrastáveis (no prazo move a data de execução; a fatal é legal e fica na ficha)
      // ordSort define a ordem no card do dia/popover (ver eventOrder):
      //   0 = COMPROMISSO em aberto (audiência/evento c/ hora) → sempre primeiro, por horário;
      //   1 = tarefa/prazo em aberto (dia todo); 2 = cumprido/cancelado → por último.
      extendedProps: { ordSort: (a.done || a.cancelled) ? 2 : (a.hasTime ? 0 : 1) },
    };
  }).concat(
    // Eventos do Google: só leitura (editar é no Google). Seguem o filtro de
    // pessoa e o "exibir eventos"; a busca por texto também vale para eles.
    // O status vale para eles também: riscado no hub conta como concluído.
    fonte !== 'hub' && exibir.eventos && status !== 'canceladas'
      ? (gQ.data?.eventos ?? [])
          .filter((g) => personId === 'all' || g.donoId === personId)
          .filter((g) => !q || g.titulo.toLowerCase().includes(q))
          .filter((g) => {
            const feito = googleFeitos.has(chaveGoogle(g)) || googlePassou(g);
            return status === 'aconcluir' ? !feito : status === 'concluidas' ? feito : true;
          })
          .map((g): EventInput => {
            const feito = googleFeitos.has(chaveGoogle(g)) || googlePassou(g);
            const cor = feito ? EV_DONE.bg : g.oculto ? '#a1a1aa' : g.cor ?? '#4285F4';
            return {
              id: `g_${g.contaId}_${g.calendarId}_${g.id}`,
              title: `${personId === 'all' ? `${initials(userMap.get(g.donoId) ?? null)} · ` : ''}${g.titulo}`,
              start: g.inicio,
              end: g.fim ?? undefined,
              allDay: g.diaInteiro,
              backgroundColor: cor,
              borderColor: cor,
              textColor: feito ? EV_DONE.text : '#ffffff',
              classNames: ['ag-google', feito ? 'ag-done' : ''].filter(Boolean),
              startEditable: false,
              durationEditable: false,
              extendedProps: { ordSort: feito ? 2 : g.diaInteiro ? 1 : 0, google: g },
            };
          })
      : [],
  ), [filtered, personId, gQ.data, exibir.eventos, status, q, userMap, fonte, googleFeitos]);

  const pickMode = (m: ViewMode) => {
    setMode(m); setViewMenu(false);
    // já interagiu nesta sessão → um fetch tardio de preferências não sobrescreve.
    didApplyServerView.current = true;
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* */ }
    // Salva por usuário no servidor mantendo o `seenNew` (patchAgendaPrefs reenvia
    // o objeto agenda inteiro — o merge do backend é raso no topo).
    patchAgendaPrefs({ view: m });
  };
  // Aplicar o painel "Todas as atividades" = escolha do usuário: vale nesta sessão,
  // fica no localStorage (instantâneo no próximo load) e vai para as preferências
  // DELE no servidor (patchAgendaPrefs reenvia o objeto `agenda` inteiro — o merge
  // do backend é raso no topo, mandar só um campo apagaria view/seenNew).
  const pickFiltros = (ex: ExibirFilter, st: StatusFilter) => {
    setExibir(ex);
    setStatus(st);
    // já escolheu nesta sessão → um fetch tardio de preferências não sobrescreve.
    didApplyServerFiltros.current = true;
    try {
      localStorage.setItem(STATUS_KEY, st);
      localStorage.setItem(EXIBIR_KEY, JSON.stringify(ex));
    } catch { /* */ }
    patchAgendaPrefs({ status: st, exibir: ex });
  };
  const openCreate = (type: 'evento' | 'tarefa' | 'atendimento' | 'prazo', date?: Date) => { setChooser(null); setAddMenu(false); setDialog({ type, date }); };
  const onDateClick = (arg: DateClickArg) => setChooser({ date: arg.date });
  // Abrir a atividade = visualizá-la → tira a bolinha de "novo".
  const openDetail = (a: Activity) => {
    markSeen(a.id);
    // abrir a tarefa é ver o resultado: a bolinha verde sai aqui
    const k = chaveDoPronto(a);
    if (k) markSeen(k);
    setDetail(a);
  };
  const isUnseenNew = (a: Activity) => isCreatedToday(a) && !a.done && !a.cancelled && !seenNew.has(a.id);
  const onEventClick = (arg: EventClickArg) => {
    const g = arg.event.extendedProps?.google as import('@/features/google-agenda/google-agenda.service').EventoGoogle | undefined;
    if (g) {
      // "Ocupado" de colega não tem detalhe nem botão: não é dele para riscar.
      if (g.oculto || g.donoId !== meId) { toast.info('Horário ocupado na agenda de um colega.'); return; }
      setGDetalhe(g);
      return;
    }
    const a = byId.get(arg.event.id);
    if (a?.ocupadoDeOutro) { toast.info('Compromisso pessoal de um colega: só ele vê os detalhes.'); return; }
    if (a) openDetail(a);
  };
  // Arrastar tarefa/evento/prazo para outra data (ou horário, na semana/dia) →
  // reagenda. No PRAZO movemos a data de EXECUÇÃO (safeDate); a data FATAL é
  // legal e permanece intacta (só editável na ficha do prazo).
  const onEventDrop = async (arg: EventDropArg) => {
    const a = byId.get(arg.event.id);
    const start = arg.event.start;
    if (!a || !start) { arg.revert(); return; }
    try {
      const iso = start.toISOString();
      if (a.source === 'tarefa') await tasksService.update(a.rawId, { dueAt: iso });
      else if (a.source === 'prazo') await deadlinesService.update(a.rawId, { safeDate: iso });
      else await calendarService.update(a.rawId, { startsAt: iso });
      toast.success(
        a.source === 'tarefa'
          ? 'Tarefa movida'
          : a.source === 'prazo'
            ? 'Prazo movido (data de execução; a fatal permanece)'
            : 'Evento movido',
      );
      refetchAll();
    } catch (e: any) { toast.error(e?.message || 'Erro ao mover'); arg.revert(); }
  };

  const personLabel = personId === 'all' ? 'Todas as atribuições' : personId === meId ? 'Minhas atribuições' : (userMap.get(personId)?.split(' ')[0] ?? 'Pessoa');
  const showSidePanel = mode === 'list' || mode === 'timeGridDay';
  const isMonth = mode === 'dayGridMonth';

  return (
    // A PÁGINA INTEIRA rola (estilo Astrea): o scroll fica neste root, o
    // calendário rende na altura natural (height auto) e o conteúdo passa por
    // baixo da barra de vidro — nada de scroll preso dentro da grade de dias.
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-zinc-950 p-4 lg:p-6 text-zinc-800 dark:text-zinc-200">
      {/* Cabeçalho NORMAL (não-sticky): rola junto com a página, igual às outras
          telas. Sem vidro/margem-negativa sticky (que vazava). O respiro do topo
          vem da folga global (.under-bar > *). */}
      <div className="mb-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><CalendarDays className="h-4 w-4" style={{ color: '#228BE6' }} /> Agenda</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { refetchAll(); toast.success('Agenda atualizada'); }} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E9ECEF] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Atualizar"><RefreshCw className={`h-4 w-4 ${(evQ.isFetching || dlQ.isFetching || tkQ.isFetching || tagsQ.isFetching) ? 'animate-spin' : ''}`} /></button>
          <div className="relative">
            <button onClick={() => setMoreMenu((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E9ECEF] bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" title="Mais"><MoreVertical className="h-4 w-4" /></button>
            {moreMenu && (<><div className="fixed inset-0 z-10" onClick={() => setMoreMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-lg border border-[#E9ECEF] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button onClick={() => { refetchAll(); toast.success('Agenda atualizada'); setMoreMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><RefreshCw className="h-4 w-4 text-zinc-400" /> Atualizar agenda</button>
                <button onClick={() => { setMoreMenu(false); window.print(); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><List className="h-4 w-4 text-zinc-400" /> Imprimir</button>
                <button onClick={() => { setMoreMenu(false); router.push('/prazos'); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><CalendarClock className="h-4 w-4 text-zinc-400" /> Ver prazos</button>
              </div></>)}
          </div>
          <button onClick={() => setDispOpen(true)} className="flex h-9 items-center gap-1.5 rounded-md border border-[#DEE2E6] px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" title="Configurar meus horários de atendimento"><CalendarClock className="h-4 w-4 text-[#02883C]" /><span className="hidden sm:inline">Disponibilidade</span></button>
          <div className="relative">
            <button onClick={() => setAddMenu((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-md text-white hover:opacity-90" style={{ backgroundColor: ASTREA_BLUE }} title="Adicionar"><Plus className="h-5 w-5" /></button>
            {addMenu && (<><div className="fixed inset-0 z-10" onClick={() => setAddMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button onClick={() => openCreate('tarefa')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><ClipboardList className="h-4 w-4 text-[#23CBFF]" /> Tarefa</button>
                <button onClick={() => openCreate('prazo')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><Stamp className="h-4 w-4 text-[#CE0000]" /> Prazo</button>
                <button onClick={() => openCreate('evento')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><CalendarDays className="h-4 w-4 text-[#02883C]" /> Evento</button>
                <button onClick={() => openCreate('atendimento')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><CalendarClock className="h-4 w-4 text-[#B7791F]" /> Atendimento</button>
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

        {/* Minhas atribuições — só sócios trocam de pessoa; o associado fica travado
            nas próprias atribuições (não vê a agenda dos outros). */}
        {isSocio && (
        <div className="relative">
          <FilterBtn onClick={() => { setDAtribOpen(); setFAtrib((v) => !v); }} active={personId !== 'all'}>{personLabel}<ChevronDown className="h-3.5 w-3.5" /></FilterBtn>
          {fAtrib && (<><div className="fixed inset-0 z-10" onClick={() => setFAtrib(false)} />
            <div className="absolute left-0 top-11 z-20 w-[calc(100vw-2rem)] max-w-[420px] rounded-lg border border-[#DEE2E6] bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
        )}

        {/* Fonte: hub, Google ou os dois */}
        <div className="relative">
          <FilterBtn onClick={() => setFonteMenu((v) => !v)} active={fonte !== 'ambos'}>{FONTE_LABEL[fonte]}<ChevronDown className="h-3.5 w-3.5" /></FilterBtn>
          {fonteMenu && (<><div className="fixed inset-0 z-10" onClick={() => setFonteMenu(false)} />
            <div className="absolute left-0 top-11 z-20 w-48 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {(Object.keys(FONTE_LABEL) as FonteAgenda[]).map((f) => (
                <button key={f} onClick={() => pickFonte(f)} className={`block w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${fonte === f ? 'font-semibold text-[#228BE6]' : 'text-zinc-700 dark:text-zinc-300'}`}>{FONTE_LABEL[f]}</button>
              ))}
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
                <button onClick={() => { pickFiltros(dExibir, dStatus); setFAtiv(false); }} className="uppercase text-[#228BE6]">Aplicar</button>
              </div>
            </div></>)}
        </div>

        <TagFilterMenu open={fTags} onOpenChange={setFTags} selected={tagFilter} onChange={setTagFilter} onRecolored={refetchAll} />

        {searchOpen ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); } }} placeholder="Buscar tarefa, processo ou nº…" className="h-[38px] w-64 rounded-lg border border-[#E9ECEF] bg-white pl-9 pr-8 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} title="Fechar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setSearchOpen(true)} className={`flex h-[38px] w-[38px] items-center justify-center rounded-lg border bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 ${searchQuery ? 'border-[#228BE6] text-[#228BE6]' : 'border-[#E9ECEF] text-zinc-500'}`} title="Buscar"><Search className="h-4 w-4" /></button>
        )}
      </div>
      </div>

      {/* Conteúdo */}
      <div className="mt-4 flex flex-1 gap-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[#DEE2E6] bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-[#DEE2E6] px-4 py-3 dark:border-zinc-800">
            <div className="relative">
              {mode === 'list' ? (
                <span className="text-lg font-medium text-[#202124] dark:text-zinc-100">Hoje</span>
              ) : (
                <button onClick={() => setTitlePicker((v) => !v)} className="flex items-center gap-1 text-lg font-medium text-[#202124] hover:text-[#228BE6] dark:text-zinc-100">{capFirst(title)}<ChevronDown className="h-4 w-4" /></button>
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
          <div className={`flex-1 p-3 ${isMonth ? 'agenda-month' : ''}`}>
            {mode === 'list' ? (
              fonte === 'google'
                ? <p className="px-2 py-10 text-center text-sm text-zinc-500">Os eventos do Google aparecem nas visões por dia, por semana e por mês.</p>
                : <ActivityList activities={filtered} onOpen={openDetail} isUnseenNew={isUnseenNew} estaPronto={estaProntoNaoVisto} />
            ) : (
              <FullCalendar
                key={mode} ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={mode} locale={ptBrLocale} headerToolbar={false}
                // height auto = a grade rende INTEIRA (06h–22h) e quem rola é a
                // página (root), como no Astrea — sem scroll interno no calendário.
                height="auto" nowIndicator dayMaxEvents={isMonth ? 4 : true}
                slotMinTime="06:00:00" slotMaxTime="22:00:00" scrollTime="08:00:00"
                allDaySlot allDayText="Dia todo" eventDisplay="block" expandRows={!isMonth}
                // Mostra o horário só nos eventos COM hora (audiências/perícias) — igual
                // ao Astrea; tarefas/prazos são "dia todo" e não exibem hora.
                displayEventTime displayEventEnd={false}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                // Ordem no card do dia/popover: COMPROMISSOS (audiências, por horário)
                // primeiro, depois tarefas/prazos em aberto, e os cumpridos por último.
                eventOrder={['ordSort', 'start', 'title']}
                editable eventStartEditable eventDurationEditable={false} eventOverlap
                events={fcEvents}
                datesSet={(arg: DatesSetArg) => setTitle(arg.view.title)}
                dateClick={onDateClick} eventClick={onEventClick} eventDrop={onEventDrop}
                eventDidMount={(arg) => {
                  // A lista não usa blocos coloridos. Guarda o elemento e pinta a
                  // barra (re-pintada depois pelo efeito quando as tags chegam).
                  if (arg.view.type.startsWith('list')) return;
                  elMapRef.current.set(arg.event.id, arg.el);
                  const a = byId.get(arg.event.id);
                  if (a) renderEventStrip(arg.el, a, isCreatedToday(a) && !seenRef.current.has(a.id));
                }}
                eventWillUnmount={(arg) => { elMapRef.current.delete(arg.event.id); }}
              />
            )}
          </div>
        </div>
        {showSidePanel && (<div className="hidden w-[360px] shrink-0 self-start lg:block"><SidePanel activities={filtered} mode={mode} onOpen={openDetail} isUnseenNew={isUnseenNew} /></div>)}
      </div>

      {chooser && (
        <Modal onClose={() => setChooser(null)} title="O que deseja criar?">
          {chooser.date && <p className="mb-4 text-sm text-zinc-500">Para {chooser.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openCreate('tarefa', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#23CBFF] hover:bg-[#23CBFF]/5 dark:border-zinc-700"><ClipboardList className="h-7 w-7 text-[#23CBFF]" /><span className="text-sm font-medium">Tarefa</span></button>
            <button onClick={() => openCreate('prazo', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#CE0000] hover:bg-[#CE0000]/5 dark:border-zinc-700"><Stamp className="h-7 w-7 text-[#CE0000]" /><span className="text-sm font-medium">Prazo</span></button>
            <button onClick={() => openCreate('evento', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#02883C] hover:bg-[#02883C]/5 dark:border-zinc-700"><CalendarDays className="h-7 w-7 text-[#02883C]" /><span className="text-sm font-medium">Evento</span></button>
            <button onClick={() => openCreate('atendimento', chooser.date)} className="flex flex-col items-center gap-2 rounded-lg border border-[#DEE2E6] p-5 hover:border-[#B7791F] hover:bg-[#B7791F]/5 dark:border-zinc-700"><CalendarClock className="h-7 w-7 text-[#B7791F]" /><span className="text-sm font-medium">Atendimento</span></button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'evento' && <CreateEventDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {gDetalhe && (() => {
        const g = gDetalhe;
        const passou = googlePassou(g);
        const feito = googleFeitos.has(chaveGoogle(g)) || passou;
        const ini = new Date(g.diaInteiro ? `${g.inicio}T12:00:00` : g.inicio);
        const quando = g.diaInteiro
          ? `${ini.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · dia inteiro`
          : `${ini.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · ${ini.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${g.fim ? `–${new Date(g.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
        return (
          <Modal title="Compromisso do Google" onClose={() => setGDetalhe(null)}>
            <div className="space-y-3">
              <p className={`text-lg font-medium text-[#202124] dark:text-zinc-100 ${feito ? 'text-zinc-400 line-through' : ''}`}>{g.titulo}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{quando.charAt(0).toUpperCase() + quando.slice(1)}</p>
              {g.local && <p className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300"><MapPin className="h-4 w-4" />{g.local}</p>}
              <p className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: g.cor ?? '#4285F4' }} />{g.agenda}</p>
              <p className="text-xs text-zinc-400">{passou ? 'Já passou: aparece como feito no hub.' : 'Concluir aqui só risca no hub. No Google ele continua como está.'}</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {g.link && <a href={g.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><ExternalLink className="h-4 w-4" />Abrir no Google</a>}
              {!passou && <button onClick={() => { riscarGoogle(g, !feito); setGDetalhe(null); }} className={`inline-flex items-center gap-1 rounded px-4 py-2 text-sm font-bold uppercase tracking-wide ${feito ? 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800' : 'text-[#2F9E44] hover:bg-[#2F9E44]/10'}`}>
                {feito ? 'Reabrir' : <><Check className="h-4 w-4" />Concluir</>}
              </button>}
            </div>
          </Modal>
        );
      })()}
      {dialog?.type === 'tarefa' && <CreateTaskDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {dialog?.type === 'atendimento' && <CreateAtendimentoDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {dialog?.type === 'prazo' && <CreateDeadlineDialog date={dialog.date} onClose={() => setDialog(null)} onSaved={() => { refetchAll(); setDialog(null); }} />}
      {detailLive && <ActivityDetailModal activity={detailLive} onClose={() => setDetail(null)} onRefetch={refetchAll} onOpenCase={(id) => window.open(`/processos/${id}`, '_blank', 'noopener')} onOpenConversation={(id) => router.push(`/inbox?conversationId=${id}`)} />}
      {dispOpen && <DisponibilidadeModal onClose={() => setDispOpen(false)} />}
    </div>
  );

  function setDAtribOpen() { setDPerson(personId); }
}

function FilterBtn({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex h-[38px] items-center gap-2 rounded-lg border bg-white px-4 text-[13px] font-medium hover:bg-zinc-50 dark:bg-zinc-900 ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-[#E9ECEF] text-[#495057] dark:border-zinc-700 dark:text-zinc-300'}`}>{children}</button>
  );
}


// Menu de etiquetas da barra superior: FILTRA a agenda pelas etiquetas escolhidas
// e permite AJUSTAR A COR de cada etiqueta globalmente (clique no pingo de cor) —
// a cor nova reflete em todas as atividades (configuração global, scope=legal).
function TagFilterMenu({ open, onOpenChange, selected, onChange, onRecolored }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  selected: string[]; onChange: (ids: string[]) => void; onRecolored: () => void;
}) {
  const qc = useQueryClient();
  const tagsQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tags = tagsQ.data ?? [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const recolor = async (id: string, color: string) => {
    setBusy(true);
    try {
      await activitiesService.updateTag(id, { color });
      setPaletteFor(null);
      await qc.invalidateQueries({ queryKey: ['tags-available'] });
      await qc.invalidateQueries({ queryKey: ['activity-tags-index'] });
      onRecolored();
      toast.success('Cor da etiqueta atualizada');
    } catch (e: any) { toast.error(e?.message || 'Erro ao atualizar cor'); } finally { setBusy(false); }
  };
  return (
    <div className="relative">
      <button onClick={() => onOpenChange(!open)} title="Etiquetas" className={`flex h-[38px] items-center gap-1.5 rounded-lg border bg-white px-3 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 ${selected.length ? 'border-[#228BE6] text-[#228BE6]' : 'border-[#E9ECEF] text-zinc-500'}`}>
        <Tag className="h-4 w-4" />
        {selected.length > 0 && <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#228BE6] px-1 text-[10px] font-bold text-white">{selected.length}</span>}
      </button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => { onOpenChange(false); setPaletteFor(null); }} />
        <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-[#E9ECEF] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Filtrar por etiqueta</p>
            {selected.length > 0 && <button onClick={() => onChange([])} className="text-[11px] font-semibold text-[#228BE6] hover:underline">Limpar</button>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {tags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <div key={t.id}>
                  <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <button onClick={(e) => { e.stopPropagation(); setPaletteFor(paletteFor === t.id ? null : t.id); }} title="Alterar cor" className="h-3.5 w-3.5 shrink-0 rounded-full ring-offset-1 transition hover:ring-2 hover:ring-zinc-300 dark:ring-offset-zinc-900" style={{ backgroundColor: t.color }} />
                    <button onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-center justify-between text-left text-sm">
                      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{t.name}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-[#228BE6]" />}
                    </button>
                  </div>
                  {paletteFor === t.id && (
                    <div className="flex flex-wrap gap-1.5 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                      {TAG_PALETTE.map((c) => (
                        <button key={c} disabled={busy} onClick={() => recolor(t.id, c)} className={`h-5 w-5 rounded-full transition disabled:opacity-40 ${t.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-800' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {tags.length === 0 && <p className="px-3 py-3 text-xs text-zinc-400">Nenhuma etiqueta jurídica ainda.</p>}
          </div>
        </div></>)}
    </div>
  );
}

function TypeChip({ source }: { source: Src }) {
  const t = TYPE_TAG[source];
  return <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: t.bg }}>{t.label}</span>;
}

// Tirinhas coloridas das etiquetas (estilo Astrea) — só a cor; o nome vai no tooltip.
function TagStrip({ tags, max = 5 }: { tags: { id: string; name: string; color: string }[]; max?: number }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {tags.slice(0, max).map((t) => (
        <span key={t.id} title={t.name} className="inline-block h-2 w-5 rounded-full" style={{ backgroundColor: t.color }} />
      ))}
      {tags.length > max && <span className="text-[10px] text-zinc-400">+{tags.length - max}</span>}
    </span>
  );
}

function ActivityList({ activities, onOpen, isUnseenNew, estaPronto }: { activities: Activity[]; onOpen: (a: Activity) => void; isUnseenNew: (a: Activity) => boolean; estaPronto: (a: Activity) => boolean }) {
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
            <div className="w-24 shrink-0 text-xs text-zinc-500">{new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', ...(a.hasTime ? {} : { timeZone: 'UTC' as const }) })}{a.hasTime && <div className="font-medium text-zinc-700 dark:text-zinc-300">{new Date(a.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}</div>
            <div className="min-w-0 flex-1">
              <p className={`flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#202124] dark:text-zinc-100 ${a.done ? 'text-zinc-400 line-through' : ''}`}>{isUnseenNew(a) && <span title="Adicionado hoje" className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#FA5252]" />}{estaPronto(a) && <span title="A peça ficou pronta — abra a tarefa para ver" className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#2F9E44]" />}<span className="truncate">{a.title}</span></p>
              {a.caseTitle && <p className="truncate text-xs text-zinc-500">{a.caseTitle}{a.cnj ? ` · ${a.cnj}` : ''}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><TypeChip source={a.source} /><TagStrip tags={a.tags} /></div>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{initials(a.responsibleName)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SidePanel({ activities, mode, onOpen, isUnseenNew }: { activities: Activity[]; mode: ViewMode; onOpen: (a: Activity) => void; isUnseenNew: (a: Activity) => boolean }) {
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
            {dayList.map((a) => (<button key={a.id} onClick={() => onOpen(a)} className="block w-full min-w-0 text-left text-sm"><p className={`flex min-w-0 items-center gap-1.5 font-medium text-[#202124] dark:text-zinc-100 ${a.done ? 'text-zinc-400 line-through' : ''}`}>{isUnseenNew(a) && <span title="Adicionado hoje" className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#FA5252]" />}<span className="truncate">{a.title}</span></p>{a.caseTitle && <p className="truncate text-xs text-zinc-500">{a.caseTitle}</p>}<span className="mt-1 inline-block"><TypeChip source={a.source} /></span></button>))}
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


