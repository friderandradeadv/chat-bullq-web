'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, MessageSquare, Scale } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

// Lista SELETA de clientes reais: derivada das partes role=CLIENT dos processos
// (deduplicadas por nome). Cruza com o chat via contactId quando a parte está
// vinculada a um contato. Cliente importado do Astrea ainda não tem contactId.
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface ClienteRow {
  name: string;
  partyId: string; // uma party representativa → /clientes/[partyId]
  contactId: string | null;
  cases: number;
  monitorados: number; // com nº CNJ
}

export default function ClientesPage() {
  const [search, setSearch] = useState('');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['legal-cases', 'all'],
    queryFn: () => legalCasesService.list({}),
  });

  const clientes = useMemo<ClienteRow[]>(() => {
    const map = new Map<string, ClienteRow>();
    for (const c of cases) {
      const monit = c.cnjNumber ? 1 : 0;
      for (const p of c.parties) {
        const key = norm(p.name);
        if (!key) continue;
        const cur = map.get(key);
        if (cur) {
          cur.cases += 1;
          cur.monitorados += monit;
          if (!cur.contactId && p.contactId) cur.contactId = p.contactId;
        } else {
          map.set(key, { name: p.name, partyId: p.id, contactId: p.contactId, cases: 1, monitorados: monit });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
  }, [cases]);

  const filtered = search.trim()
    ? clientes.filter((c) => norm(c.name).includes(norm(search)))
    : clientes;
  const vinculados = clientes.filter((c) => c.contactId).length;

  return (
    <div className="flex h-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="flex items-center gap-2 text-2xl font-normal text-zinc-700 dark:text-zinc-200">
          <Users className="h-6 w-6" style={{ color: '#228BE6' }} />
          Clientes
        </h1>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3 px-6 pt-5">
        <div className="relative max-w-2xl flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente pelo nome"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>

      <div className="px-6 pt-3 text-sm text-zinc-500">
        {filtered.length} cliente(s) · {vinculados} vinculado(s) ao chat
      </div>

      {/* Lista */}
      <div className="mt-2 flex-1 overflow-y-auto px-6 pb-6">
        <div className="overflow-hidden rounded-lg border border-[#DEE2E6] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4 whitespace-nowrap">Processos</th>
                <th className="px-4 py-4">Chat</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-400">Carregando…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-400">Nenhum cliente encontrado.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.partyId} className="group border-b border-[#DEE2E6] last:border-0 hover:bg-[#f0f7fd] dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.partyId}`} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#228BE6]/10 text-xs font-semibold text-[#228BE6]">
                        {c.name.trim().slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-zinc-800 group-hover:text-[#228BE6] group-hover:underline dark:text-zinc-200">
                        {c.name}
                      </span>
                    </Link>
                  </td>
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
                  <td className="px-4 py-3">
                    {c.contactId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <MessageSquare className="h-3 w-3" /> Vinculado
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
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
