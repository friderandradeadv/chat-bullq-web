'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarService } from '@/features/calendar/services/calendar.service';
import { membersService } from '@/features/settings/services/members.service';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/stores/auth-store';
import { toDatetimeLocal } from '@/lib/datas-form';
import { inputCls, Field } from '@/app/(dashboard)/processos/page';

// ── Novo ATENDIMENTO ──────────────────────────────────────────────────────────
// Atendimento é hora na agenda de um ADVOGADO com um cliente: não tem vínculo
// com processo (o backend não guarda caseId). Aberto da ficha, o que dá para
// aproveitar é o cliente, que já vem preenchido.
export function CreateAtendimentoDialog({
  date,
  cliente,
  onClose,
  onSaved,
}: {
  date?: Date;
  /** Aberto de dentro de um processo: já vem com o cliente do caso preenchido. */
  cliente?: { nome: string; telefone?: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [userId, setUserId] = useState(meId);
  const [startsAt, setStartsAt] = useState(date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '');
  const [durationMin, setDurationMin] = useState(30);
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });
  // Horários livres do advogado escolhido (disponibilidade − eventos), p/ escolha rápida.
  const { data: slots = [] } = useQuery({
    queryKey: ['atendimento', 'slots', userId, durationMin],
    queryFn: () => calendarService.slots({ userId, durationMin }),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const submit = async () => {
    if (!userId) return toast.error('Escolha o advogado responsável');
    if (!startsAt) return toast.error('Escolha o horário');
    if (!nome.trim()) return toast.error('Informe o nome do cliente');
    setSaving(true);
    try {
      await calendarService.agendarAtendimento({ userId, startsAt: new Date(startsAt).toISOString(), durationMin, nome: nome.trim(), telefone: telefone.trim() || undefined, obs: obs.trim() || undefined });
      toast.success('Atendimento agendado — o responsável foi notificado'); onSaved();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Erro'); } finally { setSaving(false); }
  };

  const fmtSlot = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal title="Agendar atendimento" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Advogado <span className="text-rose-500">*</span></>}>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {members.filter((m) => m.user.isActive).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}{m.user.id === meId ? ' (eu)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Duração"><select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputCls}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
        </div>

        {userId && slots.length > 0 && (
          <Field label="Horários livres (clique para escolher)">
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {slots.slice(0, 16).map((s) => {
                const val = toDatetimeLocal(new Date(s.start));
                const sel = startsAt === val;
                return <button key={s.start} type="button" onClick={() => setStartsAt(val)} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${sel ? 'border-[#B7791F] bg-[#B7791F] text-white' : 'border-[#DEE2E6] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>{fmtSlot(s.start)}</button>;
              })}
            </div>
          </Field>
        )}
        {userId && slots.length === 0 && <p className="text-xs text-amber-600">Sem horários livres configurados para este advogado — defina a disponibilidade ou escolha a data/hora manualmente abaixo.</p>}

        <Field label={<>Data e hora <span className="text-rose-500">*</span></>}><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Cliente <span className="text-rose-500">*</span></>}><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Nome do cliente" /></Field>
          <Field label="Telefone"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" /></Field>
        </div>
        <Field label="Observação"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inputCls} placeholder="Resumo do caso / assunto" /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-40">{saving ? 'Agendando…' : 'Agendar'}</button></div>
    </Modal>
  );
}
