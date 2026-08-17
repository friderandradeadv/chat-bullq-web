'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, UserPlus, KanbanSquare, Loader2, Plus, Trash2, X, Save, GripVertical,
  Mail, Phone, Star, Lock, MapPin, IdCard, FileText, ExternalLink,
  Network, LayoutGrid, Sparkles, SlidersHorizontal, HandCoins, TrendingUp, UploadCloud, Receipt,
  UserMinus, FileSignature, Archive, History, Clock,
} from 'lucide-react';
import { SociosSection } from '@/features/financeiro/components/socios-divisao';
import { rhService, isPreKey, type Rh, type Candidato, type Etapa, type Ficha, type Documento } from '@/features/rh/services/rh.service';
import {
  ContratarModal, PromoverModal, AlterarContratoModal, DesligarModal, Desligados,
  Timeline, tempoDeCasa, apagarArquivos, avisarRemocao, type CicloCtx,
} from '@/features/rh/components/ciclo-vida';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { escritorioService, type Cargo, type Vertical, type PessoaInfo } from '@/features/escritorio/services/escritorio.service';
import { financeiroService, type AcessoNivel } from '@/features/financeiro/services/financeiro.service';
import { VERTICAIS_PADRAO } from '@/features/financeiro/lib/verticais';
import { ComboBox } from '@/features/financeiro/components/combo-box';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { DropZone } from '@/components/drop-zone';
import { maskCpf, maskDataBR, maskTelefoneBR } from '@/lib/masks';
import { useAuthStore } from '@/stores/auth-store';

// Dados financeiros do colaborador editáveis no RH (refletem no módulo Financeiro).
export type FinColaborador = { honorariosPct?: number | null; acesso?: AcessoNivel };
const ACESSO_LABEL: Record<AcessoNivel, string> = { full: 'Total', cases: 'Só os processos dele', none: 'Sem acesso' };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

const rid = () => `x_${Math.round(Math.random() * 1e9)}`;

/**
 * Assinatura estável de um rascunho, para saber se a ficha tem alteração pendente.
 * Ordena as chaves e ignora vazio/nulo — assim "campo que nunca existiu" e "campo
 * apagado de volta" contam como iguais, e o aviso de descarte não dispara à toa.
 */
