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
import type { EventInput, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, MapPin, RefreshCw,
  MoreVertical, Search, Tag, Check, CalendarClock, ExternalLink, CalendarDays,
  ClipboardList, Pencil, MessageSquare, Paperclip, List, MessageCircle,
  Stamp,
} from 'lucide-react';
import { toast } from 'sonner';
import { calendarService, type CalendarEvent, type EventKind } from '@/features/calendar/services/calendar.service';
import { deadlinesService, type Deadline, type PrazoPreview } from '@/features/deadlines/services/deadlines.service';
import { tasksService, type Task } from '@/features/tasks/services/tasks.service';
import { membersService } from '@/features/settings/services/members.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { recursosService, type Recurso } from '@/features/recursos/services/recursos.service';
import { AvancoFaseModal } from '@/features/legal-cases/components/avanco-fase-modals';
import { CommentsSection } from '@/features/activities/components/comments-section';
import { AnexosSection } from '@/features/activities/components/anexos-section';
import { ArquivarPecaModal } from '@/features/legal-cases/components/arquivar-peca-modal';
import { MoverFaseManual } from '@/features/legal-cases/components/mover-fase-manual';
import { DisponibilidadeModal } from '@/features/calendar/components/disponibilidade-modal';
import { preferencesService } from '@/features/inbox/services/preferences.service';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
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
const KIND_LABEL: Record<EventKind, string> = { audiencia: 'Audiência', reuniao: 'Reunião', pericia: 'Perícia', tarefa: 'Tarefa', atendimento: 'Atendimento', outro: 'Outro' };
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };

type ViewMode = 'list' | 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
const VIEW_LABEL: Record<ViewMode, string> = { list: 'Em lista', timeGridDay: 'Por dia', timeGridWeek: 'Por semana', dayGridMonth: 'Por mês' };
const VIEW_KEY = 'agenda:view';

type StatusFilter = 'todas' | 'aconcluir' | 'concluidas' | 'canceladas';
const STATUS_VALUES: StatusFilter[] = ['todas', 'aconcluir', 'concluidas', 'canceladas'];
const STATUS_KEY = 'agenda:status';
type ExibirFilter = { tarefas: boolean; eventos: boolean };
const EXIBIR_KEY = 'agenda:exibir';
// Só aceita o que tem a forma certa (localStorage/prefs podem vir de versão antiga).
const parseExibir = (v: unknown): ExibirFilter | null =>
  v && typeof v === 'object'
    && typeof (v as ExibirFilter).tarefas === 'boolean'
    && typeof (v as ExibirFilter).eventos === 'boolean'
    ? { tarefas: (v as ExibirFilter).tarefas, eventos: (v as ExibirFilter).eventos }
    : null;

const pad = (n: number) => String(n).padStart(2, '0');
const toDatetimeLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const initials = (name: string | null) => { if (!name) return 'Eu'; const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'Eu'; };
// Capitaliza só a 1ª letra (mantém "de/da" minúsculos). A classe CSS `capitalize`
// deixava "junho de 2026" → "Junho De 2026"; aqui vira "Junho de 2026".
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// Encurta o nome do RÉU institucional p/ a SIGLA nos cards de prazo/tarefa (não muda
// o cadastro — é só exibição). Conservador: só corta em padrões claros e NUNCA mexe
// em banco simples ("BANCO BMG S/A" fica igual). Ver varredura 13/08 (256 cases).
function shortenReu(raw: string): string {
  let s = (raw || '').trim();
  s = s.replace(/\s*[-–]\s*CNPJ[:\s].*$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim(); // tira "- CNPJ …" e "(…)"
  // "SIGLA – EXPANSÃO institucional/financeira" → SIGLA (ex.: "ANDDAP – ASSOCIAÇÃO…",
  // "AGI FINANCEIRA S.A - SOCIEDADE DE CRÉDITO…", "SINDIAPI UGT – SINDICATO…").
  let m = s.match(/^(.{2,24}?)\s*[-–]\s*(?:ASSOCIA|SINDICAT|SIND\b|INSTITUT|SOCIEDADE|FUNDA|COOPERATIV|FEDERA|ASS\.)/i);
  if (m) return m[1].trim();
  // "NOME COMPLETO - SIGLA" (sigla curta ao final, ex.: "INSTITUTO … - INSS").
  m = s.match(/[-–]\s*([A-ZÀ-Ú]{2,8})\s*$/);
  if (m) return m[1];
  return s;
}
const SEEN_NEW_KEY = 'agenda:seenNew';

interface Activity {
  id: string; source: Src; rawId: string; title: string; date: string;
  endDate: string | null; // fim do evento (só eventos com hora) — dá altura no timeGrid
  triggerDate: string | null; // disponibilização (base p/ contar prazo de recurso da sentença)
  tags: { id: string; name: string; color: string }[];
  coResponsibleIds: string[]; // responsáveis extras (metadata.coResponsibleIds)
  // Antecedências dos lembretes (min). null = não configurado (usa padrão 1 dia +
  // 1 hora); [] = sem aviso; só eventos têm. Prazos/tarefas ficam null.
  reminders: number[] | null;
  createdAt: string | null; // p/ marcar como "novo" (adicionado hoje)
  hasTime: boolean; done: boolean; cancelled: boolean; fatal: boolean;
  caseId: string | null; caseTitle: string | null; cnj: string | null;
  responsibleId: string | null; responsibleName: string | null; createdName: string | null;
  priorityLabel: string | null; completedAt: string | null; description: string | null;
  // Valores CRUS (não o rótulo) — o formulário de edição precisa deles.
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null; // tarefa
  deadlineType: 'FATAL' | 'ORDINARY' | 'INTERNAL' | null; // prazo
  kind: EventKind | null; // evento
  prazoFatal: string | null; recorte: string | null; tipoPublicacao: string | null;
  faseMovida: { de: string; para: string } | null; dispositivo: string | null;
  // Ação DJEN + sugestão de recurso (espécie/quem/motivo) já extraída pela IA —
  // pré-preenche o mini-form de "registrar recurso" ao concluir o prazo.
  djenAction: string | null;
  recursoSugestao: { especie: string | null; parteRecorrente: string | null; motivo: string | null } | null;
  // Réplica: outras ações do mesmo cliente (mesmo banco em destaque) — pra
  // impugnar o contrato certo (o banco junta os documentos de todos na defesa).
  processosRelacionados: Array<{
    caseId: string; cnj: string | null; title: string; area: string | null;
    legalPhase: string | null; status: string; banco: string | null; mesmoBanco: boolean;
  }> | null;
}

// Espécies de recurso (para o dropdown do mini-form). Texto livre no backend.
const ESPECIES_RECURSO = ['Apelação', 'Agravo de Instrumento', 'Agravo Interno', 'Embargos de Declaração', 'Recurso Especial', 'Recurso Extraordinário', 'Recurso Inominado', 'Recurso Ordinário', 'Agravo em REsp'];

// Deduz a espécie do recurso a partir do título/descrição do prazo (fallback quando
// a IA não gravou a sugestão — ex.: prazos antigos). Devolve '' se não reconhecer.
function especieDoPrazo(a: Activity): string {
  const s = `${a.title} ${a.description ?? ''} ${a.djenAction ?? ''}`.toLowerCase();
  if (/agravo de instrumento/.test(s)) return 'Agravo de Instrumento';
  if (/agravo interno/.test(s)) return 'Agravo Interno';
  if (/agravo em resp|agravo em recurso especial/.test(s)) return 'Agravo em REsp';
  if (/agravo/.test(s)) return 'Agravo de Instrumento';
  if (/embargos de declara|embargo de declara/.test(s)) return 'Embargos de Declaração';
  if (/recurso especial|\bresp\b/.test(s)) return 'Recurso Especial';
  if (/recurso extraordin|\bre\b/.test(s)) return 'Recurso Extraordinário';
  if (/inominado/.test(s)) return 'Recurso Inominado';
  if (/recurso ordinario/.test(s)) return 'Recurso Ordinário';
  if (/apela/.test(s)) return 'Apelação';
  return '';
}

// Um prazo é "de recurso" (abre o mini-form ao concluir) quando é uma intimação
// DJEN cuja ação/rótulo indica interposição de recurso. Contrarrazões conta como
// recurso da parte ADVERSA (quem recorreu = adversa).
function isRecursoPrazo(a: Activity): boolean {
  if (a.source !== 'prazo') return false;
  const act = (a.djenAction ?? '').toLowerCase();
  if (['apelacao', 'agravo', 'embargos', 'recurso', 'contrarrazoes'].includes(act)) return true;
  // fallback por texto (prazos antigos sem `action` gravada)
  return !!especieDoPrazo(a) || /contrarraz|contraminuta/i.test(`${a.title} ${a.description ?? ''}`);
}

// ── Kanban vivo: ao CONCLUIR um prazo (= protocolamos nossa petição), o card
// avança pra fase correspondente ao que fizemos. Alguns avanços têm mais de um
// destino (ex.: na especificação de provas, escolhemos perícia × instrução ×
// julgamento antecipado). Recurso tem fluxo próprio (mini-form com espécie/motivo).
type AvancoOpt = { label: string; phase: string };
type Avanco =
  | { kind: 'recurso' }
  | { kind: 'move'; title: string; subtitle: string; options: AvancoOpt[] }
  | { kind: 'fase'; phase: 'cumprimento' | 'prestacao_contas' | 'transito' }
  | null;

function avancoDoPrazo(a: Activity): Avanco {
  if (a.source !== 'prazo' || !a.caseId) return null;
  const act = (a.djenAction ?? '').toLowerCase();
  // Tarefa de ANALISAR a decisão (sentença/acórdão) conclui SECO — sem mini-form
  // de recurso nem avanço de kanban. O fluxo é: no card da análise cria-se o
  // PRAZO DE RECURSO (bloco "Criar prazo de recurso"); é ao cumprir ESSE prazo
  // que o mini-form abre e o card vai pro kanban (14. RECURSO). Sem este guard,
  // o texto da análise ("avaliar embargos/agravo interno/REsp…") enganava o
  // fallback por texto do isRecursoPrazo e concluir a análise reabria o registro
  // de recurso — redundante com o prazo já criado.
  if (act === 'sentenca' || act === 'acordao') return null;
  if (/^analisar\s+(a\s+)?(senten[çc]a|ac[óo]rd[ãa]o|decis[ãa]o)/i.test(a.title.trim())) return null;
  if (isRecursoPrazo(a)) return { kind: 'recurso' };
  const txt = `${a.title} ${a.description ?? ''}`.toLowerCase();
  // Fases pós-sentença com preenchimento (cumprimento/prestação/trânsito).
  if (act === 'cumprimento' || /cumprimento de senten|inicie o cumprimento|iniciar o cumprimento/.test(txt)) {
    return { kind: 'fase', phase: 'cumprimento' };
  }
  // Prazo que já é de PRESTAR CONTAS → abre a Prestação de Contas.
  if (/prestar contas|presta[çc][ãa]o de contas/.test(txt)) {
    return { kind: 'fase', phase: 'prestacao_contas' };
  }
  // "Requerer expedição de alvará" é só o PEDIDO — o dinheiro ainda não caiu e o
  // valor muda quando o alvará é de fato expedido. Concluir MANTÉM o card em
  // Cumprimento de Sentença. A Prestação de Contas só quando os valores entram em
  // conta: aí abra o card e use o botão "Prestação de contas" (sobe o comprovante,
  // calcula o rateio e move a fase).
  if (act === 'alvara' || /alvar[áa]|levantament/.test(txt)) {
    return null;
  }
  if (/certid[ãa]o de tr[âa]nsito|transit(?:ou|ada|ado) em julgado/.test(txt)) {
    return { kind: 'fase', phase: 'transito' };
  }
  // Réplica protocolada → Especificação de provas.
  if (act === 'replica' || /r[ée]plica|impugna\w*[^.]{0,20}contesta/.test(txt)) {
    return {
      kind: 'move',
      title: 'Concluir réplica',
      subtitle: 'Protocolamos a réplica — o card vai para Especificação de provas.',
      options: [{ label: 'Especificação de provas', phase: 'provas' }],
    };
  }
  // Especificação de provas protocolada → conforme o que requeremos.
  if (act === 'provas' || /especifica\w*[^.]{0,20}prova|prova\w*[^.]{0,20}especifica/.test(txt)) {
    return {
      kind: 'move',
      title: 'Especificação de provas',
      subtitle: 'O que requeremos? O card avança conforme.',
      options: [
        { label: 'Perícia', phase: 'pericia' },
        { label: 'Audiência de instrução', phase: 'aud_instrucao' },
        { label: 'Julgamento antecipado', phase: 'aguardando_sentenca' },
      ],
    };
  }
  // Alegações finais → aguardando sentença.
  if (act === 'alegacoes' || /alega\w*[^.]{0,10}finais|memoria(l|is)|raz[õo]es finais/.test(txt)) {
    return {
      kind: 'move',
      title: 'Alegações finais',
      subtitle: 'Protocolamos as alegações finais — o processo fica concluso para sentença.',
      options: [{ label: 'Aguardando sentença', phase: 'aguardando_sentenca' }],
    };
  }
  return null;
}

// Extrai a EMENTA do acórdão (do marcador "EMENTA" em diante, ~3000 chars) —
// espelha extractEmenta() do backend p/ exibir a tese quando a decisão é de 2º grau.
function extractEmentaClient(texto?: string | null): string | null {
  const t = (texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const m = t.match(/\bement[ao]\b\s*[:\-–]?/i);
  if (!m || m.index == null) return null;
  return t.slice(m.index).trim().slice(0, 3000);
}
// Sinais de que a decisão é um ACÓRDÃO / decisão de 2º grau (recursos diferentes
// da sentença: REsp/RE, Embargos de Declaração, Agravo Interno).
const ACORDAO_MARKER = /ac[óo]rd[ãa]o|acordam|c[âa]mara|desembargador|turma recursal|negaram provimento|deram (parcial )?provimento|rela(tor|tora)|2º grau|2o grau|segundo grau|segunda inst[âa]ncia/i;

// Texto longo (recorte da publicação, dispositivo) com "ver mais/ver menos":
// mostra só um trecho por padrão e expande sob demanda.
function ExpandableText({ text, limit = 480 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  const shown = open || !long ? text : `${text.slice(0, limit).trimEnd()}…`;
  return (
    <>
      {shown}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-1 whitespace-nowrap font-medium text-[#005efc] hover:underline dark:text-[#4a90e2]"
        >
          {open ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </>
  );
}

// Desenha a barra colorida no topo do evento (estilo Astrea): 1 segmento por
// ETIQUETA, dividido igualmente; sem etiqueta usa a cor do TIPO; cumprido fica
// cinza. Idempotente (remove a barra anterior) — assim dá pra repintar quando as
// etiquetas, que carregam de forma assíncrona, chegam depois do mount do evento.
function renderEventStrip(el: HTMLElement, a: Activity, isNew = false) {
  el.querySelector(':scope > .ag-tagstrip')?.remove();
  el.querySelector(':scope > .ag-newdot')?.remove();
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
  if (isNew) {
    const dot = document.createElement('span');
    dot.className = 'ag-newdot';
    dot.title = 'Adicionado hoje';
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
  const patchAgendaPrefs = (partial: { view?: ViewMode; seenNew?: string[]; status?: StatusFilter; exibir?: ExibirFilter }) => {
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

  const from = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString(); }, []);
  const to = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString(); }, []);

  // O escopo do associado é feito no BACKEND (calendar/deadlines/tasks já filtram
  // por responsável + co-responsável quando o usuário não é sócio) — não passamos
  // assignedToId aqui pra não estreitar demais (perderia os itens de co-responsável
  // do calendar). O filtro client-side abaixo trava a visão do AGENT em si mesmo.
  const evQ = useQuery({ queryKey: ['calendar', 'agenda'], queryFn: () => calendarService.list({ from, to }) });
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
      const ddj = d.metadata?.djen;
      out.push({
        // Mostra no PRAZO DE SEGURANÇA (safeDate); o fatal vai no campo "Prazo fatal".
        id: 'd_' + d.id, source: 'prazo', rawId: d.id, title: d.title, date: d.safeDate ?? d.dueDate,
        endDate: null,
        triggerDate: d.triggerDate ?? null,
        tags: tagMap.get('deadline:' + d.id) ?? [],
        coResponsibleIds: (d.metadata as any)?.coResponsibleIds ?? [],
        reminders: null,
        createdAt: d.createdAt ?? null,
        hasTime: false, done: d.status === 'DONE', cancelled: d.status === 'CANCELLED', fatal: d.type === 'FATAL',
        caseId: d.case?.id ?? null, caseTitle: d.case?.title ?? null, cnj: d.case?.cnjNumber ?? null,
        responsibleId: d.assignedTo?.id ?? null, responsibleName: d.assignedTo?.name ?? null,
        createdName: null, priorityLabel: null, completedAt: null, description: ddj?.descricao ?? null,
        priority: null, deadlineType: d.type, kind: null,
        prazoFatal: d.dueDate, recorte: ddj?.recorte ?? null, tipoPublicacao: ddj?.tipoPublicacao ?? null,
        faseMovida: ddj?.faseMovida ?? null, dispositivo: ddj?.dispositivo ?? null,
        djenAction: (ddj as any)?.action ?? null, recursoSugestao: (ddj as any)?.recurso ?? null,
        processosRelacionados: (ddj as any)?.processosRelacionados ?? null,
      });
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
        prazoFatal: null, recorte: null, tipoPublicacao: null,
        faseMovida: null, dispositivo: null,
        djenAction: null, recursoSugestao: null, processosRelacionados: null,
      });
    }
    return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [tkQ.data, dlQ.data, evQ.data, userMap, tagMap]);

  // O painel de detalhe recebe SEMPRE a versão FRESCA da atividade — `detail` é só
  // um snapshot do clique. Sem isto, editar (processo, prioridade, descrição…) só
  // aparecia depois de fechar e reabrir o card.
  const detailLive = useMemo(() => (detail ? activities.find((a) => a.id === detail.id) ?? detail : null), [detail, activities]);

  const q = searchQuery.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const filtered = useMemo(() => activities.filter((a) => {
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
  }), [activities, exibir, status, personId, tagFilter, q, qDigits]);

  const byId = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);
  // Repinta a barra do topo de cada evento já montado quando as etiquetas/filtro
  // mudam — as tags carregam async, depois do mount, e sem isto a barra ficava
  // presa na cor do tipo (a divisão por etiqueta "não funcionava").
  useEffect(() => {
    for (const [id, el] of elMapRef.current) {
      const a = byId.get(id);
      if (a) renderEventStrip(el, a, isCreatedToday(a) && !seenNew.has(a.id));
    }
  }, [byId, seenNew]);
  // A bolinha de "novo" só some quando o usuário ABRE a atividade (openDetail →
  // markSeen). Nada de auto-marcar por "só ter olhado a agenda": o Matheus quer que
  // a bolinha fique até ele clicar na tarefa.
  const fcEvents = useMemo<EventInput[]>(() => filtered.map((a) => {
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
      startEditable: !a.cancelled, // tarefas/eventos/prazos arrastáveis (no prazo move a data de execução; a fatal é legal e fica na ficha)
      // ordSort define a ordem no card do dia/popover (ver eventOrder):
      //   0 = COMPROMISSO em aberto (audiência/evento c/ hora) → sempre primeiro, por horário;
      //   1 = tarefa/prazo em aberto (dia todo); 2 = cumprido/cancelado → por último.
      extendedProps: { ordSort: (a.done || a.cancelled) ? 2 : (a.hasTime ? 0 : 1) },
    };
  }), [filtered, personId]);

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
  const openDetail = (a: Activity) => { markSeen(a.id); setDetail(a); };
  const isUnseenNew = (a: Activity) => isCreatedToday(a) && !seenNew.has(a.id);
  const onEventClick = (arg: EventClickArg) => { const a = byId.get(arg.event.id); if (a) openDetail(a); };
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
              <ActivityList activities={filtered} onOpen={openDetail} isUnseenNew={isUnseenNew} />
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

