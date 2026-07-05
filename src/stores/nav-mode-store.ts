'use client';

import { create } from 'zustand';

// Modo da navegação (desktop):
//  - 'completo' = sidebar lateral inteira (padrão);
//  - 'simples'  = layout enxuto igual ao mobile: sem sidebar, atalhos numa barra
//    inferior. Persiste em localStorage ('nav-mode'). Hidrata no cliente pra não
//    dar mismatch de SSR (default 'completo' no primeiro paint).
export type NavMode = 'simples' | 'completo';

interface NavModeState {
  modo: NavMode;
  hydrated: boolean;
  hydrate: () => void;
  setModo: (m: NavMode) => void;
}

export const useNavMode = create<NavModeState>((set) => ({
  modo: 'completo',
  hydrated: false,
  hydrate: () =>
    set(() => {
      let modo: NavMode = 'completo';
      try {
        if (localStorage.getItem('nav-mode') === 'simples') modo = 'simples';
      } catch {
        /* localStorage indisponível */
      }
      return { modo, hydrated: true };
    }),
  setModo: (m) => {
    try {
      localStorage.setItem('nav-mode', m);
    } catch {
      /* ignora */
    }
    set({ modo: m });
  },
}));
