'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Gavel, ChevronDown, Landmark, Calculator, Handshake, MessagesSquare, Tag, TrendingDown, X, FolderOpen, Scale, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type PartyDetail } from '@/features/legal-cases/services/legal-cases.service';
import { maskCurrencyBR, maskCpfCnpj } from '@/lib/masks';
import { BANCOS_DIRETORIO, acharBancoContato } from '@/features/legal-cases/lib/bancos-diretorio';
import { calcularProvisao, diasDesde, OPERACOES, INSTITUICOES, type Carteira, type Instituicao } from '@/features/calculadora-provisionamento/provisionamento';
import { calculadoraRevisionalService, type ResultadoRevisional } from '@/features/calculadora-revisional/services/calculadora-revisional.service';
import { calcularPE } from '@/features/calculadora-perda-esperada/perda-esperada';
import { calcularPlano, type Credor } from '@/features/calculadora-superendividamento/plano-repactuacao';

// DOSSIÊ POR BANCO do caso REPB. Cada banco RÉU (Party OPPONENT) é a unidade: dados
// → provisionamento → negociação → acordo → etiquetas → malotes daquele banco.
// Persistência: metadata do banco em Party.metadata (updateParty); malotes na lista
// global faseData.repb_malotes.lista (saveFaseField), cada malote ligado por bancoId.

const SITUACOES = ['Em análise', 'Malote enviado', 'Negociando', 'Acordo fechado', 'Judicializado', 'Sem acordo'];
const SIT_COR: Record<string, string> = {
  'Em análise': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  'Malote enviado': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Negociando: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'Acordo fechado': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Judicializado: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'Sem acordo': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};
