'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type CaseListItem,
  type CaseStatus,
  type CreateCaseInput,
} from '@/features/legal-cases/services/legal-cases.service';
import { activitiesService } from '@/features/activities/services/activities.service';

// ─── Estilo "cara do Astrea" (tema claro, azul Astrea) ───────────────
// Componentes próprios; replica o look (não os ativos da Aurum).
export const ASTREA_BLUE = '#228BE6';

const STATUS_LABEL: Record<CaseStatus, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [grauFilter, setGrauFilter] = useState<'' | '1' | '2'>('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50); // 0 = todos
  const [page, setPage] = useState(1);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['legal-cases', { search, status: statusFilter }],
    queryFn: () =>
      legalCasesService.list({
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  // Filtros client-side (etiqueta + grau) sobre o resultado já carregado.
  const filtered = cases
    .filter((c) => (tagFilter ? c.legalTags.some((lt) => lt.tagId === tagFilter) : true))
    .filter((c) => (grauFilter ? grauOf(c) === grauFilter : true));

  // Paginação client-side (pageSize=0 → todos).
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const curPage = Math.min(page, pageCount);
  const paginated = pageSize > 0 ? filtered.slice((curPage - 1) * pageSize, curPage * pageSize) : filtered;
  // Reseta a página quando os filtros mudam o tamanho da lista.
  useEffect(() => { setPage(1); }, [search, statusFilter, grauFilter, tagFilter, pageSize]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      if (paginated.every((c) => s.has(c.id))) { const n = new Set(s); paginated.forEach((c) => n.delete(c.id)); return n; }
      return new Set([...s, ...paginated.map((c) => c.id)]);
    });

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pb-1 pt-9">
        <h1 className="text-2xl font-normal text-zinc-700 dark:text-zinc-100">Processos e casos</h1>
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
            onClick={() => setCreating(true)}
            title="Novo processo"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm"
            style={{ backgroundColor: ASTREA_BLUE }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-8 pt-5">
        <div className="relative max-w-2xl flex-1">
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium uppercase tracking-wide text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="">Ativos</option>
          {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 px-8 pt-3 text-sm">
        {selected.size > 0 ? (
          <>
            <span className="font-medium text-[#228BE6]">{selected.size} selecionado(s)</span>
            <button onClick={() => setSelected(new Set())} className="text-zinc-500 hover:text-zinc-700">Limpar seleção</button>
          </>
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
      <div className="mt-2 flex-1 overflow-y-auto px-8 pb-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-bold uppercase tracking-wide text-[#6C757D] dark:border-zinc-800">
                <th className="w-10 px-3 py-4"><input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#228BE6]" title="Selecionar todos" /></th>
                <th className="px-3 py-4">Título</th>
                <th className="px-3 py-4">Cliente / Pasta</th>
                <th className="px-3 py-4">Ação / Foro</th>
                <th className="px-3 py-4 whitespace-nowrap">Últ. mov.</th>
                <th className="w-20 px-2 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Nenhum processo encontrado
                  </td>
                </tr>
              )}
              {paginated.map((c) => (
                <CaseRow key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} onChange={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })} />
              ))}
            </tbody>
          </table>
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
          onClose={() => setCreating(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['legal-cases'] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CaseRow({ c, selected, onToggle, onChange }: { c: CaseListItem; selected: boolean; onToggle: () => void; onChange: () => void }) {
  const client = c.parties[0];
  // Barrinha verde = monitorado via DJEN (tem nº CNJ → o monitor por OAB captura as publicações).
  const monitorado = !!c.cnjNumber;
  const removeTag = async (etId: string) => {
    try { await activitiesService.detachTag(etId); onChange(); } catch (e: any) { toast.error(e?.message || 'Erro'); }
  };
  return (
    <tr className={`group border-b border-zinc-100 last:border-0 hover:bg-[#f0f7fd] dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 ${selected ? 'bg-[#e7f1fb] dark:bg-zinc-800/60' : ''}`}>
      <td className="w-10 px-3 py-4 align-top">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-[#228BE6]" />
      </td>
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
              {c.title}
            </Link>
            <p className="mt-0.5 text-xs text-zinc-400">
              Processo {STATUS_LABEL[c.status].toLowerCase()}
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
            {client.name}
          </Link>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className="px-3 py-4 align-top">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{c.area ?? '—'}</p>
        {c.court && <p className="text-xs text-zinc-400">{c.court}</p>}
      </td>
      <td className="px-3 py-4 align-top whitespace-nowrap text-sm text-zinc-500">
        {fmtDate(c.updatedAt)}
      </td>
      <td className="w-20 px-2 py-4 align-top">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <CaseTagButton caseId={c.id} attached={c.legalTags} onChange={onChange} />
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
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateCaseInput>({ title: '' });
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Informe o título do processo');
      return;
    }
    setSaving(true);
    try {
      await legalCasesService.create({
        ...form,
        parties: clientName.trim()
          ? [{ name: clientName.trim(), role: 'CLIENT' }]
          : undefined,
      });
      toast.success('Processo criado');
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <Field label="Cliente (parte)">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={inputCls}
              placeholder="Nome do cliente"
            />
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