function chaveEstavel(v: any): string {
  const limpo = (x: any): any => {
    if (Array.isArray(x)) return x.map(limpo);
    if (x && typeof x === 'object') {
      return Object.fromEntries(
        Object.entries(x)
          .filter(([, y]) => y !== undefined && y !== null && y !== '')
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([k, y]) => [k, limpo(y)]),
      );
    }
    return x;
  };
  return JSON.stringify(limpo(v));
}
const INPUT = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400';
const ini = (n?: string | null) => (n ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const roleLabel = (r?: string) => (r === 'OWNER' ? 'Proprietário' : r === 'ADMIN' ? 'Sócio / Admin' : 'Associado');

export default function RhPage() {
  const qc = useQueryClient();
  const { organizations, activeOrgId, user } = useAuthStore();
  const orgRole = organizations.find((o) => o.id === activeOrgId)?.role;
  const isSocio = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const [tab, setTab] = useState<'membros' | 'desligados' | 'config' | 'selecao'>('membros');
  const { data: rh } = useQuery({ queryKey: ['rh'], queryFn: () => rhService.get(), staleTime: 30_000, retry: false, enabled: isSocio });
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list(), enabled: isSocio });
  const { data: esc } = useQuery({ queryKey: ['escritorio'], queryFn: () => escritorioService.get(), staleTime: 60_000, enabled: isSocio });
  // Dados financeiros por colaborador + config global (mesmos endpoints do módulo Financeiro → reverbera lá).
  const { data: honorariosPct = {} } = useQuery({ queryKey: ['financeiro', 'honorarios-pct'], queryFn: () => financeiroService.getHonorariosPct(), enabled: isSocio });
  const { data: acessoFin = {} } = useQuery({ queryKey: ['financeiro', 'acesso'], queryFn: () => financeiroService.getAcesso(), enabled: isSocio });

  const cargoById = useMemo(() => Object.fromEntries((esc?.cargos ?? []).map((c) => [c.id, c])), [esc]);
  const fichas = rh?.fichas ?? {};
  // Quem foi desligado sai da equipe ativa (mesmo que ainda apareça nos seletores)
  // e passa a viver no arquivo. A ficha é a fonte da verdade — não o `assignable`.
  const team = useMemo(
    () => members.filter((m) => m.assignable !== false && !fichas[m.user.id]?.desligamento),
    [members, fichas],
  );
  const arquivados = useMemo(() => members.filter((m) => !!fichas[m.user.id]?.desligamento), [members, fichas]);
  const canEdit = rh?.canEdit ?? false;

  // Contexto único que os modais do ciclo de vida usam para gravar nos quatro storages.
  const ciclo: CicloCtx = {
    fichas,
    pessoas: esc?.pessoas ?? {},
    cargos: esc?.cargos ?? [],
    verticais: esc?.verticais ?? [],
    honorariosPct: honorariosPct as Record<string, number>,
    acessoFin: acessoFin as Record<string, AcessoNivel>,
    autor: user?.name ?? 'RH',
    meuUserId: user?.id ?? '',
  };

  // Contratação registrada antes de o convidado ter conta fica guardada como ficha
  // `pre:<email>`. Quando ele aceita o convite e vira membro, aplicamos cargo,
  // contrato e condições de uma vez e apagamos o rascunho.
  const conciliando = useRef(false);
  useEffect(() => {
    const pendentes = Object.entries(fichas).filter(([k, f]) => isPreKey(k) && f?.preAdmissao);
    if (!canEdit || pendentes.length === 0 || members.length === 0 || conciliando.current) return;
    const casados = pendentes
      .map(([k, f]) => ({ k, f, membro: members.find((m) => m.user.email.toLowerCase() === (f.preAdmissao!.email ?? '').toLowerCase()) }))
      .filter((x) => !!x.membro);
    if (casados.length === 0) return;
    conciliando.current = true;
    (async () => {
      try {
        const mapa: Record<string, Ficha> = { ...fichas };
        const pessoas = { ...(esc?.pessoas ?? {}) };
        for (const { k, f, membro } of casados) {
          const uid = membro!.user.id;
          const { preAdmissao: pa, ...limpa } = f;
          delete mapa[k];
          // Se já existir ficha para esse userId, as duas linhas do tempo se somam.
          const atual = mapa[uid] ?? {};
          mapa[uid] = { ...atual, ...limpa, historico: [...(atual.historico ?? []), ...(limpa.historico ?? [])] };
          pessoas[uid] = {
            ...(pessoas[uid] ?? {}),
            ...(pa!.cargoId ? { cargoId: pa!.cargoId } : {}),
            ...(pa!.atuacao?.length ? { atuacao: pa!.atuacao } : {}),
            ...(limpa.admissao ? { contratadaDesde: limpa.admissao, conoscoDesde: limpa.admissao } : {}),
          };
          if (pa!.honorariosPct != null) await financeiroService.setHonorariosPct(uid, pa!.honorariosPct);
          if (pa!.acessoFin && pa!.acessoFin !== 'none') await financeiroService.setAcesso(uid, pa!.acessoFin as AcessoNivel);
        }
        await rhService.save({ fichas: mapa });
        await escritorioService.save({ pessoas });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['rh'] }),
          qc.invalidateQueries({ queryKey: ['escritorio'] }),
          qc.invalidateQueries({ queryKey: ['financeiro'] }),
        ]);
        toast.success(casados.length === 1
          ? `${casados[0].membro!.user.name} aceitou o convite — cargo e contrato aplicados.`
          : `${casados.length} contratações pendentes foram aplicadas.`);
      } catch {
        // Silencioso de propósito: é uma conciliação de fundo; tenta de novo na próxima abertura.
      } finally {
        conciliando.current = false;
      }
    })();
  }, [fichas, members, esc, canEdit, qc]);

  const saveM = useMutation({
    mutationFn: (d: Partial<Rh>) => rhService.save(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao salvar'),
  });
  // salva mesclando por cima do atual
  const patch = (mut: (r: Rh) => Partial<Rh>) => { if (rh) saveM.mutate(mut(rh)); };

  // Salva a ficha completa do colaborador: dados cadastrais (RH) + dados funcionais (escritório),
  // em dois PATCHs distintos, preservando os demais campos de cada storage.
  const saveFichaCompleta = async (
    userId: string,
    ficha: Ficha,
    funcionais: Pick<PessoaInfo, 'cargoId' | 'atuacao' | 'conoscoDesde' | 'contratadaDesde'>,
    financeiro?: FinColaborador,
  ) => {
    try {
      // a) dados cadastrais de RH (rh.fichas[userId])
      await rhService.save({ fichas: { ...(rh?.fichas ?? {}), [userId]: ficha } });
      // b) dados funcionais no MESMO storage do escritório (escritorio.pessoas[userId]),
      //    preservando bio/fotoUrl/oab/etc.
      const pessoasAtuais = esc?.pessoas ?? {};
      await escritorioService.save({
        pessoas: { ...pessoasAtuais, [userId]: { ...(pessoasAtuais[userId] ?? {}), ...funcionais } },
      });
      // c) financeiro do colaborador (mesmos endpoints do módulo Financeiro → global).
      //    Só grava o que mudou, p/ não escrever à toa.
      let tocouFin = false;
      if (financeiro) {
        const pctAtual = (honorariosPct as Record<string, number>)[userId];
        if (financeiro.honorariosPct != null && financeiro.honorariosPct !== pctAtual) {
          await financeiroService.setHonorariosPct(userId, financeiro.honorariosPct);
          tocouFin = true;
        }
        const acAtual = (acessoFin as Record<string, AcessoNivel>)[userId] ?? 'none';
        if (financeiro.acesso && financeiro.acesso !== acAtual) {
          await financeiroService.setAcesso(userId, financeiro.acesso);
          tocouFin = true;
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rh'] }),
        qc.invalidateQueries({ queryKey: ['escritorio'] }),
        ...(tocouFin ? [qc.invalidateQueries({ queryKey: ['financeiro'] })] : []),
      ]);
      toast.success('Ficha salva.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar ficha');
      throw e;
    }
  };

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
    <div className="h-full overflow-y-auto bg-[#fafafa] px-4 py-6 lg:px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#7048E8]" />
          <div>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">RH &amp; Seleção</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Todo mundo do escritório e o processo seletivo — do currículo ao Labor Day.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-zinc-200/70 dark:border-zinc-800">
          {([['membros', 'Membros', Users], ['desligados', 'Desligados', Archive], ['config', 'Configurações', SlidersHorizontal], ['selecao', 'Processo Seletivo', KanbanSquare]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${tab === k ? 'border-[#7048E8] text-[#7048E8]' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              <Icon className="h-4 w-4" /> {label}
              {k === 'desligados' && arquivados.length > 0 && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{arquivados.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'desligados' && <Desligados ctx={ciclo} desligados={arquivados} canEdit={canEdit} onChanged={() => { qc.invalidateQueries({ queryKey: ['rh'] }); qc.invalidateQueries({ queryKey: ['org-members'] }); }} />}
        {tab === 'membros' && <MembrosView team={team} ciclo={ciclo} pessoas={esc?.pessoas ?? {}} cargos={esc?.cargos ?? []} verticais={esc?.verticais ?? []} cargoById={cargoById} fichas={fichas} honorariosPct={honorariosPct as Record<string, number>} acessoFin={acessoFin as Record<string, AcessoNivel>} canEdit={canEdit} onSaveFicha={saveFichaCompleta} onVerArquivo={() => setTab('desligados')} />}
        {tab === 'config' && <ConfiguracoesView team={team} members={members} honorariosPct={honorariosPct as Record<string, number>} acessoFin={acessoFin as Record<string, AcessoNivel>} pessoas={esc?.pessoas ?? {}} cargoById={cargoById} canEdit={canEdit} />}
        {tab === 'selecao' && (rh
          ? <ProcessoSeletivo rh={rh} canEdit={canEdit} patch={patch} saving={saveM.isPending} />
          : <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">O processo seletivo precisa da atualização do servidor (rode o deploy da API). Assim que subir, ele aparece aqui.</div>)}
      </div>
    </div>
  );
}

// ─────────────────────────── Configurações (RH) ───────────────────────────
// Casa única e organizada das configurações do escritório. Tudo grava nos mesmos
// endpoints do módulo Financeiro — mudar aqui reflete lá (e vice-versa).
function ConfiguracoesView({ team, members, honorariosPct, acessoFin, pessoas, cargoById, canEdit }: { team: Member[]; members: Member[]; honorariosPct: Record<string, number>; acessoFin: Record<string, AcessoNivel>; pessoas: Record<string, any>; cargoById: Record<string, any>; canEdit: boolean }) {
  return (
    <div className="mt-5 space-y-6">
      <p className="text-sm text-zinc-500">Honorários, divisão dos sócios e acessos do escritório — tudo num lugar só. Vale para a plataforma inteira e reflete no Financeiro na hora.</p>
      <HonorariosEscritorioCard canEdit={canEdit} />
      <AcessosHonorariosTable team={team} honorariosPct={honorariosPct} acessoFin={acessoFin} pessoas={pessoas} cargoById={cargoById} canEdit={canEdit} />
      <CustosPessoaCard team={team} cargoById={cargoById} pessoas={pessoas} canEdit={canEdit} />
      <CusteioCard team={team} cargoById={cargoById} pessoas={pessoas} canEdit={canEdit} />
      <SociosSection members={members} />
    </div>
  );
}

// Participação por vertical — FONTE ÚNICA (remunVertical): o mesmo % define quanto a pessoa
// RECEBE do êxito da vertical e quanto BANCA dos custos dela (entrada e saída do holerite).
// Mesma config do Financeiro › Verticais. Verticais vêm da lista única (VERTICAIS_PADRAO).
const AREAS_VERT = VERTICAIS_PADRAO;
function CustosPessoaCard({ team, cargoById, pessoas, canEdit }: { team: Member[]; cargoById: Record<string, any>; pessoas: Record<string, any>; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ['financeiro', 'remun-vertical'], queryFn: () => financeiroService.getRemunVertical() });
  const [draft, setDraft] = useState<Record<string, { area: string; pct: string }[]>>({});
  useEffect(() => { if (cfg?.remunVertical) setDraft(Object.fromEntries(Object.entries(cfg.remunVertical).map(([k, v]) => [k, (v ?? []).map((x) => ({ area: x.area, pct: String(x.pct) }))]))); }, [cfg]);
  const [saving, setSaving] = useState(false);
  const rows = (uid: string) => draft[uid] ?? [];
  const setRows = (uid: string, r: { area: string; pct: string }[]) => setDraft((d) => ({ ...d, [uid]: r }));
  const salvar = async () => {
    setSaving(true);
    try {
      const clean: Record<string, { area: string; pct: number }[]> = {};
      for (const [k, v] of Object.entries(draft)) { const ls = v.filter((x) => x.area && Number(x.pct) > 0).map((x) => ({ area: x.area, pct: Math.max(0, Math.min(100, Number(x.pct) || 0)) })); if (ls.length) clean[k] = ls; }
      await financeiroService.setRemunVertical(clean);
      await qc.invalidateQueries({ queryKey: ['financeiro'] });
      toast.success('Participações salvas');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><Network className="h-4 w-4 text-[#E64980]" /> Participação por vertical</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Quanto % de cada vertical a pessoa participa. Esse % é <strong>uma coisa só</strong>: define quanto ela <strong>recebe</strong> do êxito da vertical <strong>e</strong> quanto ela <strong>banca</strong> dos custos — vira a entrada e a saída do <strong>holerite</strong>, sempre pelo que for lançado no livro-razão (recalcula sozinho).</p>
          <p className="mt-1 text-xs text-zinc-400">Ex.: <strong>Kauani → RMC/RCC 30% + REPB 40%</strong>. É o <strong>mesmo lugar</strong> que o Financeiro › Verticais › Participação — mudou aqui, muda lá.</p>
        </div>
        {canEdit && <button onClick={salvar} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#E64980] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>}
      </div>
      <div className="mt-4 space-y-3">
        {team.map((m) => {
          const uid = m.user.id; const r = rows(uid); const info = pessoas[uid] ?? {}; const cargo = cargoById[info.cargoId ?? ''];
          return (
            <div key={uid} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.user.name}</p><p className="truncate text-[11px] text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p></div>
                {canEdit && <button onClick={() => setRows(uid, [...r, { area: '', pct: '30' }])} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> vertical</button>}
              </div>
              {r.length === 0 ? <p className="mt-1 text-[11px] text-zinc-400">Sem participação configurada — cai no padrão do contrato.</p> : (
                <div className="mt-2 space-y-1.5">
                  {r.map((x, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <ComboBox className="min-w-[8rem] flex-1" value={x.area} options={AREAS_VERT} allowFree disabled={!canEdit} placeholder="vertical…" onChange={(val) => setRows(uid, r.map((y, j) => j === i ? { ...y, area: val } : y))} />
                      <div className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                        <input value={x.pct} onChange={(e) => setRows(uid, r.map((y, j) => j === i ? { ...y, pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) } : y))} disabled={!canEdit} inputMode="numeric" className="w-10 bg-transparent text-right text-sm tabular-nums outline-none" />
                        <span className="text-xs text-zinc-400">%</span>
                      </div>
                      {canEdit && <button onClick={() => setRows(uid, r.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CUSTEIO (custosPessoa) — SEPARADO da Participação. Aqui você diz o que a pessoa AJUDA A PAGAR:
// linhas específicas (1/3 da agência, saldo de anúncios) com % próprio. Vira a SAÍDA do holerite.
// Quem custeia nada (ex.: Maju) fica sem linha nenhuma.
const CUSTEIO_LINHAS = ['Agência (1/3)', 'Anúncios', 'Tráfego Pago'];
function CusteioCard({ team, cargoById, pessoas, canEdit }: { team: Member[]; cargoById: Record<string, any>; pessoas: Record<string, any>; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ['financeiro', 'custos-pessoa'], queryFn: () => financeiroService.getCustosPessoa() });
  const [draft, setDraft] = useState<Record<string, { area: string; label: string; pct: string }[]>>({});
  useEffect(() => { if (cfg?.custosPessoa) setDraft(Object.fromEntries(Object.entries(cfg.custosPessoa).map(([k, v]) => [k, (v ?? []).map((x) => ({ area: x.area, label: x.label ?? '', pct: String(x.pct) }))]))); }, [cfg]);
  const [saving, setSaving] = useState(false);
  const rows = (uid: string) => draft[uid] ?? [];
  const setRows = (uid: string, r: { area: string; label: string; pct: string }[]) => setDraft((d) => ({ ...d, [uid]: r }));
  const salvar = async () => {
    setSaving(true);
    try {
      const clean: Record<string, { area: string; label?: string; pct: number }[]> = {};
      for (const [k, v] of Object.entries(draft)) { const ls = v.filter((x) => x.area && Number(x.pct) > 0).map((x) => ({ area: x.area, ...(x.label ? { label: x.label } : {}), pct: Math.max(0, Math.min(100, Number(x.pct) || 0)) })); if (ls.length) clean[k] = ls; }
      await financeiroService.setCustosPessoa(clean);
      await qc.invalidateQueries({ queryKey: ['financeiro'] });
      toast.success('Custeio salvo');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><Receipt className="h-4 w-4 text-[#E8590C]" /> Custeio — o que cada um ajuda a pagar</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Diferente da participação (o que a pessoa <strong>recebe</strong>). Aqui é o que ela <strong>ajuda a pagar</strong>: só as linhas de <strong>1/3 da agência</strong> e <strong>saldo de anúncios</strong>, com % próprio. Vira a <strong>saída do holerite</strong> conforme o que você lançar no mês (recalcula sozinho).</p>
          <p className="mt-1 text-xs text-zinc-400">Ex.: <strong>Kauani → 50% de Agência (1/3) + 50% de Anúncios</strong>. Quem <strong>não custeia nada</strong> (ex.: Maju) é só deixar <strong>sem nenhuma linha</strong>. Marque a mesma linha no rateio da despesa (no lançamento) pra casar.</p>
        </div>
        {canEdit && <button onClick={salvar} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#E8590C] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>}
      </div>
      <div className="mt-4 space-y-3">
        {team.map((m) => {
          const uid = m.user.id; const r = rows(uid); const info = pessoas[uid] ?? {}; const cargo = cargoById[info.cargoId ?? ''];
          return (
            <div key={uid} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.user.name}</p><p className="truncate text-[11px] text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p></div>
                {canEdit && <button onClick={() => setRows(uid, [...r, { area: AREAS_VERT[0] ?? '', label: CUSTEIO_LINHAS[0], pct: '50' }])} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> linha de custeio</button>}
              </div>
              {r.length === 0 ? <p className="mt-1 text-[11px] text-zinc-400">Não custeia nada.</p> : (
                <div className="mt-2 space-y-1.5">
                  {r.map((x, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <ComboBox className="min-w-[7rem] flex-1" value={x.area} options={AREAS_VERT} allowFree disabled={!canEdit} placeholder="vertical…" onChange={(val) => setRows(uid, r.map((y, j) => j === i ? { ...y, area: val } : y))} />
                      <ComboBox className="min-w-[8rem] flex-1" value={x.label} options={CUSTEIO_LINHAS} allowFree disabled={!canEdit} placeholder="linha (ou vazio = área inteira)" onChange={(val) => setRows(uid, r.map((y, j) => j === i ? { ...y, label: val } : y))} />
                      <div className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                        <input value={x.pct} onChange={(e) => setRows(uid, r.map((y, j) => j === i ? { ...y, pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) } : y))} disabled={!canEdit} inputMode="numeric" className="w-10 bg-transparent text-right text-sm tabular-nums outline-none" />
                        <span className="text-xs text-zinc-400">%</span>
                      </div>
                      {canEdit && <button onClick={() => setRows(uid, r.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Honorários do escritório: % padrão + fator de realização (globais).
function HonorariosEscritorioCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: escPct } = useQuery({ queryKey: ['financeiro', 'escritorio-pct'], queryFn: () => financeiroService.getEscritorioPct() });
  const { data: fator } = useQuery({ queryKey: ['financeiro', 'fator'], queryFn: () => financeiroService.getFatorRealizacao() });
  const [padrao, setPadrao] = useState('');
  const [fat, setFat] = useState('');
  useEffect(() => { if (escPct) setPadrao(String(escPct.padrao ?? '')); }, [escPct]);
  useEffect(() => { if (fator) setFat(String(fator.fator ?? '')); }, [fator]);
  const [saving, setSaving] = useState(false);
  const salvar = async () => {
    setSaving(true);
    try {
      const p = padrao.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(padrao.replace(',', '.'))));
      const g = fat.trim() === '' ? undefined : Math.max(0, Math.min(200, Number(fat.replace(',', '.'))));
      if (p != null && p !== escPct?.padrao) await financeiroService.setEscritorioPct(p);
      if (g != null && g !== fator?.fator) await financeiroService.setFatorRealizacao(g);
      await qc.invalidateQueries({ queryKey: ['financeiro'] });
      toast.success('Configurações salvas.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><HandCoins className="h-4 w-4 text-[#02883C]" /> Honorários do escritório</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Percentual padrão do escritório e fator de realização — usados nas projeções e na divisão quando o caso não tem regra própria.</p>
        </div>
        {canEdit && <button onClick={salvar} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#02883C] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#026e30] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className={LABEL}>% do escritório (padrão)</p>
          <input value={padrao} onChange={(e) => setPadrao(e.target.value)} disabled={!canEdit} inputMode="decimal" placeholder="ex.: 50" className={`${INPUT} mt-1`} />
          <p className="mt-1 text-[10px] text-zinc-400">Fatia padrão do escritório nos honorários de êxito (quando o caso não tem divisão própria).</p>
        </div>
        <div>
          <p className={LABEL}>Fator de realização (%)</p>
          <input value={fat} onChange={(e) => setFat(e.target.value)} disabled={!canEdit} inputMode="decimal" placeholder="ex.: 70" className={`${INPUT} mt-1`} />
          <p className="mt-1 text-[10px] text-zinc-400">Chance média de êxito usada na projeção da carteira (valor provável).</p>
        </div>
      </div>
    </div>
  );
}

// Acessos ao Financeiro + % de honorários por colaborador, numa tabela única.
function AcessosHonorariosTable({ team, honorariosPct, acessoFin, pessoas, cargoById, canEdit }: { team: Member[]; honorariosPct: Record<string, number>; acessoFin: Record<string, AcessoNivel>; pessoas: Record<string, any>; cargoById: Record<string, any>; canEdit: boolean }) {
  const qc = useQueryClient();
  const setAcesso = async (uid: string, nivel: AcessoNivel) => {
    try { await financeiroService.setAcesso(uid, nivel); await qc.invalidateQueries({ queryKey: ['financeiro'] }); toast.success('Acesso atualizado'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro'); }
  };
  const setHonor = async (uid: string, valor: string) => {
    const pct = valor.trim() === '' ? 0 : Math.max(0, Math.min(100, Number(valor.replace(',', '.'))));
    try { await financeiroService.setHonorariosPct(uid, pct); await qc.invalidateQueries({ queryKey: ['financeiro'] }); toast.success('Honorários atualizados'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro'); }
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"><TrendingUp className="h-4 w-4 text-[#228BE6]" /> Acessos & honorários por colaborador</h3>
      <p className="mt-0.5 text-sm text-zinc-500">Quanto cada um recebe de honorários de êxito e o que enxerga no módulo Financeiro. É o mesmo que aparece na ficha de cada pessoa.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
        <div className="hidden grid-cols-[1fr_8rem_14rem] gap-2 bg-zinc-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/40 sm:grid">
          <span>Colaborador</span><span className="text-center">Honorários %</span><span className="text-center">Acesso ao Financeiro</span>
        </div>
        {team.map((m) => {
          const info = pessoas[m.user.id] ?? {};
          const foto = m.user.avatarUrl || info.fotoUrl;
          const cargo = cargoById[info.cargoId ?? ''];
          return (
            <div key={m.user.id} className="grid grid-cols-1 items-center gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800/70 sm:grid-cols-[1fr_8rem_14rem]">
              <div className="flex min-w-0 items-center gap-2">
                {foto ? <img src={foto} alt={m.user.name} className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7048E8] text-[10px] font-bold text-white">{ini(m.user.name)}</span>}
                <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.user.name}</p><p className="truncate text-[11px] text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p></div>
              </div>
              <div className="sm:text-center">
                <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
                  <input defaultValue={honorariosPct[m.user.id] != null ? String(honorariosPct[m.user.id]) : ''} onBlur={(e) => { const v = e.target.value; const cur = honorariosPct[m.user.id] ?? 0; const nv = v.trim() === '' ? 0 : Number(v.replace(',', '.')); if (nv !== cur) setHonor(m.user.id, v); }} disabled={!canEdit} inputMode="decimal" placeholder="—" className="w-14 bg-transparent text-right text-sm tabular-nums outline-none" />
                  <span className="text-xs text-zinc-400">%</span>
                </div>
              </div>
              <div className="sm:text-center">
                <select value={acessoFin[m.user.id] ?? 'none'} onChange={(e) => setAcesso(m.user.id, e.target.value as AcessoNivel)} disabled={!canEdit} className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 sm:w-52">
                  <option value="none">Sem acesso</option>
                  <option value="cases">Só os processos dele</option>
                  <option value="full">Total (visão do escritório)</option>
                </select>
              </div>
            </div>
          );
        })}
        {team.length === 0 && <p className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">Nenhum colaborador.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────── Membros ───────────────────────────
function MembrosView({ team, ciclo, pessoas, cargos, verticais, cargoById, fichas, honorariosPct, acessoFin, canEdit, onSaveFicha, onVerArquivo }: { team: Member[]; ciclo: CicloCtx; pessoas: Record<string, any>; cargos: Cargo[]; verticais: Vertical[]; cargoById: Record<string, any>; fichas: Record<string, Ficha>; honorariosPct: Record<string, number>; acessoFin: Record<string, AcessoNivel>; canEdit: boolean; onSaveFicha: (userId: string, ficha: Ficha, funcionais: Pick<PessoaInfo, 'cargoId' | 'atuacao' | 'conoscoDesde' | 'contratadaDesde'>, financeiro?: FinColaborador) => Promise<void>; onVerArquivo: () => void }) {
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'org'>('cards');
  const [contratarOpen, setContratarOpen] = useState(false);
  // Ação do ciclo de vida aberta para um colaborador (promover / contrato / desligar).
  const [acao, setAcao] = useState<{ tipo: 'promover' | 'contrato' | 'desligar'; uid: string } | null>(null);
  const membro = team.find((m) => m.user.id === fichaId);
  const alvoAcao = team.find((m) => m.user.id === acao?.uid);
  // Contratações registradas cujo convite ainda não foi aceito (fichas `pre:<email>`).
  const pendentes = useMemo(
    () => Object.entries(fichas).filter(([k, f]) => isPreKey(k) && f?.preAdmissao).map(([k, f]) => ({ k, f })),
    [fichas],
  );
  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">{team.length} {team.length === 1 ? 'pessoa' : 'pessoas'} no escritório · clique num colaborador para abrir a ficha completa.</p>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && <button onClick={() => setContratarOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><UserPlus className="h-3.5 w-3.5" /> Contratar</button>}
          {/* Alternar entre cartões e organograma (hierarquia por cargo). */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
            {([['cards', 'Cartões', LayoutGrid], ['org', 'Organograma', Network]] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setView(k)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${view === k ? 'bg-[#7048E8] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {contratarOpen && <ContratarModal ctx={ciclo} onClose={() => setContratarOpen(false)} onDone={() => {}} />}
      {acao && alvoAcao && acao.tipo === 'promover' && <PromoverModal ctx={ciclo} membro={alvoAcao} onClose={() => setAcao(null)} onDone={() => {}} />}
      {acao && alvoAcao && acao.tipo === 'contrato' && <AlterarContratoModal ctx={ciclo} membro={alvoAcao} onClose={() => setAcao(null)} onDone={() => {}} />}
      {acao && alvoAcao && acao.tipo === 'desligar' && <DesligarModal ctx={ciclo} membro={alvoAcao} onClose={() => setAcao(null)} onDone={onVerArquivo} />}

      {pendentes.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> {pendentes.length === 1 ? 'Contratação aguardando o aceite do convite' : `${pendentes.length} contratações aguardando aceite do convite`}</p>
          <div className="mt-1.5 space-y-1">
            {pendentes.map(({ k, f }) => (
              <p key={k} className="text-xs text-amber-700/90 dark:text-amber-400/90">
                <strong>{f.preAdmissao!.email}</strong>
                {f.admissao ? ` · admissão ${f.admissao}` : ''}
                {f.contrato ? ` · ${f.contrato}` : ''}
              </p>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">Assim que a pessoa criar a conta, cargo, contrato e condições entram sozinhos — é só abrir esta tela.</p>
        </div>
      )}

      {view === 'org' && <Organograma team={team} pessoas={pessoas} cargos={cargos} cargoById={cargoById} fichas={fichas} onOpen={setFichaId} />}

      {view === 'cards' && (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const info = pessoas[m.user.id] ?? {};
          const cargo = cargoById[info.cargoId ?? ''];
          const foto = m.user.avatarUrl || info.fotoUrl;
          const ficha = fichas[m.user.id] ?? {};
          const casa = tempoDeCasa(ficha.admissao);
          return (
            <div key={m.user.id} className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 text-left transition hover:-translate-y-px hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <button onClick={() => setFichaId(m.user.id)} className="text-left">
                <div className="flex items-center gap-3">
                  {foto ? <img src={foto} alt={m.user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7048E8] text-lg font-bold text-white">{ini(m.user.name)}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{m.user.name}</p>
                    <p className="truncate text-xs text-zinc-400">{cargo?.nome ?? roleLabel(m.role)}</p>
                  </div>
                </div>
                {/* Ordem pedida no RH: CPF · Endereço · Email · Telefone */}
                <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {ficha.cpf && <p className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5 shrink-0 text-[#228BE6]" /> CPF {ficha.cpf}</p>}
                  {ficha.endereco && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#E64980]" /> <span className="truncate">{ficha.endereco}</span></p>}
                  <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.user.email}</span></p>
                  {ficha.telefone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-[#02883C]" /> {ficha.telefone}</p>}
                </div>
                {(info.atuacao?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(info.atuacao as string[]).map((a) => (
                      <span key={a} className="rounded-full bg-[#7048E8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7048E8] dark:bg-[#7048E8]/20">{a}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.role === 'AGENT' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>{roleLabel(m.role)}</span>
                  {casa && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" title={`Na casa desde ${ficha.admissao}`}><History className="h-3 w-3" /> {casa}</span>}
                  {typeof honorariosPct[m.user.id] === 'number' && <span className="inline-flex items-center gap-1 rounded-full bg-[#02883C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#02883C] dark:bg-[#02883C]/20 dark:text-emerald-400" title="Percentual de honorários do colaborador">{honorariosPct[m.user.id]}% honor.</span>}
                  {acessoFin[m.user.id] && acessoFin[m.user.id] !== 'none' && <span className="inline-flex items-center gap-1 rounded-full bg-[#228BE6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#228BE6] dark:bg-[#228BE6]/20" title="Acesso ao Financeiro">fin.: {ACESSO_LABEL[acessoFin[m.user.id]]}</span>}
                  {(ficha.documentos?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"><FileText className="h-3 w-3" /> {ficha.documentos!.length} doc</span>}
                </div>
              </button>
              {/* Ciclo de vida do colaborador — sempre à mão, sem entrar na ficha. */}
              {canEdit && (
                <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                  <button onClick={() => setAcao({ tipo: 'contrato', uid: m.user.id })} title="Alterar contrato" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-[#228BE6]/10 hover:text-[#228BE6]"><FileSignature className="h-3.5 w-3.5" /> Contrato</button>
                  <button onClick={() => setAcao({ tipo: 'promover', uid: m.user.id })} title="Promover" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-[#7048E8]/10 hover:text-[#7048E8]"><TrendingUp className="h-3.5 w-3.5" /> Promover</button>
                  <button onClick={() => setAcao({ tipo: 'desligar', uid: m.user.id })} title="Demitir / desligar" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-[#E64980]/10 hover:text-[#E64980]"><UserMinus className="h-3.5 w-3.5" /> Desligar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      <p className="mt-4 text-xs text-zinc-400">Use <strong>Contratar</strong> aqui em cima para trazer alguém novo — já com cargo, admissão e contrato. Cada cartão tem <strong>Contrato</strong>, <strong>Promover</strong> e <strong>Desligar</strong>; quem sai vai para <button onClick={onVerArquivo} className="font-semibold text-[#7048E8] hover:underline">Desligados</button> com a ficha inteira. Para mudar canais ou apagar de vez o vínculo, siga em <strong>Configurações › Membros</strong>.</p>
      {membro && (
        <FichaModal
          membro={membro}
          info={pessoas[membro.user.id] ?? {}}
          cargo={cargoById[(pessoas[membro.user.id] ?? {}).cargoId ?? '']}
          cargos={cargos}
          verticais={verticais}
          ficha={fichas[membro.user.id] ?? {}}
          honorariosPct={honorariosPct[membro.user.id]}
          acesso={acessoFin[membro.user.id] ?? 'none'}
          canEdit={canEdit}
          onClose={() => setFichaId(null)}
          onSave={async (f, funcionais, financeiro) => { await onSaveFicha(membro.user.id, f, funcionais, financeiro); setFichaId(null); }}
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
function FichaModal({ membro, info, cargo, cargos, verticais, ficha, honorariosPct, acesso, canEdit, onClose, onSave }: { membro: Member; info: any; cargo?: any; cargos: Cargo[]; verticais: Vertical[]; ficha: Ficha; honorariosPct?: number; acesso: AcessoNivel; canEdit: boolean; onClose: () => void; onSave: (f: Ficha, funcionais: Pick<PessoaInfo, 'cargoId' | 'atuacao' | 'conoscoDesde' | 'contratadaDesde'>, financeiro: FinColaborador) => void | Promise<void> }) {
  const [f, setF] = useState<Ficha>({ ...ficha, documentos: ficha.documentos ?? [] });
  const set = (p: Partial<Ficha>) => setF((x) => ({ ...x, ...p }));
  // Dados funcionais (vivem em escritorio.pessoas[userId]) — editáveis aqui, gravados no mesmo storage do organograma.
  const [cargoId, setCargoId] = useState<string>(info.cargoId ?? '');
  const [atuacao, setAtuacao] = useState<string[]>(Array.isArray(info.atuacao) ? info.atuacao : []);
  const [conoscoDesde, setConoscoDesde] = useState<string>(info.conoscoDesde ?? '');
  const [contratadaDesde, setContratadaDesde] = useState<string>(info.contratadaDesde ?? '');
  // Financeiro do colaborador (grava no módulo Financeiro).
  const [honor, setHonor] = useState<string>(honorariosPct != null ? String(honorariosPct) : '');
  const [nivelFin, setNivelFin] = useState<AcessoNivel>(acesso ?? 'none');
  const [saving, setSaving] = useState(false);
  const toggleVertical = (nome: string) => setAtuacao((xs) => (xs.includes(nome) ? xs.filter((x) => x !== nome) : [...xs, nome]));
  const salvar = async () => {
    setSaving(true);
    try {
      const pct = honor.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(honor.replace(',', '.'))));
      await onSave(
        f,
        { cargoId: cargoId || undefined, atuacao, conoscoDesde: conoscoDesde || undefined, contratadaDesde: contratadaDesde || undefined },
        { honorariosPct: pct, acesso: nivelFin },
      );
      // Documentos removidos nesta sessão: o arquivo só pode ser apagado agora,
      // depois que a ficha gravada já não aponta para ele.
      if (removidos.length) {
        const urls = removidos;
        setRemovidos([]);
        avisarRemocao('Ficha salva.', await apagarArquivos(urls));
      }
    } finally {
      setSaving(false);
    }
  };
  const foto = membro.user.avatarUrl || info.fotoUrl;
  // Documento aguardando confirmação de remoção (some do rascunho; só vale ao salvar a ficha).
  const [confirmDoc, setConfirmDoc] = useState<string | null>(null);
  // URLs dos documentos tirados nesta sessão — os arquivos são apagados após o save.
  const [removidos, setRemovidos] = useState<string[]>([]);

  // ── Alterações pendentes: fechar sem salvar (X ou clique fora) pedia nada e perdia tudo. ──
  const [confirmSair, setConfirmSair] = useState(false);
  const original = useMemo(
    () => chaveEstavel({
      f: { ...ficha, documentos: ficha.documentos ?? [] },
      cargoId: info.cargoId ?? '',
      atuacao: Array.isArray(info.atuacao) ? info.atuacao : [],
      conoscoDesde: info.conoscoDesde ?? '',
      contratadaDesde: info.contratadaDesde ?? '',
      honor: honorariosPct != null ? String(honorariosPct) : '',
      nivelFin: acesso ?? 'none',
    }),
    [ficha, info, honorariosPct, acesso],
  );
  const sujo = chaveEstavel({ f, cargoId, atuacao, conoscoDesde, contratadaDesde, honor, nivelFin }) !== original;
  /** Único caminho de saída do modal: se houver rascunho pendente, pergunta antes. */
  const tentarFechar = () => { if (sujo) setConfirmSair(true); else onClose(); };
  const addDoc = () => set({ documentos: [...(f.documentos ?? []), { id: rid(), nome: '', url: '' }] });
  const updDoc = (id: string, p: Partial<{ nome: string; url: string }>) => set({ documentos: (f.documentos ?? []).map((d) => (d.id === id ? { ...d, ...p } : d)) });
  const delDoc = (id: string) => set({ documentos: (f.documentos ?? []).filter((d) => d.id !== id) });

  // Upload de verdade: sobe o arquivo (mesmo storage das mídias) e guarda a URL no documento.
  const uploadRef = useRef<HTMLInputElement>(null);
  const [upBusy, setUpBusy] = useState(false);
  const subirDocs = async (files: File[]) => {
    if (!files.length) return;
    setUpBusy(true);
    try {
      const novos: Documento[] = [];
      for (const file of files) {
        const up = await inboxService.uploadMedia(file);
        novos.push({ id: rid(), nome: file.name.replace(/\.[^.]+$/, ''), url: up.url });
      }
      set({ documentos: [...(f.documentos ?? []), ...novos] });
      toast.success(novos.length > 1 ? `${novos.length} documentos enviados` : 'Documento enviado — salve a ficha.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui subir o documento.');
    } finally {
      setUpBusy(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

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
        cpf: p.cpf ? maskCpf(p.cpf) : f.cpf,
        rg: p.rg || f.rg,
        nascimento: p.nascimento ? maskDataBR(p.nascimento) : f.nascimento,
        estadoCivil: p.estadoCivil || f.estadoCivil,
        endereco: p.endereco || f.endereco,
        telefone: p.telefone ? maskTelefoneBR(p.telefone) : f.telefone,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={tentarFechar}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Ficha do colaborador
            {sujo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">alterações não salvas</span>}
          </h3>
          <button onClick={tentarFechar} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>

        {confirmSair && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmSair(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-bold text-zinc-800 dark:text-zinc-100">Descartar alterações?</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                A ficha de <strong className="text-zinc-700 dark:text-zinc-200">{membro.user.name}</strong> tem edição que ainda não foi salva. Se sair agora, ela se perde.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button onClick={() => setConfirmSair(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Continuar editando</button>
                <button onClick={() => { setConfirmSair(false); onClose(); }} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-900/20">Descartar</button>
                <button onClick={() => { setConfirmSair(false); salvar(); }} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar e fechar
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            {foto ? <img src={foto} alt={membro.user.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7048E8] text-xl font-bold text-white">{ini(membro.user.name)}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{membro.user.name}</p>
              <p className="truncate text-xs text-zinc-400">{cargo?.nome ?? roleLabel(membro.role)} · {membro.user.email}</p>
              {info.oab && <p className="truncate text-xs text-zinc-400">OAB {info.oab}</p>}
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
            <div><p className={LABEL}>Telefone</p><input value={f.telefone ?? ''} onChange={(e) => set({ telefone: maskTelefoneBR(e.target.value) })} disabled={!canEdit} inputMode="tel" placeholder="+55 (44) 99185-6865" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Nascimento</p><input value={f.nascimento ?? ''} onChange={(e) => set({ nascimento: maskDataBR(e.target.value) })} disabled={!canEdit} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /><p className="mt-1 text-[10px] text-zinc-400">Vira parabéns com confete no Início do Hub no dia. 🎉</p></div>
            <div><p className={LABEL}>CPF</p><input value={f.cpf ?? ''} onChange={(e) => set({ cpf: maskCpf(e.target.value) })} disabled={!canEdit} inputMode="numeric" placeholder="000.000.000-00" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>RG</p><input value={f.rg ?? ''} onChange={(e) => set({ rg: e.target.value })} disabled={!canEdit} className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Estado civil</p><input value={f.estadoCivil ?? ''} onChange={(e) => set({ estadoCivil: e.target.value })} disabled={!canEdit} className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Admissão / associação</p><input value={f.admissao ?? ''} onChange={(e) => set({ admissao: maskDataBR(e.target.value) })} disabled={!canEdit} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
          </div>
          <div><p className={LABEL}>Endereço completo</p><input value={f.endereco ?? ''} onChange={(e) => set({ endereco: e.target.value })} disabled={!canEdit} placeholder="Rua, nº, bairro, cidade/UF, CEP" className={`${INPUT} mt-1`} /></div>
          <div><p className={LABEL}>Contrato / cargo</p><input value={f.contrato ?? ''} onChange={(e) => set({ contrato: e.target.value })} disabled={!canEdit} placeholder="ex.: Advogado Associado (contrato de associação) — link do Drive" className={`${INPUT} mt-1`} /></div>

          {/* Dados funcionais — mesmos que vivem no organograma (escritorio.pessoas). Editar aqui mantém tudo sincronizado. */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#7048E8]">Dados funcionais (RH)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={LABEL}>Cargo</p>
                <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} disabled={!canEdit} className={`${INPUT} mt-1`}>
                  <option value="">— sem cargo —</option>
                  {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome || 'Cargo'}</option>)}
                </select>
              </div>
              <div><p className={LABEL}>Conosco desde</p><input value={conoscoDesde} onChange={(e) => setConoscoDesde(e.target.value)} disabled={!canEdit} placeholder="ex.: 2021 / mar/2021" className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Contratada(o) desde</p><input value={contratadaDesde} onChange={(e) => setContratadaDesde(e.target.value)} disabled={!canEdit} placeholder="ex.: 01/03/2021" className={`${INPUT} mt-1`} /></div>
            </div>
            <div className="mt-2">
              <p className={LABEL}>Áreas de atuação (verticais)</p>
              {verticais.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-400">Nenhuma vertical cadastrada. Cadastre as áreas em <strong>Meu Espaço › Organograma</strong>.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {verticais.map((v) => {
                    const on = atuacao.includes(v.nome);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => canEdit && toggleVertical(v.nome)}
                        disabled={!canEdit}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-[#7048E8] bg-[#7048E8] text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'} ${!canEdit ? 'cursor-default opacity-70' : ''}`}
                      >
                        {v.nome}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Financeiro do colaborador — grava nos endpoints do módulo Financeiro (reflete lá na hora). */}
          <div className="rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3 dark:bg-[#02883C]/10">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#02883C]">Financeiro do colaborador</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={LABEL}>Honorários (%)</p>
                <input value={honor} onChange={(e) => setHonor(e.target.value)} disabled={!canEdit} inputMode="decimal" placeholder="ex.: 30" className={`${INPUT} mt-1`} />
                <p className="mt-1 text-[10px] text-zinc-400">Fatia do colaborador nos honorários de êxito dos casos dele.</p>
              </div>
              <div>
                <p className={LABEL}>Acesso ao Financeiro</p>
                <select value={nivelFin} onChange={(e) => setNivelFin(e.target.value as AcessoNivel)} disabled={!canEdit} className={`${INPUT} mt-1`}>
                  <option value="none">Sem acesso</option>
                  <option value="cases">Só os processos dele</option>
                  <option value="full">Total (visão do escritório)</option>
                </select>
                <p className="mt-1 text-[10px] text-zinc-400">Define o que ele vê na aba Financeiro.</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className={LABEL}>Documentos pessoais</p>
              {canEdit && (
                <div className="flex items-center gap-3">
                  <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,image/*" multiple className="hidden" onChange={(e) => subirDocs(Array.from(e.target.files ?? []))} />
                  <button onClick={() => uploadRef.current?.click()} disabled={upBusy} className="inline-flex items-center gap-1 text-xs font-semibold text-[#7048E8] hover:underline disabled:opacity-60">{upBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Subir arquivo</button>
                  <button onClick={addDoc} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> Colar link</button>
                </div>
              )}
            </div>
            {canEdit && (
              <DropZone accept=".pdf,.doc,.docx,image/*" multiple disabled={upBusy} onFiles={(fs) => subirDocs(fs)} className="mt-1.5 block" overlayLabel="Soltar documentos">
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-3 py-2 text-center text-[11px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40">Arraste RG, CPF, CNH, comprovantes ou contrato aqui — ou use “Subir arquivo”.</div>
              </DropZone>
            )}
            <div className="mt-1.5 space-y-1.5">
              {(f.documentos ?? []).length === 0 && <p className="text-xs text-zinc-400">Nenhum documento ainda. Suba os arquivos ou cole links do Drive.</p>}
              {(f.documentos ?? []).map((d) => (
                <div key={d.id}>
                  <div className="flex items-center gap-1.5">
                    <input value={d.nome} onChange={(e) => updDoc(d.id, { nome: e.target.value })} disabled={!canEdit} placeholder="Nome (ex.: RG)" className={`${INPUT} w-1/3 min-w-0`} />
                    <input value={d.url ?? ''} onChange={(e) => updDoc(d.id, { url: e.target.value })} disabled={!canEdit} placeholder="link do documento" className={`${INPUT} min-w-0 flex-1`} />
                    {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-[#228BE6]"><ExternalLink className="h-4 w-4" /></a>}
                    {canEdit && <button onClick={() => setConfirmDoc(d.id)} title="Remover documento" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {confirmDoc === d.id && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 dark:border-rose-900/50 dark:bg-rose-900/10">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        Remover <strong>{d.nome || 'este documento'}</strong> da ficha? <span className="text-zinc-400">Ao salvar, o arquivo também é apagado do servidor — a menos que esteja em uso em outro cadastro ou numa conversa.</span>
                      </p>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <button onClick={() => setConfirmDoc(null)} className="rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
                        <button onClick={() => { if (d.url) setRemovidos((xs) => [...xs, d.url!]); delDoc(d.id); setConfirmDoc(null); toast.success('Documento removido — salve a ficha para valer.'); }} className="inline-flex items-center gap-1 rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:opacity-90">

                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div><p className={LABEL}>Observações internas de RH</p><textarea value={f.obs ?? ''} onChange={(e) => set({ obs: e.target.value })} disabled={!canEdit} rows={3} placeholder="Anotações, histórico, avaliações…" className={`${INPUT} mt-1`} /></div>

          {/* Linha do tempo funcional — alimentada pelas ações de contratar/promover/contrato/desligar. */}
          <div>
            <p className={`${LABEL} mb-1.5 flex items-center gap-1.5`}><History className="h-3.5 w-3.5" /> Histórico funcional</p>
            <Timeline historico={f.historico ?? []} />
          </div>
        </div>
        {canEdit && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <button onClick={tentarFechar} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[#228BE6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar ficha</button>
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
            <div><p className={LABEL}>Telefone</p><input value={f.telefone ?? ''} onChange={(e) => set({ telefone: maskTelefoneBR(e.target.value) })} inputMode="tel" placeholder="+55 (44) 99185-6865" className={`${INPUT} mt-1`} /></div>
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
