'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, ShieldCheck, User, Users, Copy, Link, X, Hash, LayoutGrid, Loader2, MoreHorizontal, Pencil, Power, PowerOff, HandCoins, Save, Plus, Eye, EyeOff } from 'lucide-react';
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
  // % de honorários (êxito/contrato) por advogado — usado nas projeções da visão limitada
  const { data: honorariosPct = {} } = useQuery({ queryKey: ['financeiro', 'honorarios-pct'], queryFn: () => financeiroService.getHonorariosPct() });
  const setPct = async (userId: string, pct: number) => {
    try {
      await financeiroService.setHonorariosPct(userId, pct);
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'honorarios-pct'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar %');
    }
  };
  // % padrão do escritório sobre a condenação (usado quando o processo não tem o honorário definido)
  const { data: escritorioPct } = useQuery({ queryKey: ['financeiro', 'escritorio-pct'], queryFn: () => financeiroService.getEscritorioPct() });
  const setEscritorio = async (pct: number) => {
    try {
      await financeiroService.setEscritorioPct(pct);
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'escritorio-pct'] });
      toast.success('% padrão do escritório atualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };
  // fator de realização: % da causa que costuma virar condenação (defasagem da sentença)
  const { data: fatorRealizacao } = useQuery({ queryKey: ['financeiro', 'fator-realizacao'], queryFn: () => financeiroService.getFatorRealizacao() });
  const setFator = async (pct: number) => {
    try {
      await financeiroService.setFatorRealizacao(pct);
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'fator-realizacao'] });
      toast.success('Fator de realização atualizado');
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

  const handleToggleAssignable = async (
    memberId: string,
    assignable: boolean,
    name: string,
  ) => {
    try {
      await membersService.setAssignable(memberId, assignable);
      toast.success(
        assignable
          ? `${name} volta a aparecer nas atribuições`
          : `${name} escondido das atribuições`,
      );
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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900" title="% padrão do escritório sobre a condenação — usado nas projeções quando o processo não tem honorário definido. Varia por cliente (o sistema lê o do processo quando houver).">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">% escritório</span>
            <input
              type="number" min={0} max={100} key={escritorioPct?.padrao ?? 40} defaultValue={escritorioPct?.padrao ?? 40}
              onBlur={(e) => { const v = Number(e.target.value); if (v !== (escritorioPct?.padrao ?? 40)) setEscritorio(v); }}
              className="w-14 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900" title="Defasagem: % do valor da causa que costuma virar condenação nas projeções (quando o processo não tem % de êxito próprio). A condenação real pode sair pra mais ou pra menos.">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">Fator de realização</span>
            <input
              type="number" min={0} max={200} key={fatorRealizacao?.fator ?? 70} defaultValue={fatorRealizacao?.fator ?? 70}
              onBlur={(e) => { const v = Number(e.target.value); if (v !== (fatorRealizacao?.fator ?? 70)) setFator(v); }}
              className="w-14 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
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
                        <div className="flex items-center gap-2">
                          <select
                            value={(acessoFin[m.userId] as AcessoNivel) ?? 'cases'}
                            onChange={(e) => setAcessoFin(m.userId, e.target.value as AcessoNivel)}
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            title="Nível de acesso ao módulo Financeiro (padrão do Agente: só os casos dele)"
                          >
                            <option value="full">Completo</option>
                            <option value="cases">Só os casos dele</option>
                            <option value="none">Sem acesso</option>
                          </select>
                          {((acessoFin[m.userId] as AcessoNivel) ?? 'cases') === 'cases' && (
                            <label className="inline-flex items-center gap-1 text-[11px] text-zinc-400" title="% do contrato (êxito) — usado nas projeções dele">
                              <input
                                type="number" min={0} max={100} defaultValue={honorariosPct[m.userId] ?? 30}
                                onBlur={(e) => { const v = Number(e.target.value); if (v !== (honorariosPct[m.userId] ?? 30)) setPct(m.userId, v); }}
                                className="w-12 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                              />% êxito
                            </label>
                          )}
                        </div>
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
                            <MenuItem>
                              <button
                                onClick={() =>
                                  handleToggleAssignable(m.id, m.assignable === false, m.user.name)
                                }
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                title="Define se o membro aparece nos seletores de responsável (kanban, chat, novo processo). Tire o perfil Admin e logins duplicados daqui."
                              >
                                {m.assignable === false ? (
                                  <>
                                    <Eye className="h-3.5 w-3.5 text-emerald-500" /> Mostrar nas atribuições
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3.5 w-3.5 text-zinc-400" /> Esconder das atribuições
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

      <SociosSection members={members} />

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

// Áreas jurídicas (chave normalizada = igual ao areaNorm do backend) para regras por área.
const SOCIO_AREAS = [
  { key: 'bancario', label: 'Bancário' },
  { key: 'previdenciario', label: 'Previdenciário' },
  { key: 'trabalhista', label: 'Trabalhista' },
  { key: 'consumidor', label: 'Consumidor' },
  { key: 'civel', label: 'Cível' },
];

/**
 * Sócios — divisão dos honorários. Marca quem é sócio e, dos honorários do escritório
 * em cada caso, define quanto vai pro sócio responsável, pro escritório e pra outro sócio.
 * Vale na aba "Meu financeiro". (associado segue o "% êxito" fixo da tabela acima)
 */
function SociosSection({ members }: { members?: Member[] }) {
  const queryClient = useQueryClient();
  const { data: cfgRemote } = useQuery({ queryKey: ['financeiro', 'socio-config'], queryFn: () => financeiroService.getSocioConfig() });
  const [socios, setSocios] = useState<Record<string, boolean>>({});
  const [split, setSplit] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfgRemote && !dirty) {
      setSocios(cfgRemote.socios ?? {});
      setSplit(cfgRemote.socioSplit ?? {});
    }
  }, [cfgRemote, dirty]);

  const ativos = (members ?? []).filter((m) => m.user.isActive);
  const socioIds = ativos.filter((m) => socios[m.user.id]).map((m) => m.user.id);
  const firstName = (id: string) => (id === 'escritorio' ? 'Escritório' : (ativos.find((m) => m.user.id === id)?.user.name ?? 'Sócio').split(' ')[0]);

  const toggleSocio = (id: string) => {
    setDirty(true);
    setSocios((s) => ({ ...s, [id]: !s[id] }));
    if (!socios[id]) setSplit((sp) => (sp[id] ? sp : { ...sp, [id]: { default: { [id]: 100 } } }));
  };
  const setPct = (owner: string, rule: string, dest: string, val: number) => {
    setDirty(true);
    setSplit((sp) => {
      const o = { ...(sp[owner] ?? {}) };
      o[rule] = { ...(o[rule] ?? {}), [dest]: Math.max(0, Math.min(100, val || 0)) };
      return { ...sp, [owner]: o };
    });
  };
  const addAreaRule = (owner: string, areaKey: string) => {
    setDirty(true);
    setSplit((sp) => {
      const o = { ...(sp[owner] ?? {}) };
      if (!o[areaKey]) o[areaKey] = { ...(o['default'] ?? { [owner]: 100 }) };
      return { ...sp, [owner]: o };
    });
  };
  const removeRule = (owner: string, rule: string) => {
    setDirty(true);
    setSplit((sp) => { const o = { ...(sp[owner] ?? {}) }; delete o[rule]; return { ...sp, [owner]: o }; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const validDest = new Set([...socioIds, 'escritorio']);
      const cleanSplit: Record<string, Record<string, Record<string, number>>> = {};
      for (const owner of socioIds) {
        const rules = split[owner] ?? { default: { [owner]: 100 } };
        const cr: Record<string, Record<string, number>> = {};
        for (const [rk, dests] of Object.entries(rules)) {
          const cd: Record<string, number> = {};
          for (const [d, p] of Object.entries(dests)) if (validDest.has(d) && Number(p) > 0) cd[d] = Number(p);
          cr[rk] = cd;
        }
        if (!cr.default) cr.default = { [owner]: 100 };
        cleanSplit[owner] = cr;
      }
      const cleanSocios: Record<string, boolean> = {};
      for (const id of socioIds) cleanSocios[id] = true;
      await financeiroService.setSocioConfig({ socios: cleanSocios, socioSplit: cleanSplit });
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'socio-config'] });
      setDirty(false);
      toast.success('Divisão dos sócios salva');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!ativos.length) return null;

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><HandCoins className="h-4 w-4 text-[#7048E8]" /> Sócios — divisão dos honorários</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Dos honorários do escritório em cada caso, defina quanto fica com o sócio responsável, com o escritório e (se houver) com outro sócio. Aparece na aba “Meu financeiro”. Associado segue o “% êxito” fixo da tabela acima.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {ativos.map((m) => {
          const id = m.user.id;
          const isS = !!socios[id];
          const rules = split[id] ?? {};
          const ruleKeys = ['default', ...Object.keys(rules).filter((k) => k !== 'default')];
          const usableAreas = SOCIO_AREAS.filter((a) => !ruleKeys.includes(a.key));
          const destinos = [id, 'escritorio', ...socioIds.filter((x) => x !== id)];
          return (
            <div key={id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={isS} onChange={() => toggleSocio(id)} className="h-4 w-4 rounded border-zinc-300 text-primary" />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.user.name}</span>
                <span className="text-xs text-zinc-400">{isS ? 'sócio' : 'associado (% êxito fixo)'}</span>
              </label>
              {isS && (
                <div className="mt-3 space-y-2.5 pl-6">
                  {ruleKeys.map((rk) => {
                    const dests = rules[rk] ?? (rk === 'default' ? { [id]: 100 } : {});
                    const soma = destinos.reduce((s, d) => s + (Number(dests[d]) || 0), 0);
                    return (
                      <div key={rk} className="rounded-md bg-zinc-50 p-2.5 dark:bg-zinc-800/40">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{rk === 'default' ? 'Todas as áreas' : (SOCIO_AREAS.find((a) => a.key === rk)?.label ?? rk)}</span>
                          {rk !== 'default' && <button onClick={() => removeRule(id, rk)} className="text-xs text-red-500 hover:underline">remover</button>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {destinos.map((d) => (
                            <label key={d} className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                              <span className={d === id ? 'font-semibold text-[#7048E8]' : 'text-zinc-500'}>{d === id ? 'Você' : firstName(d)}</span>
                              <input type="number" min={0} max={100} value={dests[d] ?? 0} onChange={(e) => setPct(id, rk, d, Number(e.target.value))} className="w-12 rounded border border-zinc-200 bg-white px-1 py-0.5 text-right tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                              <span className="text-zinc-400">%</span>
                            </label>
                          ))}
                          <span className={`text-xs ${soma === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>= {soma}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {usableAreas.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5 text-zinc-400" /><span className="text-zinc-400">regra por área:</span>
                      {usableAreas.map((a) => (
                        <button key={a.key} onClick={() => addAreaRule(id, a.key)} className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-500 hover:border-primary hover:text-primary dark:border-zinc-700">{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