const MAL_CANAIS = ['Consumidor.gov', 'BACEN (RDR)', 'AR / Correios', 'E-mail', 'Ouvidoria', 'Ação de exibição'];
const MAL_STATUS = ['Aguardando', 'Deferido', 'Indeferido', 'Parcial'];
const MAL_COR: Record<string, string> = {
  Aguardando: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Deferido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Indeferido: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  Parcial: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

// Etiquetas por banco: PRODUTO (o que o cliente contratou) + AÇÃO (medida judicial cabível).
export const TAGS_PRODUTO = ['Capital de giro', 'Cartão de crédito', 'Cheque especial', 'Rotativo', 'Conta garantida', 'Consignado', 'Financiamento', 'Empréstimo pessoal', 'Seguro'];
export const TAGS_ACAO = ['Exibição de documentos', 'Produção antecipada de prova', 'Superendividamento', 'Revisional', 'Embargos', 'Ação declaratória'];
export const tagCor = (t: string) => TAGS_ACAO.includes(t)
  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300';

const INPUT = 'h-8 w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 text-[13px] text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';
const LABEL = 'text-[10px] font-medium uppercase tracking-wide text-zinc-400';

const parseBRL = (s: string) => { let t = String(s ?? '').replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const novoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.round(Math.random() * 1e6)}`);

export interface Malote { id: string; bancoId?: string; banco: string; canal: string; numero: string; dataEnvio: string; prazo: string; tentativa: string; status: string; obs: string; }
export interface Irregularidade { id: string; tipo: string; valor: string; fundamento: string; }
const IRREG_TIPOS = ['Juros abusivos (> taxa média BACEN)', 'Capitalização indevida (anatocismo)', 'Tarifas ilegais (TAC/TEC/cadastro)', 'Seguro sem autorização (venda casada)', 'IOF diluído/indevido', 'Comissão de permanência cumulada', 'Registro de contrato/avaliação', 'Outro'];

const guessInstituicao = (nome: string): Instituicao => /cresol|sicoob|sicredi|unicred|coop/i.test(nome) ? 'cooperativa' : /fundo/i.test(nome) ? 'fundo' : 'banco';
const guessOperacao = (op: string): string => {
  const s = (op ?? '').toLowerCase();
  if (/cart[aã]o/.test(s)) return 'Cartão de crédito';
  if (/capital de giro|ccb/.test(s)) return 'Capital de giro';
  if (/rotativo|cheque|conta garantida/.test(s)) return 'Cheque especial / rotativo';
  if (/consignad/.test(s)) return 'Crédito consignado';
  if (/veic|ve[íi]culo/.test(s)) return 'Financiamento de veículo';
  if (/imobili/.test(s)) return 'Financiamento imobiliário';
  return 'Empréstimo pessoal';
};

/** Resultado COMPLETO do provisionamento dos inputs salvos do banco (null se sem dados). */
export function provResultado(p: PartyDetail) {
  const m: any = p.metadata ?? {};
  const saldo = parseBRL(m.saldoDevedor ?? '');
  if (saldo <= 0 || (!m.provDias && !m.provOperacao)) return null;
  const carteira: Carteira = OPERACOES.find((o) => o.label === (m.provOperacao ?? guessOperacao(m.operacao ?? '')))?.carteira ?? 'C5';
  const dias = Math.max(0, Number(String(m.provDias ?? '').replace(/\D/g, '')) || 0);
  const inst: Instituicao = m.provInstituicao ?? guessInstituicao(p.name ?? '');
  return { ...calcularProvisao({ saldoDevedor: saldo, carteira, dias, instituicao: inst }), saldo };
}
/** Só o valor provisionado (compat.). */
export function provValorDoBanco(p: PartyDetail): number | null {
  return provResultado(p)?.valorProvisionado ?? null;
}

const NEG_STATUS = ['Não iniciada', 'Em negociação', 'Acordo aceito', 'Recusado'];
type Draft = {
  name: string; document: string; operacao: string; saldoDevedor: string; situacao: string; obs: string; tags: string[];
  provInstituicao: Instituicao; provOperacao: string; provDias: string;
  negInterlocutor: string; negProposta: string; negContraproposta: string; negStatus: string;
  acordoFez: string; acordoValor: string; acordoDesconto: string; acordoHonorarios: string; acordoHonorariosTerceiros: string;
};
const toDraft = (p: PartyDetail): Draft => {
  const m: any = p.metadata ?? {};
  return {
    name: p.name ?? '', document: p.document ?? '', operacao: m.operacao ?? '', saldoDevedor: m.saldoDevedor ?? '',
    situacao: m.situacao ?? 'Em análise', obs: m.obs ?? '', tags: Array.isArray(m.tags) ? m.tags : [],
    provInstituicao: m.provInstituicao ?? guessInstituicao(p.name ?? ''),
    provOperacao: m.provOperacao ?? guessOperacao(m.operacao ?? ''),
    provDias: m.provDias ?? '',
    negInterlocutor: m.negInterlocutor ?? '', negProposta: m.negProposta ?? '', negContraproposta: m.negContraproposta ?? '',
    negStatus: m.negStatus ?? (m.situacao === 'Negociando' ? 'Em negociação' : m.situacao === 'Acordo fechado' ? 'Acordo aceito' : 'Não iniciada'),
    acordoFez: m.acordoFez ?? (m.situacao === 'Acordo fechado' ? 'Sim' : ''),
    acordoValor: m.acordoValor ?? '', acordoDesconto: m.acordoDesconto ?? '', acordoHonorarios: m.acordoHonorarios ?? '', acordoHonorariosTerceiros: m.acordoHonorariosTerceiros ?? '',
  };
};

export function BancosReusEditor({ caseId, parties, malotes, focusBankId, onlyBankId, onChanged }: { caseId: string; parties: PartyDetail[]; malotes?: Malote[]; focusBankId?: string | null; onlyBankId?: string | null; onChanged: () => void }) {
  const qc = useQueryClient();
  const reusAll = parties.filter((p) => p.role === 'OPPONENT');
  const reus = onlyBankId ? reusAll.filter((p) => p.id === onlyBankId) : reusAll; // modo foco: só o banco clicado
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(onlyBankId ?? focusBankId ?? null);
  const [filtro, setFiltro] = useState<string>('Todos');
  useEffect(() => { if (onlyBankId) setOpenId(onlyBankId); else if (focusBankId) setOpenId(focusBankId); }, [focusBankId, onlyBankId]);

  // Malotes: lista global mantida aqui; cada banco filtra a sua fatia.
  const [malRows, setMalRows] = useState<Malote[]>(malotes ?? []);
  const malDeb = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setMalRows(malotes ?? []); }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const persistMalotes = (next: Malote[]) => {
    setMalRows(next);
    if (malDeb.current) clearTimeout(malDeb.current);
    malDeb.current = setTimeout(async () => {
      try { await legalCasesService.saveFaseField(caseId, 'repb_malotes', 'lista', next as any); qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); }
      catch { toast.error('Erro ao salvar protocolo'); }
    }, 600);
  };
  const malotesDoBanco = (p: PartyDetail) => {
    const nB = norm(p.name);
    return malRows.filter((m) => m.bancoId ? m.bancoId === p.id : (norm(m.banco) && (nB.includes(norm(m.banco)) || norm(m.banco).includes(nB))));
  };
  const idsVinculados = new Set(reus.flatMap((p) => malotesDoBanco(p).map((m) => m.id)));
  const malotesOrfaos = malRows.filter((m) => !idsVinculados.has(m.id));

  const cont = (s: string) => reus.filter((p) => (p.metadata?.situacao ?? 'Em análise') === s).length;
  const situacoesPresentes = SITUACOES.filter((s) => cont(s) > 0);
  const lista = filtro === 'Todos' ? reus : reus.filter((p) => (p.metadata?.situacao ?? 'Em análise') === filtro);
  const saldoTotal = reus.reduce((acc, p) => acc + parseBRL(p.metadata?.saldoDevedor ?? ''), 0);

  const addBanco = async () => {
    setAdding(true);
    try {
      const novo = await legalCasesService.addParty(caseId, { name: 'Novo banco', role: 'OPPONENT', metadata: { situacao: 'Em análise' } });
      setFiltro('Todos'); setOpenId(novo.id); onChanged();
    } catch { toast.error('Erro ao adicionar banco'); } finally { setAdding(false); }
  };

  return (
    <div className={onlyBankId ? '' : 'rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-3 dark:border-zinc-800 dark:bg-zinc-900/40'}>
      {!onlyBankId && (
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-[#B7791F]" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Bancos réus</p>
          <span className="rounded bg-[#edeff3] px-1.5 text-[12px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{reus.length}</span>
          {saldoTotal > 0 && <span className="text-[11px] text-zinc-400">· {brl(saldoTotal)}</span>}
          <button onClick={addBanco} disabled={adding} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#B7791F]/40 px-2 py-1 text-[12px] font-semibold text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Banco
          </button>
        </div>
      )}

      {!onlyBankId && reus.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#dcdfe5] py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">Nenhum banco réu cadastrado</p>}

      {reus.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <FiltroChip label="Todos" count={reus.length} ativo={filtro === 'Todos'} onClick={() => setFiltro('Todos')} />
          {situacoesPresentes.map((s) => (
            <FiltroChip key={s} label={s} count={cont(s)} ativo={filtro === s} onClick={() => setFiltro(s)} />
          ))}
        </div>
      )}

      <datalist id="bancos-repb-dir">{BANCOS_DIRETORIO.map((b) => <option key={b.nome} value={b.nome} />)}</datalist>
      <div className="mt-2 space-y-1.5">
        {lista.map((p) => (
          <BancoDossie
            key={p.id} party={p} open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onChanged={onChanged}
            malotes={malotesDoBanco(p)}
            onAddMalote={() => persistMalotes([...malRows, { id: novoId(), bancoId: p.id, banco: p.name, canal: 'Consumidor.gov', numero: '', dataEnvio: '', prazo: '', tentativa: '1', status: 'Aguardando', obs: '' }])}
            onUpdMalote={(id, patch) => persistMalotes(malRows.map((m) => (m.id === id ? { ...m, ...patch } : m)))}
            onDelMalote={(id) => persistMalotes(malRows.filter((m) => m.id !== id))}
          />
        ))}
        {reus.length > 0 && lista.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#dcdfe5] py-3 text-center text-xs text-zinc-400 dark:border-zinc-800">Nenhum banco em “{filtro}”</p>
        )}
      </div>

      {!onlyBankId && malotesOrfaos.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-[#dcdfe5] p-2 dark:border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Protocolos sem banco vinculado ({malotesOrfaos.length})</p>
          <div className="mt-1.5 space-y-1">
            {malotesOrfaos.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[12px] text-zinc-500">
                <span className="truncate">{m.banco || '—'} · {m.numero || 's/ nº'}</span>
                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MAL_COR[m.status] ?? ''}`}>{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FiltroChip({ label, count, ativo, onClick }: { label: string; count: number; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${ativo ? 'border-[#B7791F] bg-[#B7791F]/10 text-[#B7791F]' : 'border-[#e3e8ef] text-zinc-500 hover:border-[#B7791F]/40 dark:border-zinc-700 dark:text-zinc-400'}`}>
      {label}
      <span className={`rounded-full px-1 text-[10px] ${ativo ? 'bg-[#B7791F]/15' : 'bg-[#edeff3] dark:bg-zinc-800'}`}>{count}</span>
    </button>
  );
}

function BancoDossie({ party, open, onToggle, onChanged, malotes, onAddMalote, onUpdMalote, onDelMalote }: {
  party: PartyDetail; open: boolean; onToggle: () => void; onChanged: () => void;
  malotes: Malote[]; onAddMalote: () => void; onUpdMalote: (id: string, patch: Partial<Malote>) => void; onDelMalote: (id: string) => void;
}) {
  const [d, setD] = useState<Draft>(toDraft(party));
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setD(toDraft(party)); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: Draft) => {
    setD(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        await legalCasesService.updateParty(party.id, {
          name: next.name.trim() || 'Banco', role: 'OPPONENT', document: next.document.trim() || undefined,
          metadata: {
            ...((party.metadata as any) ?? {}), // preserva chaves que este form não gerencia (ex.: revisional)
            operacao: next.operacao, saldoDevedor: next.saldoDevedor, situacao: next.situacao, obs: next.obs, tags: next.tags,
            provInstituicao: next.provInstituicao, provOperacao: next.provOperacao, provDias: next.provDias,
            negInterlocutor: next.negInterlocutor, negProposta: next.negProposta, negContraproposta: next.negContraproposta, negStatus: next.negStatus,
            acordoFez: next.acordoFez, acordoValor: next.acordoValor, acordoDesconto: next.acordoDesconto, acordoHonorarios: next.acordoHonorarios, acordoHonorariosTerceiros: next.acordoHonorariosTerceiros,
          },
        });
        onChanged();
      } catch { toast.error('Erro ao salvar banco'); }
    }, 600);
  };
  const remove = async () => {
    if (!confirm(`Remover o banco réu "${party.name}"?`)) return;
    try { await legalCasesService.removeParty(party.id); onChanged(); } catch { toast.error('Erro ao remover'); }
  };
  const toggleTag = (t: string) => save({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] });

  const contato = acharBancoContato(d.name);
  const saldo = parseBRL(d.saldoDevedor);
  const carteira: Carteira = OPERACOES.find((o) => o.label === d.provOperacao)?.carteira ?? 'C5';
  const dias = Math.max(0, Number(d.provDias.replace(/\D/g, '')) || 0);
  const prov = useMemo(() => (saldo > 0 ? calcularProvisao({ saldoDevedor: saldo, carteira, dias, instituicao: d.provInstituicao }) : null), [saldo, carteira, dias, d.provInstituicao]);

  return (
    <div className={`overflow-hidden rounded-lg border bg-white dark:bg-zinc-900/60 ${open ? 'border-[#B7791F]/50' : 'border-[#e3e8ef] dark:border-zinc-800'}`}>
      {/* Resumo — situação, etiquetas, saldo num relance */}
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-[#B7791F]/5">
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[#101820] dark:text-zinc-100">{d.name || 'Banco'}</span>
          {d.tags.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {d.tags.slice(0, 3).map((t) => <span key={t} className={`rounded px-1 py-px text-[9px] font-medium ${tagCor(t)}`}>{t}</span>)}
              {d.tags.length > 3 && <span className="text-[9px] text-zinc-400">+{d.tags.length - 3}</span>}
            </span>
          )}
        </div>
        {malotes.length > 0 && <span className="hidden shrink-0 items-center gap-0.5 text-[11px] text-zinc-400 sm:inline-flex">📋 {malotes.length}</span>}
        {d.saldoDevedor && <span className="shrink-0 text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{d.saldoDevedor}</span>}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIT_COR[d.situacao] ?? ''}`}>{d.situacao}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#eef1f5] px-2.5 pb-3 pt-2.5 dark:border-zinc-800">
          {/* ── Dados ── */}
          <section>
            <div className="flex items-center gap-2">
              <input value={d.name} list="bancos-repb-dir" onChange={(e) => save({ ...d, name: e.target.value })} placeholder="Banco / instituição" className={`${INPUT} font-medium`} />
              <button onClick={remove} title="Remover banco" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {contato && <p className="mt-1 text-[11px] text-zinc-400">📇 {contato.escritorio}{contato.telefone ? ` · ${contato.telefone}` : ''}{contato.email ? ` · ${contato.email}` : ''}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className={LABEL}>CNPJ<input value={d.document} onChange={(e) => save({ ...d, document: maskCpfCnpj(e.target.value) })} className={INPUT} /></label>
              <label className={LABEL}>Operação<input value={d.operacao} onChange={(e) => save({ ...d, operacao: e.target.value })} placeholder="Cartão, empréstimo…" className={INPUT} /></label>
              <label className={LABEL}>Saldo devedor<input value={d.saldoDevedor} onChange={(e) => save({ ...d, saldoDevedor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              <label className={LABEL}>Situação<select value={d.situacao} onChange={(e) => save({ ...d, situacao: e.target.value })} className={INPUT}>{SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>
          </section>

          {/* ── Etiquetas (produto + ação judicial) ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Etiquetas</p></div>
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-500">Produto</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {TAGS_PRODUTO.map((t) => <TagToggle key={t} t={t} on={d.tags.includes(t)} onClick={() => toggleTag(t)} />)}
            </div>
            <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-rose-500">Ação judicial cabível</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {TAGS_ACAO.map((t) => <TagToggle key={t} t={t} on={d.tags.includes(t)} onClick={() => toggleTag(t)} />)}
            </div>
          </section>

          {/* ── Provisionamento (cálculo por banco) ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Provisionamento</p></div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className={LABEL}>Instituição<select value={d.provInstituicao} onChange={(e) => save({ ...d, provInstituicao: e.target.value as Instituicao })} className={INPUT}>{INSTITUICOES.map((i) => <option key={i.id} value={i.id}>{i.label.split(' (')[0]}</option>)}</select></label>
              <label className={LABEL}>Modalidade<select value={d.provOperacao} onChange={(e) => save({ ...d, provOperacao: e.target.value })} className={INPUT}>{OPERACOES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}</select></label>
              <label className={LABEL}>Dias de atraso<input value={d.provDias} onChange={(e) => save({ ...d, provDias: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="0" className={INPUT} /></label>
            </div>
            {prov ? (
              <div className="mt-2">
                {/* Estágio + faixa/anexo (Res. BCB 352) — o "porquê" do cálculo */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${prov.estagio.n === 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : prov.estagio.n === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>Estágio S{prov.estagio.n}</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{prov.estagio.label}</span>
                </div>
                <p className="mt-1 text-[10px] text-zinc-400">{prov.faixaLabel} · {prov.dias} dia{prov.dias === 1 ? '' : 's'} de atraso</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <Metric label="Saldo devedor" value={brl(saldo)} />
                  <Metric label="% provisão" value={pct(prov.provisaoAplicadaPct)} sub={prov.provisaoAplicadaPct < prov.provisaoBasePct ? `base ${pct(prov.provisaoBasePct)} · teto` : 'tabela oficial'} />
                  <Metric label="Provisionado" value={brl(prov.valorProvisionado)} sub="perda do banco" />
                  <Metric label="Proposta alvo" value={brl(prov.propostaAcordo)} sub={`desc. ${brl(prov.descontoValor)} (${pct(prov.descontoPct)})`} />
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-400">Lógica: o banco já “perdeu” o provisionado → aceita acordo perto do residual (proposta). Res. CMN 4.966/21 + BCB 352/23.</p>
                <button onClick={() => save({ ...d, acordoValor: brl(prov.propostaAcordo) })} className="mt-1.5 text-[11px] font-medium text-[#B7791F] hover:underline">↳ usar proposta como valor de acordo</button>
              </div>
            ) : <p className="mt-2 text-[11px] text-zinc-400">Preencha saldo + dias de atraso para calcular o provisionamento.</p>}
          </section>

          {/* ── Negociação (por banco) ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><MessagesSquare className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Negociação</p></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className={`${LABEL} col-span-2`}>Interlocutor (gerente / assessoria)<input value={d.negInterlocutor} onChange={(e) => save({ ...d, negInterlocutor: e.target.value })} placeholder="Quem negocia neste banco" className={INPUT} /></label>
              <label className={LABEL}>Proposta enviada<input value={d.negProposta} onChange={(e) => save({ ...d, negProposta: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              <label className={LABEL}>Contraproposta do banco<input value={d.negContraproposta} onChange={(e) => save({ ...d, negContraproposta: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              <label className={`${LABEL} col-span-2`}>Status<select value={d.negStatus} onChange={(e) => save({ ...d, negStatus: e.target.value })} className={INPUT}>{NEG_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>
          </section>

          {/* ── Acordo (fez / não fez) ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Handshake className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Acordo</p></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['Não', 'Em andamento', 'Sim'].map((o) => (
                <button key={o} onClick={() => save({ ...d, acordoFez: o })} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${d.acordoFez === o ? 'border-[#B7791F] bg-[#B7791F]/10 text-[#B7791F]' : 'border-[#e3e8ef] text-zinc-500 hover:border-[#B7791F]/40 dark:border-zinc-700 dark:text-zinc-400'}`}>{o === 'Sim' ? 'Fechou acordo' : o === 'Não' ? 'Sem acordo' : 'Em andamento'}</button>
              ))}
            </div>
            {d.acordoFez === 'Sim' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={LABEL}>Valor do acordo<input value={d.acordoValor} onChange={(e) => save({ ...d, acordoValor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                <label className={LABEL}>Desconto obtido<input value={d.acordoDesconto} onChange={(e) => save({ ...d, acordoDesconto: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                <label className={LABEL}>Honorários (nossa parte)<input value={d.acordoHonorarios} onChange={(e) => save({ ...d, acordoHonorarios: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                <label className={LABEL}>Honorários parceiros (terceiros)<input value={d.acordoHonorariosTerceiros} onChange={(e) => save({ ...d, acordoHonorariosTerceiros: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              </div>
            )}
          </section>

          {/* ── Malotes deste banco ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Malotes / protocolos</p>
              <span className="rounded bg-[#edeff3] px-1.5 text-[11px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{malotes.length}</span>
              <button onClick={onAddMalote} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#B7791F] hover:underline"><Plus className="h-3 w-3" /> Novo</button>
            </div>
            {malotes.length === 0 && <p className="mt-1.5 text-[11px] text-zinc-400">Nenhum protocolo p/ este banco.</p>}
            <div className="mt-2 space-y-2">
              {malotes.map((m) => (
                <div key={m.id} className="rounded-md border border-[#e3e8ef] bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MAL_COR[m.status] ?? ''}`}>{m.status}</span>
                    <input value={m.numero} onChange={(e) => onUpdMalote(m.id, { numero: e.target.value })} placeholder="Nº protocolo" className={`${INPUT} font-medium`} />
                    <button onClick={() => onDelMalote(m.id)} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className={LABEL}>Canal<select value={m.canal} onChange={(e) => onUpdMalote(m.id, { canal: e.target.value })} className={INPUT}>{MAL_CANAIS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
                    <label className={LABEL}>Status<select value={m.status} onChange={(e) => onUpdMalote(m.id, { status: e.target.value })} className={INPUT}>{MAL_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
                    <label className={LABEL}>Tentativa<select value={m.tentativa} onChange={(e) => onUpdMalote(m.id, { tentativa: e.target.value })} className={INPUT}><option value="1">1ª</option><option value="2">2ª</option><option value="3">3ª</option></select></label>
                    <label className={LABEL}>Enviado em<input type="date" value={m.dataEnvio} onChange={(e) => onUpdMalote(m.id, { dataEnvio: e.target.value })} className={INPUT} /></label>
                  </div>
                  <label className={`${LABEL} mt-2 block`}>Prazo p/ resposta<input type="date" value={m.prazo} onChange={(e) => onUpdMalote(m.id, { prazo: e.target.value })} className={INPUT} /></label>
                  <input value={m.obs} onChange={(e) => onUpdMalote(m.id, { obs: e.target.value })} placeholder="Observações" className={`${INPUT} mt-2`} />
                </div>
              ))}
            </div>
          </section>

          {/* Observações gerais do banco */}
          <input value={d.obs} onChange={(e) => save({ ...d, obs: e.target.value })} placeholder="Observações do banco" className={INPUT} />
        </div>
      )}
    </div>
  );
}

function TagToggle({ t, on, onClick }: { t: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${on ? tagCor(t) : 'border border-dashed border-[#dcdfe5] text-zinc-400 hover:border-[#B7791F]/40 dark:border-zinc-700'}`}>{t}</button>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-white px-1.5 py-1 dark:bg-zinc-900/60">
      <p className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-[12px] font-semibold text-[#101820] dark:text-zinc-100">{value}</p>
      {sub && <p className="text-[9px] text-zinc-400">{sub}</p>}
    </div>
  );
}

// Painel "Fase atual" do REPB, POR BANCO: seleciona o banco e vê a situação daquele
// banco. `focusId` faz abrir já no banco clicado no board (sem mostrar outro).
const ORDEM_SIT = ['Acordo fechado', 'Negociando', 'Malote enviado', 'Em análise', 'Judicializado', 'Sem acordo'];
export function RepbFasePorBanco({ parties, malotes, focusId }: { parties: PartyDetail[]; malotes?: Malote[]; focusId?: string | null }) {
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  const sorted = [...reus].sort((a, b) => ORDEM_SIT.indexOf(a.metadata?.situacao ?? 'Em análise') - ORDEM_SIT.indexOf(b.metadata?.situacao ?? 'Em análise'));
  const [sel, setSel] = useState<string>(focusId ?? '');
  useEffect(() => { if (focusId) setSel(focusId); }, [focusId]);
  const p = reus.find((x) => x.id === sel) ?? sorted[0];

  if (!reus.length) return <p className="text-sm text-zinc-400">Nenhum banco réu cadastrado ainda — adicione no dossiê (aba Dados).</p>;

  const m: any = p?.metadata ?? {};
  const prov = p ? provResultado(p) : null;
  const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
  const nMal = malotes && p ? malotes.filter((x) => (x.bancoId ? x.bancoId === p.id : (norm(x.banco) && (norm(p.name).includes(norm(x.banco)) || norm(x.banco).includes(norm(p.name)))))).length : 0;
  const Linha = ({ k, v }: { k: string; v?: string }) => (v ? <div className="flex items-baseline justify-between gap-3 py-0.5 text-[13px]"><span className="text-zinc-500 dark:text-zinc-400">{k}</span><span className="text-right font-medium text-[#101820] dark:text-zinc-100">{v}</span></div> : null);

  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wide text-[#6C757D]">Banco em foco</label>
      <select value={p?.id ?? ''} onChange={(e) => setSel(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200">
        {sorted.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.metadata?.situacao ?? 'Em análise'}</option>)}
      </select>

      {p && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SIT_COR[m.situacao ?? 'Em análise'] ?? ''}`}>{m.situacao ?? 'Em análise'}</span>
            {m.saldoDevedor && <span className="ml-auto text-sm font-semibold tabular-nums text-[#101820] dark:text-zinc-100">{m.saldoDevedor}</span>}
          </div>

          {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagCor(t)}`}>{t}</span>)}</div>}

          <div className="rounded-lg border border-[#e3e8ef] p-2.5 dark:border-zinc-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Negociação</p>
            <Linha k="Interlocutor" v={m.negInterlocutor} />
            <Linha k="Proposta enviada" v={m.negProposta} />
            <Linha k="Contraproposta do banco" v={m.negContraproposta} />
            <Linha k="Status" v={m.negStatus} />
            {!m.negInterlocutor && !m.negProposta && !m.negContraproposta && <p className="text-[12px] text-zinc-400">Sem dados de negociação ainda.</p>}
          </div>

          <div className="rounded-lg border border-[#e3e8ef] p-2.5 dark:border-zinc-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Provisionamento (Res. BCB 352)</p>
            {prov ? (
              <>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${prov.estagio.n === 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : prov.estagio.n === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>Estágio S{prov.estagio.n}</span>
                  <span className="text-[11px] text-zinc-400">{prov.faixaLabel} · {prov.dias}d</span>
                </div>
                <Linha k="Saldo devedor" v={brl(prov.saldo)} />
                <Linha k="% provisionado" v={`${pct(prov.provisaoAplicadaPct)}${prov.provisaoAplicadaPct < prov.provisaoBasePct ? ` (base ${pct(prov.provisaoBasePct)} · teto)` : ''}`} />
                <Linha k="Provisionado (perda do banco)" v={brl(prov.valorProvisionado)} />
                <Linha k="Proposta de acordo (alvo)" v={brl(prov.propostaAcordo)} />
                <Linha k="Desconto potencial" v={`${brl(prov.descontoValor)} (${pct(prov.descontoPct)})`} />
              </>
            ) : <p className="text-[12px] text-zinc-400">Preencha modalidade + dias de atraso no dossiê.</p>}
          </div>

          <div className="rounded-lg border border-[#e3e8ef] p-2.5 dark:border-zinc-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Acordo</p>
            {m.acordoFez === 'Sim' ? (
              <>
                <Linha k="Valor do acordo" v={m.acordoValor} />
                <Linha k="Desconto obtido" v={m.acordoDesconto} />
                <Linha k="Honorários" v={m.acordoHonorarios} />
              </>
            ) : <p className="text-[12px] text-zinc-400">{m.acordoFez === 'Em andamento' ? 'Acordo em andamento.' : 'Sem acordo fechado.'}</p>}
          </div>

          {malotes && <p className="text-[12px] text-zinc-500 dark:text-zinc-400">📋 {nMal} malote{nMal === 1 ? '' : 's'} / protocolo{nMal === 1 ? '' : 's'} deste banco</p>}
          <p className="text-[11px] text-zinc-400">Edite os detalhes deste banco no dossiê (aba Dados → Bancos réus).</p>
        </div>
      )}
    </div>
  );
}

// Resumo financeiro do cliente REPB: dívida total mapeada × quanto já recuperamos
// (desconto obtido nos acordos) + honorários gerados. Visão de topo, linkada ao
// que o Financeiro recebe (os honorários alimentam o caixa quando o caso conclui).
export function ResumoClienteRepb({ parties, recebido }: { parties: PartyDetail[]; recebido?: number }) {
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  if (!reus.length) return null;
  const meta = (p: PartyDetail) => (p.metadata as any) ?? {};
  const divida = reus.reduce((a, p) => a + parseBRL(meta(p).saldoDevedor ?? ''), 0);
  const provisionado = reus.reduce((a, p) => a + (provValorDoBanco(p) ?? 0), 0);
  const fechados = reus.filter((p) => meta(p).acordoFez === 'Sim' || meta(p).situacao === 'Acordo fechado');
  // Recuperado (economia do cliente) = desconto informado OU, se vazio, dívida − valor do acordo.
  const recuperado = fechados.reduce((a, p) => {
    const desc = parseBRL(meta(p).acordoDesconto ?? '');
    if (desc > 0) return a + desc;
    const saldo = parseBRL(meta(p).saldoDevedor ?? ''); const acordo = parseBRL(meta(p).acordoValor ?? '');
    return a + (saldo > 0 && acordo > 0 ? Math.max(0, saldo - acordo) : 0);
  }, 0);
  const honNossa = fechados.reduce((a, p) => a + parseBRL(meta(p).acordoHonorarios ?? ''), 0);
  const honTerceiros = fechados.reduce((a, p) => a + parseBRL(meta(p).acordoHonorariosTerceiros ?? ''), 0);
  const acordoTotal = fechados.reduce((a, p) => a + parseBRL(meta(p).acordoValor ?? ''), 0);
  const nFechados = reus.filter((p) => meta(p).situacao === 'Acordo fechado').length;
  const progresso = reus.length ? Math.round((nFechados / reus.length) * 100) : 0;
  const pctRecuperado = divida > 0 ? Math.round((recuperado / divida) * 100) : 0;

  return (
    <div className="rounded-xl border border-[#B7791F]/30 bg-gradient-to-br from-[#B7791F]/5 to-transparent p-3 dark:border-[#B7791F]/25">
      <div className="flex items-center gap-1.5">
        <TrendingDown className="h-4 w-4 text-[#B7791F]" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Reestruturação — panorama do cliente</p>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Big label="Dívida mapeada" value={brl(divida)} tone="ink" />
        <Big label="Provisionado (est.)" value={brl(provisionado)} sub={divida > 0 ? `${Math.round((provisionado / divida) * 100)}% da dívida` : undefined} tone="ink" />
        <Big label="Já recuperado" value={brl(recuperado)} sub={`${pctRecuperado}% da dívida`} tone="emerald" />
        <Big label="Honorários (nossa parte)" value={brl(honNossa)} sub={honTerceiros > 0 ? `+ ${brl(honTerceiros)} parceiros` : recebido != null ? `recebido ${brl(recebido)}` : undefined} tone="gold" />
        <Big label="Acordos fechados" value={`${nFechados}/${reus.length}`} sub={acordoTotal > 0 ? `pago ${brl(acordoTotal)}` : undefined} tone="ink" />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400"><span>Progresso da reestruturação</span><span>{progresso}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-[#edeff3] dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progresso}%` }} /></div>
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">Recuperado = economia do cliente (desconto). Honorários (nossa parte) alimentam o Financeiro; a parte de parceiros fica registrada à parte.</p>
    </div>
  );
}

