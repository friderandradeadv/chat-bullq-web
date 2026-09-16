'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService, ENTITY_TYPE } from '@/features/activities/services/activities.service';
import { calendarService, type EventKind } from '@/features/calendar/services/calendar.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import { CaseField } from '@/features/legal-cases/components/case-search';
import { TagSelector } from '@/features/activities/components/tag-selector';
import { KIND_LABEL, RemindersField } from '@/features/calendar/components/reminders-field';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/stores/auth-store';
import { toDatetimeLocal } from '@/lib/datas-form';
import { inputCls, Field } from '@/app/(dashboard)/processos/page';

// ── Novo EVENTO (audiência, reunião, perícia…) ────────────────────────────────
// O mesmo diálogo na agenda e na ficha do processo; lá o processo vem travado.
export function CreateEventDialog({
  date,
  fixedCase,
  onClose,
  onSaved,
}: {
  date?: Date;
  fixedCase?: { id: string; title: string; cnjNumber: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  // Responsável, via de regra, é QUEM ESTÁ CRIANDO — vem preenchido e pode trocar.
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<EventKind>('audiencia');
  const [startsAt, setStartsAt] = useState(date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '');
  const [location, setLocation] = useState('');
  const [caseId, setCaseId] = useState(fixedCase?.id ?? '');
  const [assignedToId, setAssignedToId] = useState(meId);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Dentro do processo o caso já está decidido: não busca a lista inteira.
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }), enabled: !fixedCase });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!startsAt) return toast.error('Informe a data/hora');
    setSaving(true);
    try {
      const ev = await calendarService.create({ title: title.trim(), kind, startsAt: new Date(startsAt).toISOString(), location: location || undefined, caseId: caseId || undefined, assignedToId: assignedToId || undefined, reminders });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.evento, ev.id, id).catch(() => {})));
      toast.success('Evento criado'); onSaved();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Adicionar evento" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>{(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label={<>Data e hora <span className="text-rose-500">*</span></>}><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Processo"><CaseField value={caseId} onChange={setCaseId} fixedCase={fixedCase} cases={cases} /></Field>
          <Field label="Responsável"><select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</select></Field>
        </div>
        <Field label="Local"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputCls} pl-9`} placeholder="Fórum, sala, link…" /></div></Field>
        <Field label="Lembretes"><RemindersField value={reminders} onChange={setReminders} /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}
