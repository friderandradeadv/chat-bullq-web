'use client';

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';

/**
 * Paleta estilo LíderHub: 4 linhas (escuro → bem claro) × 10 colunas,
 * baseada nas cores do Tailwind.
 */
export const COLOR_GRID: string[][] = [
  ['#000000', '#334155', '#991B1B', '#92400E', '#9A3412', '#166534', '#155E75', '#1E40AF', '#6B21A8', '#9F1239'],
  ['#64748B', '#9CA3AF', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'],
  ['#CBD5E1', '#E5E7EB', '#FCA5A5', '#FDBA74', '#FDE047', '#86EFAC', '#67E8F9', '#93C5FD', '#C4B5FD', '#F9A8D4'],
  ['#F1F5F9', '#F9FAFB', '#FEE2E2', '#FFEDD5', '#FEF9C3', '#DCFCE7', '#CFFAFE', '#DBEAFE', '#EDE9FE', '#FCE7F3'],
];

/**
 * Quadradinho de cor que abre o popover "Selecione uma cor"
 * (grade de presets + cor personalizada) — paridade LíderHub.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        aria-label="Selecionar cor"
        className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 shadow-sm outline-none transition-transform hover:scale-105 focus:ring-2 focus:ring-primary/40 dark:border-zinc-700"
        style={{ backgroundColor: value }}
      />
      <PopoverPanel
        anchor="bottom end"
        transition
        className="z-50 mt-1 w-[280px] rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xl outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.35rem]"
      >
        {({ close }) => (
          <>
            <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Selecione uma cor
            </p>
            <div className="flex flex-col gap-1.5">
              {COLOR_GRID.map((row, i) => (
                <div key={i} className="flex gap-1.5">
                  {row.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onChange(c);
                        close();
                      }}
                      className={`h-[21px] w-[21px] rounded-md border transition-transform hover:scale-110 ${
                        value.toUpperCase() === c
                          ? 'border-zinc-900 ring-2 ring-primary/50 dark:border-zinc-100'
                          : 'border-black/10 dark:border-white/10'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Cor personalizada
              </span>
              <label
                className="h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700"
                style={{ backgroundColor: value }}
              >
                <input
                  type="color"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-0 w-0 opacity-0"
                />
              </label>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
