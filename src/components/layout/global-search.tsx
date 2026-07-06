'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Briefcase, User, CornerDownLeft } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { clientsService } from '@/features/legal-cases/services/clients.service';

type Result =
  | { kind: 'case'; id: string; title: string; subtitle: string | null; href: string }
  | { kind: 'client'; id: string; title: string; subtitle: string | null; href: string };

const onlyDigits = (s: string) => s.replace(/\D/g, '');

/**
 * Busca global central (estilo Astrea): barra fixa no topo de todas as telas.
 * Procura PROCESSOS (título, nº CNJ, partes) e CLIENTES (nome, documento) usando
 * os endpoints de lista que já existem — filtragem no cliente, sem backend novo.
 * Os dados são carregados sob demanda (só quando a busca é aberta) e ficam em
 * cache pelo react-query.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const enabled = open || query.length > 0;
  const casesQ = useQuery({ queryKey: ['global-search', 'cases'], queryFn: () => legalCasesService.list({}), enabled, staleTime: 60_000 });
  const clientsQ = useQuery({ queryKey: ['global-search', 'clients'], queryFn: () => clientsService.list(), enabled, staleTime: 60_000 });

  // Atalho de teclado Ctrl/⌘+K para focar a busca (igual Astrea/Spotlight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const qd = onlyDigits(q);
    const caseHits: Result[] = (casesQ.data ?? [])
      .filter((c) => {
        const byText = c.title.toLowerCase().includes(q)
          || (c.parties ?? []).some((p) => p.name.toLowerCase().includes(q));
        const byCnj = qd.length >= 3 && onlyDigits(c.cnjNumber ?? '').includes(qd);
        return byText || byCnj;
      })
      .slice(0, 6)
      .map((c) => ({ kind: 'case', id: c.id, title: c.title, subtitle: c.cnjNumber ?? c.area ?? null, href: `/processos/${c.id}` }));
    const clientHits: Result[] = (clientsQ.data ?? [])
      .filter((c) => {
        const byText = c.name.toLowerCase().includes(q);
        const byDoc = qd.length >= 3 && onlyDigits(c.document ?? '').includes(qd);
        return byText || byDoc;
      })
      .slice(0, 6)
      .map((c) => ({ kind: 'client', id: c.partyId, title: c.name, subtitle: c.document ?? `${c.cases} processo(s)`, href: `/clientes/${c.partyId}` }));
    return [...caseHits, ...clientHits];
  }, [query, casesQ.data, clientsQ.data]);

  useEffect(() => { setActive(0); }, [query]);

  const go = (r: Result) => {
    setOpen(false);
    setQuery('');
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[active]; if (r) go(r); }
  };

  const loading = enabled && (casesQ.isLoading || clientsQ.isLoading);
  const showPanel = open && query.trim().length >= 2;
  const firstClientIdx = results.findIndex((r) => r.kind === 'client');

  return (
    <div ref={boxRef} className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar processos, clientes…"
        className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-16 text-sm text-zinc-700 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:bg-zinc-900"
      />
      {query ? (
        <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} title="Limpar" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 sm:block">⌘K</kbd>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">Nenhum processo ou cliente encontrado.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {results.some((r) => r.kind === 'case') && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Processos</p>}
              {results.map((r, i) => (
                <div key={`${r.kind}-${r.id}`}>
                  {firstClientIdx === i && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Clientes</p>}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active === i ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${r.kind === 'case' ? 'bg-[#228BE6]/10 text-[#228BE6]' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                      {r.kind === 'case' ? <Briefcase className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-800 dark:text-zinc-100">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-zinc-400">{r.subtitle}</span>}
                    </span>
                    {active === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
