'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, MessageSquare, Scale, Phone, Tag as TagIcon, Check, Plus, X, ChevronDown, CircleDot, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientsService, type ClientRow } from '@/features/legal-cases/services/clients.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { formatPhone } from '@/lib/brazil-states';
import { titleCaseName } from '@/lib/names';
import { PageSizeSelect } from '@/components/ui/page-size-select';
import { usePermissions } from '@/hooks/use-permissions';

// Aba Clientes (jurídico) — tão rica quanto Contatos do Comercial: busca por
// nome, filtros (status/etiqueta), ordenação, paginação e EDIÇÃO INLINE de
// etiquetas e status (quando o cliente tem ficha no Comercial). Os dados vêm
// cruzados do backend (party CLIENT ↔ Contact).
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

type SortKey = 'name' | 'name_desc' | 'cases' | 'djen';
const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nome (A→Z)', name_desc: 'Nome (Z→A)', cases: 'Mais processos', djen: 'Mais no DJEN',
};

export default function ClientesPage() {
  const qc = useQueryClient();
  const { canDeleteCases } = usePermissions();
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | statusId | 'sem'
  const [sort, setSort] = useState<SortKey>('name');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: clientes = [], isLoading } = useQuery({ queryKey: ['legal-clients'], queryFn: () => clientsService.list() });
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: () => tagsService.list() });
  const { data: statuses = [] } = useQuery({ queryKey: ['contact-statuses'], queryFn: () => contactStatusesService.list() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-clients'] });

  const filtered = useMemo(() => {
    let list: ClientRow[] = clientes;
    if (search.trim()) list = list.filter((c) => norm(c.name).includes(norm(search)) || (c.document ?? '').includes(search.trim()));
    if (tagFilter) list = list.filter((c) => c.contact?.tags.some((t) => t.id === tagFilter));
    if (statusFilter === 'sem') list = list.filter((c) => !c.contact?.status);
    else if (statusFilter) list = list.filter((c) => c.contact?.status?.id === statusFilter);
    const s = [...list];
    if (sort === 'name') s.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'name_desc') s.sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
    else if (sort === 'cases') s.sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'djen') s.sort((a, b) => b.monitorados - a.monitorados || a.name.localeCompare(b.name, 'pt-BR'));
    return s;
  }, [clientes, search, tagFilter, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, pageCount);
  const paginated = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);
  useEffect(() => { setPage(1); }, [search, tagFilter, statusFilter, sort, pageSize]);

  const allTagsInUse = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    for (const c of clientes) for (const t of c.contact?.tags ?? []) if (!m.has(t.id)) m.set(t.id, t);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clientes]);
  const vinculados = clientes.filter((c) => c.contact).length;

  // ── Seleção + ações em massa ──
  const selectedClients = clientes.filter((c) => selected.has(c.partyId));
  const withContact = selectedClients.filter((c) => c.contact).length;
  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = paginated.length > 0 && paginated.every((c) => selected.has(c.partyId));
  const toggleAll = () =>
    setSelected((s) => {
      if (paginated.every((c) => s.has(c.partyId))) { const n = new Set(s); paginated.forEach((c) => n.delete(c.partyId)); return n; }
      return new Set([...s, ...paginated.map((c) => c.partyId)]);
    });

  const archive = useMutation({
    mutationFn: () => clientsService.archive(selectedClients.flatMap((c) => c.partyIds ?? [c.partyId])),
    onSuccess: (r) => { toast.success(`${r.count} processo(s) arquivado(s).`); setSelected(new Set()); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao excluir'),
  });
  const onDelete = () => {
    if (!selectedClients.length) return;
    if (!confirm(`Excluir ${selectedClients.length} cliente(s)? Os processos deles vão para a lixeira (Arquivados) e podem ser recuperados.`)) return;
    archive.mutate();
  };
  const bulkTag = useMutation({
    mutationFn: (tagId: string) => Promise.all(selectedClients.filter((c) => c.contact).map((c) => tagsService.addToContact(c.contact!.id, tagId))),
    onSuccess: () => { toast.success('Etiqueta aplicada.'); refresh(); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });
  const bulkStatus = useMutation({
    mutationFn: (statusId: string | null) => Promise.all(selectedClients.filter((c) => c.contact).map((c) => contactStatusesService.setContactStatus(c.contact!.id, statusId))),
    onSuccess: () => { toast.success('Status atualizado.'); refresh(); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  return (
    <div className="flex h-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pb-1 pt-8">
        <h1 className="flex items-center gap-2 text-2xl font-normal text-zinc-700 dark:text-zinc-200">
          <Users className="h-6 w-6" style={{ color: '#228BE6' }} /> Clientes
        </h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 px-8 pt-4">
        <div className="relative min-w-[240px] flex-1">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou documento"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>

        <Filter label={statusFilter ? (statusFilter === 'sem' ? 'Sem status' : statuses.find((s) => s.id === statusFilter)?.name ?? 'Status') : 'Status'} active={!!statusFilter}>
          {(close) => (
            <>
              <FilterItem onClick={() => { setStatusFilter(''); close(); }} active={!statusFilter}>Todos os status</FilterItem>
              {statuses.map((s) => (
                <FilterItem key={s.id} onClick={() => { setStatusFilter(s.id); close(); }} active={statusFilter === s.id}>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                </FilterItem>
              ))}
              <FilterItem onClick={() => { setStatusFilter('sem'); close(); }} active={statusFilter === 'sem'}>Sem status</FilterItem>
            </>
          )}
        </Filter>

        <Filter label={tagFilter ? allTagsInUse.find((t) => t.id === tagFilter)?.name ?? 'Etiqueta' : 'Etiqueta'} active={!!tagFilter} icon={<TagIcon className="h-4 w-4" />}>
          {(close) => (
            <>
              <FilterItem onClick={() => { setTagFilter(''); close(); }} active={!tagFilter}>Todas as etiquetas</FilterItem>
              {allTagsInUse.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</div>}
              {allTagsInUse.map((t) => (
                <FilterItem key={t.id} onClick={() => { setTagFilter(t.id); close(); }} active={tagFilter === t.id}>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</span>
                </FilterItem>
              ))}
            </>
          )}
        </Filter>

        <Filter label={SORT_LABEL[sort]} active={false}>
          {(close) => (
            <>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <FilterItem key={k} onClick={() => { setSort(k); close(); }} active={sort === k}>{SORT_LABEL[k]}</FilterItem>
              ))}
            </>
          )}
        </Filter>
      </div>

      <div className="flex min-h-[36px] flex-wrap items-center justify-between gap-2 px-8 pt-3 text-sm text-zinc-500">
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[#228BE6]">{selected.size} selecionado(s)</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <Filter label="Etiqueta" active={false} icon={<TagIcon className="h-4 w-4" />}>
              {(close) => (
                <>
                  {allTags.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</div>}
                  {allTags.map((t) => (
                    <FilterItem key={t.id} onClick={() => { bulkTag.mutate(t.id); close(); }}>
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</span>
                    </FilterItem>
                  ))}
                </>
              )}
            </Filter>
            <Filter label="Status" active={false}>
              {(close) => (
                <>
                  <FilterItem onClick={() => { bulkStatus.mutate(null); close(); }}>Sem status</FilterItem>
                  {statuses.map((s) => (
                    <FilterItem key={s.id} onClick={() => { bulkStatus.mutate(s.id); close(); }}>
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                    </FilterItem>
                  ))}
                </>
              )}
            </Filter>
            {canDeleteCases && (
              <button
                onClick={onDelete}
                disabled={archive.isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
            {withContact < selected.size && (
              <span className="text-xs text-zinc-400">Etiqueta/Status só nos {withContact} com ficha</span>
            )}
            <button onClick={() => setSelected(new Set())} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Limpar seleção</button>
          </div>
        ) : (
          <span>{filtered.length} cliente(s) · {vinculados} com ficha do Comercial</span>
        )}
        <PageSizeSelect value={pageSize} onChange={setPageSize} />
      </div>

      {/* Lista */}
      <div className="mt-2 flex-1 overflow-auto px-8 pb-6">
        <div className="overflow-hidden rounded-lg border border-[#DEE2E6] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="w-10 px-3 py-4"><input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#228BE6]" title="Selecionar todos" /></th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Etiquetas</th>
                <th className="px-4 py-4 whitespace-nowrap">Processos</th>
                <th className="px-4 py-4">Contato</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">Carregando…</td></tr>}
              {!isLoading && paginated.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">Nenhum cliente encontrado.</td></tr>}
              {paginated.map((c) => (
                <ClienteRow key={c.partyId} c={c} statuses={statuses} allTags={allTags} onChanged={refresh} selected={selected.has(c.partyId)} onToggle={() => toggle(c.partyId)} />
              ))}
            </tbody>
          </table>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-[#DEE2E6] px-4 py-3 text-sm dark:border-zinc-800">
              <span className="text-zinc-500">{(curPage - 1) * pageSize + 1}–{Math.min(curPage * pageSize, filtered.length)} de {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={curPage <= 1} className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Anterior</button>
                <span className="px-2 text-zinc-500">Página {curPage} de {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={curPage >= pageCount} className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Próxima</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClienteRow({ c, statuses, allTags, onChanged, selected, onToggle }: {
  c: ClientRow;
  statuses: { id: string; name: string; color: string }[];
  allTags: { id: string; name: string; color: string }[];
  onChanged: () => void;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={`group border-b border-[#DEE2E6] last:border-0 align-top hover:bg-[#f0f7fd] dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${selected ? 'bg-[#e7f1fb] dark:bg-zinc-800/60' : ''}`}>
      {/* Seleção */}
      <td className="w-10 px-3 py-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-[#228BE6]" />
      </td>
      {/* Cliente */}
      <td className="px-4 py-3">
        <Link href={`/clientes/${c.partyId}`} className="flex items-center gap-2.5">
          {c.contact?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.contact.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#228BE6]/10 text-xs font-semibold text-[#228BE6]">
              {c.name.trim().slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[240px] truncate text-sm font-medium text-zinc-800 group-hover:text-[#228BE6] group-hover:underline dark:text-zinc-200">{titleCaseName(c.name)}</span>
            {c.document && <span className="block text-[11px] text-zinc-400">{c.document}</span>}
          </span>
        </Link>
      </td>
      {/* Status inline */}
      <td className="px-4 py-3">
        {c.contact ? <InlineStatus contactId={c.contact.id} current={c.contact.status} statuses={statuses} onChanged={onChanged} /> : <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>}
      </td>
      {/* Etiquetas inline */}
      <td className="px-4 py-3">
        {c.contact ? <InlineTags contactId={c.contact.id} tags={c.contact.tags} allTags={allTags} onChanged={onChanged} /> : <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>}
      </td>
      {/* Processos */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-zinc-400" />{c.cases}
          {c.monitorados > 0 && <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{c.monitorados} no DJEN</span>}
        </span>
      </td>
      {/* Contato */}
      <td className="px-4 py-3">
        {c.contact ? (
          <div className="flex flex-col gap-1">
            {c.contact.phone && <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Phone className="h-3 w-3" /> {formatPhone(c.contact.phone)}</span>}
            {c.contact.conversationId ? (
              <Link href={`/inbox?conversationId=${c.contact.conversationId}`} className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"><MessageSquare className="h-3 w-3" /> Abrir conversa</Link>
            ) : (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#228BE6]/10 px-2 py-0.5 text-xs font-medium text-[#228BE6]">Ficha vinculada</span>
            )}
          </div>
        ) : <span className="text-xs text-zinc-400">Sem ficha no Comercial</span>}
      </td>
    </tr>
  );
}

/** Status editável inline (pill clicável → popover com a lista de status). */
function InlineStatus({ contactId, current, statuses, onChanged }: {
  contactId: string;
  current: { id: string; name: string; color: string } | null;
  statuses: { id: string; name: string; color: string }[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = useMutation({
    mutationFn: (statusId: string | null) => contactStatusesService.setContactStatus(contactId, statusId),
    onSuccess: () => { setOpen(false); onChanged(); },
  });
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium hover:ring-1 hover:ring-zinc-300 dark:hover:ring-zinc-600"
        style={current ? { backgroundColor: `${current.color}22`, color: current.color } : undefined}>
        {current ? <><span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.color }} />{current.name}</> : <span className="text-zinc-400">+ status</span>}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-60 w-52 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button onClick={() => set.mutate(null)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">Sem status {!current && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}</button>
            {statuses.map((s) => (
              <button key={s.id} onClick={() => set.mutate(s.id)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                {current?.id === s.id && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Etiquetas editáveis inline (chips + popover de adicionar/remover). */
function InlineTags({ contactId, tags, allTags, onChanged }: {
  contactId: string;
  tags: { id: string; name: string; color: string }[];
  allTags: { id: string; name: string; color: string }[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const has = (id: string) => tags.some((t) => t.id === id);
  const add = useMutation({ mutationFn: (tagId: string) => tagsService.addToContact(contactId, tagId), onSuccess: onChanged });
  const remove = useMutation({ mutationFn: (tagId: string) => tagsService.removeFromContact(contactId, tagId), onSuccess: onChanged });
  return (
    <div className="flex max-w-xs flex-wrap items-center gap-1">
      {tags.slice(0, 4).map((t) => (
        <span key={t.id} className="group/tag inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
          {t.name}
          <button onClick={() => remove.mutate(t.id)} className="opacity-0 transition-opacity group-hover/tag:opacity-70 hover:!opacity-100" title="Remover"><X className="h-3 w-3" /></button>
        </span>
      ))}
      {tags.length > 4 && <span className="text-[11px] text-zinc-400">+{tags.length - 4}</span>}
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-600"><Plus className="h-3 w-3" /></button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 max-h-56 w-52 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {allTags.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</div>}
              {allTags.map((t) => (
                <button key={t.id} onClick={() => (has(t.id) ? remove.mutate(t.id) : add.mutate(t.id))} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</span>
                  {has(t.id) && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Filtro genérico (dropdown) ───────────────────────────
function Filter({ label, active, icon, children }: { label: string; active: boolean; icon?: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300'}`}>
        {icon}{label}<ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}
function FilterItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
      {children} {active && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
    </button>
  );
}
