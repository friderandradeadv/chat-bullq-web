'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Target, Eye, Heart, Users, Briefcase, BookOpen, ListChecks,
  Pencil, Plus, Trash2, Save, X, Loader2, ChevronDown, Lock,
  Compass, MessageSquare, CalendarClock, FolderKanban, Calculator, ShieldCheck,
  CheckCircle2, Circle, Sparkles,
} from 'lucide-react';
import { escritorioService, type Escritorio, type Cargo, type Manual, type OnboardingItem } from '@/features/escritorio/services/escritorio.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { useAuthStore } from '@/stores/auth-store';

const rid = () => `c_${Math.round(Math.random() * 1e9)}`;
const EMPTY: Escritorio = { cultura: { missao: '', visao: '', valores: [], cultura: '' }, cargos: [], pessoas: {}, manuais: [], onboarding: [], canEdit: false };

// Módulos do Hub que dá pra liberar/bloquear por cargo (espelha APP_MODULES da API).
// Início e Escritório aparecem pra todos — não entram aqui.
const HUB_MODULES: { key: string; label: string }[] = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'automacoes', label: 'Automações' },
  { key: 'juridico', label: 'Jurídico' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'configuracoes', label: 'Configurações' },
];
const HUB_MODULE_KEYS = HUB_MODULES.map((m) => m.key);

