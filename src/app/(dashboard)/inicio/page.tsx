'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

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

// ── Incentivos rotativos (motivação + um justo puxão de orelha de elogio). ──
// {dr} = Dr./Dra. · {nome} = primeiro nome.
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

const QUICK = [
  { href: '/inbox', icon: MessageSquare, label: 'Conversas', desc: 'Atender clientes', color: '#228BE6' },
  { href: '/agenda', icon: CalendarCheck, label: 'Agenda', desc: 'Prazos & audiências', color: '#02883C' },
  { href: '/processos', icon: Folder, label: 'Processos', desc: 'Carteira jurídica', color: '#7048E8' },
  { href: '/caixa-djen', icon: Newspaper, label: 'Publicações', desc: 'Intimações do dia', color: '#F76707' },
  { href: '/clientes', icon: Users, label: 'Clientes', desc: 'Quem você defende', color: '#E64980' },
  { href: '/juridico/jurimetria', icon: BarChart3, label: 'Jurimetria', desc: 'Seus números', color: '#15AABF' },
];

const CONFETTI_COLORS = ['#228BE6', '#15AABF', '#7048E8', '#F76707', '#F59F00', '#2F9E44', '#E64980', '#FA5252'];

export default function InicioPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setMounted(true);
    setMsgIdx(Math.floor(Math.random() * HYPE.length));
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const first = firstNameOf(user?.name, user?.email);
  const dr = honorificOf(first);
  const hour = now?.getHours() ?? 12;
  const saud = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const msg = HYPE[msgIdx].replace(/\{dr\}/g, dr).replace(/\{nome\}/g, first);

  // Confete é regenerado a cada "burst" (carga da página e ao trocar o incentivo).
  const confetti = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
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
    setMsgIdx((i) => {
      let n = i;
      while (n === i && HYPE.length > 1) n = Math.floor(Math.random() * HYPE.length);
      return n;
    });
    setBurst((b) => b + 1);
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-10">
      {/* Fundo festivo animado */}
      <div className="welcome-gradient pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#228BE6]/10 via-[#7048E8]/10 to-[#15AABF]/10 dark:from-[#228BE6]/15 dark:via-[#7048E8]/15 dark:to-[#15AABF]/10" />

      {/* Confete */}
      {mounted && (
        <div key={burst} className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size * (c.round ? 1 : 1.6),
                backgroundColor: c.bg,
                borderRadius: c.round ? '9999px' : '2px',
                animation: `confetti-fall ${c.dur}s linear ${c.delay}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl text-center">
        {/* Pílula data/hora */}
        <div className="welcome-pop mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-4 py-1.5 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Scale className="h-3.5 w-3.5 text-[#228BE6]" />
          Hub Frider Andrade
          {now && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="capitalize">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="tabular-nums font-semibold text-zinc-600 dark:text-zinc-300">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          )}
        </div>

        {/* Saudação */}
        <h1 className="welcome-pop text-4xl font-bold tracking-tight text-[#202124] dark:text-zinc-50 sm:text-5xl" style={{ animationDelay: '0.05s' }}>
          {saud},{' '}
          <span className="bg-gradient-to-r from-[#228BE6] via-[#7048E8] to-[#E64980] bg-clip-text text-transparent">
            {dr} {first}
          </span>{' '}
          <span className="welcome-float inline-block">👋</span>
        </h1>

        {/* Incentivo rotativo */}
        <p
          key={msgIdx}
          className="welcome-pop mx-auto mt-5 max-w-2xl text-lg font-medium leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-xl"
          style={{ animationDelay: '0.1s' }}
        >
          {mounted ? msg : ' '}
        </p>

        {/* Botão: novo incentivo */}
        <button
          onClick={novoIncentivo}
          className="welcome-pop mt-6 inline-flex items-center gap-2 rounded-full bg-[#228BE6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#1c7ed6] active:scale-95"
          style={{ animationDelay: '0.15s' }}
        >
          <Sparkles className="h-4 w-4" />
          Me motiva de novo
        </button>

        {/* Atalhos pra começar a trabalhar */}
        <div className="welcome-pop mt-12" style={{ animationDelay: '0.2s' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Por onde vamos começar?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-[#228BE6]/40"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${q.color}1A`, color: q.color }}
                >
                  <q.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{q.label}</span>
                  <span className="block truncate text-xs text-zinc-400">{q.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-[#228BE6]" />
              </Link>
            ))}
          </div>
        </div>

        {/* Fecho */}
        <p className="welcome-pop mt-10 text-sm text-zinc-400" style={{ animationDelay: '0.25s' }}>
          Hoje é um ótimo dia pra mudar a vida de alguém. Vamos? ⚖️✨
        </p>
      </div>
    </div>
  );
}
