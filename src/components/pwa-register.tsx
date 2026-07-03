'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (/sw.js) no cliente — necessário para o app ser
 * instalável como PWA ("Adicionar à tela inicial"). Falhas são silenciosas
 * (ex.: navegador sem suporte, ou contexto não-seguro em dev via IP).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
