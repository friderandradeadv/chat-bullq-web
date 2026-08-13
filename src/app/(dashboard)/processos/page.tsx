'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  X,
  Star,
  Rss,
  Printer,
  FileDown,
  RefreshCw,
  Copy,
  Check,
  Tag,
  Pencil,
  Columns3,
  Trash2,
  UserCog,
  ChevronDown,
  Ban,
  CheckCircle2,
  PauseCircle,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type CaseListItem,
  type CaseStatus,
  type CreateCaseInput,
  type UserRef,
} from '@/features/legal-cases/services/legal-cases.service';
import { activitiesService } from '@/features/activities/services/activities.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { usePermissions } from '@/hooks/use-permissions';
import { properName, cleanAreaLabel, formatJuizo, processoNome } from '@/features/legal-cases/lib/format-name';

// ─── Estilo "cara do Astrea" (tema claro, azul Astrea) ───────────────
// Componentes próprios; replica o look (não os ativos da Aurum).
export const ASTREA_BLUE = '#228BE6';

const STATUS_LABEL: Record<CaseStatus, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};
// "Baixado" = processo encerrado/arquivado (baixa no geral). Unifica CLOSED+ARCHIVED
// no rótulo da lista e no filtro, pra a busca mostrar baixado em vez de ativo.
const isBaixado = (s: CaseStatus) => s === 'CLOSED' || s === 'ARCHIVED';
const rowStatusLabel = (s: CaseStatus) => (isBaixado(s) ? 'Baixado' : STATUS_LABEL[s]);

// Etiquetas no estilo Astrea: chip de fundo SÓLIDO na cor da categoria.
// Cores conhecidas (capturadas do Astrea); demais caem num fallback determinístico.
const ASTREA_TAG_COLORS: Record<string, string> = {
  bancario: '#999999',
  cs: '#000000',
  'frider andrade | advogados': '#FF0000',
  'frider andrade': '#FF0000',
  'rmc/rcc': '#9B0000',
  'seguros-rmc/rcc': '#9B0000',
  'fa&f - parceria': '#316666',
  criminal: '#FCC530',
  consumidor: '#228BE6',
  contribuicoes: '#02883C',
  civel: '#7048E8',
  familia: '#E64980',
  previdenciario: '#1098AD',
  trabalhista: '#F76707',
  'tarifas/seguros': '#5C940D',
  'dativo - janine': '#868E96',
  rodrigo: '#4263EB',
  matheus: '#0CA678',
};
const TAG_FALLBACK = ['#495057', '#1971C2', '#2F9E44', '#E8590C', '#6741D9', '#C2255C', '#0C8599', '#A61E4D'];

const normTag = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function tagBg(label: string): string {
  const hit = ASTREA_TAG_COLORS[normTag(label)];
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_FALLBACK[h % TAG_FALLBACK.length];
}

// Texto claro/escuro conforme luminância do fundo (contraste legível).
export function tagText(bg: string): string {
  const c = bg.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#202124' : '#FFFFFF';
}

// Chip de etiqueta reutilizável (lista + ficha).
export function TagChip({ label }: { label: string }) {
  const bg = tagBg(label);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight"
      style={{ backgroundColor: bg, color: tagText(bg) }}
    >
      {label}
    </span>
  );
}

