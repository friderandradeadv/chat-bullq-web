'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, MessageSquare, Scale, Phone, Tag as TagIcon, Check } from 'lucide-react';
import { clientsService, type ClientRow } from '@/features/legal-cases/services/clients.service';
import { formatPhone } from '@/lib/brazil-states';

// Lista SELETA de clientes reais (partes role=CLIENT, deduplicadas por nome),
// cruzada no backend com a ficha de contatos do Comercial: etiquetas, status,
// telefone e a conversa de WhatsApp aparecem quando há contato vinculado/casado.
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export default function ClientesPage() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagMenu, setTagMenu] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['legal-clients'],
    queryFn: () => clientsService.list(),
  });

  // Universo de etiquetas presentes entre os clientes (para o filtro).
  const allTags = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    for (const c of clientes) for (const t of c.contact?.tags ?? []) if (!m.has(t.id)) m.set(t.id, t);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clientes]);

  const filtered = useMemo(() => {
    let list: ClientRow[] = clientes;
    if (search.trim()) list = list.filter((c) => norm(c.name).includes(norm(search)));
    if (tagFilter) list = list.filter((c) => c.contact?.tags.some((t) => t.id === tagFilter));
    return list;
  }, [clientes, search, tagFilter]);

  const vinculados = clientes.filter((c) => c.contact).length;

  return (
    <div className="flex h-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="flex items-center gap-2 text-2xl font-normal text-zinc-700 dark:text-zinc-200">
          <Users className="h-6 w-6" style={{ color: '#228BE6' }} />
          Clientes
        </h1>
      </div>

      {/* Busca + filtro de etiqueta */}
      <div className="flex flex-wrap items-center gap-3 px-6 pt-5">
        <div className="relative max-w-xl flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente pelo nome"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>

        {/* Filtro por etiqueta */}
        <div className="relative">
          <button
            onClick={() => setTagMenu((v) => !v)}
            className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm ${
              tagFilter
                ? 'border-[#228BE6] text-[#228BE6]'
                : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            <TagIcon className="h-4 w-4" />
            {tagFilter ? allTags.find((t) => t.id === tagFilter)?.name ?? 'Etiqueta' : 'Etiqueta'}
          </button>
          {tagMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTagMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  onClick={() => { setTagFilter(null); setTagMenu(false); }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Todas as etiquetas {!tagFilter && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
                </button>
                {allTags.length === 0 && (
                  <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta nos clientes.</div>
                )}
                {allTags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTagFilter(t.id); setTagMenu(false); }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                    {tagFilter === t.id && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-6 pt-3 text-sm text-zinc-500">
        {filtered.length} cliente(s) · {vinculados} com ficha do Comercial
      </div>

      {/* Lista */}
      <div className="mt-2 flex-1 overflow-y-auto px-6 pb-6">
        <div className="overflow-x-auto rounded-lg border border-[#DEE2E6] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Etiquetas</th>
                <th className="px-4 py-4 whitespace-nowrap">Processos</th>
                <th className="px-4 py-4">Contato</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">Carregando…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">Nenhum cliente encontrado.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.partyId} className="group border-b border-[#DEE2E6] last:border-0 hover:bg-[#f0f7fd] dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                  {/* Cliente */}
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.partyId}`} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#228BE6]/10 text-xs font-semibold text-[#228BE6]">
                        {c.name.trim().slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[240px] truncate text-sm font-medium text-zinc-800 group-hover:text-[#228BE6] group-hover:underline dark:text-zinc-200">
                          {c.name}
                        </span>
                        {c.contact?.status && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.contact.status.color }} />
                            {c.contact.status.name}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>

                  {/* Etiquetas */}
                  <td className="px-4 py-3">
                    {c.contact?.tags.length ? (
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {c.contact.tags.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: `${t.color}22`, color: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {c.contact.tags.length > 4 && (
                          <span className="text-[11px] text-zinc-400">+{c.contact.tags.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Processos */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-zinc-400" />
                      {c.cases}
                      {c.monitorados > 0 && (
                        <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {c.monitorados} no DJEN
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Contato */}
                  <td className="px-4 py-3">
                    {c.contact ? (
                      <div className="flex flex-col gap-1">
                        {c.contact.phone && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Phone className="h-3 w-3" /> {formatPhone(c.contact.phone)}
                          </span>
                        )}
                        {c.contact.conversationId ? (
                          <Link
                            href={`/inbox?conversationId=${c.contact.conversationId}`}
                            className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                          >
                            <MessageSquare className="h-3 w-3" /> Abrir conversa
                          </Link>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#228BE6]/10 px-2 py-0.5 text-xs font-medium text-[#228BE6]">
                            Ficha vinculada
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">Sem ficha no Comercial</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
