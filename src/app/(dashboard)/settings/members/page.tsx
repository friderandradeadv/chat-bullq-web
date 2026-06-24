'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, ShieldCheck, User, Users, Copy, Link, X, Hash, LayoutGrid, Loader2, MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { toast } from 'sonner';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { financeiroService, type AcessoNivel } from '@/features/financeiro/services/financeiro.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { MemberChannelsDrawer } from '@/features/settings/components/member-channels-drawer';
import { Avatar } from '@/components/ui/avatar';

// Módulos que dá pra liberar/bloquear por usuário (espelha APP_MODULES da API).
const APP_MODULES: { key: string; label: string }[] = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'automacoes', label: 'Automações' },
  { key: 'juridico', label: 'Jurídico' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'configuracoes', label: 'Configurações' },
];

const roleLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  OWNER: { label: 'Proprietário', icon: ShieldCheck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' },
  AGENT: { label: 'Agente', icon: User, color: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400' },
};

export default function SettingsMembersPage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('AGENT');
  const [inviting, setInviting] = useState(false);

  const orgId = useOrgId();
  const { data: members, isLoading } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => membersService.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['members'] });

  // Acesso ao FINANCEIRO por membro (completo / limitado aos casos / sem acesso)
  const { data: acessoFin = {} } = useQuery({ queryKey: ['financeiro', 'acesso'], queryFn: () => financeiroService.getAcesso() });
  const setAcessoFin = async (userId: string, nivel: AcessoNivel) => {
    try {
      await financeiroService.setAcesso(userId, nivel);
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'acesso'] });
      toast.success('Acesso ao financeiro atualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [drawerMember, setDrawerMember] = useState<Member | null>(null);
  const [modulesMember, setModulesMember] = useState<Member | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await membersService.invite({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      refresh();
      if (result.autoAccepted) {
        toast.success('Membro adicionado com sucesso!');
      } else {
        const link = `${window.location.origin}/register?invite=${result.token}`;
        setInviteLink(link);
        toast.success('Convite criado! Compartilhe o link com o membro.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar');
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Link copiado!');
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      await membersService.updateRole(memberId, role);
      toast.success('Role atualizada');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar role');
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remover ${name} da organização?`)) return;
    try {
      await membersService.remove(memberId);
      toast.success('Membro removido');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  const handleRename = async (memberId: string, current: string) => {
    const name = window.prompt('Novo nome do membro:', current);
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed === current) return;
    try {
      await membersService.updateName(memberId, trimmed);
      toast.success('Nome atualizado');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao renomear');
    }
  };

  const handleToggleActive = async (
    memberId: string,
    active: boolean,
    name: string,
  ) => {
    if (
      !active &&
      !confirm(`Desativar ${name}? Ele perde o acesso ao sistema até ser reativado.`)
    )
      return;
    try {
      await membersService.setActive(memberId, active);
      toast.success(active ? 'Membro reativado' : 'Membro desativado');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Membros</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Gerencie os membros da sua organização</p>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="flex-1">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email do membro</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="email@exemplo.com"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Role</label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="AGENT">Agente</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          onClick={handleInvite}
          disabled={!inviteEmail.trim() || inviting}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" /> Convidar
        </button>
      </div>

      {inviteLink && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/10">
          <Link className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Link de convite (expira em 7 dias)</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{inviteLink}</p>
          </div>
          <button
            onClick={copyInviteLink}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setInviteLink(null)}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Membro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Canais</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Módulos</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Financeiro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Entrou em</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-3"><div className="h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : !members?.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700" />
                  <p className="mt-3 text-sm text-zinc-500">Nenhum membro encontrado</p>
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const roleMeta = roleLabels[m.role] || roleLabels.AGENT;
                const RoleIcon = roleMeta.icon;
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-zinc-50 dark:border-zinc-800 ${
                      !m.user.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={m.user.avatarUrl}
                          initials={m.user.name.slice(0, 2).toUpperCase()}
                          className="size-8"
                        />
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {m.user.name}
                            {!m.user.isActive && (
                              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                                inativo
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-zinc-400">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.role === 'OWNER' ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${roleMeta.color}`}>
                          <RoleIcon className="h-3 w-3" /> {roleMeta.label}
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.id, e.target.value)}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="AGENT">Agente</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {/* OWNER tem acesso intrínseco a tudo (mesmo canais
                          PRIVATE). ADMIN herda os ORG por padrão mas
                          precisa de grant explícito pra PRIVATE — daí
                          ganha o botão "Gerenciar" também. AGENT só vê
                          o que tem grant. */}
                      {m.role === 'OWNER' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Acesso total
                        </span>
                      ) : (
                        <button
                          onClick={() => setDrawerMember(m)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          data-testid="member-channels-btn"
                        >
                          <Hash className="h-3 w-3" /> Gerenciar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {/* OWNER/ADMIN têm acesso total a todos os módulos; só
                          AGENTE pode ter módulos bloqueados. */}
                      {m.role === 'OWNER' || m.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Acesso total
                        </span>
                      ) : (
                        <button
                          onClick={() => setModulesMember(m)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          <LayoutGrid className="h-3 w-3" />
                          {(m.restrictedModules?.length ?? 0) > 0
                            ? `${APP_MODULES.length - (m.restrictedModules?.length ?? 0)}/${APP_MODULES.length} liberados`
                            : 'Acesso total'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.role === 'OWNER' || m.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Acesso total</span>
                      ) : (
                        <select
                          value={(acessoFin[m.userId] as AcessoNivel) ?? 'full'}
                          onChange={(e) => setAcessoFin(m.userId, e.target.value as AcessoNivel)}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          title="Nível de acesso ao módulo Financeiro"
                        >
                          <option value="full">Completo</option>
                          <option value="cases">Só os casos dele</option>
                          <option value="none">Sem acesso</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(m.joinedAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.role !== 'OWNER' && (
                        <Menu as="div" className="relative inline-block text-left">
                          <MenuButton className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
                            <MoreHorizontal className="h-4 w-4" />
                          </MenuButton>
                          <MenuItems className="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg border border-zinc-200 bg-white py-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900">
                            <MenuItem>
                              <button
                                onClick={() => handleRename(m.id, m.user.name)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <Pencil className="h-3.5 w-3.5 text-zinc-400" /> Renomear
                              </button>
                            </MenuItem>
                            <MenuItem>
                              <button
                                onClick={() =>
                                  handleToggleActive(m.id, !m.user.isActive, m.user.name)
                                }
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                {m.user.isActive ? (
                                  <>
                                    <PowerOff className="h-3.5 w-3.5 text-zinc-400" /> Desativar
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-3.5 w-3.5 text-emerald-500" /> Reativar
                                  </>
                                )}
                              </button>
                            </MenuItem>
                            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                            <MenuItem>
                              <button
                                onClick={() => handleRemove(m.id, m.user.name)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </button>
                            </MenuItem>
                          </MenuItems>
                        </Menu>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <MemberChannelsDrawer
        open={!!drawerMember}
        member={
          drawerMember
            ? {
                // Backend resolves member by userId; the existing list returns
                // userOrganization rows where `userId` is the field we need.
                id: drawerMember.userId,
                name: drawerMember.user.name,
                role: drawerMember.role,
              }
            : null
        }
        onClose={() => setDrawerMember(null)}
        onSaved={refresh}
      />

      <ModulesModal
        member={modulesMember}
        onClose={() => setModulesMember(null)}
        onSaved={refresh}
      />
    </div>
  );
}

/**
 * Modal de permissão por MÓDULO: liga/desliga cada área pra um atendente.
 * Switch ligado = acesso liberado; desligado = bloqueado (entra na denylist).
 */
function ModulesModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [restricted, setRestricted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Inicializa o set de bloqueados sempre que o modal abre pra outro membro.
  const memberId = member?.id ?? null;
  useEffect(() => {
    setRestricted(new Set(member?.restrictedModules ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  if (!member) return null;

  const toggle = (key: string) => {
    setRestricted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await membersService.updateModules(member.userId, [...restricted]);
      toast.success('Acesso aos módulos atualizado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar acesso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Acesso aos módulos
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              {member.user.name} — ligue só as áreas que este atendente pode acessar.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {APP_MODULES.map((mod) => {
            const allowed = !restricted.has(mod.key);
            return (
              <div key={mod.key} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{mod.label}</span>
                <button
                  onClick={() => toggle(mod.key)}
                  role="switch"
                  aria-checked={allowed}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${allowed ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${allowed ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
