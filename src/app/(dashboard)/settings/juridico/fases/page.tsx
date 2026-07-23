'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Plus, Save, Columns3, RotateCcw } from 'lucide-react';
import { legalCasesService, type PhaseConfig } from '@/features/legal-cases/services/legal-cases.service';

type Bucket = 'pre' | 'banco' | 'plan' | 'repb' | 'repbc' | 'judicial';
interface Item { key: string; label: string; lane: 'pre' | 'judicial'; bucket: Bucket; custom: boolean; hidden: boolean }

const BUCKETS: { id: Bucket; title: string; hint: string; accent: string }[] = [
  { id: 'pre', title: 'Pré-Processual', hint: 'Do contrato ao protocolo', accent: '#e11970' },
  { id: 'banco', title: 'Fase Bancária Investigativa', hint: 'Investigação RMC/RCC × bancos', accent: '#228BE6' },
  { id: 'plan', title: 'Planejamento Previdenciário', hint: 'Do contrato à entrega do planejamento', accent: '#12B886' },
  { id: 'repb', title: 'REPB — Reestruturação de Passivo', hint: 'Auditoria + provisionamento até o acordo', accent: '#B7791F' },
  { id: 'repbc', title: 'Funil REPB (comercial)', hint: 'Leads das campanhas → reunião → contrato', accent: '#E8590C' },
  { id: 'judicial', title: 'Fase Judicial', hint: 'Do ajuizamento ao arquivamento', accent: '#7048e8' },
];
const bucketOf = (key: string, lane: 'pre' | 'judicial'): Bucket => (key.startsWith('repbc_') ? 'repbc' : key.startsWith('repb_') ? 'repb' : key.startsWith('plan_') ? 'plan' : key.startsWith('banco_') ? 'banco' : lane === 'pre' ? 'pre' : 'judicial');
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);

