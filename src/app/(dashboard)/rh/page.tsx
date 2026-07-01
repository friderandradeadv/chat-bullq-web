'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, UserPlus, KanbanSquare, Loader2, Plus, Trash2, X, Save, GripVertical,
  Mail, Phone, Briefcase, GraduationCap, Star, Pencil, ClipboardList,
} from 'lucide-react';
import { rhService, type Rh, type Candidato, type Etapa } from '@/features/rh/services/rh.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { escritorioService } from '@/features/escritorio/services/escritorio.service';

const rid = () => `x_${Math.round(Math.random() * 1e9)}`;
const INPUT = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400';
const ini = (n?: string | null) => (n ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const roleLabel = (r?: string) => (r === 'OWNER' ? 'Proprietário' : r === 'ADMIN' ? 'Sócio / Admin' : 'Associado');

export default function RhPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'membros' | 'selecao'>('membros');
  const { data: rh } = useQuery({ queryKey: ['rh'], queryFn: () => rhService.get(), staleTime: 30_000, retry: false });
  const { data: members = [], isLoading } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  const { data: esc } = useQuery({ queryKey: ['escritorio'], queryFn: () => escritorioService.get(), staleTime: 60_000 });

  const cargoById = useMemo(() => Object.fromEntries((esc?.cargos ?? []).map((c) => [c.id, c])), [esc]);
  const team = useMemo(() => members.filter((m) => m.assignable !== false), [members]);
  const canEdit = rh?.canEdit ?? false;

  const saveM = useMutation({
    mutationFn: (d: Partial<Rh>) => rhService.save(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao salvar'),
  });
  // salva mesclando por cima do atual
  const patch = (mut: (r: Rh) => Partial<Rh>) => { if (rh) saveM.mutate(mut(rh)); };

  if (isLoading) return <div className="flex h-full items-center justify-center text-sm text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="h-full overflow-y-auto bg-[#fafafa] px-6 py-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#7048E8]" />
          <div>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">RH &amp; Seleção</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Todo mundo do escritório e o processo seletivo — do currículo ao Labor Day.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-zinc-200/70 dark:border-zinc-800">
          {([['membros', 'Membros', Users], ['selecao', 'Processo Seletivo', KanbanSquare]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${tab === k ? 'border-[#7048E8] text-[#7048E8]' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === 'membros' && <MembrosView team={team} pessoas={esc?.pessoas ?? {}} cargoById={cargoById} />}
        {tab === 'selecao' && (rh
          ? <ProcessoSeletivo rh={rh} canEdit={canEdit} patch={patch} saving={saveM.isPending} />
          : <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">O processo seletivo precisa da atualização do servidor (rode o deploy da API). Assim que subir, ele aparece aqui.</div>)}
      </div>
    </div>
  );
}

// ─────────────────────────── Membros ───────────────────────────
function MembrosView({ team, pessoas, cargoById }: { team: Member[]; pessoas: Record<string, any>; cargoById: Record<string, any> }) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-zinc-500">{team.length} {team.length === 1 ? 'pessoa' : 'pessoas'} no escritório.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const info = pessoas[m.user.id] ?? {};
          const cargo = cargoById[info.cargoId ?? ''];
          const foto = info.fotoUrl || m.user.avatarUrl;
          return (
            <div key={m.user.id} className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                {foto ? <img src={foto} alt={m.user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7048E8] text-lg font-bold text-white">{ini(m.user.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{m.user.name}</p>
                  <p className="truncate text-xs text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.user.email}</span></p>
                {info.oab && <p className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#7048E8]" /> OAB {info.oab}</p>}
                {info.conoscoDesde && <p className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 shrink-0" /> Conosco desde {info.conoscoDesde}</p>}
                {Array.isArray(info.atuacao) && info.atuacao.length > 0 && <p className="flex flex-wrap gap-1 pt-0.5">{info.atuacao.map((a: string) => <span key={a} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{a}</span>)}</p>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.role === 'AGENT' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>{roleLabel(m.role)}</span>
                {m.user.isActive === false && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-500 dark:bg-rose-900/20">inativo</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-zinc-400">Para adicionar ou remover membros, use <strong>Configurações › Membros</strong>. O espaço de cada um aparece em <strong>Meu Espaço</strong>.</p>
    </div>
  );
}

// ─────────────────────────── Processo Seletivo (kanban) ───────────────────────────
function ProcessoSeletivo({ rh, canEdit, patch, saving }: { rh: Rh; canEdit: boolean; patch: (mut: (r: Rh) => Partial<Rh>) => void; saving: boolean }) {
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const etapas = rh.etapas ?? [];
  const porEtapa = (id: string) => (rh.candidatos ?? []).filter((c) => c.etapaId === id);

  const mover = (candId: string, etapaId: string) => patch((r) => ({ candidatos: (r.candidatos ?? []).map((c) => (c.id === candId ? { ...c, etapaId } : c)) }));
  const addCand = (c: Omit<Candidato, 'id'>) => patch((r) => ({ candidatos: [...(r.candidatos ?? []), { ...c, id: rid() }] }));
  const updCand = (id: string, p: Partial<Candidato>) => patch((r) => ({ candidatos: (r.candidatos ?? []).map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const delCand = (id: string) => patch((r) => ({ candidatos: (r.candidatos ?? []).filter((c) => c.id !== id) }));

  const editing = rh.candidatos?.find((c) => c.id === editId);

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">{(rh.candidatos ?? []).length} candidatos · arraste os cards entre as etapas. {saving && <span className="ml-1 inline-flex items-center gap-1 text-xs text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" /> salvando</span>}</p>
        {canEdit && <button onClick={() => setNovo(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0]"><UserPlus className="h-4 w-4" /> Nova candidatura</button>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {etapas.map((e) => {
          const cards = porEtapa(e.id);
          return (
            <div
              key={e.id}
              onDragOver={(ev) => { if (canEdit) ev.preventDefault(); }}
              onDrop={() => { if (canEdit && dragId) { mover(dragId, e.id); setDragId(null); } }}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-200/70 bg-zinc-100/50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="mb-2 flex items-center gap-1.5 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.cor ?? '#64748b' }} />
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{e.nome}</span>
                <span className="ml-auto rounded-full bg-white px-1.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    draggable={canEdit}
                    onDragStart={() => setDragId(c.id)}
                    onClick={() => canEdit && setEditId(c.id)}
                    className={`group rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''}`}
                    style={{ borderLeftColor: e.cor ?? '#64748b', borderLeftWidth: 3 }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: e.cor ?? '#64748b' }}>{ini(c.nome)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{c.nome || 'Sem nome'}</p>
                        {c.cargo && <p className="truncate text-[11px] text-zinc-400">{c.cargo}</p>}
                      </div>
                      {canEdit && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100" />}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                      {c.telefone && <span className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" /> {c.telefone}</span>}
                      {typeof c.nota === 'number' && <span className="inline-flex items-center gap-0.5 text-[#F08C00]"><Star className="h-3 w-3" /> {c.nota}</span>}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-zinc-300 dark:text-zinc-600">— vazio —</p>}
              </div>
            </div>
          );
        })}
      </div>

      {novo && canEdit && <CandidatoModal etapas={etapas} onClose={() => setNovo(false)} onSave={(c) => { addCand({ ...c, etapaId: etapas[0]?.id ?? 'e_inscritos', criadoEm: new Date().toISOString() }); setNovo(false); }} />}
      {editing && canEdit && <CandidatoModal etapas={etapas} candidato={editing} onClose={() => setEditId(null)} onSave={(c) => { updCand(editing.id, c); setEditId(null); }} onDelete={() => { delCand(editing.id); setEditId(null); }} />}
    </div>
  );
}

function CandidatoModal({ etapas, candidato, onClose, onSave, onDelete }: { etapas: Etapa[]; candidato?: Candidato; onClose: () => void; onSave: (c: Omit<Candidato, 'id' | 'etapaId'> & { etapaId?: string }) => void; onDelete?: () => void }) {
  const [f, setF] = useState<Partial<Candidato>>({ ...(candidato ?? {}) });
  const set = (p: Partial<Candidato>) => setF((x) => ({ ...x, ...p }));
  const salvar = () => {
    if (!f.nome?.trim()) { toast.error('Informe o nome do candidato'); return; }
    onSave({ nome: f.nome.trim(), cargo: f.cargo, email: f.email, telefone: f.telefone, notas: f.notas, curriculo: f.curriculo, nota: f.nota, etapaId: f.etapaId });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{candidato ? 'Candidato' : 'Nova candidatura'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div><p className={LABEL}>Nome</p><input value={f.nome ?? ''} onChange={(e) => set({ nome: e.target.value })} className={`${INPUT} mt-1 font-semibold`} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><p className={LABEL}>Vaga pretendida</p><input value={f.cargo ?? ''} onChange={(e) => set({ cargo: e.target.value })} placeholder="ex.: Estagiário Externo" className={`${INPUT} mt-1`} /></div>
            {candidato && <div><p className={LABEL}>Etapa</p>
              <select value={f.etapaId ?? candidato.etapaId} onChange={(e) => set({ etapaId: e.target.value })} className={`${INPUT} mt-1`}>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><p className={LABEL}>E-mail</p><input value={f.email ?? ''} onChange={(e) => set({ email: e.target.value })} className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Telefone</p><input value={f.telefone ?? ''} onChange={(e) => set({ telefone: e.target.value })} className={`${INPUT} mt-1`} /></div>
          </div>
          <div><p className={LABEL}>Currículo (link ou observação)</p><input value={f.curriculo ?? ''} onChange={(e) => set({ curriculo: e.target.value })} placeholder="link do Drive, LinkedIn…" className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Nota (prova/entrevista, 0–10)</p><input type="number" min={0} max={10} value={f.nota ?? ''} onChange={(e) => set({ nota: e.target.value === '' ? undefined : Math.max(0, Math.min(10, Number(e.target.value))) })} className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Anotações do avaliador</p><textarea value={f.notas ?? ''} onChange={(e) => set({ notas: e.target.value })} rows={3} placeholder="Impressões, pontos fortes, red flags…" className={`${INPUT} mt-1`} /></div>
        </div>
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-zinc-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          {onDelete && <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-4 w-4" /> Remover</button>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={salvar} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6]"><Save className="h-4 w-4" /> Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