// Ícone + cor por manual (cicla conforme a ordem) — deixa a leitura mais visual.
const MANUAL_STYLES = [
  { icon: Compass, cor: '#7048E8' },
  { icon: MessageSquare, cor: '#228BE6' },
  { icon: CalendarClock, cor: '#F08C00' },
  { icon: FolderKanban, cor: '#15AABF' },
  { icon: Calculator, cor: '#E64980' },
  { icon: ShieldCheck, cor: '#02883C' },
];
const VALOR_CORES = ['#7048E8', '#228BE6', '#F08C00', '#15AABF', '#E64980', '#02883C'];

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

  // Aplica o acesso aos módulos do Hub a cada pessoa a partir do cargo dela
  // (só cargos COM módulos definidos; sócios o backend sempre libera tudo).
  const applyAcessosM = useMutation({
    mutationFn: async () => {
      let aplicados = 0;
      for (const m of members) {
        const cargo = cargoById[data.pessoas?.[m.user.id]?.cargoId ?? ''];
        const liberados = cargo?.modulos;
        if (!cargo || !liberados) continue; // sem cargo ou cargo sem regra → não mexe
        const restricted = HUB_MODULE_KEYS.filter((k) => !liberados.includes(k));
        await membersService.updateModules(m.userId, restricted);
        aplicados++;
      }
      return aplicados;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['org-members'] });
      toast.success(n > 0 ? `Acesso aplicado a ${n} ${n === 1 ? 'pessoa' : 'pessoas'} pelo cargo (vale no próximo login dela)` : 'Nenhum cargo com regra de acesso definida');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao aplicar acessos'),
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

        {/* Navegação rápida entre seções */}
        <div className="sticky top-0 z-10 -mx-6 mb-1 mt-4 flex flex-wrap gap-2 border-b border-zinc-200/70 bg-[#fafafa]/90 px-6 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          {([['sec-cultura', 'Cultura', Heart, '#e64980'], ['sec-organograma', 'Organograma', Users, '#228BE6'], ['sec-manuais', 'Manuais', BookOpen, '#15AABF'], ['sec-onboarding', 'Onboarding', ListChecks, '#02883C']] as const).map(([id, label, Icon, cor]) => (
            <a key={id} href={`#${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <Icon className="h-3.5 w-3.5" style={{ color: cor }} /> {label}
            </a>
          ))}
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
        <h2 id="sec-cultura" className="mt-7 flex scroll-mt-16 items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Heart className="h-4 w-4 text-[#e64980]" /> Cultura</h2>
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(cur.cultura.valores ?? []).length === 0 && <span className="text-sm text-zinc-400">—</span>}
                {(cur.cultura.valores ?? []).map((v, i) => {
                  const c = VALOR_CORES[i % VALOR_CORES.length];
                  return <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${c}14`, color: c }}><Heart className="h-3 w-3" /> {v}</span>;
                })}
              </div>
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

        {/* Organograma — árvore top-down (igual a um organograma de verdade) */}
        <h2 id="sec-organograma" className="mt-7 flex scroll-mt-16 items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Users className="h-4 w-4 text-[#228BE6]" /> Organograma</h2>
        <div className={`${CARD} mt-2`}>
          {(cur.cargos ?? []).length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum cargo cadastrado ainda{data.canEdit ? ' — adicione abaixo.' : '.'}</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-400">Clique num cargo para recolher/abrir o ramo. Arraste para o lado se a árvore for larga.</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => setTreeSig((s) => ({ n: s.n + 1, open: true }))} className="font-medium text-[#228BE6] hover:underline">Expandir tudo</button>
                  <span className="text-zinc-300">·</span>
                  <button onClick={() => setTreeSig((s) => ({ n: s.n + 1, open: false }))} className="font-medium text-zinc-500 hover:underline">Recolher tudo</button>
                </div>
              </div>
              <OrgChart cargos={cur.cargos ?? []} grupos={grupos} meuCargoId={meuCargo?.id} sig={treeSig} />
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
                  <div>
                    <p className={LABEL}>Acesso aos módulos do Hub</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {HUB_MODULES.map((mod) => {
                        const on = (cg.modulos ?? HUB_MODULE_KEYS).includes(mod.key);
                        return (
                          <button key={mod.key} type="button" onClick={() => toggleModulo(setDraft, i, mod.key)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'border-[#228BE6] bg-[#228BE6]/10 text-[#228BE6]' : 'border-zinc-300 text-zinc-400 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-500'}`}>
                            {on ? '✓ ' : ''}{mod.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Início e Escritório aparecem para todos. Marque o que este cargo deve acessar — depois clique em “Aplicar acessos pelos cargos”. Sócios sempre veem tudo.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{cg.nome}</p>
                  {cg.descricao && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{cg.descricao}</p>}
                  {cg.divisaoHonorarios && <p className="mt-1.5 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">💰 {cg.divisaoHonorarios}</p>}
                  {cg.modulos && cg.modulos.length < HUB_MODULE_KEYS.length && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">Acessa: {cg.modulos.length === 0 ? <span className="italic">só Início e Escritório</span> : HUB_MODULES.filter((mod) => cg.modulos!.includes(mod.key)).map((mod) => <span key={mod.key} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{mod.label}</span>)}</p>
                  )}
                </>
              )}
            </div>
          ))}
          {editing && (
            <button onClick={() => setDraft((d) => ({ ...d, cargos: [...(d.cargos ?? []), { id: rid(), nome: '', descricao: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar cargo</button>
          )}
        </div>

        {/* Aplicar acesso aos módulos a partir do cargo de cada pessoa */}
        {data.canEdit && !editing && (cur.cargos ?? []).some((c) => Array.isArray(c.modulos)) && (
          <div className={`${CARD} mt-3 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#228BE6]" />
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Aplicar o acesso aos módulos do Hub para cada pessoa <strong>conforme o cargo dela</strong>. Sócios continuam vendo tudo; vale no próximo login de cada um.</p>
            </div>
            <button onClick={() => applyAcessosM.mutate()} disabled={applyAcessosM.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#228BE6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-60">
              {applyAcessosM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Aplicar acessos pelos cargos
            </button>
          </div>
        )}

        {/* Manuais */}
        <h2 id="sec-manuais" className="mt-7 flex scroll-mt-16 items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><BookOpen className="h-4 w-4 text-[#15AABF]" /> Manuais &amp; procedimentos</h2>
        {!editing && (cur.manuais ?? []).length > 0 && <p className="mt-1 text-xs text-zinc-400">Toque num manual para abrir.</p>}
        <div className="mt-2 space-y-2">
          {editing ? (cur.manuais ?? []).map((mn, i) => (
            <div key={mn.id} className={CARD}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input value={mn.titulo} onChange={(e) => updateList(setDraft, 'manuais', i, { titulo: e.target.value })} placeholder="Título do manual" className={`${INPUT} font-semibold`} />
                  <button onClick={() => removeList(setDraft, 'manuais', i)} className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea value={mn.conteudo} onChange={(e) => updateList(setDraft, 'manuais', i, { conteudo: e.target.value })} rows={4} placeholder="Passo a passo, regras, link…" className={INPUT} />
              </div>
            </div>
          )) : (cur.manuais ?? []).map((mn, i) => <ManualCard key={mn.id} manual={mn} index={i} defaultOpen={i === 0} />)}
          {(cur.manuais ?? []).length === 0 && !editing && <p className="text-sm text-zinc-400">Nenhum manual ainda.</p>}
          {editing && (
            <button onClick={() => setDraft((d) => ({ ...d, manuais: [...(d.manuais ?? []), { id: rid(), titulo: '', conteudo: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar manual</button>
          )}
        </div>

        {/* Onboarding */}
        <h2 id="sec-onboarding" className="mt-7 flex scroll-mt-16 items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><ListChecks className="h-4 w-4 text-[#02883C]" /> Onboarding do novo integrante</h2>
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
            <OnboardingChecklist itens={cur.onboarding ?? []} userId={user?.id} />
          )}
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}

// Formata uma linha do manual: destaca "Rótulo:" em negrito quando houver.
function fmtLinha(s: string) {
  const m = s.match(/^([^:]{2,32}):\s+(.+)/);
  return m ? <><strong className="font-semibold text-zinc-700 dark:text-zinc-200">{m[1]}:</strong> {m[2]}</> : s;
}

// Corpo do manual: vira tópicos (•), passos numerados (1.) ou parágrafos — nada de bloco corrido.
function ManualBody({ linhas, cor }: { linhas: string[]; cor: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
      {linhas.map((line, i) => {
        if (line.startsWith('•')) {
          return <div key={i} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cor }} /><span>{fmtLinha(line.replace(/^•\s*/, ''))}</span></div>;
        }
        const num = line.match(/^(\d+)\.\s+(.*)/);
        if (num) {
          return <div key={i} className="flex items-start gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: cor }}>{num[1]}</span><span>{fmtLinha(num[2])}</span></div>;
        }
        return <p key={i}>{fmtLinha(line)}</p>;
      })}
    </div>
  );
}

// Manual em accordion: ícone colorido + prévia de 1 linha; abre ao clicar.
function ManualCard({ manual, index, defaultOpen }: { manual: Manual; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const { icon: Icon, cor } = MANUAL_STYLES[index % MANUAL_STYLES.length];
  const linhas = useMemo(() => manual.conteudo.split('\n').map((l) => l.trim()).filter(Boolean), [manual.conteudo]);
  const teaser = linhas[0] ?? '';
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-zinc-900 ${open ? 'border-zinc-200 shadow-sm dark:border-zinc-700' : 'border-zinc-200/80 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cor}1A`, color: cor }}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">{manual.titulo}</span>
          {!open && teaser && <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-400">{teaser}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3.5 dark:border-zinc-800">
          <ManualBody linhas={linhas} cor={cor} />
        </div>
      )}
    </div>
  );
}

// Checklist de onboarding interativo: marca/desmarca + barra de progresso (salva por pessoa no navegador).
function OnboardingChecklist({ itens, userId }: { itens: OnboardingItem[]; userId?: string }) {
  const key = `bullq:onboarding:${userId ?? 'anon'}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setDone(new Set(JSON.parse(raw))); } catch { /* ignora */ }
  }, [key]);
  const toggle = (id: string) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignora */ }
    return next;
  });
  if (itens.length === 0) return <p className="text-sm text-zinc-400">Sem checklist de onboarding ainda.</p>;
  const feitos = itens.filter((o) => done.has(o.id)).length;
  const pct = Math.round((feitos / itens.length) * 100);
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-[#02883C] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-zinc-500">{feitos}/{itens.length}</span>
      </div>
      {feitos === itens.length && <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-[#02883C]/10 px-3 py-2 text-sm font-medium text-[#02883C]"><Sparkles className="h-4 w-4" /> Onboarding completo! Bem-vindo(a) ao time. 🎉</p>}
      <ul className="space-y-0.5">
        {itens.map((o) => {
          const ok = done.has(o.id);
          return (
            <li key={o.id}>
              <button onClick={() => toggle(o.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#02883C]" /> : <Circle className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />}
                <span className={`text-sm ${ok ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200'}`}>{o.texto}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ROOT_COLOR = '#64748b';
const BRANCH_COLORS = ['#228BE6', '#7048E8', '#E64980', '#15AABF', '#F08C00', '#02883C'];

// CSS de árvore top-down (conectores via pseudo-elementos, cor = currentColor do nível).
const ORG_CSS = `
.org-tree, .org-tree ul { list-style:none; margin:0; padding:0; }
.org-tree ul { display:flex; justify-content:center; padding-top:24px; position:relative; }
.org-tree li { display:flex; flex-direction:column; align-items:center; position:relative; padding:24px 14px 0; }
.org-tree li::before, .org-tree li::after { content:''; position:absolute; top:0; width:50%; height:24px; border-top:2px solid currentColor; }
.org-tree li::before { right:50%; }
.org-tree li::after { left:50%; border-left:2px solid currentColor; }
.org-tree li:only-child::before, .org-tree li:only-child::after { display:none; }
.org-tree li:only-child { padding-top:24px; }
.org-tree li:first-child::before, .org-tree li:last-child::after { border:0 none; }
.org-tree li:last-child::before { border-right:2px solid currentColor; border-radius:0 8px 0 0; }
.org-tree li:first-child::after { border-radius:8px 0 0 0; }
.org-tree li > ul::before { content:''; position:absolute; top:0; left:50%; width:0; height:24px; border-left:2px solid currentColor; }
`;

// Organograma top-down: raiz no topo, ramifica pra baixo com conectores coloridos por ramo.
function OrgChart({ cargos, grupos, meuCargoId, sig }: { cargos: Cargo[]; grupos: Map<string, Member[]>; meuCargoId?: string; sig: { n: number; open: boolean } }) {
  const byId = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c])), [cargos]);
  const roots = useMemo(() => cargos.filter((c) => !c.parentId || !byId[c.parentId]), [cargos, byId]);
  return (
    <div className="overflow-x-auto pb-3">
      <style>{ORG_CSS}</style>
      <div className="flex min-w-max flex-col items-center gap-10 px-4 pt-1">
        {roots.map((r) => (
          <ul key={r.id} className="org-tree" style={{ color: ROOT_COLOR }}>
            <OrgNodeTop cargo={r} cargos={cargos} grupos={grupos} meuCargoId={meuCargoId} depth={0} color={ROOT_COLOR} sig={sig} />
          </ul>
        ))}
      </div>
    </div>
  );
}

function OrgNodeTop({ cargo, cargos, grupos, meuCargoId, depth, color, sig }: { cargo: Cargo; cargos: Cargo[]; grupos: Map<string, Member[]>; meuCargoId?: string; depth: number; color: string; sig: { n: number; open: boolean } }) {
  const children = useMemo(() => cargos.filter((c) => c.parentId === cargo.id), [cargos, cargo.id]);
  const people = grupos.get(cargo.id) ?? [];
  const isMine = cargo.id === meuCargoId;
  const hasChildren = children.length > 0;
  const [collapsed, setCollapsed] = useState(false);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setCollapsed(!sig.open); }, [sig.n]);
  const tip = [cargo.descricao, people.length ? `Quem: ${people.map((m) => m.user.name).join(', ')}` : ''].filter(Boolean).join('\n\n');

  // Estilo do card por nível: raiz (destaque), departamentos (pílula sólida), demais (pílula branca c/ borda).
  let cardCls: string, cardStyle: React.CSSProperties, countCls: string;
  if (depth === 0) {
    cardCls = 'border-2 bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100';
    cardStyle = { borderColor: '#cbd5e1' };
    countCls = 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300';
  } else if (depth === 1) {
    cardCls = 'text-white';
    cardStyle = { background: color };
    countCls = 'bg-white/25 text-white';
  } else {
    cardCls = 'border bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
    cardStyle = { borderColor: color };
    countCls = 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300';
  }

  return (
    <li style={{ color }}>
      <button
        onClick={() => hasChildren && setCollapsed((c) => !c)}
        title={tip || undefined}
        className={`relative z-[1] flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 font-semibold shadow-sm transition ${hasChildren ? 'cursor-pointer hover:-translate-y-px hover:shadow-md' : 'cursor-default'} ${depth === 0 ? 'text-base' : 'text-[13px]'} ${cardCls} ${isMine ? 'ring-2 ring-offset-2 ring-[#7048E8] dark:ring-offset-zinc-900' : ''}`}
        style={cardStyle}
      >
        {depth >= 2 && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span>{cargo.nome || 'Cargo'}</span>
        {isMine && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${depth === 1 ? 'bg-white/25 text-white' : 'bg-[#7048E8] text-white'}`}>você</span>}
        {people.length > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${countCls}`}>{people.length}</span>}
        {hasChildren && <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${collapsed ? '-rotate-90' : ''}`} />}
      </button>
      {hasChildren && !collapsed && (
        <ul style={{ color }}>
          {children.map((ch, i) => (
            <OrgNodeTop key={ch.id} cargo={ch} cargos={cargos} grupos={grupos} meuCargoId={meuCargoId} depth={depth + 1} color={depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : color} sig={sig} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── helpers de edição da lista de cargos / listas genéricas ──
function updateCargo(setDraft: (f: (d: Escritorio) => Escritorio) => void, i: number, patch: Partial<Cargo>) {
  setDraft((d) => ({ ...d, cargos: (d.cargos ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
}
function removeCargo(setDraft: (f: (d: Escritorio) => Escritorio) => void, i: number) {
  setDraft((d) => ({ ...d, cargos: (d.cargos ?? []).filter((_, j) => j !== i) }));
}
function toggleModulo(setDraft: (f: (d: Escritorio) => Escritorio) => void, i: number, key: string) {
  setDraft((d) => ({
    ...d,
    cargos: (d.cargos ?? []).map((c, j) => {
      if (j !== i) return c;
      const base = c.modulos ?? HUB_MODULE_KEYS; // undefined = vê tudo → parte de "todos"
      const next = base.includes(key) ? base.filter((k) => k !== key) : HUB_MODULE_KEYS.filter((k) => base.includes(k) || k === key);
      return { ...c, modulos: next };
    }),
  }));
}
function updateList(setDraft: (f: (d: Escritorio) => Escritorio) => void, key: 'manuais', i: number, patch: any) {
  setDraft((d) => ({ ...d, [key]: (d[key] ?? []).map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)) }));
}
function removeList(setDraft: (f: (d: Escritorio) => Escritorio) => void, key: 'manuais', i: number) {
  setDraft((d) => ({ ...d, [key]: (d[key] ?? []).filter((_: any, j: number) => j !== i) }));
}
