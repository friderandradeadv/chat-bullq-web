'use client';

import { create } from 'zustand';

// ── "Visto" do board Pré-Processual ─────────────────────────────────────────────
// Guarda, por navegador, o último instante (ISO) em que o usuário abriu o quadro
// Pré-Processual. Um card é "novo" se entrou na fase depois disso; o badge da barra
// inferior conta esses novos. Ao abrir o board, `markSeen()` avança o marcador para
// agora → some a bolinha dos cards e zera o badge. Persiste em localStorage; hidrata
// no cliente para não dar mismatch de SSR (no 1º paint, lastSeenAt = null).

const KEY = 'pre-processual-last-seen';

interface PreSeenState {
  lastSeenAt: string | null;
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void;
}

export const usePreSeenStore = create<PreSeenState>((set) => ({
  lastSeenAt: null,
  hydrated: false,
  hydrate: () =>
    set((s) => {
      if (s.hydrated) return s;
      let lastSeenAt: string | null = null;
      try {
        lastSeenAt = localStorage.getItem(KEY);
        // Primeiro acesso deste navegador: baseline = agora. Assim os cards que já
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
