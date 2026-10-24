'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (/sw.js) no cliente — necessário para o app ser
 * instalável como PWA ("Adicionar à tela inicial"). Falhas são silenciosas
 * (ex.: navegador sem suporte, ou contexto não-seguro em dev via IP).
 *
 * Também pede storage PERSISTENTE: reduz a chance de o navegador/iOS limpar o
 * localStorage (onde ficam os tokens) — ajuda a manter a sessão viva.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Comportamento de app: o Safari do iPhone ignora o userScalable do
    // viewport e deixa dar zoom de pinça, o que solta a tela para os lados.
    const semPinca = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', semPinca, { passive: false });
    // Não persiste storage automaticamente em todo navegador; pedir não custa.
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persisted?.().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      });
    }
    return () => document.removeEventListener('gesturestart', semPinca);
  }, []);
  return null;
}
