'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Envolve qualquer área/botão de upload e adiciona arrastar-e-soltar (arrastar
 * da mesa e soltar dentro da guia). Mostra um overlay ao arrastar por cima e
 * entrega os arquivos filtrados por `accept`.
 */
export function DropZone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  className,
  overlayLabel = 'Solte o(s) arquivo(s) aqui',
  children,
}: {
  onFiles: (files: File[]) => void;
  accept?: string; // ex.: 'application/pdf,.pdf' ou 'image/*'
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  overlayLabel?: string;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(false);
  const depth = useRef(0);

  const filtrar = useCallback(
    (list: FileList | null): File[] => {
      let files = list ? Array.from(list) : [];
      if (accept) {
        const regras = accept.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
        files = files.filter((f) => {
          const tipo = (f.type || '').toLowerCase();
          const nome = f.name.toLowerCase();
          return regras.some(
            (a) =>
              a === tipo ||
              (a.startsWith('.') && nome.endsWith(a)) ||
              (a.endsWith('/*') && tipo.startsWith(a.slice(0, -1))),
          );
        });
      }
      return multiple ? files : files.slice(0, 1);
    },
    [accept, multiple],
  );

  return (
    <div
      className={`relative ${className ?? ''}`}
      onDragEnter={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        depth.current += 1;
        setDrag(true);
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDrag(false);
        }
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        depth.current = 0;
        setDrag(false);
        const files = filtrar(e.dataTransfer?.files ?? null);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {drag && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-blue-50/90 text-center text-xs font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-950/85 dark:text-blue-300">
          {overlayLabel}
        </div>
      )}
    </div>
  );
}
