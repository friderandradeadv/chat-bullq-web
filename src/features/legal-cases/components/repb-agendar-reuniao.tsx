'use client';

// Agendar reunião direto do card do funil REPB (fase Novos Leads). A Kauani
// vê a agenda do dia ali mesmo, escolhe data/hora e confirma — isso (1) cria o
// evento na Agenda (kind reuniao, vinculado ao caso), (2) grava a data no card
// (faseData.repbc_reuniao_agendada.data) e (3) move o lead para Reunião Agendada.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, CalendarClock, Clock, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { calendarService } from '@/features/calendar/services/calendar.service';
import { membersService } from '@/features/settings/services/members.service';
import { legalCasesService, type KanbanCard } from '@/features/legal-cases/services/legal-cases.service';

const ACCENT = '#E8590C';

// YYYY-MM-DD local (sem drift de UTC).
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function AgendarReuniaoRepb({ card, onClose, onDone }: { card: KanbanCard; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => localDate(1)); // amanhã por padrão
  const [time, setTime] = useState('10:00');
  const [dur, setDur] = useState(60);
  const [respId, setRespId] = useState(card.responsible?.id ?? '');
  const [saving, setSaving] = useState(false);

  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  const assignables = members.filter((m) => m.user.isActive && m.assignable !== false);

  const { data: dayEvents = [], isLoading: loadingDay } = useQuery({
    queryKey: ['calendar', 'day', respId, date],
    queryFn: () => calendarService.list({
      from: new Date(`${date}T00:00:00`).toISOString(),
      to: new Date(`${date}T23:59:59`).toISOString(),
      assignedToId: respId || undefined,
    }),
    enabled: !!date,
  });
  const sortedDay = useMemo(() => [...dayEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [dayEvents]);

  const conflita = useMemo(() => {
    const s = new Date(`${date}T${time}:00`).getTime();
    if (Number.isNaN(s)) return false;
    const e = s + dur * 60000;
    return sortedDay.some((ev) => {
      const es = new Date(ev.startsAt).getTime();
      const ee = ev.endsAt ? new Date(ev.endsAt).getTime() : es + 3600000;
      return s < ee && es < e;
    });
  }, [sortedDay, date, time, dur]);

  const confirmar = async () => {
    const start = new Date(`${date}T${time}:00`);
    if (!time || Number.isNaN(start.getTime())) { toast.error('Escolha data e horário válidos'); return; }
    if (conflita && !confirm('Já existe compromisso nesse horário. Marcar mesmo assim?')) return;
    setSaving(true);
    const startISO = start.toISOString();
    const endISO = new Date(start.getTime() + dur * 60000).toISOString();
    const cliente = card.client ?? card.title;
    try {
      await calendarService.create({
        title: `Reunião REPB — ${cliente}`,
        kind: 'reuniao',
        startsAt: startISO,
        endsAt: endISO,
        caseId: card.id,
        assignedToId: respId || undefined,
      });
      await legalCasesService.saveFaseField(card.id, 'repbc_reuniao_agendada', 'data', startISO);
      await legalCasesService.movePhase(card.id, 'repbc_reuniao_agendada');
      toast.success('Reunião marcada na agenda e lead movido para Reunião Agendada');
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao marcar a reunião');
      setSaving(false);
    }
  };

  const inputCls = 'mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <CalendarClock className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100">Agendar reunião</h2>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{(card.client ?? card.title)?.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Advogado(a) que vai atender</label>
          <select value={respId} onChange={(e) => setRespId(e.target.value)} className={`${inputCls} mb-4`}>
            <option value="">Sem responsável</option>
            {assignables.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </select>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Data</label><input type="date" value={date} min={localDate(0)} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Horário</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Duração</label><select value={dur} onChange={(e) => setDur(Number(e.target.value))} className={inputCls}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 h</option><option value={90}>1h30</option></select></div>
          </div>

          {conflita && <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">⚠ Esse horário conflita com um compromisso já marcado.</p>}

          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <Clock className="h-3.5 w-3.5" /> Agenda de {new Date(`${date}T12:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            {loadingDay ? (
              <p className="text-xs text-zinc-400">Carregando agenda…</p>
            ) : sortedDay.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700">Dia livre — nenhum compromisso.</p>
            ) : (
              <ul className="space-y-1.5">
                {sortedDay.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
                    <span className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-200">{hhmm(ev.startsAt)}{ev.endsAt ? `–${hhmm(ev.endsAt)}` : ''}</span>
                    <span className="truncate text-zinc-500 dark:text-zinc-400">{ev.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={confirmar} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Marcar e mover
          </button>
        </div>
      </div>
    </div>
  );
}
