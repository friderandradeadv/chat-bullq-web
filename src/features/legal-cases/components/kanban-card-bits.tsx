'use client';

// Peças reutilizáveis dos kanbans jurídicos:
// - PhaseHeader: renomeia a fase clicando no título (só sócios).
// - ProdutoTags: edita o PRODUTO/ÁREA do processo (os badges coloridos do card:
//   RMC, BPC/LOAS, Previdenciário…) como etiquetas — chip com ✕ pra remover +
//   botão "+" pra adicionar (presets ou texto livre). Grava em Case.area; a área
//   jurídica (2º badge) é derivada disso no backend, então atualiza sozinha.

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '../services/legal-cases.service';

export function PhaseHeader({
  phase,
  canRename,
  onRename,
}: {
  phase: { key: string; label: string };
  canRename: boolean;
  onRename: (key: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(phase.label);
  useEffect(() => setText(phase.label), [phase.label]);

  if (!canRename) {
    return (
      <h2 className="truncate text-sm font-medium text-[#e11970] dark:text-[#f06595]">
        {phase.label}
      </h2>
    );
  }

  const commit = () => {
    const t = text.trim();
    setEditing(false);
    if (t && t !== phase.label) onRename(phase.key, t);
    else setText(phase.label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setEditing(false); setText(phase.label); }
        }}
        className="w-full rounded border border-[#e11970] bg-white px-1 py-0.5 text-sm font-medium text-[#101820] outline-none dark:bg-zinc-800 dark:text-zinc-100"
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      title="Clique pra renomear a fase (só sócios)"
      className="cursor-text truncate text-sm font-medium text-[#e11970] hover:underline dark:text-[#f06595]"
    >
      {phase.label}
    </h2>
  );
}

// ── Produto/Área (etiquetas coloridas do card) ──
const PRODUTO_PRESETS = [
  'RMC', 'RCC', 'Revisional Consignado', 'Portabilidade', 'Contribuições',
  'Tarifas/Seguros', 'BPC/LOAS', 'BPC/LOAS - Doença', 'Auxílio-doença',
  'Aposentadoria por Idade', 'Aposentadoria por Invalidez', 'Trabalhista',
  'Consumidor', 'Cível', 'Família',
];

function produtoBg(p: string): { bg: string; fg: string } {
  const s = (p ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/TRABALH|RESCIS|FERIAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD|CONSUMID/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
}

/** Case.area pode ser string simples OU JSON array (ex.: ["RMC","RCC"]). */
function parseProdutos(area: string | null): string[] {
  if (!area) return [];
  const t = area.trim();
  if (t.startsWith('[')) {
    try {
      const a = JSON.parse(t);
      if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* */ }
  }
  return [t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim()].filter(Boolean);
}

export function ProdutoTags({
  caseId,
  area,
  onChanged,
}: {
  caseId: string;
  area: string | null;
  onChanged: () => void;
}) {
  const list = parseProdutos(area);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      const value = next.length === 0 ? '' : next.length === 1 ? next[0] : JSON.stringify(next);
      await legalCasesService.update(caseId, { area: value } as any);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar produto/área');
    } finally {
      setBusy(false);
    }
  };
  const remove = (p: string) => save(list.filter((x) => x !== p));
  const add = (p: string) => {
    const v = p.trim();
    if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) save([...list, v]);
    setCustom('');
    setOpen(false);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {list.map((p) => {
        const col = produtoBg(p);
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{ background: col.bg, color: col.fg }}
          >
            {p}
            <button type="button" disabled={busy} title="Remover" onClick={() => remove(p)} className="hover:opacity-70">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}
      <div className="relative">
        <button
          type="button"
          title="Adicionar produto/área"
          onClick={() => setOpen((v) => !v)}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#e11970] dark:hover:bg-zinc-800"
        >
          <Plus className="h-3 w-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Produto / Área</p>
              <div className="px-2 pb-1">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(custom); } }}
                  placeholder="Digitar e Enter…"
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[#e11970] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {PRODUTO_PRESETS.filter((p) => !list.some((x) => x.toLowerCase() === p.toLowerCase())).map((p) => (
                <button
                  key={p}
                  disabled={busy}
                  onClick={() => add(p)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: produtoBg(p).bg }} />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{p}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
