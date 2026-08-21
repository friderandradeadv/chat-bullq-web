'use client';

import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { TRILHAS, TOTAL_AULAS, TOTAL_MINUTOS } from '@/features/academia/content';

/**
 * Chamada para a Academia. Vive no Meu Espaço (abas Manuais e Onboarding), onde
 * a pessoa procura material de treinamento — os manuais dali são avulsos, a
 * trilha completa está na Academia.
 */
export function AcademiaCallout({ contexto = 'manuais' }: { contexto?: 'manuais' | 'onboarding' }) {
  const horas = Math.round(TOTAL_MINUTOS / 60);
  return (
    <Link
      href="/academia"
      className="mt-2 flex items-center gap-3.5 rounded-2xl border border-[#7048E8]/30 bg-[#7048E8]/5 p-4 transition hover:bg-[#7048E8]/10 dark:border-[#7048E8]/40 dark:bg-[#7048E8]/10 dark:hover:bg-[#7048E8]/20"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7048E8]/15 text-[#7048E8]">
        <GraduationCap className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">Academia Frider</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {contexto === 'onboarding'
            ? 'A trilha completa de quem entra: cultura, hub, Claude, prazos, teses, cliente e ética.'
            : 'Os manuais completos, com vídeo e checklist, trilha por trilha.'}
        </span>
        <span className="mt-1 block text-[11px] font-medium text-[#7048E8]">
          {TRILHAS.length} trilhas · {TOTAL_AULAS} aulas · cerca de {horas} h
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[#7048E8]" />
    </Link>
  );
}
