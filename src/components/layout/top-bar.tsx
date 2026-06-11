'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import {
  Search,
  Bell,
  LayoutGrid,
  Cable,
  MessageSquare,
  Users,
  Columns3,
  Bot,
  BookOpen,
  AudioLines,
  Workflow,
  Zap,
  Puzzle,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';

type Command = { label: string; href: string; icon: LucideIcon; group: string };

const COMMANDS: Command[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, group: 'Geral' },
  { label: 'Conexões', href: '/conexoes', icon: Cable, group: 'Geral' },
  { label: 'Conversas', href: '/inbox', icon: MessageSquare, group: 'Atendimento' },
  { label: 'Contatos', href: '/contacts', icon: Users, group: 'Atendimento' },
  { label: 'Kanban', href: '/pipelines', icon: Columns3, group: 'Atendimento' },
  { label: 'Agentes', href: '/ai-agents', icon: Bot, group: 'Automações' },
  { label: 'Base de Conhecimento', href: '/base-conhecimento', icon: BookOpen, group: 'Automações' },
  { label: 'Vozes', href: '/vozes', icon: AudioLines, group: 'Automações' },
  { label: 'Chatbot', href: '/chatbot', icon: Workflow, group: 'Automações' },
  { label: 'Automações', href: '/automations', icon: Zap, group: 'Automações' },
  { label: 'Integrações', href: '/settings/integrations', icon: Puzzle, group: 'Automações' },
  { label: 'Tarefas', href: '/tarefas', icon: ClipboardList, group: 'Geral' },
  { label: 'Configurações', href: '/settings', icon: Settings, group: 'Geral' },
];

export function TopBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="hidden h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900 lg:flex">
      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-72 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-600">
          ⌘K
        </kbd>
      </button>

      <NotificationsBell />

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </header>
  );
}

function NotificationsBell() {
  return (
    <Popover className="relative">
      <PopoverButton className="flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
        <Bell className="size-5" />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        <p className="px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Notificações
        </p>
        <div className="px-3 py-10 text-center text-sm text-zinc-500">
          Nenhuma notificação no momento
        </div>
      </PopoverPanel>
    </Popover>
  );
}

function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const close = () => {
    onClose();
    setQuery('');
  };

  const go = (cmd: Command | null) => {
    if (!cmd) return;
    router.push(cmd.href);
    close();
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 transition-opacity data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[15vh]">
        <DialogPanel
          transition
          onKeyDownCapture={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
          className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl transition-all data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Combobox onChange={go}>
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
              <Search className="size-4 text-zinc-400" />
              <ComboboxInput
                autoFocus
                className="w-full bg-transparent py-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                placeholder="Buscar páginas..."
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {filtered.length > 0 && (
              <ComboboxOptions
                static
                className="max-h-80 scroll-py-2 overflow-y-auto p-2"
              >
                {filtered.map((cmd) => (
                  <ComboboxOption
                    key={cmd.href}
                    value={cmd}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 data-[focus]:bg-zinc-100 dark:text-zinc-300 dark:data-[focus]:bg-zinc-800"
                  >
                    <cmd.icon className="size-4 text-zinc-400" />
                    <span className="flex-1">{cmd.label}</span>
                    <span className="text-xs text-zinc-400">{cmd.group}</span>
                  </ComboboxOption>
                ))}
              </ComboboxOptions>
            )}
            {query !== '' && filtered.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-zinc-500">
                Nenhuma página encontrada.
              </p>
            )}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