// Etiqueta gerenciável (EntityTag) com ✕ pra remover. Usa a cor real da etiqueta.
export function LegalTagChip({ label, color, onRemove }: { label: string; color: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight"
      style={{ backgroundColor: color, color: tagText(color) }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          title="Remover etiqueta"
          className="hover:opacity-70"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// Número CNJ copiável: clique copia pro clipboard. Reusado na lista e na ficha.
export function CnjNumber({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Número copiado');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar número do processo"
      className={`group/cnj inline-flex items-center gap-1 font-light text-[#495057] underline decoration-zinc-400 underline-offset-2 dark:text-zinc-300 ${className}`.trim()}
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/cnj:opacity-100" />
      )}
    </button>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Grau do processo (1º/2º) a partir da instância detectada (DJEN) ou do Astrea. */
function grauOf(c: CaseListItem): '1' | '2' | null {
  const a = c.metadata?.astrea;
  const v = a?.instanciaAtual ?? a?.raw?.['Instância Atual'] ?? '';
  const d = String(v).match(/\d/)?.[0];
  return d === '1' ? '1' : d === '2' ? '2' : null;
}

export default function ProcessosPage() {
  const qc = useQueryClient();
  const { canDeleteCases } = usePermissions();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'ativos' | 'baixados' | 'todos'>('ativos');
  const [grauFilter, setGrauFilter] = useState<'' | '1' | '2'>('');
  const [creating, setCreating] = useState(false);
  // Pré-preenchimento do cadastro (ex.: veio da notificação "processo fora do hub").
  const [createInitial, setCreateInitial] = useState<{ cnjNumber?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50); // 0 = todos
  const [page, setPage] = useState(1);

  const { data: cases = [], isLoading } = useQuery({
    // hasCnj:true → a aba "Processos e casos" mostra só processos ajuizados (com CNJ).
    // Leads/pré-judiciais (contrato assinado, intake) ficam só no kanban pré-processual.
    queryKey: ['legal-cases', { search, judicial: true }],
    queryFn: () =>
      legalCasesService.list({
        search: search || undefined,
        hasCnj: true,
      }),
  });
  // Filtros client-side (status/etiqueta/grau) sobre o resultado já carregado.
  // Ao buscar, varre TODOS os status (o processo aparece mesmo baixado, com o
  // rótulo "Baixado"); sem busca, respeita a aba Ativos/Baixados/Todos.
  const filtered = cases
    .filter((c) => (search || view === 'todos' ? true : view === 'baixados' ? isBaixado(c.status) : !isBaixado(c.status)))
    .filter((c) => (tagFilter ? c.legalTags.some((lt) => lt.tagId === tagFilter) : true))
    .filter((c) => (grauFilter ? grauOf(c) === grauFilter : true));

  // Paginação client-side (pageSize=0 → todos).
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const curPage = Math.min(page, pageCount);
  const paginated = pageSize > 0 ? filtered.slice((curPage - 1) * pageSize, curPage * pageSize) : filtered;
  // Reseta a página quando os filtros mudam o tamanho da lista.
  useEffect(() => { setPage(1); }, [search, view, grauFilter, tagFilter, pageSize]);

  // Notificação "🕳️ processo FORA do hub" abre aqui com ?cadastrarCnj=<cnj>:
  // abre o cadastro já com o nº CNJ preenchido (e a opção de apensar ao principal)
  // e limpa a URL pra não reabrir num refresh/navegação.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cnj = params.get('cadastrarCnj');
    if (!cnj) return;
    setCreateInitial({ cnjNumber: cnj });
    setCreating(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('cadastrarCnj');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      if (paginated.every((c) => s.has(c.id))) { const n = new Set(s); paginated.forEach((c) => n.delete(c.id)); return n; }
      return new Set([...s, ...paginated.map((c) => c.id)]);
    });

  // Membros (para "mudar responsável" — exclui perfis não-atribuíveis: admin, login duplicado).
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  const assignableMembers = members.filter((m) => m.user.isActive && m.assignable !== false);
  // Etiquetas jurídicas disponíveis (para aplicar/remover em massa).
  const { data: availTags = [] } = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });

  const reload = () => qc.invalidateQueries({ queryKey: ['legal-cases'] });
  const bulk = useMutation({
    mutationFn: (p: { ids: string[]; action: 'delete' | 'status' | 'responsible'; status?: CaseStatus; responsibleId?: string }) =>
      legalCasesService.bulk(p),
    onSuccess: (r) => {
      toast.success(`${r.count} processo(s) atualizado(s).`);
      setSelected(new Set());
      reload();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao aplicar a ação'),
  });
  const runBulk = (action: 'delete' | 'status' | 'responsible', extra?: { status?: CaseStatus; responsibleId?: string }) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Arquivar ${ids.length} processo(s)? Eles vão para a lixeira (status Arquivado) e podem ser recuperados.`)) return;
    bulk.mutate({ ids, action, ...extra });
  };
  // Atualização otimista dos chips: mexe direto no cache das listas ['legal-cases']
  // pros processos selecionados, p/ o chip aparecer/sumir na hora (a lista é pesada;
  // o refetch reconcilia o id real do vínculo depois).
  const optimisticTag = (tagId: string, mode: 'add' | 'remove') => {
    const tag = availTags.find((t) => t.id === tagId);
    qc.setQueriesData<CaseListItem[]>({ queryKey: ['legal-cases'] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.map((c) => {
        if (!selected.has(c.id)) return c;
        if (mode === 'add') {
          if (!tag || c.legalTags.some((l) => l.tagId === tagId)) return c;
          return { ...c, legalTags: [...c.legalTags, { id: `tmp-${tagId}`, tagId, tag }] };
        }
        return { ...c, legalTags: c.legalTags.filter((l) => l.tagId !== tagId) };
      });
    });
  };
  // Etiquetas em massa: usa o vínculo já carregado (c.legalTags) p/ não duplicar (add) e p/ achar o EntityTag (remove).
  const bulkTag = useMutation({
    mutationFn: async ({ tagId, mode }: { tagId: string; mode: 'add' | 'remove' }) => {
      const cs = cases.filter((c) => selected.has(c.id));
      await Promise.all(
        cs.map(async (c) => {
          const existing = c.legalTags.find((l) => l.tagId === tagId);
          if (mode === 'add') { if (!existing) await activitiesService.attachTag('case', c.id, tagId); }
          else { if (existing) await activitiesService.detachTag(existing.id); }
        }),
      );
    },
    onMutate: (v) => optimisticTag(v.tagId, v.mode),
    onSuccess: (_d, v) => { toast.success(v.mode === 'add' ? 'Etiqueta adicionada.' : 'Etiqueta removida.'); reload(); },
    onError: (e: any) => { toast.error(e?.response?.data?.message || e?.message || 'Erro'); reload(); },
  });

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-1 lg:px-8">
        <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><Scale className="h-4 w-4" style={{ color: ASTREA_BLUE }} /> Processos e casos</h1>
        <div className="flex items-center gap-2">
          <IconBtn title="Imprimir">
            <Printer className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Exportar">
            <FileDown className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Atualizar" onClick={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })}>
            <RefreshCw className="h-4 w-4" />
          </IconBtn>
          <button
            onClick={() => { setCreateInitial(null); setCreating(true); }}
            title="Novo processo"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm"
            style={{ backgroundColor: ASTREA_BLUE }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-5 lg:px-8">
        <div className="relative w-full max-w-2xl flex-1 basis-full lg:basis-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite algo para pesquisar"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-4 pr-10 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
        <TagFilterBtn value={tagFilter} onChange={setTagFilter} />
        <select
          value={grauFilter}
          onChange={(e) => setGrauFilter(e.target.value as '' | '1' | '2')}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium uppercase tracking-wide text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          title="Filtrar por grau"
        >
          <option value="">Todos os graus</option>
          <option value="1">1º grau</option>
          <option value="2">2º grau</option>
        </select>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as 'ativos' | 'baixados' | 'todos')}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium uppercase tracking-wide text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          title="Ativos = em andamento · Baixados = encerrados/arquivados"
        >
          <option value="ativos">Ativos</option>
          <option value="baixados">Baixados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="flex items-center gap-3 px-4 pt-3 text-sm lg:px-8">
        {canDeleteCases && selected.size > 0 ? (
          <BulkBar
            count={selected.size}
            members={assignableMembers}
            tags={availTags}
            busy={bulk.isPending || bulkTag.isPending}
            onResp={(id) => runBulk('responsible', { responsibleId: id })}
            onStatus={(s) => runBulk('status', { status: s })}
            onTag={(tagId, mode) => bulkTag.mutate({ tagId, mode })}
            onDelete={() => runBulk('delete')}
            onClear={() => setSelected(new Set())}
          />
        ) : (
          <div className="flex w-full items-center justify-between">
            <span className="text-zinc-500">{filtered.length} processo(s) e caso(s)</span>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Exibir
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 rounded-md border border-zinc-200 bg-white px-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={0}>Todos</option>
              </select>
              por página
            </label>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-2 px-4 pb-6 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                {canDeleteCases && <th className="w-10 px-3 py-4"><input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#228BE6]" title="Selecionar todos" /></th>}
                <th className="px-3 py-4">Título</th>
                <th className="px-3 py-4">Cliente / Pasta</th>
                <th className="px-3 py-4">Ação / Foro</th>
                <th className="px-3 py-4">Responsável</th>
                <th className="px-3 py-4 whitespace-nowrap">Últ. mov.</th>
                <th className="w-20 px-2 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Nenhum processo encontrado
                  </td>
                </tr>
              )}
              {paginated.map((c) => (
                <CaseRow key={c.id} c={c} members={assignableMembers} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} onChange={reload} />
              ))}
            </tbody>
          </table>
          </div>
          {pageSize > 0 && pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-[#DEE2E6] px-4 py-3 text-sm dark:border-zinc-800">
              <span className="text-zinc-500">
                {(curPage - 1) * pageSize + 1}–{Math.min(curPage * pageSize, filtered.length)} de {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={curPage <= 1}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >Anterior</button>
                <span className="px-2 text-zinc-500">Página {curPage} de {pageCount}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={curPage >= pageCount}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >Próxima</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateCaseDialog
          initial={createInitial ?? undefined}
          onClose={() => { setCreating(false); setCreateInitial(null); }}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['legal-cases'] });
            setCreating(false);
            setCreateInitial(null);
          }}
        />
      )}
    </div>
  );
}

function CaseRow({ c, members, selected, onToggle, onChange }: { c: CaseListItem; members: Member[]; selected: boolean; onToggle: () => void; onChange: () => void }) {
  const { canDeleteCases } = usePermissions();
  const client = c.parties.find((p) => p.role === 'CLIENT') ?? c.parties[0];
  const opponent = c.parties.find((p) => p.role === 'OPPONENT');
  // Nome do processo no padrão do escritório: "Autor × Réu" (Title Case), com
  // fallback no título gravado. Corrige o CAPS e o "só o nome do cliente" do intake.
  const nomeProcesso = processoNome(client?.name, opponent?.name, c.title);
  // Barrinha verde = monitorado via DJEN (tem nº CNJ → o monitor por OAB captura as publicações).
  const monitorado = !!c.cnjNumber;
  const removeTag = async (etId: string) => {
    try { await activitiesService.detachTag(etId); onChange(); } catch (e: any) { toast.error(e?.message || 'Erro'); }
  };
  return (
    <tr className={`group border-b border-zinc-100 last:border-0 hover:bg-[#f0f7fd] dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 ${selected ? 'bg-[#e7f1fb] dark:bg-zinc-800/60' : ''}`}>
      {canDeleteCases && (
        <td className="w-10 px-3 py-4 align-top">
          <input type="checkbox" checked={selected} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-[#228BE6]" />
        </td>
      )}
      <td className="px-3 py-4 align-top">
        <div className="flex items-start gap-2">
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <Star className="h-4 w-4 text-zinc-300 group-hover:text-amber-400" />
            <span
              title={monitorado ? 'Conectado ao tribunal — captando publicações via DJEN' : 'Sem número CNJ — não conectado ao tribunal'}
              className="cursor-default"
            >
              <Rss className={`h-4 w-4 ${monitorado ? 'text-emerald-500' : 'text-zinc-300'}`} />
            </span>
          </div>
          <div className="min-w-0">
            <Link
              href={`/processos/${c.id}`}
              className="text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:text-[#228BE6] hover:underline"
            >
              {nomeProcesso}
            </Link>
            <p className="mt-0.5 text-xs text-zinc-400">
              Processo {rowStatusLabel(c.status).toLowerCase()}
              {c.cnjNumber ? (
                <>
                  {' · '}
                  <CnjNumber value={c.cnjNumber} />
                </>
              ) : null}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {c.legalTags.map((lt) => (
                <LegalTagChip key={lt.id} label={lt.tag.name} color={lt.tag.color} onRemove={() => removeTag(lt.id)} />
              ))}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 align-top text-sm">
        {client ? (
          <Link href={`/clientes/${client.id}`} className="text-zinc-600 hover:text-[#228BE6] hover:underline dark:text-zinc-300">
            {properName(client.name)}
          </Link>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className="px-3 py-4 align-top">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{cleanAreaLabel(c.area) || '—'}</p>
        {c.court && <p className="text-xs text-zinc-400">{formatJuizo(c.court)}</p>}
      </td>
      <td className="px-3 py-4 align-top">
        <RespCell caseId={c.id} current={c.responsible} members={members} onChange={onChange} />
      </td>
      <td className="px-3 py-4 align-top whitespace-nowrap text-sm text-zinc-500">
        {fmtDate(c.updatedAt)}
      </td>
      <td className="w-20 px-2 py-4 align-top">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <CaseTagButton caseId={c.id} attached={c.legalTags} onChange={onChange} />
          <Link
            href={`/juridico/kanban?case=${c.id}`}
            title="Abrir o card no Kanban"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-[#228BE6] dark:hover:bg-zinc-700"
          >
            <Columns3 className="h-4 w-4" />
          </Link>
          <Link
            href={`/processos/${c.id}`}
            title="Abrir / editar processo"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-600 dark:hover:bg-zinc-700"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// Botão de etiquetas no card (hover): adiciona/remove etiquetas do processo direto na lista.
// ─── Barra de ações em massa (aparece ao selecionar processos) ────────────
function BulkBar({ count, members, tags, busy, onResp, onStatus, onTag, onDelete, onClear }: {
  count: number;
  members: Member[];
  tags: { id: string; name: string; color: string }[];
  busy: boolean;
  onResp: (userId: string) => void;
  onStatus: (s: CaseStatus) => void;
  onTag: (tagId: string, mode: 'add' | 'remove') => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-[#228BE6]">{count} selecionado(s)</span>
      <span className="text-zinc-300 dark:text-zinc-600">·</span>

      <BulkMenu label="Responsável" icon={<UserCog className="h-4 w-4" />} disabled={busy}>
        {(close) => (
          <>
            <BulkMenuItem onClick={() => { onResp(''); close(); }}>
              <span className="text-zinc-500">Sem responsável</span>
            </BulkMenuItem>
            {members.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">Nenhum membro.</div>}
            {members.map((m) => (
              <BulkMenuItem key={m.userId} onClick={() => { onResp(m.userId); close(); }}>{m.user.name}</BulkMenuItem>
            ))}
          </>
        )}
      </BulkMenu>

      <BulkMenu label="Status" icon={<CheckCircle2 className="h-4 w-4" />} disabled={busy}>
        {(close) => (
          <>
            <BulkMenuItem onClick={() => { onStatus('ACTIVE'); close(); }}>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ativo
            </BulkMenuItem>
            <BulkMenuItem onClick={() => { onStatus('SUSPENDED'); close(); }}>
              <PauseCircle className="h-4 w-4 text-amber-500" /> Suspenso
            </BulkMenuItem>
            <BulkMenuItem onClick={() => { onStatus('CLOSED'); close(); }}>
              <Ban className="h-4 w-4 text-zinc-500" /> Encerrado
            </BulkMenuItem>
          </>
        )}
      </BulkMenu>

      <BulkMenu label="Etiquetas" icon={<Tag className="h-4 w-4" />} disabled={busy}>
        {(close) => (
          <>
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Adicionar a todos</p>
            {tags.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</div>}
            {tags.map((t) => (
              <BulkMenuItem key={`add-${t.id}`} onClick={() => { onTag(t.id, 'add'); close(); }}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><Plus className="h-3 w-3" />{t.name}</span>
              </BulkMenuItem>
            ))}
            {tags.length > 0 && (
              <>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Remover de todos</p>
                {tags.map((t) => (
                  <BulkMenuItem key={`rm-${t.id}`} onClick={() => { onTag(t.id, 'remove'); close(); }}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><X className="h-3 w-3" />{t.name}</span>
                  </BulkMenuItem>
                ))}
              </>
            )}
          </>
        )}
      </BulkMenu>

      <button
        onClick={onDelete}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" /> Arquivar
      </button>

      <button onClick={onClear} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Limpar seleção</button>
    </div>
  );
}

function BulkMenu({ label, icon, disabled, children }: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-600 hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
      >
        {icon}{label}<ChevronDown className="h-4 w-4 opacity-60" />
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

function BulkMenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">
      {children}
    </button>
  );
}

// ─── Responsável editável inline na lista ─────────────────────────────────
function RespCell({ caseId, current, members, onChange }: {
  caseId: string;
  current: UserRef | null;
  members: Member[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = useMutation({
    mutationFn: (userId: string) => legalCasesService.update(caseId, { responsibleId: userId || undefined }),
    onSuccess: () => { setOpen(false); onChange(); toast.success('Responsável atualizado.'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro'),
  });
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[160px] items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <span className="truncate">{current?.name ?? <span className="text-zinc-400">Atribuir</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button onClick={() => set.mutate('')} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Sem responsável {!current && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
            </button>
            {members.map((m) => (
              <button key={m.userId} onClick={() => set.mutate(m.userId)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <span className="truncate">{m.user.name}</span>
                {current?.id === m.userId && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CaseTagButton({ caseId, attached, onChange }: { caseId: string; attached: { tagId: string }[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: tags = [] } = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const attachedIds = new Set(attached.map((a) => a.tagId));
  const toggle = async (tagId: string) => {
    setBusy(true);
    try {
      if (attachedIds.has(tagId)) {
        // acha o vínculo dessa tag pra remover
        const list = await activitiesService.listTags('case', caseId);
        const et = list.find((x) => x.tagId === tagId);
        if (et) await activitiesService.detachTag(et.id);
      } else {
        await activitiesService.attachTag('case', caseId, tagId);
      }
      onChange();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(false); }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Etiquetas" className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-[#228BE6] dark:hover:bg-zinc-700">
        <Tag className="h-4 w-4" />
      </button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-9 z-20 max-h-72 w-60 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Etiquetas</p>
          {tags.map((t) => {
            const on = attachedIds.has(t.id);
            return (
              <button key={t.id} disabled={busy} onClick={() => toggle(t.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{t.name}</span>
                {on && <Check className="h-4 w-4 shrink-0 text-[#228BE6]" />}
              </button>
            );
          })}
          {tags.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</p>}
        </div></>)}
    </div>
  );
}

// Filtro por etiqueta (ícone no topo, igual Astrea) — lista as etiquetas jurídicas.
function TagFilterBtn({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const { data: tags = [] } = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });
  const active = tags.find((t) => t.id === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Filtrar por etiqueta"
        className={`flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm hover:bg-zinc-50 dark:bg-zinc-900 ${value ? 'border-[#228BE6] text-[#228BE6]' : 'border-zinc-300 text-zinc-500'}`}
      >
        <Tag className="h-4 w-4" />
        {active && <span className="font-medium">{active.name}</span>}
      </button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-11 z-20 max-h-72 w-60 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={() => { onChange(null); setOpen(false); }} className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${!value ? 'font-semibold text-[#228BE6]' : 'text-zinc-700 dark:text-zinc-300'}`}>
            Todas as etiquetas
          </button>
          {tags.map((t) => (
            <button key={t.id} onClick={() => { onChange(t.id); setOpen(false); }} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${value === t.id ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />{t.name}
            </button>
          ))}
        </div></>)}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {children}
    </button>
  );
}

function CreateCaseDialog({
  initial,
  onClose,
  onCreated,
}: {
  /** Pré-preenchimento (ex.: veio da notificação "processo fora do hub" com o nº CNJ). */
  initial?: { cnjNumber?: string; title?: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateCaseInput>({ title: initial?.title ?? '', cnjNumber: initial?.cnjNumber });
  const [clientName, setClientName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: allTags = [] } = useQuery({ queryKey: ['tags-available'], queryFn: () => activitiesService.listAvailableTags() });

  // Apensar ao principal já na criação (mesma busca do modal de apensamento da ficha).
  const [apensarSearch, setApensarSearch] = useState('');
  const [principal, setPrincipal] = useState<{ id: string; title: string; cnjNumber: string | null } | null>(null);
  const { data: apensarResults = [], isFetching: apensarBusy } = useQuery({
    queryKey: ['create-apensar-search', apensarSearch],
    queryFn: () => legalCasesService.list({ search: apensarSearch }),
    enabled: apensarSearch.trim().length >= 2 && !principal,
  });

  const toggleTag = (id: string) => setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Informe o título do processo');
      return;
    }
    setSaving(true);
    try {
      const parties = [
        ...(clientName.trim() ? [{ name: clientName.trim(), role: 'CLIENT' as const }] : []),
        ...(opponentName.trim() ? [{ name: opponentName.trim(), role: 'OPPONENT' as const }] : []),
      ];
      const created = await legalCasesService.create({
        ...form,
        parties: parties.length ? parties : undefined,
      });
      // Anexa as etiquetas escolhidas ao processo recém-criado (best-effort).
      if (tagIds.length && created?.id) {
        await Promise.allSettled(tagIds.map((tid) => activitiesService.attachTag('case', created.id, tid)));
      }
      // Apensa ao principal escolhido — o backend herda partes/área/responsável/etiquetas.
      if (principal && created?.id) {
        try {
          await legalCasesService.apensar(created.id, principal.id);
          toast.success(`Processo criado e apensado a ${principal.cnjNumber || principal.title}`);
        } catch (e: any) {
          toast.error(`Processo criado, mas falhou ao apensar: ${e?.response?.data?.message || e?.message || 'erro'}`);
        }
      } else {
        toast.success('Processo criado');
      }
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar processo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 text-zinc-800 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-700">Novo processo</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Título *">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="Ex.: Cliente x Banco — Cumprimento de sentença"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nº CNJ">
              <input
                value={form.cnjNumber ?? ''}
                onChange={(e) => setForm({ ...form, cnjNumber: e.target.value })}
                className={inputCls}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </Field>
            <Field label="Código interno">
              <input
                value={form.internalCode ?? ''}
                onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ação / Área">
              <input
                value={form.area ?? ''}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className={inputCls}
                placeholder="cível, trabalhista, RMC…"
              />
            </Field>
            <Field label="Vara / Foro">
              <input
                value={form.court ?? ''}
                onChange={(e) => setForm({ ...form, court: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente (autor)">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={inputCls}
                placeholder="Nome do cliente"
              />
            </Field>
            <Field label="Parte adversa (réu)">
              <input
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className={inputCls}
                placeholder="Ex.: Banco BMG S/A"
              />
            </Field>
          </div>
          <Field label="Etiquetas">
            {allTags.length === 0 ? (
              <p className="text-xs text-zinc-400">Nenhuma etiqueta cadastrada.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-transparent text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                      style={on ? { backgroundColor: t.color } : undefined}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: on ? 'rgba(255,255,255,.85)' : t.color }} />
                      {t.name}
                      {on && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label="Apensar ao processo principal (opcional)">
            {principal ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-[#228BE6] bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{principal.title}</span>
                  {principal.cnjNumber && <span className="text-xs text-zinc-400">{principal.cnjNumber}</span>}
                </span>
                <button type="button" onClick={() => { setPrincipal(null); setApensarSearch(''); }} className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Trocar</button>
              </div>
            ) : (
              <>
                <input
                  value={apensarSearch}
                  onChange={(e) => setApensarSearch(e.target.value)}
                  className={inputCls}
                  placeholder="Buscar o principal por título, nº CNJ ou código…"
                />
                {apensarSearch.trim().length >= 2 && (
                  <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                    {apensarBusy ? (
                      <p className="px-1 py-1.5 text-xs text-zinc-400">Buscando…</p>
                    ) : apensarResults.length === 0 ? (
                      <p className="px-1 py-1.5 text-xs text-zinc-400">Nenhum processo encontrado.</p>
                    ) : (
                      apensarResults.slice(0, 8).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setPrincipal({ id: r.id, title: r.title, cnjNumber: r.cnjNumber })}
                          className="w-full rounded-md border border-transparent px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.title}</span>
                          <span className="text-xs text-zinc-400">{r.cnjNumber || 'sem nº CNJ'}{r.area ? ` · ${r.area}` : ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-zinc-400">Ao apensar, o cliente, a parte adversa, a área e as etiquetas são herdados do principal.</p>
              </>
            )}
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: ASTREA_BLUE }}
          >
            {saving ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reaproveitados pelas outras telas jurídicas (estilo claro Astrea).
export const inputCls =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
