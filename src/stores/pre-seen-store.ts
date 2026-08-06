'use client';

import { create } from 'zustand';
import { preferencesService } from '@/features/inbox/services/preferences.service';

// ── "Visto" do board Pré-Processual — POR USUÁRIO, salvo no SERVIDOR ──────────────
// Antes era localStorage (por NAVEGADOR): quem usa o mesmo browser p/ contas
// diferentes compartilhava o "visto". Agora fica em
// users/me/preferences.preProcessual.seenAt (por usuário/org) — cada um tem o seu.
// Guarda o último instante em que o usuário abriu o quadro; um card é "novo" se
// entrou na fase depois disso. Ao abrir o board, markSeen() avança pra agora →
// o badge zera. No 1º acesso o baseline é AGORA (cards antigos não contam
// retroativo) e já é salvo no servidor.

let started = false; // evita hidratar (fetch) mais de uma vez

interface PreSeenState {
  lastSeenAt: string | null;
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void;
}

export const usePreSeenStore = create<PreSeenState>((set) => ({
  lastSeenAt: null,
  hydrated: false,
  hydrate: () => {
    if (started) return;
    started = true;
    void preferencesService
      .get()
      .then((prefs) => {
        const r = ((prefs as Record<string, unknown>)?.preProcessual ?? {}) as {
          seenAt?: string | null;
        };
        if (typeof r.seenAt === 'string') {
          set({ lastSeenAt: r.seenAt, hydrated: true });
        } else {
          // 1º acesso: baseline = agora (não conta retroativo) e SALVA no servidor.
          const now = new Date().toISOString();
          set({ lastSeenAt: now, hydrated: true });
          void preferencesService
            .patch({ preProcessual: { seenAt: now } })
            .catch(() => undefined);
        }
      })
      .catch(() => set({ hydrated: true }));
  },
  markSeen: () => {
    const now = new Date().toISOString();
    set({ lastSeenAt: now, hydrated: true });
    void preferencesService
      .patch({ preProcessual: { seenAt: now } })
      .catch(() => undefined);
  },
}));
