'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Target, Eye, Heart, Users, Briefcase, BookOpen, ListChecks,
  Pencil, Plus, Trash2, Save, X, Loader2, User as UserIcon, ChevronDown,
} from 'lucide-react';
import { escritorioService, type Escritorio, type Cargo } from '@/features/escritorio/services/escritorio.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { useAuthStore } from '@/stores/auth-store';

const rid = () => `c_${Math.round(Math.random() * 1e9)}`;
const EMPTY: Escritorio = { cultura: { missao: '', visao: '', valores: [], cultura: '' }, cargos: [], pessoas: {}, manuais: [], onboarding: [], canEdit: false };

const CARD = 'rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';
const INPUT = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400';

export default function EscritorioPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data = EMPTY, isLoading } = useQuery({ queryKey: ['escritorio'], queryFn: () => escritorioService.get(), staleTime: 60_000 });
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Escritorio>(EMPTY);
  const [treeSig, setTreeSig] = useState({ n: 0, open: true });
  const saveM = useMutation({
    mutationFn: (d: Escritorio) => escritorioService.save(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escritorio'] }); toast.success('Escritório atualizado'); setEditing(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao salvar'),
  });

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(data))); setEditing(true); };
  const cur = editing ? draft : data;
  const set = (patch: Partial<Escritorio>) => setDraft((d) => ({ ...d, ...patch }));
  const setCultura = (patch: Partial<Escritorio['cultura']>) => setDraft((d) => ({ ...d, cultura: { ...d.cultura, ...patch } }));

  const cargoById = useMemo(() => Object.fromEntries((cur.cargos ?? []).map((c) => [c.id, c])), [cur.cargos]);
  const meuCargo = user?.id ? cargoById[cur.pessoas?.[user.id]?.cargoId ?? ''] : undefined;
  const meuBio = user?.id ? cur.pessoas?.[user.id]?.bio : undefined;

  // Organograma: pessoas agrupadas por cargo (+ "sem cargo")
  const grupos = useMemo(() => {
    const byCargo = new Map<string, Member[]>();
    for (const m of members) {
      const cid = cur.pessoas?.[m.user.id]?.cargoId ?? '__sem__';
      (byCargo.get(cid) ?? byCargo.set(cid, []).get(cid)!).push(m);
    }
    return byCargo;
  }, [members, cur.pessoas]);

  if (isLoading) return <div className="flex h-full items-center justify-center text-sm text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="h-full overflow-y-auto bg-[#fafafa] px-6 py-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#7048E8]" />
            <div>
              <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Escritório</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Organograma, cargos, cultura e manuais — para todo mundo saber exatamente o seu papel aqui.</p>
            </div>
          </div>
          {data.canEdit && (
            editing ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /> Cancelar</button>
                <button onClick={() => saveM.mutate(draft)} disabled={saveM.isPending} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>
              </div>
            ) : (
              <button onClick={startEdit} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /> Editar</button>
            )
          )}
        </div>

        {/* Minha área */}
        <div className="mt-5 rounded-2xl border border-[#7048E8]/30 bg-[#7048E8]/5 p-5 dark:border-[#7048E8]/30 dark:bg-[#7048E8]/10">
          <p className={LABEL}>Sua área</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{user?.name ?? 'Você'}</span>
            {meuCargo && <span className="rounded-full bg-[#7048E8] px-2 py-0.5 text-xs font-semibold text-white">{meuCargo.nome}</span>}
          </div>
          {meuCargo?.descricao && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{meuCargo.descricao}</p>}
          {meuBio && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{meuBio}</p>}
          {!meuCargo && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Seu cargo ainda não foi definido. {data.canEdit ? 'Defina abaixo no organograma.' : 'Peça a um sócio para definir.'}</p>}
        </div>

        {/* Cultura: missão / visão / valores */}
        <h2 className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Heart className="h-4 w-4 text-[#e64980]" /> Cultura</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {([['missao', 'Missão', Target, '#228BE6'], ['visao', 'Visão', Eye, '#7048E8']] as const).map(([k, label, Icon, cor]) => (
            <div key={k} className={CARD}>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}><Icon className="h-3.5 w-3.5" /> {label}</p>
              {editing ? (
                <textarea value={cur.cultura[k]} onChange={(e) => setCultura({ [k]: e.target.value })} rows={3} className={`${INPUT} mt-2`} placeholder={`Nossa ${label.toLowerCase()}…`} />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{cur.cultura[k] || <span className="text-zinc-400">—</span>}</p>
              )}
            </div>
          ))}
          <div className={CARD}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#02883C]"><Heart className="h-3.5 w-3.5" /> Valores</p>
            {editing ? (
              <textarea value={(cur.cultura.valores ?? []).join('\n')} onChange={(e) => setCultura({ valores: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={3} className={`${INPUT} mt-2`} placeholder={'Um valor por linha\nÉtica\nExcelência'} />
            ) : (
              <ul className="mt-2 space-y-1">
                {(cur.cultura.valores ?? []).length === 0 && <li className="text-sm text-zinc-400">—</li>}
                {(cur.cultura.valores ?? []).map((v, i) => <li key={i} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200"><span className="h-1.5 w-1.5 rounded-full bg-[#02883C]" /> {v}</li>)}
              </ul>
            )}
          </div>
        </div>
        {(editing || cur.cultura.cultura) && (
          <div className={`${CARD} mt-3`}>
            <p className={LABEL}>Sobre a cultura / como trabalhamos</p>
            {editing ? (
              <textarea value={cur.cultura.cultura} onChange={(e) => setCultura({ cultura: e.target.value })} rows={3} className={`${INPUT} mt-2`} placeholder="Como é trabalhar aqui, jeito do escritório, princípios do dia a dia…" />
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{cur.cultura.cultura}</p>
            )}
          </div>
        )}

        {/* Organograma — árvore interativa (clica num cargo pra ver o que se espera + as pessoas) */}
        <h2 className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Users className="h-4 w-4 text-[#228BE6]" /> Organograma</h2>
        <div className={`${CARD} mt-2`}>
          {(cur.cargos ?? []).length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum cargo cadastrado ainda{data.canEdit ? ' — adicione abaixo.' : '.'}</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-end gap-2 text-[11px]">
                <button onClick={() => setTreeSig((s) => ({ n: s.n + 1, open: true }))} className="font-medium text-[#228BE6] hover:underline">Expandir tudo</button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setTreeSig((s) => ({ n: s.n + 1, open: false }))} className="font-medium text-zinc-500 hover:underline">Recolher tudo</button>
              </div>
              <div className="space-y-2">
                {(cur.cargos ?? []).filter((c) => !c.parentId || !cargoById[c.parentId]).map((c) => (
                  <OrgNode key={c.id} cargo={c} cargos={cur.cargos ?? []} grupos={grupos} depth={0} meuCargoId={meuCargo?.id} sig={treeSig} />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-400">Clique num cargo para ver o que se espera dele e quem está nele. O seu cargo aparece destacado.</p>
            </>
          )}
        </div>

        {/* Atribuir cargo a cada pessoa (edição) */}
        {editing && (
          <div className={`${CARD} mt-3`}>
            <p className={LABEL}>Definir o cargo de cada pessoa</p>
            <div className="mt-2 space-y-2">
              {members.map((m) => (
                <div key={m.user.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-700 dark:text-zinc-200">{m.user.name} <span className="text-xs text-zinc-400">· {m.role === 'AGENT' ? 'associado' : 'sócio'}</span></span>
                  <select
                    value={draft.pessoas?.[m.user.id]?.cargoId ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, pessoas: { ...d.pessoas, [m.user.id]: { ...d.pessoas?.[m.user.id], cargoId: e.target.value || undefined } } }))}
                    className={`${INPUT} max-w-[200px]`}
                  >
                    <option value="">— sem cargo —</option>
                    {(draft.cargos ?? []).map((cg) => <option key={cg.id} value={cg.id}>{cg.nome}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cargos & descrições */}
        <h2 className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Briefcase className="h-4 w-4 text-[#f08c00]" /> Cargos &amp; descrições</h2>
        <div className="mt-2 space-y-3">
          {(cur.cargos ?? []).map((cg, i) => (
            <div key={cg.id} className={CARD}>
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={cg.nome} onChange={(e) => updateCargo(setDraft, i, { nome: e.target.value })} placeholder="Nome do cargo" className={`${INPUT} font-semibold`} />
                    <button onClick={() => removeCargo(setDraft, i)} title="Remover cargo" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <textarea value={cg.descricao} onChange={(e) => updateCargo(setDraft, i, { descricao: e.target.value })} rows={3} placeholder="O que essa pessoa faz aqui? Responsabilidades, entregas, do que ela cuida…" className={INPUT} />
                  <div>
                    <p className={LABEL}>Reporta a (cargo acima na árvore)</p>
                    <select value={cg.parentId ?? ''} onChange={(e) => updateCargo(setDraft, i, { parentId: e.target.value || null })} className={`${INPUT} mt-1`}>
                      <option value="">— topo (sem chefia) —</option>
                      {(draft.cargos ?? []).filter((x) => x.id !== cg.id).map((x) => <option key={x.id} value={x.id}>{x.nome || '(sem nome)'}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className={LABEL}>Divisão de honorários (só sócios veem)</p>
                    <input value={cg.divisaoHonorarios ?? ''} onChange={(e) => updateCargo(setDraft, i, { divisaoHonorarios: e.target.value })} placeholder="ex.: 10% do êxito dos casos que atua" className={`${INPUT} mt-1`} />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{cg.nome}</p>
                  {cg.descricao && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{cg.descricao}</p>}
                  {cg.divisaoHonorarios && <p className="mt-1.5 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">💰 {cg.divisaoHonorarios}</p>}
                </>
              )}
            </div>
          ))}
          {editing && (
            <button onClick={() => setDraft((d) => ({ ...d, cargos: [...(d.cargos ?? []), { id: rid(), nome: '', descricao: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar cargo</button>
          )}
        </div>

        {/* Manuais */}
        <h2 className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><BookOpen className="h-4 w-4 text-[#15AABF]" /> Manuais &amp; procedimentos</h2>
        <div className="mt-2 space-y-3">
          {(cur.manuais ?? []).map((mn, i) => (
            <div key={mn.id} className={CARD}>
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={mn.titulo} onChange={(e) => updateList(setDraft, 'manuais', i, { titulo: e.target.value })} placeholder="Título do manual" className={`${INPUT} font-semibold`} />
                    <button onClick={() => removeList(setDraft, 'manuais', i)} className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <textarea value={mn.conteudo} onChange={(e) => updateList(setDraft, 'manuais', i, { conteudo: e.target.value })} rows={4} placeholder="Passo a passo, regras, link…" className={INPUT} />
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{mn.titulo}</p>
                  {mn.conteudo && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{mn.conteudo}</p>}
                </>
              )}
            </div>
          ))}
          {(cur.manuais ?? []).length === 0 && !editing && <p className="text-sm text-zinc-400">Nenhum manual ainda.</p>}
          {editing && (
            <button onClick={() => setDraft((d) => ({ ...d, manuais: [...(d.manuais ?? []), { id: rid(), titulo: '', conteudo: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar manual</button>
          )}
        </div>

        {/* Onboarding */}
        <h2 className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><ListChecks className="h-4 w-4 text-[#02883C]" /> Onboarding do novo integrante</h2>
        <div className={`${CARD} mt-2`}>
          {editing ? (
            <textarea
              value={(cur.onboarding ?? []).map((o) => o.texto).join('\n')}
              onChange={(e) => setDraft((d) => ({ ...d, onboarding: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).map((texto, i) => ({ id: `o${i}`, texto })) }))}
              rows={5}
              placeholder={'Um passo por linha\nLer missão, visão e valores\nConhecer o seu cargo e responsabilidades\nLer os manuais da sua área\nAssinar o contrato e a procuração'}
              className={INPUT}
            />
          ) : (
            <ul className="space-y-1.5">
              {(cur.onboarding ?? []).length === 0 && <li className="text-sm text-zinc-400">Sem checklist de onboarding ainda.</li>}
              {(cur.onboarding ?? []).map((o) => (
                <li key={o.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"><span className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 dark:border-zinc-600"><UserIcon className="hidden" /></span> {o.texto}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}

const LEVEL_COLORS = ['#7048E8', '#228BE6', '#F08C00', '#15AABF', '#E64980'];

// Nó do organograma (árvore visual): card colorido por nível, conectores e
// avatares; expande pra mostrar "O que esperamos" + as pessoas + os subordinados.
function OrgNode({ cargo, cargos, grupos, depth, meuCargoId, sig }: { cargo: Cargo; cargos: Cargo[]; grupos: Map<string, Member[]>; depth: number; meuCargoId?: string; sig: { n: number; open: boolean } }) {
  const children = useMemo(() => cargos.filter((c) => c.parentId === cargo.id), [cargos, cargo.id]);
  const people = grupos.get(cargo.id) ?? [];
  const isMine = cargo.id === meuCargoId;
  const cor = LEVEL_COLORS[depth % LEVEL_COLORS.length];
  const [open, setOpen] = useState(depth < 1 || isMine);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setOpen(sig.open); }, [sig.n]);
  const ini = (n?: string | null) => (n ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={depth > 0 ? "relative ml-5 pl-5 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-zinc-200 before:content-[''] dark:before:bg-zinc-700" : ''}>
      {depth > 0 && <span className="absolute left-0 top-6 h-px w-5 bg-zinc-200 dark:bg-zinc-700" />}
      <button onClick={() => setOpen((o) => !o)} className={`group flex w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md dark:bg-zinc-900 ${isMine ? 'border-[#7048E8] ring-2 ring-[#7048E8]/20' : 'border-zinc-200 dark:border-zinc-800'}`} style={{ borderLeftColor: cor, borderLeftWidth: 4 }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${cor}1A`, color: cor }}><Briefcase className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">{cargo.nome || 'Cargo'}</span>
            {isMine && <span className="rounded-full bg-[#7048E8] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">você</span>}
          </span>
          <span className="text-[11px] text-zinc-400">{people.length} {people.length === 1 ? 'pessoa' : 'pessoas'}{children.length ? ` · ${children.length} subordinado${children.length > 1 ? 's' : ''}` : ''}</span>
        </span>
        <span className="flex shrink-0 items-center -space-x-2">
          {people.slice(0, 4).map((m) => <span key={m.user.id} title={m.user.name ?? ''} className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900" style={{ background: cor }}>{ini(m.user.name)}</span>)}
          {people.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-500 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-900">+{people.length - 4}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-300 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mb-1 mt-1.5 space-y-1.5">
          {cargo.descricao && (
            <div className="rounded-lg border-l-2 bg-zinc-50/70 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-300" style={{ borderLeftColor: cor }}>
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">O que esperamos:</span> {cargo.descricao}
            </div>
          )}
          {cargo.divisaoHonorarios && <p className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">💰 {cargo.divisaoHonorarios}</p>}
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {people.map((m) => (
                <span key={m.user.id} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: cor }}>{ini(m.user.name)}</span>
                  {m.user.name}
                </span>
              ))}
            </div>
          )}
          {children.length > 0 && <div className="space-y-2 pt-1">{children.map((ch) => <OrgNode key={ch.id} cargo={ch} cargos={cargos} grupos={grupos} depth={depth + 1} meuCargoId={meuCargoId} sig={sig} />)}</div>}
        </div>
      )}
    </div>
  );
}

// ── helpers de edição da lista de cargos / listas genéricas ──
function updateCargo(setDraft: (f: (d: Escritorio) => Escritorio) => void, i: number, patch: Partial<Cargo>) {
  setDraft((d) => ({ ...d, cargos: (d.cargos ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
}
function removeCargo(setDraft: (f: (d: Escritorio) => Escritorio) => void, i: number) {
  setDraft((d) => ({ ...d, cargos: (d.cargos ?? []).filter((_, j) => j !== i) }));
}
function updateList(setDraft: (f: (d: Escritorio) => Escritorio) => void, key: 'manuais', i: number, patch: any) {
  setDraft((d) => ({ ...d, [key]: (d[key] ?? []).map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)) }));
}
function removeList(setDraft: (f: (d: Escritorio) => Escritorio) => void, key: 'manuais', i: number) {
  setDraft((d) => ({ ...d, [key]: (d[key] ?? []).filter((_: any, j: number) => j !== i) }));
}
