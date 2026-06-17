'use client';

import { cn } from '@/lib/utils';

interface PageSizeSelectProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  /** Texto antes do select. Default: "Exibir". */
  label?: string;
  className?: string;
}

/**
 * Seletor reutilizável de "itens por página". Use em qualquer página que liste
 * muitos itens (contatos, mensagens rápidas, base de conhecimento, etc.) para
 * o usuário escolher quantos itens carregar de uma vez.
 */
export function PageSizeSelect({
  value,
  onChange,
  options = [20, 50, 100, 200],
  label = 'Exibir',
  className,
}: PageSizeSelectProps) {
  return (
    <label className={cn('flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400', className)}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-zinc-200 bg-white py-1 pl-2 pr-6 text-xs font-medium text-zinc-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt} por página
          </option>
        ))}
      </select>
    </label>
  );
}
