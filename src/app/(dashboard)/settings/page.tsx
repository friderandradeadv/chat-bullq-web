'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

// Índice de Configurações resolvido por papel: sócios (OWNER/ADMIN) caem em
// "Escritório"; associados (AGENT) caem no próprio perfil (sua conta).
export default function SettingsIndex() {
  const router = useRouter();
  const { organizations, activeOrgId } = useAuthStore();

  useEffect(() => {
    if (organizations.length === 0) return; // aguarda o /me carregar
    const role = organizations.find((o) => o.id === activeOrgId)?.role;
    const isAdmin = role === 'OWNER' || role === 'ADMIN';
    router.replace(isAdmin ? '/settings/general' : '/settings/perfil');
  }, [organizations, activeOrgId, router]);

  return (
    <div className="flex h-full items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