// Modal FOCADO num banco só: abre ao clicar num card cliente×banco no kanban.
// Mostra o dossiê APENAS daquele contrato (dados, provisão, negociação, acordo,
// malotes DELE) + um lembrete do que importa na fase — sem o resto do cliente.
const FOCO_SIT: Record<string, string> = {
  'Em análise': 'Nesta fase: auditoria contratual + cálculo de provisionamento.',
  'Malote enviado': 'Nesta fase: os malotes/protocolos enviados e o retorno de cada canal.',
  Negociando: 'Nesta fase: proposta enviada × contraproposta do banco.',
  'Acordo fechado': 'Nesta fase: valores do acordo (quitação, desconto, honorários).',
  Judicializado: 'Nesta fase: ação judicial cabível (exibição, revisional, superendividamento…).',
  'Sem acordo': 'Nesta fase: reavaliar estratégia (novo malote, ação, provisionamento).',
};
const TAB_POR_SIT: Record<string, string> = {
  'Em análise': 'calculo', 'Malote enviado': 'solicitacoes', Negociando: 'negociacao',
  'Acordo fechado': 'acordo', Judicializado: 'acordo', 'Sem acordo': 'calculo',
};
const FOCO_TABS = [
  { k: 'dados', label: 'Dados' }, { k: 'calculo', label: 'Cálculo' }, { k: 'revisional', label: 'Revisional' },
  { k: 'negociacao', label: 'Negociação' }, { k: 'acordo', label: 'Acordo' }, { k: 'solicitacoes', label: 'Solicitações' },
];

