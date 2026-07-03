'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserCircle, Target, Eye, Heart, Briefcase, BookOpen, ListChecks,
  Pencil, Plus, Trash2, Save, X, Loader2, ChevronDown, Lock,
  Compass, MessageSquare, CalendarClock, FolderKanban, Calculator, ShieldCheck,
  CheckCircle2, Circle, Sparkles,
  Scale, Trophy, CalendarDays, Quote, ZoomIn, ZoomOut, GraduationCap, UserPlus,
  CircleDollarSign, Clock, ClipboardList, TrendingUp, Wallet, Maximize2, Move, Camera, Layers, ArrowLeft, ScrollText,
  Building2, ArrowRight, Rocket, MapPin, Network, FileText, Upload, Landmark, ExternalLink,
} from 'lucide-react';
import { escritorioService, type Escritorio, type Cargo, type Cultura, type DocInstitucional, type Manual, type OnboardingItem, type PessoaInfo, type Vertical } from '@/features/escritorio/services/escritorio.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { MeuFinanceiroConteudo } from '@/features/financeiro/components/meu-financeiro-conteudo';
import { DropZone } from '@/components/drop-zone';
import { useAuthStore } from '@/stores/auth-store';

const rid = () => `c_${Math.round(Math.random() * 1e9)}`;
const EMPTY: Escritorio = { cultura: { missao: '', visao: '', valores: [], cultura: '' }, cargos: [], pessoas: {}, manuais: [], onboarding: [], canEdit: false };

