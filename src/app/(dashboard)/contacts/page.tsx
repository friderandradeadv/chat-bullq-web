'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Users,
  MessageSquare,
  ArrowUpDown,
  X,
  Phone,
  Mail,
  Tag as TagIcon,
  CircleDot,
  Loader2,
  UserPlus,
  Check,
  Plus,
} from 'lucide-react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { contactsService, type Contact } from '@/features/contacts/services/contacts.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { WhatsAppIcon, MetaIcon, InstagramIcon } from '@/components/ui/icons';
import { PageSizeSelect } from '@/components/ui/page-size-select';
import { StateFlag } from '@/components/ui/state-flag';
import { avatarColor, avatarInitials, chipTextColor } from '@/lib/avatar';
import { formatPhone, getBrazilState } from '@/lib/brazil-states';
import { relativeTime, cn } from '@/lib/utils';

/** Ícone do canal — WhatsApp (Zappfy/Oficial) usa o glifo verde do WhatsApp,
 *  não o "Z" da Zappfy (o cliente vê WhatsApp, não o provedor). */
function ChannelIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'WHATSAPP_ZAPPFY' || type === 'WHATSAPP_OFFICIAL') {
    return <WhatsAppIcon className={cn('text-[#25D366]', className)} />;
  }
  if (type === 'INSTAGRAM') return <InstagramIcon className={className} />;
  if (type === 'WHATSAPP_META') return <MetaIcon className={className} />;
  return <MessageSquare className={cn('text-zinc-400', className)} />;
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'Atividade recente' },
  { value: 'name_asc', label: 'Nome (A → Z)' },
  { value: 'name_desc', label: 'Nome (Z → A)' },
  { value: 'newest', label: 'Adicionados recentemente' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'conversations', label: 'Mais conversas' },
];

/** Primeira letra do nome p/ os divisores alfabéticos (sem acento, "#" p/ resto). */
function groupLetter(name: string | null): string {
  const c = (name || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '')[0]?.toUpperCase();
  return c && /[A-Z]/.test(c) ? c : '#';
}

