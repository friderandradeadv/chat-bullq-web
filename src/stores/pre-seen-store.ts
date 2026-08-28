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
  // Ids dos cards que o usuário JÁ clicou — a bolinha vermelha do card morre no
  // clique, igual ao funil do REPB (repb-seen-store). O `seenAt` acima continua
  // servindo o badge da barra; são coisas diferentes e convivem.
  clickedIds: string[];
  hydrated: boolean;
  hydrate: () => void;
  markSeen: () => void;
  markCardClicked: (id: string) => void;
}

export const usePreSeenStore = create<PreSeenState>((set, get) => ({
  lastSeenAt: null,
  clickedIds: [],
  hydrated: false,
  hydrate: () => {
    if (started) return;
    started = true;
    void preferencesService
      .get()
      .then((prefs) => {
        const r = ((prefs as Record<string, unknown>)?.preProcessual ?? {}) as {
          seenAt?: string | null;
          seenCardIds?: string[];
        };
        const clickedIds = Array.isArray(r.seenCardIds) ? r.seenCardIds : [];
        if (typeof r.seenAt === 'string') {
          set({ lastSeenAt: r.seenAt, clickedIds, hydrated: true });
        } else {
          // 1º acesso: baseline = agora (não conta retroativo) e SALVA no servidor.
          const now = new Date().toISOString();
          set({ lastSeenAt: now, clickedIds, hydrated: true });
          // PATCH é shallow-merge só no topo → mando o objeto preProcessual
          // INTEIRO, senão gravar o seenAt apagaria os seenCardIds.
          void preferencesService
            .patch({ preProcessual: { seenAt: now, seenCardIds: clickedIds } })
            .catch(() => undefined);
        }
      })
      .catch(() => set({ hydrated: true }));
  },
  markSeen: () => {
    const now = new Date().toISOString();
    set({ lastSeenAt: now, hydrated: true });
    // Objeto INTEIRO (shallow-merge no topo) — ver comentário no hydrate.
    void preferencesService
      .patch({ preProcessual: { seenAt: now, seenCardIds: get().clickedIds } })
      .catch(() => undefined);
  },
  markCardClicked: (id: string) => {
    const s = get();
    if (!id || s.clickedIds.includes(id)) return;
    const clickedIds = [...s.clickedIds, id].slice(-800); // teto igual ao REPB
    set({ clickedIds });
    void preferencesService
      .patch({ preProcessual: { seenAt: s.lastSeenAt, seenCardIds: clickedIds } })
      .catch(() => undefined);
  },
}));
