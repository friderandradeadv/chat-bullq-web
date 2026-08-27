'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarCheck,
  CircleDollarSign,
  Columns3,
  Gavel,
  Handshake,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { usePartnerLock, useMinhasParcerias } from '@/features/partnerships/hooks/use-partnership';
import { partnershipsService } from '@/features/partnerships/services/partnerships.service';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const FASE_LABEL: Record<string, string> = {
  novos_clientes: 'Novos clientes',
  documentacao: 'Documentação',
  analise: 'Análise',
  protocolo: 'Protocolo',
};

export default function ParceriaPage() {
  const travada = usePartnerLock();
  const todas = useMinhasParcerias();
  // Sócio que participa da parceria abre esta página sem estar travado: nesse
  // caso usa a primeira parceria de que ele é membro.
  const parceria = travada ?? todas[0] ?? null;

  const { data: casos, isLoading: carregandoCasos } = useQuery({
    queryKey: ['parceria', parceria?.id, 'casos'],
    queryFn: () => partnershipsService.casos(parceria!.id),
    enabled: !!parceria,
  });

  const { data: acerto } = useQuery({
    queryKey: ['parceria', parceria?.id, 'acerto'],
    queryFn: () => partnershipsService.acerto(parceria!.id),
    enabled: !!parceria,
  });

  if (!parceria) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <Handshake className="mx-auto size-10 text-zinc-300 dark:text-zinc-700" />
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Você ainda não está em nenhuma parceria
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Peça ao escritório para incluir você em Configurações › Parcerias.
        </p>
      </div>
    );
  }

  const abertos = (casos ?? []).filter((c) => c.status === 'ACTIVE');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: parceria.color }}
        >
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900 dark:text-white">
            {parceria.name}
          </h1>
          <p className="text-sm text-zinc-500">
            {parceria.areas.length ? parceria.areas.join(' · ') : 'Parceria'} ·{' '}
            {parceria.partnerPct}% do resultado é seu
          </p>
        </div>
      </div>

      {/* Números do acerto */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Recebido"
          valor={acerto ? brl(acerto.resumo.recebido) : '—'}
          hint="honorários já entrados nos casos da parceria"
        />
        <Kpi
          label="A receber"
          valor={acerto ? brl(acerto.resumo.aReceber) : '—'}
          hint="lançado e ainda não pago"
        />
        <Kpi
          label="Custos diretos"
          valor={acerto ? brl(acerto.resumo.custosDiretos) : '—'}
          hint="o que a parceria divide (perícia, custas, tráfego)"
        />
        <Kpi
          label="Sua parte"
          valor={acerto ? brl(acerto.resumo.doParceiro) : '—'}
          hint={`${parceria.partnerPct}% do líquido`}
          destaque={parceria.color}
        />
      </div>

      {/* Atalhos */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Atalho href="/inbox" icon={MessageSquare} titulo="Conversas" desc="Clientes da parceria" />
        <Atalho href="/juridico/planejamento" icon={Columns3} titulo="Kanban" desc="Andamento por fase" />
        <Atalho href="/processos" icon={Gavel} titulo="Processos" desc={`${casos?.length ?? 0} no recorte`} />
        <Atalho href="/prazos" icon={Scale} titulo="Prazos" desc="Do que é da parceria" />
        <Atalho href="/agenda" icon={CalendarCheck} titulo="Agenda" desc="Audiências e reuniões" />
        <Atalho
          href="/parceria/financeiro"
          icon={CircleDollarSign}
          titulo="Financeiro"
          desc="Acerto e lançamentos"
        />
      </div>

      {/* Casos */}
      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Casos da parceria
          </h2>
          <span className="text-xs text-zinc-500">
            {abertos.length} ativo{abertos.length === 1 ? '' : 's'} de {casos?.length ?? 0}
          </span>
        </div>

        {carregandoCasos ? (
          <div className="rounded-xl border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
            Carregando…
          </div>
        ) : !casos?.length ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              Nenhum processo marcado nesta parceria ainda.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              O escritório marca os processos em Configurações › Parcerias.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Processo</th>
                  <th className="px-4 py-2.5 font-medium">Fase</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor da causa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {casos.map((c) => (
                  <tr key={c.caseId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/juridico/planejamento?case=${c.caseId}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-white"
                      >
                        {c.cliente ?? c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{c.cnj ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {c.fase ? (FASE_LABEL[c.fase] ?? c.fase) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {c.valor ? brl(c.valor) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  valor,
  hint,
  destaque,
}: {
  label: string;
  valor: string;
  hint: string;
  destaque?: string;
}) {
  return (
    <div
      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      style={destaque ? { borderColor: destaque } : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white"
        style={destaque ? { color: destaque } : undefined}
      >
        {valor}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-400">{hint}</p>
    </div>
  );
}

function Atalho({
  href,
  icon: Icon,
  titulo,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/40"
    >
      <Icon className="size-5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
          {titulo}
        </span>
        <span className="block truncate text-xs text-zinc-500">{desc}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
    </Link>
  );
}