export default function FasesSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['phase-config'], queryFn: () => legalCasesService.getPhaseConfig() });
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const defLabel = useMemo(() => {
    const m: Record<string, string> = {};
    (data?.defaults ?? []).forEach((d) => { m[d.key] = d.label; });
    return m;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const labels = data.config.labels ?? {};
    const order = data.config.order ?? {};
    const hidden = new Set(data.config.hidden ?? []);
    const base: Item[] = data.defaults.map((d) => ({
      key: d.key, label: labels[d.key] ?? d.label, lane: d.lane, bucket: bucketOf(d.key, d.lane),
      custom: false, hidden: hidden.has(d.key),
    }));
    const custom: Item[] = (data.config.custom ?? []).map((c) => ({
      key: c.key, label: labels[c.key] ?? c.label, lane: c.lane, bucket: bucketOf(c.key, c.lane),
      custom: true, hidden: hidden.has(c.key),
    }));
    const all = [...base, ...custom];
    const ord = (k: string) => order[k] ?? data.defaults.find((d) => d.key === k)?.order ?? 999;
    all.sort((a, b) => ord(a.key) - ord(b.key));
    setItems(all);
    setDirty(false);
  }, [data]);

  const setLabel = (key: string, label: string) => { setItems((xs) => xs.map((x) => (x.key === key ? { ...x, label } : x))); setDirty(true); };
  const toggleHidden = (key: string) => { setItems((xs) => xs.map((x) => (x.key === key ? { ...x, hidden: !x.hidden } : x))); setDirty(true); };
  const removeItem = (key: string) => { setItems((xs) => xs.filter((x) => x.key !== key)); setDirty(true); };
  const move = (key: string, dir: -1 | 1) => {
    setItems((xs) => {
      const inBucket = xs.filter((x) => x.bucket === xs.find((y) => y.key === key)!.bucket);
      const gi = inBucket.findIndex((x) => x.key === key);
      const tgt = inBucket[gi + dir];
      if (!tgt) return xs;
      const a = xs.findIndex((x) => x.key === key), b = xs.findIndex((x) => x.key === tgt.key);
      const cp = [...xs]; [cp[a], cp[b]] = [cp[b], cp[a]]; return cp;
    });
    setDirty(true);
  };
  const addPhase = (bucket: Bucket) => {
    const lane: 'pre' | 'judicial' = bucket === 'judicial' ? 'judicial' : 'pre';
    const prefix = bucket === 'banco' ? 'banco_' : bucket === 'repbc' ? 'repbc_' : bucket === 'repb' ? 'repb_' : bucket === 'plan' ? 'plan_' : 'custom_';
    const key = `${prefix}${slug('nova fase')}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: Item = { key, label: 'Nova fase', lane, bucket, custom: true, hidden: false };
    setItems((xs) => {
      // insere no fim do bucket
      const lastIdx = xs.map((x, i) => (x.bucket === bucket ? i : -1)).filter((i) => i >= 0).pop();
      if (lastIdx == null) return [...xs, novo];
      const cp = [...xs]; cp.splice(lastIdx + 1, 0, novo); return cp;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const labels: Record<string, string> = {};
      const order: Record<string, number> = {};
      const hidden: string[] = [];
      const custom: PhaseConfig['custom'] = [];
      items.forEach((it, i) => {
        order[it.key] = (i + 1) * 10;
        if (it.hidden) hidden.push(it.key);
        if (it.custom) custom!.push({ key: it.key, label: it.label.trim() || 'Fase', lane: it.lane });
        else if (it.label.trim() && it.label.trim() !== defLabel[it.key]) labels[it.key] = it.label.trim();
      });
      await legalCasesService.savePhaseConfig({ labels, order, hidden, custom });
      qc.invalidateQueries({ queryKey: ['phase-config'] });
      qc.invalidateQueries({ queryKey: ['legal-cases', 'kanban'] });
      toast.success('Fases atualizadas');
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Só sócios (OWNER/ADMIN) podem personalizar as fases');
    } finally { setSaving(false); }
  };

  const resetAll = async () => {
    if (!confirm('Restaurar todas as fases ao padrão? Isso apaga renomeações, ordem, fases escondidas e personalizadas.')) return;
    setSaving(true);
    try {
      await legalCasesService.savePhaseConfig({ labels: {}, order: {}, hidden: [], custom: [] });
      qc.invalidateQueries({ queryKey: ['phase-config'] });
      qc.invalidateQueries({ queryKey: ['legal-cases', 'kanban'] });
      toast.success('Fases restauradas ao padrão');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro'); } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/settings/juridico" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#228BE6]">
        <ArrowLeft className="h-4 w-4" /> Configurações do Jurídico
      </Link>
      <div className="flex items-center gap-2">
        <Columns3 className="h-5 w-5 text-[#228BE6]" />
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Fases dos Kanbans</h1>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Renomeie, reordene, esconda ou crie fases próprias em cada kanban. Só sócios podem salvar. As alterações valem para todo o escritório.</p>

      {isLoading ? (
        <p className="mt-8 text-sm text-zinc-400">Carregando…</p>
      ) : (
        <div className="mt-6 space-y-6">
          {BUCKETS.map((b) => {
            const list = items.filter((x) => x.bucket === b.id);
            return (
              <div key={b.id} className="rounded-xl border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: b.accent }}>{b.title}</h2>
                    <p className="text-xs text-zinc-400">{b.hint}</p>
                  </div>
                  <button onClick={() => addPhase(b.id)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-600">
                    <Plus className="h-3.5 w-3.5" /> Adicionar fase
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {list.length === 0 && <li className="py-3 text-center text-xs text-zinc-400">Nenhuma fase.</li>}
                  {list.map((it, i) => (
                    <li key={it.key} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${it.hidden ? 'border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-800/30' : 'border-[#e9ecef] dark:border-zinc-800'}`}>
                      <div className="flex flex-col">
                        <button disabled={i === 0} onClick={() => move(it.key, -1)} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-200"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button disabled={i === list.length - 1} onClick={() => move(it.key, 1)} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-200"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      <input value={it.label} onChange={(e) => setLabel(it.key, e.target.value)} maxLength={60}
                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-800 hover:border-[#DEE2E6] focus:border-[#228BE6] focus:outline-none dark:text-zinc-100 dark:hover:border-zinc-700" />
                      {it.custom && <span className="shrink-0 rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1971c2] dark:text-[#74c0fc]">nova</span>}
                      <button onClick={() => toggleHidden(it.key)} title={it.hidden ? 'Mostrar' : 'Esconder'} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
                        {it.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {it.custom && (
                        <button onClick={() => removeItem(it.key)} title="Excluir fase" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[#DEE2E6] bg-white/90 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
            <button onClick={resetAll} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:text-rose-600 disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </button>
            <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-[#228BE6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Salvo'}
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Esconder uma fase padrão só a tira dos quadros — os processos nela continuam existindo (aparecem ao mostrar de novo). Excluir só vale para fases que você criou.
          </p>
        </div>
      )}
    </div>
  );
}
