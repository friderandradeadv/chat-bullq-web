"use client";

import {
  CloseButton,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import { Menu, X, ChevronLeft } from "lucide-react";
import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

interface SidebarCollapseCtx {
  collapsed: boolean;
  toggle: () => void;
}
const SidebarCollapseContext = createContext<SidebarCollapseCtx | null>(null);
export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

// Permite que a barra de abas inferior (mobile) abra o menu lateral.
interface MobileNavCtx {
  openSidebar: () => void;
}
const MobileNavContext = createContext<MobileNavCtx | null>(null);
export function useMobileNav() {
  return useContext(MobileNavContext);
}

interface SidebarLayoutProps {
  sidebar: ReactNode;
  navbar?: ReactNode;
  /** Bloco à direita do app bar mobile (ex.: sino + tema). Fica no canto
   *  superior direito; o `navbar` continua centralizado independentemente. */
  navbarRight?: ReactNode;
  /** MODO SIMPLES: some com a sidebar lateral do desktop (a navegação vira a
   *  barra inferior, igual ao mobile). Some também o toggle de recolher. */
  hideDesktopSidebar?: boolean;
  children: ReactNode;
}

export function SidebarLayout({
  sidebar,
  navbar,
  navbarRight,
  hideDesktopSidebar = false,
  children,
}: SidebarLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  };

  return (
    <MobileNavContext.Provider value={{ openSidebar: () => setSidebarOpen(true) }}>
    <div className="relative isolate flex h-svh w-full bg-white max-lg:flex-col lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950">
      {/* Menu lateral em overlay — no mobile (botão Menu do topo/barra) e também no
          desktop quando o MODO SIMPLES esconde a sidebar fixa (item "Menu" da barra). */}
      <Dialog open={sidebarOpen} onClose={setSidebarOpen}>
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200"
        />
        <DialogPanel
          transition
          className="fixed inset-y-0 left-0 w-full max-w-80 p-2 pt-safe pb-safe transition duration-300 ease-in-out data-[closed]:-translate-x-full"
        >
          <div className="flex h-full flex-col rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-[#15181A] dark:ring-white/10">
            <div className="-mb-3 px-4 pt-3">
              <CloseButton
                as="button"
                aria-label="Fechar menu"
                className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X className="size-5" />
              </CloseButton>
            </div>
            {sidebar}
          </div>
        </DialogPanel>
      </Dialog>

      {/* Desktop sidebar — some no MODO SIMPLES (navegação vai pra barra inferior) */}
      <div
        className={`fixed inset-y-0 left-0 max-lg:hidden transition-[width] duration-200 ease-in-out ${
          hideDesktopSidebar ? "lg:hidden" : collapsed ? "w-0" : "w-64"
        }`}
      >
        <div
          className={`dark flex h-full flex-col border-r border-zinc-200 bg-white w-64 transition-transform duration-200 ease-in-out dark:border-white/5 dark:bg-[#15181A] ${
            collapsed ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <SidebarCollapseContext.Provider value={{ collapsed, toggle: toggleCollapsed }}>
            {sidebar}
          </SidebarCollapseContext.Provider>
        </div>
      </div>

      {/*
        Edge toggle — único ponto de entrada pra abrir/fechar a sidebar
        no desktop. Fica colado na borda direita da sidebar quando aberta
        e na borda esquerda do conteúdo quando fechada, ancorado no rodapé
        pra não competir com o dropdown da org no header.
      */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Abrir menu" : "Recolher menu"}
        title={collapsed ? "Abrir menu" : "Recolher menu"}
        className={`group fixed bottom-4 z-30 h-7 w-5 items-center justify-center rounded-r-md bg-zinc-100 text-zinc-500 opacity-70 ring-1 ring-zinc-200 transition-all duration-200 ease-in-out hover:bg-zinc-200 hover:text-zinc-900 hover:opacity-100 dark:bg-[#1F2325] dark:ring-white/10 dark:hover:bg-zinc-800 dark:hover:text-white ${
          hideDesktopSidebar ? "hidden" : "hidden lg:flex"
        } ${collapsed ? "left-0" : "left-64"}`}
      >
        <ChevronLeft
          className={`size-3.5 transition-transform duration-200 ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Content area */}
      <main
        className={`flex flex-1 flex-col min-h-0 lg:min-w-0 transition-[padding] duration-200 ease-in-out ${
          hideDesktopSidebar || collapsed ? "lg:pl-0" : "lg:pl-64"
        }`}
      >
        {/* Mobile header (barra app) — respeita a safe-area do topo (notch/ilha).
            pt-safe fica no WRAPPER; a linha interna não tem padding de topo, então
            o logo (absoluto, centralizado) alinha com o menu e o bloco da direita. */}
        <div className="border-b border-zinc-950/5 pt-safe dark:border-white/5 lg:hidden">
          <div className="relative flex items-center gap-3 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
              className="relative z-10 text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            >
              <Menu className="size-5" />
            </button>
            {/* Logo CENTRALIZADO na tela toda (independe das larguras dos lados). */}
            {navbar && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className="pointer-events-auto">{navbar}</div>
              </div>
            )}
            {/* Canto superior direito: sino + tema. */}
            <div className="relative z-10 ml-auto flex items-center gap-2">{navbarRight}</div>
          </div>
        </div>

        {/* Page content — no ESCURO usa a MESMA cor da página (#15181A) e sem anel
            claro: o "card" mais claro (#1F2325) criava uma faixa clara vazando no
            vão entre o cabeçalho e os filtros. No claro mantém o card branco. */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden lg:bg-white lg:shadow-sm lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-950 dark:lg:ring-transparent">
          <SidebarCollapseContext.Provider value={{ collapsed, toggle: toggleCollapsed }}>
            {children}
          </SidebarCollapseContext.Provider>
        </div>
      </main>
    </div>
    </MobileNavContext.Provider>
  );
}
