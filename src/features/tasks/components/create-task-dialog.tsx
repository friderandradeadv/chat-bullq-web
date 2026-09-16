'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { activitiesService, ENTITY_TYPE } from '@/features/activities/services/activities.service';
import { tasksService } from '@/features/tasks/services/tasks.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import { CaseField } from '@/features/legal-cases/components/case-search';
import { TagSelector } from '@/features/activities/components/tag-selector';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/stores/auth-store';
import { toDateInput } from '@/lib/datas-form';
import { inputCls, Field } from '@/app/(dashboard)/processos/page';

// ── Nova TAREFA ───────────────────────────────────────────────────────────────
// O mesmo diálogo na agenda e na ficha do processo; lá o processo vem travado.
export function CreateTaskDialog({
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
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [dueAt, setDueAt] = useState(date ? toDateInput(date) : toDateInput(new Date()));
  const [description, setDescription] = useState('');
  const [caseId, setCaseId] = useState(fixedCase?.id ?? '');
  const [assigneeId, setAssigneeId] = useState(meId);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Dentro do processo o caso já está decidido: não busca a lista inteira.
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }), enabled: !fixedCase });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      const task = await tasksService.create({ title: title.trim(), priority, dueAt: dueAt ? new Date(dueAt + 'T09:00:00').toISOString() : null, description: description || undefined, caseId: caseId || undefined, assigneeId: assigneeId || undefined });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.tarefa, task.id, id).catch(() => {})));
      toast.success('Tarefa criada'); onSaved();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Adicionar tarefa" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Processo"><CaseField value={caseId} onChange={setCaseId} fixedCase={fixedCase} cases={cases} /></Field>
          <Field label="Responsável"><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade"><select value={priority} onChange={(e) => setPriority(e.target.value as any)} className={inputCls}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></select></Field>
          <Field label="Data"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} /></Field>
        </div>        <Field label="Descrição"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900" /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}
