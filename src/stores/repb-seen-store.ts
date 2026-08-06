'use client';

import { create } from 'zustand';
import { preferencesService } from '@/features/inbox/services/preferences.service';

// ── "Visto" do funil REPB — POR USUÁRIO, salvo no SERVIDOR ────────────────────────
// Antes era localStorage (por NAVEGADOR): se Matheus e Kauani usam o mesmo browser
// (troca de conta), o "visto" vazava entre eles. Agora fica em
// users/me/preferences.repbFunil (por usuário/org), então cada um tem o seu:
//   • seenAt: última vez que o usuário abriu o funil → BADGE da aba (conta leads
//     que entraram depois; zera ao abrir). null = nunca abriu (conta todos).
//   • seenCardIds: cards que o usuário já CLICOU → bolinha por card (some ao clicar).
// Se um usuário não abriu, o dele continua aparecendo — não é afetado pelo outro.

interface RepbFunilPrefs {
  seenAt?: string | null;
  seenCardIds?: string[];
}

let started = false; // evita hidratar (fetch) mais de uma vez

interface RepbSeenState {
  lastSeenAt: string | null;
  clickedIds: string[];
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void;
  markCardClicked: (id: string) => void;
}

export const useRepbSeenStore = create<RepbSeenState>((set, get) => ({
  lastSeenAt: null,
  clickedIds: [],
  hydrated: false,
  hydrate: () => {
    if (started) return;
    started = true;
    void preferencesService
      .get()
      .then((prefs) => {
        const r = ((prefs as Record<string, unknown>)?.repbFunil ?? {}) as RepbFunilPrefs;
        set({
          lastSeenAt: typeof r.seenAt === 'string' ? r.seenAt : null,
          clickedIds: Array.isArray(r.seenCardIds) ? r.seenCardIds : [],
          hydrated: true,
        });
      })
      .catch(() => set({ hydrated: true }));
  },
  markSeen: () => {
    const now = new Date().toISOString();
    set({ lastSeenAt: now });
    // PATCH é shallow-merge no topo → mando o objeto repbFunil INTEIRO.
    void preferencesService
      .patch({ repbFunil: { seenAt: now, seenCardIds: get().clickedIds } })
      .catch(() => undefined);
  },
  markCardClicked: (id: string) => {
    const s = get();
    if (!id || s.clickedIds.includes(id)) return;
    const clickedIds = [...s.clickedIds, id].slice(-800);
    set({ clickedIds });
    void preferencesService
      .patch({ repbFunil: { seenAt: s.lastSeenAt, seenCardIds: clickedIds } })
      .catch(() => undefined);
  },
}));
