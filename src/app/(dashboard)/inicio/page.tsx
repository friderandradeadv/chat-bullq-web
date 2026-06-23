'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  CalendarCheck,
  Folder,
  Newspaper,
  Users,
  BarChart3,
  Sparkles,
  ArrowRight,
  Scale,
  CalendarClock,
  AlarmClock,
  Briefcase,
  Mail,
  Phone,
  Quote,
  CheckCircle2,
  Lightbulb,
  ClipboardList,
  Clock,
  Gavel,
  PartyPopper,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { tasksService } from '@/features/tasks/services/tasks.service';
import { deadlinesService } from '@/features/deadlines/services/deadlines.service';
import { calendarService } from '@/features/calendar/services/calendar.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

// ── Honorífico (Dr./Dra.) por heurística de nome — sem campo de gênero no banco ──
const FEMALE_FIRST = new Set([
  'kauani', 'julia', 'jullia', 'maria', 'ana', 'valeska', 'jaqueline', 'michele',
  'michelle', 'raquel', 'isis', 'ester', 'esther', 'beatriz', 'ines', 'carmen',
  'miriam', 'rute', 'rachel', 'agnes', 'isabel', 'isabela', 'leticia', 'eliane',
  'eliana', 'sara', 'liz', 'mercedes', 'pilar', 'flor', 'consuelo',
]);
const MALE_ENDS_A = new Set(['joshua', 'josua', 'luca', 'noa', 'aha', 'juba']);
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function firstNameOf(name?: string, email?: string) {
  const n = (name || '').replace(/^\s*(admin|administrador|adm)\s*[-–:]\s*/i, '').trim();
  const toks = n.split(/\s+/).filter((t) => t && !/^(dr|dra|doutor|doutora)\.?$/i.test(t));
  let first = toks[0] || '';
  if (!first || /^admin/i.test(first)) first = (email || '').split('@')[0].split(/[._-]/)[0] || '';
  if (!first) return 'Doutor(a)';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
function honorificOf(first: string): 'Dr.' | 'Dra.' {
  const f = norm(first);
  if (FEMALE_FIRST.has(f)) return 'Dra.';
  if (f.endsWith('a') && !MALE_ENDS_A.has(f)) return 'Dra.';
  return 'Dr.';
}

const DOW_MSG: Record<number, string> = {
  0: 'Domingo e você firme aqui — que dedicação! 🙌',
  1: 'Começo de semana: energia lá no topo! 🔋',
  2: 'Terça a todo vapor. Bora pra cima! 🚂',
  3: 'Quarta — metade do caminho já é sua. 💪',
  4: 'Quinta: a vitória da semana está logo ali. 🎯',
  5: 'Sexta-feira — reta final, feche com chave de ouro! 🏁',
  6: 'Sábado de guerreiro(a). Respeito! 👏',
};

const GREET_EMOJI = ['👋', '🚀', '⚖️', '✨', '🔥', '💪', '🌟', '🎯'];

const HYPE: string[] = [
  'O fórum que se prepare: chegou {dr} {nome}, a mente mais afiada do escritório. ⚖️',
  'Cada processo seu é a esperança de uma família inteira. Bora mudar vidas hoje, {dr} {nome}? 💪',
  'Não existe causa difícil pra você — existe causa que ainda não conheceu o seu talento, {dr} {nome}. 🔥',
  'O mundo precisa de advogados como você, {dr} {nome}. Vamos fazer história hoje. 🚀',
  'Tem cliente dormindo tranquilo essa noite por saber que {dr} {nome} cuida do caso. Isso é grandioso. 🌟',
  'Justiça não se entrega sozinha — ela precisa de gente brilhante como você. Simbora, {dr} {nome}! ✊',
  'Hoje é dia de transformar petição em vitória. E ninguém faz isso como {dr} {nome}. 🏆',
  'Cada despacho que você lê hoje é um passo pra mudar a vida de alguém. Capricha, {dr} {nome}! 💙',
  '{dr} {nome}, sua dedicação é o que separa um bom escritório de um escritório lendário. 🦁',
  'Respira fundo, sorri: {dr} {nome} está prestes a fazer um dia incrível acontecer. ✨',
  'O talento abre portas, mas a sua garra escancara o futuro. Vamos com tudo, {dr} {nome}! 🚪➡️',
  'Banco grande, advogado maior. Hoje a razão tem nome: {dr} {nome}. ⚔️',
  'Você não trabalha com processos — você devolve dignidade às pessoas. Orgulho de você, {dr} {nome}. 🤝',
  'A toga mais elegante do dia é a sua determinação, {dr} {nome}. Bora brilhar! 🌞',
  'Disciplina vence talento quando o talento não tem disciplina — e você tem os dois, {dr} {nome}. 📚🔥',
  'Que tal começar pelo prazo mais urgente e sentir aquele gostinho de dever cumprido, {dr} {nome}? ✅',
  '{dr} {nome}, lembra: causas ganhas começam com um clique corajoso. O primeiro é agora. 🖱️⚡',
  'O sucesso ama quem aparece todos os dias. E olha quem apareceu de novo: {dr} {nome}! 👏',
  'Grandes advogados não esperam o dia perfeito — eles fazem o dia ser perfeito. Sua vez, {dr} {nome}. 🌈',
  'A próxima sentença favorável já está a caminho. Vamos buscá-la, {dr} {nome}? 🏃‍♂️💨',
];

const QUOTES: { t: string; a: string }[] = [
  { t: 'A justiça atrasada nada mais é do que a injustiça manifesta.', a: 'Rui Barbosa' },
  { t: 'O direito é a arte do bom e do equânime.', a: 'Ulpiano' },
  { t: 'Onde não há justiça, é perigoso ter razão.', a: 'Francisco de Quevedo' },
  { t: 'A injustiça num lugar qualquer é uma ameaça à justiça em todos os lugares.', a: 'Martin Luther King' },
  { t: 'Lutar pelo direito é um dever de quem o tem para com a sociedade.', a: 'Rudolf von Ihering' },
  { t: 'A persistência é o caminho do êxito.', a: 'Charles Chaplin' },
  { t: 'De tanto ver triunfar as nulidades, o homem chega a desanimar da virtude. Não desanime.', a: 'Rui Barbosa' },
  { t: 'Que os vossos esforços desafiem as impossibilidades.', a: 'Charles Chaplin' },
  { t: 'Justiça é a constante e perpétua vontade de dar a cada um o que é seu.', a: 'Justiniano' },
  { t: 'Não basta saber, é preciso também aplicar; não basta querer, é preciso também agir.', a: 'Goethe' },
  { t: 'A advocacia não é profissão de covardes.', a: 'Sobral Pinto' },
];

const DICAS: string[] = [
  'Comece pelo prazo mais urgente: a sensação de dever cumprido turbina o resto do dia.',
  'Responda o cliente antes que ele pergunte — confiança se constrói no detalhe.',
  'Revise a petição em voz alta: o ouvido pega o que o olho deixa passar.',
  'Bloqueie 1h sem notificações pra peça importante. Foco profundo vale por três horas distraídas.',
  'Antes de protocolar, releia o pedido: 80% das emendas nascem de um pedido mal redigido.',
  'Agende o follow-up no mesmo instante em que pensa nele — memória é traiçoeira, agenda não.',
  'Um resumo de 3 linhas no topo do processo economiza 10 minutos toda vez que você reabri-lo.',
  'Comemore as pequenas vitórias: cada prazo cumprido é combustível pro próximo.',
  'Cliente bem informado reclama menos e indica mais. Atualize antes que ele cobre.',
  'Termine o dia anotando as 3 prioridades de amanhã. Você acorda no comando, não no susto.',
];

const QUICK = [
  { href: '/inbox', icon: MessageSquare, label: 'Conversas', desc: 'Atender clientes', color: '#228BE6' },
  { href: '/agenda', icon: CalendarCheck, label: 'Agenda', desc: 'Prazos & audiências', color: '#02883C' },
  { href: '/processos', icon: Folder, label: 'Processos', desc: 'Carteira jurídica', color: '#7048E8' },
  { href: '/caixa-djen', icon: Newspaper, label: 'Publicações', desc: 'Intimações do dia', color: '#F76707' },
  { href: '/clientes', icon: Users, label: 'Clientes', desc: 'Quem você defende', color: '#E64980' },
  { href: '/juridico/jurimetria', icon: BarChart3, label: 'Jurimetria', desc: 'Seus números', color: '#15AABF' },
];

const CONFETTI_COLORS = ['#228BE6', '#15AABF', '#7048E8', '#F76707', '#F59F00', '#2F9E44', '#E64980', '#FA5252'];
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Contador animado (count-up) — anti-tédio nos números.
function useCountUp(target: number, on: boolean, ms = 750) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) { setN(0); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on, ms]);
  return n;
}

