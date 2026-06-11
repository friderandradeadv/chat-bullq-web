'use client';

import { useState } from 'react';

/**
 * Bandeira real do estado brasileiro (SVG em /public/flags/br/{uf}.svg).
 * Fallback para 🇧🇷 se a imagem não existir (ex: AC) ou falhar.
 *
 * Quando `title` é passado, mostra um tooltip CUSTOMIZADO (instantâneo, sem o
 * atraso do `title` nativo do navegador e sem o cursor de interrogação).
 */
export function StateFlag({
  uf,
  className,
  title,
}: {
  uf: string;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);

  const flag =
    failed || !uf ? (
      <span className="leading-none">🇧🇷</span>
    ) : (
      <img
        src={`/flags/br/${uf.toLowerCase()}.svg`}
        alt={uf}
        onError={() => setFailed(true)}
        className={className ?? 'h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/5'}
      />
    );

  if (!title) return flag;

  return (
    <span className="group/flag relative inline-flex items-center">
      {flag}
      <span className="pointer-events-none absolute left-1/2 top-full z-[70] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover/flag:opacity-100 dark:bg-zinc-700">
        {title}
      </span>
    </span>
  );
}