// Módulos do Hub que dá pra liberar/bloquear por cargo (espelha APP_MODULES da API).
// Início e Escritório aparecem pra todos — não entram aqui.
const HUB_MODULES: { key: string; label: string }[] = [
  { key: 'atendimento', label: 'Comercial' },
  { key: 'automacoes', label: 'Automações' },
  { key: 'juridico', label: 'Jurídico' },
  { key: 'analise', label: 'Análise jurídica' },
  { key: 'calculos', label: 'Calculadoras' },
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
  const [tab, setTab] = useState<string>('perfil'); // aba ativa (só a ativa é renderizada)
  const [estruturaSub, setEstruturaSub] = useState<string>('organograma'); // subaba da Estrutura
  const [verComo, setVerComo] = useState<string | null>(null); // sócio monitorando o espaço de outra pessoa
  const alvoUserId = (verComo && data.canEdit) ? verComo : user?.id;
  // Financeiro pessoal (do usuário logado, ou de quem o sócio está monitorando).
  const { data: meuFin } = useQuery({ queryKey: ['meu-financeiro-perfil', alvoUserId], queryFn: () => financeiroService.meuFinanceiro(alvoUserId && alvoUserId !== user?.id ? alvoUserId : undefined), retry: false, staleTime: 60_000 });
  const [treeSig, setTreeSig] = useState({ n: 0, open: true });
  const [convite, setConvite] = useState(false); // modal "adicionar advogado"
  const [viewCargoId, setViewCargoId] = useState<string | null>(null); // detalhe do cargo (leitura)
  const [editCargoId, setEditCargoId] = useState<string | null>(null); // modal de cargo (org chart)
  const [perfilUserId, setPerfilUserId] = useState<string | null>(null); // modal de perfil de uma pessoa
  const saveM = useMutation({
    mutationFn: (d: Escritorio) => escritorioService.save(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escritorio'] }); toast.success('Escritório atualizado'); setEditing(false); setEditCargoId(null); setPerfilUserId(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao salvar'),
  });
  // Auto-edição: a própria pessoa salva campos pontuais do seu perfil (sem ser sócio).
  const saveMeuM = useMutation({
    mutationFn: (patch: Partial<PessoaInfo>) => escritorioService.saveMeuPerfil(patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escritorio'] }); toast.success('Perfil atualizado'); setPerfilUserId(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao salvar'),
  });
  // Renomear a pessoa (nome do usuário) — só sócio (endpoint é OWNER/ADMIN).
  const renameM = useMutation({
    mutationFn: ({ memberId, name }: { memberId: string; name: string }) => membersService.updateName(memberId, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-members'] }); qc.invalidateQueries({ queryKey: ['members'] }); toast.success('Nome atualizado'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao renomear'),
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
  const memberByUser = useMemo(() => Object.fromEntries(members.map((m) => [m.user.id, m])), [members]);
  const meuInfo = user?.id ? cur.pessoas?.[user.id] : undefined;
  const meuCargo = cargoById[meuInfo?.cargoId ?? ''];
  // Alvo do card "Meu Perfil": o próprio, ou quem o sócio está monitorando.
  const alvoInfo = alvoUserId ? cur.pessoas?.[alvoUserId] : undefined;
  const alvoCargo = cargoById[alvoInfo?.cargoId ?? ''];
  const alvoMember = alvoUserId ? memberByUser[alvoUserId] : undefined;
  const vendoOutro = !!(verComo && data.canEdit && verComo !== user?.id);
  // Caminho (ids dos ancestrais) até o meu cargo — o organograma já abre por aqui.
  const meuCaminho = useMemo(() => {
    const ids = new Set<string>();
    let c: Cargo | undefined = meuCargo; let g = 0;
    while (c && g++ < 30) { ids.add(c.id); c = cargoById[c.parentId ?? '']; }
    return ids;
  }, [meuCargo, cargoById]);

  // Salva uma alteração pontual (modais do organograma/perfil) mesclando em cima do salvo.
  const patchEscritorio = (mut: (d: Escritorio) => Escritorio) => saveM.mutate(mut(JSON.parse(JSON.stringify(data))));

  // Time real (esconde logins duplicados/Admin marcados como não-atribuíveis).
  const team = useMemo(() => members.filter((m) => m.assignable !== false), [members]);

  // Organograma: pessoas agrupadas por cargo (+ "sem cargo")
  const grupos = useMemo(() => {
    const byCargo = new Map<string, Member[]>();
    for (const m of team) {
      const cid = cur.pessoas?.[m.user.id]?.cargoId ?? '__sem__';
      (byCargo.get(cid) ?? byCargo.set(cid, []).get(cid)!).push(m);
    }
    return byCargo;
  }, [team, cur.pessoas]);

  if (isLoading) return <div className="flex h-full items-center justify-center text-sm text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="h-full overflow-y-auto bg-[#fafafa] px-4 py-6 lg:px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCircle className="h-6 w-6 text-[#7048E8]" />
            <div>
              <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Meu Espaço</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Seu perfil, seu financeiro, o organograma e a cultura — o seu lugar na Frider Andrade.</p>
            </div>
          </div>
          {data.canEdit && (
            editing ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /> Cancelar</button>
                <button onClick={() => saveM.mutate(draft)} disabled={saveM.isPending} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setConvite(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#7048E8] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#5f3dd0]"><UserPlus className="h-4 w-4" /> Adicionar advogado</button>
                <button onClick={startEdit} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /> Editar</button>
              </div>
            )
          )}
        </div>

        {/* Abas — só a ativa é renderizada */}
        <div className="sticky top-0 z-10 -mx-4 mb-3 mt-4 flex gap-1 overflow-x-auto border-b border-zinc-200/70 bg-[#fafafa]/95 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6 dark:border-zinc-800 dark:bg-zinc-950/95">
          {([['perfil', 'Meu Perfil', UserCircle], ['contrato', 'Meu Contrato', ScrollText], ['financeiro', 'Financeiro', CircleDollarSign], ['estrutura', 'Estrutura', Building2], ['manuais', 'Manuais', BookOpen], ['onboarding', 'Onboarding', ListChecks]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-[#7048E8] text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* Ver o espaço de outra pessoa — controle FIXO (vale em TODAS as abas: perfil
            e financeiro passam a mostrar exatamente o que ela vê no login dela). */}
        {data.canEdit && team.length > 1 && (
          <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${vendoOutro ? 'border-[#7048E8]/40 bg-[#7048E8]/5 dark:bg-[#7048E8]/10' : 'border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
            <span className="inline-flex items-center gap-1 text-zinc-500"><Eye className="h-4 w-4" /> Ver o espaço de:</span>
            <select value={verComo ?? user?.id ?? ''} onChange={(e) => setVerComo(e.target.value === user?.id ? null : e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              {team.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.id === user?.id ? `Você (${user?.name?.split(' ')[0] ?? 'meu espaço'})` : m.user.name}</option>)}
            </select>
            {vendoOutro ? (<>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#7048E8]/10 px-2 py-0.5 text-xs font-medium text-[#7048E8]"><Eye className="h-3.5 w-3.5" /> é exatamente isto que {alvoMember?.user.name?.split(' ')[0] ?? 'ela'} vê no login dela</span>
              <button onClick={() => setVerComo(null)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao meu espaço</button>
            </>) : (
              <span className="text-xs text-zinc-400">escolha uma pessoa para ver o perfil e o financeiro como ela vê</span>
            )}
          </div>
        )}

        {/* ─────────── ABA: MEU PERFIL (advogado + cargo + o que esperamos + escritório) ─────────── */}
        {tab === 'perfil' && (<>
        <PerfilHero
          nome={alvoMember?.user.name ?? user?.name ?? 'Você'}
          avatarUrl={alvoMember?.user.avatarUrl ?? null}
          info={alvoInfo}
          cargo={alvoCargo}
          fin={meuFin}
          canEdit={data.canEdit}
          proprio={!vendoOutro}
          onEdit={alvoUserId ? () => setPerfilUserId(alvoUserId) : undefined}
        />
        </>)}

        {/* ─────────── ABA: MEU CONTRATO (o cargo/contrato da pessoa, em texto claro) ─────────── */}
        {tab === 'contrato' && (
          <MeuContrato
            info={alvoInfo}
            cargo={alvoCargo}
            proprio={!vendoOutro}
            canEdit={data.canEdit}
            onEditCargo={data.canEdit && alvoCargo ? () => setEditCargoId(alvoCargo.id) : undefined}
            onEditPessoa={data.canEdit && alvoUserId ? () => setPerfilUserId(alvoUserId) : undefined}
          />
        )}

        {/* ─────────── ABA: FINANCEIRO (só renderiza ao clicar) ─────────── */}
        {tab === 'financeiro' && (<>
          {alvoInfo?.financeiro?.some((x) => x.includes('%')) && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3 dark:bg-[#02883C]/10">
              <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-[#02883C]" />
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {alvoInfo?.atuacao?.length ? <p>Você atua em <strong className="text-[#02883C]">{alvoInfo.atuacao.join(' · ')}</strong>.</p> : null}
                {/* Todas as regras de rateio (uma por vertical), não só a primeira. */}
                <ul className={alvoInfo?.atuacao?.length ? 'mt-1 space-y-0.5' : 'space-y-0.5'}>
                  {alvoInfo.financeiro.filter((x) => x.includes('%')).map((regra, i) => (
                    <li key={i} className="flex items-start gap-1.5"><span className="mt-0.5 text-[#02883C]">•</span><span>{regra}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {meuFin && !meuFin.vazio
            ? <MeuFinanceiroConteudo data={meuFin} criar={alvoUserId && meuFin.minhaArea ? { userId: alvoUserId, area: meuFin.minhaArea } : undefined} />
            : <div className={`${CARD} text-sm text-zinc-400`}>{meuFin ? 'Ainda não há lançamentos ou casos vinculados a você.' : 'Carregando seu financeiro…'}</div>}
        </>)}

        {/* ─────────── ABA: ESTRUTURA (subabas: organograma · carreira · verticais · escritório) ─────────── */}
        {tab === 'estrutura' && (<>
        <h2 className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Building2 className="h-4 w-4 text-[#f08c00]" /> Estrutura do escritório</h2>

        {/* Subabas da Estrutura */}
        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200/70 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {([['organograma', 'Organograma', Network], ['carreira', 'Carreira', Rocket], ['verticais', 'Verticais', Layers], ['escritorio', 'Escritório', Landmark]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setEstruturaSub(key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${estruturaSub === key ? 'bg-[#f08c00] text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* SUB: ORGANOGRAMA (+ edição de cargos, atribuição de cargo, aplicar acessos) */}
        {estruturaSub === 'organograma' && (<>
        {!editing ? (
          <>
            <div className={`${CARD} mt-3`}>
              {(cur.cargos ?? []).length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum cargo cadastrado ainda{data.canEdit ? ' — entre em Editar para montar a estrutura.' : '.'}</p>
              ) : (
                <OrgChart
                  cargos={cur.cargos ?? []}
                  grupos={grupos}
                  meuCargoId={meuCargo?.id}
                  abertos={meuCaminho}
                  sig={treeSig}
                  canEdit={data.canEdit}
                  onExpandAll={() => setTreeSig((s) => ({ n: s.n + 1, open: true }))}
                  onCollapseAll={() => setTreeSig((s) => ({ n: s.n + 1, open: false }))}
                  onOpenNode={(id) => setViewCargoId(id)}
                  onEditNode={data.canEdit ? (id) => setEditCargoId(id) : undefined}
                  onAddRoot={data.canEdit ? () => {
                    const id = rid();
                    patchEscritorio((d) => ({ ...d, cargos: [...(d.cargos ?? []), { id, nome: 'Novo cargo', descricao: '' }] }));
                  } : undefined}
                />
              )}
            </div>
            <CargosPorVertical cargos={cur.cargos ?? []} grupos={grupos} onOpen={(id) => setViewCargoId(id)} />
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-zinc-400">Dica: o jeito mais rápido de editar um cargo (com seleção, atribuições, financeiro e responsáveis) é pelo lápis no próprio organograma. Abaixo fica a edição simples da lista.</p>
            {(cur.cargos ?? []).map((cg, i) => (
              <div key={cg.id} className={CARD}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={cg.nome} onChange={(e) => updateCargo(setDraft, i, { nome: e.target.value })} placeholder="Nome do cargo" className={`${INPUT} font-semibold`} />
                    <button onClick={() => removeCargo(setDraft, i)} title="Remover cargo" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className={LABEL}>Cargo</p><input value={cg.vertical ?? ''} onChange={(e) => updateCargo(setDraft, i, { vertical: e.target.value })} placeholder="ex.: Advocacia, Sociedade, Back Office" className={`${INPUT} mt-1`} /></div>
                    <div><p className={LABEL}>Reporta a</p>
                      <select value={cg.parentId ?? ''} onChange={(e) => updateCargo(setDraft, i, { parentId: e.target.value || null })} className={`${INPUT} mt-1`}>
                        <option value="">— topo —</option>
                        {(draft.cargos ?? []).filter((x) => x.id !== cg.id).map((x) => <option key={x.id} value={x.id}>{x.nome || '(sem nome)'}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea value={cg.resumo ?? ''} onChange={(e) => updateCargo(setDraft, i, { resumo: e.target.value })} rows={2} placeholder="Resumo de 1 linha do cargo" className={INPUT} />
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
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setDraft((d) => ({ ...d, cargos: [...(d.cargos ?? []), { id: rid(), nome: '', descricao: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar cargo</button>
          </div>
        )}

        {/* Atribuir cargo a cada pessoa (edição) — define quem entra em cada caixa do organograma */}
        {editing && (
          <div className={`${CARD} mt-3`}>
            <p className={LABEL}>Definir o cargo de cada pessoa</p>
            <div className="mt-2 space-y-2">
              {team.map((m) => (
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
        </>)}

        {/* SUB: CARREIRA */}
        {estruturaSub === 'carreira' && (
          !editing
            ? <PlanoCarreira cargos={cur.cargos ?? []} meuCargoId={meuCargo?.id} onOpen={(id) => setViewCargoId(id)} />
            : <p className={`${CARD} mt-3 text-sm text-zinc-500`}>O plano de carreira é montado a partir dos cargos (trilha, duração e progressão de cada um). Edite esses campos no <strong>Organograma</strong> (lápis do cargo) e a carreira se atualiza sozinha.</p>
        )}

        {/* SUB: VERTICAIS */}
        {estruturaSub === 'verticais' && (<>
        <p className="mt-3 text-xs text-zinc-400">Cada área tem um titular e regras próprias de honorários — é assim que cada um sabe onde atua e como é remunerado por área.</p>
        <VerticaisSection verticais={cur.verticais ?? []} pessoas={cur.pessoas ?? {}} team={team} editing={editing} setDraft={setDraft} onVerPerfil={(uid) => setPerfilUserId(uid)} />
        </>)}

        {/* SUB: ESCRITÓRIO (institucional: manifesto/missão/visão/valores/cultura + documentos oficiais) */}
        {estruturaSub === 'escritorio' && (<>
        <CulturaTab cultura={cur.cultura} editing={editing} setCultura={setCultura} />
        <DocumentosInstitucionais documentos={cur.cultura.documentos ?? []} canEdit={data.canEdit} editing={editing} onSave={patchEscritorio} />
        </>)}
        </>)}

        {/* ─────────── ABA: MANUAIS ─────────── */}
        {tab === 'manuais' && (<>
        <h2 className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><BookOpen className="h-4 w-4 text-[#15AABF]" /> Manuais &amp; procedimentos</h2>
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
        </>)}

        {/* ─────────── ABA: ONBOARDING ─────────── */}
        {tab === 'onboarding' && (<>
        <h2 className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><ListChecks className="h-4 w-4 text-[#02883C]" /> Onboarding do novo integrante</h2>
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
        </>)}

        <div className="h-10" />
      </div>

      {/* Modal: detalhe do cargo (leitura, qualquer pessoa) */}
      {viewCargoId && (() => {
        const c = cargoById[viewCargoId];
        if (!c) return null;
        const pessoas = grupos.get(c.id) ?? [];
        return (
          <CargoDetalheModal
            cargo={c}
            pessoas={pessoas}
            canEdit={data.canEdit}
            onClose={() => setViewCargoId(null)}
            onEdit={() => { setViewCargoId(null); setEditCargoId(c.id); }}
            onVerPerfil={(uid) => { setViewCargoId(null); setPerfilUserId(uid); }}
          />
        );
      })()}

      {/* Modal: editar cargo + responsáveis (a partir do organograma) */}
      {editCargoId && (
        <CargoModal
          cargoId={editCargoId}
          data={data}
          members={team}
          saving={saveM.isPending}
          onClose={() => setEditCargoId(null)}
          onSave={patchEscritorio}
          onEditPerfil={(uid) => { setEditCargoId(null); setPerfilUserId(uid); }}
        />
      )}

      {/* Modal: editar perfil de uma pessoa */}
      {perfilUserId && (
        <PerfilModal
          userId={perfilUserId}
          nome={memberByUser[perfilUserId]?.user.name ?? 'Pessoa'}
          avatarUrl={memberByUser[perfilUserId]?.user.avatarUrl ?? null}
          data={data}
          cargoById={cargoById}
          saving={saveM.isPending || saveMeuM.isPending || renameM.isPending}
          selfMode={!data.canEdit && perfilUserId === user?.id}
          memberId={memberByUser[perfilUserId]?.id}
          onClose={() => setPerfilUserId(null)}
          onSave={patchEscritorio}
          onSaveSelf={(patch) => saveMeuM.mutate(patch)}
          onRename={(name) => { const mid = memberByUser[perfilUserId!]?.id; if (mid) renameM.mutate({ memberId: mid, name }); }}
        />
      )}

      {/* Modal: adicionar advogado (convite) */}
      {convite && <AdicionarAdvogadoModal onClose={() => setConvite(false)} onDone={() => { setConvite(false); qc.invalidateQueries({ queryKey: ['org-members'] }); }} />}
    </div>
  );
}

// Convida um novo advogado por e-mail (vira membro na hora se já tiver conta).
function AdicionarAdvogadoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const convidar = async () => {
    if (!email.trim()) { toast.error('Informe o e-mail'); return; }
    setSaving(true);
    try {
      const r: any = await membersService.invite({ email: email.trim(), role });
      onDone(); // já atualiza a lista de membros (o espaço aparece sozinho)
      if (r?.autoAccepted) { toast.success('Advogado adicionado! Agora abra o perfil dele e importe o contrato.'); onClose(); }
      else if (r?.token) { setLink(`${window.location.origin}/register?invite=${r.token}`); toast.success('Convite criado — mande o link pra ele.'); }
      else { toast.success('Convite enviado.'); onClose(); }
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui convidar'); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Adicionar advogado" onClose={onClose} footer={<div className="ml-auto flex gap-2"><button onClick={onClose} className={GHOST_BTN}>Fechar</button>{!link && <button onClick={convidar} disabled={saving} className={SAVE_BTN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Adicionar</button>}</div>}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">É o mesmo cadastro de <strong className="text-zinc-700 dark:text-zinc-200">Configurações › Membros</strong> — não precisa cadastrar duas vezes. Ao adicionar, o <strong className="text-zinc-700 dark:text-zinc-200">espaço dele já aparece</strong> aqui e no RH. Depois é só abrir o perfil e <strong className="text-zinc-700 dark:text-zinc-200">importar o contrato</strong> (a IA preenche OAB, datas, financeiro e áreas).</p>
      {!link ? (
        <>
          <div><p className={LABEL}>E-mail</p><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="advogado@exemplo.com" className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Perfil de acesso</p>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${INPUT} mt-1`}>
              <option value="AGENT">Associado (acesso comum)</option>
              <option value="ADMIN">Sócio / Admin (acesso total)</option>
            </select>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3 dark:bg-[#02883C]/10">
          <p className="text-xs font-semibold text-[#02883C]">Convite criado! Mande este link para {email}:</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input readOnly value={link} className={`${INPUT} text-xs`} onFocus={(e) => e.target.select()} />
            <button onClick={() => { navigator.clipboard?.writeText(link); toast.success('Link copiado'); }} className="shrink-0 rounded-lg bg-[#228BE6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6]">Copiar</button>
          </div>
        </div>
      )}
    </ModalShell>
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
const CONFETE_CSS = `@keyframes bullq-confete { 0% { transform: translateY(-12px) rotate(0deg); opacity: 1; } 100% { transform: translateY(360px) rotate(560deg); opacity: 0; } }`;
const CONFETE_CORES = ['#7048E8', '#228BE6', '#E64980', '#15AABF', '#F08C00', '#02883C'];
// Chuva de confete (sem lib): pedaços coloridos caindo, ~4s.
function Confete() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
      <style>{CONFETE_CSS}</style>
      {Array.from({ length: 70 }, (_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.7;
        const dur = 1.8 + Math.random() * 1.6;
        const size = 6 + Math.round(Math.random() * 6);
        return <span key={i} style={{ position: 'absolute', top: 0, left: `${left}%`, width: size, height: Math.round(size * 0.55), background: CONFETE_CORES[i % CONFETE_CORES.length], borderRadius: 2, animation: `bullq-confete ${dur}s ${delay}s ease-in forwards` }} />;
      })}
    </div>
  );
}

function OnboardingChecklist({ itens, userId }: { itens: OnboardingItem[]; userId?: string }) {
  const key = `bullq:onboarding:${userId ?? 'anon'}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [confete, setConfete] = useState(false);
  const [min, setMin] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setDone(new Set(JSON.parse(raw))); } catch { /* ignora */ }
  }, [key]);
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignora */ }
    // Só festeja quando ESTE toque completa a lista (não no load).
    if (itens.length > 0 && next.size === itens.length && done.size === itens.length - 1) {
      setConfete(true);
      setTimeout(() => { setConfete(false); setMin(true); }, 4200);
    }
  };
  if (itens.length === 0) return <p className="text-sm text-zinc-400">Sem checklist de onboarding ainda.</p>;
  const feitos = itens.filter((o) => done.has(o.id)).length;
  const pct = Math.round((feitos / itens.length) * 100);
  const completo = feitos === itens.length;
  return (
    <div className="relative">
      {confete && <Confete />}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-[#02883C] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-zinc-500">{feitos}/{itens.length}</span>
        {completo && <button onClick={() => setMin((m) => !m)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">{min ? 'mostrar' : 'minimizar'}</button>}
      </div>
      {completo && <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-[#02883C]/10 px-3 py-2 text-sm font-medium text-[#02883C]"><Sparkles className="h-4 w-4" /> Onboarding completo! Bem-vindo(a) ao time. 🎉</p>}
      {!min && (
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
      )}
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
.org-tree li:only-child { padding-top:0; }
.org-tree li:first-child::before, .org-tree li:last-child::after { border:0 none; }
.org-tree li:last-child::before { border-right:2px solid currentColor; border-radius:0 8px 0 0; }
.org-tree li:first-child::after { border-radius:8px 0 0 0; }
.org-tree li > ul::before { content:''; position:absolute; top:0; left:50%; width:0; height:24px; border-left:2px solid currentColor; }
`;

type OrgShared = { cargos: Cargo[]; grupos: Map<string, Member[]>; meuCargoId?: string; abertos?: Set<string>; sig: { n: number; open: boolean }; canEdit?: boolean; onEditNode?: (id: string) => void; onOpenNode?: (id: string) => void };

// Organograma top-down: raiz no topo, ramifica pra baixo com conectores coloridos por ramo.
function OrgChart({ cargos, grupos, meuCargoId, abertos, sig, canEdit, onEditNode, onOpenNode, onExpandAll, onCollapseAll, onAddRoot }: OrgShared & { onExpandAll: () => void; onCollapseAll: () => void; onAddRoot?: () => void }) {
  const byId = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c])), [cargos]);
  const roots = useMemo(() => cargos.filter((c) => !c.parentId || !byId[c.parentId]), [cargos, byId]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const clamp = (v: number) => Math.min(1.5, Math.max(0.3, +v.toFixed(2)));
  const z = (v: number) => setZoom(clamp(v));
  // "Ajustar à tela": encolhe/aumenta para a árvore caber na largura visível.
  const fit = () => {
    const vp = viewportRef.current; if (!vp) return;
    const ratio = (vp.clientWidth - 16) / Math.max(1, vp.scrollWidth);
    setZoom((z0) => clamp(z0 * ratio));
  };
  const fittedRef = useRef(false);
  useEffect(() => { if (!fittedRef.current) { fittedRef.current = true; const id = setTimeout(fit, 80); return () => clearTimeout(id); } });
  // Arrastar para navegar (pan), sem atrapalhar o clique nos cards.
  const pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-orgcard],button')) return;
    const vp = viewportRef.current; if (!vp) return;
    pan.current = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop };
    try { vp.setPointerCapture(e.pointerId); } catch { /* ok */ }
  };
  const move = (e: React.PointerEvent) => {
    const vp = viewportRef.current; if (!vp || !pan.current) return;
    vp.scrollLeft = pan.current.l - (e.clientX - pan.current.x);
    vp.scrollTop = pan.current.t - (e.clientY - pan.current.y);
  };
  const up = () => { pan.current = null; };
  const btn = 'flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-zinc-400"><Move className="h-3.5 w-3.5" /> Arraste para mover · clique num cargo para ver os detalhes{canEdit ? ' · lápis para editar' : ''}.</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => z(zoom - 0.1)} className={btn} title="Diminuir"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={() => z(zoom + 0.1)} className={btn} title="Aumentar"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={fit} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" title="Ajustar à tela"><Maximize2 className="h-3.5 w-3.5" /> Ajustar</button>
          <span className="mx-0.5 text-zinc-300">·</span>
          <button onClick={onExpandAll} className="font-medium text-[#228BE6] hover:underline">Expandir</button>
          <span className="text-zinc-300">·</span>
          <button onClick={onCollapseAll} className="font-medium text-zinc-500 hover:underline">Recolher</button>
        </div>
      </div>
      <div
        ref={viewportRef}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="max-h-[78vh] cursor-grab select-none overflow-auto rounded-xl border border-zinc-100 bg-zinc-50/40 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <style>{ORG_CSS}</style>
        <div className="flex min-w-max flex-col items-center gap-10 px-8 py-7" style={{ zoom } as React.CSSProperties}>
          {roots.map((r) => (
            <ul key={r.id} className="org-tree" style={{ color: ROOT_COLOR }}>
              <OrgNodeTop cargo={r} depth={0} color={ROOT_COLOR} shared={{ cargos, grupos, meuCargoId, abertos, sig, canEdit, onEditNode, onOpenNode }} />
            </ul>
          ))}
        </div>
      </div>
      {canEdit && onAddRoot && (
        <button onClick={onAddRoot} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-3.5 w-3.5" /> Adicionar cargo no topo</button>
      )}
    </div>
  );
}

function OrgNodeTop({ cargo, depth, color, shared }: { cargo: Cargo; depth: number; color: string; shared: OrgShared }) {
  const { cargos, grupos, meuCargoId, abertos, sig, canEdit, onEditNode, onOpenNode } = shared;
  const children = useMemo(() => cargos.filter((c) => c.parentId === cargo.id), [cargos, cargo.id]);
  const people = grupos.get(cargo.id) ?? [];
  const isMine = cargo.id === meuCargoId;
  const hasChildren = children.length > 0;
  // Começa recolhido abaixo da raiz (mostra raiz + verticais) — evita árvore larga demais.
  const [collapsed, setCollapsed] = useState(depth >= 1 && !abertos?.has(cargo.id));
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
      <div className="group relative z-[1]">
        <div
          data-orgcard
          onClick={() => onOpenNode?.(cargo.id)}
          title={tip || 'Ver detalhes do cargo'}
          className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 font-semibold shadow-sm transition hover:-translate-y-px hover:shadow-md ${depth === 0 ? 'text-base' : 'text-[13px]'} ${cardCls} ${isMine ? 'ring-2 ring-offset-2 ring-[#7048E8] dark:ring-offset-zinc-900' : ''}`}
          style={cardStyle}
        >
          {depth >= 2 && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
          <span>{cargo.nome || 'Cargo'}</span>
          {isMine && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${depth === 1 ? 'bg-white/25 text-white' : 'bg-[#7048E8] text-white'}`}>você</span>}
          {people.length > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${countCls}`}>{people.length}</span>}
          {hasChildren && (
            <button onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }} title={collapsed ? 'Abrir ramo' : 'Recolher ramo'} className="-mr-1.5 ml-0.5 rounded p-0.5 hover:bg-black/10">
              <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          )}
        </div>
        {canEdit && onEditNode && (
          <button onClick={(e) => { e.stopPropagation(); onEditNode(cargo.id); }} title="Editar cargo e responsáveis" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><Pencil className="h-3 w-3" /></button>
        )}
      </div>
      {hasChildren && !collapsed && (
        <ul style={{ color }}>
          {children.map((ch, i) => (
            <OrgNodeTop key={ch.id} cargo={ch} depth={depth + 1} color={depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : color} shared={shared} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Seção de Verticais (áreas de atuação): cards com titular, regra de honorários e quem atua.
function VerticaisSection({ verticais, pessoas, team, editing, setDraft, onVerPerfil }: { verticais: Vertical[]; pessoas: Record<string, PessoaInfo>; team: Member[]; editing: boolean; setDraft: (f: (d: Escritorio) => Escritorio) => void; onVerPerfil: (uid: string) => void }) {
  const upd = (i: number, patch: Partial<Vertical>) => setDraft((d) => ({ ...d, verticais: (d.verticais ?? []).map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const del = (i: number) => setDraft((d) => ({ ...d, verticais: (d.verticais ?? []).filter((_, j) => j !== i) }));
  if (editing) {
    return (
      <div className="mt-2 space-y-3">
        {verticais.map((v, i) => (
          <div key={v.id} className={CARD}>
            <div className="flex items-center gap-2">
              <input value={v.nome} onChange={(e) => upd(i, { nome: e.target.value })} placeholder="Nome da vertical (ex.: Previdenciário)" className={`${INPUT} font-semibold`} />
              <button onClick={() => del(i)} className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={v.titular ?? ''} onChange={(e) => upd(i, { titular: e.target.value })} placeholder="Titular (ex.: Sócio / Julia)" className={INPUT} />
              <input value={v.regra ?? ''} onChange={(e) => upd(i, { regra: e.target.value })} placeholder="Honorários (ex.: 60% sócia / 40% escritório)" className={INPUT} />
            </div>
            <textarea value={v.descricao ?? ''} onChange={(e) => upd(i, { descricao: e.target.value })} rows={2} placeholder="Como funciona / o que é a área" className={`${INPUT} mt-2`} />
          </div>
        ))}
        <button onClick={() => setDraft((d) => ({ ...d, verticais: [...(d.verticais ?? []), { id: rid(), nome: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-4 w-4" /> Adicionar vertical</button>
      </div>
    );
  }
  if (verticais.length === 0) return <p className="mt-2 text-sm text-zinc-400">Nenhuma vertical cadastrada ainda.</p>;
  return (
    <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
      {verticais.map((v, i) => {
        const cor = BRANCH_COLORS[i % BRANCH_COLORS.length];
        const gente = team.filter((m) => (pessoas[m.user.id]?.atuacao ?? []).some((a) => a.toLowerCase() === v.nome.toLowerCase()));
        return (
          <div key={v.id} className="rounded-xl border border-zinc-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900" style={{ borderLeftColor: cor, borderLeftWidth: 4 }}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-bold text-zinc-800 dark:text-zinc-100">{v.nome}</span>
              {v.titular && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: cor }}>{v.titular}</span>}
            </div>
            {v.descricao && <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{v.descricao}</p>}
            {v.regra && <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded bg-[#02883C]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#02883C]"><CircleDollarSign className="h-3 w-3" /> {v.regra}</p>}
            {gente.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gente.map((m) => (
                  <button key={m.user.id} onClick={() => onVerPerfil(m.user.id)} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    <PessoaAvatar nome={m.user.name} foto={m.user.avatarUrl || pessoas?.[m.user.id]?.fotoUrl} size={20} bg={cor} className="text-[8px]" />{m.user.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function iniciaisDe(n?: string | null) { return (n ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

// Avatar da pessoa: foto se houver, senão o círculo com iniciais (fallback).
// `size` em px; `bg` é a cor do círculo de iniciais; `className` preserva rings/etc do local.
function PessoaAvatar({ nome, foto, size, bg, className = '', title }: { nome?: string | null; foto?: string | null; size: number; bg?: string; className?: string; title?: string }) {
  const dim = { width: size, height: size };
  if (foto) return <img src={foto} alt={nome ?? ''} title={title} style={dim} className={`shrink-0 rounded-full object-cover ${className}`} />;
  return <span title={title} style={{ ...dim, background: bg }} className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}>{iniciaisDe(nome)}</span>;
}

// Flexiona termos no feminino (cargo/descrição) quando a pessoa é mulher.
function feminizar(s: string): string {
  return s
    .replace(/Advogados/g, 'Advogadas').replace(/advogados/g, 'advogadas')
    .replace(/Advogado/g, 'Advogada').replace(/advogado/g, 'advogada')
    .replace(/Sócios/g, 'Sócias').replace(/sócios/g, 'sócias')
    .replace(/Sócio/g, 'Sócia').replace(/sócio/g, 'sócia')
    .replace(/Associados/g, 'Associadas').replace(/associados/g, 'associadas')
    .replace(/Associado/g, 'Associada').replace(/associado/g, 'associada')
    .replace(/Estagiários/g, 'Estagiárias').replace(/estagiários/g, 'estagiárias')
    .replace(/Estagiário/g, 'Estagiária').replace(/estagiário/g, 'estagiária')
    .replace(/\bDonos\b/g, 'Donas').replace(/\bdonos\b/g, 'donas').replace(/\bDono\b/g, 'Dona').replace(/\bdono\b/g, 'dona')
    .replace(/contratado/g, 'contratada').replace(/fundador\b/g, 'fundadora').replace(/administrador\b/g, 'administradora')
    .replace(/bem-vindo/g, 'bem-vinda').replace(/Bem-vindo/g, 'Bem-vinda');
}
const gen = (s: string | undefined, sexo?: 'F' | 'M') => (sexo === 'F' && s ? feminizar(s) : s);

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

const FRASES_ORGULHO = [
  'Orgulhe-se: cada caso seu é uma vida que muda — e um pedaço da história que a gente constrói juntos. 💜',
  'Você não faz "mais um processo". Você devolve sono, dignidade e esperança. Isso é grande.',
  'O que você constrói aqui leva o seu nome. Faça com alma — dá pra ter orgulho todo dia.',
  'A gente cresce junto: quando você entrega o seu melhor, o time inteiro sobe com você.',
  'Alguém vai dormir tranquilo hoje por causa do seu trabalho. Isso é motivo de orgulho.',
  'Aqui ninguém te segura: entregou, cresce. O seu futuro tem o tamanho da sua vontade.',
];

// Perfil rico do profissional logado (foto, função, datas, expectativa, métricas, financeiro, motivação).
function PerfilHero({ nome, avatarUrl, info, cargo, fin, canEdit, proprio = true, onEdit }: { nome: string; avatarUrl: string | null; info?: PessoaInfo; cargo?: Cargo; fin?: any; canEdit?: boolean; proprio?: boolean; onEdit?: () => void }) {
  const sexo = info?.sexo;
  const foto = avatarUrl || info?.fotoUrl;
  const r = fin && !fin.vazio ? fin.resumo : undefined;
  const proj = fin && !fin.vazio ? fin.projecaoCasos : undefined;
  const cs = fin && !fin.vazio ? fin.cs : undefined;
  const totalAEntrar = r ? (r.aReceber || 0) + (r.minhaParte || 0) + (cs?.prestacao || 0) + (cs?.cumprimentoNosso || 0) : 0;
  const carteira = proj?.brutoEmProcesso ?? 0; // valor bruto em processo = tamanho da carteira
  const casosN = r?.nCasos ?? info?.casos;
  const vidasN = info?.vidas ?? r?.nClientes;
  const metricas = ([
    { icon: Scale, label: 'Casos que você cuida', valor: casosN, money: false, cor: '#7048E8' },
    { icon: Heart, label: 'Vidas impactadas', valor: vidasN, money: false, cor: '#E64980' },
    { icon: Briefcase, label: 'Valor da carteira', valor: carteira, money: true, cor: '#F08C00' },
    { icon: CircleDollarSign, label: 'A entrar', valor: totalAEntrar, money: true, cor: '#02883C' },
  ] as const).filter((m) => (m.money ? (m.valor as number) > 0 : typeof m.valor === 'number'));
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#7048E8]/25 bg-gradient-to-br from-[#7048E8]/10 via-white to-[#228BE6]/5 dark:border-[#7048E8]/30 dark:from-[#7048E8]/15 dark:via-zinc-900 dark:to-zinc-900">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="shrink-0">
          {foto ? (
            <img src={foto} alt={nome} className="h-28 w-28 rounded-full object-cover shadow-md ring-4 ring-white dark:ring-zinc-800" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#7048E8] text-3xl font-bold text-white shadow-md ring-4 ring-white dark:ring-zinc-800">{iniciaisDe(nome)}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7048E8]">{proprio ? 'Seu espaço' : 'Espaço do time'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{nome}</h2>
            {cargo && <span className="rounded-full bg-[#7048E8] px-2.5 py-0.5 text-xs font-semibold text-white">{gen(cargo.nome, sexo)}</span>}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            {info?.oab && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#7048E8]" /> OAB {info.oab}</span>}
            {info?.conoscoDesde && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /> Conosco desde {info.conoscoDesde}</span>}
            {cargo?.vertical && <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 shrink-0 text-[#15AABF]" /> Cargo: {cargo.vertical}</span>}
            {(info?.atuacao?.length ?? 0) > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 shrink-0 text-[#02883C]" /> Verticais:
                {info!.atuacao!.map((v) => (
                  <Link key={v} href={`/financeiro?vertical=${encodeURIComponent(v)}`} title={`Ver o financeiro da vertical ${v}`} className="rounded-full bg-[#02883C]/10 px-2 py-0.5 text-[11px] font-medium text-[#0b7a37] transition hover:bg-[#02883C]/20 dark:bg-[#02883C]/20 dark:text-[#69db7c]">{v}</Link>
                ))}
              </span>
            )}
          </div>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Pencil className="h-4 w-4" /> {proprio ? 'Editar meu perfil' : 'Editar perfil'}</button>
        )}
      </div>
      <div className="space-y-3 px-5 pb-5">
        {cargo?.descricao && (
          <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#228BE6]"><Target className="h-3.5 w-3.5" /> O que esperamos de você</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{gen(cargo.descricao, sexo)}</p>
          </div>
        )}
        {metricas.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metricas.map((m) => (
              <div key={m.label} className="rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${m.cor}1A`, color: m.cor }}><m.icon className="h-4 w-4" /></span>
                <p className="mt-2 text-xl font-extrabold text-zinc-800 dark:text-zinc-100">{m.money ? brl(m.valor as number) : m.valor}</p>
                <p className="text-[11px] font-medium leading-tight text-zinc-500">{m.label}</p>
              </div>
            ))}
          </div>
        )}
        {r && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Já recebido <strong className="text-zinc-700 dark:text-zinc-200">{brl(r.recebido)}</strong>{typeof proj?.liquidoProvavel === 'number' && proj.liquidoProvavel > 0 ? <> · sua parte provável na carteira <strong className="text-zinc-700 dark:text-zinc-200">{brl(proj.liquidoProvavel)}</strong></> : null} · veja tudo na aba <strong className="text-[#02883C]">Financeiro</strong>.</p>
        )}
        {(info?.financeiro?.length || cargo?.honorarios?.length || cargo?.remuneracao?.length || cargo?.divisaoHonorarios) && (
          <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500"><Wallet className="h-3.5 w-3.5" /> Como você é remunerado</p>
            <div className="mt-2 space-y-2.5">
              <SecaoLista icon={Wallet} titulo="Pelo seu contrato" itens={info?.financeiro} cor="#02883C" />
              {!info?.financeiro?.length && <SecaoLista icon={Wallet} titulo="Salário / bolsa & benefícios" itens={cargo?.remuneracao} cor="#02883C" />}
              {!info?.financeiro?.length && <SecaoLista icon={CircleDollarSign} titulo="Honorários (modelo do cargo)" itens={cargo?.honorarios} cor="#02883C" />}
              {cargo?.divisaoHonorarios && !info?.financeiro?.length && <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold text-zinc-700 dark:text-zinc-200">Divisão:</span> {cargo.divisaoHonorarios}</p>}
            </div>
          </div>
        )}
        {info?.destaque && (
          <div className="flex items-start gap-2 rounded-xl border border-[#F08C00]/30 bg-[#F08C00]/10 p-3.5 text-sm text-[#9a5b00] dark:text-[#F0B860]"><Trophy className="mt-0.5 h-4 w-4 shrink-0" /> <p className="font-medium">{info.destaque}</p></div>
        )}
        {info?.frase && <p className="flex items-start gap-2 text-sm italic text-zinc-500 dark:text-zinc-400"><Quote className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" /> {info.frase}</p>}
        {info?.bio && <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{info.bio}</p>}
        <div className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-[#7048E8]/12 to-[#228BE6]/10 p-3.5 dark:from-[#7048E8]/20 dark:to-[#228BE6]/10">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7048E8]" />
          <p className="text-sm font-semibold leading-relaxed text-[#5f3dd0] dark:text-[#b9a3f5]">{FRASES_ORGULHO[new Date().getDate() % FRASES_ORGULHO.length]}</p>
        </div>
        {!cargo && <p className="text-sm text-zinc-500">Seu cargo ainda não foi definido. {canEdit ? 'Defina no organograma.' : 'Peça a um sócio.'}</p>}
      </div>
    </div>
  );
}

// Aba "Meu Contrato": o cargo/contrato da pessoa em texto claro — o que esperamos dela,
// o que ela faz (atribuições), o que é exigido, jornada/carreira e as condições do contrato.
// Reaproveita os dados do Cargo + as condições pessoais de PessoaInfo (do contrato dela).
function MeuContrato({ info, cargo, proprio = true, canEdit, onEditCargo, onEditPessoa }: { info?: PessoaInfo; cargo?: Cargo; proprio?: boolean; canEdit?: boolean; onEditCargo?: () => void; onEditPessoa?: () => void }) {
  const sexo = info?.sexo;
  const g = (s?: string) => gen(s, sexo) ?? '';
  const temContrato = !!(info?.financeiro?.length || cargo?.remuneracao?.length || cargo?.honorarios?.length || cargo?.custoFirma || cargo?.divisaoHonorarios);
  const [verContrato, setVerContrato] = useState(false);
  if (!cargo) {
    return (
      <div className={`${CARD} mt-2 text-sm text-zinc-500 dark:text-zinc-400`}>
        {proprio ? 'Seu cargo ainda não foi definido, então o contrato ainda não aparece aqui. ' : 'O cargo desta pessoa ainda não foi definido. '}
        {canEdit ? 'Defina o cargo pelo organograma (aba Cargos).' : 'Peça a um sócio para definir o seu cargo.'}
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-3">
      {/* Cabeçalho do contrato: cargo, trilha, resumo e dados do vínculo */}
      <div className="overflow-hidden rounded-2xl border border-[#7048E8]/25 bg-gradient-to-br from-[#7048E8]/10 via-white to-[#228BE6]/5 p-5 dark:border-[#7048E8]/30 dark:from-[#7048E8]/15 dark:via-zinc-900 dark:to-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7048E8]">{proprio ? 'Seu contrato & cargo' : 'Contrato & cargo'}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{g(cargo.nome) || 'Cargo'}</h2>
              {cargo.vertical && <span className="rounded-full bg-[#7048E8] px-2.5 py-0.5 text-xs font-semibold text-white">{cargo.vertical}</span>}
            </div>
            {cargo.resumo && <p className="mt-1.5 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{g(cargo.resumo)}</p>}
          </div>
          {(onEditPessoa || onEditCargo) && (
            <div className="flex shrink-0 flex-col items-stretch gap-1.5">
              {onEditPessoa && <button onClick={onEditPessoa} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Pencil className="h-3.5 w-3.5" /> Editar condições</button>}
              {onEditCargo && <button onClick={onEditCargo} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Briefcase className="h-3.5 w-3.5" /> Editar cargo</button>}
            </div>
          )}
        </div>
        {(info?.oab || info?.conoscoDesde || info?.contratadaDesde || (info?.atuacao?.length ?? 0) > 0) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {info?.oab && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#7048E8]" /> OAB {info.oab}</span>}
            {info?.conoscoDesde && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /> Conosco desde {info.conoscoDesde}</span>}
            {info?.contratadaDesde && !info?.conoscoDesde && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /> Contratad{sexo === 'F' ? 'a' : 'o'} desde {info.contratadaDesde}</span>}
            {(info?.atuacao?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 shrink-0 text-[#02883C]" /> Verticais: {info!.atuacao!.join(' · ')}</span>
            )}
          </div>
        )}
      </div>

      {/* Contrato assinado (PDF) — a pessoa visualiza o que o sócio subiu */}
      {info?.contratoUrl && (
        <div className="overflow-hidden rounded-2xl border border-[#02883C]/25 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#02883C]/10 text-[#02883C]"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{proprio ? 'Seu contrato assinado' : 'Contrato assinado'}</p>
              <p className="truncate text-xs text-zinc-400">{info.contratoNome || 'documento em PDF'}</p>
            </div>
            <button onClick={() => setVerContrato((v) => !v)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#228BE6] hover:bg-[#228BE6]/10">{verContrato ? 'Fechar' : 'Visualizar'}</button>
            <a href={info.contratoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
          </div>
          {verContrato && <iframe src={info.contratoUrl} title="Contrato assinado" className="h-[70vh] w-full border-t border-zinc-100 dark:border-zinc-800" />}
        </div>
      )}

      {/* O que esperamos de você (descrição do cargo) */}
      {cargo.descricao && cargo.descricao !== cargo.resumo && (
        <div className={CARD}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#228BE6]"><Target className="h-3.5 w-3.5" /> O que esperamos de {proprio ? 'você' : 'quem está aqui'}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{g(cargo.descricao)}</p>
        </div>
      )}

      {/* Atribuições (o que faz) + o que é exigido (como se entra) */}
      {((cargo.atribuicoes?.length ?? 0) > 0 || (cargo.selecao?.length ?? 0) > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(cargo.atribuicoes?.length ?? 0) > 0 && (
            <div className={CARD}><SecaoLista icon={ListChecks} titulo={proprio ? 'Suas atribuições — o que você faz' : 'Atribuições — o que faz'} itens={cargo.atribuicoes} cor="#7048E8" /></div>
          )}
          {(cargo.selecao?.length ?? 0) > 0 && (
            <div className={CARD}><SecaoLista icon={ClipboardList} titulo="O que é exigido para o cargo" itens={cargo.selecao} cor="#228BE6" /></div>
          )}
        </div>
      )}

      {/* Jornada e carreira */}
      {(cargo.horario || cargo.duracao || cargo.progride) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {cargo.horario && <Mini icon={Clock} label="Horário" valor={cargo.horario} />}
          {cargo.duracao && <Mini icon={CalendarDays} label="Duração no cargo" valor={cargo.duracao} />}
          {cargo.progride && <Mini icon={TrendingUp} label="Carreira" valor={cargo.progride} />}
        </div>
      )}

      {/* Condições do contrato (financeiro pessoal; senão, o modelo do cargo) */}
      {temContrato && (
        <div className="rounded-2xl border border-[#02883C]/25 bg-[#02883C]/5 p-5 dark:border-[#02883C]/30 dark:bg-[#02883C]/10">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#02883C]"><CircleDollarSign className="h-3.5 w-3.5" /> {proprio ? 'Condições do seu contrato' : 'Condições do contrato'}</p>
          <div className="mt-2.5 space-y-3">
            {info?.financeiro?.length ? (
              <SecaoLista icon={Wallet} titulo="Pelo seu contrato" itens={info.financeiro} cor="#02883C" />
            ) : (
              <>
                <SecaoLista icon={Wallet} titulo="Salário / bolsa & benefícios" itens={cargo.remuneracao} cor="#02883C" />
                <SecaoLista icon={CircleDollarSign} titulo="Honorários (modelo do cargo)" itens={cargo.honorarios} cor="#02883C" />
                {cargo.divisaoHonorarios && <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold text-zinc-700 dark:text-zinc-200">Divisão:</span> {cargo.divisaoHonorarios}</p>}
                {cargo.custoFirma && <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold text-zinc-700 dark:text-zinc-200">Custo da firma:</span> {cargo.custoFirma}</p>}
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Os valores e o acompanhamento do que {proprio ? 'você tem' : 'há'} a receber ficam na aba <strong className="text-[#02883C]">Financeiro</strong>.</p>
        </div>
      )}
    </div>
  );
}

// Ordena os cargos de uma trilha por senioridade (do 1º degrau ao topo) por palavra-chave.
const SENIORIDADE = ['estag', 'trainee', 'aprendiz', 'júnior', 'junior', ' jr', 'pleno', 'sênior', 'senior', ' sr', 'master', 'coordena', 'gerente', 'nominal', 'diretor', 'nominal'];
function rankSenioridade(nome: string): number {
  const n = ` ${nome.toLowerCase()} `;
  for (let i = SENIORIDADE.length - 1; i >= 0; i--) if (n.includes(SENIORIDADE[i])) return i;
  return 500; // sem palavra-chave → mantém a ordem relativa (sort estável)
}

// Plano de carreira: cada trilha (cargo.vertical) vira um caminho de degraus, do início
// ao topo, com "você está aqui" e para onde dá pra crescer. Clicar abre o detalhe do cargo.
function PlanoCarreira({ cargos, meuCargoId, onOpen }: { cargos: Cargo[]; meuCargoId?: string; onOpen: (id: string) => void }) {
  const trilhas: { nome: string; itens: Cargo[] }[] = [];
  for (const c of cargos) {
    if (!c.vertical || c.nome === c.vertical) continue; // ignora o cargo "cabeça de trilha"
    let t = trilhas.find((x) => x.nome === c.vertical);
    if (!t) { t = { nome: c.vertical, itens: [] }; trilhas.push(t); }
    t.itens.push(c);
  }
  for (const t of trilhas) t.itens.sort((a, b) => rankSenioridade(a.nome) - rankSenioridade(b.nome));
  if (!trilhas.length) return null;
  return (
    <div className="mt-7">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Rocket className="h-4 w-4 text-[#7048E8]" /> Plano de carreira</h3>
      <p className="mt-1 text-xs text-zinc-400">Aqui se cresce por mérito — do primeiro degrau ao topo de cada trilha.{meuCargoId ? ' O seu cargo está destacado.' : ''} Toque num degrau para ver o que se faz e o que é exigido.</p>
      <div className="mt-3 space-y-3">
        {trilhas.map((t, ti) => {
          const cor = BRANCH_COLORS[ti % BRANCH_COLORS.length];
          return (
            <div key={t.nome} className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: cor }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} /> {t.nome}</p>
              <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
                {t.itens.map((c, i) => {
                  const isMine = c.id === meuCargoId;
                  const sub = c.duracao || c.progride || c.resumo;
                  return (
                    <div key={c.id} className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => onOpen(c.id)} title={c.resumo || c.descricao || 'Ver detalhes'} className={`flex min-w-[128px] max-w-[180px] flex-col rounded-xl border px-3 py-2 text-left transition hover:-translate-y-px hover:shadow-md ${isMine ? 'text-white shadow-sm' : 'bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`} style={isMine ? { background: cor, borderColor: cor } : { borderColor: `${cor}66` }}>
                        <span className="flex items-center gap-1.5 text-[13px] font-bold leading-tight">{c.nome}{isMine && <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">você</span>}</span>
                        {sub && <span className={`mt-0.5 line-clamp-2 text-[10px] leading-snug ${isMine ? 'text-white/85' : 'text-zinc-400'}`}>{sub}</span>}
                      </button>
                      {i < t.itens.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Aba Cultura: manifesto (quem somos / o que queremos), missão/visão, valores em cards,
// como é a rotina e como trabalhamos — rica e visual; editável pelos sócios (Editar geral).
function CulturaTab({ cultura, editing, setCultura }: { cultura: Cultura; editing: boolean; setCultura: (p: Partial<Cultura>) => void }) {
  if (editing) {
    return (
      <div className="mt-2 space-y-3">
        <div className={CARD}><p className={LABEL}>Manifesto — quem somos / o que queremos (1–2 frases fortes)</p><textarea value={cultura.manifesto ?? ''} onChange={(e) => setCultura({ manifesto: e.target.value })} rows={2} className={`${INPUT} mt-1`} placeholder="ex.: A gente existe pra devolver dignidade a quem foi lesado — com excelência e alma." /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={CARD}><p className={LABEL}>Missão</p><textarea value={cultura.missao} onChange={(e) => setCultura({ missao: e.target.value })} rows={3} className={`${INPUT} mt-1`} placeholder="Nossa missão…" /></div>
          <div className={CARD}><p className={LABEL}>Visão</p><textarea value={cultura.visao} onChange={(e) => setCultura({ visao: e.target.value })} rows={3} className={`${INPUT} mt-1`} placeholder="Nossa visão…" /></div>
        </div>
        <div className={CARD}><p className={LABEL}>Valores — um por linha, no formato "Título — descrição"</p><textarea value={(cultura.valores ?? []).join('\n')} onChange={(e) => setCultura({ valores: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={5} className={`${INPUT} mt-1`} placeholder={'Excelência — aqui não se faz mais ou menos; se faz bem feito\nCliente em primeiro lugar — atrás de cada processo tem uma vida'} /></div>
        <div className={CARD}><p className={LABEL}>Como é a rotina aqui — um item por linha</p><textarea value={cultura.rotina ?? ''} onChange={(e) => setCultura({ rotina: e.target.value })} rows={5} className={`${INPUT} mt-1`} placeholder={'O dia começa com um alinhamento rápido do que é prioridade\nCada um é dono da sua vertical e toca com autonomia\nSexta é dia de olhar os números e comemorar as entregas'} /></div>
        <div className={CARD}><p className={LABEL}>Como trabalhamos / princípios (texto livre)</p><textarea value={cultura.cultura} onChange={(e) => setCultura({ cultura: e.target.value })} rows={4} className={`${INPUT} mt-1`} placeholder="O jeito da casa, princípios do dia a dia…" /></div>
      </div>
    );
  }
  const valores = (cultura.valores ?? []).map((v) => {
    const m = v.match(/^(.*?)\s*[—–-]\s*(.+)$/); // "Título — descrição"
    return m ? { titulo: m[1].trim(), desc: m[2].trim() } : { titulo: v, desc: '' };
  });
  const rotina = (cultura.rotina ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const comoTrab = (cultura.cultura ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const vazio = !cultura.manifesto && !cultura.missao && !cultura.visao && !valores.length && !rotina.length && !comoTrab.length;
  if (vazio) return <div className={`${CARD} mt-2 text-sm text-zinc-400`}>A cultura ainda não foi preenchida. Um sócio pode escrevê-la clicando em <strong>Editar</strong>.</div>;
  return (
    <div className="mt-2 space-y-5">
      {cultura.manifesto && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7048E8] via-[#5f3dd0] to-[#228BE6] p-7 text-white shadow-sm sm:p-9">
          <Sparkles className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Frider Andrade · quem somos</p>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-xl font-bold leading-snug sm:text-2xl">{cultura.manifesto}</p>
        </div>
      )}
      {(cultura.missao || cultura.visao) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([['missao', 'Missão', Target, '#228BE6'], ['visao', 'Visão', Eye, '#7048E8']] as const).map(([k, label, Icon, cor]) => (cultura[k] ? (
            <div key={k} className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10" style={{ background: cor }} />
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${cor}1A`, color: cor }}><Icon className="h-5 w-5" /></span>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>{label}</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-200">{cultura[k]}</p>
            </div>
          ) : null))}
        </div>
      )}
      {valores.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Sparkles className="h-4 w-4 text-[#02883C]" /> Nossos valores</h3>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {valores.map((v, i) => {
              const c = VALOR_CORES[i % VALOR_CORES.length];
              return (
                <div key={i} className="group flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900" style={{ borderLeftColor: c, borderLeftWidth: 4 }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `${c}1A`, color: c }}><Heart className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-800 dark:text-zinc-100">{v.titulo}</p>
                    {v.desc && <p className="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{v.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {rotina.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><MapPin className="h-4 w-4 text-[#F08C00]" /> Como é a rotina aqui</h3>
          <div className="mt-2 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="space-y-2.5">
              {rotina.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F08C00]/12 text-[11px] font-bold text-[#F08C00]">{i + 1}</span>
                  <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{fmtLinha(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {comoTrab.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Heart className="h-4 w-4 text-[#e64980]" /> Como trabalhamos</h3>
          <div className="mt-2 space-y-2.5 rounded-2xl border border-zinc-200/80 bg-white p-5 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {comoTrab.map((p, i) => <p key={i}>{fmtLinha(p)}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

// Documentos oficiais do escritório (regimento interno, estatuto…): sócio sobe um PDF,
// todos visualizam (inline em iframe ou abrindo em nova aba). Persiste em cultura.documentos.
function DocumentosInstitucionais({ documentos, canEdit, editing, onSave }: { documentos: DocInstitucional[]; canEdit?: boolean; editing?: boolean; onSave: (mut: (d: Escritorio) => Escritorio) => void }) {
  const [titulo, setTitulo] = useState('');
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const podeGerenciar = !!canEdit && !editing; // upload/remoção salva contra o dado atual (fora do rascunho de Editar)
  const subir = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await inboxService.uploadMedia(file);
      const doc: DocInstitucional = { id: rid(), titulo: titulo.trim() || file.name.replace(/\.[^.]+$/, ''), url: up.url, mime: up.mimeType || file.type };
      onSave((d) => ({ ...d, cultura: { ...d.cultura, documentos: [...(d.cultura?.documentos ?? []), doc] } }));
      setTitulo('');
      toast.success('Documento adicionado');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui subir o documento'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const remover = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remover este documento?')) return;
    onSave((d) => ({ ...d, cultura: { ...d.cultura, documentos: (d.cultura?.documentos ?? []).filter((x) => x.id !== id) } }));
  };
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500"><Landmark className="h-4 w-4 text-[#7048E8]" /> Documentos oficiais</h3>
      <p className="mt-1 text-xs text-zinc-400">Regimento interno, estatuto e outros documentos do escritório.{podeGerenciar ? ' Suba um PDF para todos visualizarem.' : ' Toque em Visualizar para abrir o PDF.'}</p>
      <div className="mt-2 space-y-2">
        {documentos.length === 0 && <p className="text-sm text-zinc-400">Nenhum documento publicado ainda.</p>}
        {documentos.map((doc) => {
          const isPdf = (doc.mime || '').includes('pdf') || /\.pdf($|\?)/i.test(doc.url);
          const open = aberto === doc.id;
          return (
            <div key={doc.id} className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7048E8]/10 text-[#7048E8]"><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{doc.titulo}</span>
                {isPdf && <button onClick={() => setAberto(open ? null : doc.id)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#228BE6] hover:bg-[#228BE6]/10">{open ? 'Fechar' : 'Visualizar'}</button>}
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
                {podeGerenciar && <button onClick={() => remover(doc.id)} title="Remover" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
              </div>
              {open && isPdf && <iframe src={doc.url} title={doc.titulo} className="h-[70vh] w-full border-t border-zinc-100 dark:border-zinc-800" />}
            </div>
          );
        })}
      </div>
      {podeGerenciar && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex.: Regimento Interno)" className={`${INPUT} max-w-xs flex-1`} />
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,image/*" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir documento</button>
        </div>
      )}
      {canEdit && editing && <p className="mt-2 text-xs text-zinc-400">Saia do modo <strong>Editar</strong> (Salvar/Cancelar) para subir ou remover documentos.</p>}
    </div>
  );
}

// Overlay base dos modais.
function ModalShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex items-center gap-2 border-t border-zinc-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">{footer}</div>}
      </div>
    </div>
  );
}

const SAVE_BTN = 'inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-50';
const GHOST_BTN = 'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800';

// Modal de edição de perfil de uma pessoa (própria ou de outro, pelo sócio).
// Cortador de foto: arrasta pra posicionar, zoom, e corta em círculo (320px JPEG).
function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const SIZE = 256;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => { toast.error('Não consegui ler essa imagem'); onCancel(); };
    im.src = u;
    return () => URL.revokeObjectURL(u); // revoga só ao fechar (prévia continua visível)
  }, [file]);
  const base = img ? Math.max(SIZE / img.width, SIZE / img.height) : 1;
  const scale = base * zoom;
  const imgW = img ? img.width * scale : 0;
  const imgH = img ? img.height * scale : 0;
  const left = (SIZE - imgW) / 2 + pos.x;
  const top = (SIZE - imgH) / 2 + pos.y;
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; setPos({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); };
  const onUp = () => { drag.current = null; };
  const cortar = () => {
    if (!img) return;
    const OUT = 320, k = OUT / SIZE;
    const canvas = document.createElement('canvas'); canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(img, left * k, top * k, imgW * k, imgH * k);
    onDone(canvas.toDataURL('image/jpeg', 0.85));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center text-sm font-bold text-zinc-800 dark:text-zinc-100">Ajuste a foto</p>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} className="relative mx-auto h-64 w-64 cursor-grab touch-none select-none overflow-hidden rounded-full bg-zinc-100 ring-2 ring-zinc-200 active:cursor-grabbing dark:bg-zinc-800 dark:ring-zinc-700" style={{ width: SIZE, height: SIZE }}>
          {img && url && <img src={url} alt="" draggable={false} style={{ position: 'absolute', width: imgW, height: imgH, left, top, maxWidth: 'none' }} />}
        </div>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="mt-4 w-full accent-[#7048E8]" />
        <p className="mt-1 text-center text-[11px] text-zinc-400">Arraste para posicionar · use a barra para dar zoom</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={cortar} disabled={!img} className="flex-1 rounded-lg bg-[#7048E8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0] disabled:opacity-50">Cortar e usar</button>
        </div>
      </div>
    </div>
  );
}

// Editor de verticais (áreas de atuação) por chips — adiciona/remove e sugere as
// verticais já cadastradas no escritório. Usado no perfil de cada pessoa.
function VerticaisEditor({ value, onChange, sugestoes }: { value: string[]; onChange: (v: string[]) => void; sugestoes: string[] }) {
  const [txt, setTxt] = useState('');
  const add = (v: string) => { const t = v.trim(); if (t && !value.includes(t)) onChange([...value, t]); setTxt(''); };
  const rem = (v: string) => onChange(value.filter((x) => x !== v));
  const livres = sugestoes.filter((s) => !value.includes(s));
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-zinc-400">Nenhuma vertical ainda.</span>}
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[#02883C]/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-[#0b7a37] dark:bg-[#02883C]/20 dark:text-[#69db7c]">
            {v}
            <button type="button" onClick={() => rem(v)} title="Remover" className="rounded-full p-0.5 hover:bg-[#02883C]/25"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } }} placeholder="digite e Enter (ex.: Bancário)" className={INPUT} />
        <button type="button" onClick={() => add(txt)} className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">Adicionar</button>
      </div>
      {livres.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {livres.map((s) => <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-[#02883C]/40 px-2 py-0.5 text-[11px] text-[#0b7a37] hover:bg-[#02883C]/5 dark:text-[#69db7c]">+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

function PerfilModal({ userId, nome, avatarUrl, data, cargoById, saving, selfMode, memberId, onClose, onSave, onSaveSelf, onRename }: { userId: string; nome: string; avatarUrl: string | null; data: Escritorio; cargoById: Record<string, Cargo>; saving: boolean; selfMode?: boolean; memberId?: string; onClose: () => void; onSave: (mut: (d: Escritorio) => Escritorio) => void; onSaveSelf?: (patch: Partial<PessoaInfo>) => void; onRename?: (name: string) => void }) {
  const atual = data.pessoas?.[userId];
  const [f, setF] = useState<PessoaInfo>({ ...(atual ?? {}) });
  const [nomeEdit, setNomeEdit] = useState(nome);
  const set = (p: Partial<PessoaInfo>) => setF((x) => ({ ...x, ...p }));
  const num = (s: string) => (s === '' ? undefined : Math.max(0, parseInt(s, 10) || 0));
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const escolherFoto = (file?: File) => { if (file) setCropFile(file); if (fileRef.current) fileRef.current.value = ''; };
  const docRef = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState(false);
  const importarDoc = async (file?: File) => {
    if (!file) return;
    setImp(true);
    try {
      const base64 = await fileToBase64(file);
      const p = await escritorioService.extrairPerfil({ base64, mime: file.type, nomeArquivo: file.name });
      setF((x) => ({
        ...x,
        oab: p.oab || x.oab,
        conoscoDesde: p.conoscoDesde || x.conoscoDesde,
        sexo: (p.sexo as 'F' | 'M' | undefined) || x.sexo,
        atuacao: p.atuacao?.length ? p.atuacao : x.atuacao,
        financeiro: p.financeiro?.length ? p.financeiro : x.financeiro,
        destaque: x.destaque || p.resumo,
      }));
      toast.success('Dados importados do documento — confira e salve.');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui importar do documento'); }
    finally { setImp(false); if (docRef.current) docRef.current.value = ''; }
  };
  // Contrato assinado (PDF) — sobe pro storage e guarda a URL no perfil da pessoa.
  const contratoRef = useRef<HTMLInputElement>(null);
  const [contratoBusy, setContratoBusy] = useState(false);
  const subirContrato = async (file?: File) => {
    if (!file) return;
    setContratoBusy(true);
    try {
      const up = await inboxService.uploadMedia(file);
      set({ contratoUrl: up.url, contratoNome: up.filename || file.name });
      toast.success('Contrato anexado — clique em Salvar para confirmar.');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui subir o contrato'); }
    finally { setContratoBusy(false); if (contratoRef.current) contratoRef.current.value = ''; }
  };
  const cargo = cargoById[f.cargoId ?? atual?.cargoId ?? ''];
  const foto = f.fotoUrl || avatarUrl;
  const salvar = () => {
    if (selfMode && onSaveSelf) { onSaveSelf({ fotoUrl: f.fotoUrl ?? '', frase: f.frase ?? '', bio: f.bio ?? '', oab: f.oab ?? '' }); return; }
    // Nome vem do usuário (não do PessoaInfo) → endpoint próprio, só sócio.
    if (onRename && memberId && nomeEdit.trim() && nomeEdit.trim() !== nome) onRename(nomeEdit.trim());
    onSave((d) => ({ ...d, pessoas: { ...(d.pessoas ?? {}), [userId]: { ...(d.pessoas?.[userId] ?? {}), ...f } } }));
  };
  return (
    <ModalShell
      title={selfMode ? 'Editar meu perfil' : `Perfil — ${nome}`}
      onClose={onClose}
      footer={<div className="ml-auto flex gap-2"><button onClick={onClose} className={GHOST_BTN}>Cancelar</button><button onClick={salvar} disabled={saving} className={SAVE_BTN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button></div>}
    >
      {!selfMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#7048E8]/25 bg-[#7048E8]/5 p-3 dark:bg-[#7048E8]/10">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Tem o contrato/currículo? <strong>Importe e a IA preenche</strong> OAB, datas, financeiro e áreas.</p>
          <input ref={docRef} type="file" accept=".pdf,.docx,image/*" className="hidden" onChange={(e) => importarDoc(e.target.files?.[0])} />
          <DropZone accept=".pdf,.docx,image/*" multiple={false} disabled={imp} onFiles={(fs) => importarDoc(fs[0])} className="inline-block shrink-0" overlayLabel="Soltar documento">
            <button type="button" onClick={() => docRef.current?.click()} disabled={imp} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7048E8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5f3dd0] disabled:opacity-60">{imp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Importar de documento</button>
          </DropZone>
        </div>
      )}
      <div className="flex items-center gap-3">
        {foto ? <img src={foto} alt={nome} className="h-20 w-20 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7048E8] text-2xl font-bold text-white">{iniciaisDe(nome)}</div>}
        <div className="min-w-0 flex-1"><p className="font-semibold text-zinc-800 dark:text-zinc-100">{nome}</p>{cargo && <p className="text-xs text-zinc-400">{cargo.nome}</p>}</div>
      </div>
      <div>
        <p className={LABEL}>Foto</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => escolherFoto(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Camera className="h-4 w-4" /> Enviar e cortar foto</button>
          {f.fotoUrl && <button type="button" onClick={() => set({ fotoUrl: '' })} className="text-xs font-medium text-rose-500 hover:underline">remover</button>}
        </div>
        <input value={f.fotoUrl?.startsWith('data:') ? '' : (f.fotoUrl ?? '')} onChange={(e) => set({ fotoUrl: e.target.value })} placeholder="ou cole uma URL: https://…/foto.jpg" className={`${INPUT} mt-1.5`} />
      </div>
      {!selfMode && <div><p className={LABEL}>Nome</p><input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} placeholder="Nome completo da pessoa" className={`${INPUT} mt-1 font-semibold`} /><p className="mt-1 text-[11px] text-zinc-400">É o nome que aparece no Hub inteiro (kanban, chat, jurídico…).</p></div>}
      <div><p className={LABEL}>OAB</p><input value={f.oab ?? ''} onChange={(e) => set({ oab: e.target.value })} placeholder="ex.: PR 123.456 · SP 654.321" className={`${INPUT} mt-1`} /></div>
      {!selfMode && (
        <div className="grid grid-cols-2 gap-2">
          <div><p className={LABEL}>Conosco desde</p><input value={f.conoscoDesde ?? ''} onChange={(e) => set({ conoscoDesde: e.target.value })} placeholder="ex.: 01/03/2024" className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Trata por</p>
            <select value={f.sexo ?? ''} onChange={(e) => set({ sexo: (e.target.value || undefined) as 'F' | 'M' | undefined })} className={`${INPUT} mt-1`}>
              <option value="">— não definir —</option>
              <option value="F">Ela (advogada, sócia…)</option>
              <option value="M">Ele (advogado, sócio…)</option>
            </select>
          </div>
          <div><p className={LABEL}>Casos (deixe vazio p/ usar o real)</p><input type="number" min={0} value={f.casos ?? ''} onChange={(e) => set({ casos: num(e.target.value) })} className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Vidas impactadas</p><input type="number" min={0} value={f.vidas ?? ''} onChange={(e) => set({ vidas: num(e.target.value) })} className={`${INPUT} mt-1`} /></div>
        </div>
      )}
      {!selfMode && <div><p className={LABEL}>Verticais / áreas de atuação</p><VerticaisEditor value={f.atuacao ?? []} onChange={(v) => set({ atuacao: v })} sugestoes={(data.verticais ?? []).map((x) => x.nome).filter(Boolean)} /><p className="mt-1 text-[11px] text-zinc-400">Aparecem (clicáveis, levam ao financeiro da área) abaixo do cargo no perfil.</p></div>}
      {!selfMode && <div><p className={LABEL}>Financeiro (do contrato) — um item por linha</p><textarea value={(f.financeiro ?? []).join('\n')} onChange={(e) => set({ financeiro: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={3} placeholder={'70% dos honorários de clientes que capta e atende\n30% quando é nomeada para atuar'} className={`${INPUT} mt-1`} /></div>}
      {!selfMode && (
        <div>
          <p className={LABEL}>Contrato assinado (PDF)</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">A pessoa vê este PDF na aba <strong>Meu Contrato</strong> dela.</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input ref={contratoRef} type="file" accept=".pdf,.docx,.doc,image/*" className="hidden" onChange={(e) => subirContrato(e.target.files?.[0])} />
            <button type="button" onClick={() => contratoRef.current?.click()} disabled={contratoBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{contratoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {f.contratoUrl ? 'Trocar contrato' : 'Subir contrato'}</button>
            {f.contratoUrl && <a href={f.contratoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><FileText className="h-3.5 w-3.5" /> {f.contratoNome || 'ver PDF'}</a>}
            {f.contratoUrl && <button type="button" onClick={() => set({ contratoUrl: '', contratoNome: '' })} className="text-xs font-medium text-rose-500 hover:underline">remover</button>}
          </div>
        </div>
      )}
      {!selfMode && <div><p className={LABEL}>Reconhecimento / motivação (em destaque)</p><input value={f.destaque ?? ''} onChange={(e) => set({ destaque: e.target.value })} placeholder="ex.: Referência em RMC, cuida de cada cliente com carinho." className={`${INPUT} mt-1`} /></div>}
      <div><p className={LABEL}>Frase / lema pessoal</p><input value={f.frase ?? ''} onChange={(e) => set({ frase: e.target.value })} placeholder="ex.: Justiça com gente de verdade." className={`${INPUT} mt-1`} /></div>
      <div><p className={LABEL}>Perfil pessoal</p><textarea value={f.bio ?? ''} onChange={(e) => set({ bio: e.target.value })} rows={3} placeholder="Conte um pouco sobre você, sua trajetória, o que te move…" className={`${INPUT} mt-1`} /></div>
      {selfMode && <p className="text-[11px] text-zinc-400">Você edita foto, OAB, frase e perfil pessoal. Cargo, datas e financeiro são definidos por um sócio.</p>}
      {cropFile && <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={(url) => { set({ fotoUrl: url }); setCropFile(null); }} />}
    </ModalShell>
  );
}

// Mini-card de informação (horário, duração, carreira).
function Mini({ icon: Icon, label, valor }: { icon: React.ElementType; label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-700 dark:text-zinc-200">{valor}</p>
    </div>
  );
}

// Seção de lista com ícone (seleção, atribuições, remuneração…).
function SecaoLista({ icon: Icon, titulo, itens, cor }: { icon: React.ElementType; titulo: string; itens?: string[]; cor: string }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: cor }}><Icon className="h-3.5 w-3.5" /> {titulo}</p>
      <ul className="mt-1.5 space-y-1">
        {itens.map((t, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cor }} /><span>{fmtLinha(t)}</span></li>)}
      </ul>
    </div>
  );
}

// Detalhe rico de um cargo (leitura): resumo, pessoas, horário/duração/carreira, seleção, atribuições, financeiro.
function CargoDetalhe({ cargo, pessoas, onVerPerfil }: { cargo: Cargo; pessoas: Member[]; onVerPerfil?: (uid: string) => void }) {
  const temFin = !!(cargo.remuneracao?.length || cargo.honorarios?.length || cargo.custoFirma || cargo.divisaoHonorarios);
  return (
    <div className="space-y-4">
      {cargo.vertical && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Briefcase className="h-3 w-3" /> {cargo.vertical}</span>}
      {(cargo.resumo || cargo.descricao) && <p className="text-[15px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-200">{cargo.resumo || cargo.descricao}</p>}

      {pessoas.length > 0 && (
        <div>
          <p className={LABEL}>Quem está aqui</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pessoas.map((m) => (
              <button key={m.user.id} onClick={() => onVerPerfil?.(m.user.id)} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                <PessoaAvatar nome={m.user.name} foto={m.user.avatarUrl} size={20} bg="#7048E8" className="text-[8px]" />{m.user.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(cargo.horario || cargo.duracao || cargo.progride) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {cargo.horario && <Mini icon={Clock} label="Horário" valor={cargo.horario} />}
          {cargo.duracao && <Mini icon={CalendarDays} label="Duração" valor={cargo.duracao} />}
          {cargo.progride && <Mini icon={TrendingUp} label="Carreira" valor={cargo.progride} />}
        </div>
      )}

      <SecaoLista icon={ClipboardList} titulo="Como se entra" itens={cargo.selecao} cor="#228BE6" />
      <SecaoLista icon={ListChecks} titulo="O que faz no dia a dia" itens={cargo.atribuicoes} cor="#7048E8" />

      {temFin && (
        <div className="rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3.5 dark:bg-[#02883C]/10">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#02883C]"><CircleDollarSign className="h-3.5 w-3.5" /> Remuneração & financeiro</p>
          <div className="mt-2 space-y-3">
            <SecaoLista icon={Wallet} titulo="Salário / bolsa & benefícios" itens={cargo.remuneracao} cor="#02883C" />
            <SecaoLista icon={CircleDollarSign} titulo="Honorários" itens={cargo.honorarios} cor="#02883C" />
            {cargo.divisaoHonorarios && <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold text-zinc-700 dark:text-zinc-200">Divisão:</span> {cargo.divisaoHonorarios}</p>}
            {cargo.custoFirma && <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold text-zinc-700 dark:text-zinc-200">Custo da firma:</span> {cargo.custoFirma}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Lista de cargos agrupada por vertical, recolhível e clicável (abre o detalhe).
function CargosPorVertical({ cargos, grupos, onOpen }: { cargos: Cargo[]; grupos: Map<string, Member[]>; onOpen: (id: string) => void }) {
  const verticais: string[] = [];
  for (const c of cargos) if (c.vertical && !verticais.includes(c.vertical)) verticais.push(c.vertical);
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const toggle = (v: string) => setFechadas((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  if (verticais.length === 0) {
    return <p className="mt-2 text-sm text-zinc-400">Nenhum cargo cadastrado. Use o organograma acima para montar a estrutura.</p>;
  }
  return (
    <div className="mt-2 space-y-3">
      {verticais.map((v, vi) => {
        const cor = BRANCH_COLORS[vi % BRANCH_COLORS.length];
        const itens = cargos.filter((c) => c.vertical === v && c.nome !== v);
        if (itens.length === 0) return null;
        const aberta = !fechadas.has(v);
        return (
          <div key={v} className="rounded-xl border border-zinc-200/70 bg-white/40 p-2 dark:border-zinc-800 dark:bg-zinc-900/30">
            <button onClick={() => toggle(v)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>{v}</span>
              <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{itens.length}</span>
              <ChevronDown className={`ml-auto h-4 w-4 text-zinc-300 transition-transform ${aberta ? '' : '-rotate-90'}`} />
            </button>
            {aberta && (
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {itens.map((c) => {
                const ppl = grupos.get(c.id) ?? [];
                const fin = c.honorarios?.[0] || c.remuneracao?.[0] || c.divisaoHonorarios;
                return (
                  <button key={c.id} onClick={() => onOpen(c.id)} className="group flex flex-col rounded-xl border border-zinc-200/80 bg-white p-3 text-left transition hover:-translate-y-px hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900" style={{ borderLeftColor: cor, borderLeftWidth: 3 }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{c.nome}</span>
                      {ppl.length > 0 && (
                        <span className="flex shrink-0 items-center -space-x-1.5">
                          {ppl.slice(0, 3).map((m) => <PessoaAvatar key={m.user.id} title={m.user.name ?? ''} nome={m.user.name} foto={m.user.avatarUrl} size={20} bg={cor} className="text-[8px] ring-2 ring-white dark:ring-zinc-900" />)}
                        </span>
                      )}
                    </div>
                    {c.resumo && <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{c.resumo}</span>}
                    {fin && <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded bg-[#02883C]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#02883C]"><CircleDollarSign className="h-3 w-3" /> {fin}</span>}
                    <span className="mt-1 text-[10px] font-semibold text-[#228BE6] opacity-0 transition group-hover:opacity-100">Ver detalhes →</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CargoDetalheModal({ cargo, pessoas, canEdit, onClose, onEdit, onVerPerfil }: { cargo: Cargo; pessoas: Member[]; canEdit?: boolean; onClose: () => void; onEdit: () => void; onVerPerfil: (uid: string) => void }) {
  return (
    <ModalShell
      title={cargo.nome || 'Cargo'}
      onClose={onClose}
      footer={<div className="ml-auto flex gap-2"><button onClick={onClose} className={GHOST_BTN}>Fechar</button>{canEdit && <button onClick={onEdit} className={SAVE_BTN}><Pencil className="h-4 w-4" /> Editar</button>}</div>}
    >
      <CargoDetalhe cargo={cargo} pessoas={pessoas} onVerPerfil={onVerPerfil} />
    </ModalShell>
  );
}

// Modal de edição de cargo + responsáveis (aberto pelo lápis no organograma).
function CargoModal({ cargoId, data, members, saving, onClose, onSave, onEditPerfil }: { cargoId: string; data: Escritorio; members: Member[]; saving: boolean; onClose: () => void; onSave: (mut: (d: Escritorio) => Escritorio) => void; onEditPerfil: (uid: string) => void }) {
  const cargo = (data.cargos ?? []).find((c) => c.id === cargoId);
  const [nome, setNome] = useState(cargo?.nome ?? '');
  const [vertical, setVertical] = useState(cargo?.vertical ?? '');
  const [resumo, setResumo] = useState(cargo?.resumo ?? '');
  const [descricao, setDescricao] = useState(cargo?.descricao ?? '');
  const [parentId, setParentId] = useState(cargo?.parentId ?? '');
  const [horario, setHorario] = useState(cargo?.horario ?? '');
  const [duracao, setDuracao] = useState(cargo?.duracao ?? '');
  const [progride, setProgride] = useState(cargo?.progride ?? '');
  const [selecao, setSelecao] = useState((cargo?.selecao ?? []).join('\n'));
  const [atribuicoes, setAtribuicoes] = useState((cargo?.atribuicoes ?? []).join('\n'));
  const [remuneracao, setRemuneracao] = useState((cargo?.remuneracao ?? []).join('\n'));
  const [honorarios, setHonorarios] = useState((cargo?.honorarios ?? []).join('\n'));
  const [custoFirma, setCustoFirma] = useState(cargo?.custoFirma ?? '');
  const [divisao, setDivisao] = useState(cargo?.divisaoHonorarios ?? '');
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(members.filter((m) => data.pessoas?.[m.user.id]?.cargoId === cargoId).map((m) => m.user.id)));
  if (!cargo) return null;
  const outros = (data.cargos ?? []).filter((c) => c.id !== cargoId);
  const linhas = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const toggle = (uid: string) => setAssigned((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const salvar = () => onSave((d) => {
    const cargos = (d.cargos ?? []).map((c) => (c.id === cargoId ? { ...c, nome, vertical, resumo, descricao, parentId: parentId || null, horario, duracao, progride, selecao: linhas(selecao), atribuicoes: linhas(atribuicoes), remuneracao: linhas(remuneracao), honorarios: linhas(honorarios), custoFirma, divisaoHonorarios: divisao } : c));
    const pessoas = { ...(d.pessoas ?? {}) };
    for (const m of members) {
      const uid = m.user.id;
      if (assigned.has(uid)) pessoas[uid] = { ...(pessoas[uid] ?? {}), cargoId };
      else if (pessoas[uid]?.cargoId === cargoId) pessoas[uid] = { ...pessoas[uid], cargoId: undefined };
    }
    return { ...d, cargos, pessoas };
  });
  const addSub = () => onSave((d) => ({ ...d, cargos: [...(d.cargos ?? []), { id: rid(), nome: 'Novo cargo', descricao: '', parentId: cargoId }] }));
  const remover = () => {
    if (typeof window !== 'undefined' && !window.confirm('Remover este cargo? As pessoas ficam sem cargo e os subordinados sobem um nível.')) return;
    onSave((d) => {
      const cargos = (d.cargos ?? []).filter((c) => c.id !== cargoId).map((c) => (c.parentId === cargoId ? { ...c, parentId: cargo.parentId ?? null } : c));
      const pessoas = { ...(d.pessoas ?? {}) };
      for (const uid of Object.keys(pessoas)) if (pessoas[uid]?.cargoId === cargoId) pessoas[uid] = { ...pessoas[uid], cargoId: undefined };
      return { ...d, cargos, pessoas };
    });
  };
  return (
    <ModalShell
      title="Editar cargo"
      onClose={onClose}
      footer={<><button onClick={remover} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-4 w-4" /> Remover</button><div className="ml-auto flex gap-2"><button onClick={onClose} className={GHOST_BTN}>Cancelar</button><button onClick={salvar} disabled={saving} className={SAVE_BTN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button></div></>}
    >
      <div className="grid grid-cols-2 gap-2">
        <div><p className={LABEL}>Nome do cargo</p><input value={nome} onChange={(e) => setNome(e.target.value)} className={`${INPUT} mt-1 font-semibold`} /></div>
        <div><p className={LABEL}>Cargo (carreira)</p><input value={vertical} onChange={(e) => setVertical(e.target.value)} placeholder="ex.: Advocacia, Sociedade, Back Office" className={`${INPUT} mt-1`} /></div>
      </div>
      <div><p className={LABEL}>Resumo (1 linha)</p><input value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="ex.: Advogado em início de carreira, atua sob revisão de um sócio." className={`${INPUT} mt-1`} /></div>
      <div><p className={LABEL}>O que esperamos / o que faz</p><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Resumo das responsabilidades…" className={`${INPUT} mt-1`} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><p className={LABEL}>Reporta a (organograma)</p>
          <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="">— topo —</option>
            {outros.map((c) => <option key={c.id} value={c.id}>{c.nome || '(sem nome)'}</option>)}
          </select>
        </div>
        <div><p className={LABEL}>Progressão de carreira</p><input value={progride} onChange={(e) => setProgride(e.target.value)} placeholder="ex.: Vem de Estagiário Interno · Vai p/ Pleno" className={`${INPUT} mt-1`} /></div>
        <div><p className={LABEL}>Horário</p><input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="ex.: Integral (10h–19h)" className={`${INPUT} mt-1`} /></div>
        <div><p className={LABEL}>Duração no cargo</p><input value={duracao} onChange={(e) => setDuracao(e.target.value)} placeholder="ex.: 1 ano, depois avaliação" className={`${INPUT} mt-1`} /></div>
      </div>
      <div><p className={LABEL}>Como se entra (seleção) — um item por linha</p><textarea value={selecao} onChange={(e) => setSelecao(e.target.value)} rows={3} placeholder={'Currículo: histórico, idiomas, fit com a firma\nProva escrita\nEntrevista com sócios\nLabor Day (1 dia na rotina)'} className={`${INPUT} mt-1`} /></div>
      <div><p className={LABEL}>O que faz no dia a dia — um item por linha</p><textarea value={atribuicoes} onChange={(e) => setAtribuicoes(e.target.value)} rows={3} placeholder={'Uma atribuição por linha'} className={`${INPUT} mt-1`} /></div>
      <div className="rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3 dark:bg-[#02883C]/10">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#02883C]"><CircleDollarSign className="h-3.5 w-3.5" /> Remuneração & financeiro</p>
        <div className="mt-2 space-y-2">
          <div><p className={LABEL}>Salário / bolsa & benefícios — um por linha</p><textarea value={remuneracao} onChange={(e) => setRemuneracao(e.target.value)} rows={2} placeholder={'Salário-base (CLT)\nVale-transporte\nSeguro jurídico'} className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Honorários (percentuais) — um por linha</p><textarea value={honorarios} onChange={(e) => setHonorarios(e.target.value)} rows={2} placeholder={'40% dos honorários iniciais de quem captar e atuar\n50% da taxa de manutenção'} className={`${INPUT} mt-1`} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><p className={LABEL}>Divisão de honorários (resumo)</p><input value={divisao} onChange={(e) => setDivisao(e.target.value)} placeholder="ex.: até 40% do êxito" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Custo da firma / cota</p><input value={custoFirma} onChange={(e) => setCustoFirma(e.target.value)} placeholder="ex.: sem custo / cota mensal" className={`${INPUT} mt-1`} /></div>
          </div>
        </div>
      </div>
      <div>
        <p className={LABEL}>Responsáveis neste cargo</p>
        <div className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-700">
          {members.length === 0 && <p className="px-2 py-1 text-sm text-zinc-400">Sem pessoas na equipe.</p>}
          {members.map((m) => {
            const on = assigned.has(m.user.id);
            return (
              <div key={m.user.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <button onClick={() => toggle(m.user.id)} className="flex flex-1 items-center gap-2 text-left">
                  {on ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#228BE6]" /> : <Circle className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />}
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{iniciaisDe(m.user.name)}</span>
                  <span className={`text-sm ${on ? 'font-medium text-zinc-800 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'}`}>{m.user.name}</span>
                </button>
                <button onClick={() => onEditPerfil(m.user.id)} title="Editar perfil desta pessoa" className="rounded p-1 text-zinc-400 hover:text-[#7048E8]"><UserPlus className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={addSub} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-[#228BE6] hover:bg-[#228BE6]/5 dark:border-zinc-700"><Plus className="h-3.5 w-3.5" /> Adicionar subordinado a este cargo</button>
    </ModalShell>
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