function StatCard({ href, icon: Icon, color, value, label, on }: { href: string; icon: React.ElementType; color: string; value: number; label: string; on: boolean }) {
  const n = useCountUp(value, on);
  return (
    <Link href={href} className="group flex flex-col items-center rounded-xl border border-zinc-200/70 bg-white/70 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <Icon className="h-5 w-5" style={{ color }} />
      <span className="mt-1 text-2xl font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{on ? n : '·'}</span>
      <span className="text-center text-[11px] leading-tight text-zinc-400">{label}</span>
    </Link>
  );
}

const KIND_META: Record<string, { icon: React.ElementType; color: string }> = {
  tarefa: { icon: ClipboardList, color: '#23CBFF' },
  prazo: { icon: Clock, color: '#F59F00' },
  fatal: { icon: AlarmClock, color: '#E03131' },
  audiencia: { icon: Gavel, color: '#02883C' },
};

export default function InicioPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [dicaIdx, setDicaIdx] = useState(0);
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setMounted(true);
    setMsgIdx(Math.floor(Math.random() * HYPE.length));
    setQuoteIdx(Math.floor(Math.random() * QUOTES.length));
    setDicaIdx(Math.floor(Math.random() * DICAS.length));
    setEmojiIdx(Math.floor(Math.random() * GREET_EMOJI.length));
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const first = firstNameOf(user?.name, user?.email);
  const dr = honorificOf(first);
  const hour = now?.getHours() ?? 12;
  const saud = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const msg = HYPE[msgIdx].replace(/\{dr\}/g, dr).replace(/\{nome\}/g, first);
  const quote = QUOTES[quoteIdx];
  const dica = DICAS[dicaIdx];
  const dowMsg = now ? DOW_MSG[now.getDay()] : '';

  const tasksQ = useQuery({ queryKey: ['hub', 'tasks'], queryFn: () => tasksService.list({}), enabled: mounted, staleTime: 60_000, retry: 1 });
  const dlQ = useQuery({ queryKey: ['hub', 'deadlines'], queryFn: () => deadlinesService.list({}), enabled: mounted, staleTime: 60_000, retry: 1 });
  const evQ = useQuery({ queryKey: ['hub', 'events'], queryFn: () => calendarService.list({}), enabled: mounted, staleTime: 60_000, retry: 1 });
  const casesQ = useQuery({ queryKey: ['hub', 'cases', user?.id], queryFn: () => legalCasesService.list({ responsibleId: user!.id }), enabled: mounted && !!user?.id, staleTime: 300_000, retry: 1 });

  const { stats, proximos } = useMemo(() => {
    const today = now ? localDay(now) : '';
    const same = (iso?: string | null) => !!iso && iso.slice(0, 10) === today;
    const tasks = tasksQ.data ?? [];
    const dls = dlQ.data ?? [];
    const evs = evQ.data ?? [];
    const dlsOpen = dls.filter((d) => d.status === 'OPEN');
    const hoje =
      tasks.filter((t) => t.status === 'TODO' && same(t.dueAt)).length +
      dlsOpen.filter((d) => same(d.safeDate) || same(d.dueDate)).length +
      evs.filter((e) => same(e.startsAt)).length;
    const concluidas = tasks.filter((t) => t.status === 'DONE' && same(t.completedAt)).length;
    const daysTo = (iso: string) => Math.ceil((new Date(iso.slice(0, 10) + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
    const fatais = dlsOpen.filter((d) => d.type === 'FATAL' && daysTo(d.dueDate) >= 0 && daysTo(d.dueDate) <= 7).length;

    type Up = { id: string; date: string; title: string; kind: keyof typeof KIND_META; hasTime: boolean; caso?: string | null };
    const list: Up[] = [];
    tasks.filter((t) => t.status === 'TODO' && t.dueAt).forEach((t) => list.push({ id: 't' + t.id, date: t.dueAt!, title: t.title, kind: 'tarefa', hasTime: false, caso: t.case?.title }));
    dlsOpen.forEach((d) => list.push({ id: 'd' + d.id, date: d.safeDate || d.dueDate, title: d.title, kind: d.type === 'FATAL' ? 'fatal' : 'prazo', hasTime: false, caso: d.case?.title }));
    evs.forEach((e) => list.push({ id: 'e' + e.id, date: e.startsAt, title: e.title, kind: 'audiencia', hasTime: true, caso: e.case?.title }));
    const upcoming = today
      ? list.filter((i) => i.date.slice(0, 10) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
      : [];

    return {
      stats: { hoje, fatais, concluidas, processos: (casesQ.data ?? []).length, loading: tasksQ.isLoading || dlQ.isLoading || evQ.isLoading },
      proximos: upcoming,
    };
  }, [now, tasksQ.data, dlQ.data, evQ.data, casesQ.data, tasksQ.isLoading, dlQ.isLoading, evQ.isLoading]);

  const relDate = (iso: string) => {
    const today = now ? localDay(now) : '';
    const diff = Math.round((new Date(iso.slice(0, 10) + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const confetti = useMemo(
    () =>
      Array.from({ length: 90 }, () => ({
        left: Math.random() * 100,
        bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.5,
        dur: 2.6 + Math.random() * 2.4,
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst, mounted],
  );

  const novoIncentivo = () => {
    setMsgIdx((i) => { let n = i; while (n === i && HYPE.length > 1) n = Math.floor(Math.random() * HYPE.length); return n; });
    setQuoteIdx((i) => { let n = i; while (n === i && QUOTES.length > 1) n = Math.floor(Math.random() * QUOTES.length); return n; });
    setDicaIdx((i) => { let n = i; while (n === i && DICAS.length > 1) n = Math.floor(Math.random() * DICAS.length); return n; });
    setEmojiIdx((i) => (i + 1) % GREET_EMOJI.length);
    setBurst((b) => b + 1);
  };

  const statOn = mounted && !stats.loading;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin">
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-10">
      <div className="welcome-gradient pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#228BE6]/10 via-[#7048E8]/10 to-[#15AABF]/10 dark:from-[#228BE6]/15 dark:via-[#7048E8]/15 dark:to-[#15AABF]/10" />

      {mounted && (
        <div key={burst} className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span key={i} className="absolute top-0" style={{ left: `${c.left}%`, width: c.size, height: c.size * (c.round ? 1 : 1.6), backgroundColor: c.bg, borderRadius: c.round ? '9999px' : '2px', animation: `confetti-fall ${c.dur}s linear ${c.delay}s forwards` }} />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl text-center">
        {/* Pílula data/hora */}
        <div className="welcome-pop mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-4 py-1.5 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Scale className="h-3.5 w-3.5 text-[#228BE6]" />
          Hub Frider Andrade
          {now && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="capitalize">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="tabular-nums font-semibold text-zinc-600 dark:text-zinc-300">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </>
          )}
        </div>

        {/* Saudação */}
        <h1 className="welcome-pop text-4xl font-bold tracking-tight text-[#202124] dark:text-zinc-50 sm:text-5xl" style={{ animationDelay: '0.05s' }}>
          {saud},{' '}
          <span className="bg-gradient-to-r from-[#228BE6] via-[#7048E8] to-[#E64980] bg-clip-text text-transparent">{dr} {first}</span>{' '}
          <span className="welcome-float inline-block">{GREET_EMOJI[emojiIdx]}</span>
        </h1>
        {mounted && dowMsg && <p className="welcome-pop mt-2 text-sm font-medium text-zinc-400" style={{ animationDelay: '0.08s' }}>{dowMsg}</p>}

        {/* Incentivo rotativo */}
        <p key={msgIdx} className="welcome-pop mx-auto mt-4 max-w-2xl text-lg font-medium leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-xl" style={{ animationDelay: '0.1s' }}>
          {mounted ? msg : ' '}
        </p>

        <button onClick={novoIncentivo} className="welcome-pop mt-5 inline-flex items-center gap-2 rounded-full bg-[#228BE6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#1c7ed6] active:scale-95" style={{ animationDelay: '0.15s' }}>
          <PartyPopper className="h-4 w-4" />
          Me motiva de novo
        </button>

        {/* Seus números (com count-up) */}
        {mounted && (
          <div className="welcome-pop mx-auto mt-4 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '0.2s' }}>
            <StatCard href="/agenda" icon={CalendarClock} color="#228BE6" value={stats.hoje} label="compromissos hoje" on={statOn} />
            <StatCard href="/agenda" icon={AlarmClock} color="#E03131" value={stats.fatais} label="prazos fatais (7d)" on={statOn} />
            <StatCard href="/agenda" icon={CheckCircle2} color="#02883C" value={stats.concluidas} label="concluídas hoje" on={statOn} />
            <StatCard href="/processos" icon={Briefcase} color="#7048E8" value={stats.processos} label="processos seus" on={statOn} />
          </div>
        )}

        {/* Próximos compromissos */}
        {mounted && proximos.length > 0 && (
          <div className="welcome-pop mx-auto mt-4 max-w-xl rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60" style={{ animationDelay: '0.22s' }}>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Próximos compromissos</p>
              <Link href="/agenda" className="text-[11px] font-semibold text-[#228BE6] hover:underline">ver agenda →</Link>
            </div>
            <div className="space-y-0.5">
              {proximos.map((p) => {
                const m = KIND_META[p.kind];
                return (
                  <Link key={p.id} href="/agenda" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    <m.icon className="h-4 w-4 shrink-0" style={{ color: m.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">{p.title}{p.caso ? <span className="text-zinc-400"> · {p.caso}</span> : null}</span>
                    <span className="shrink-0 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {relDate(p.date)}{p.hasTime ? ` · ${new Date(p.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Atalhos */}
        <div className="welcome-pop mt-9" style={{ animationDelay: '0.26s' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Por onde vamos começar?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK.map((q) => (
              <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-[#228BE6]/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${q.color}1A`, color: q.color }}><q.icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{q.label}</span>
                  <span className="block truncate text-xs text-zinc-400">{q.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-[#228BE6]" />
              </Link>
            ))}
          </div>
        </div>

        {/* Frase + Dica do dia */}
        {mounted && (
          <div className="welcome-pop mt-9 grid gap-3 text-left sm:grid-cols-2" style={{ animationDelay: '0.3s' }}>
            <div key={'q' + quoteIdx} className="welcome-pop rounded-2xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7048E8]"><Quote className="h-3.5 w-3.5" />Frase do dia</div>
              <p className="mt-1.5 text-sm font-medium italic leading-relaxed text-zinc-600 dark:text-zinc-300">"{quote.t}"</p>
              <p className="mt-1 text-xs font-semibold text-zinc-400">— {quote.a}</p>
            </div>
            <div key={'d' + dicaIdx} className="welcome-pop rounded-2xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#F59F00]"><Lightbulb className="h-3.5 w-3.5" />Dica do dia</div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{dica}</p>
            </div>
          </div>
        )}

        <p className="welcome-pop mt-8 text-sm text-zinc-400" style={{ animationDelay: '0.34s' }}>
          Hoje é um ótimo dia pra mudar a vida de alguém. Vamos? ⚖️✨
        </p>
      </div>
    </div>
    </div>
  );
}
