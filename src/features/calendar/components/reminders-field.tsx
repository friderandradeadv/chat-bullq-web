'use client';

import { useState } from 'react';
import { CalendarClock, Plus, X } from 'lucide-react';
import type { EventKind } from '@/features/calendar/services/calendar.service';
import { inputCls } from '@/app/(dashboard)/processos/page';

// Rótulo do tipo de compromisso — o mesmo na agenda, na edição e no diálogo novo.
export const KIND_LABEL: Record<EventKind, string> = { audiencia: 'Audiência', reuniao: 'Reunião', pericia: 'Perícia', tarefa: 'Tarefa', atendimento: 'Atendimento', outro: 'Outro' };

export function reminderLabel(min: number): string {
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
export function RemindersField({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
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