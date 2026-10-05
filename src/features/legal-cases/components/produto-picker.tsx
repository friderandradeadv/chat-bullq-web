'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { produtoColor } from '@/features/legal-cases/lib/etiqueta-cores';
import { PRODUTO_PRESETS } from '@/features/legal-cases/lib/etiquetas';

/**
 * SELETOR DE PRODUTO/ÁREA — as etiquetas coloridas da face do card.
 *
 * 🚨 É A PARTE VISUAL, E SÓ. Não sabe salvar: recebe a lista e devolve o que
 * mudou. Quem persiste é quem usa — no card, o `ProdutoTags` (PATCH no
 * processo); no diálogo de "Novo processo", o estado local até a criação.
 *
 * 🚨 EXISTE PARA NÃO NASCER A TERCEIRA CÓPIA (05/10/2026). O card já tinha o
 * seletor bonito (chips coloridos + busca + presets com bolinha) e o diálogo
 * tinha um `<input list>` cru, com outra lista. A lista virou uma só em
 * `lib/etiquetas.ts`; agora o seletor também. É a mesma regra de
 * `etiqueta-cores.ts`: isto se muda num lugar só.
 *
 * 🚨 A COR VEM DE REGRA, NÃO DE CAMPO. `produtoColor` casa por pedaço do nome
 * ("BPC", "RMC", "TRABALH"…). Etiqueta nova sem regra sai CINZA — e, hoje, não
 * há onde guardar cor escolhida à mão: isso exige armazenamento, que não
 * existe. Enquanto não existir, cor nova se acrescenta em `etiqueta-cores.ts`.
 */
export function ProdutoPicker({
  list,
  onAdd,
  onRemove,
  sugestoes = PRODUTO_PRESETS,
  busy = false,
  autoFocus = false,
}: {
  list: string[];
  onAdd: (p: string) => void;
  onRemove: (p: string) => void;
  /** presets + o que o escritório já usa (vem de GET /legal-cases/etiquetas) */
  sugestoes?: string[];
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const disponiveis = sugestoes.filter(
    (p) =>
      !list.some((x) => x.toLowerCase() === p.toLowerCase()) &&
      (!custom.trim() || p.toLowerCase().includes(custom.trim().toLowerCase())),
  );
  const jaExiste = (v: string) =>
    sugestoes.some((p) => p.toLowerCase() === v.toLowerCase()) ||
    list.some((p) => p.toLowerCase() === v.toLowerCase());

  const adicionar = (p: string) => {
    const v = p.trim();
    if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) onAdd(v);
    setCustom('');
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {list.map((p) => {
        const col = produtoColor(p);
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{ background: col.bg, color: col.fg }}
          >
            {p}
            <button type="button" disabled={busy} title="Remover" onClick={() => onRemove(p)} className="hover:opacity-70">
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
            <div className="absolute left-0 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Produto / Área</p>
              <div className="px-2 pb-1">
                <input
                  autoFocus={autoFocus}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(custom); } }}
                  placeholder="Buscar ou criar…"
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[#e11970] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {/* criar a que não existe: a linha aparece só quando é nova mesmo */}
              {custom.trim() && !jaExiste(custom) && (
                <button
                  disabled={busy}
                  onClick={() => adicionar(custom)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: produtoColor(custom).bg }} />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    Criar <strong>{custom.trim()}</strong>
                  </span>
                </button>
              )}
              {disponiveis.map((p) => (
                <button
                  key={p}
                  disabled={busy}
                  onClick={() => adicionar(p)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: produtoColor(p).bg }} />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{p}</span>
                </button>
              ))}
              {!disponiveis.length && !custom.trim() && (
                <p className="px-3 py-2 text-xs text-zinc-400">Todas já estão no processo.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
