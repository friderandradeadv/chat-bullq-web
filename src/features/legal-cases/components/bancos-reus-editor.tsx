'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Gavel, ChevronDown, Landmark, Calculator, Handshake, LayoutGrid, List, MessagesSquare, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type PartyDetail } from '@/features/legal-cases/services/legal-cases.service';
import { maskCurrencyBR, maskCpfCnpj } from '@/lib/masks';
import { BANCOS_DIRETORIO, acharBancoContato } from '@/features/legal-cases/lib/bancos-diretorio';
import { calcularProvisao, OPERACOES, INSTITUICOES, type Carteira, type Instituicao } from '@/features/calculadora-provisionamento/provisionamento';

// DOSSIÊ POR BANCO do caso REPB. Cada banco RÉU (Party OPPONENT) é a unidade e
// concentra TUDO daquele banco num acordeão: situação/dados → provisionamento (com
// cálculo próprio) → acordo (fez/não fez + valores) → malotes daquele banco. Assim
// não fica espalhado em seções soltas. Persistência: dados/provisão/acordo em
// Party.metadata (updateParty); malotes na lista global faseData.repb_malotes.lista
// (saveFaseField), cada malote ligado ao banco por `bancoId` (fallback: nome).

const SITUACOES = ['Em análise', 'Malote enviado', 'Negociando', 'Acordo fechado', 'Judicializado', 'Sem acordo'];
const SIT_COR: Record<string, string> = {
  'Em análise': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  'Malote enviado': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Negociando: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'Acordo fechado': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Judicializado: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'Sem acordo': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};
const SIT_DOT: Record<string, string> = {
  'Em análise': 'bg-zinc-400', 'Malote enviado': 'bg-amber-500', Negociando: 'bg-sky-500',
  'Acordo fechado': 'bg-emerald-500', Judicializado: 'bg-violet-500', 'Sem acordo': 'bg-red-500',
};
const MAL_CANAIS = ['Consumidor.gov', 'BACEN (RDR)', 'AR / Correios', 'E-mail', 'Ouvidoria', 'Ação de exibição'];
const MAL_STATUS = ['Aguardando', 'Deferido', 'Indeferido', 'Parcial'];
const MAL_COR: Record<string, string> = {
  Aguardando: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Deferido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Indeferido: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  Parcial: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};
const ACCENT = '#B7791F';
const INPUT = 'h-8 w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 text-[13px] text-[#101820] outline-none focus:border-[#B7791F] dark:border-zinc-700 dark:text-zinc-200';
const LABEL = 'text-[10px] font-medium uppercase tracking-wide text-zinc-400';

