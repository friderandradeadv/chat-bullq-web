'use client';

import { create } from 'zustand';

// ── "Visto" do funil REPB ────────────────────────────────────────────────────────
// Dois estados independentes, por navegador:
//  • lastSeenAt: última vez que o usuário ABRIU o funil. Alimenta o BADGE da aba
//    (bolinha vermelha na barra) — conta os leads que entraram DEPOIS disso. Ao
//    abrir o funil, markSeen() põe "agora" → o badge zera. No 1º acesso é null
//    (conta TODOS, pra os leads que já estavam lá aparecerem no badge).
//  • clickedIds: cards que o usuário JÁ CLICOU (abriu). Alimenta a bolinha AO
//    LADO DE CADA CARD (igual à agenda) — a bolinha some quando você clica no card.
// Persistem em localStorage; hidrata no cliente (no 1º paint tudo é "não visto").

const KEY_SEEN = 'repb-funil-last-seen';
const KEY_CLICKED = 'repb-cards-clicked';

interface RepbSeenState {
  lastSeenAt: string | null;
  clickedIds: string[];
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void; // abriu o funil → zera o badge da aba
  markCardClicked: (id: string) => void; // clicou no card → tira a bolinha dele
}

export const useRepbSeenStore = create<RepbSeenState>((set) => ({
  lastSeenAt: null,
  clickedIds: [],
  hydrated: false,
  hydrate: () =>
    set((s) => {
      if (s.hydrated) return s;
      let lastSeenAt: string | null = null;
      let clickedIds: string[] = [];
      try {
        // null se nunca abriu → o badge conta TODOS (não zera retroativo).
        lastSeenAt = localStorage.getItem(KEY_SEEN);
        const raw = localStorage.getItem(KEY_CLICKED);
        if (raw) clickedIds = JSON.parse(raw);
      } catch {
        /* localStorage indisponível */
      }
      return { lastSeenAt, clickedIds, hydrated: true };
    }),
  markSeen: () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(KEY_SEEN, now);
    } catch {
      /* ignora */
    }
    set({ lastSeenAt: now, hydrated: true });
  },
  markCardClicked: (id: string) =>
    set((s) => {
      if (!id || s.clickedIds.includes(id)) return s;
      const clickedIds = [...s.clickedIds, id].slice(-800);
      try {
        localStorage.setItem(KEY_CLICKED, JSON.stringify(clickedIds));
      } catch {
        /* ignora */
      }
      return { clickedIds };
    }),
}));
