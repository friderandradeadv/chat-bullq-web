'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radio,
  Users,
  Tags,
  Bell,
  Building2,
  KeyRound,
  Sparkles,
  BookUser,
  Plug,
  Network,
  CircleDot,
  Zap,
  Coins,
  UserCircle,
} from 'lucide-react';

// Menu lateral agrupado — estilo LíderHub (Configurações > CONTA / EMPRESA / CLASSES / DESENVOLVEDOR)
const groups = [
  {
    label: 'Conta',
    items: [
      { href: '/settings/perfil', label: 'Meu perfil', icon: UserCircle },
    ],
  },
  {
    label: 'Empresa',
    items: [
      { href: '/settings/general', label: 'Geral', icon: Building2 },
      { href: '/settings/channels', label: 'Canais', icon: Radio },
      { href: '/settings/ai', label: 'IA', icon: Sparkles },
      { href: '/settings/usage', label: 'Uso da IA', icon: Coins },
      { href: '/settings/members', label: 'Membros', icon: Users },
      { href: '/settings/quick-replies', label: 'Mensagens rápidas', icon: Zap },
      { href: '/settings/notifications', label: 'Notificações', icon: Bell },
    ],
  },
  {
    label: 'Classes',
    items: [
      { href: '/settings/statuses', label: 'Status', icon: CircleDot },
      { href: '/settings/tags', label: 'Etiquetas', icon: Tags },
      { href: '/settings/departments', label: 'Departamento', icon: Network },
      { href: '/settings/contacts', label: 'Contatos', icon: BookUser },
    ],
  },
  {
    label: 'Desenvolvedor',
    items: [
      { href: '/settings/api-keys', label: 'Credenciais API', icon: KeyRound },
      { href: '/settings/integrations', label: 'Integrações', icon: Plug },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl p-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Gerencie sua organização e integrações
        </p>

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-10">
          {/* Menu lateral — estilo LíderHub */}
          <aside className="w-full shrink-0 md:w-52">
            <nav className="flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1 pb-16">{children}</div>
        </div>
      </div>
    </div>
  );
}