const TAG_PALETTE = ['#E03131', '#F76707', '#F59F00', '#2F9E44', '#228BE6', '#7048E8', '#868E96', '#CE0000', '#23CBFF', '#02883C'];

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
        <span className="text-sm font-medium text-[#202124] dark:text-zinc-100">{capFirst(cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</span>
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

function ActivityList({ activities, onOpen, isUnseenNew }: { activities: Activity[]; onOpen: (a: Activity) => void; isUnseenNew: (a: Activity) => boolean }) {
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
              <p className={`flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#202124] dark:text-zinc-100 ${a.done ? 'text-zinc-400 line-through' : ''}`}>{isUnseenNew(a) && <span title="Adicionado hoje" className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#FA5252]" />}<span className="truncate">{a.title}</span></p>
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

function Modal({ title, children, onClose, wide, headerRight }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; headerRight?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-50 w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <div className="flex items-center gap-1">
            {headerRight}
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Edição COMPLETA da atividade (o lápis "Editar" do card) ──────────────────
// Antes só dava pra trocar o título. Aqui edita tudo o que a atividade tem, por
// tipo: tarefa (processo, responsável, prioridade, data/hora, descrição), prazo
// (processo, responsável, tipo, prazo de segurança, prazo FATAL, intimação,
// descrição) e evento (processo, responsável, tipo, início/fim, local, lembretes).
// Os co-responsáveis e as etiquetas seguem no painel (já eram editáveis lá).
function ActivityEditForm({ activity, onCancel, onSaved }: { activity: Activity; onCancel: () => void; onSaved: () => void }) {
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const { data: casesRaw = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  // O processo atual pode estar arquivado (fora da lista ACTIVE) — injeta pra não
  // "sumir" da busca e a edição acabar desvinculando sem querer.
  const cases = useMemo(() => {
    const list = casesRaw.map((c) => ({ id: c.id, title: c.title, cnjNumber: c.cnjNumber ?? null }));
    if (activity.caseId && !list.some((c) => c.id === activity.caseId)) {
      list.unshift({ id: activity.caseId, title: activity.caseTitle ?? 'Processo vinculado', cnjNumber: activity.cnj });
    }
    return list;
  }, [casesRaw, activity.caseId, activity.caseTitle, activity.cnj]);

  const d0 = new Date(activity.date);
  // Data-pura (tarefa/prazo sem hora) é gravada em UTC → lê o dia UTC. Item com
  // hora real (evento) usa os componentes LOCAIS.
  const dayOf = (iso: string | null, hasTime: boolean) => (!iso ? '' : hasTime ? toDateInput(new Date(iso)) : iso.slice(0, 10));

  const [title, setTitle] = useState(activity.title);
  const [caseId, setCaseId] = useState(activity.caseId ?? '');
  const [assigneeId, setAssigneeId] = useState(activity.responsibleId ?? '');
  const [descricao, setDescricao] = useState(activity.source === 'evento' ? '' : (activity.description ?? ''));
  // tarefa
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(activity.priority ?? 'MEDIUM');
  const [dia, setDia] = useState(dayOf(activity.date, activity.hasTime));
  const [hora, setHora] = useState(activity.source === 'tarefa' && activity.hasTime ? `${pad(d0.getHours())}:${pad(d0.getMinutes())}` : '');
  // prazo
  const [tipoPrazo, setTipoPrazo] = useState<'FATAL' | 'ORDINARY' | 'INTERNAL'>(activity.deadlineType ?? 'ORDINARY');
  const [safeDia, setSafeDia] = useState(dayOf(activity.date, false));
  const [fatalDia, setFatalDia] = useState(dayOf(activity.prazoFatal, false));
  const [trigDia, setTrigDia] = useState(dayOf(activity.triggerDate, false));
  // evento
  const [kind, setKind] = useState<EventKind>(activity.kind ?? 'outro');
  const [startsAt, setStartsAt] = useState(activity.source === 'evento' ? toDatetimeLocal(d0) : '');
  const [endsAt, setEndsAt] = useState(activity.endDate ? toDatetimeLocal(new Date(activity.endDate)) : '');
  const [local, setLocal] = useState(activity.source === 'evento' ? (activity.description ?? '') : '');
  const [reminders, setReminders] = useState<number[]>(activity.reminders ?? [1440, 60]);

  const [saving, setSaving] = useState(false);
  // Dia (YYYY-MM-DD) → ISO às 09:00 LOCAL: a hora canônica dos itens "dia todo" do
  // app (meia-noite local virava 03:00Z e jogava o item pro dia anterior).
  const diaISO = (v: string) => new Date(`${v}T09:00:00`).toISOString();

  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (activity.source === 'prazo' && !caseId) return toast.error('Prazo precisa de um processo vinculado');
    if (activity.source === 'prazo' && (!safeDia || !fatalDia)) return toast.error('Informe o prazo de segurança e o prazo fatal');
    if (activity.source === 'evento' && !startsAt) return toast.error('Informe a data e hora');
    setSaving(true);
    try {
      if (activity.source === 'tarefa') {
        await tasksService.update(activity.rawId, {
          title: title.trim(),
          description: descricao.trim() || null,
          priority,
          dueAt: dia ? new Date(`${dia}T${hora || '09:00'}:00`).toISOString() : null,
          assigneeId: assigneeId || null,
          caseId: caseId || null,
        });
      } else if (activity.source === 'prazo') {
        await deadlinesService.update(activity.rawId, {
          title: title.trim(),
          type: tipoPrazo,
          caseId,
          assignedToId: assigneeId, // '' = tira o responsável
          safeDate: diaISO(safeDia),
          dueDate: diaISO(fatalDia),
          ...(trigDia ? { triggerDate: diaISO(trigDia) } : {}),
          descricao: descricao.trim(),
        });
      } else {
        await calendarService.update(activity.rawId, {
          title: title.trim(),
          kind,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          location: local,
          caseId, // '' = desvincula
          assignedToId: assigneeId,
          reminders,
        });
      }
      toast.success('Atividade atualizada');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <div className="mb-4 rounded-lg border border-[#DEE2E6] bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Editar {TYPE_TAG[activity.source].label.toLowerCase()}</p>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={activity.source === 'prazo' ? <>Processo <span className="text-rose-500">*</span></> : 'Processo'}><CaseSearch value={caseId} onChange={setCaseId} cases={cases} /></Field>
          <Field label="Responsável">
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
              <option value="">Ninguém</option>
              {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </select>
          </Field>
        </div>

        {activity.source === 'tarefa' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prioridade"><select value={priority} onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')} className={inputCls}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></select></Field>
              <Field label="Data"><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={inputCls} /></Field>
              <Field label="Hora (opcional)"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Descrição"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className={`${inputCls} resize-y`} /></Field>
          </>
        )}

        {activity.source === 'prazo' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo do prazo"><select value={tipoPrazo} onChange={(e) => setTipoPrazo(e.target.value as 'FATAL' | 'ORDINARY' | 'INTERNAL')} className={inputCls}><option value="FATAL">Fatal (peremptório)</option><option value="ORDINARY">Ordinário</option><option value="INTERNAL">Interno</option></select></Field>
              <Field label="Intimação / disponibilização"><input type="date" value={trigDia} onChange={(e) => setTrigDia(e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={<>Prazo de segurança <span className="text-rose-500">*</span></>}><input type="date" value={safeDia} onChange={(e) => setSafeDia(e.target.value)} className={inputCls} /></Field>
              <Field label={<>Prazo fatal <span className="text-rose-500">*</span></>}><input type="date" value={fatalDia} onChange={(e) => setFatalDia(e.target.value)} className={inputCls} /></Field>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">O prazo de segurança é a data que aparece na agenda; o <span className="font-medium text-rose-600 dark:text-rose-400">fatal</span> é a data legal. Mexer aqui é ajuste MANUAL — não recalcula dias úteis.</p>
            <Field label="Descrição"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className={`${inputCls} resize-y`} /></Field>
          </>
        )}

        {activity.source === 'evento' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>{(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
              <Field label={<>Início <span className="text-rose-500">*</span></>}><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fim (opcional)"><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} /></Field>
              <Field label="Local"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={local} onChange={(e) => setLocal(e.target.value)} className={`${inputCls} pl-9`} placeholder="Fórum, sala, link…" /></div></Field>
            </div>
            <Field label="Lembretes"><RemindersField value={reminders} onChange={setReminders} /></Field>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-1">
        <button onClick={onCancel} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
        <button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </div>
  );
}

// ── Detalhe da atividade (layout estilo Astrea: checkbox+título, dados, abas) ──
function ActivityDetailModal({ activity, onClose, onRefetch, onOpenCase, onOpenConversation }: { activity: Activity; onClose: () => void; onRefetch: () => void; onOpenCase: (id: string) => void; onOpenConversation: (convId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(activity.done);
  const [cancelled, setCancelled] = useState(activity.cancelled);
  const [dateISO, setDateISO] = useState(activity.date);
  const [reMenu, setReMenu] = useState(false);
  const [miniCal, setMiniCal] = useState(false);
  const [optMenu, setOptMenu] = useState(false);
  const [respMenu, setRespMenu] = useState(false);
  const [respId, setRespId] = useState(activity.responsibleId);
  const [respName, setRespName] = useState(activity.responsibleName);
  const [prazoBusy, setPrazoBusy] = useState(false);
  const [naoRecorrerOpen, setNaoRecorrerOpen] = useState(false); // "não vamos recorrer" (decisão)
  const [motivoNR, setMotivoNR] = useState('');
  const [remessaOpen, setRemessaOpen] = useState(false); // "recurso provido → remessa à origem" (acórdão)
  const [remessaFase, setRemessaFase] = useState('aguardando_sentenca'); // fase de retorno na origem
  const [remessaObs, setRemessaObs] = useState('');
  const [recursoForm, setRecursoForm] = useState(false); // mini-form "registrar recurso"
  // "Concluir e arquivar": leva a peça para a pasta do cliente ANTES de rodar a
  // conclusão normal (que, no prazo, ainda abre o mini-form de recurso/kanban).
  const [arquivarForm, setArquivarForm] = useState(false);
  const [avancoForm, setAvancoForm] = useState<Avanco>(null); // modal de avanço de fase (kanban vivo)
  const [faseForm, setFaseForm] = useState<'cumprimento' | 'prestacao_contas' | 'transito' | null>(null);
  // Fase encadeada (ex.: trânsito → ações vencidas/perdidas) — SEM prazo, só caseId.
  const [faseExtra, setFaseExtra] = useState<'acoes_vencidas' | 'acoes_perdidas' | null>(null);
  const { isSocio: souSocio } = usePermissions();
  const [coIds, setCoIds] = useState<string[]>(activity.coResponsibleIds ?? []);
  const [coMenu, setCoMenu] = useState(false);
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const d = new Date(dateISO);

  // Atividade de ANÁLISE DE DECISÃO (sentença OU acórdão) → oferece criar o prazo
  // do recurso já contado da disponibilização. Sentença (1º grau) → Apelação/ED;
  // acórdão (2º grau) → REsp/RE, Embargos de Declaração, Agravo Interno.
  const isDecisaoBase = !!activity.caseId
    && (activity.source === 'prazo' || activity.source === 'tarefa');
  const isDecisaoTitulo = /senten[çc]a|ac[óo]rd[ãa]o|decis[ãa]o/i.test(activity.title);

  const assignResp = async (userId: string | null) => {
    setRespMenu(false);
    if (activity.source !== 'tarefa' && activity.source !== 'prazo') return;
    const prev = { id: respId, name: respName };
    setRespId(userId);
    setRespName(userId ? members.find((m) => m.user.id === userId)?.user.name ?? null : null);
    try {
      if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { assigneeId: userId });
      else await deadlinesService.update(activity.rawId, { assignedToId: userId ?? undefined });
      toast.success('Responsável atualizado'); onRefetch();
    } catch (e: any) { setRespId(prev.id); setRespName(prev.name); toast.error(e?.message || 'Erro ao atribuir'); }
  };

  // Co-responsáveis (extras) — vale p/ tarefa, prazo E evento.
  const saveCoResponsibles = async (ids: string[]) => {
    const prev = coIds;
    setCoIds(ids);
    try {
      await activitiesService.setCoResponsibles(ENTITY_TYPE[activity.source], activity.rawId, ids);
      onRefetch();
    } catch (e: any) { setCoIds(prev); toast.error(e?.message || 'Erro ao salvar co-responsáveis'); }
  };
  const toggleCo = (uid: string) => saveCoResponsibles(coIds.includes(uid) ? coIds.filter((x) => x !== uid) : [...coIds, uid]);

  // Puxa a ficha do processo p/ montar "Cliente x Parte | 1º Grau - Comarca - Área".
  const caseQ = useQuery({ queryKey: ['legal-case', 'agenda', activity.caseId], queryFn: () => legalCasesService.get(activity.caseId!), enabled: !!activity.caseId });
  const inst = (caseQ.data?.metadata as { astrea?: { raw?: Record<string, string> } } | undefined)?.astrea?.raw?.['Instância Atual'];
  const grade = inst ? `${String(inst).replace(/\D/g, '')}º Grau` : null;
  // Réu vem das PARTES (fonte da verdade): muitos cards do Pipefy têm título só com
  // o cliente ("NILSON ROBERTO DE SOUZA") e o réu (ex.: BANCO BMG) fica nas partes.
  // Compõe "Cliente x Réu" quando ambos existem; senão cai no título do processo.
  const clientParty = caseQ.data?.parties?.find((p) => p.role === 'CLIENT')?.name;
  const opponentParty = caseQ.data?.parties?.find((p) => p.role === 'OPPONENT')?.name;
  // Rótulo do processo no card: partes em CAPS, " x " minúsculo. Título CURADO
  // ("CLIENTE x SIGLA") tem PRIORIDADE — quando o réu tem sigla, o título já a traz
  // (ex.: "… x ASTEBA"), evitando o nome-monstro da parte ("ASSOCIACAO DOS SERVIDORES
  // TECNICO-ADMINISTRATIVO … - CNPJ …"). Sem " x " no título (cards do Pipefy = só
  // cliente), compõe de CLIENT x OPPONENT das partes.
  const rawLabel = (activity.caseTitle && /\sx\s/i.test(activity.caseTitle))
    ? activity.caseTitle
    : (clientParty && opponentParty) ? `${clientParty} x ${opponentParty}` : (activity.caseTitle || caseQ.data?.title || '');
  const procLabel = rawLabel.split(/\s+x\s+/i).map((p, i) => (i === 0 ? p.trim() : shortenReu(p.trim())).toUpperCase()).join(' x ');
  // No card de prazo/tarefa: SÓ partes (CAPS) + assunto/área. Etiquetas, vara e demais
  // detalhes ficam na ABA DO PROCESSO (ficha expandida), NÃO no card da agenda.
  const procSuffix = caseQ.data?.area ?? '';
  const clientConv = caseQ.data?.parties?.find((p) => p.role === 'CLIENT' && p.contact?.conversations?.length)?.contact?.conversations?.[0];

  // 2º grau (acórdão) vs 1º grau (sentença): pela instância do processo OU por
  // marcadores no título/dispositivo/recorte. Define quais recursos oferecer.
  const decisaoTxt = `${activity.title} ${activity.dispositivo ?? ''} ${activity.recorte ?? ''}`;
  // Sinal FORTE: o título "Analisar acórdão" (posto pelo classificador do DJEN
  // quando o recurso foi julgado) manda por cima da instância do processo — que no
  // Astrea costuma ficar em "1º Grau" mesmo com o recurso já julgado no 2º grau
  // (era o bug: acórdão da Tânia com instância 1º Grau caía nos botões de sentença).
  // O heurístico de texto (ACORDAO_MARKER) segue guardado pelo gate de 1º grau, pra
  // não dar falso-positivo casando "relator"/"acórdão" citado no recorte de sentença.
  const isAcordao = isDecisaoBase && (
    /ac[óo]rd[ãa]o/i.test(activity.title)
    || grade === '2º Grau'
    || (grade !== '1º Grau' && ACORDAO_MARKER.test(decisaoTxt))
  );
  // Desistência/renúncia HOMOLOGADA = extinção a pedido da própria parte autora →
  // NÃO há recurso a interpor. Suprime o painel "Criar prazo de recurso" (era o
  // caminho do prazo de "Apelação" FANTASMA lançado num processo já extinto). Guarda
  // legada: cards novos já vêm com título "Ciência — desistência homologada" (sem
  // recurso); isto protege as tarefas antigas ainda rotuladas "Analisar sentença".
  const mencionaDesistenciaHomologada =
    /homolog\w+[^.]{0,45}(?:desist|ren[úu]nci)/i.test(decisaoTxt) ||
    /(?:julgo\s+extint\w*|exting[o]\s+o\s+(?:processo|feito))[^.]{0,80}(?:desist|ren[úu]nci)/i.test(decisaoTxt);
  // ⚠️ A homologação só encerra a discussão quando é ESTE o ato publicado. Três
  // situações em que o texto CITA a homologação e mesmo assim há recurso e prazo
  // correndo — se o aviso aparecer nelas, o associado deixa passar prazo fatal.
  // Medido em 25/08/2026 no agravo interno do NELIO, cuja monocrática dizia
  // "contra a r. sentença [...] que homologou o pedido de desistência" e no mesmo
  // card trazia prazo fatal de recolhimento em 02/09.
  //
  //  1. Decisão de 2º GRAU: a monocrática ou o acórdão da apelação interposta
  //     CONTRA a sentença homologatória apenas se refere a ela. Ali cabe agravo
  //     interno e embargos, e o prazo é fatal.
  //  2. Publicação que MANDA RECOLHER (preparo, custas) ou indefere gratuidade:
  //     há ato a praticar, sob pena de deserção.
  //  3. Texto que se diz interposto CONTRA a sentença: é a peça de recurso, não
  //     a homologação.
  const decisaoDeSegundoGrau = isAcordao || grade === '2º Grau';
  const impoeAtoComPrazo =
    /deser[çc][ãa]o/i.test(decisaoTxt) ||
    /(?:recolh\w+|preparo|custas)[^.]{0,90}(?:sob\s+pena|pena\s+de)/i.test(decisaoTxt) ||
    /indefiro[^.]{0,60}gratuidade|gratuidade[^.]{0,60}indefer\w+/i.test(decisaoTxt);
  const recorreDaSentenca =
    /(?:contra|em\s+face\s+d[ae])\s+(?:a\s+)?r?\.?\s*senten[çc]a/i.test(decisaoTxt);
  const isDesistenciaHomologada =
    mencionaDesistenciaHomologada &&
    !decisaoDeSegundoGrau &&
    !impoeAtoComPrazo &&
    !recorreDaSentenca;
  const isDecisaoAnalise = isDecisaoBase && (isDecisaoTitulo || isAcordao) && !isDesistenciaHomologada;
  const ementaAcordao = isAcordao ? extractEmentaClient(activity.recorte ?? activity.dispositivo) : null;

  // ── Comentários + etiquetas + editar (backend novo) ──
  const entityType = ENTITY_TYPE[activity.source];
  const [titleVal, setTitleVal] = useState(activity.title);
  const [editing, setEditing] = useState(false);
  // `activity` chega FRESCO do refetch (detailLive) — re-sincroniza os espelhos
  // locais, senão o painel seguia mostrando título/data/responsável antigos
  // depois de editar.
  const coKey = (activity.coResponsibleIds ?? []).join(',');
  useEffect(() => {
    setTitleVal(activity.title); setDateISO(activity.date);
    setRespId(activity.responsibleId); setRespName(activity.responsibleName);
    setCoIds(activity.coResponsibleIds ?? []);
    setDone(activity.done); setCancelled(activity.cancelled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.title, activity.date, activity.responsibleId, activity.responsibleName, activity.done, activity.cancelled, coKey]);
  const [tagPicker, setTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#E03131');
  const [tagPaletteFor, setTagPaletteFor] = useState<string | null>(null);
  const qcTags = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id) ?? null;
  const etagsQ = useQuery({ queryKey: ['activity-tags', activity.id], queryFn: () => activitiesService.listTags(entityType, activity.rawId) });
  const availTagsQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const attachedIds = new Set((etagsQ.data ?? []).map((t) => t.tagId));

  const attachTag = async (tagId: string) => { try { await activitiesService.attachTag(entityType, activity.rawId, tagId); setTagPicker(false); etagsQ.refetch(); onRefetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };
  const createAndAttach = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const tag = await activitiesService.createTag(name, newTagColor);
      await activitiesService.attachTag(entityType, activity.rawId, tag.id);
      setNewTagName(''); setTagPicker(false); availTagsQ.refetch(); etagsQ.refetch(); onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro ao criar etiqueta'); } finally { setBusy(false); }
  };
  const detachTag = async (etId: string) => { try { await activitiesService.detachTag(etId); etagsQ.refetch(); onRefetch(); } catch (e: any) { toast.error(e?.message || 'Erro'); } };
  // Cor da etiqueta é GLOBAL (scope=legal): mudar aqui reflete em todas as atividades.
  const recolorTag = async (tagId: string, color: string) => {
    setBusy(true);
    try {
      await activitiesService.updateTag(tagId, { color });
      setTagPaletteFor(null);
      await qcTags.invalidateQueries({ queryKey: ['tags-available'] });
      await qcTags.invalidateQueries({ queryKey: ['activity-tags-index'] });
      etagsQ.refetch(); onRefetch();
      toast.success('Cor da etiqueta atualizada');
    } catch (e: any) { toast.error(e?.message || 'Erro ao atualizar cor'); } finally { setBusy(false); }
  };

  // Lembretes do evento (só source === 'evento'). null = usa o padrão (1 dia + 1
  // hora) → mostro esse padrão pré-selecionado; salvar grava a lista explícita.
  const [remEditing, setRemEditing] = useState(false);
  const [remVal, setRemVal] = useState<number[]>(activity.reminders ?? [1440, 60]);
  const [remBusy, setRemBusy] = useState(false);
  const saveReminders = async () => {
    setRemBusy(true);
    try {
      await calendarService.update(activity.rawId, { reminders: remVal });
      setRemEditing(false); toast.success('Lembretes salvos'); onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setRemBusy(false); }
  };

  const del = async () => {
    // Prazo é CANCELADO (soft, dá pra reabrir), não excluído de vez — deixa isso claro.
    const isPrazo = activity.source === 'prazo';
    if (!confirm(isPrazo ? 'Cancelar este prazo? (dá pra reabrir depois)' : 'Excluir esta atividade?')) return;
    setBusy(true);
    try {
      if (activity.source === 'tarefa') { await tasksService.remove(activity.rawId); toast.success('Excluída'); onClose(); }
      else if (activity.source === 'prazo') { await deadlinesService.cancel(activity.rawId); toast.success('Prazo cancelado'); setCancelled(true); setOptMenu(false); }
      else { await calendarService.remove(activity.rawId); toast.success('Excluída'); onClose(); }
      onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  const reschedule = async (target: Date) => {
    setBusy(true);
    try {
      // Item "dia todo" (tarefa/prazo sem hora): fixa 09:00 LOCAL — a hora canônica
      // de criação, robusta a fuso. (Meia-noite local virava 03:00Z e fazia a tarefa
      // ganhar hora 00:00 / não assentar no dia certo: era o "não reagenda".)
      // Item com hora (evento/audiência): preserva a hora atual.
      if (activity.hasTime) { const o = new Date(dateISO); target.setHours(o.getHours(), o.getMinutes(), 0, 0); }
      else target.setHours(9, 0, 0, 0);
      const iso = target.toISOString();
      if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { dueAt: iso });
      // No PRAZO movemos a data de EXECUÇÃO (safeDate) — igual ao arraste. A data
      // FATAL é legal e permanece INTACTA (só muda na ficha do prazo). Antes isto
      // gravava em dueDate e mexia na fatal — corrigido.
      else if (activity.source === 'prazo') await deadlinesService.update(activity.rawId, { safeDate: iso });
      else await calendarService.update(activity.rawId, { startsAt: iso });
      setDateISO(iso); setReMenu(false); setMiniCal(false); toast.success('Reagendado'); onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro ao reagendar'); } finally { setBusy(false); }
  };
  const removeDate = async () => {
    setBusy(true);
    try { await tasksService.update(activity.rawId, { dueAt: null }); toast.success('Data removida'); onRefetch(); onClose(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  // Cria o prazo do recurso a partir da sentença. O backend conta os dias úteis
  // (CPC 219/224/220, feriados + recesso) a partir da disponibilização e leva
  // TODAS as infos da publicação (recorte, dispositivo, fase) pro prazo.
  // "Não vamos recorrer" (regra global p/ acórdão/sentença): move o card p/ 15.
  // Trânsito em Julgado gravando o MOTIVO de não recorrer + o vencemos (do resultado
  // real) e conclui o prazo da decisão. Tudo linkado no kanban (faseData.transito).
  const confirmarNaoRecorrer = async () => {
    if (!activity.caseId) { toast.error('Sem processo vinculado'); return; }
    if (!motivoNR.trim()) { toast.error('Escreva o motivo de não recorrer'); return; }
    setPrazoBusy(true);
    try {
      // puxa o vencemos sugerido (resultado real do processo) p/ preencher o card.
      const sug = await legalCasesService.avancoSugestao(activity.caseId, 'transito').catch(() => ({ campos: {} as Record<string, unknown> }));
      await legalCasesService.avancarFaseComCampos({
        caseId: activity.caseId,
        targetPhase: 'transito',
        campos: {
          ...(sug.campos ?? {}),
          transitou: 'Sim',
          motivo_nao_recorrer: motivoNR.trim(),
          obs: `Não vamos recorrer: ${motivoNR.trim()}`,
        },
      });
      // conclui o prazo/tarefa da decisão (analisada — decidimos não recorrer).
      if (activity.source === 'prazo') await deadlinesService.complete(activity.rawId, activity.fatal).catch(() => {});
      else if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { status: 'DONE' }).catch(() => {});
      toast.success('Não vamos recorrer — card movido para "15. Trânsito em Julgado"');
      onRefetch();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao mover para trânsito');
    } finally { setPrazoBusy(false); }
  };

  // "Recurso provido — remessa dos autos à origem": o acórdão DEU provimento e
  // ANULOU a decisão, mandando os autos voltarem à origem para novo julgamento.
  // NÃO é trânsito. Aqui (a) marca o recurso como PROVIDO na aba Recursos (êxito),
  // e (b) move o card de volta à fase de origem escolhida (re-julgamento), e
  // conclui o prazo/tarefa da análise do acórdão.
  const REMESSA_FASES: { key: string; label: string }[] = [
    { key: 'aguardando_sentenca', label: '12. Aguardando sentença (re-julgamento)' },
    { key: 'aud_instrucao', label: '11. Audiência de instrução' },
    { key: 'pericia', label: '10. Perícia' },
    { key: 'provas', label: '09. Especificação de provas' },
    { key: 'contestacao', label: '08. Réplica/Contestação' },
  ];
  const confirmarRemessaOrigem = async () => {
    if (!activity.caseId) { toast.error('Sem processo vinculado'); return; }
    setPrazoBusy(true);
    try {
      // (a) Registra o resultado na aba Recursos = PROVIDO. Atualiza o recurso
      // aberto (AGUARDANDO) do processo; se não houver, cria um já provido.
      const ementa = ementaAcordao ?? activity.dispositivo ?? undefined;
      const abertos = await recursosService.list({ caseId: activity.caseId }).catch(() => [] as Recurso[]);
      const alvo = abertos.find((r) => r.julgamento === 'AGUARDANDO') ?? abertos[0];
      if (alvo) {
        await recursosService.update(alvo.id, { julgamento: 'PROVIDO', ...(ementa ? { ementa } : {}) });
      } else {
        await recursosService.create({ caseId: activity.caseId, julgamento: 'PROVIDO', parteRecorrente: 'CLIENTE', ...(ementa ? { ementa } : {}) });
      }
      // (b) Move o card de volta à fase de origem (anulação → novo julgamento).
      const faseLabel = REMESSA_FASES.find((f) => f.key === remessaFase)?.label ?? remessaFase;
      await legalCasesService.avancarFaseComCampos({
        caseId: activity.caseId,
        targetPhase: remessaFase,
        campos: { obs: `Recurso PROVIDO — acórdão anulou a decisão e remeteu os autos à origem${remessaObs.trim() ? `: ${remessaObs.trim()}` : ''}` },
      });
      // conclui o prazo/tarefa da análise do acórdão.
      if (activity.source === 'prazo') await deadlinesService.complete(activity.rawId, activity.fatal).catch(() => {});
      else if (activity.source === 'tarefa') await tasksService.update(activity.rawId, { status: 'DONE' }).catch(() => {});
      toast.success(`Recurso provido — autos à origem. Recurso marcado como provido e card movido para "${faseLabel}".`);
      onRefetch();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao registrar remessa à origem');
    } finally { setPrazoBusy(false); }
  };

  const criarPrazoRecurso = async (tipo: 'apelacao' | 'embargos' | 'resp' | 'agravo_interno') => {
    if (!activity.caseId) { toast.error('Sem processo vinculado'); return; }
    setPrazoBusy(true);
    try {
      // ED: 5 dias úteis (CPC 1.023). Demais recursos: 15 dias úteis (CPC 1.003 §5).
      const RECURSO: Record<typeof tipo, { dias: number; titulo: string }> = {
        apelacao: { dias: 15, titulo: 'Apelação' },
        resp: { dias: 15, titulo: 'Recurso Especial/Extraordinário (REsp/RE)' },
        agravo_interno: { dias: 15, titulo: 'Agravo Interno' },
        embargos: { dias: 5, titulo: 'Embargos de declaração' },
      };
      const { dias, titulo } = RECURSO[tipo];
      // Base de contagem: disponibilização da sentença (triggerDate). Sem ela
      // (raro — só prazos não-DJEN), conta a partir da data da própria atividade.
      const base = activity.triggerDate
        ? { disponibilizacao: activity.triggerDate }
        : { inicio: activity.date };
      const novo = await deadlinesService.create({
        caseId: activity.caseId,
        title: titulo,
        type: 'FATAL',
        dias,
        ...base,
        assignedToId: activity.responsibleId ?? undefined,
        metadata: {
          djen: {
            descricao: `Prazo de ${titulo.toLowerCase()} a partir da ${isAcordao ? 'acórdão' : 'sentença'}`,
            tipoPublicacao: activity.tipoPublicacao ?? undefined,
            recorte: activity.recorte ?? undefined,
            dispositivo: activity.dispositivo ?? undefined,
            // NÃO copia faseMovida: um prazo de recurso criado na mão não move
            // fase nenhuma — copiar isso mostrava uma "Movimentação de fase" estale
            // (ex.: "→ SUSPENSO") no modal, confundindo com a posição real do card.
          },
          origem: isAcordao ? 'analise-acordao' : 'analise-sentenca',
          sentencaTaskId: activity.rawId,
        },
      });
      const fmt = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      toast.success(`Prazo de ${titulo.toLowerCase()} criado — fatal ${fmt(novo.dueDate)} (segurança ${fmt(novo.safeDate)})`);
      onRefetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao criar prazo');
    } finally { setPrazoBusy(false); }
  };
  const toggleDone = async () => {
    // Concluir um PRAZO (não reabrir) → kanban vivo: recurso abre o mini-form
    // (espécie/motivo + aba Recursos); os demais avançam o card conforme a nossa
    // petição (réplica → provas; provas → perícia/instrução/julgamento…).
    if (!done && !cancelled && activity.source === 'prazo' && activity.caseId) {
      const av = avancoDoPrazo(activity);
      if (av?.kind === 'recurso') { setRecursoForm(true); return; }
      if (av?.kind === 'move') { setAvancoForm(av); return; }
      if (av?.kind === 'fase') { setFaseForm(av.phase); return; }
    }
    setBusy(true);
    try {
      if (activity.source === 'tarefa') { await tasksService.update(activity.rawId, { status: done ? 'TODO' : 'DONE' }); toast.success(done ? 'Tarefa reaberta' : 'Tarefa concluída'); setDone(!done); }
      else if (activity.source === 'evento') { await calendarService.update(activity.rawId, { completedAt: done ? null : new Date().toISOString() }); toast.success(done ? 'Compromisso reaberto' : 'Compromisso concluído'); setDone(!done); }
      // Prazo: concluído OU cancelado → REABRE (status OPEN, volta pra agenda). Aberto → conclui.
      else { if (done || cancelled) { await deadlinesService.update(activity.rawId, { status: 'OPEN' }); toast.success('Prazo reaberto'); setDone(false); setCancelled(false); } else { await deadlinesService.complete(activity.rawId, activity.fatal); toast.success('Prazo concluído'); setDone(true); } }
      onRefetch();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };
  // "Só concluir o prazo" — escape do mini-form quando você fechou o prazo sem recorrer.
  const soConcluir = async () => {
    setRecursoForm(false); setBusy(true);
    try { await deadlinesService.complete(activity.rawId, activity.fatal); toast.success('Prazo concluído'); setDone(true); onRefetch(); }
    catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };

  // Arquivar a peça só faz sentido com processo: a pasta do cliente sai das
  // PARTES do processo, não do título da tarefa.
  const podeArquivar = !!activity.caseId && (activity.source === 'tarefa' || activity.source === 'prazo');
  // O checkbox do título é a MESMA porta do botão "Concluir e arquivar": marcar
  // a caixa é o gesto natural de fechar o card, e fechar por ali sem passar pelo
  // arquivamento deixava a peça protocolada fora da pasta do cliente. Quem quiser
  // fechar sem arquivar continua tendo o botão "Concluir" no rodapé.
  const concluirPeloCheckbox = () => {
    if (!done && !cancelled && podeArquivar) { setArquivarForm(true); return; }
    toggleDone();
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
              {optMenu && (<><div className="fixed inset-0 z-10" onClick={() => setOptMenu(false)} /><div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"><button onClick={() => { setEditing(true); setOptMenu(false); }} className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">Editar</button><button disabled={busy} onClick={del} className="block w-full px-4 py-2 text-left text-sm text-[#CE0000] hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800">{activity.source === 'prazo' ? 'Cancelar prazo' : 'Excluir'}</button></div></>)}
            </div>
            <button onClick={onClose} className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: TYPE_TAG[activity.source].bg }}>{TYPE_TAG[activity.source].label}</span>
          {activity.fatal && <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Fatal</span>}
          {activity.cancelled && <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500">Cancelada</span>}
          {(etagsQ.data ?? []).map((et) => (
            <span key={et.id} className="relative inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: et.tag.color }}>
              <button onClick={() => setTagPaletteFor(tagPaletteFor === et.tagId ? null : et.tagId)} title="Alterar cor" className="uppercase hover:opacity-80">{et.tag.name}</button>
              <button onClick={() => detachTag(et.id)} title="Remover etiqueta" className="hover:opacity-70"><X className="h-3 w-3" /></button>
              {tagPaletteFor === et.tagId && (<><div className="fixed inset-0 z-10" onClick={() => setTagPaletteFor(null)} />
                <div className="absolute left-0 top-6 z-20 flex w-40 flex-wrap gap-1.5 rounded-lg border border-[#DEE2E6] bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {TAG_PALETTE.map((c) => (
                    <button key={c} type="button" disabled={busy} onClick={() => recolorTag(et.tagId, c)} className={`h-5 w-5 rounded-full transition disabled:opacity-40 ${et.tag.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-900' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                  ))}
                </div></>)}
            </span>
          ))}
          <div className="relative">
            <button onClick={() => setTagPicker((v) => !v)} className="inline-flex items-center gap-1 rounded border border-dashed border-[#DEE2E6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6C757D] hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"><Tag className="h-3 w-3" />Etiqueta</button>
            {tagPicker && (<><div className="fixed inset-0 z-10" onClick={() => { setTagPicker(false); setTagPaletteFor(null); }} />
              <div className="absolute left-0 top-7 z-20 w-64 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <div className="max-h-44 overflow-y-auto">
                  {(availTagsQ.data ?? []).filter((t) => !attachedIds.has(t.id)).map((t) => (
                    <div key={t.id}>
                      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <button onClick={(e) => { e.stopPropagation(); setTagPaletteFor(tagPaletteFor === t.id ? null : t.id); }} title="Alterar cor" className="h-3 w-3 shrink-0 rounded-full ring-offset-1 transition hover:ring-2 hover:ring-zinc-300 dark:ring-offset-zinc-900" style={{ backgroundColor: t.color }} />
                        <button onClick={() => attachTag(t.id)} className="min-w-0 flex-1 truncate text-left text-sm">{t.name}</button>
                      </div>
                      {tagPaletteFor === t.id && (
                        <div className="flex flex-wrap gap-1.5 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                          {TAG_PALETTE.map((c) => (
                            <button key={c} type="button" disabled={busy} onClick={() => recolorTag(t.id, c)} className={`h-5 w-5 rounded-full transition disabled:opacity-40 ${t.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-800' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(availTagsQ.data ?? []).filter((t) => !attachedIds.has(t.id)).length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta jurídica ainda.</p>}
                </div>
                <div className="mt-1 border-t border-[#DEE2E6] px-3 py-2 dark:border-zinc-700">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Nova etiqueta</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {TAG_PALETTE.map((c) => (
                      <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`h-4 w-4 rounded-full transition ${newTagColor === c ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-900' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createAndAttach(); }} placeholder="Nome da etiqueta" className="min-w-0 flex-1 rounded border border-[#DEE2E6] px-2 py-1 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    <button disabled={busy || !newTagName.trim()} onClick={createAndAttach} className="shrink-0 rounded px-2 py-1 text-xs font-bold uppercase text-white disabled:opacity-40" style={{ backgroundColor: ASTREA_BLUE }}>Criar</button>
                  </div>
                </div>
              </div></>)}
          </div>
        </div>

        {/* Edição COMPLETA (título, processo, responsável, data, prioridade/tipo,
            descrição, local/lembretes) — substitui os dados enquanto está aberta. */}
        {editing && <ActivityEditForm activity={activity} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onRefetch(); }} />}

        {/* Checkbox + título */}
        {!editing && (
        <div className="mb-4 flex items-start gap-3">
          <button onClick={concluirPeloCheckbox} disabled={busy} title={!done && !cancelled && podeArquivar ? 'Concluir e arquivar a peça na pasta do cliente' : undefined} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? 'border-[#228BE6] bg-[#228BE6] text-white' : 'border-zinc-300 dark:border-zinc-600'} disabled:opacity-40`}>{done && <Check className="h-3.5 w-3.5" />}</button>
          <h3 className={`flex-1 text-lg font-medium text-[#202124] dark:text-zinc-100 ${done ? 'text-zinc-400 line-through' : ''}`}>{titleVal}</h3>
          <button onClick={() => setEditing(true)} title="Editar" className="mt-0.5 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"><Pencil className="h-4 w-4" /></button>
        </div>
        )}

        {/* Dados */}
        {!editing && (
        <dl className="space-y-2 text-sm">
          {/* Data → menu de reagendamento (igual Astrea) */}
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-[#6C757D]">Data:</dt>
            <dd className="relative">
              <button onClick={() => { setReMenu((v) => !v); setMiniCal(false); }} className="inline-flex items-center gap-1 text-[#202124] hover:underline dark:text-zinc-200">{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', ...(activity.hasTime ? {} : { timeZone: 'UTC' as const }) })}{activity.hasTime ? `, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}<ChevronDown className="h-4 w-4 text-zinc-400" /></button>
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
          {activity.caseTitle && <Row label="Processo"><button onClick={() => onOpenCase(activity.caseId!)} className="text-left font-light text-[#228BE6] hover:underline">{procLabel}{procSuffix ? ` - ${procSuffix}` : ''}</button></Row>}
          {activity.cnj && <Row label="Número do processo"><CnjNumber value={activity.cnj} /></Row>}
          {(activity.source === 'tarefa' || activity.source === 'prazo' || activity.responsibleName) && (
            <Row label="Responsável">
              {(activity.source === 'tarefa' || activity.source === 'prazo') ? (
                <span className="relative inline-block">
                  <button onClick={() => setRespMenu((v) => !v)} className="inline-flex items-center gap-1 font-light text-[#228BE6] hover:underline">
                    {respName ?? 'Atribuir responsável'} <span className="text-[10px]">▾</span>
                  </button>
                  {respMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setRespMenu(false)} />
                      <div className="absolute left-0 z-20 mt-1 max-h-60 w-60 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        <button onClick={() => assignResp(null)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Ninguém {!respId && <span className="text-[#228BE6]">✓</span>}</button>
                        {members.map((m) => (
                          <button key={m.user.id} onClick={() => assignResp(m.user.id)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                            {m.user.name} {respId === m.user.id && <span className="text-[#228BE6]">✓</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </span>
              ) : respName}
            </Row>
          )}
          <Row label="Co-responsáveis">
            <span className="relative inline-flex flex-wrap items-center gap-1.5">
              {coIds.length === 0 && <span className="text-zinc-400">—</span>}
              {coIds.map((uid) => {
                const nm = members.find((m) => m.user.id === uid)?.user.name ?? 'Usuário';
                return (
                  <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {nm}
                    <button onClick={() => toggleCo(uid)} title="Remover" className="text-zinc-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
              <button onClick={() => setCoMenu((v) => !v)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[#DEE2E6] px-2 py-0.5 text-xs text-[#6C757D] hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"><Plus className="h-3 w-3" />Adicionar</button>
              {coMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCoMenu(false)} />
                  <div className="absolute left-0 top-7 z-20 max-h-60 w-60 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {members.filter((m) => m.user.id !== respId).map((m) => {
                      const on = coIds.includes(m.user.id);
                      return (
                        <button key={m.user.id} onClick={() => toggleCo(m.user.id)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          {m.user.name} {on && <Check className="h-4 w-4 text-[#228BE6]" />}
                        </button>
                      );
                    })}
                    {members.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhum membro.</p>}
                  </div>
                </>
              )}
            </span>
          </Row>
          {activity.createdName && <Row label="Criado por"><span className="text-zinc-500">{activity.createdName}</span></Row>}
          {done && activity.completedAt && <Row label=""><span className="text-zinc-500">{activity.source === 'tarefa' ? 'Tarefa concluída' : 'Prazo concluído'} em {new Date(activity.completedAt).toLocaleDateString('pt-BR')}{activity.responsibleName ? ` por ${activity.responsibleName}` : ''}</span></Row>}
          {activity.priorityLabel && <Row label="Prioridade">{activity.priorityLabel}</Row>}
          {activity.description && activity.source === 'evento' && <Row label="Local">{activity.description}</Row>}
          {activity.source === 'evento' && (
            <Row label="Lembretes">
              {remEditing ? (
                <div className="w-full space-y-2">
                  <RemindersField value={remVal} onChange={setRemVal} />
                  <div className="flex items-center gap-1">
                    <button disabled={remBusy} onClick={saveReminders} className="rounded px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{remBusy ? 'Salvando…' : 'Salvar'}</button>
                    <button onClick={() => { setRemEditing(false); setRemVal(activity.reminders ?? [1440, 60]); }} className="rounded px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
                  </div>
                </div>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  {(activity.reminders ?? [1440, 60]).length === 0
                    ? <span className="text-zinc-400">Sem lembrete</span>
                    : (activity.reminders ?? [1440, 60]).map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-full bg-[#228BE6]/10 px-2 py-0.5 text-xs font-medium text-[#228BE6]"><CalendarClock className="h-3 w-3" />{reminderLabel(m)}</span>
                    ))}
                  {activity.reminders == null && <span className="text-[11px] text-zinc-400">(padrão)</span>}
                  <button onClick={() => { setRemVal(activity.reminders ?? [1440, 60]); setRemEditing(true); }} className="text-xs font-medium text-[#228BE6] hover:underline">Editar</button>
                </span>
              )}
            </Row>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.description && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">Descrição da tarefa:</dt>
              <dd className="m-0 whitespace-pre-wrap break-words font-normal leading-relaxed text-[#202124] dark:text-zinc-200">{activity.description}</dd>
            </div>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.prazoFatal && <Row label="Prazo fatal"><span className="font-medium text-rose-600 dark:text-rose-400">{new Date(activity.prazoFatal).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></Row>}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.faseMovida && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">Movimentação de fase <span className="font-normal normal-case text-zinc-400">(registro desta publicação)</span>:</dt>
              <dd className="m-0 font-normal leading-relaxed text-zinc-400 dark:text-zinc-500">
                Card movido de <span className="font-normal text-zinc-500 dark:text-zinc-400">{activity.faseMovida.de}</span> para{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{activity.faseMovida.para}</span>
              </dd>
            </div>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.processosRelacionados && activity.processosRelacionados.length > 0 && (() => {
            const rel = activity.processosRelacionados!;
            const mesmoBanco = rel.filter((p) => p.mesmoBanco);
            const outros = rel.filter((p) => !p.mesmoBanco);
            // Mesma regra de sigla do card: título curado ("CLIENTE x SIGLA") em CAPS;
            // quando o título já traz o réu (tem " x "), NÃO repete o nome-monstro do banco.
            const relLabel = (t: string) => t.split(/\s+x\s+/i).map((s, i) => (i === 0 ? s.trim() : shortenReu(s.trim())).toUpperCase()).join(' x ');
            const titleTemReu = (t: string) => /\sx\s/i.test(t);
            return (
              <div className="flex flex-col gap-1">
                <dt className="font-medium text-[#6C757D]">Outras ações do mesmo cliente:</dt>
                <dd className="m-0 flex flex-col gap-2">
                  {mesmoBanco.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-500/40 dark:bg-amber-500/10">
                      <p className="m-0 mb-1 flex items-center gap-1 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                        ⚠️ {mesmoBanco.length === 1 ? 'Ação contra o MESMO banco' : `${mesmoBanco.length} ações contra o MESMO banco`}
                      </p>
                      <p className="m-0 mb-2 text-[11px] font-normal leading-snug text-amber-700/90 dark:text-amber-300/80">
                        Na defesa o banco costuma juntar documentos de todos os contratos — confira a qual contrato/benefício cada documento se refere antes de impugnar.
                      </p>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {mesmoBanco.map((p) => (
                          <li key={p.caseId} className="text-[12px] font-normal leading-snug text-zinc-700 dark:text-zinc-200">
                            <a href={`/processos/${p.caseId}`} className="font-medium text-amber-800 underline decoration-dotted underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200">{relLabel(p.title)}</a>
                            <span className="text-zinc-500 dark:text-zinc-400">{' · '}{p.cnj ?? 's/ CNJ'}{p.area ? ` · ${p.area}` : ''}{p.legalPhase ? ` · ${p.legalPhase}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {outros.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {outros.map((p) => (
                        <li key={p.caseId} className="text-[12px] font-normal leading-snug text-zinc-500 dark:text-zinc-400">
                          <a href={`/processos/${p.caseId}`} className="underline decoration-dotted underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200">{relLabel(p.title)}</a>
                          <span>{' · '}{p.cnj ?? 's/ CNJ'}{p.banco && !titleTemReu(p.title) ? ` · ${p.banco}` : ''}{p.area ? ` · ${p.area}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            );
          })()}
          {activity.caseId && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">Fase do processo:</dt>
              <dd className="m-0"><MoverFaseManual caseId={activity.caseId} onMoved={onRefetch} /></dd>
            </div>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && ementaAcordao && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">Ementa do acórdão:</dt>
              <dd className="m-0 whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-2 text-justify font-normal leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">{ementaAcordao}</dd>
            </div>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.dispositivo && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">{isAcordao ? 'Dispositivo do acórdão:' : 'Dispositivo da sentença:'}</dt>
              <dd className="m-0 whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-2 font-normal leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300"><ExpandableText text={activity.dispositivo} /></dd>
            </div>
          )}
          {(activity.source === 'tarefa' || activity.source === 'prazo') && activity.recorte && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-[#6C757D]">Recorte da publicação:</dt>
              <dd className="m-0 whitespace-pre-wrap break-words text-justify font-normal leading-relaxed text-zinc-400 dark:text-zinc-500"><ExpandableText text={activity.recorte} /></dd>
            </div>
          )}
        </dl>
        )}

        {/* Criar prazo de recurso — quando a atividade é a análise de uma decisão.
            Acórdão (2º grau): REsp/RE, Embargos de Declaração, Agravo Interno.
            Sentença (1º grau): Apelação, Embargos de Declaração. */}
        {isDesistenciaHomologada && (
          <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            <p className="font-semibold">Desistência homologada — extinção a pedido da parte</p>
            <p className="mt-1">Quanto ao <strong>mérito</strong> não há o que recorrer: o desfecho é o que a parte autora requereu.</p>
            <p className="mt-1"><strong>Confira os capítulos acessórios antes de dispensar o recurso.</strong> Custas, honorários, multa e condenação do patrono são recorríveis por apelação, e o prazo corre normalmente. Só não lance prazo se a sentença se limitou a homologar a desistência.</p>
          </div>
        )}
        {isDecisaoAnalise && (
          <div className="mt-5 rounded-lg border border-[#DEE2E6] bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Criar prazo de recurso {isAcordao && <span className="ml-1 rounded bg-[#7048E8]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#7048E8] dark:text-[#b197fc]">acórdão · 2º grau</span>}</p>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Contado da {activity.triggerDate ? 'disponibilização' : 'data'} {isAcordao ? 'deste acórdão' : 'desta sentença'} — dias úteis, feriados e recesso já calculados (CPC 219/224). Leva a publicação, o dispositivo{isAcordao ? '/ementa' : ''} e o recorte pro prazo.
            </p>
            <div className="flex flex-wrap gap-2">
              {isAcordao ? (
                <>
                  <button disabled={prazoBusy} onClick={() => criarPrazoRecurso('resp')} className="inline-flex items-center gap-1.5 rounded-md bg-[#CE0000] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                    <CalendarClock className="h-4 w-4" /> {prazoBusy ? 'Criando…' : 'REsp / RE (15 dias úteis)'}
                  </button>
                  <button disabled={prazoBusy} onClick={() => criarPrazoRecurso('agravo_interno')} className="inline-flex items-center gap-1.5 rounded-md border border-[#CE0000] px-3 py-2 text-sm font-medium text-[#CE0000] hover:bg-[#CE0000]/5 disabled:opacity-50 dark:hover:bg-[#CE0000]/10">
                    <CalendarClock className="h-4 w-4" /> Agravo Interno (15 dias úteis)
                  </button>
                  <button disabled={prazoBusy} onClick={() => criarPrazoRecurso('embargos')} className="inline-flex items-center gap-1.5 rounded-md border border-[#CE0000] px-3 py-2 text-sm font-medium text-[#CE0000] hover:bg-[#CE0000]/5 disabled:opacity-50 dark:hover:bg-[#CE0000]/10">
                    <CalendarClock className="h-4 w-4" /> Embargos de Declaração (5 dias úteis)
                  </button>
                </>
              ) : (
                <>
                  <button disabled={prazoBusy} onClick={() => criarPrazoRecurso('apelacao')} className="inline-flex items-center gap-1.5 rounded-md bg-[#CE0000] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                    <CalendarClock className="h-4 w-4" /> {prazoBusy ? 'Criando…' : 'Apelação (15 dias úteis)'}
                  </button>
                  <button disabled={prazoBusy} onClick={() => criarPrazoRecurso('embargos')} className="inline-flex items-center gap-1.5 rounded-md border border-[#CE0000] px-3 py-2 text-sm font-medium text-[#CE0000] hover:bg-[#CE0000]/5 disabled:opacity-50 dark:hover:bg-[#CE0000]/10">
                    <CalendarClock className="h-4 w-4" /> Embargos (5 dias úteis)
                  </button>
                </>
              )}
            </div>

            {/* Recurso PROVIDO → remessa dos autos à origem (acórdão anulou a decisão
                e mandou re-julgar). Não é trânsito: marca o recurso como provido na
                aba Recursos e move o card de volta à fase de origem escolhida. */}
            {isAcordao && (
              <div className="mt-3 border-t border-[#DEE2E6] pt-3 dark:border-zinc-700">
                {!remessaOpen ? (
                  <button onClick={() => setRemessaOpen(true)} className="text-left text-sm font-medium text-[#495057] hover:text-[#7048E8] dark:text-zinc-300 dark:hover:text-[#b197fc]">
                    Recurso <span className="font-semibold">provido</span> — anulou e remeteu os autos à origem
                  </button>
                ) : (
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Recurso provido — remessa à origem</p>
                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                      O acórdão deu provimento e anulou a decisão: o processo volta para ser julgado corretamente. Marca o recurso como <span className="font-semibold text-[#7048E8] dark:text-[#b197fc]">provido</span> (aba Recursos) e devolve o card à fase de origem.
                    </p>
                    <label className="mb-1 block text-xs font-medium text-[#6C757D]">Volta para a fase</label>
                    <select value={remessaFase} onChange={(e) => setRemessaFase(e.target.value)} className={inputCls}>
                      {REMESSA_FASES.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
                    </select>
                    <textarea value={remessaObs} onChange={(e) => setRemessaObs(e.target.value)} rows={2} placeholder="Obs. (opcional) — ex.: anulação por cerceamento de defesa; refazer instrução" className={`${inputCls} mt-2 resize-none`} />
                    <div className="mt-2 flex items-center gap-2">
                      <button disabled={prazoBusy} onClick={confirmarRemessaOrigem} className="inline-flex items-center gap-1.5 rounded-md bg-[#7048E8] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                        <Check className="h-4 w-4" /> {prazoBusy ? 'Registrando…' : 'Confirmar (provido → origem)'}
                      </button>
                      <button disabled={prazoBusy} onClick={() => { setRemessaOpen(false); setRemessaObs(''); }} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Não vamos recorrer → 15. Trânsito em Julgado + motivo (linkado no kanban).
                Vale tanto quando PERDEMOS mas não recorreremos quanto quando a decisão
                foi FAVORÁVEL (nada a recorrer) — o desfecho vencemos/perdemos é gravado
                depois, no trânsito. */}
            <div className="mt-3 border-t border-[#DEE2E6] pt-3 dark:border-zinc-700">
              {!naoRecorrerOpen ? (
                <button onClick={() => setNaoRecorrerOpen(true)} className="text-left text-sm font-medium text-[#495057] hover:text-[#02883C] dark:text-zinc-300">
                  Não vamos recorrer (decisão favorável ou inviável) →&nbsp;<span className="font-semibold">trânsito em julgado</span>
                </button>
              ) : (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Não vamos recorrer — motivo</p>
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Pode ser porque a <span className="font-semibold text-[#02883C]">decisão foi favorável</span> (nada a recorrer) ou porque recorrer é inviável.</p>
                  <textarea autoFocus value={motivoNR} onChange={(e) => setMotivoNR(e.target.value)} rows={2} placeholder="Ex.: decisão favorável, nada a recorrer — ou: a parte usou o cartão para compras, difícil reverter em 2º grau" className={`${inputCls} resize-none`} />
                  <div className="mt-2 flex items-center gap-2">
                    <button disabled={prazoBusy} onClick={confirmarNaoRecorrer} className="inline-flex items-center gap-1.5 rounded-md bg-[#02883C] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                      <Check className="h-4 w-4" /> {prazoBusy ? 'Movendo…' : 'Confirmar (mover p/ trânsito)'}
                    </button>
                    <button disabled={prazoBusy} onClick={() => { setNaoRecorrerOpen(false); setMotivoNR(''); }} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Geração de peças por IA saiu do BullQ (réplica/especificação/recurso usam
            o Cowork). No kanban pré-judicial fica só a geração de iniciais de RMC/RCC. */}

        {/* Anexos — deixa o documento junto do prazo/tarefa pra usar depois. */}
        <div className="mt-5 border-t border-[#DEE2E6] pt-4 dark:border-zinc-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Anexos</p>
          <AnexosSection entityType={entityType} entityId={activity.rawId} />
        </div>

        {/* Comentários — multi-linha, @menção (com notificação), editar e foto do autor. */}
        <div className="mt-5 border-t border-[#DEE2E6] pt-4 dark:border-zinc-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6C757D]">Comentários</p>
          <CommentsSection entityType={entityType} entityId={activity.rawId} activityId={activity.id} meId={meId} />
        </div>

        <div className="mt-4 flex justify-end">
          {done || cancelled
            ? <button disabled={busy} onClick={toggleDone} className="inline-flex items-center gap-1.5 rounded-md border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{cancelled ? 'Reabrir prazo' : 'Reabrir'}</button>
            : <>
                {podeArquivar && (
                  <button
                    disabled={busy}
                    onClick={() => setArquivarForm(true)}
                    title="Manda a peça para a pasta do cliente, na fase e na data, e conclui"
                    className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-[#228BE6] px-4 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-50"
                  >
                    <Stamp className="h-4 w-4" /> Concluir e arquivar
                  </button>
                )}
                <button disabled={busy} onClick={toggleDone} className="inline-flex items-center gap-1.5 rounded-md bg-[#02883C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Check className="h-4 w-4" /> Concluir</button>
              </>}
        </div>
      </div>
      {arquivarForm && (
        <ArquivarPecaModal
          atividade={{ entityType: entityType as 'task' | 'deadline', entityId: activity.rawId }}
          titulo="Concluir e arquivar"
          rotuloConfirmar="Arquivar e concluir"
          onFechar={() => setArquivarForm(false)}
          // Tarefa que não gera peça ("tomar ciência", "juntar despacho") sai por
          // aqui: conclui e não toca em pasta nenhuma. A conclusão é a mesma do
          // botão verde — no prazo, ainda pode abrir recurso/avanço de fase.
          onSoConcluir={() => { setArquivarForm(false); toggleDone(); }}
          rotuloSoConcluir="Só concluir, sem arquivar"
          onPronto={(r) => {
            setArquivarForm(false);
            // Arquivou primeiro, conclui depois: a conclusão do PRAZO ainda pode
            // abrir o mini-form de recurso / avanço de fase, e essa cadeia não
            // pode ser encurtada por aqui.
            toggleDone();
            toast.success(`Arquivado em ${r.caminho.join(' › ')}`);
          }}
        />
      )}
      {recursoForm && (
        <RegistrarRecursoModal
          activity={activity}
          onClose={() => setRecursoForm(false)}
          onSoConcluir={soConcluir}
          onDone={() => { setRecursoForm(false); setDone(true); onRefetch(); }}
        />
      )}
      {avancoForm?.kind === 'move' && (
        <AvancarPrazoModal
          activity={activity}
          avanco={avancoForm}
          onClose={() => setAvancoForm(null)}
          onSoConcluir={() => { setAvancoForm(null); soConcluir(); }}
          onDone={() => { setAvancoForm(null); setDone(true); onRefetch(); }}
        />
      )}
      {faseForm && activity.caseId && (
        <AvancoFaseModal
          phase={faseForm}
          caseId={activity.caseId}
          caseTitle={activity.caseTitle}
          deadlineId={activity.rawId}
          fatal={activity.fatal}
          podeLancarFinanceiro={souSocio}
          onClose={() => setFaseForm(null)}
          onSoConcluir={() => { setFaseForm(null); soConcluir(); }}
          onDone={(next) => { setFaseForm(null); setDone(true); onRefetch(); if (next === 'acoes_vencidas' || next === 'acoes_perdidas') setFaseExtra(next); }}
        />
      )}
      {faseExtra && activity.caseId && (
        <AvancoFaseModal
          phase={faseExtra}
          caseId={activity.caseId}
          caseTitle={activity.caseTitle}
          podeLancarFinanceiro={souSocio}
          onClose={() => setFaseExtra(null)}
          onDone={() => { setFaseExtra(null); onRefetch(); }}
        />
      )}
    </div>
  );
}

// Modal de avanço de fase (kanban vivo): concluir a petição move o card. Com 1
// destino → botão único; com vários (especificação de provas) → escolha o que
// requeremos e o card avança conforme.
function AvancarPrazoModal({ activity, avanco, onClose, onSoConcluir, onDone }: {
  activity: Activity; avanco: Extract<Avanco, { kind: 'move' }>; onClose: () => void; onSoConcluir: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const avancar = async (targetPhase: string) => {
    setBusy(true);
    try {
      await legalCasesService.avancarPrazo({ deadlineId: activity.rawId, targetPhase, confirmFatal: activity.fatal });
      const nome = avanco.options.find((o) => o.phase === targetPhase)?.label ?? 'próxima fase';
      toast.success(`Prazo concluído — card movido para "${nome}"`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao avançar o processo');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[60] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#202124] dark:text-zinc-100">{avanco.title}</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-zinc-500">{activity.caseTitle ? `${activity.caseTitle} — ` : ''}{avanco.subtitle}</p>

        <div className="flex flex-col gap-2">
          {avanco.options.map((o) => (
            <button key={o.phase} disabled={busy} onClick={() => avancar(o.phase)} className="flex items-center justify-between rounded-lg border border-[#DEE2E6] px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:border-[#02883C] hover:bg-[#02883C]/5 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">
              {o.label}
              <span className="text-xs font-normal text-zinc-400">mover →</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={onSoConcluir} disabled={busy} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Só concluir o prazo</button>
          <button onClick={onClose} disabled={busy} className="rounded-md border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Mini-form de 1 clique: ao concluir um prazo de recurso, confirma espécie + quem
// recorreu + motivo. Ao confirmar, o backend conclui o prazo, move o card p/ RECURSO
// e cria/preenche o registro na aba Recursos.
function RegistrarRecursoModal({ activity, onClose, onSoConcluir, onDone }: {
  activity: Activity; onClose: () => void; onSoConcluir: () => void; onDone: () => void;
}) {
  const sug = activity.recursoSugestao;
  const [especie, setEspecie] = useState<string>(sug?.especie || especieDoPrazo(activity) || 'Apelação');
  // Contrarrazões = a parte ADVERSA recorreu; os demais = nós (autor).
  const contrarrazoes = (activity.djenAction ?? '').toLowerCase() === 'contrarrazoes'
    || /contrarraz|contraminuta/i.test(`${activity.title} ${activity.description ?? ''}`);
  const [parte, setParte] = useState<'CLIENTE' | 'ADVERSA'>(
    (sug?.parteRecorrente?.toUpperCase() as 'CLIENTE' | 'ADVERSA') || (contrarrazoes ? 'ADVERSA' : 'CLIENTE'),
  );
  const [motivo, setMotivo] = useState<string>(sug?.motivo || '');
  const [numeroRecurso, setNumeroRecurso] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [iaBusy, setIaBusy] = useState(false);
  const [iaAuto, setIaAuto] = useState(false); // já tentou o auto-fill
  const custom = !ESPECIES_RECURSO.includes(especie);
  const ehAgravo = /agravo/i.test(especie);

  // Sugere o motivo lendo a sentença (IA). Não sobrescreve o que você já digitou.
  const sugerirMotivoIA = async (forcar = false) => {
    if (iaBusy) return;
    if (motivo.trim() && !forcar) return;
    setIaBusy(true);
    try {
      const { motivo: m } = await legalCasesService.sugerirMotivoRecurso(activity.rawId);
      if (m && (forcar || !motivo.trim())) setMotivo(m);
      else if (!m && forcar) toast.info('A IA não encontrou base para sugerir o motivo.');
    } catch { if (forcar) toast.error('Não consegui gerar a sugestão agora.'); }
    finally { setIaBusy(false); }
  };
  // Auto-fill ao abrir: se o motivo veio vazio, a IA lê a sentença e preenche.
  useEffect(() => {
    if (iaAuto) return;
    setIaAuto(true);
    if (!motivo.trim() && parte === 'CLIENTE') void sugerirMotivoIA(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = async () => {
    setBusy(true);
    try {
      await legalCasesService.registrarRecurso({
        deadlineId: activity.rawId,
        especie: especie.trim() || undefined,
        parteRecorrente: parte,
        motivo: motivo.trim() || undefined,
        numeroRecurso: numeroRecurso.trim() || undefined,
        confirmFatal: activity.fatal,
      });
      toast.success(
        numeroRecurso.trim()
          ? 'Recurso registrado + número apensado ao processo — card em "14. RECURSO"'
          : 'Recurso registrado — card movido para "14. RECURSO"',
      );
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao registrar o recurso');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[60] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#202124] dark:text-zinc-100">Registrar recurso</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          {activity.caseTitle ?? 'Processo'} — o card vai para <b>14. RECURSO</b> e entra na aba Recursos.
        </p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6C757D]">Espécie</label>
        <select value={custom ? '__custom' : especie} onChange={(e) => setEspecie(e.target.value === '__custom' ? '' : e.target.value)} className={`${inputCls} mb-1`}>
          {ESPECIES_RECURSO.map((x) => <option key={x} value={x}>{x}</option>)}
          <option value="__custom">Outro…</option>
        </select>
        {custom && <input autoFocus value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Digite a espécie do recurso" className={`${inputCls} mb-3`} />}

        <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6C757D]">
          Nº do recurso {ehAgravo && <span className="text-[#f51f7e]">(autuação do agravo no tribunal)</span>}
          <span className="font-normal normal-case text-zinc-400"> — opcional</span>
        </label>
        <input
          value={numeroRecurso}
          onChange={(e) => setNumeroRecurso(e.target.value)}
          placeholder={ehAgravo ? 'Ex.: 2001234-56.2026.8.16.0000 (número próprio do agravo)' : 'Se o recurso tiver número próprio no tribunal'}
          className={`${inputCls} mb-1`}
        />
        <p className="mb-3 text-[11px] text-zinc-400">
          {ehAgravo
            ? 'O agravo é autuado com número próprio. Preenchendo aqui, ele fica APENSADO ao processo principal — as publicações do agravo caem neste card, sem virar processo órfão.'
            : 'Preencha se o recurso ganhar número próprio, pra apensar ao processo principal.'}
        </p>

        <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6C757D]">Quem recorreu</label>
        <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-[#DEE2E6] dark:border-zinc-700">
          <button onClick={() => setParte('CLIENTE')} className={`px-3 py-1.5 text-sm font-medium ${parte === 'CLIENTE' ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'}`}>Nós (autor)</button>
          <button onClick={() => setParte('ADVERSA')} className={`px-3 py-1.5 text-sm font-medium ${parte === 'ADVERSA' ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'}`}>Parte adversa</button>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#6C757D]">Motivo do recurso <span className="font-normal normal-case text-zinc-400">(a IA lê a sentença)</span></label>
          <button type="button" onClick={() => sugerirMotivoIA(true)} disabled={iaBusy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7048e8] hover:underline disabled:opacity-50">
            {iaBusy ? <><RefreshCw className="h-3 w-3 animate-spin" /> gerando…</> : <>✨ {motivo.trim() ? 'Refazer com IA' : 'Sugerir com IA'}</>}
          </button>
        </div>
        <div className="relative">
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder={iaBusy ? 'A IA está lendo a sentença…' : 'Por que recorremos (ex.: sentença julgou improcedente a nulidade do RMC…)'} className={`${inputCls} resize-none ${iaBusy ? 'opacity-60' : ''}`} />
          {iaBusy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#7048e8] shadow-sm dark:bg-zinc-800/90"><RefreshCw className="h-3 w-3 animate-spin" /> gerando sugestão…</span></div>}
        </div>
        {activity.dispositivo && (
          <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400" title={activity.dispositivo}>Dispositivo: {activity.dispositivo}</p>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={onSoConcluir} disabled={busy} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Só concluir o prazo</button>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="rounded-md border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Cancelar</button>
            <button onClick={confirmar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-[#02883C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Check className="h-4 w-4" /> Registrar recurso</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="flex gap-2"><dt className="shrink-0 font-medium text-[#6C757D]">{label}{label ? ':' : ''}</dt><dd className="font-normal text-[#202124] dark:text-zinc-200">{children}</dd></div>);
}

// Seletor de etiquetas jurídicas (multi) — ícone de etiqueta no canto superior direito da modal (estilo Astrea).
// O pingo de cor de cada etiqueta abre a paleta e AJUSTA A COR globalmente (mesma
// regra do menu da barra superior): a cor nova reflete em todas as atividades.
function TagSelector({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const qc = useQueryClient();
  const availQ = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#E03131');
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tags = availQ.data ?? [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const recolor = async (id: string, color: string) => {
    setBusy(true);
    try {
      await activitiesService.updateTag(id, { color });
      setPaletteFor(null);
      await qc.invalidateQueries({ queryKey: ['tags-available'] });
      await qc.invalidateQueries({ queryKey: ['activity-tags-index'] });
      await qc.invalidateQueries({ queryKey: ['activity-tags'] });
      toast.success('Cor da etiqueta atualizada');
    } catch (e: any) { toast.error(e?.message || 'Erro ao atualizar cor'); } finally { setBusy(false); }
  };
  const createNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try { const t = await activitiesService.createTag(name, newColor); setNewName(''); availQ.refetch(); onChange([...selected, t.id]); }
    catch (e: any) { toast.error(e?.message || 'Erro'); }
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} title="Etiquetas" className="relative rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800">
        <Tag className="h-5 w-5" />
        {selected.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#228BE6] px-1 text-[9px] font-bold text-white">{selected.length}</span>}
      </button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setPaletteFor(null); }} />
        <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Etiquetas</p>
          <div className="max-h-40 overflow-y-auto">
            {tags.map((t) => { const on = selected.includes(t.id); return (
              <div key={t.id}>
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setPaletteFor(paletteFor === t.id ? null : t.id); }} title="Alterar cor" className="h-3 w-3 shrink-0 rounded-full ring-offset-1 transition hover:ring-2 hover:ring-zinc-300 dark:ring-offset-zinc-900" style={{ backgroundColor: t.color }} />
                  <button type="button" onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {on && <Check className="h-4 w-4 shrink-0 text-[#228BE6]" />}
                  </button>
                </div>
                {paletteFor === t.id && (
                  <div className="flex flex-wrap gap-1.5 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                    {TAG_PALETTE.map((c) => (
                      <button key={c} type="button" disabled={busy} onClick={() => recolor(t.id, c)} className={`h-5 w-5 rounded-full transition disabled:opacity-40 ${t.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-800' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
            ); })}
            {tags.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta jurídica.</p>}
          </div>
          <div className="mt-1 border-t border-[#DEE2E6] px-3 py-2 dark:border-zinc-700">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Nova etiqueta</p>
            <div className="mb-2 flex flex-wrap gap-1.5">{TAG_PALETTE.map((c) => (<button key={c} type="button" onClick={() => setNewColor(c)} className={`h-4 w-4 rounded-full ${newColor === c ? 'ring-2 ring-zinc-400 ring-offset-1 dark:ring-offset-zinc-900' : ''}`} style={{ backgroundColor: c }} />))}</div>
            <div className="flex items-center gap-1.5"><input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createNew(); } }} placeholder="Nome da etiqueta" className="min-w-0 flex-1 rounded border border-[#DEE2E6] px-2 py-1 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /><button type="button" disabled={!newName.trim()} onClick={createNew} className="shrink-0 rounded px-2 py-1 text-xs font-bold uppercase text-white disabled:opacity-40" style={{ backgroundColor: ASTREA_BLUE }}>Criar</button></div>
          </div>
        </div></>)}
    </div>
  );
}

// Busca de processo (combobox): digita número CNJ ou nome e escolhe — substitui o <select> gigante.
function CaseSearch({ value, onChange, cases }: { value: string; onChange: (id: string) => void; cases: { id: string; title: string; cnjNumber: string | null }[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = cases.find((c) => c.id === value);
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const results = (q
    ? cases.filter((c) => c.title.toLowerCase().includes(q) || (digits.length >= 2 && (c.cnjNumber ?? '').replace(/\D/g, '').includes(digits)))
    : cases
  ).slice(0, 8);
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{selected.title}{selected.cnjNumber && <span className="ml-2 font-mono text-xs text-zinc-400">{selected.cnjNumber}</span>}</span>
        <button type="button" onClick={() => { onChange(''); setQuery(''); }} title="Trocar processo" className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Encontre pelo número ou nome…" className={`${inputCls} pl-9`} />
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 right-0 top-11 z-20 max-h-60 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }} className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className="block truncate text-sm text-zinc-800 dark:text-zinc-200">{c.title}</span>
              {c.cnjNumber && <span className="block font-mono text-xs text-zinc-400">{c.cnjNumber}</span>}
            </button>
          ))}
          {results.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">Nenhum processo encontrado.</p>}
        </div></>)}
    </div>
  );
}

// Antecedência (minutos) → rótulo legível. 0 = na hora; múltiplos de dia/hora
// viram "X dia(s)/hora(s) antes"; senão "X min antes".
function reminderLabel(min: number): string {
  if (min <= 0) return 'Na hora';
  if (min % 1440 === 0) { const d = min / 1440; return `${d} dia${d > 1 ? 's' : ''} antes`; }
  if (min % 60 === 0) { const h = min / 60; return `${h} hora${h > 1 ? 's' : ''} antes`; }
  return `${min} min antes`;
}

const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '1 dia', minutes: 1440 },
  { label: '2 dias', minutes: 2880 },
  { label: '1 semana', minutes: 10080 },
];

/**
 * Editor de lembretes do compromisso: chips com as antecedências + adicionar
 * "X minutos/horas/dias antes" (número + unidade) e atalhos rápidos. Padrão
 * inicial = 1 dia + 1 hora antes. Lista vazia = sem aviso.
 */
function RemindersField({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [num, setNum] = useState('30');
  const [unit, setUnit] = useState<'min' | 'hora' | 'dia'>('min');
  const add = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 0 || value.includes(minutes)) return;
    onChange([...value, minutes].sort((a, b) => b - a));
  };
  const addCustom = () => {
    const n = Math.round(Number(num));
    if (!Number.isFinite(n) || n < 0) return;
    add(n * (unit === 'dia' ? 1440 : unit === 'hora' ? 60 : 1));
  };
  return (
    <div className="space-y-2">
      {value.length === 0
        ? <p className="text-xs text-zinc-400">Sem lembrete — você não será avisado deste evento.</p>
        : (
          <div className="flex flex-wrap gap-1.5">
            {value.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full bg-[#228BE6]/10 px-2.5 py-1 text-xs font-medium text-[#228BE6]">
                <CalendarClock className="h-3 w-3" />{reminderLabel(m)}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== m))} className="ml-0.5 rounded-full p-0.5 hover:bg-[#228BE6]/20"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} value={num} onChange={(e) => setNum(e.target.value)} className={`${inputCls} w-16`} />
        <select value={unit} onChange={(e) => setUnit(e.target.value as 'min' | 'hora' | 'dia')} className={`${inputCls} w-28`}>
          <option value="min">minutos</option>
          <option value="hora">horas</option>
          <option value="dia">dias</option>
        </select>
        <span className="text-xs text-zinc-400">antes</span>
        <button type="button" onClick={addCustom} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10"><Plus className="h-3.5 w-3.5" />Adicionar</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {REMINDER_PRESETS.filter((p) => !value.includes(p.minutes)).map((p) => (
          <button key={p.minutes} type="button" onClick={() => add(p.minutes)} className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:text-zinc-400">+ {p.label}</button>
        ))}
      </div>
    </div>
  );
}

function CreateEventDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  // Responsável, via de regra, é QUEM ESTÁ CRIANDO — vem preenchido e pode trocar.
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<EventKind>('audiencia');
  const [startsAt, setStartsAt] = useState(date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '');
  const [location, setLocation] = useState('');
  const [caseId, setCaseId] = useState('');
  const [assignedToId, setAssignedToId] = useState(meId);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!startsAt) return toast.error('Informe a data/hora');
    setSaving(true);
    try {
      const ev = await calendarService.create({ title: title.trim(), kind, startsAt: new Date(startsAt).toISOString(), location: location || undefined, caseId: caseId || undefined, assignedToId: assignedToId || undefined, reminders });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.evento, ev.id, id).catch(() => {})));
      toast.success('Evento criado'); onSaved();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Adicionar evento" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>{(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label={<>Data e hora <span className="text-rose-500">*</span></>}><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Processo"><CaseSearch value={caseId} onChange={setCaseId} cases={cases} /></Field>
          <Field label="Responsável"><select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</select></Field>
        </div>
        <Field label="Local"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputCls} pl-9`} placeholder="Fórum, sala, link…" /></div></Field>
        <Field label="Lembretes"><RemindersField value={reminders} onChange={setReminders} /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}

function CreateAtendimentoDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [userId, setUserId] = useState(meId);
  const [startsAt, setStartsAt] = useState(date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '');
  const [durationMin, setDurationMin] = useState(30);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  // Horários livres do advogado escolhido (disponibilidade − eventos), p/ escolha rápida.
  const { data: slots = [] } = useQuery({
    queryKey: ['atendimento', 'slots', userId, durationMin],
    queryFn: () => calendarService.slots({ userId, durationMin }),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const submit = async () => {
    if (!userId) return toast.error('Escolha o advogado responsável');
    if (!startsAt) return toast.error('Escolha o horário');
    if (!nome.trim()) return toast.error('Informe o nome do cliente');
    setSaving(true);
    try {
      await calendarService.agendarAtendimento({ userId, startsAt: new Date(startsAt).toISOString(), durationMin, nome: nome.trim(), telefone: telefone.trim() || undefined, obs: obs.trim() || undefined });
      toast.success('Atendimento agendado — o responsável foi notificado'); onSaved();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Erro'); } finally { setSaving(false); }
  };

  const fmtSlot = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal title="Agendar atendimento" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Advogado <span className="text-rose-500">*</span></>}>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {members.filter((m) => m.user.isActive).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}{m.user.id === meId ? ' (eu)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Duração"><select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputCls}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
        </div>

        {userId && slots.length > 0 && (
          <Field label="Horários livres (clique para escolher)">
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {slots.slice(0, 16).map((s) => {
                const val = toDatetimeLocal(new Date(s.start));
                const sel = startsAt === val;
                return <button key={s.start} type="button" onClick={() => setStartsAt(val)} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${sel ? 'border-[#B7791F] bg-[#B7791F] text-white' : 'border-[#DEE2E6] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>{fmtSlot(s.start)}</button>;
              })}
            </div>
          </Field>
        )}
        {userId && slots.length === 0 && <p className="text-xs text-amber-600">Sem horários livres configurados para este advogado — defina a disponibilidade ou escolha a data/hora manualmente abaixo.</p>}

        <Field label={<>Data e hora <span className="text-rose-500">*</span></>}><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Cliente <span className="text-rose-500">*</span></>}><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Nome do cliente" /></Field>
          <Field label="Telefone"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" /></Field>
        </div>
        <Field label="Observação"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inputCls} placeholder="Resumo do caso / assunto" /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-40">{saving ? 'Agendando…' : 'Agendar'}</button></div>
    </Modal>
  );
}

function CreateTaskDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  // Responsável, via de regra, é QUEM ESTÁ CRIANDO — vem preenchido e pode trocar.
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [dueAt, setDueAt] = useState(date ? toDateInput(date) : toDateInput(new Date()));
  const [description, setDescription] = useState('');
  const [caseId, setCaseId] = useState('');
  const [assigneeId, setAssigneeId] = useState(meId);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      const task = await tasksService.create({ title: title.trim(), priority, dueAt: dueAt ? new Date(dueAt + 'T09:00:00').toISOString() : null, description: description || undefined, caseId: caseId || undefined, assigneeId: assigneeId || undefined });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.tarefa, task.id, id).catch(() => {})));
      toast.success('Tarefa criada'); onSaved();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Adicionar tarefa" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Processo"><CaseSearch value={caseId} onChange={setCaseId} cases={cases} /></Field>
          <Field label="Responsável"><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade"><select value={priority} onChange={(e) => setPriority(e.target.value as any)} className={inputCls}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></select></Field>
          <Field label="Data"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} /></Field>
        </div>        <Field label="Descrição"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900" /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}

// ── Novo PRAZO pela agenda ────────────────────────────────────────────────────
// Dois modos, exatamente os que o backend aceita (CreateDeadlineDto):
//  • CALCULAR — dias + base (disponibilização / publicação / início da contagem):
//    o servidor conta em dias ÚTEIS (CPC 219/224/220), com dobro (CPC 183/186/229)
//    e corridos quando for o caso, e devolve a data FATAL e o prazo de segurança.
//  • INFORMAR AS DATAS — quando a fatal já é conhecida (veio do Projudi/cálculo).
// A agenda mostra o prazo no dia do PRAZO DE SEGURANÇA; a fatal é a data legal e
// fica na ficha. Prazo SEM processo não existe (a relação é obrigatória).
function CreateDeadlineDialog({ date, onClose, onSaved }: { date?: Date; onClose: () => void; onSaved: () => void }) {
  // Responsável, via de regra, é QUEM ESTÁ CRIANDO — vem preenchido e pode trocar.
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState('');
  const [assignedToId, setAssignedToId] = useState(meId);
  const [type, setType] = useState<'FATAL' | 'ORDINARY' | 'INTERNAL'>('ORDINARY');
  // Clicou num dia do calendário → já sabe a data: abre em "informar as datas".
  const [modo, setModo] = useState<'calc' | 'datas'>(date ? 'datas' : 'calc');
  // modo calcular
  const [dias, setDias] = useState(15);
  const [base, setBase] = useState<'disponibilizacao' | 'publicacao' | 'inicio'>('disponibilizacao');
  const [baseDia, setBaseDia] = useState(toDateInput(new Date()));
  const [dobro, setDobro] = useState(false);
  const [corridos, setCorridos] = useState(false);
  const [preview, setPreview] = useState<PrazoPreview | null>(null);
  // modo datas
  const [fatalDia, setFatalDia] = useState(date ? toDateInput(date) : '');
  const [safeDia, setSafeDia] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });

  // Dia (YYYY-MM-DD) → ISO às 09:00 LOCAL (hora canônica dos itens "dia todo";
  // meia-noite local virava 03:00Z e jogava o prazo pro dia anterior).
  const dayToIso = (v: string) => new Date(`${v}T09:00:00`).toISOString();
  // Base da contagem escolhida no select → o campo que o backend espera.
  const basePayload = () => (base === 'publicacao' ? { publicacao: baseDia } : base === 'inicio' ? { inicio: baseDia } : { disponibilizacao: baseDia });
  const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

  // Prévia do cálculo enquanto digita — mostra a fatal ANTES de salvar.
  useEffect(() => {
    if (modo !== 'calc' || !dias || !baseDia) { setPreview(null); return; }
    let vivo = true;
    const t = setTimeout(() => {
      deadlinesService.preview({ dias, ...basePayload(), dobro, corridos })
        .then((p) => { if (vivo) setPreview(p); })
        .catch(() => { if (vivo) setPreview(null); });
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [modo, dias, base, baseDia, dobro, corridos]);

  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!caseId) return toast.error('Prazo precisa de um processo vinculado');
    if (modo === 'datas' && !fatalDia) return toast.error('Informe o prazo fatal');
    if (modo === 'calc' && (!dias || !baseDia)) return toast.error('Informe os dias e a data da intimação');
    setSaving(true);
    try {
      const dl = await deadlinesService.create({
        caseId,
        title: title.trim(),
        type,
        assignedToId: assignedToId || undefined,
        ...(modo === 'calc'
          ? { dias, ...basePayload(), dobro, corridos }
          : { dueDate: dayToIso(fatalDia), safeDate: dayToIso(safeDia || fatalDia) }),
        // A descrição do prazo não tem coluna própria: mora em metadata.djen.descricao
        // (mesmo lugar que a agenda e a ficha já leem/editam).
        ...(descricao.trim() ? { metadata: { djen: { descricao: descricao.trim() } } } : {}),
      });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.prazo, dl.id, id).catch(() => {})));
      toast.success('Prazo criado'); onSaved();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Erro ao criar o prazo'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Adicionar prazo" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Apresentar contestação" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Processo <span className="text-rose-500">*</span></>}><CaseSearch value={caseId} onChange={setCaseId} cases={cases.map((c) => ({ id: c.id, title: c.title, cnjNumber: c.cnjNumber ?? null }))} /></Field>
          <Field label="Responsável"><select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}{m.user.id === meId ? ' (eu)' : ''}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value as 'FATAL' | 'ORDINARY' | 'INTERNAL')} className={inputCls}><option value="ORDINARY">Comum</option><option value="FATAL">Fatal</option><option value="INTERNAL">Interno</option></select></Field>
          <Field label="Como definir a data">
            <div className="flex h-[38px] items-center gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
              {([['calc', 'Calcular'], ['datas', 'Informar datas']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setModo(v)} className={`h-full flex-1 rounded text-xs font-semibold transition-colors ${modo === v ? 'bg-[#CE0000] text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{l}</button>
              ))}
            </div>
          </Field>
        </div>

        {modo === 'calc' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prazo (dias)"><input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Contar a partir de"><select value={base} onChange={(e) => setBase(e.target.value as 'disponibilizacao' | 'publicacao' | 'inicio')} className={inputCls}><option value="disponibilizacao">Disponibilização</option><option value="publicacao">Publicação</option><option value="inicio">Início da contagem</option></select></Field>
              <Field label="Data"><input type="date" value={baseDia} onChange={(e) => setBaseDia(e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><input type="checkbox" checked={dobro} onChange={(e) => setDobro(e.target.checked)} className="accent-[#CE0000]" />Prazo em dobro (CPC 183/186/229)</label>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><input type="checkbox" checked={corridos} onChange={(e) => setCorridos(e.target.checked)} className="accent-[#CE0000]" />Dias corridos</label>
            </div>
            {preview && (
              <div className="rounded-md border border-[#CE0000]/20 bg-[#CE0000]/5 p-3 text-sm">
                <p className="font-semibold text-[#CE0000]">Data fatal: {fmtDia(preview.dataFatal)}</p>
                <p className="text-zinc-600 dark:text-zinc-300">Prazo de segurança: {fmtDia(preview.prazoSeguranca)} — é neste dia que ele aparece na agenda.</p>
                <p className="mt-1 text-xs text-zinc-500">{preview.modo}{preview.dobro ? ' · em dobro' : ''}</p>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={<>Prazo fatal <span className="text-rose-500">*</span></>}><input type="date" value={fatalDia} onChange={(e) => setFatalDia(e.target.value)} className={inputCls} /></Field>
            <Field label="Prazo de segurança"><input type="date" value={safeDia} onChange={(e) => setSafeDia(e.target.value)} className={inputCls} /></Field>
            <p className="col-span-2 -mt-1 text-xs text-zinc-400">Sem prazo de segurança, ele fica igual à data fatal. A agenda mostra o prazo no dia da segurança.</p>
          </div>
        )}

        <Field label="Descrição"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${inputCls} resize-y`} /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#CE0000] hover:bg-[#CE0000]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}