const parseBRL = (s: string) => { let t = String(s ?? '').replace(/[^\d,.-]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const novoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.round(Math.random() * 1e6)}`);

export interface Malote { id: string; bancoId?: string; banco: string; canal: string; numero: string; dataEnvio: string; prazo: string; tentativa: string; status: string; obs: string; }

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

/** Provisão calculada dos inputs salvos do banco (null se ainda sem dados). */
function provValorDoBanco(p: PartyDetail): number | null {
  const m: any = p.metadata ?? {};
  const saldo = parseBRL(m.saldoDevedor ?? '');
  if (saldo <= 0 || (!m.provDias && !m.provOperacao)) return null;
  const carteira: Carteira = OPERACOES.find((o) => o.label === (m.provOperacao ?? guessOperacao(m.operacao ?? '')))?.carteira ?? 'C5';
  const dias = Math.max(0, Number(String(m.provDias ?? '').replace(/\D/g, '')) || 0);
  const inst: Instituicao = m.provInstituicao ?? guessInstituicao(p.name ?? '');
  return calcularProvisao({ saldoDevedor: saldo, carteira, dias, instituicao: inst }).valorProvisionado;
}

const NEG_STATUS = ['Não iniciada', 'Em negociação', 'Acordo aceito', 'Recusado'];
type Draft = {
  name: string; document: string; operacao: string; saldoDevedor: string; situacao: string; obs: string;
  provInstituicao: Instituicao; provOperacao: string; provDias: string;
  negInterlocutor: string; negProposta: string; negContraproposta: string; negStatus: string;
  acordoFez: string; acordoValor: string; acordoDesconto: string; acordoHonorarios: string;
};
const toDraft = (p: PartyDetail): Draft => {
  const m: any = p.metadata ?? {};
  return {
    name: p.name ?? '', document: p.document ?? '', operacao: m.operacao ?? '', saldoDevedor: m.saldoDevedor ?? '',
    situacao: m.situacao ?? 'Em análise', obs: m.obs ?? '',
    provInstituicao: m.provInstituicao ?? guessInstituicao(p.name ?? ''),
    provOperacao: m.provOperacao ?? guessOperacao(m.operacao ?? ''),
    provDias: m.provDias ?? '',
    negInterlocutor: m.negInterlocutor ?? '', negProposta: m.negProposta ?? '', negContraproposta: m.negContraproposta ?? '',
    negStatus: m.negStatus ?? (m.situacao === 'Negociando' ? 'Em negociação' : m.situacao === 'Acordo fechado' ? 'Acordo aceito' : 'Não iniciada'),
    acordoFez: m.acordoFez ?? (m.situacao === 'Acordo fechado' ? 'Sim' : ''),
    acordoValor: m.acordoValor ?? '', acordoDesconto: m.acordoDesconto ?? '', acordoHonorarios: m.acordoHonorarios ?? '',
  };
};

export function BancosReusEditor({ caseId, parties, malotes, onChanged }: { caseId: string; parties: PartyDetail[]; malotes?: Malote[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('Todos');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [fullscreen, setFullscreen] = useState(false);

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
      setFiltro('Todos'); setOpenId(novo.id); setView('lista'); onChanged();
    } catch { toast.error('Erro ao adicionar banco'); } finally { setAdding(false); }
  };

  // Arrastar um banco entre colunas do mini-kanban = trocar a situação (preserva o resto do metadata).
  const moverSituacao = async (p: PartyDetail, situacao: string) => {
    if ((p.metadata?.situacao ?? 'Em análise') === situacao) return;
    try {
      await legalCasesService.updateParty(p.id, { name: p.name || 'Banco', role: 'OPPONENT', document: p.document ?? undefined, metadata: { ...(p.metadata ?? {}), situacao } });
      onChanged();
    } catch { toast.error('Erro ao mover banco'); }
  };
  const abrirBanco = (id: string) => { setView('lista'); setOpenId(id); };

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[60] overflow-auto bg-white p-4 dark:bg-zinc-950' : 'rounded-lg border border-[#e3e8ef] bg-[#fafbfc] p-3 dark:border-zinc-800 dark:bg-zinc-900/40'}>
      <div className={`flex items-center gap-2 ${fullscreen ? 'mx-auto max-w-[1400px]' : ''}`}>
        <Gavel className="h-4 w-4 text-[#B7791F]" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Bancos réus{fullscreen ? ' — visão ampliada' : ''}</p>
        <span className="rounded bg-[#edeff3] px-1.5 text-[12px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{reus.length}</span>
        {saldoTotal > 0 && <span className="text-[11px] text-zinc-400">· {brl(saldoTotal)}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {reus.length > 0 && (
            <div className="inline-flex overflow-hidden rounded-md border border-[#e3e8ef] dark:border-zinc-700">
              <button onClick={() => setView('kanban')} title="Kanban por situação" className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold ${view === 'kanban' ? 'bg-[#B7791F]/10 text-[#B7791F]' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><LayoutGrid className="h-3.5 w-3.5" /> Kanban</button>
              <button onClick={() => setView('lista')} title="Lista / dossiê" className={`inline-flex items-center gap-1 border-l border-[#e3e8ef] px-2 py-1 text-[11px] font-semibold dark:border-zinc-700 ${view === 'lista' ? 'bg-[#B7791F]/10 text-[#B7791F]' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><List className="h-3.5 w-3.5" /> Lista</button>
            </div>
          )}
          {reus.length > 0 && (
            <button onClick={() => setFullscreen((v) => !v)} title={fullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'} className="inline-flex items-center rounded-md border border-[#e3e8ef] p-1.5 text-zinc-500 hover:border-[#B7791F]/40 hover:text-[#B7791F] dark:border-zinc-700">
              {fullscreen ? <X className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button onClick={addBanco} disabled={adding} className="inline-flex items-center gap-1 rounded-md border border-[#B7791F]/40 px-2 py-1 text-[12px] font-semibold text-[#B7791F] hover:bg-[#B7791F]/10 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Banco
          </button>
        </div>
      </div>
      <div className={fullscreen ? 'mx-auto max-w-[1400px]' : ''}>

      {reus.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#dcdfe5] py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">Nenhum banco réu cadastrado</p>}

      <datalist id="bancos-repb-dir">{BANCOS_DIRETORIO.map((b) => <option key={b.nome} value={b.nome} />)}</datalist>

      {view === 'kanban' && reus.length > 0 && (
        <BancosMiniKanban reus={reus} malotesCount={(p) => malotesDoBanco(p).length} onSelect={abrirBanco} onMove={moverSituacao} wide={fullscreen} />
      )}

      {view === 'lista' && (
        <>
          {reus.length > 1 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <FiltroChip label="Todos" count={reus.length} ativo={filtro === 'Todos'} onClick={() => setFiltro('Todos')} />
              {situacoesPresentes.map((s) => (
                <FiltroChip key={s} label={s} count={cont(s)} ativo={filtro === s} onClick={() => setFiltro(s)} />
              ))}
            </div>
          )}
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
        </>
      )}

      {malotesOrfaos.length > 0 && (
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

// Mini-kanban dos bancos DENTRO do card do cliente: colunas = situação. Arrasta
// pra mudar a situação, clica pra abrir o dossiê. Dá o "onde está cada um" num relance.
function BancosMiniKanban({ reus, malotesCount, onSelect, onMove, wide }: {
  reus: PartyDetail[];
  malotesCount: (p: PartyDetail) => number;
  onSelect: (id: string) => void;
  onMove: (p: PartyDetail, situacao: string) => void;
  wide?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const byId = new Map(reus.map((p) => [p.id, p]));
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[10px] text-zinc-400">Arraste um banco entre as colunas para mudar a situação · clique para abrir o dossiê.</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SITUACOES.map((sit) => {
          const items = reus.filter((p) => (p.metadata?.situacao ?? 'Em análise') === sit);
          const total = items.reduce((a, p) => a + parseBRL(p.metadata?.saldoDevedor ?? ''), 0);
          return (
            <div
              key={sit}
              onDragOver={(e) => { e.preventDefault(); setOverCol(sit); }}
              onDragLeave={() => setOverCol((c) => (c === sit ? null : c))}
              onDrop={() => { const p = dragId ? byId.get(dragId) : null; if (p) onMove(p, sit); setDragId(null); setOverCol(null); }}
              className={`flex shrink-0 flex-col rounded-lg border p-1.5 ${wide ? 'w-[240px] min-h-[60vh]' : 'w-[150px]'} ${overCol === sit ? 'border-[#B7791F] bg-[#B7791F]/5' : 'border-[#e3e8ef] bg-[#fafbfc] dark:border-zinc-800 dark:bg-zinc-900/40'}`}
            >
              <div className="flex items-center gap-1 px-0.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SIT_DOT[sit] ?? 'bg-zinc-300'}`} />
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#48626f]" title={sit}>{sit}</p>
                <span className="ml-auto rounded bg-[#edeff3] px-1 text-[10px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
              </div>
              {total > 0 && <p className="px-0.5 text-[9px] text-zinc-400">{brl(total)}</p>}
              <div className="mt-1 flex flex-1 flex-col gap-1">
                {items.map((p) => {
                  const prov = provValorDoBanco(p);
                  const nMal = malotesCount(p);
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => onSelect(p.id)}
                      className={`cursor-grab rounded-md border border-[#e3e8ef] bg-white p-1.5 text-left hover:border-[#B7791F]/50 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900/60 ${dragId === p.id ? 'opacity-40' : ''}`}
                    >
                      <p className="truncate text-[11px] font-medium text-[#101820] dark:text-zinc-100" title={p.name}>{p.name}</p>
                      {p.metadata?.saldoDevedor && <p className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">{p.metadata.saldoDevedor}</p>}
                      {(nMal > 0 || prov != null) && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-zinc-400">
                          {nMal > 0 && <span>📋 {nMal}</span>}
                          {prov != null && <span title="Provisionado">🏦 {brl(prov)}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
                {items.length === 0 && <div className="rounded-md border border-dashed border-[#e3e8ef] py-2 text-center text-[9px] text-zinc-300 dark:border-zinc-800">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
            operacao: next.operacao, saldoDevedor: next.saldoDevedor, situacao: next.situacao, obs: next.obs,
            provInstituicao: next.provInstituicao, provOperacao: next.provOperacao, provDias: next.provDias,
            negInterlocutor: next.negInterlocutor, negProposta: next.negProposta, negContraproposta: next.negContraproposta, negStatus: next.negStatus,
            acordoFez: next.acordoFez, acordoValor: next.acordoValor, acordoDesconto: next.acordoDesconto, acordoHonorarios: next.acordoHonorarios,
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

  const contato = acharBancoContato(d.name);
  const saldo = parseBRL(d.saldoDevedor);

  // Provisão calculada ao vivo a partir dos inputs do banco.
  const carteira: Carteira = OPERACOES.find((o) => o.label === d.provOperacao)?.carteira ?? 'C5';
  const dias = Math.max(0, Number(d.provDias.replace(/\D/g, '')) || 0);
  const prov = useMemo(() => (saldo > 0 ? calcularProvisao({ saldoDevedor: saldo, carteira, dias, instituicao: d.provInstituicao }) : null), [saldo, carteira, dias, d.provInstituicao]);

  return (
    <div className={`overflow-hidden rounded-lg border bg-white dark:bg-zinc-900/60 ${open ? 'border-[#B7791F]/50' : 'border-[#e3e8ef] dark:border-zinc-800'}`}>
      {/* Resumo — situação, saldo, malotes, acordo num relance */}
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-[#B7791F]/5">
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#101820] dark:text-zinc-100">{d.name || 'Banco'}</span>
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

          {/* ── Provisionamento (cálculo por banco) ── */}
          <section className="rounded-md border border-[#e3e8ef] bg-[#fafbfc] p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-[#B7791F]" /><p className={LABEL}>Provisionamento</p></div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className={LABEL}>Instituição<select value={d.provInstituicao} onChange={(e) => save({ ...d, provInstituicao: e.target.value as Instituicao })} className={INPUT}>{INSTITUICOES.map((i) => <option key={i.id} value={i.id}>{i.label.split(' (')[0]}</option>)}</select></label>
              <label className={LABEL}>Modalidade<select value={d.provOperacao} onChange={(e) => save({ ...d, provOperacao: e.target.value })} className={INPUT}>{OPERACOES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}</select></label>
              <label className={LABEL}>Dias de atraso<input value={d.provDias} onChange={(e) => save({ ...d, provDias: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="0" className={INPUT} /></label>
            </div>
            {prov ? (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Metric label="Provisionado" value={brl(prov.valorProvisionado)} sub={pct(prov.provisaoAplicadaPct)} />
                <Metric label="Proposta alvo" value={brl(prov.propostaAcordo)} sub={`desc. ${pct(prov.descontoPct)}`} />
                <Metric label="Estágio" value={`S${prov.estagio.n}`} sub={prov.anexo === 'I' ? 'ativo probl.' : 'em curso'} />
              </div>
            ) : <p className="mt-2 text-[11px] text-zinc-400">Preencha saldo + dias de atraso para calcular o provisionamento.</p>}
            {prov && (
              <button onClick={() => save({ ...d, acordoValor: brl(prov.propostaAcordo) })} className="mt-2 text-[11px] font-medium text-[#B7791F] hover:underline">↳ usar proposta como valor de acordo</button>
            )}
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
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className={LABEL}>Valor do acordo<input value={d.acordoValor} onChange={(e) => save({ ...d, acordoValor: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                <label className={LABEL}>Desconto obtido<input value={d.acordoDesconto} onChange={(e) => save({ ...d, acordoDesconto: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
                <label className={LABEL}>Honorários<input value={d.acordoHonorarios} onChange={(e) => save({ ...d, acordoHonorarios: maskCurrencyBR(e.target.value) })} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} /></label>
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-white px-1.5 py-1 dark:bg-zinc-900/60">
      <p className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-[12px] font-semibold text-[#101820] dark:text-zinc-100">{value}</p>
      {sub && <p className="text-[9px] text-zinc-400">{sub}</p>}
    </div>
  );
}

// Painel "Fase atual" do REPB, POR BANCO: em vez de despejar os campos da fase no
// nível do caso (confuso: "de quem é essa proposta?"), o advogado SELECIONA o banco
// e vê a situação daquele banco (negociação, provisionamento, acordo, malotes). A
// edição fina fica no dossiê (aba Dados). Só leitura aqui — visão de acompanhamento.
const ORDEM_SIT = ['Acordo fechado', 'Negociando', 'Malote enviado', 'Em análise', 'Judicializado', 'Sem acordo'];
export function RepbFasePorBanco({ parties, malotes }: { parties: PartyDetail[]; malotes?: Malote[] }) {
  const reus = parties.filter((p) => p.role === 'OPPONENT');
  const sorted = [...reus].sort((a, b) => ORDEM_SIT.indexOf(a.metadata?.situacao ?? 'Em análise') - ORDEM_SIT.indexOf(b.metadata?.situacao ?? 'Em análise'));
  const [sel, setSel] = useState<string>('');
  const p = reus.find((x) => x.id === sel) ?? sorted[0];

  if (!reus.length) return <p className="text-sm text-zinc-400">Nenhum banco réu cadastrado ainda — adicione no dossiê (aba Dados).</p>;

  const m: any = p?.metadata ?? {};
  const prov = p ? provValorDoBanco(p) : null;
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

          <div className="rounded-lg border border-[#e3e8ef] p-2.5 dark:border-zinc-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Negociação</p>
            <Linha k="Interlocutor" v={m.negInterlocutor} />
            <Linha k="Proposta enviada" v={m.negProposta} />
            <Linha k="Contraproposta do banco" v={m.negContraproposta} />
            <Linha k="Status" v={m.negStatus} />
            {!m.negInterlocutor && !m.negProposta && !m.negContraproposta && <p className="text-[12px] text-zinc-400">Sem dados de negociação ainda.</p>}
          </div>

          <div className="rounded-lg border border-[#e3e8ef] p-2.5 dark:border-zinc-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Provisionamento</p>
            {prov != null ? <Linha k="Provisionado (estimado)" v={brl(prov)} /> : <p className="text-[12px] text-zinc-400">Preencha modalidade + dias de atraso no dossiê.</p>}
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
