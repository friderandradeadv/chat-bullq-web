'use client';

import Link from 'next/link';
import { BarChart3, FolderOpen, CalendarDays, Mail, Scale, ChevronRight } from 'lucide-react';

const AREAS = [
  {
    href: '/juridico',
    icon: BarChart3,
    title: 'Dashboard do Jurídico',
    desc: 'Visão geral de processos, prazos e publicações em números.',
    accent: '#228BE6',
  },
  {
    href: '/processos',
    icon: FolderOpen,
    title: 'Processos',
    desc: 'Cadastro e acompanhamento das ações do escritório.',
    accent: '#16a34a',
  },
  {
    href: '/agenda',
    icon: CalendarDays,
    title: 'Agenda & Prazos',
    desc: 'Audiências, perícias, reuniões e prazos em calendário.',
    accent: '#7c3aed',
  },
  {
    href: '/caixa-djen',
    icon: Mail,
    title: 'Publicações',
    desc: 'Publicações do Diário (DJEN), classificação e vínculo ao processo.',
    accent: '#d97706',
  },
];

export default function SettingsJuridicoPage() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-[#228BE6]" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Jurídico</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Acesso rápido às áreas jurídicas do escritório. Tudo num só lugar dentro das Configurações.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {AREAS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${a.accent}1a`, color: a.accent }}
            >
              <a.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {a.title}
                <ChevronRight className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        As publicações são capturadas automaticamente do DJEN pela OAB cadastrada. Para ajustar o
        monitoramento, fale com o suporte do escritório.
      </p>
    </div>
  );
}
