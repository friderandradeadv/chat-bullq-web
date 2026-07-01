'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import {
  Radio,
  Users,
  Tags,
  Bell,
  Building2,
  KeyRound,
  Sparkles,
  Plug,
  Network,
  CircleDot,
  Zap,
  Coins,
  UserCircle,
  Scale,
} from 'lucide-react';

// Menu lateral agrupado POR SETOR — Conta / Geral (organização) / Comercial
// (atendimento) / Jurídico / Desenvolvedor. Cada item mora no setor a que
// pertence no dia a dia; o que é do escritório inteiro fica em "Geral".
// `adminOnly` esconde o grupo dos associados (AGENT). "Conta" é de todo mundo —
// cada pessoa gerencia o próprio perfil (nome, foto, e-mail, senha).
const groups = [
  {
    label: 'Conta',
    items: [
      { href: '/settings/perfil', label: 'Meu perfil', icon: UserCircle },
    ],
  },
  {
    label: 'Geral',
    adminOnly: true,
    items: [
      { href: '/settings/general', label: 'Escritório', icon: Building2 },
      { href: '/settings/members', label: 'Membros e acessos', icon: Users },
      { href: '/settings/notifications', label: 'Notificações', icon: Bell },
    ],
  },
  {
    label: 'Comercial',
    adminOnly: true,
    items: [
      { href: '/settings/channels', label: 'Canais', icon: Radio },
      { href: '/settings/ai', label: 'IA', icon: Sparkles },
      { href: '/settings/usage', label: 'Uso da IA', icon: Coins },
      { href: '/settings/quick-replies', label: 'Mensagens rápidas', icon: Zap },
      { href: '/settings/statuses', label: 'Status', icon: CircleDot },
      { href: '/settings/tags', label: 'Etiquetas', icon: Tags },
      { href: '/settings/departments', label: 'Departamento', icon: Network },
      { href: '/settings/integrations', label: 'Integrações', icon: Plug },
    ],
  },
  {
    label: 'Jurídico',
    adminOnly: true,
    items: [
      { href: '/settings/juridico', label: 'Visão geral', icon: Scale },
    ],
  },
  {
    label: 'Desenvolvedor',
    adminOnly: true,
    items: [
      { href: '/settings/api-keys', label: 'Credenciais API', icon: KeyRound },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { organizations, activeOrgId } = useAuthStore();
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  // Associados (AGENT) só veem "Conta" (o próprio perfil); o resto é do escritório.
  const visibleGroups = groups.filter((g) => isAdmin || !g.adminOnly);

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
              {visibleGroups.map((group) => (
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
