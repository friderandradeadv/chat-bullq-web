'use client';

import { create } from 'zustand';

// ── "Visto" do funil REPB ────────────────────────────────────────────────────────
// Guarda, por navegador, o último instante (ISO) em que o usuário abriu o funil REPB
// (/juridico/repb). Um lead é "novo" se entrou na 1ª coluna (repbc_novos_leads)
// depois disso; o badge da barra inferior conta esses novos leads DO RESPONSÁVEL
// (ex.: a Kauani). Ao abrir o funil, `markSeen()` avança o marcador para agora → some
// a bolinha e zera o badge. Persiste em localStorage; hidrata no cliente para não dar
// mismatch de SSR (no 1º paint, lastSeenAt = null). Espelha usePreSeenStore.

const KEY = 'repb-funil-last-seen';

interface RepbSeenState {
  lastSeenAt: string | null;
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void;
}

export const useRepbSeenStore = create<RepbSeenState>((set) => ({
  lastSeenAt: null,
  hydrated: false,
  hydrate: () =>
    set((s) => {
      if (s.hydrated) return s;
      let lastSeenAt: string | null = null;
      try {
        lastSeenAt = localStorage.getItem(KEY);
        // Primeiro acesso deste navegador: baseline = agora. Assim os leads que já
        // existiam NÃO viram "novos" retroativamente (nem enchem o badge) — só o que
        // entrar daqui pra frente conta.
        if (!lastSeenAt) {
          lastSeenAt = new Date().toISOString();
          localStorage.setItem(KEY, lastSeenAt);
        }
      } catch {
        /* localStorage indisponível */
      }
      return { lastSeenAt, hydrated: true };
    }),
  markSeen: () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(KEY, now);
    } catch {
      /* ignora */
    }
    set({ lastSeenAt: now, hydrated: true });
  },
}));
