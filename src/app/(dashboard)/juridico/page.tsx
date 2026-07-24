'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale, AlarmClock, Mail, CalendarDays, BarChart3, AlertTriangle, Gavel,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { deadlinesService } from '@/features/deadlines/services/deadlines.service';
import { djenService } from '@/features/djen/services/djen.service';
import { calendarService } from '@/features/calendar/services/calendar.service';

const BLUE = '#228BE6';
const MS_DAY = 86_400_000;

// Status agrupado igual à aba Processos: baixado = encerrado + arquivado.
const STATUS_GROUPS = [
  { label: 'Ativos', color: '#16a34a', keys: ['ACTIVE'] },
  { label: 'Suspensos', color: '#d97706', keys: ['SUSPENDED'] },
  { label: 'Baixados', color: '#2563eb', keys: ['CLOSED', 'ARCHIVED'] },
] as const;

const KIND_LABEL: Record<string, string> = {
  audiencia: 'Audiência', reuniao: 'Reunião', pericia: 'Perícia', tarefa: 'Tarefa', outro: 'Outro',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function JuridicoDashboardPage() {
  const { data: cases = [], isLoading: lc } = useQuery({
    queryKey: ['legal-cases', 'all'],
    queryFn: () => legalCasesService.list({}),
  });
  const { data: deadlines = [], isLoading: ld } = useQuery({
    queryKey: ['deadlines', 'all'],
    queryFn: () => deadlinesService.list({}),
  });
  const { data: pubs = [] } = useQuery({
    queryKey: ['djen', 'all'],
    queryFn: () => djenService.list({}),
  });
  const { data: events = [] } = useQuery({
    queryKey: ['calendar', 'upcoming-30'],
    queryFn: () => {
      const now = new Date();
      const to = new Date(now.getTime() + 30 * MS_DAY);
      return calendarService.list({ from: now.toISOString(), to: to.toISOString() });
    },
  });

  const m = useMemo(() => {
    const now = Date.now();
    const in7 = now + 7 * MS_DAY;

    const byStatus: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    for (const c of cases) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      const area = (c.area || 'Sem área').toString();
      byArea[area] = (byArea[area] ?? 0) + 1;
    }
    const activeCases = byStatus['ACTIVE'] ?? 0;

    const openDeadlines = deadlines.filter((d) => d.status === 'OPEN');
    const dueSoon = openDeadlines
      .filter((d) => {
        const t = new Date(d.safeDate || d.dueDate).getTime();
        return t <= in7;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const fatalOpen = openDeadlines.filter((d) => d.type === 'FATAL').length;
    const expired = deadlines.filter((d) => d.status === 'EXPIRED').length;

    const pubsToTriage = pubs.filter((p) => p.status === 'CLASSIFIED' || p.status === 'NEW').length;

    const statusData = STATUS_GROUPS
      .map((g) => ({ name: g.label, value: g.keys.reduce((s, k) => s + (byStatus[k] ?? 0), 0), color: g.color }))
      .filter((d) => d.value > 0);

    const areaData = Object.entries(byArea)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const upcoming = [...events].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    ).slice(0, 6);

    return {
      totalCases: cases.length, activeCases, openDeadlines: openDeadlines.length,
      dueSoon, fatalOpen, expired, pubsToTriage, statusData, areaData,
      upcoming, nextEvents: events.length,
    };
  }, [cases, deadlines, pubs, events]);

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
        <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <BarChart3 className="h-4 w-4" style={{ color: BLUE }} /> Dashboard do Jurídico
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Processos, prazos e publicações do escritório.</p>

        {/* KPIs */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Scale} accent={BLUE} label="Processos ativos" value={m.activeCases}
            hint={`${m.totalCases} no total`} />
          <Kpi icon={AlarmClock} accent="#16a34a" label="Prazos em aberto" value={m.openDeadlines}
            hint={`${m.fatalOpen} fatais`} />
          <Kpi icon={AlertTriangle} accent="#dc2626" label="Prazos em 7 dias" value={m.dueSoon.length}
            hint={m.expired ? `${m.expired} vencidos` : 'no prazo'} />
          <Kpi icon={Mail} accent="#d97706" label="Publicações a triar" value={m.pubsToTriage}
            hint="aguardando vínculo" />
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Processos por status" icon={Gavel}>
            {m.statusData.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-52 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={m.statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {m.statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {m.statusData.map((d) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-zinc-600 dark:text-zinc-400">{d.name}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="Processos por área" icon={BarChart3}>
            {m.areaData.length === 0 ? (
              <Empty />
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.areaData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill={BLUE} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>

        {/* Listas */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Próximos prazos (7 dias)" icon={AlarmClock}>
            {m.dueSoon.length === 0 ? (
              <Empty label="Nenhum prazo nos próximos 7 dias." />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {m.dueSoon.slice(0, 7).map((d) => {
                  const overdue = new Date(d.dueDate).getTime() < Date.now();
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.title}</p>
                        <p className="truncate text-xs text-zinc-500">{d.case?.title ?? '—'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {d.type === 'FATAL' && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">fatal</span>
                        )}
                        <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : 'text-zinc-600 dark:text-zinc-300'}`}>
                          {fmtDate(d.dueDate)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Próximos compromissos" icon={CalendarDays}>
            {m.upcoming.length === 0 ? (
              <Empty label="Nenhum compromisso agendado." />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {m.upcoming.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {KIND_LABEL[e.kind] ?? e.kind}{e.case?.title ? ` · ${e.case.title}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {fmtDateTime(e.startsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {(lc || ld) && (
          <p className="mt-6 text-center text-xs text-zinc-400">Carregando dados do jurídico…</p>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, hint, accent,
}: {
  icon: React.ElementType; label: string; value: number; hint?: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function Panel({
  title, icon: Icon, children,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        <Icon className="h-4 w-4 text-zinc-400" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Empty({ label = 'Sem dados ainda.' }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-zinc-400">{label}</p>;
}
