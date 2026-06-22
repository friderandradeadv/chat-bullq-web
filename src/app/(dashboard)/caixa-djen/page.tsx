'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  RefreshCw, Search, ChevronDown, X, Check, MoreVertical, FileText,
  Link2, CalendarPlus, Trash2, Newspaper, Printer, FileDown, ThumbsDown, ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  djenService, type Publication, type PublicationGroup, type PublicationsStats, type PublicationPeriod,
} from '@/features/djen/services/djen.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CnjNumber, ASTREA_BLUE } from '../processos/page';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MT','MS','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO','SUPERIORES'];

const GROUP_LABEL: Record<PublicationGroup, string> = {
  nao_tratada: 'Não tratada', tratada: 'Tratada', descartada: 'Descartada', all: 'Todas',
};

const PERIODO_LABEL: Record<PublicationPeriod, string> = {
  hoje: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', all: 'Todo o período',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/** Status visual a partir do status do modelo (cores do Astrea). */
function statusBadge(p: Publication) {
  if (p.status === 'DISMISSED') return { label: 'DESCARTADA', cls: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' };
  if (p.status === 'LINKED') return { label: 'TRATADA', cls: 'bg-[#37b24d] text-white' };
  return { label: 'NÃO TRATADA', cls: 'bg-[#fcc530] text-black' };
}

export default function CaixaDjenPage() {
  const qc = useQueryClient();
  const [group, setGroup] = useState<PublicationGroup>('nao_tratada');
  const [q, setQ] = useState('');
  const [uf, setUf] = useState('');
  const [periodo, setPeriodo] = useState<PublicationPeriod>('all');
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['djen-stats'], queryFn: () => djenService.stats() });
  const { data: pubs = [], isLoading } = useQuery({
    queryKey: ['djen', { group, q, uf, periodo }],
    queryFn: () => djenService.list({ group, q: q || undefined, uf: uf || undefined, periodo }),
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
          <StatCard n={stats?.naoTratadosHoje ?? 0} label="Não tratadas de hoje" color="text-zinc-900 dark:text-zinc-100" />
          <Sep />
          <StatCard n={stats?.tratadosHoje ?? 0} label="Tratadas hoje" color="text-[#228BE6]" />
          <Sep />
          <StatCard n={stats?.descartadasHoje ?? 0} label="Descartadas hoje" color="text-[#e70202]" />
          <Sep />
          <StatCard n={stats?.naoTratadosTotal ?? 0} label="Não tratadas" color="text-[#fcc530]" />
          <StackedChart serie={stats?.serie ?? []} />
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

        <Dropdown label={periodo === 'all' ? 'Período' : PERIODO_LABEL[periodo]} active={periodo !== 'all'}>
          {(close) => (
            <>
              {(['hoje', '7d', '30d', 'all'] as PublicationPeriod[]).map((pp) => (
                <MenuItem key={pp} onClick={() => { setPeriodo(pp); close(); }} active={periodo === pp}>{PERIODO_LABEL[pp]}</MenuItem>
              ))}
            </>
          )}
        </Dropdown>

        {group !== 'all' && (
          <span className="inline-flex items-center gap-1.5 rounded bg-[#6c757d] px-2.5 py-1 text-xs font-medium text-white">
            STATUS: {GROUP_LABEL[group].toUpperCase()}
            <button onClick={() => setGroup('all')} className="opacity-80 hover:opacity-100"><X className="h-3 w-3" /></button>
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

      {/* banner de seleção total (estilo Astrea) */}
      {allOnPage && pubs.length > 0 && (
        <div className="mx-8 mt-2 rounded-md bg-[#228BE6]/10 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
          {`Todas as ${pubs.length} publicações desta página estão selecionadas.`}
        </div>
      )}

      {/* Tabela */}
      <div className="mt-2 flex-1 overflow-auto px-8 pb-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="w-10 px-3 py-3.5"><input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#228BE6]" /></th>
                <th className="px-3 py-3.5 whitespace-nowrap"><span className="inline-flex items-center gap-1">Divulgado em <ArrowDown className="h-3 w-3" /></span></th>
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

/** Mini-gráfico de barras empilhadas por status (8 dias) com tooltip — estilo Astrea. */
function StackedChart({ serie }: { serie: PublicationsStats['serie'] }) {
  const H = 48;
  const max = Math.max(1, ...serie.map((d) => d.tratadas + d.naoTratadas + d.descartadas));
  return (
    <div className="ml-auto hidden items-end gap-1.5 self-center sm:flex">
      {serie.map((d) => {
        const total = d.tratadas + d.naoTratadas + d.descartadas;
        const dow = new Date(d.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
        return (
          <div key={d.date} className="group/bar relative flex w-3.5 flex-col items-center justify-end">
            {total === 0 ? (
              <div className="h-1 w-full rounded-sm bg-zinc-200 dark:bg-zinc-700" />
            ) : (
              <div className="flex w-full flex-col overflow-hidden rounded-sm" style={{ height: `${Math.max(5, (total / max) * H)}px` }}>
                {d.tratadas > 0 && <div style={{ flex: d.tratadas, backgroundColor: '#228BE6' }} />}
                {d.naoTratadas > 0 && <div style={{ flex: d.naoTratadas, backgroundColor: '#fcc530' }} />}
                {d.descartadas > 0 && <div style={{ flex: d.descartadas, backgroundColor: '#e70202' }} />}
              </div>
            )}
            <span className="mt-1 text-[9px] uppercase text-zinc-400">{dow.charAt(0)}</span>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg group-hover/bar:block dark:border-zinc-700 dark:bg-zinc-900">
              <div className="font-semibold capitalize text-zinc-700 dark:text-zinc-200">{dow}</div>
              <div className="text-[#e70202]">Descartadas: {d.descartadas}</div>
              <div className="text-[#228BE6]">Tratadas: {d.tratadas}</div>
              <div className="text-[#b8860b]">Não tratadas: {d.naoTratadas}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PubRow({ p, selected, onToggle, forceOpen, onChange }: { p: Publication; selected: boolean; onToggle: () => void; forceOpen: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [linking, setLinking] = useState(false);
  const [prazoOpen, setPrazoOpen] = useState(false);
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
          {p.publicadoEm && <span className="mt-0.5 block text-[11px] text-zinc-400">Publicado em: {fmt(p.publicadoEm)}</span>}
        </td>
        <td className="px-3 py-3.5"><span title={cls?.tipoComunicacao ?? 'Publicação'} className="inline-flex"><FileText className="h-4 w-4" style={{ color: '#5159a2' }} /></span></td>
        <td className="px-3 py-3.5">
          {cnj && <span className="block whitespace-nowrap"><CnjNumber value={cnj} /></span>}
          {p.case ? (
            <Link href={`/processos/${p.case.id}`} className="mt-0.5 block text-sm font-medium text-[#228BE6] hover:underline">{p.case.title}</Link>
          ) : cnj ? (
            <span className="mt-0.5 block text-sm text-zinc-500">Processo não vinculado</span>
          ) : <span className="text-sm text-zinc-400">—</span>}
          {p.responsavel && <span className="mt-0.5 block text-[11px] text-zinc-400">Responsável: {p.responsavel}</span>}
        </td>
        <td className="px-3 py-3.5 text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{p.tribunal ?? '—'}</span>
          {p.orgaoJulgador && <span className="text-zinc-400"> | {p.orgaoJulgador}</span>}
        </td>
        <td className="px-3 py-3.5 text-xs">
          {p.nomePesquisado
            ? <span className="rounded-sm bg-[#fff881] px-1 py-0.5 font-medium text-zinc-800 dark:text-zinc-900">{p.nomePesquisado}</span>
            : <span className="text-zinc-400">{p.oab}</span>}
        </td>
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
                    {dias ? <button onClick={() => { setMenu(false); setPrazoOpen(true); setOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"><CalendarPlus className="h-4 w-4 text-zinc-400" /> Adicionar prazo de {dias} dias</button> : null}
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
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-zinc-500">Tratamentos sugeridos:</span>
                <button onClick={() => setPrazoOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#228BE6] px-3 py-1.5 font-semibold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10">
                  <CalendarPlus className="h-3.5 w-3.5" /> Adicionar prazo{dias ? ` de ${dias} dias` : ''}
                </button>
                <button title="Classificar sugestão como incorreta" onClick={() => act(() => djenService.dismiss(p.id), 'Sugestão descartada')}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                {typeof p.probabilidadePrazo === 'number' && (
                  <span className="text-zinc-500">{p.probabilidadePrazo}% de probabilidade de conter prazo</span>
                )}
              </div>
            ) : null}
            {linking && <LinkToCase publicationId={p.id} onDone={() => { setLinking(false); onChange(); }} />}
          </td>
        </tr>
      )}
      {prazoOpen && <PrazoDialog p={p} onClose={() => setPrazoOpen(false)} onDone={() => { setPrazoOpen(false); onChange(); }} />}
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

/** Dialog "Adicionar prazo": pré-preenche da publicação, usuário escolhe o
 *  processo e lança a tarefa+prazo (sem erro quando não há processo casado). */
function PrazoDialog({ p, onClose, onDone }: { p: Publication; onClose: () => void; onDone: () => void }) {
  const cls = p.classification;
  const norm = (s?: string | null) => (s ?? '').replace(/\D/g, '');
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }) });
  // Pré-seleciona o processo já vinculado ou o que casa pelo nº do feed.
  const matchByCnj = p.processoCnj ? cases.find((c) => c.cnjNumber && norm(c.cnjNumber) === norm(p.processoCnj))?.id : undefined;
  const [caseId, setCaseId] = useState(p.caseId ?? '');
  const [busy, setBusy] = useState(false);
  // pré-seleciona pelo nº do feed quando a lista de processos carrega
  useEffect(() => { if (!caseId && matchByCnj) setCaseId(matchByCnj); }, [matchByCnj]);

  const lancar = async () => {
    if (!caseId) { toast.error('Selecione o processo.'); return; }
    setBusy(true);
    try { await djenService.addPrazo(p.id, caseId); toast.success('Tarefa e prazo lançados'); onDone(); }
    catch (err: any) { toast.error(err?.message || 'Erro ao lançar'); }
    finally { setBusy(false); }
  };

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={onClose} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100">Lançar tarefa e prazo</h3>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-500">Processo *</span>
                <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">Selecione o processo…</option>
                  {cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.cnjNumber ? ` (${c.cnjNumber})` : ''}</option>)}
                </select>
                {p.processoCnj && !caseId && <span className="mt-1 block text-[11px] text-amber-600">Processo {p.processoCnj} não está cadastrado — escolha o correspondente ou cadastre antes.</span>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="block text-xs font-medium text-zinc-500">Prazo fatal</span><span className="font-medium text-rose-600">{cls?.prazoFatal ? new Date(cls.prazoFatal).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</span></div>
                <div><span className="block text-xs font-medium text-zinc-500">Agendar (segurança)</span><span>{cls?.prazoSeguranca ? new Date(cls.prazoSeguranca).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</span></div>
              </div>
              <div>
                <span className="block text-xs font-medium text-zinc-500">Recorte da publicação</span>
                <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-justify rounded-md bg-zinc-50 p-2 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">{p.rawContent}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
              <button onClick={lancar} disabled={busy || !caseId} className="rounded-md bg-[#228BE6] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Lançando…' : 'Lançar tarefa'}</button>
            </div>
          </div>
        </div>
      </td>
    </tr>
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