export function BankFocusModal({ caseId, bankId, onClose }: { caseId: string; bankId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({ queryKey: ['legal-cases', 'detail', caseId], queryFn: () => legalCasesService.get(caseId) });
  const party = c?.parties.find((p) => p.id === bankId);
  const cliente = (c?.parties.find((p) => p.role === 'CLIENT')?.name ?? c?.title ?? 'Cliente');
  const malotesAll = ((c?.metadata as any)?.faseData?.repb_malotes?.lista ?? []) as Malote[];
  const m: any = party?.metadata ?? {};
  const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
  const foco = FOCO_SIT[m.situacao ?? 'Em análise'] ?? '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start gap-2 border-b border-[#eef1f5] p-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-400">{cliente.toUpperCase()}</p>
            <h3 className="break-words text-lg font-bold text-[#101820] dark:text-zinc-100">{party?.name ?? 'Banco'}</h3>
            {party && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SIT_COR[m.situacao ?? 'Em análise'] ?? ''}`}>{m.situacao ?? 'Em análise'}</span>
                {m.saldoDevedor && <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{m.saldoDevedor}</span>}
                {tags.slice(0, 4).map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagCor(t)}`}>{t}</span>)}
              </div>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading && <p className="py-6 text-center text-sm text-zinc-400">Carregando banco…</p>}
          {!isLoading && !party && <p className="py-6 text-center text-sm text-zinc-400">Banco não encontrado.</p>}
          {party && c && (
            <>
              {foco && <p className="mb-3 rounded-lg bg-[#B7791F]/10 px-3 py-2 text-[12px] font-medium text-[#8a5a12] dark:text-[#e0b060]">{foco}</p>}
              <BancoFocado caseId={caseId} party={party} malotesAll={malotesAll} driveUrl={(c.metadata as any)?.driveUrl} onChanged={() => qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Editor de UM banco em SUBABAS (Dados · Cálculo · Negociação · Acordo · Solicitações).
// Abre na aba certa pela situação. Persiste banco em Party.metadata (updateParty) e
// os malotes na lista global faseData.repb_malotes.lista (saveFaseField).
function BancoFocado({ caseId, party, malotesAll, driveUrl, onChanged }: { caseId: string; party: PartyDetail; malotesAll: Malote[]; driveUrl?: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(toDraft(party));
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setD(toDraft(party)); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<string>(TAB_POR_SIT[(party.metadata as any)?.situacao ?? 'Em análise'] ?? 'dados');

  const save = (next: Draft) => {
    setD(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        await legalCasesService.updateParty(party.id, {
          name: next.name.trim() || 'Banco', role: 'OPPONENT', document: next.document.trim() || undefined,
          metadata: {
            ...((party.metadata as any) ?? {}), // preserva chaves que este form não gerencia (ex.: revisional)
            operacao: next.operacao, saldoDevedor: next.saldoDevedor, situacao: next.situacao, obs: next.obs, tags: next.tags,
            provInstituicao: next.provInstituicao, provOperacao: next.provOperacao, provDias: next.provDias,
            negInterlocutor: next.negInterlocutor, negProposta: next.negProposta, negContraproposta: next.negContraproposta, negStatus: next.negStatus,
            acordoFez: next.acordoFez, acordoValor: next.acordoValor, acordoDesconto: next.acordoDesconto, acordoHonorarios: next.acordoHonorarios, acordoHonorariosTerceiros: next.acordoHonorariosTerceiros,
          },
        });
        onChanged();
      } catch { toast.error('Erro ao salvar banco'); }
    }, 600);
  };
  const toggleTag = (t: string) => save({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] });

  // Malotes deste banco (lista global; filtra + persiste).
  const [malRows, setMalRows] = useState<Malote[]>(malotesAll ?? []);
  const malDeb = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setMalRows(malotesAll ?? []); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const persistMal = (next: Malote[]) => {
    setMalRows(next);
    if (malDeb.current) clearTimeout(malDeb.current);
    malDeb.current = setTimeout(async () => {
      try { await legalCasesService.saveFaseField(caseId, 'repb_malotes', 'lista', next as any); qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); }
      catch { toast.error('Erro ao salvar protocolo'); }
    }, 600);
  };
  const nB = norm(party.name);
  const meusMal = malRows.filter((mm) => (mm.bancoId ? mm.bancoId === party.id : (norm(mm.banco) && (nB.includes(norm(mm.banco)) || norm(mm.banco).includes(nB)))));

  const contato = acharBancoContato(d.name);
  const [dataPgto, setDataPgto] = useState(''); // data do último pagamento → calcula dias de atraso
  const saldo = parseBRL(d.saldoDevedor);
  const carteira: Carteira = OPERACOES.find((o) => o.label === d.provOperacao)?.carteira ?? 'C5';
  const diasProv = Math.max(0, Number(d.provDias.replace(/\D/g, '')) || 0);
  const prov = useMemo(() => (saldo > 0 ? calcularProvisao({ saldoDevedor: saldo, carteira, dias: diasProv, instituicao: d.provInstituicao }) : null), [saldo, carteira, diasProv, d.provInstituicao]);

  // Irregularidades achadas na revisão do contrato = "créditos" pra abater a dívida.
  const [irreg, setIrreg] = useState<Irregularidade[]>(((party.metadata as any)?.irregularidades ?? []) as Irregularidade[]);
  const irregDeb = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setIrreg(((party.metadata as any)?.irregularidades ?? []) as Irregularidade[]); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const persistIrreg = (next: Irregularidade[]) => {
    setIrreg(next);
    if (irregDeb.current) clearTimeout(irregDeb.current);
    irregDeb.current = setTimeout(async () => {
      try { await legalCasesService.updateParty(party.id, { name: party.name || 'Banco', role: 'OPPONENT', document: party.document ?? undefined, metadata: { ...((party.metadata as any) ?? {}), irregularidades: next } }); onChanged(); }
      catch { toast.error('Erro ao salvar'); }
    }, 700);
  };
  const creditos = irreg.reduce((a, i) => a + parseBRL(i.valor), 0);
  const provVal = prov?.valorProvisionado ?? 0;
  const revEconomia = Number((party.metadata as any)?.revisional?.economia) || 0;
  const propostaAlvo = Math.max(0, saldo - provVal - revEconomia - creditos);

  return (
    <div>
      {/* Subabas */}
      <div className="flex flex-wrap gap-1 border-b border-[#eef1f5] dark:border-zinc-800">
        {FOCO_TABS.map((t) => {
          const n = t.k === 'solicitacoes' ? meusMal.length : undefined;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] font-medium ${tab === t.k ? 'border-[#B7791F] text-[#B7791F]' : 'border-transparent text-zinc-500 hover:text-[#B7791F] dark:text-zinc-400'}`}>
              {t.label}{n != null && n > 0 ? ` · ${n}` : ''}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-3">
        {/* ── DADOS ── */}
        {tab === 'dados' && (
          <>
            <div className="flex items-center gap-2">
              <input value={d.name} list="bancos-repb-dir" onChange={(e) => save({ ...d, name: e.target.value })} placeholder="Banco / instituição" className={`${INPUT} font-medium`} />
            </div>
            {contato && <p className="text-[11px] text-zinc-400">📇 {contato.escritorio}{contato.telefone ? ` · ${contato.telefone}` : ''}{contato.email ? ` · ${contato.email}` : ''}</p>}
            <datalist id="bancos-repb-dir">{BANCOS_DIRETORIO.map((b) => <option key={b.nome} value={b.nome} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <label className={LABEL}>CNPJ<input value={d.document} onChange={(e) => save({ ...d, document: maskCpfCnpj(e.target.value) })} className={INPUT} /></label>
              <label className={LABEL}>Operação<input value={d.operacao} onChange={(e) => save({ ...d, operacao: e.target.value })} placeholder="Cartão, empréstimo…" className={INPUT} /></label>
              <label className={LABEL}>Saldo devedor<input value={d.saldoDevedor} onChange={(e) => save({ ...d, saldoDevedor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              <label className={LABEL}>Situação<select value={d.situacao} onChange={(e) => save({ ...d, situacao: e.target.value })} className={INPUT}>{SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>
            <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Etiquetas</p></div>
              <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-500">Produto</p>
              <div className="mt-1 flex flex-wrap gap-1">{TAGS_PRODUTO.map((t) => <TagToggle key={t} t={t} on={d.tags.includes(t)} onClick={() => toggleTag(t)} />)}</div>
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-rose-500">Ação judicial cabível</p>
              <div className="mt-1 flex flex-wrap gap-1">{TAGS_ACAO.map((t) => <TagToggle key={t} t={t} on={d.tags.includes(t)} onClick={() => toggleTag(t)} />)}</div>
            </div>
            <input value={d.obs} onChange={(e) => save({ ...d, obs: e.target.value })} placeholder="Observações do banco" className={INPUT} />
          </>
        )}

        {/* ── CÁLCULO (provisionamento Res. 352 + Perda Esperada) ── */}
        {tab === 'calculo' && (
          <>
          <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Provisionamento (Res. BCB 352)</p></div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className={LABEL}>Saldo devedor (dívida)<input value={d.saldoDevedor} onChange={(e) => save({ ...d, saldoDevedor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
              <label className={LABEL}>Instituição<select value={d.provInstituicao} onChange={(e) => save({ ...d, provInstituicao: e.target.value as Instituicao })} className={INPUT}>{INSTITUICOES.map((i) => <option key={i.id} value={i.id}>{i.label.split(' (')[0]}</option>)}</select></label>
              <label className={LABEL}>Modalidade<select value={d.provOperacao} onChange={(e) => save({ ...d, provOperacao: e.target.value })} className={INPUT}>{OPERACOES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}</select></label>
              <label className={LABEL}>Dias de atraso<input value={d.provDias} onChange={(e) => { setDataPgto(''); save({ ...d, provDias: e.target.value.replace(/\D/g, '') }); }} inputMode="numeric" placeholder="0" className={INPUT} /></label>
            </div>
            <label className={`${LABEL} mt-2 block`}>… ou data do último pagamento (calcula os dias)<input type="date" value={dataPgto} onChange={(e) => { setDataPgto(e.target.value); const dd = diasDesde(e.target.value); if (dd != null) save({ ...d, provDias: String(dd) }); }} className={`${INPUT} sm:max-w-[220px]`} /></label>
            {prov ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${prov.estagio.n === 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : prov.estagio.n === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>Estágio S{prov.estagio.n}</span>
                  <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{prov.estagio.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">{prov.faixaLabel} · {prov.dias} dia{prov.dias === 1 ? '' : 's'} de atraso</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <Metric label="Saldo devedor" value={brl(saldo)} />
                  <Metric label="% provisão" value={pct(prov.provisaoAplicadaPct)} sub={prov.provisaoAplicadaPct < prov.provisaoBasePct ? `base ${pct(prov.provisaoBasePct)} · teto` : 'tabela oficial'} />
                  <Metric label="Provisionado" value={brl(prov.valorProvisionado)} sub="perda do banco" />
                  <Metric label="Proposta alvo" value={brl(prov.propostaAcordo)} sub={`desc. ${brl(prov.descontoValor)} (${pct(prov.descontoPct)})`} />
                </div>
                <p className="mt-2 text-[11px] text-zinc-400">O banco já “perdeu” o provisionado → aceita acordo perto do residual (proposta). Res. CMN 4.966/21 + BCB 352/23. Tetos: cooperativa 50% · fundo 30% · banco piso 10%.</p>
                <button onClick={() => { save({ ...d, acordoValor: brl(prov.propostaAcordo) }); }} className="mt-1.5 text-[12px] font-medium text-[#B7791F] hover:underline">↳ usar proposta como valor de acordo</button>
              </div>
            ) : <p className="mt-2 text-[12px] text-zinc-400">Preencha saldo (aba Dados) + dias de atraso para calcular.</p>}
          </div>
          <PerdaEsperadaBlock party={party} saldo={saldo} estagioN={prov?.estagio.n ?? 3} onChanged={onChanged} />
          </>
        )}

        {/* ── REVISIONAL (recalcula o contrato sem juros abusivos → economia da ação) ── */}
        {tab === 'revisional' && <RevisionalTab party={party} onChanged={onChanged} />}

        {/* ── NEGOCIAÇÃO ── */}
        {tab === 'negociacao' && (
          <div className="grid grid-cols-2 gap-2">
            <label className={`${LABEL} col-span-2`}>Interlocutor (gerente / assessoria)<input value={d.negInterlocutor} onChange={(e) => save({ ...d, negInterlocutor: e.target.value })} placeholder="Quem negocia neste banco" className={INPUT} /></label>
            <label className={LABEL}>Proposta enviada<input value={d.negProposta} onChange={(e) => save({ ...d, negProposta: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
            <label className={LABEL}>Contraproposta do banco<input value={d.negContraproposta} onChange={(e) => save({ ...d, negContraproposta: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
            <label className={`${LABEL} col-span-2`}>Status<select value={d.negStatus} onChange={(e) => save({ ...d, negStatus: e.target.value })} className={INPUT}>{NEG_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
        )}

        {/* ── ACORDO — cockpit "A LIMPA": usa TUDO pra abater a dívida ── */}
        {tab === 'acordo' && (
          <div className="space-y-3">
            {/* Waterfall: dívida − provisionado − revisional − créditos = proposta alvo */}
            <div className="rounded-md border border-[#B7791F]/30 bg-gradient-to-br from-[#B7791F]/5 to-transparent p-2.5 dark:border-[#B7791F]/25">
              <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Alvo da negociação — usar tudo pra abater</p></div>
              <div className="mt-2 space-y-1 text-[13px]">
                <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Dívida atual</span><span className="font-semibold tabular-nums text-[#101820] dark:text-zinc-100">{brl(saldo)}</span></div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400"><span>− Provisionado (o banco já perdeu)</span><span className="tabular-nums">{provVal > 0 ? `− ${brl(provVal)}` : '—'}</span></div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400"><span>− Economia revisional (juros)</span><span className="tabular-nums">{revEconomia > 0 ? `− ${brl(revEconomia)}` : '—'}</span></div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400"><span>− Créditos de irregularidades</span><span className="tabular-nums">{creditos > 0 ? `− ${brl(creditos)}` : '—'}</span></div>
                <div className="mt-1 flex justify-between border-t border-[#eef1f5] pt-1 dark:border-zinc-800"><span className="font-semibold text-[#101820] dark:text-zinc-100">Proposta alvo (a buscar)</span><span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{brl(propostaAlvo)}</span></div>
                <p className="text-right text-[10px] text-zinc-400">{saldo > 0 ? `${Math.round(((saldo - propostaAlvo) / saldo) * 100)}% de abatimento potencial` : ''}</p>
              </div>
              {(revEconomia > 0 || creditos > 0) && <button onClick={() => save({ ...d, negProposta: brl(propostaAlvo) })} className="mt-1.5 text-[11px] font-medium text-[#B7791F] hover:underline">↳ lançar como proposta na negociação</button>}
            </div>

            {/* Irregularidades = créditos (revisão do contrato) */}
            <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Irregularidades / créditos</p>
                {creditos > 0 && <span className="rounded bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{brl(creditos)}</span>}
                <button onClick={() => persistIrreg([...irreg, { id: novoId(), tipo: IRREG_TIPOS[0], valor: '', fundamento: '' }])} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#B7791F] hover:underline"><Plus className="h-3 w-3" /> Achado</button>
              </div>
              {irreg.length === 0 && <p className="mt-1.5 text-[11px] text-zinc-400">Revise o contrato e lance cada irregularidade como um crédito pra abater a dívida.</p>}
              <div className="mt-2 space-y-2">
                {irreg.map((ir) => (
                  <div key={ir.id} className="rounded-md border border-[#e3e8ef] bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="flex items-center gap-2">
                      <select value={ir.tipo} onChange={(e) => persistIrreg(irreg.map((x) => (x.id === ir.id ? { ...x, tipo: e.target.value } : x)))} className={`${INPUT} font-medium`}>{IRREG_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                      <input value={ir.valor} onChange={(e) => persistIrreg(irreg.map((x) => (x.id === ir.id ? { ...x, valor: maskCurrencyBR(e.target.value) } : x)))} inputMode="decimal" placeholder="R$ crédito" className={`${INPUT} max-w-[130px]`} />
                      <button onClick={() => persistIrreg(irreg.filter((x) => x.id !== ir.id))} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <input value={ir.fundamento} onChange={(e) => persistIrreg(irreg.map((x) => (x.id === ir.id ? { ...x, fundamento: e.target.value } : x)))} placeholder="Fundamento (CDC 51, Súmula, laudo…)" className={`${INPUT} mt-2`} />
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-zinc-400">Dica: a economia da aba <b>Revisional</b> (juros) e o provisionamento já entram no alvo acima — aqui vão os EXTRAS (tarifas, seguro, IOF, venda casada…).</p>
            </div>

            {/* Contratos (auditoria) */}
            <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Contratos deste banco</p></div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[#e3e8ef] px-2 py-1 text-[12px] font-medium text-[#48626f] hover:border-[#B7791F]/40 hover:text-[#B7791F] dark:border-zinc-700 dark:text-zinc-400"><FolderOpen className="h-3.5 w-3.5" /> Abrir contratos no Drive</a>}
                <span className="text-[11px] text-zinc-400">A auditoria por IA (Parecer Técnico) roda na ficha do cliente. Upload direto no banco: em breve (falta endpoint).</span>
              </div>
            </div>

            {/* Registro do acordo fechado */}
            <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center gap-1.5"><Handshake className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Acordo fechado?</p></div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {['Não', 'Em andamento', 'Sim'].map((o) => (
                  <button key={o} onClick={() => save({ ...d, acordoFez: o })} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition ${d.acordoFez === o ? 'border-[#B7791F] bg-[#B7791F]/10 text-[#B7791F]' : 'border-[#e3e8ef] text-zinc-500 hover:border-[#B7791F]/40 dark:border-zinc-700 dark:text-zinc-400'}`}>{o === 'Sim' ? 'Fechou acordo' : o === 'Não' ? 'Sem acordo' : 'Em andamento'}</button>
                ))}
              </div>
              {d.acordoFez === 'Sim' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={LABEL}>Valor do acordo<input value={d.acordoValor} onChange={(e) => save({ ...d, acordoValor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                  <label className={LABEL}>Desconto obtido<input value={d.acordoDesconto} onChange={(e) => save({ ...d, acordoDesconto: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                  <label className={LABEL}>Honorários (nossa parte)<input value={d.acordoHonorarios} onChange={(e) => save({ ...d, acordoHonorarios: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                  <label className={LABEL}>Honorários parceiros (terceiros)<input value={d.acordoHonorariosTerceiros} onChange={(e) => save({ ...d, acordoHonorariosTerceiros: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SOLICITAÇÕES (malotes: Consumidor.gov, BACEN, etc.) ── */}
        {tab === 'solicitacoes' && (
          <div>
            <div className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Solicitações / malotes</p>
              <span className="rounded bg-[#edeff3] px-1.5 text-[11px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{meusMal.length}</span>
              <button onClick={() => persistMal([...malRows, { id: novoId(), bancoId: party.id, banco: party.name, canal: 'Consumidor.gov', numero: '', dataEnvio: '', prazo: '', tentativa: '1', status: 'Aguardando', obs: '' }])} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#B7791F] hover:underline"><Plus className="h-3 w-3" /> Nova</button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Funil: Consumidor.gov → BACEN (RDR) → AR/Ouvidoria. Indeferido 3× → ação de exibição.</p>
            {meusMal.length === 0 && <p className="mt-2 text-[12px] text-zinc-400">Nenhuma solicitação para este banco.</p>}
            <div className="mt-2 space-y-2">
              {meusMal.map((mm) => (
                <div key={mm.id} className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MAL_COR[mm.status] ?? ''}`}>{mm.status}</span>
                    <input value={mm.numero} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, numero: e.target.value } : x)))} placeholder="Nº protocolo" className={`${INPUT} font-medium`} />
                    <button onClick={() => persistMal(malRows.filter((x) => x.id !== mm.id))} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className={LABEL}>Canal<select value={mm.canal} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, canal: e.target.value } : x)))} className={INPUT}>{MAL_CANAIS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
                    <label className={LABEL}>Status<select value={mm.status} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, status: e.target.value } : x)))} className={INPUT}>{MAL_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
                    <label className={LABEL}>Tentativa<select value={mm.tentativa} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, tentativa: e.target.value } : x)))} className={INPUT}><option value="1">1ª</option><option value="2">2ª</option><option value="3">3ª</option></select></label>
                    <label className={LABEL}>Enviado em<input type="date" value={mm.dataEnvio} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, dataEnvio: e.target.value } : x)))} className={INPUT} /></label>
                  </div>
                  <label className={`${LABEL} mt-2 block`}>Prazo p/ resposta<input type="date" value={mm.prazo} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, prazo: e.target.value } : x)))} className={INPUT} /></label>
                  <input value={mm.obs} onChange={(e) => persistMal(malRows.map((x) => (x.id === mm.id ? { ...x, obs: e.target.value } : x)))} placeholder="Observações / resposta do banco" className={`${INPUT} mt-2`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Aba REVISIONAL: recalcula o contrato tirando os juros abusivos (taxa média BACEN
// da modalidade) → mostra a ECONOMIA e a restituição. Chama o backend
// /calculadora-revisional/calcular (reusa o motor da outra sessão). Persiste os
// inputs + resultado em Party.metadata.revisional.
const IND_CORRECAO = ['INPC', 'IPCA-E', 'IPCA', 'IGP-M'] as const;
function RevisionalTab({ party, onChanged }: { party: PartyDetail; onChanged: () => void }) {
  const rev0: any = (party.metadata as any)?.revisional ?? {};
  const [f, setF] = useState({
    modalidade: rev0.modalidade ?? '', valorLiberado: rev0.valorLiberado ?? '', valorParcela: rev0.valorParcela ?? '',
    numeroParcelas: rev0.numeroParcelas ?? '', parcelasPagas: rev0.parcelasPagas ?? '', dataContratacao: rev0.dataContratacao ?? '',
    indiceCorrecao: (rev0.indiceCorrecao ?? 'INPC') as (typeof IND_CORRECAO)[number], dobro: rev0.dobro ?? false, modulacaoStj: rev0.modulacaoStj ?? true,
  });
  useEffect(() => { const r: any = (party.metadata as any)?.revisional ?? {}; setF((prev) => ({ ...prev, ...r })); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: modalidades = [] } = useQuery({ queryKey: ['revisional', 'modalidades'], queryFn: () => calculadoraRevisionalService.listarModalidades(), staleTime: Infinity });
  const [res, setRes] = useState<ResultadoRevisional | null>(rev0.resultado ?? null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const upd = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  const salvar = async (extra: Record<string, any>) => {
    try { await legalCasesService.updateParty(party.id, { name: party.name || 'Banco', role: 'OPPONENT', document: party.document ?? undefined, metadata: { ...((party.metadata as any) ?? {}), revisional: { ...f, ...extra } } }); onChanged(); } catch { /* best-effort */ }
  };
  const calcular = async () => {
    if (!f.modalidade || !f.dataContratacao) { setErro('Selecione a modalidade e a data de contratação.'); return; }
    setLoading(true); setErro('');
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const r = await calculadoraRevisionalService.calcular({
        modalidade: f.modalidade, valorLiberado: parseBRL(f.valorLiberado), valorParcela: parseBRL(f.valorParcela),
        numeroParcelas: Number(String(f.numeroParcelas).replace(/\D/g, '')) || 0, parcelasPagas: Number(String(f.parcelasPagas).replace(/\D/g, '')) || 0,
        dataContratacao: f.dataContratacao, dataBase: hoje, indiceCorrecao: f.indiceCorrecao, corrigir: true, dobro: f.dobro, modulacaoStj: f.modulacaoStj,
      });
      setRes(r); salvar({ resultado: r, economia: r.resumo.economiaTotal });
    } catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao calcular (confira os campos).'); } finally { setLoading(false); }
  };

  return (
    <div className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Ação revisional — recálculo pela taxa média BACEN</p></div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className={`${LABEL} col-span-2 sm:col-span-3`}>Modalidade (série BACEN)
          <select value={f.modalidade} onChange={(e) => { upd({ modalidade: e.target.value }); }} onBlur={() => salvar({})} className={INPUT}>
            <option value="">Selecione…</option>
            {modalidades.map((mo) => <option key={mo.key} value={mo.key}>{mo.label}</option>)}
          </select>
        </label>
        <label className={LABEL}>Valor liberado<input value={f.valorLiberado} onChange={(e) => upd({ valorLiberado: maskCurrencyBR(e.target.value) })} onBlur={() => salvar({})} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
        <label className={LABEL}>Valor da parcela<input value={f.valorParcela} onChange={(e) => upd({ valorParcela: maskCurrencyBR(e.target.value) })} onBlur={() => salvar({})} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
        <label className={LABEL}>Nº de parcelas<input value={f.numeroParcelas} onChange={(e) => upd({ numeroParcelas: e.target.value.replace(/\D/g, '') })} onBlur={() => salvar({})} inputMode="numeric" placeholder="0" className={INPUT} /></label>
        <label className={LABEL}>Parcelas pagas<input value={f.parcelasPagas} onChange={(e) => upd({ parcelasPagas: e.target.value.replace(/\D/g, '') })} onBlur={() => salvar({})} inputMode="numeric" placeholder="0" className={INPUT} /></label>
        <label className={LABEL}>Data da contratação<input type="date" value={f.dataContratacao} onChange={(e) => upd({ dataContratacao: e.target.value })} onBlur={() => salvar({})} className={INPUT} /></label>
        <label className={LABEL}>Índice de correção<select value={f.indiceCorrecao} onChange={(e) => { upd({ indiceCorrecao: e.target.value as any }); }} onBlur={() => salvar({})} className={INPUT}>{IND_CORRECAO.map((i) => <option key={i} value={i}>{i}</option>)}</select></label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={f.dobro} onChange={(e) => { upd({ dobro: e.target.checked }); }} /> Repetição em dobro (CDC 42)</label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={f.modulacaoStj} onChange={(e) => { upd({ modulacaoStj: e.target.checked }); }} /> Modulação STJ</label>
        <button onClick={calcular} disabled={loading} className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#B7791F] px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{loading ? 'Calculando…' : 'Calcular revisional'}</button>
      </div>
      {erro && <p className="mt-2 text-[12px] text-red-600">{erro}</p>}
      {res && (
        <div className="mt-3 border-t border-[#eef1f5] pt-2 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <Metric label="Parcela recalculada" value={brl(res.resumo.parcelaRecalculada)} sub={`de ${brl(res.resumo.parcelaContrato)}`} />
            <Metric label="Economia total" value={brl(res.resumo.economiaTotal)} sub="vs. contrato" />
            <Metric label="Pago a mais" value={brl(res.resumo.totalPagoAMais)} />
            <Metric label="Restituição atualizada" value={brl(res.resumo.restituicaoAtualizada)} sub={f.dobro ? 'em dobro' : 'simples'} />
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-400">Recálculo pela taxa média de mercado (BACEN) da modalidade na data. Compare com o acordo/provisionamento pra decidir: ação revisional × negociação.</p>
        </div>
      )}
    </div>
  );
}

// Plano de Repactuação (superendividamento · CDC 104-A/B) — NÍVEL DO CLIENTE:
// pega as dívidas (bancos réus) como credores + renda × comprometimento e simula o
// plano de pagamento em até 60 meses. Reusa calcularPlano() da outra sessão.
// Persiste renda/comprometimento em faseData.repb_plano.
export function PlanoRepactuacaoBlock({ caseId, parties, initialRenda, initialComprometimento, onChanged }: { caseId: string; parties: PartyDetail[]; initialRenda?: string; initialComprometimento?: string; onChanged?: () => void }) {
  const qc = useQueryClient();
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  const credores: Credor[] = reus.map((p) => ({ nome: p.name, valor: parseBRL((p.metadata as any)?.saldoDevedor ?? '') })).filter((c) => c.valor > 0);
  const [renda, setRenda] = useState(initialRenda ?? '');
  const [compr, setCompr] = useState(initialComprometimento ?? '30');
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = (r: string, cp: string) => {
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      try {
        await legalCasesService.saveFaseField(caseId, 'repb_plano', 'renda', r);
        await legalCasesService.saveFaseField(caseId, 'repb_plano', 'comprometimento', cp);
        qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] }); onChanged?.();
      } catch { /* best-effort */ }
    }, 700);
  };
  if (!credores.length) return null;
  const plano = calcularPlano({ rendaLiquida: parseBRL(renda), comprometimentoPct: (Number(compr) || 0) / 100, credores });

  return (
    <section className="rounded-xl border border-[#e3e8ef] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-1.5"><Calculator className="h-4 w-4 text-[#B7791F]" /><p className="text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Plano de repactuação (superendividamento · CDC 104-A/B)</p></div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className={LABEL}>Renda líquida mensal<input value={renda} onChange={(e) => { const v = maskCurrencyBR(e.target.value); setRenda(v); persist(v, compr); }} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
        <label className={LABEL}>% de comprometimento<input value={compr} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ''); setCompr(v); persist(renda, v); }} inputMode="numeric" placeholder="30" className={INPUT} /></label>
        <div className="flex flex-col justify-end"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Total a repactuar</p><p className="text-[14px] font-bold text-[#101820] dark:text-zinc-100">{brl(plano.totalRepactuar)}</p></div>
      </div>
      {parseBRL(renda) > 0 ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
            <Metric label="Disponível / mês" value={brl(plano.disponivelMensal)} />
            <Metric label="Prazo total" value={`${plano.mesesTotais} meses`} sub={plano.dentroDoTeto ? '≤ 60m ✓' : 'acima de 60m'} />
            <Metric label="Fases (readequações)" value={String(plano.fases)} />
          </div>
          {!plano.dentroDoTeto && <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600 dark:bg-red-500/10 dark:text-red-400">Excede o teto de 60 meses do plano — aumente a renda comprometida ou negocie desconto antes.</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-400"><tr><th className="py-1">Credor</th><th className="py-1 text-right">Dívida</th><th className="py-1 text-right">1ª parcela</th><th className="py-1 text-right">Quita em</th></tr></thead>
              <tbody>
                {plano.credores.map((c, i) => (
                  <tr key={i} className="border-t border-[#eef2f8] dark:border-zinc-800">
                    <td className="py-1 pr-2 text-[#101820] dark:text-zinc-200">{c.nome}</td>
                    <td className="py-1 text-right tabular-nums text-zinc-500">{brl(c.valor)}</td>
                    <td className="py-1 text-right tabular-nums font-medium text-[#101820] dark:text-zinc-100">{brl(c.parcelaInicial)}</td>
                    <td className="py-1 text-right tabular-nums text-zinc-500">{c.meses > 0 ? `${c.meses}m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="mt-2 text-[12px] text-zinc-400">Informe a renda líquida mensal para simular o plano.</p>}
      <p className="mt-1.5 text-[10px] text-zinc-400">Distribui o valor comprometido entre as dívidas mês a mês (realoca ao quitar). Base para a repactuação global (Lei 14.181/21).</p>
    </section>
  );
}

// Perda Esperada (PE = PD × LGD × EAD) — modelo forward-looking (Res. CMN 4.966),
// complementar ao provisionamento por atraso. PD sugerida pelo estágio; persiste em
// Party.metadata.pe. Reusa calcularPE() da outra sessão.
function PerdaEsperadaBlock({ party, saldo, estagioN, onChanged }: { party: PartyDetail; saldo: number; estagioN: number; onChanged: () => void }) {
  const pe0: any = (party.metadata as any)?.pe ?? {};
  const defaultPd = estagioN === 3 ? '100' : estagioN === 2 ? '30' : '5';
  const [pd, setPd] = useState<string>(pe0.pd ?? defaultPd);
  const [lgd, setLgd] = useState<string>(pe0.lgd ?? '45');
  useEffect(() => { const p: any = (party.metadata as any)?.pe ?? {}; if (p.pd != null) setPd(p.pd); if (p.lgd != null) setLgd(p.lgd); }, [party.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const persist = async (npd: string, nlgd: string) => { try { await legalCasesService.updateParty(party.id, { name: party.name || 'Banco', role: 'OPPONENT', document: party.document ?? undefined, metadata: { ...((party.metadata as any) ?? {}), pe: { pd: npd, lgd: nlgd } } }); onChanged(); } catch { /* best-effort */ } };
  const r = calcularPE({ ead: saldo, pd: (Number(pd) || 0) / 100, lgd: (Number(lgd) || 0) / 100 });
  return (
    <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Perda Esperada (PE = PD × LGD × EAD)</p></div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className={LABEL}>PD — prob. default (%)<input value={pd} onChange={(e) => setPd(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => persist(pd, lgd)} inputMode="numeric" className={INPUT} /></label>
        <label className={LABEL}>LGD — perda no default (%)<input value={lgd} onChange={(e) => setLgd(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => persist(pd, lgd)} inputMode="numeric" className={INPUT} /></label>
        <label className={LABEL}>EAD — exposição<input value={brl(saldo)} readOnly className={`${INPUT} opacity-70`} /></label>
      </div>
      {saldo > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Metric label="PE moderado" value={brl(r.peModerado)} sub={pct(r.pctModerado)} />
          <Metric label="Cenário otimista" value={brl(r.peOtimista)} />
          <Metric label="Cenário pessimista" value={brl(r.pePessimista)} />
        </div>
      ) : <p className="mt-2 text-[12px] text-zinc-400">Preencha o saldo devedor (aba Dados).</p>}
      <p className="mt-1.5 text-[10px] text-zinc-400">Modelo forward-looking (Res. CMN 4.966). PD sugerida pelo estágio; ajuste a LGD conforme garantia/histórico. Compare com o provisionamento por atraso acima.</p>
    </section>
  );
}

function Big({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'ink' | 'emerald' | 'gold' }) {
  const cor = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'gold' ? 'text-[#B7791F]' : 'text-[#101820] dark:text-zinc-100';
  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${cor}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-400">{sub}</p>}
    </div>
  );
}

// "Nesta fase" — o card exibe o conteúdo CERTO conforme a fase do caso (arquitetura
// por fase). Lê metadata.faseData + as partes (bancos). Read-only (a edição fina
// fica no dossiê/formulários). Cobre as 9 fases repb_.
const FASE_TITULO: Record<string, string> = {
  repb_novo_cliente: '01. Novos clientes — onboarding', repb_docs_faltantes: '02. Documentos faltantes — levantamento',
  repb_investigativa: '03. Fase investigativa — auditoria', repb_provisionamento: '04. Em provisionamento',
  repb_negociacao: '05. Negociação', repb_acao_judicial: '06. Ação judicial', repb_acordo: '07. Acordo / cumprimento',
  repb_concluido: 'Concluído', repb_inviavel: 'Inviável',
};
const CHECKLISTS: Record<string, { key: string; options: string[] }> = {
  repb_novo_cliente: { key: 'onboarding', options: ['Senha GOV solicitada', 'Formulário de dívidas preenchido', 'Reunião de apresentação agendada', 'Análise documental iniciada'] },
  repb_docs_faltantes: { key: 'levantamento', options: ['Extratos bancários (5 anos)', 'Contratos bancários', 'Boletos / planilhas de cobrança', 'SCR + Registrato (BACEN)', 'Histórico bancário (10 anos)', 'Demonstrativo de evolução da dívida', 'Protestos / cartórios', 'Serasa / SPC / Boa Vista'] },
  repb_investigativa: { key: 'auditoria', options: ['Taxa de juros × séries temporais BACEN', 'Capitalização (periodicidade pactuada?)', 'Seguro (autorização expressa?)', 'Tarifas', 'Vendas casadas'] },
};

export function RepbFaseCard({ phase, faseData, parties }: { phase: string | null | undefined; faseData: any; parties: PartyDetail[] }) {
  if (!phase || !phase.startsWith('repb_')) return null;
  const fd = (faseData ?? {})[phase] ?? {};
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  let body: React.ReactNode = null;

  const cl = CHECKLISTS[phase];
  if (cl) {
    const done: string[] = Array.isArray(fd[cl.key]) ? fd[cl.key] : [];
    const extra = phase === 'repb_novo_cliente' ? fd.tipo_pessoa : phase === 'repb_docs_faltantes' ? fd.adimplencia : fd.abusividade ? `Abusividade: ${fd.abusividade}` : null;
    body = (
      <>
        <div className="mb-1.5 flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400"><span className="font-semibold text-[#101820] dark:text-zinc-200">{done.length}/{cl.options.length}</span> concluídos{extra && <span className="ml-auto rounded-full bg-[#edeff3] px-2 py-0.5 text-[10px] font-medium text-[#48626f] dark:bg-zinc-800 dark:text-zinc-300">{extra}</span>}</div>
        <ul className="space-y-1">
          {cl.options.map((o) => { const ok = done.includes(o); return <li key={o} className={`flex items-center gap-2 text-[12px] ${ok ? 'text-[#101820] dark:text-zinc-200' : 'text-zinc-400'}`}><span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] ${ok ? 'bg-emerald-500 text-white' : 'border border-[#dcdfe5] dark:border-zinc-700'}`}>{ok ? '✓' : ''}</span>{o}</li>; })}
        </ul>
        {fd.obs && <p className="mt-2 rounded bg-[#fafbfc] p-1.5 text-[12px] text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400">{fd.obs}</p>}
      </>
    );
  } else if (phase === 'repb_provisionamento') {
    const provs = reus.map((p) => provValorDoBanco(p)).filter((v): v is number => v != null);
    const total = provs.reduce((a, v) => a + v, 0);
    const saldo = reus.reduce((a, p) => a + parseBRL((p.metadata as any)?.saldoDevedor ?? ''), 0);
    body = (
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Saldo total" value={brl(saldo)} />
        <Metric label="Provisionado" value={brl(total)} sub={`${provs.length}/${reus.length} bancos`} />
        <Metric label="Proposta alvo" value={brl(Math.max(0, saldo - total))} />
      </div>
    );
  } else if (phase === 'repb_negociacao') {
    const negs = reus.filter((p) => (p.metadata as any)?.negProposta || (p.metadata as any)?.negContraproposta || (p.metadata as any)?.situacao === 'Negociando');
    body = negs.length ? (
      <div className="space-y-1.5">
        {negs.map((p) => { const m: any = p.metadata ?? {}; return (
          <div key={p.id} className="flex items-center gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate font-medium text-[#101820] dark:text-zinc-200">{p.name}</span>
            {m.negProposta && <span className="shrink-0 text-zinc-500">env. {m.negProposta}</span>}
            {m.negContraproposta && <span className="shrink-0 text-zinc-400">↔ {m.negContraproposta}</span>}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIT_COR[m.situacao ?? 'Em análise'] ?? ''}`}>{m.negStatus ?? m.situacao}</span>
          </div>
        ); })}
      </div>
    ) : <p className="text-[12px] text-zinc-400">Sem bancos em negociação ativa.</p>;
  } else if (phase === 'repb_acao_judicial') {
    const jud = reus.filter((p) => (p.metadata as any)?.situacao === 'Judicializado' || (Array.isArray((p.metadata as any)?.tags) && (p.metadata as any).tags.some((t: string) => TAGS_ACAO.includes(t))));
    body = jud.length ? (
      <div className="space-y-1.5">
        {jud.map((p) => { const tags: string[] = ((p.metadata as any)?.tags ?? []).filter((t: string) => TAGS_ACAO.includes(t)); return (
          <div key={p.id} className="text-[12px]">
            <span className="font-medium text-[#101820] dark:text-zinc-200">{p.name}</span>
            <span className="ml-1.5 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagCor(t)}`}>{t}</span>)}</span>
          </div>
        ); })}
      </div>
    ) : <p className="text-[12px] text-zinc-400">Marque a ação cabível nas etiquetas de cada banco (Exibição de docs, Revisional, Superendividamento…).</p>;
  } else if (phase === 'repb_acordo' || phase === 'repb_concluido') {
    const fechados = reus.filter((p) => (p.metadata as any)?.acordoFez === 'Sim' || (p.metadata as any)?.situacao === 'Acordo fechado');
    body = fechados.length ? (
      <div className="space-y-1.5">
        {fechados.map((p) => { const m: any = p.metadata ?? {}; return (
          <div key={p.id} className="flex items-center gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate font-medium text-[#101820] dark:text-zinc-200">{p.name}</span>
            {m.acordoValor && <span className="shrink-0 text-emerald-600 dark:text-emerald-400">{m.acordoValor}</span>}
            {m.acordoDesconto && <span className="shrink-0 text-zinc-400">desc. {m.acordoDesconto}</span>}
          </div>
        ); })}
      </div>
    ) : <p className="text-[12px] text-zinc-400">Nenhum acordo fechado ainda.</p>;
  } else {
    return null; // repb_inviavel: sem card específico
  }

  return (
    <section className="rounded-xl border border-[#e3e8ef] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Nesta fase · {FASE_TITULO[phase] ?? phase}</p>
      {body}
    </section>
  );
}
