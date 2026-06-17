'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, X, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  calendarService,
  type CalendarEvent,
  type EventKind,
} from '@/features/calendar/services/calendar.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inputCls, Field } from '../processos/page';

const KIND_LABEL: Record<EventKind, string> = {
  audiencia: 'Audiência',
  reuniao: 'Reunião',
  pericia: 'Perícia',
  tarefa: 'Tarefa',
  outro: 'Outro',
};

const KIND_STYLE: Record<EventKind, string> = {
  audiencia: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  reuniao: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pericia: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tarefa: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  outro: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function AgendaPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 90 * 86_400_000);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () =>
      calendarService.list({ from: from.toISOString(), to: to.toISOString() }),
  });

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const day = e.startsAt.slice(0, 10);
    (acc[day] ??= []).push(e);
    return acc;
  }, {});

  const remove = async (e: CalendarEvent) => {
    if (!confirm(`Excluir "${e.title}"?`)) return;
    try {
      await calendarService.remove(e.id);
      qc.invalidateQueries({ queryKey: ['calendar'] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-5 w-5 text-primary" />
            Agenda
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">Audiências, reuniões e perícias — próximos 90 dias</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo compromisso
        </button>
      </div>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {isLoading && <p className="text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-sm text-zinc-400">Sem compromissos nos próximos 90 dias.</p>
        )}
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {fmtDay(day)}
            </h3>
            <div className="space-y-2">
              {items.map((e) => (
                <div
                  key={e.id}
                  className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="w-12 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {fmtTime(e.startsAt)}
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND_STYLE[e.kind]}`}>
                    {KIND_LABEL[e.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {e.case?.title ?? ''}
                      {e.location ? (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(e)}
                    className="opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CreateEventDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['calendar'] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateEventDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<EventKind>('audiencia');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: cases = [] } = useQuery({
    queryKey: ['legal-cases', 'select'],
    queryFn: () => legalCasesService.list({ status: 'ACTIVE' }),
  });

  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!startsAt) return toast.error('Informe a data/hora');
    setSaving(true);
    try {
      await calendarService.create({
        title: title.trim(),
        kind,
        startsAt: new Date(startsAt).toISOString(),
        location: location || undefined,
        caseId: caseId || undefined,
      });
      toast.success('Compromisso criado');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Novo compromisso</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Título *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>
                {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data e hora *">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Local">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Fórum, sala, link…" />
          </Field>
          <Field label="Processo (opcional)">
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={inputCls}>
              <option value="">Nenhum</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
