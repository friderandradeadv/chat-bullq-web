'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, FolderOpen, CalendarDays, Mail, Scale, ChevronRight, UserCog, Columns3 } from 'lucide-react';
import { membersService } from '@/features/settings/services/members.service';
import { areaAssignmentService, LEGAL_AREAS, type AreaAssignment } from '@/features/settings/services/area-assignment.service';

const AREA_DOT: Record<string, string> = {
  'Bancário': '#228BE6', 'Previdenciário': '#7048e8', 'Trabalhista': '#f08c00',
  'Consumidor': '#e64980', 'Cível': '#868e96',
};

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
  {
    href: '/settings/juridico/fases',
    icon: Columns3,
    title: 'Fases dos Kanbans',
    desc: 'Renomear, reordenar, esconder e criar fases dos kanbans (sócios).',
    accent: '#228BE6',
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

      <AreaAssignmentSection />

      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        As publicações são capturadas automaticamente do DJEN pela OAB cadastrada. Para ajustar o
        monitoramento, fale com o suporte do escritório.
      </p>
    </div>
  );
}

/** Atribuição automática de novos clientes por área → advogado responsável. */
function AreaAssignmentSection() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  const { data: current } = useQuery({ queryKey: ['area-assignment'], queryFn: () => areaAssignmentService.get() });
  const [map, setMap] = useState<AreaAssignment>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (current) setMap(current); }, [current]);

  const assignable = members.filter((m) => m.assignable !== false);
  const set = (area: string, userId: string) => setMap((m) => ({ ...m, [area]: userId }));

  const save = async () => {
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(map).filter(([, v]) => v));
      await areaAssignmentService.update(clean);
      qc.invalidateQueries({ queryKey: ['area-assignment'] });
      toast.success('Atribuição por área salva');
    } catch {
      toast.error('Erro ao salvar a atribuição');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-[#228BE6]" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Atribuição de novos clientes por área</h3>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Escolha o advogado que recebe automaticamente os novos clientes de cada área. Vale
        para os <strong className="font-semibold text-zinc-700 dark:text-zinc-300">dois lados do mesmo lead</strong>:
        quem o robô entrega a <strong className="font-semibold text-zinc-700 dark:text-zinc-300">conversa no chat</strong> ao
        terminar o atendimento, e quem fica <strong className="font-semibold text-zinc-700 dark:text-zinc-300">dono do card</strong> no
        kanban quando o contrato é assinado. A troca vale já no próximo lead — não mexe em quem já entrou,
        e cards com responsável escolhido à mão não são afetados.
      </p>

      <div className="mt-4 space-y-2">
        {LEGAL_AREAS.map((area) => (
          <div key={area} className="flex items-center gap-3">
            <span className="flex w-36 shrink-0 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: AREA_DOT[area] ?? '#868e96' }} />
              {area}
            </span>
            <select
              value={map[area] ?? ''}
              onChange={(e) => set(area, e.target.value)}
              className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="">— Ninguém (sem atribuição automática) —</option>
              {assignable.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#005efc] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar atribuições'}
        </button>
      </div>
    </section>
  );
}
