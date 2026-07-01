'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, UserPlus, KanbanSquare, Loader2, Plus, Trash2, X, Save, GripVertical,
  Mail, Phone, Star, Lock, MapPin, IdCard, FileText, ExternalLink,
  Network, LayoutGrid, Sparkles,
} from 'lucide-react';
import { rhService, type Rh, type Candidato, type Etapa, type Ficha } from '@/features/rh/services/rh.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { escritorioService, type Cargo } from '@/features/escritorio/services/escritorio.service';
import { DropZone } from '@/components/drop-zone';
import { useAuthStore } from '@/stores/auth-store';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

const rid = () => `x_${Math.round(Math.random() * 1e9)}`;
const INPUT = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400';
const ini = (n?: string | null) => (n ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const roleLabel = (r?: string) => (r === 'OWNER' ? 'Proprietário' : r === 'ADMIN' ? 'Sócio / Admin' : 'Associado');

export default function RhPage() {
  const qc = useQueryClient();
  const { organizations, activeOrgId } = useAuthStore();
  const orgRole = organizations.find((o) => o.id === activeOrgId)?.role;
  const isSocio = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const [tab, setTab] = useState<'membros' | 'selecao'>('membros');
  const { data: rh } = useQuery({ queryKey: ['rh'], queryFn: () => rhService.get(), staleTime: 30_000, retry: false, enabled: isSocio });
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list(), enabled: isSocio });
  const { data: esc } = useQuery({ queryKey: ['escritorio'], queryFn: () => escritorioService.get(), staleTime: 60_000, enabled: isSocio });

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

  if (!isSocio || rh?.restrito) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><Lock className="h-7 w-7" /></span>
        <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">Área restrita</p>
        <p className="max-w-xs text-sm text-zinc-500">O RH & Seleção — com fichas, documentos e o processo seletivo — é acessível apenas aos sócios.</p>
      </div>
    );
  }

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

        {tab === 'membros' && <MembrosView team={team} pessoas={esc?.pessoas ?? {}} cargos={esc?.cargos ?? []} cargoById={cargoById} fichas={rh?.fichas ?? {}} canEdit={canEdit} patch={patch} />}
        {tab === 'selecao' && (rh
          ? <ProcessoSeletivo rh={rh} canEdit={canEdit} patch={patch} saving={saveM.isPending} />
          : <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">O processo seletivo precisa da atualização do servidor (rode o deploy da API). Assim que subir, ele aparece aqui.</div>)}
      </div>
    </div>
  );
}

