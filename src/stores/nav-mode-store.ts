'use client';

import { create } from 'zustand';
import {
  Menu, Sparkles, MessageSquare, CalendarCheck, Folder, Newspaper, Workflow,
  Landmark, Columns3, Stethoscope, Calculator, Users, CircleDollarSign, UserCircle,
  Bot, HelpCircle, Settings, TrendingUp, type LucideIcon,
} from 'lucide-react';

// ── Modo da navegação (desktop) ────────────────────────────────────────────────
//  - 'completo' = sidebar lateral inteira (padrão);
//  - 'simples'  = layout enxuto igual ao mobile: sem sidebar, atalhos numa barra
//    inferior (editável). Persiste em localStorage; hidrata no cliente pra não dar
//    mismatch de SSR (default 'completo' no primeiro paint).
export type NavMode = 'simples' | 'completo';

// ── Catálogo de atalhos da barra do modo simples ────────────────────────────────
// 'menu' é especial: abre o menu lateral completo (drawer), não navega.
export interface SimpleBarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: 'menu';
  adminOnly?: boolean;
}

export const SIMPLE_BAR_CATALOG: SimpleBarItem[] = [
  { id: 'menu', label: 'Menu', icon: Menu, action: 'menu' },
  { id: 'inicio', label: 'Início', icon: Sparkles, href: '/inicio' },
  { id: 'conversas', label: 'Conversas', icon: MessageSquare, href: '/inbox' },
  { id: 'agenda', label: 'Agenda', icon: CalendarCheck, href: '/agenda' },
  { id: 'processos', label: 'Processos', icon: Folder, href: '/processos' },
  { id: 'publicacoes', label: 'Publicações', icon: Newspaper, href: '/caixa-djen' },
  { id: 'pre-processual', label: 'Pré-Processual', icon: Workflow, href: '/juridico/pre-processual' },
  { id: 'fase-bancaria', label: 'Fase Bancária', icon: Landmark, href: '/juridico/fase-bancaria' },
  { id: 'planejamento', label: 'Planejamento', icon: TrendingUp, href: '/juridico/planejamento' },
  { id: 'fase-judicial', label: 'Fase Judicial', icon: Columns3, href: '/juridico/kanban' },
  { id: 'inss', label: 'INSS Adm.', icon: Stethoscope, href: '/juridico/inss-administrativo' },
  { id: 'calculos', label: 'Cálculos', icon: Calculator, href: '/juridico/calculos' },
  { id: 'clientes', label: 'Clientes', icon: Users, href: '/clientes' },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign, href: '/financeiro', adminOnly: true },
  { id: 'espaco', label: 'Você', icon: UserCircle, href: '/escritorio' },
  { id: 'config', label: 'Configurações', icon: Settings, href: '/settings' },
  { id: 'copiloto', label: 'Copiloto', icon: Bot, href: '/copiloto', adminOnly: true },
  { id: 'ajuda', label: 'Ajuda', icon: HelpCircle, href: '/ajuda' },
];

// Menu primeiro (à esquerda), depois os mais usados.
export const DEFAULT_SIMPLE_BAR: string[] = [
  'menu', 'inicio', 'conversas', 'agenda', 'pre-processual', 'fase-judicial', 'calculos', 'financeiro', 'espaco',
];

export const barItemById = (id: string) => SIMPLE_BAR_CATALOG.find((i) => i.id === id);

const BAR_KEY = 'nav-bar-items';
const readBar = (): string[] => {
  try {
    const raw = localStorage.getItem(BAR_KEY);
    if (!raw) return DEFAULT_SIMPLE_BAR;
    const arr = JSON.parse(raw);
    const valid = Array.isArray(arr) ? arr.filter((id) => typeof id === 'string' && barItemById(id)) : [];
    return valid.length ? valid : DEFAULT_SIMPLE_BAR;
  } catch {
    return DEFAULT_SIMPLE_BAR;
  }
};

interface NavModeState {
  modo: NavMode;
  barItems: string[];
  hydrated: boolean;
  hydrate: () => void;
  setModo: (m: NavMode) => void;
  setBarItems: (ids: string[]) => void;
}

export const useNavMode = create<NavModeState>((set) => ({
  modo: 'completo',
  barItems: DEFAULT_SIMPLE_BAR,
  hydrated: false,
  hydrate: () =>
    set(() => {
      let modo: NavMode = 'completo';
      try {
        if (localStorage.getItem('nav-mode') === 'simples') modo = 'simples';
      } catch {
        /* localStorage indisponível */
      }
      return { modo, barItems: readBar(), hydrated: true };
    }),
  setModo: (m) => {
    try {
      localStorage.setItem('nav-mode', m);
    } catch {
      /* ignora */
    }
    set({ modo: m });
  },
  setBarItems: (ids) => {
    try {
      localStorage.setItem(BAR_KEY, JSON.stringify(ids));
    } catch {
      /* ignora */
    }
    set({ barItems: ids });
  },
}));