export default function ContactsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [tagId, setTagId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [channelType, setChannelType] = useState('');
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const orgId = useOrgId();

  const { data: tags = [] } = useQuery({ queryKey: ['tags', orgId], queryFn: () => tagsService.list() });
  const { data: statuses = [] } = useQuery({ queryKey: ['contact-statuses', orgId], queryFn: () => contactStatusesService.list() });
  const { data: members = [] } = useQuery({ queryKey: ['members', orgId], queryFn: () => membersService.list() });

  const handleAssign = async (contactId: string, userId: string | null) => {
    try {
      await contactsService.assignResponsible(contactId, userId);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(userId ? 'Responsável definido' : 'Responsável removido');
    } catch {
      toast.error('Erro ao definir o responsável');
    }
  };

  const handleSetStatus = async (contactId: string, statusId: string | null) => {
    try {
      await contactStatusesService.setContactStatus(contactId, statusId);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Erro ao mudar o status');
    }
  };

  const handleAddTag = async (contactId: string, tagId: string) => {
    try {
      await tagsService.addToContact(contactId, tagId);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Erro ao adicionar a etiqueta');
    }
  };

  const handleRemoveTag = async (contactId: string, tagId: string) => {
    try {
      await tagsService.removeFromContact(contactId, tagId);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Erro ao remover a etiqueta');
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', orgId, search, sort, tagId, statusId, channelType, page, limit],
    queryFn: () => contactsService.list({
      search,
      sort,
      page: String(page),
      limit: String(limit),
      ...(tagId ? { tagIds: tagId } : {}),
      ...(statusId ? { statusId } : {}),
      ...(channelType ? { channelType } : {}),
    }),
  });

  const contacts = data?.contacts || [];
  const pagination = data?.pagination;
  const hasFilters = !!(search || tagId || statusId || channelType);
  const alphabetical = sort === 'name_asc' || sort === 'name_desc';

  // Agrupa por letra inicial quando ordenado por nome (divisores A, B, C…).
  const groups = useMemo(() => {
    if (!alphabetical) return [{ letter: '', items: contacts }];
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const l = groupLetter(c.name);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(c);
    }
    return Array.from(map.entries()).map(([letter, items]) => ({ letter, items }));
  }, [contacts, alphabetical]);

  const clearFilters = () => {
    setSearch(''); setTagId(''); setStatusId(''); setChannelType(''); setPage(1);
  };

  // ─── Seleção em massa ────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const pageIds = contacts.map((c) => c.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleSelectAllPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const runBulk = async (
    label: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(ids.map(fn));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast.success(`${label} em ${ok} contato(s)${fail ? ` — ${fail} falhou(ram)` : ''}`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Falha na edição em massa.');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkSetStatus = (value: string) =>
    runBulk('Status atualizado', (id) =>
      contactStatusesService.setContactStatus(id, value === 'none' ? null : value),
    );
  const bulkAddTag = (tag: string) =>
    runBulk('Etiqueta aplicada', (id) => tagsService.addToContact(id, tag));
  const bulkRemoveTag = (tag: string) =>
    runBulk('Etiqueta removida', (id) => tagsService.removeFromContact(id, tag));

  const selectCls =
    'rounded-lg border border-zinc-200 bg-white py-2.5 px-3 text-sm text-zinc-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

  return (
    <div className="flex h-full flex-col min-h-0 min-w-0 p-6">
      <div className="mx-auto w-full max-w-6xl shrink-0">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              Contatos
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              {pagination
                ? hasFilters
                  ? `${pagination.total} ${pagination.total === 1 ? 'contato encontrado' : 'contatos encontrados'}`
                  : `${pagination.total} ${pagination.total === 1 ? 'contato' : 'contatos'} no total`
                : 'Carregando…'}
            </p>
          </div>
          <PageSizeSelect value={limit} onChange={(v) => { setLimit(v); setPage(1); }} />
        </div>

        {/* Barra de busca */}
        <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className={cn(selectCls, 'pl-8 font-medium lg:w-56')}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={statusId} onChange={(e) => { setStatusId(e.target.value); setPage(1); }} className={cn(selectCls, 'sm:w-44')}>
            <option value="">Todos os status</option>
            <option value="none">Sem status</option>
            {statuses.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <select value={tagId} onChange={(e) => { setTagId(e.target.value); setPage(1); }} className={cn(selectCls, 'sm:w-44')}>
            <option value="">Todas as tags</option>
            {tags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <select value={channelType} onChange={(e) => { setChannelType(e.target.value); setPage(1); }} className={cn(selectCls, 'sm:w-44')}>
            <option value="">Todos os canais</option>
            <option value="WHATSAPP_ZAPPFY">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="mx-auto mt-5 flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Barra de seleção / ações em massa */}
        {contacts.length > 0 && (
          <div className={cn(
            'flex shrink-0 flex-wrap items-center gap-3 border-b px-5 py-2.5 transition-colors',
            selected.size > 0
              ? 'border-primary/20 bg-primary/[0.04] dark:bg-primary/10'
              : 'border-zinc-100 dark:border-zinc-800',
          )}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAllPage}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-600"
              />
              {selected.size > 0 ? (
                <span className="font-medium text-zinc-800 dark:text-zinc-100">{selected.size} selecionado(s)</span>
              ) : (
                <span className="text-zinc-400">Selecionar para editar em massa</span>
              )}
            </label>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Definir status */}
                <div className="relative">
                  <CircleDot className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <select
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => e.target.value && bulkSetStatus(e.target.value)}
                    className={cn(selectCls, 'py-1.5 pl-8 text-[13px]')}
                  >
                    <option value="">Definir status…</option>
                    <option value="none">Sem status</option>
                    {statuses.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                {/* Adicionar etiqueta */}
                <div className="relative">
                  <TagIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <select
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => e.target.value && bulkAddTag(e.target.value)}
                    className={cn(selectCls, 'py-1.5 pl-8 text-[13px]')}
                  >
                    <option value="">Adicionar etiqueta…</option>
                    {tags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                {/* Remover etiqueta */}
                <div className="relative">
                  <TagIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <select
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => e.target.value && bulkRemoveTag(e.target.value)}
                    className={cn(selectCls, 'py-1.5 pl-8 text-[13px]')}
                  >
                    <option value="">Remover etiqueta…</option>
                    {tags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <button
                  onClick={clearSelection}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-16 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhum contato encontrado</p>
              <p className="mt-1 text-xs text-zinc-400">
                {hasFilters ? 'Tente ajustar a busca ou os filtros.' : 'Os contatos aparecem aqui conforme as conversas chegam.'}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-4 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.letter || 'all'}>
                  {alphabetical && (
                    <div className="sticky top-0 z-10 border-y border-zinc-100 bg-zinc-50/95 px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                      {group.letter}
                    </div>
                  )}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {group.items.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        selected={selected.has(contact.id)}
                        onToggle={() => toggleOne(contact.id)}
                        members={members}
                        onAssign={handleAssign}
                        allTags={tags}
                        allStatuses={statuses}
                        onAddTag={handleAddTag}
                        onRemoveTag={handleRemoveTag}
                        onSetStatus={handleSetStatus}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paginação */}
        {pagination && pagination.totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Labeled = { id: string; name: string; color: string };

function ContactRow({
  contact,
  selected,
  onToggle,
  members,
  onAssign,
  allTags,
  allStatuses,
  onAddTag,
  onRemoveTag,
  onSetStatus,
}: {
  contact: Contact;
  selected: boolean;
  onToggle: () => void;
  members: Member[];
  onAssign: (contactId: string, userId: string | null) => void;
  allTags: Labeled[];
  allStatuses: Labeled[];
  onAddTag: (contactId: string, tagId: string) => void;
  onRemoveTag: (contactId: string, tagId: string) => void;
  onSetStatus: (contactId: string, statusId: string | null) => void;
}) {
  const state = getBrazilState(contact.phone);
  const color = avatarColor(contact.name);
  const convCount = contact._count?.conversations ?? 0;
  // Canais únicos por tipo (evita repetir o mesmo ícone N vezes).
  const channelTypes = Array.from(new Set(contact.channels.map((c) => c.channel.type)));

  return (
    <div className={cn(
      'group flex items-center gap-3 px-5 py-3 transition-colors',
      selected ? 'bg-primary/[0.06] dark:bg-primary/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
    )}>
      {/* Checkbox de seleção */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className={cn(
          'h-4 w-4 shrink-0 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-600',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      />

      {/* Avatar */}
      <div className="relative shrink-0">
        {contact.avatarUrl ? (
          <img src={contact.avatarUrl} alt={contact.name || ''} className="h-11 w-11 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10" />
        ) : (
          <div
            className="grid h-11 w-11 place-items-center rounded-full text-sm font-semibold text-white ring-1 ring-black/5"
            style={{ backgroundColor: color }}
          >
            {avatarInitials(contact.name)}
          </div>
        )}
      </div>

      {/* Nome + contato */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {contact.name || 'Sem nome'}
          </p>
          {state && <StateFlag uf={state.uf} title={state.name} />}
          <StatusCell contact={contact} allStatuses={allStatuses} onSet={onSetStatus} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {contact.phone && (
            <span className="inline-flex items-center gap-1 truncate">
              <Phone className="h-3 w-3 shrink-0 text-zinc-400" />
              {formatPhone(contact.phone)}
            </span>
          )}
          {contact.email && (
            <span className="hidden items-center gap-1 truncate sm:inline-flex">
              <Mail className="h-3 w-3 shrink-0 text-zinc-400" />
              {contact.email}
            </span>
          )}
        </div>
      </div>

      {/* Tags (interativas: × remove, ícone + adiciona) */}
      <TagsCell contact={contact} allTags={allTags} onAdd={onAddTag} onRemove={onRemoveTag} />

      {/* Canais */}
      <div className="hidden items-center gap-1.5 sm:flex">
        {channelTypes.map((type) => (
          <ChannelIcon key={type} type={type} className="h-4 w-4" />
        ))}
      </div>

      {/* Responsável */}
      <ResponsibleCell contact={contact} members={members} onAssign={onAssign} />

      {/* Conversas + última atividade */}
      <div className="hidden w-24 shrink-0 flex-col items-end gap-0.5 text-right lg:flex">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <MessageSquare className="h-3 w-3 text-zinc-400" />
          {convCount}
        </span>
        {contact.updatedAt && (
          <span className="text-[11px] text-zinc-400">{relativeTime(contact.updatedAt)}</span>
        )}
      </div>

      {/* Abrir conversa */}
      {contact.phone && (
        <Link
          href={`/inbox?search=${encodeURIComponent(contact.phone)}`}
          title="Abrir conversa"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 opacity-0 transition hover:bg-[#25D366]/10 hover:text-[#25D366] group-hover:opacity-100"
        >
          <WhatsAppIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** Avatar circular do responsável (foto ou iniciais coloridas). */
function RespAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" onError={() => setFailed(true)} className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitials(name)}
    </span>
  );
}

/** Status do contato com menu pra trocar/remover (interativo, igual ao resto). */
function StatusCell({
  contact,
  allStatuses,
  onSet,
}: {
  contact: Contact;
  allStatuses: Labeled[];
  onSet: (contactId: string, statusId: string | null) => void;
}) {
  const s = contact.status;
  return (
    <Menu as="div" className="relative inline-block shrink-0">
      <MenuButton
        onClick={(e) => e.stopPropagation()}
        title={s ? `Status: ${s.name} — clique pra trocar` : 'Definir status'}
      >
        {s ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: s.color, color: chipTextColor(s.color) }}
          >
            {s.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600">
            <CircleDot className="h-3 w-3" /> status
          </span>
        )}
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-50 mt-1 max-h-72 w-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        {s && (
          <MenuItem>
            <button onClick={() => onSet(contact.id, null)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="h-3.5 w-3.5" /> Sem status
            </button>
          </MenuItem>
        )}
        {allStatuses.map((st) => (
          <MenuItem key={st.id}>
            <button onClick={() => onSet(contact.id, st.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st.color }} />
              <span className="flex-1 truncate text-left">{st.name}</span>
              {s?.id === st.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/** Etiquetas do contato: × remove cada uma, botão + adiciona (menu). */
function TagsCell({
  contact,
  allTags,
  onAdd,
  onRemove,
}: {
  contact: Contact;
  allTags: Labeled[];
  onAdd: (contactId: string, tagId: string) => void;
  onRemove: (contactId: string, tagId: string) => void;
}) {
  const tagIds = new Set(contact.tags.map((t) => t.tag.id));
  const available = allTags.filter((t) => !tagIds.has(t.id));
  return (
    <div className="hidden max-w-[240px] flex-wrap items-center justify-end gap-1 md:flex">
      {contact.tags.slice(0, 3).map((t) => (
        <span
          key={t.tag.id}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: t.tag.color, color: chipTextColor(t.tag.color) }}
        >
          <span className="max-w-[80px] truncate">{t.tag.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(contact.id, t.tag.id); }}
            title="Remover etiqueta"
            className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {contact.tags.length > 3 && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
          +{contact.tags.length - 3}
        </span>
      )}
      <Menu as="div" className="relative">
        <MenuButton
          onClick={(e) => e.stopPropagation()}
          title="Adicionar etiqueta"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:hover:border-zinc-500"
        >
          <Plus className="h-3 w-3" />
        </MenuButton>
        <MenuItems
          anchor="bottom end"
          className="z-50 mt-1 max-h-72 w-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          {available.length === 0 ? (
            <div className="px-2 py-2 text-center text-xs text-zinc-400">Todas as etiquetas já estão no contato.</div>
          ) : (
            available.map((t) => (
              <MenuItem key={t.id}>
                <button onClick={() => onAdd(contact.id, t.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                  <span className="flex-1 truncate text-left">{t.name}</span>
                </button>
              </MenuItem>
            ))
          )}
        </MenuItems>
      </Menu>
    </div>
  );
}

/** Pílula do responsável + menu pra atribuir/trocar/remover. */
function ResponsibleCell({
  contact,
  members,
  onAssign,
}: {
  contact: Contact;
  members: Member[];
  onAssign: (contactId: string, userId: string | null) => void;
}) {
  // Responsável REAL: explícito do contato OU, na falta, o atendente da
  // conversa mais recente (cruzamento de dados com as conversas).
  const fromConv = (contact.conversations as { assignedTo?: { id: string; name: string; avatarUrl: string | null } | null }[] | undefined)?.[0]?.assignedTo ?? null;
  const a = contact.assignedTo ?? fromConv;
  const derived = !contact.assignedTo && !!fromConv;
  return (
    <Menu as="div" className="relative hidden shrink-0 sm:block">
      <MenuButton
        onClick={(e) => e.stopPropagation()}
        title={a ? `Responsável: ${a.name}${derived ? ' (da conversa)' : ''}` : 'Atribuir responsável'}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 py-0.5 pl-0.5 pr-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {a ? (
          <>
            <RespAvatar name={a.name} avatarUrl={a.avatarUrl} />
            <span className="hidden max-w-[80px] truncate lg:inline">{a.name.split(' ')[0]}</span>
          </>
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <UserPlus className="h-3.5 w-3.5" />
          </span>
        )}
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        <MenuItem>
          <button
            onClick={() => onAssign(contact.id, null)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <X className="h-3 w-3" />
            </span>
            Sem responsável
          </button>
        </MenuItem>
        {members.map((m) => {
          const active = a?.id === m.userId;
          return (
            <MenuItem key={m.id}>
              <button
                onClick={() => onAssign(contact.id, m.userId)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <RespAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
                <span className="flex-1 truncate text-left">{m.user.name}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}