// ─────────────────────────── Membros ───────────────────────────
function MembrosView({ team, pessoas, cargos, cargoById, fichas, canEdit, patch }: { team: Member[]; pessoas: Record<string, any>; cargos: Cargo[]; cargoById: Record<string, any>; fichas: Record<string, Ficha>; canEdit: boolean; patch: (mut: (r: Rh) => Partial<Rh>) => void }) {
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'org'>('cards');
  const membro = team.find((m) => m.user.id === fichaId);
  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">{team.length} {team.length === 1 ? 'pessoa' : 'pessoas'} no escritório · clique num colaborador para abrir a ficha completa.</p>
        {/* Alternar entre cartões e organograma (hierarquia por cargo). */}
        <div className="inline-flex shrink-0 rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {([['cards', 'Cartões', LayoutGrid], ['org', 'Organograma', Network]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setView(k)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${view === k ? 'bg-[#7048E8] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'org' && <Organograma team={team} pessoas={pessoas} cargos={cargos} cargoById={cargoById} fichas={fichas} onOpen={setFichaId} />}

      {view === 'cards' && (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const info = pessoas[m.user.id] ?? {};
          const cargo = cargoById[info.cargoId ?? ''];
          const foto = m.user.avatarUrl || info.fotoUrl;
          const ficha = fichas[m.user.id] ?? {};
          return (
            <button key={m.user.id} onClick={() => setFichaId(m.user.id)} className="group rounded-2xl border border-zinc-200/80 bg-white p-4 text-left transition hover:-translate-y-px hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                {foto ? <img src={foto} alt={m.user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7048E8] text-lg font-bold text-white">{ini(m.user.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{m.user.name}</p>
                  <p className="truncate text-xs text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.user.email}</span></p>
                {ficha.telefone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-[#02883C]" /> {ficha.telefone}</p>}
                {ficha.endereco && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#E64980]" /> <span className="truncate">{ficha.endereco}</span></p>}
                {ficha.cpf && <p className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /> CPF {ficha.cpf}</p>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.role === 'AGENT' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>{roleLabel(m.role)}</span>
                {(ficha.documentos?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"><FileText className="h-3 w-3" /> {ficha.documentos!.length} doc</span>}
                <span className="ml-auto text-[11px] font-semibold text-[#7048E8] opacity-0 transition group-hover:opacity-100">Abrir ficha →</span>
              </div>
            </button>
          );
        })}
      </div>
      )}
      <p className="mt-4 text-xs text-zinc-400">Para adicionar ou remover membros, use <strong>Configurações › Membros</strong> (ou o botão em Meu Espaço). As fotos aparecem no organograma, nos kanbans e onde mais o nome da pessoa aparecer.</p>
      {membro && (
        <FichaModal
          membro={membro}
          info={pessoas[membro.user.id] ?? {}}
          cargo={cargoById[(pessoas[membro.user.id] ?? {}).cargoId ?? '']}
          ficha={fichas[membro.user.id] ?? {}}
          canEdit={canEdit}
          onClose={() => setFichaId(null)}
          onSave={(f) => { patch((r) => ({ fichas: { ...(r.fichas ?? {}), [membro.user.id]: f } })); setFichaId(null); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Organograma (pessoas por cargo) ───────────────────────────
// CSS de árvore top-down (conectores via pseudo-elementos) — igual ao de Meu Espaço.
const ORG_CSS = `
.rh-tree, .rh-tree ul { list-style:none; margin:0; padding:0; }
.rh-tree ul { display:flex; justify-content:center; padding-top:24px; position:relative; }
.rh-tree li { display:flex; flex-direction:column; align-items:center; position:relative; padding:24px 12px 0; }
.rh-tree li::before, .rh-tree li::after { content:''; position:absolute; top:0; width:50%; height:24px; border-top:2px solid #cbd5e1; }
.rh-tree li::before { right:50%; }
.rh-tree li::after { left:50%; border-left:2px solid #cbd5e1; }
.rh-tree li:only-child::before, .rh-tree li:only-child::after { display:none; }
.rh-tree li:only-child { padding-top:0; }
.rh-tree li:first-child::before, .rh-tree li:last-child::after { border:0 none; }
.rh-tree li:last-child::before { border-right:2px solid #cbd5e1; border-radius:0 8px 0 0; }
.rh-tree li:first-child::after { border-radius:8px 0 0 0; }
.rh-tree li > ul::before { content:''; position:absolute; top:0; left:50%; width:0; height:24px; border-left:2px solid #cbd5e1; }
`;

function Organograma({ team, pessoas, cargos, cargoById, fichas, onOpen }: { team: Member[]; pessoas: Record<string, any>; cargos: Cargo[]; cargoById: Record<string, any>; fichas: Record<string, Ficha>; onOpen: (uid: string) => void }) {
  // Pessoas agrupadas por cargo; quem não tem cargo (ou cargo removido) fica à parte.
  const porCargo = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of team) {
      const cid = pessoas[m.user.id]?.cargoId;
      if (cid && cargoById[cid]) map.set(cid, [...(map.get(cid) ?? []), m]);
    }
    return map;
  }, [team, pessoas, cargoById]);
  const semCargo = useMemo(() => team.filter((m) => { const cid = pessoas[m.user.id]?.cargoId; return !cid || !cargoById[cid]; }), [team, pessoas, cargoById]);
  const byId = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c])), [cargos]);
  const roots = useMemo(() => cargos.filter((c) => !c.parentId || !byId[c.parentId]), [cargos, byId]);

  if (cargos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        Ainda não há cargos cadastrados. Monte a estrutura em <strong>Meu Espaço › Organograma</strong> e defina o cargo de cada pessoa — aqui ela aparece na hierarquia.
        {semCargo.length > 0 && <SemCargo lista={semCargo} pessoas={pessoas} fichas={fichas} onOpen={onOpen} />}
      </div>
    );
  }

  return (
    <div>
      <style>{ORG_CSS}</style>
      <div className="overflow-auto rounded-2xl border border-zinc-100 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex min-w-max flex-col items-center gap-8">
          {roots.map((r) => (
            <ul key={r.id} className="rh-tree">
              <OrgNode cargo={r} cargos={cargos} porCargo={porCargo} pessoas={pessoas} fichas={fichas} onOpen={onOpen} />
            </ul>
          ))}
        </div>
      </div>
      {semCargo.length > 0 && <SemCargo lista={semCargo} pessoas={pessoas} fichas={fichas} onOpen={onOpen} />}
    </div>
  );
}

function OrgNode({ cargo, cargos, porCargo, pessoas, fichas, onOpen }: { cargo: Cargo; cargos: Cargo[]; porCargo: Map<string, Member[]>; pessoas: Record<string, any>; fichas: Record<string, Ficha>; onOpen: (uid: string) => void }) {
  const children = cargos.filter((c) => c.parentId === cargo.id);
  const pessoasCargo = porCargo.get(cargo.id) ?? [];
  return (
    <li>
      <div className="z-[1] w-52 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="truncate text-center text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{cargo.nome || 'Cargo'}</p>
        {pessoasCargo.length === 0 ? (
          <p className="mt-1.5 text-center text-[11px] text-zinc-300 dark:text-zinc-600">— vago —</p>
        ) : (
          <div className="mt-2 space-y-1">
            {pessoasCargo.map((m) => {
              const foto = m.user.avatarUrl || pessoas[m.user.id]?.fotoUrl;
              const nDoc = fichas[m.user.id]?.documentos?.length ?? 0;
              return (
                <button key={m.user.id} onClick={() => onOpen(m.user.id)} title="Abrir ficha" className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  {foto ? <img src={foto} alt={m.user.name} className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7048E8] text-[10px] font-bold text-white">{ini(m.user.name)}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">{m.user.name}</span>
                  {nDoc > 0 && <FileText className="h-3 w-3 shrink-0 text-zinc-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((ch) => (
            <OrgNode key={ch.id} cargo={ch} cargos={cargos} porCargo={porCargo} pessoas={pessoas} fichas={fichas} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SemCargo({ lista, pessoas, fichas, onOpen }: { lista: Member[]; pessoas: Record<string, any>; fichas: Record<string, Ficha>; onOpen: (uid: string) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Sem cargo definido</p>
      <div className="flex flex-wrap gap-2">
        {lista.map((m) => {
          const foto = m.user.avatarUrl || pessoas[m.user.id]?.fotoUrl;
          return (
            <button key={m.user.id} onClick={() => onOpen(m.user.id)} title="Abrir ficha" className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 transition hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              {foto ? <img src={foto} alt={m.user.name} className="h-6 w-6 shrink-0 rounded-full object-cover" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7048E8] text-[9px] font-bold text-white">{ini(m.user.name)}</span>}
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{m.user.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Ficha completa de RH de um colaborador (dados sensíveis — só sócios).
function FichaModal({ membro, info, cargo, ficha, canEdit, onClose, onSave }: { membro: Member; info: any; cargo?: any; ficha: Ficha; canEdit: boolean; onClose: () => void; onSave: (f: Ficha) => void }) {
  const [f, setF] = useState<Ficha>({ ...ficha, documentos: ficha.documentos ?? [] });
  const set = (p: Partial<Ficha>) => setF((x) => ({ ...x, ...p }));
  const foto = membro.user.avatarUrl || info.fotoUrl;
  const addDoc = () => set({ documentos: [...(f.documentos ?? []), { id: rid(), nome: '', url: '' }] });
  const updDoc = (id: string, p: Partial<{ nome: string; url: string }>) => set({ documentos: (f.documentos ?? []).map((d) => (d.id === id ? { ...d, ...p } : d)) });
  const delDoc = (id: string) => set({ documentos: (f.documentos ?? []).filter((d) => d.id !== id) });

  // Importa um documento (RG/CPF/CNH/comprovante/contrato) e a IA preenche a ficha.
  const docRef = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState(false);
  const importarFicha = async (file?: File) => {
    if (!file) return;
    setImp(true);
    try {
      const base64 = await fileToBase64(file);
      const p = await rhService.extrairFicha({ base64, mime: file.type, nomeArquivo: file.name });
      // Só preenche o que veio do documento; não apaga o que já estava.
      set({
        cpf: p.cpf || f.cpf,
        rg: p.rg || f.rg,
        nascimento: p.nascimento || f.nascimento,
        estadoCivil: p.estadoCivil || f.estadoCivil,
        endereco: p.endereco || f.endereco,
        telefone: p.telefone || f.telefone,
      });
      toast.success('Dados preenchidos do documento — confira e salve.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui extrair os dados do documento.');
    } finally {
      setImp(false);
      if (docRef.current) docRef.current.value = '';
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Ficha do colaborador</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            {foto ? <img src={foto} alt={membro.user.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7048E8] text-xl font-bold text-white">{ini(membro.user.name)}</div>}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-zinc-800 dark:text-zinc-100">{membro.user.name}</p>
              <p className="text-xs text-zinc-400">{cargo?.nome ?? roleLabel(membro.role)} · {membro.user.email}</p>
              {info.oab && <p className="text-xs text-zinc-400">OAB {info.oab}</p>}
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#7048E8]/25 bg-[#7048E8]/5 p-3 dark:bg-[#7048E8]/10">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">Tem RG, CPF, CNH, comprovante ou contrato? <strong>Importe e a IA preenche</strong> telefone, CPF, RG, nascimento, estado civil e endereço.</p>
              <input ref={docRef} type="file" accept=".pdf,.docx,image/*" className="hidden" onChange={(e) => importarFicha(e.target.files?.[0])} />
              <DropZone accept=".pdf,.docx,image/*" multiple={false} disabled={imp} onFiles={(fs) => importarFicha(fs[0])} className="inline-block shrink-0" overlayLabel="Soltar documento">
                <button type="button" onClick={() => docRef.current?.click()} disabled={imp} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0] disabled:opacity-60">{imp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Importar de documento</button>
              </DropZone>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><p className={LABEL}>Telefone</p><input value={f.telefone ?? ''} onChange={(e) => set({ telefone: e.target.value })} disabled={!canEdit} placeholder="(44) 99999-9999" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Nascimento</p><input value={f.nascimento ?? ''} onChange={(e) => set({ nascimento: e.target.value })} disabled={!canEdit} placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>CPF</p><input value={f.cpf ?? ''} onChange={(e) => set({ cpf: e.target.value })} disabled={!canEdit} placeholder="000.000.000-00" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>RG</p><input value={f.rg ?? ''} onChange={(e) => set({ rg: e.target.value })} disabled={!canEdit} className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Estado civil</p><input value={f.estadoCivil ?? ''} onChange={(e) => set({ estadoCivil: e.target.value })} disabled={!canEdit} className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Admissão / associação</p><input value={f.admissao ?? ''} onChange={(e) => set({ admissao: e.target.value })} disabled={!canEdit} placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
          </div>
          <div><p className={LABEL}>Endereço completo</p><input value={f.endereco ?? ''} onChange={(e) => set({ endereco: e.target.value })} disabled={!canEdit} placeholder="Rua, nº, bairro, cidade/UF, CEP" className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Contrato / cargo</p><input value={f.contrato ?? ''} onChange={(e) => set({ contrato: e.target.value })} disabled={!canEdit} placeholder="ex.: Advogado Associado (contrato de associação) — link do Drive" className={`${INPUT} mt-1`} /></div>
          <div>
            <div className="flex items-center justify-between"><p className={LABEL}>Documentos</p>{canEdit && <button onClick={addDoc} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar</button>}</div>
            <div className="mt-1 space-y-1.5">
              {(f.documentos ?? []).length === 0 && <p className="text-xs text-zinc-400">Nenhum documento. Cole os links do Drive (RG, CPF, contrato, comprovantes…).</p>}
              {(f.documentos ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <input value={d.nome} onChange={(e) => updDoc(d.id, { nome: e.target.value })} disabled={!canEdit} placeholder="Nome (ex.: RG)" className={`${INPUT} w-1/3`} />
                  <input value={d.url ?? ''} onChange={(e) => updDoc(d.id, { url: e.target.value })} disabled={!canEdit} placeholder="link do documento" className={`${INPUT} flex-1`} />
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-[#228BE6]"><ExternalLink className="h-4 w-4" /></a>}
                  {canEdit && <button onClick={() => delDoc(d.id)} className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
          </div>
          <div><p className={LABEL}>Observações internas de RH</p><textarea value={f.obs ?? ''} onChange={(e) => set({ obs: e.target.value })} disabled={!canEdit} rows={3} placeholder="Anotações, histórico, avaliações…" className={`${INPUT} mt-1`} /></div>
        </div>
        {canEdit && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <button onClick={onClose} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={() => onSave(f)} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6]"><Save className="h-4 w-4" /> Salvar ficha</button>
          </div>
        )}
      </div>
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
