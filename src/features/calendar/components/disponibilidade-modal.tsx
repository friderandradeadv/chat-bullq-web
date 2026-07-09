'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { calendarService, DIAS_SEMANA, type DisponibilidadeConfig } from '@/features/calendar/services/calendar.service';
import { membersService } from '@/features/settings/services/members.service';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';

type Dias = Record<string, [string, string][]>;
const ACCENT = '#02883C';

export function DisponibilidadeModal({ onClose }: { onClose: () => void }) {
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const { isSocio } = usePermissions();
  const [userId, setUserId] = useState(meId);
  const [enabled, setEnabled] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [dias, setDias] = useState<Dias>({});
  const [salvando, setSalvando] = useState(false);

  const { data: members = [] } = useQuery({ queryKey: ['members', 'disponibilidade'], queryFn: () => membersService.list(), enabled: isSocio, staleTime: 300_000 });
  const { data: cfg, isLoading } = useQuery<DisponibilidadeConfig>({ queryKey: ['disponibilidade', userId], queryFn: () => calendarService.getDisponibilidade(userId), enabled: !!userId });

  useEffect(() => {
    if (!cfg) return;
    setEnabled(!!cfg.enabled);
    setSlotMinutes(cfg.slotMinutes || 30);
    setDias(cfg.dias ?? {});
  }, [cfg]);

  const toggleDia = (dia: string) => {
    setDias((d) => {
      const has = (d[dia]?.length ?? 0) > 0;
      const next = { ...d };
      if (has) delete next[dia];
      else next[dia] = [['09:00', '12:00'], ['14:00', '18:00']];
      return next;
    });
  };
  const setJanela = (dia: string, i: number, idx: 0 | 1, val: string) =>
    setDias((d) => ({ ...d, [dia]: d[dia].map((w, j) => (j === i ? (idx === 0 ? [val, w[1]] : [w[0], val]) : w)) }));
  const addJanela = (dia: string) => setDias((d) => ({ ...d, [dia]: [...(d[dia] ?? []), ['09:00', '12:00']] }));
  const rmJanela = (dia: string, i: number) => setDias((d) => ({ ...d, [dia]: d[dia].filter((_, j) => j !== i) }));

  const salvar = async () => {
    setSalvando(true);
    try {
      await calendarService.setDisponibilidade({ userId: isSocio ? userId : undefined, enabled, slotMinutes, dias });
      toast.success('Disponibilidade salva');
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Clock className="h-5 w-5" style={{ color: ACCENT }} />
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Disponibilidade de atendimento</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Defina os horários em que você atende. O robô de triagem oferece só esses horários livres aos clientes e agenda automaticamente.</p>

          {isSocio && members.length > 0 && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">Advogado</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={INPUT}>
                <option value={meId}>Eu</option>
                {members.filter((m) => m.user.id !== meId && m.user.isActive).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
              </select>
            </label>
          )}

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Atender clientes por agendamento</span>
                <button onClick={() => setEnabled((v) => !v)} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? '' : 'bg-zinc-300 dark:bg-zinc-700'}`} style={enabled ? { background: ACCENT } : undefined}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              <label className="mt-3 flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Duração de cada atendimento</span>
                <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>

              <div className={`mt-4 space-y-2 ${enabled ? '' : 'pointer-events-none opacity-50'}`}>
                {DIAS_SEMANA.map(({ key, label }) => {
                  const janelas = dias[key] ?? [];
                  const on = janelas.length > 0;
                  return (
                    <div key={key} className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleDia(key)} className={`flex h-4 w-4 items-center justify-center rounded-sm border ${on ? 'border-transparent' : 'border-zinc-300 dark:border-zinc-600'}`} style={on ? { background: ACCENT } : undefined}>{on && <span className="text-[10px] font-bold text-white">✓</span>}</button>
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
                        {on && <button onClick={() => addJanela(key)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}><Plus className="h-3.5 w-3.5" /> janela</button>}
                      </div>
                      {on && (
                        <div className="mt-2 space-y-1.5">
                          {janelas.map((w, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input type="time" value={w[0]} onChange={(e) => setJanela(key, i, 0, e.target.value)} className={TIME} />
                              <span className="text-xs text-zinc-400">até</span>
                              <input type="time" value={w[1]} onChange={(e) => setJanela(key, i, 1, e.target.value)} className={TIME} />
                              <button onClick={() => rmJanela(key, i)} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}

const INPUT = 'h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
const TIME = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm tabular-nums text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
