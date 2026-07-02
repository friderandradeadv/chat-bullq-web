'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Save, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import type { Member } from '@/features/settings/services/members.service';

// Áreas jurídicas (chave normalizada = igual ao areaNorm do backend) para regras por área.
const SOCIO_AREAS = [
  { key: 'bancario', label: 'Bancário' },
  { key: 'previdenciario', label: 'Previdenciário' },
  { key: 'trabalhista', label: 'Trabalhista' },
  { key: 'consumidor', label: 'Consumidor' },
  { key: 'civel', label: 'Cível' },
];

/**
 * Sócios — divisão dos honorários. Marca quem é sócio e, dos honorários do escritório
 * em cada caso, define quanto vai pro sócio responsável, pro escritório e pra outro sócio.
 * Vale na aba "Meu financeiro". (associado segue o "% êxito" fixo)
 *
 * Componente compartilhado: usado nas Configurações do RH e em Configurações › Membros —
 * fonte única, sem duplicar código.
 */
export function SociosSection({ members }: { members?: Member[] }) {
  const queryClient = useQueryClient();
  const { data: cfgRemote } = useQuery({ queryKey: ['financeiro', 'socio-config'], queryFn: () => financeiroService.getSocioConfig() });
  const [socios, setSocios] = useState<Record<string, boolean>>({});
  const [split, setSplit] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfgRemote && !dirty) {
      setSocios(cfgRemote.socios ?? {});
      setSplit(cfgRemote.socioSplit ?? {});
    }
  }, [cfgRemote, dirty]);

  const ativos = (members ?? []).filter((m) => m.user.isActive);
  const socioIds = ativos.filter((m) => socios[m.user.id]).map((m) => m.user.id);
  const firstName = (id: string) => (id === 'escritorio' ? 'Escritório' : (ativos.find((m) => m.user.id === id)?.user.name ?? 'Sócio').split(' ')[0]);

  const toggleSocio = (id: string) => {
    setDirty(true);
    setSocios((s) => ({ ...s, [id]: !s[id] }));
    if (!socios[id]) setSplit((sp) => (sp[id] ? sp : { ...sp, [id]: { default: { [id]: 100 } } }));
  };
  const setPct = (owner: string, rule: string, dest: string, val: number) => {
    setDirty(true);
    setSplit((sp) => {
      const o = { ...(sp[owner] ?? {}) };
      o[rule] = { ...(o[rule] ?? {}), [dest]: Math.max(0, Math.min(100, val || 0)) };
      return { ...sp, [owner]: o };
    });
  };
  const addAreaRule = (owner: string, areaKey: string) => {
    setDirty(true);
    setSplit((sp) => {
      const o = { ...(sp[owner] ?? {}) };
      if (!o[areaKey]) o[areaKey] = { ...(o['default'] ?? { [owner]: 100 }) };
      return { ...sp, [owner]: o };
    });
  };
  const removeRule = (owner: string, rule: string) => {
    setDirty(true);
    setSplit((sp) => { const o = { ...(sp[owner] ?? {}) }; delete o[rule]; return { ...sp, [owner]: o }; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const validDest = new Set([...socioIds, 'escritorio']);
      const cleanSplit: Record<string, Record<string, Record<string, number>>> = {};
      for (const owner of socioIds) {
        const rules = split[owner] ?? { default: { [owner]: 100 } };
        const cr: Record<string, Record<string, number>> = {};
        for (const [rk, dests] of Object.entries(rules)) {
          const cd: Record<string, number> = {};
          for (const [d, p] of Object.entries(dests)) if (validDest.has(d) && Number(p) > 0) cd[d] = Number(p);
          cr[rk] = cd;
        }
        if (!cr.default) cr.default = { [owner]: 100 };
        cleanSplit[owner] = cr;
      }
      const cleanSocios: Record<string, boolean> = {};
      for (const id of socioIds) cleanSocios[id] = true;
      await financeiroService.setSocioConfig({ socios: cleanSocios, socioSplit: cleanSplit });
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      setDirty(false);
      toast.success('Divisão dos sócios salva');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!ativos.length) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><HandCoins className="h-4 w-4 text-[#7048E8]" /> Sócios — divisão dos honorários</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Dos honorários do escritório em cada caso, defina quanto fica com o sócio responsável, com o escritório e (se houver) com outro sócio. Aparece na aba “Meu financeiro”. Associado segue o “% êxito” fixo.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {ativos.map((m) => {
          const id = m.user.id;
          const isS = !!socios[id];
          const rules = split[id] ?? {};
          const ruleKeys = ['default', ...Object.keys(rules).filter((k) => k !== 'default')];
          const usableAreas = SOCIO_AREAS.filter((a) => !ruleKeys.includes(a.key));
          const destinos = [id, 'escritorio', ...socioIds.filter((x) => x !== id)];
          return (
            <div key={id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={isS} onChange={() => toggleSocio(id)} className="h-4 w-4 rounded border-zinc-300 text-primary" />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.user.name}</span>
                <span className="text-xs text-zinc-400">{isS ? 'sócio' : 'associado (% êxito fixo)'}</span>
              </label>
              {isS && (
                <div className="mt-3 space-y-2.5 pl-6">
                  {ruleKeys.map((rk) => {
                    const dests = rules[rk] ?? (rk === 'default' ? { [id]: 100 } : {});
                    const soma = destinos.reduce((s, d) => s + (Number(dests[d]) || 0), 0);
                    return (
                      <div key={rk} className="rounded-md bg-zinc-50 p-2.5 dark:bg-zinc-800/40">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{rk === 'default' ? 'Todas as áreas' : (SOCIO_AREAS.find((a) => a.key === rk)?.label ?? rk)}</span>
                          {rk !== 'default' && <button onClick={() => removeRule(id, rk)} className="text-xs text-red-500 hover:underline">remover</button>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {destinos.map((d) => (
                            <label key={d} className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                              <span className={d === id ? 'font-semibold text-[#7048E8]' : 'text-zinc-500'}>{d === id ? 'Você' : firstName(d)}</span>
                              <input type="number" min={0} max={100} value={dests[d] ?? 0} onChange={(e) => setPct(id, rk, d, Number(e.target.value))} className="w-12 rounded border border-zinc-200 bg-white px-1 py-0.5 text-right tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                              <span className="text-zinc-400">%</span>
                            </label>
                          ))}
                          <span className={`text-xs ${soma === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>= {soma}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {usableAreas.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5 text-zinc-400" /><span className="text-zinc-400">regra por área:</span>
                      {usableAreas.map((a) => (
                        <button key={a.key} onClick={() => addAreaRule(id, a.key)} className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-500 hover:border-primary hover:text-primary dark:border-zinc-700">{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
