'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  RefreshCw, Search, ChevronDown, X, Check, MoreVertical, FileText,
  Link2, CalendarPlus, Trash2, Newspaper, Printer, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  djenService, type Publication, type PublicationGroup,
} from '@/features/djen/services/djen.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CnjNumber, ASTREA_BLUE } from '../processos/page';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const GROUP_LABEL: Record<PublicationGroup, string> = {
  nao_tratada: 'Não tratada', tratada: 'Tratada', descartada: 'Descartada', all: 'Todas',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/** Status visual a partir do status do modelo. */
function statusBadge(p: Publication) {
  if (p.status === 'DISMISSED') return { label: 'DESCARTADA', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' };
  if (p.status === 'LINKED') return { label: 'TRATADA', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  return { label: 'NÃO TRATADA', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
}

export default function CaixaDjenPage() {
  const qc = useQueryClient();
  const [group, setGroup] = useState<PublicationGroup>('nao_tratada');
  const [q, setQ] = useState('');
  const [uf, setUf] = useState('');
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['djen-stats'], queryFn: () => djenService.stats() });
  const { data: pubs = [], isLoading } = useQuery({
    queryKey: ['djen', { group, q, uf }],
    queryFn: () => djenService.list({ group, q: q || undefined, uf: uf || undefined }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['djen'] });
    qc.invalidateQueries({ queryKey: ['djen-stats'] });
  };

  const run = async () => {
    setRunning(true);
    try {
      const s = await djenService.run({});
      toast.success(`Scan: ${s.novas} novas · ${s.vinculadas} vinculadas · ${s.prazosCriados} prazos`);
      refresh();
    } catch (err: any) { toast.error(err?.message || 'Erro ao rodar o scan'); }
    finally { setRunning(false); }
  };

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = pubs.length > 0 && pubs.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      if (pubs.every((p) => s.has(p.id))) { const n = new Set(s); pubs.forEach((p) => n.delete(p.id)); return n; }
      return new Set([...s, ...pubs.map((p) => p.id)]);
    });

  const bulk = async (action: 'dismiss' | 'gravar_historico') => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const r = await djenService.bulk(ids, action);
      if (action === 'dismiss') toast.success(`${r.afetadas ?? ids.length} descartada(s)`);
      else toast.success(`${r.gravadas ?? 0} gravada(s) como histórico${r.semProcesso ? ` · ${r.semProcesso} sem processo` : ''}`);
      setSelected(new Set());
      refresh();
    } catch (err: any) { toast.error(err?.message || 'Erro na ação em lote'); }
  };

  return (
    <div className="flex h-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pb-1 pt-8">
        <h1 className="flex items-center gap-2 text-2xl font-normal text-zinc-700 dark:text-zinc-100">
          <Newspaper className="h-6 w-6" style={{ color: ASTREA_BLUE }} /> Publicações
        </h1>
        <button
          onClick={run} disabled={running}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
          style={{ backgroundColor: ASTREA_BLUE }}
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'Buscando…' : 'Rodar agora'}
        </button>
      </div>

      {/* Cartões-resumo + mini-gráfico */}
      <div className="px-8 pt-4">
        <div className="flex flex-wrap items-stretch gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <StatCard n={stats?.naoTratadosHoje ?? 0} label="Não tratados de hoje" color="text-zinc-700 dark:text-zinc-200" />
          <Sep />
          <StatCard n={stats?.tratadosHoje ?? 0} label="Tratados de hoje" color="text-[#228BE6]" />
          <Sep />
          <StatCard n={stats?.descartadasHoje ?? 0} label="Descartadas hoje" color="text-rose-500" />
          <Sep />
          <StatCard n={stats?.naoTratadosTotal ?? 0} label="Não tratados" color="text-amber-500" />
          <div className="ml-auto hidden items-end gap-1 sm:flex" title="Publicações nos últimos 10 dias">
            {(stats?.serie ?? []).map((d) => {
              const max = Math.max(1, ...(stats?.serie ?? []).map((x) => x.count));
              return (
                <div key={d.date} className="flex w-3 flex-col items-center justify-end" style={{ height: 48 }} title={`${fmt(d.date)}: ${d.count}`}>
                  <div className="w-full rounded-sm" style={{ height: `${Math.max(4, (d.count / max) * 48)}px`, backgroundColor: d.count ? ASTREA_BLUE : '#E9ECEF' }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 px-8 pt-4">
        <div className="relative max-w-md flex-1">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Digite o processo ou termo pesquisado"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>

        <Dropdown label={uf ? `Estado: ${uf}` : 'Estados'} active={!!uf}>
          {(close) => (
            <>
              <MenuItem onClick={() => { setUf(''); close(); }} active={!uf}>Todos os estados</MenuItem>
              <div className="grid max-h-56 grid-cols-3 gap-0.5 overflow-y-auto p-1">
                {UFS.map((u) => (
                  <button key={u} onClick={() => { setUf(u); close(); }}
                    className={`rounded px-2 py-1 text-xs ${uf === u ? 'bg-[#228BE6] text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{u}</button>
                ))}
              </div>
            </>
          )}
        </Dropdown>

        <Dropdown label="Status" active={group !== 'all'}>
          {(close) => (
            <>
              {(['nao_tratada', 'tratada', 'descartada', 'all'] as PublicationGroup[]).map((g) => (
                <MenuItem key={g} onClick={() => { setGroup(g); close(); }} active={group === g}>{GROUP_LABEL[g]}</MenuItem>
              ))}
            </>
          )}
        </Dropdown>

        {group !== 'all' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#228BE6]/10 px-3 py-1 text-xs font-medium text-[#228BE6]">
            STATUS: {GROUP_LABEL[group].toUpperCase()}
            <button onClick={() => setGroup('all')} className="hover:text-[#1971c2]"><X className="h-3 w-3" /></button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <IconBtn title="Imprimir"><Printer className="h-4 w-4" /></IconBtn>
          <IconBtn title="Exportar"><FileDown className="h-4 w-4" /></IconBtn>
          <Dropdown label="Ações em lote" active={false} variant="solid" disabled={selected.size === 0}>
            {(close) => (
              <>
                <MenuItem onClick={() => { bulk('gravar_historico'); close(); }}>Gravar como histórico do processo</MenuItem>
                <MenuItem onClick={() => { bulk('dismiss'); close(); }} danger>Descartar</MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* contagem + expandir */}
      <div className="flex items-center justify-between px-8 pt-3 text-sm text-zinc-500">
        <span>{selected.size > 0 ? `${selected.size} selecionada(s)` : `Mostrando ${pubs.length} publicaç${pubs.length === 1 ? 'ão' : 'ões'}`}</span>
        <button onClick={() => setExpandAll((v) => !v)} className="text-[#228BE6] hover:underline">{expandAll ? 'Recolher todos' : 'Expandir todos'}</button>
      </div>

      {/* Tabela */}
      <div className="mt-2 flex-1 overflow-auto px-8 pb-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="w-10 px-3 py-3.5"><input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#228BE6]" /></th>
                <th className="px-3 py-3.5 whitespace-nowrap">Divulgado em</th>
                <th className="px-3 py-3.5">Tipo</th>
                <th className="px-3 py-3.5">Processo</th>
                <th className="px-3 py-3.5">Diário</th>
                <th className="px-3 py-3.5">Nome pesquisado</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">Carregando…</td></tr>}
              {!isLoading && pubs.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">Nenhuma publicação.</td></tr>}
              {pubs.map((p) => (
                <PubRow key={p.id} p={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} forceOpen={expandAll} onChange={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex min-w-[120px] flex-col justify-center px-2">
      <span className={`text-3xl font-semibold leading-none ${color}`}>{n}</span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
    </div>
  );
}
const Sep = () => <div className="hidden w-px self-stretch bg-zinc-100 dark:bg-zinc-800 sm:block" />;

function PubRow({ p, selected, onToggle, forceOpen, onChange }: { p: Publication; selected: boolean; onToggle: () => void; forceOpen: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [linking, setLinking] = useState(false);
  const isOpen = open || forceOpen;
  const cls = p.classification;
  const badge = statusBadge(p);
  const cnj = p.processoCnj ?? p.case?.cnjNumber ?? null;
  const dias = cls?.diasUteis;

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); onChange(); } catch (e: any) { toast.error(e?.message || 'Erro'); }
  };

  return (
    <>
      <tr className={`group border-b border-zinc-100 last:border-0 align-top hover:bg-[#f0f7fd] dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 ${selected ? 'bg-[#e7f1fb] dark:bg-zinc-800/60' : ''}`}>
        <td className="px-3 py-3.5"><input type="checkbox" checked={selected} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-[#228BE6]" /></td>
        <td className="px-3 py-3.5 whitespace-nowrap text-sm text-zinc-700 dark:text-zinc-300">
          {fmt(p.publishedAt)}
          <span className="mt-0.5 block text-[11px] text-zinc-400">capturado {fmt(p.createdAt)}</span>
        </td>
        <td className="px-3 py-3.5"><span title={cls?.tipoComunicacao ?? 'Publicação'} className="inline-flex"><FileText className="h-4 w-4 text-zinc-400" /></span></td>
        <td className="px-3 py-3.5">
          {cnj ? (
            p.case ? (
              <Link href={`/processos/${p.case.id}`} className="text-sm font-medium text-[#228BE6] hover:underline">{p.case.title}</Link>
            ) : (
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Processo não vinculado</span>
            )
          ) : <span className="text-sm text-zinc-400">—</span>}
          {cnj && <span className="mt-0.5 block"><CnjNumber value={cnj} /></span>}
          {p.case?.responsible?.name && <span className="mt-0.5 block text-[11px] text-zinc-400">Responsável: {p.case.responsible.name}</span>}
        </td>
        <td className="px-3 py-3.5 text-xs text-zinc-500">
          {p.tribunal ?? '—'}
          {p.orgaoJulgador && <span className="mt-0.5 block text-zinc-400">{p.orgaoJulgador}</span>}
        </td>
        <td className="px-3 py-3.5 text-xs text-zinc-600 dark:text-zinc-300">{p.oab}</td>
        <td className="px-3 py-3.5">
          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
          {cls?.fatal && <span className="mt-1 block rounded bg-rose-100 px-1.5 py-0.5 text-center text-[9px] font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">PRAZO FATAL</span>}
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setOpen((v) => !v)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#228BE6] ring-1 ring-inset ring-[#228BE6]/40 hover:bg-[#228BE6]/10">
              {isOpen ? 'Fechar' : 'Acessar publicação'}
            </button>
            {p.status !== 'LINKED' && p.status !== 'DISMISSED' && (
              <button onClick={() => act(() => djenService.bulk([p.id], 'gravar_historico').then((r) => { if (!r.gravadas) throw new Error('Sem processo correspondente — vincule manualmente.'); }), 'Gravada como histórico')}
                title="Marcar como tratada (gravar histórico)" className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><Check className="h-4 w-4" /></button>
            )}
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoreVertical className="h-4 w-4" /></button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {!p.caseId && <button onClick={() => { setMenu(false); setLinking(true); setOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"><Link2 className="h-4 w-4 text-zinc-400" /> Vincular a processo</button>}
                    {dias ? <button onClick={() => { setMenu(false); act(() => djenService.addPrazo(p.id), 'Prazo adicionado'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"><CalendarPlus className="h-4 w-4 text-zinc-400" /> Adicionar prazo de {dias} dias</button> : null}
                    {p.status !== 'DISMISSED' && <button onClick={() => { setMenu(false); act(() => djenService.dismiss(p.id), 'Descartada'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-4 w-4" /> Descartar</button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-zinc-100 dark:border-zinc-800/70">
          <td colSpan={8} className="bg-zinc-50/60 px-12 py-4 dark:bg-zinc-800/30">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{p.rawContent}</p>
            {dias ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-zinc-500">Tratamentos sugeridos:</span>
                <button onClick={() => act(() => djenService.addPrazo(p.id), 'Prazo adicionado')}
                  className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-3 py-1.5 font-medium text-white hover:bg-[#1971c2]">
                  <CalendarPlus className="h-3.5 w-3.5" /> Adicionar prazo de {dias} dias
                </button>
                {cls?.label && <span className="text-zinc-400">· {cls.label}</span>}
              </div>
            ) : null}
            {linking && <LinkToCase publicationId={p.id} onDone={() => { setLinking(false); onChange(); }} />}
          </td>
        </tr>
      )}
    </>
  );
}

function LinkToCase({ publicationId, onDone }: { publicationId: string; onDone: () => void }) {
  const [caseId, setCaseId] = useState('');
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  const link = async () => {
    if (!caseId) return;
    try { await djenService.link(publicationId, caseId); toast.success('Vinculada (andamento criado)'); onDone(); }
    catch (err: any) { toast.error(err?.message || 'Erro ao vincular'); }
  };
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-white p-2 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <option value="">Selecione o processo…</option>
        {cases.map((c) => <option key={c.id} value={c.id}>{c.title} {c.cnjNumber ? `(${c.cnjNumber})` : ''}</option>)}
      </select>
      <button onClick={link} disabled={!caseId} className="rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Vincular</button>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────
function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return <button title={title} className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{children}</button>;
}

function Dropdown({ label, active, children, variant = 'outline', disabled = false }: { label: string; active: boolean; children: (close: () => void) => React.ReactNode; variant?: 'outline' | 'solid'; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const base = variant === 'solid'
    ? 'text-white shadow-sm'
    : `border bg-white dark:bg-zinc-900 ${active ? 'border-[#228BE6] text-[#228BE6]' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'}`;
  return (
    <div className="relative">
      <button onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}
        className={`flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${base} disabled:opacity-40`}
        style={variant === 'solid' ? { backgroundColor: ASTREA_BLUE } : undefined}>
        {label} <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, active, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${danger ? 'text-rose-600' : ''}`}>
      {children} {active && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
    </button>
  );
}
