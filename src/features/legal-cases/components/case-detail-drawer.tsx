'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Scale, Phone, ExternalLink, AlarmClock, CalendarClock, Newspaper, Paperclip, User, ArrowRight, ChevronUp, ChevronDown, Check, Pencil, Trash2, Plus, Sparkles, Upload, Calculator, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanPhase, type MovementItem, type PublicationRef, type PartyDetail, type CaseDetail,
} from '@/features/legal-cases/services/legal-cases.service';

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
import { membersService } from '@/features/settings/services/members.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { FaseFields } from './fase-fields';
import { OpponentCombobox } from './opponent-combobox';
import { maskCurrencyBR, currencyToInput, maskCpfCnpj } from '@/lib/masks';

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MAGENTA = '#f51f7e';
const BLUE = '#005efc';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtMoney = (v: string | null) => {
  const n = v == null ? NaN : Number(v);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const fmtPhone = (p: string | null) => {
  const d = (p ?? '').replace(/\D/g, '');
  if (d.length < 12) return p ?? '';
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
};
// "[\"BPC/LOAS\"]" / "[\"RMC\",\"RCC\"]" → "BPC/LOAS" / "RMC · RCC"
const cleanArea = (s: string | null): string | null => {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.join(' · '); } catch { /* */ } }
  return t.replace(/^\[|\]$/g, '').replace(/"/g, '').trim();
};
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
// Fases da raia pré-judicial e detecção de produto bancário (RMC/RCC) — gate da
// seção "Contratos a impugnar".
const PRE_PHASES = new Set(['novos_clientes', 'reuniao_agendada', 'info_faltantes', 'montar_inicial', 'revisao_inicial', 'para_correcao', 'revisao_final', 'protocolo', 'inss_admin']);
// Cor da etiqueta por produto (igual ao card do kanban).
const produtoColor = (p: string | null): { bg: string; fg: string } => {
  const s = (cleanArea(p) ?? '').toUpperCase();
  if (/DOEN/.test(s)) return { bg: 'rgb(229,176,80)', fg: '#101820' };
  if (/IDADE/.test(s)) return { bg: 'rgb(250,201,0)', fg: '#101820' };
  if (/BPC|LOAS/.test(s)) return { bg: 'rgb(248,231,28)', fg: '#101820' };
  if (/TRABALH|RESCIS|FERIAS/.test(s)) return { bg: 'rgb(255,161,0)', fg: '#101820' };
  if (/PORTABIL|REVISIONAL|CONSIGNAD|CONSUMID/.test(s)) return { bg: 'rgb(74,144,226)', fg: '#fff' };
  if (/RMC/.test(s)) return { bg: 'rgb(208,2,27)', fg: '#fff' };
  if (/RCC/.test(s)) return { bg: 'rgb(155,28,63)', fg: '#fff' };
  if (/CONTRIBUI/.test(s)) return { bg: 'rgb(32,164,140)', fg: '#fff' };
  if (/SEGURO|TARIFA|MATERN/.test(s)) return { bg: 'rgb(126,87,194)', fg: '#fff' };
  return { bg: 'rgb(209,209,209)', fg: '#101820' };
};

const LEFT_TABS = [
  { key: 'dados', label: 'Dados' },
  { key: 'atividades', label: 'Atividades' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'anexos', label: 'Anexos' },
] as const;
type TabKey = (typeof LEFT_TABS)[number]['key'];

const movLabel = (s: string | null) =>
  s === 'auto:djen' ? { t: 'Automático', c: 'bg-[#f51f7e]/10 text-[#e11970]' }
  : s === 'DJEN' ? { t: 'DJEN', c: 'bg-[#228BE6]/10 text-[#1971c2] dark:text-[#74c0fc]' }
  : { t: 'Manual', c: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' };

export function CaseDetailDrawer({
  caseId, phases, onClose,
}: {
  caseId: string; phases: KanbanPhase[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('dados');
  const [picker, setPicker] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(true);

  const { data: c, isLoading } = useQuery({
    queryKey: ['legal-cases', 'detail', caseId],
    queryFn: () => legalCasesService.get(caseId),
  });
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });

  const onChangeResp = async (userId: string) => {
    if (!c) return;
    try {
      await legalCasesService.update(c.id, { responsibleId: userId || undefined });
      toast.success('Responsável atualizado');
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
    } catch { toast.error('Erro ao atualizar responsável'); }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const pf = (c?.metadata as any)?.pipefy ?? {};
  const cliente = c?.parties?.find((p) => p.role === 'CLIENT') ?? null;
  const adversa = c?.parties?.find((p) => p.role === 'OPPONENT') ?? null;
  const phaseKey = (c as any)?.legalPhase as string | undefined;
  const fase = phases.find((p) => p.key === phaseKey);
  const faseData = (c?.metadata as any)?.faseData?.[phaseKey ?? ''] ?? {};
  const showJuizo = pf.juizo && String(pf.juizo).trim().toLowerCase() !== String(c?.court ?? '').trim().toLowerCase();

  const onMove = async (phase: string) => {
    if (!c) return;
    setPicker(false);
    try {
      await legalCasesService.movePhase(c.id, phase);
      toast.success('Fase atualizada');
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
    } catch { toast.error('Erro ao mover'); }
  };

  const onRemove = async () => {
    if (!c || !confirm('Excluir este processo? Ele é arquivado (o histórico é preservado).')) return;
    try {
      await legalCasesService.remove(c.id);
      toast.success('Processo excluído');
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      onClose();
    } catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ fontFamily: INTER }}>
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />
      <div className="relative flex h-[608px] max-h-[90vh] w-[944px] max-w-[96vw] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-zinc-950">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
          <X className="h-5 w-5" />
        </button>

        {/* ── PAINEL ESQUERDO ── */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[#cfe0ed] dark:border-zinc-800">
          <div className="px-8 pt-6">
            <h2 className="truncate pr-12 text-[20px] font-bold uppercase leading-6 text-black dark:text-zinc-100">{(cliente?.name ?? c?.title ?? '…').toUpperCase()}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-[#cfe0ed] pb-3 dark:border-zinc-800">
              {c?.responsible && (c.responsible.avatarUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.responsible.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{(c.responsible.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>)}
              {c?.area && (() => { const col = produtoColor(c.area); return <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: col.bg, color: col.fg }}>{cleanArea(c.area)}</span>; })()}
              {adversa && <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f4] px-2 py-1 text-[10px] font-semibold text-[#48626f] dark:bg-zinc-800 dark:text-zinc-300">× {adversa.name}</span>}
            </div>
            {/* abas (pills) */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {LEFT_TABS.map((t) => {
                const n = t.key === 'atividades' ? c?.movements.length
                  : t.key === 'publicacoes' ? c?.publications.length
                  : t.key === 'anexos' ? c?.documents.length : undefined;
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`rounded-full px-2 py-1 text-sm transition-colors ${active ? 'bg-[#edeff3] text-[#4b5863] dark:bg-zinc-800 dark:text-zinc-200' : 'text-[#4b5863] hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60'}`}>
                    {t.label}{n != null && <span className="ml-1 text-xs text-zinc-400">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto px-8 pb-6">
            {isLoading && <p className="py-6 text-sm text-zinc-400">Carregando…</p>}
            {c && tab === 'dados' && (
              <>
                <DadosForm c={c} pf={pf} showJuizo={showJuizo} onSaved={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })} />

                <ResumoAtendimento
                  caseId={c.id}
                  resumo={(c.metadata as any)?.atendimentoResumo?.texto ?? null}
                  geradoEm={(c.metadata as any)?.atendimentoResumo?.geradoEm ?? null}
                  onDone={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })}
                />

                {/* Cadastro do CLIENTE (card conexão, expansível) */}
                {cliente && (() => {
                  const cad: any = cliente.contact?.metadata?.cadastro ?? {};
                  const cpf = cad.cpf || cliente.document;
                  return (
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Cadastro do cliente</p>
                      <article className="mt-1.5 rounded border border-[#cfe0ed] shadow-[rgba(38,50,56,0.05)_0px_4px_8px_0px] dark:border-zinc-800">
                        <button onClick={() => setCadastroOpen((o) => !o)} className="flex w-full items-center gap-2 p-3 text-left">
                          <User className="h-4 w-4 shrink-0 text-[#228BE6]" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-black dark:text-zinc-100">{cliente.name}</span>
                          {cpf && !cadastroOpen && <span className="shrink-0 text-[11px] text-[#48626f] dark:text-zinc-400">{cad.cnpj ? 'CNPJ' : 'CPF'} {cad.cnpj || cpf}</span>}
                          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${cadastroOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {cadastroOpen && (
                          <ul className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[#eef2f8] p-3 dark:border-zinc-800">
                            {cpf && <DbField label={cad.cnpj ? 'CNPJ' : 'CPF'} value={cad.cnpj || cpf!} />}
                            {cad.rg && <DbField label="RG" value={cad.rg} />}
                            {cad.estadoCivil && <DbField label="Estado civil" value={cad.estadoCivil} />}
                            {cad.profissao && <DbField label="Profissão" value={cad.profissao} />}
                            {cliente.contact?.phone && (
                              <li className="flex flex-col">
                                <span className="text-[10px] font-semibold uppercase text-[#48626f]">Telefone</span>
                                <a href={`https://wa.me/${cliente.contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                                  <Phone className="h-3 w-3" /> {fmtPhone(cliente.contact.phone)}
                                </a>
                              </li>
                            )}
                            {cliente.contact?.email && <DbField label="E-mail" value={cliente.contact.email} />}
                            {cad.socio && <DbField label="Sócio administrador" value={cad.socio} />}
                            {cad.login && <DbField label="Login Meu INSS / gov.br" value={cad.login} />}
                            {cad.senha && <DbField label="Senha Meu INSS / gov.br" value={cad.senha} />}
                            {cad.representadoNome && <DbField label="Representado" value={cad.representadoNome} />}
                            {cad.representadoCpf && <DbField label="CPF do representado" value={cad.representadoCpf} />}
                            {cad.endereco && <li className="col-span-2 flex flex-col"><span className="text-[10px] font-semibold uppercase text-[#48626f]">Endereço</span><span className="text-xs text-black dark:text-zinc-200">{cad.endereco}</span></li>}
                            {cliente.contact?.conversations?.[0] && (
                              <li className="col-span-2 flex flex-col">
                                <span className="text-[10px] font-semibold uppercase text-[#48626f]">Conversa</span>
                                <a href={`/inbox?conversation=${cliente.contact.conversations[0].id}`} className="inline-flex items-center gap-1 text-xs text-[#228BE6] hover:underline">
                                  Abrir conversa <ArrowRight className="h-3 w-3" />
                                </a>
                              </li>
                            )}
                          </ul>
                        )}
                      </article>
                      <ClienteFinanceiro nome={cliente.name} />
                    </div>
                  );
                })()}

                {/* Parte adversa (editável) */}
                <AdversaEditor caseId={c.id} adversa={adversa} onChanged={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })} />

                {/* Contratos a impugnar + gerar iniciais (intake pré-judicial). Disponível
                    em TODA fase pré (HISCON/HISCRE são opcionais) — não fica escondido só
                    porque o card veio com etiqueta genérica/sem produto. */}
                {phaseKey && PRE_PHASES.has(phaseKey) && (
                  <ContratosImpugnar
                    caseId={c.id}
                    phaseKey={phaseKey}
                    initial={((c.metadata as any)?.contratos ?? []) as any[]}
                    onChanged={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })}
                  />
                )}

                {/* Cálculo RMC/RCC: abre a calculadora nativa pré-preenchida (HISCON/
                    HISCRE → conversão + restituição) e salva o total como valor da causa. */}
                {phaseKey && PRE_PHASES.has(phaseKey) && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Cálculo RMC/RCC</p>
                      <a
                        href={`/juridico/calculos/rmc-rcc?case=${c.id}&cliente=${encodeURIComponent(cliente?.name ?? c.title ?? '')}&banco=${encodeURIComponent(adversa?.name ?? '')}&tipo=${encodeURIComponent(cleanArea(c.area) ?? '')}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#005efc] hover:underline"
                      >
                        <Calculator className="h-3.5 w-3.5" /> Calcular RMC/RCC
                      </a>
                    </div>
                    {(() => {
                      const calc = (c.metadata as any)?.calculo;
                      if (!calc) {
                        return <p className="mt-1.5 text-xs italic text-zinc-400">Abra a calculadora (HISCON/HISCRE → conversão + restituição) e salve aqui — vira o valor da causa.</p>;
                      }
                      return (
                        <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/15">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            {fmtMoney(calc.total)} <span className="font-normal">— valor da causa</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            {calc.cenarioTitulo ?? calc.cenario}{calc.config?.banco ? ` · ${calc.config.banco}` : ''}
                          </p>
                        </div>
                      );
                    })()}
                    <InicialActions caseId={c.id} jg={(c.metadata as any)?.jg} onChanged={() => qc.invalidateQueries({ queryKey: ['legal-cases'] })} />
                  </div>
                )}

                {pf.recordUrl && (
                  <a href={pf.recordUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-[#228BE6] hover:underline">
                    Ver no Pipefy <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="mt-6 border-t border-[#eef2f8] pt-3 dark:border-zinc-800">
                  <button onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 hover:underline">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir processo
                  </button>
                </div>
              </>
            )}
            {c && tab === 'atividades' && <Atividades movements={c.movements} />}
            {c && tab === 'publicacoes' && (
              c.publications.length === 0 ? <Empty t="Nenhuma publicação vinculada" />
              : <ul className="space-y-2">{c.publications.map((p) => <PubItem key={p.id} p={p} />)}</ul>
            )}
            {c && tab === 'anexos' && (
              c.documents.length === 0 ? <Empty t="Nenhum anexo" />
              : <ul className="space-y-2">{c.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded border border-[#cfe0ed] p-3 dark:border-zinc-800">
                    <Paperclip className="h-4 w-4 shrink-0 text-[#48626f]" />
                    {d.url
                      ? <a href={d.url} target="_blank" rel="noreferrer" download={d.name} className="flex-1 truncate text-sm font-medium text-[#005efc] hover:underline">{d.name}</a>
                      : <span className="flex-1 truncate text-sm text-black dark:text-zinc-100">{d.name}</span>}
                    <span className="shrink-0 text-xs text-zinc-400">{fmtSize(d.sizeBytes)}</span>
                  </li>
                ))}</ul>
            )}
          </div>
        </div>

        {/* ── PAINEL DIREITO: FASE ATUAL ── */}
        <div className="relative flex w-[420px] shrink-0 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-base font-semibold text-black dark:text-zinc-100">Fase atual</h3>
            <p className="mt-1 text-xs font-semibold" style={{ color: MAGENTA }}>{fase?.label ?? '—'}</p>

            <div className="mt-5">
              <p className="text-sm font-medium text-[#101820] dark:text-zinc-200">Responsável</p>
              <div className="mt-1.5 flex items-center gap-2">
                {c?.responsible && (c.responsible.avatarUrl
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.responsible.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4a90e2] text-[9px] font-bold text-white">{(c.responsible.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>)}
                <select
                  value={c?.responsible?.id ?? ''}
                  onChange={(e) => onChangeResp(e.target.value)}
                  disabled={!c}
                  className="h-8 flex-1 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="">Sem responsável</option>
                  {members.filter((m) => m.user.isActive).map((m) => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {c && phaseKey && (
              <div className="mt-5">
                <FaseFields caseId={c.id} phase={phaseKey} data={faseData} />
              </div>
            )}

            {c && c.deadlines.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-[#101820] dark:text-zinc-200">Prazos</p>
                <ul className="mt-2 space-y-2">
                  {c.deadlines.map((d) => (
                    <li key={d.id} className="rounded border border-[#cfe0ed] p-2.5 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <AlarmClock className="h-3.5 w-3.5 text-[#228BE6]" />
                        <span className="text-xs font-medium text-[#101820] dark:text-zinc-100">{d.title}</span>
                        {d.type === 'FATAL' && <span className="rounded bg-red-100 px-1 text-[9px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">fatal</span>}
                      </div>
                      <p className="mt-1 text-[11px] text-[#48626f] dark:text-zinc-400">Segurança {fmtDate(d.safeDate)} · Fatal <b className="text-red-600 dark:text-red-400">{fmtDate(d.dueDate)}</b></p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c && c.events.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-[#101820] dark:text-zinc-200">Agenda</p>
                <ul className="mt-2 space-y-2">
                  {c.events.map((e) => (
                    <li key={e.id} className="rounded border border-[#cfe0ed] p-2.5 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-[#228BE6]" />
                        <span className="text-xs font-medium text-[#101820] dark:text-zinc-100">{e.title}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#48626f] dark:text-zinc-400">{fmtDateTime(e.startsAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Mover para fase (botão grande) */}
          <div className="relative border-t border-[#eef2f8] p-4 dark:border-zinc-800">
            {picker && (
              <div className="absolute bottom-[68px] left-4 right-4 max-h-72 overflow-y-auto rounded-lg border border-[#cfe0ed] bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                {phases.map((p) => (
                  <button key={p.key} onClick={() => onMove(p.key)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${p.key === fase?.key ? 'font-semibold text-[#e11970]' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {p.label}{p.key === fase?.key && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setPicker((v) => !v)} disabled={!c}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: BLUE }}>
              Mover para fase <ChevronUp className={`h-4 w-4 transition-transform ${picker ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono, strong }: { label: string; value: string | null; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium leading-5 text-[#101820] dark:text-zinc-300">{label}</p>
      <p className={`mt-1 text-xs text-[#101820] dark:text-zinc-200 ${mono ? 'font-mono' : ''} ${strong ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function DbField({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase text-[#48626f]">{label}</span>
      <span className="text-xs text-black dark:text-zinc-200">{value}</span>
    </li>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">{label}</span>
      {children}
    </div>
  );
}

// Cruza o financeiro com o cliente: recebido, a receber e parcelamentos (inclui ASAAS).
function ClienteFinanceiro({ nome }: { nome: string }) {
  const { data } = useQuery({ queryKey: ['financeiro', 'cliente', nome], queryFn: () => financeiroService.clienteResumo(nome), enabled: !!nome, staleTime: 60_000 });
  if (!data) return null;
  const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  if (!data.recebido && !data.aReceber && !data.cobrancas.length) return null;
  return (
    <article className="mt-2 rounded-xl border border-[#cfe0ed] bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Financeiro do cliente</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[10px] uppercase text-[#48626f]">Recebido</p><p className="text-sm font-bold text-emerald-600">{brl(data.recebido)}</p></div>
        <div><p className="text-[10px] uppercase text-[#48626f]">A receber</p><p className="text-sm font-bold text-amber-600">{brl(data.aReceber)}</p></div>
        <div><p className="text-[10px] uppercase text-[#48626f]">Lançamentos</p><p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{data.nLancamentos}</p></div>
      </div>
      {data.ultimoPagamento && <p className="mt-1.5 text-[11px] text-[#48626f]">Último pagamento: {data.ultimoPagamento}</p>}
      {data.cobrancas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.cobrancas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs dark:bg-zinc-800/50">
              <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{c.descricao || 'Parcelamento'} · {c.pagas}/{c.nParcelas}{c.fonte === 'asaas' ? ' · ASAAS' : ''}{c.proximaParcela ? ` · próx. ${c.proximaParcela.vencimento}` : ''}</span>
              <span className={`shrink-0 font-semibold ${c.saldoDevedor > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>{c.saldoDevedor > 0.01 ? `${brl(c.saldoDevedor)} aberto` : 'quitado'}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// Cadastro/edição da parte adversa (cria/edita/remove a party role=OPPONENT).
function AdversaEditor({ caseId, adversa, onChanged }: { caseId: string; adversa: PartyDetail | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(adversa?.name ?? '');
  const [doc, setDoc] = useState(maskCpfCnpj(adversa?.document ?? ''));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(adversa?.name ?? ''); setDoc(maskCpfCnpj(adversa?.document ?? '')); }, [adversa?.id]);

  const save = async () => {
    if (!name.trim()) { toast.error('Informe o nome da parte adversa'); return; }
    setBusy(true);
    try {
      if (adversa) await legalCasesService.updateParty(adversa.id, { name: name.trim(), role: 'OPPONENT', document: doc.trim() || undefined });
      else await legalCasesService.addParty(caseId, { role: 'OPPONENT', name: name.trim(), document: doc.trim() || undefined });
      toast.success('Parte adversa salva'); setEditing(false); onChanged();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!adversa || !confirm('Remover a parte adversa?')) return;
    setBusy(true);
    try { await legalCasesService.removeParty(adversa.id); toast.success('Parte adversa removida'); onChanged(); }
    catch { toast.error('Erro ao remover'); } finally { setBusy(false); }
  };

  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Cadastro da parte adversa</p>
      {editing ? (
        <div className="mt-1.5 space-y-2 rounded border border-[#cfe0ed] p-3 dark:border-zinc-800">
          <OpponentCombobox
            value={name}
            onSelect={(s) => {
              setName(s.name);
              if (s.document) setDoc(maskCpfCnpj(s.document));
            }}
            placeholder="Nome (ex.: BANCO BMG S/A)"
          />
          <input value={doc} onChange={(e) => setDoc(maskCpfCnpj(e.target.value))} placeholder="CPF/CNPJ (opcional)" className={INPUT} inputMode="numeric" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditing(false); setName(adversa?.name ?? ''); setDoc(maskCpfCnpj(adversa?.document ?? '')); }} className="rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={save} disabled={busy} className="rounded bg-[#005efc] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      ) : adversa ? (
        <article className="mt-1.5 flex items-start justify-between gap-2 rounded border border-[#cfe0ed] p-3 dark:border-zinc-800">
          <div className="min-w-0">
            <span className="text-sm font-medium text-black dark:text-zinc-100">{adversa.name}</span>
            {adversa.document && <p className="mt-1 text-xs text-[#48626f] dark:text-zinc-400">CNPJ: {adversa.document}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setEditing(true)} title="Editar" className="rounded p-1 text-zinc-400 hover:text-[#228BE6]"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={remove} disabled={busy} title="Remover" className="rounded p-1 text-zinc-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </article>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-1.5 inline-flex items-center gap-1 rounded border border-dashed border-[#cfe0ed] px-3 py-2 text-xs font-medium text-[#005efc] hover:bg-[#005efc]/5 dark:border-zinc-700">
          <Plus className="h-3.5 w-3.5" /> Cadastrar parte adversa
        </button>
      )}
    </div>
  );
}

// Contratos a impugnar (intake pré-judicial bancário): cada linha = banco × produto
// × valor. "Sugerir com IA" lê a conversa; "Gerar iniciais" desmembra em 1 card por
// linha (na fase Montar inicial) e arquiva o intake.
type CRow = { id: string; reu: string; produto: string; valor: string };
const PRODUTOS_IMPUGNAR = ['RMC', 'RCC', 'Empréstimo consignado', 'Portabilidade', 'Revisional'];
// Chave de deduplicação banco × produto (sem acento/caixa) — evita o card repetido
// quando o mesmo contrato vem do HISCON e do HISCRE.
const contratoKey = (reu: string, produto: string) =>
  `${(reu || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()}|${(produto || '').toLowerCase().trim()}`;
const rowId = () => `ct_${Math.round(Math.random() * 1e9)}`;
const fmtValorBR = (n: number | null) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const parseValorBR = (s: string): number | null => {
  const t = (s || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
};

function ContratosImpugnar({ caseId, phaseKey, initial, onChanged }: { caseId: string; phaseKey: string | undefined; initial: any[]; onChanged: () => void }) {
  const [rows, setRows] = useState<CRow[]>(() =>
    (initial ?? []).map((c: any) => ({ id: c.id || rowId(), reu: c.reu ?? '', produto: c.produto ?? 'RMC', valor: c.valor != null ? fmtValorBR(Number(c.valor)) : '' })),
  );
  const [sug, setSug] = useState(false);
  const [sav, setSav] = useState(false);
  const [hiscon, setHiscon] = useState(false);
  const [hiscre, setHiscre] = useState(false);

  const setRow = (id: string, patch: Partial<CRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { id: rowId(), reu: '', produto: 'RMC', valor: '' }]);
  const rmRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
  const payload = () => rows.filter((r) => r.reu.trim()).map((r) => ({ id: r.id, reu: r.reu.trim(), produto: r.produto.trim() || 'RMC', valor: parseValorBR(r.valor) }));
  // Adiciona contratos (HISCON/HISCRE) deduplicando por banco×produto contra o que
  // já está na lista — só popula pra você revisar (NÃO cria card-filhote).
  const mergeContratos = (contratos: { id?: string; reu: string; produto?: string | null; valor?: number | null }[]): number => {
    const seen = new Set(rows.map((x) => contratoKey(x.reu, x.produto)));
    const add = contratos
      .filter((c) => !seen.has(contratoKey(c.reu, c.produto || 'RMC')))
      .map((c) => ({ id: c.id || rowId(), reu: c.reu, produto: c.produto || 'RMC', valor: c.valor != null ? fmtValorBR(Number(c.valor)) : '' }));
    if (add.length) {
      setRows((r) => {
        const seen2 = new Set(r.map((x) => contratoKey(x.reu, x.produto)));
        return [...r, ...add.filter((c) => !seen2.has(contratoKey(c.reu, c.produto)))];
      });
    }
    return add.length;
  };

  const salvar = async () => {
    setSav(true);
    try { await legalCasesService.saveContratos(caseId, payload()); toast.success('Contratos salvos'); onChanged(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); } finally { setSav(false); }
  };
  const sugerir = async () => {
    setSug(true);
    try {
      const { contratos } = await legalCasesService.sugerirContratos(caseId);
      setRows((contratos ?? []).map((c) => ({ id: c.id || rowId(), reu: c.reu, produto: c.produto || 'RMC', valor: c.valor != null ? fmtValorBR(Number(c.valor)) : '' })));
      toast.success(contratos?.length ? `${contratos.length} sugestão(ões) da IA — confira e salve` : 'A IA não achou bancos/produtos claros na conversa');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao sugerir'); } finally { setSug(false); }
  };
  const fileToB64 = (file: File) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    fr.readAsDataURL(file);
  });
  // Upload do HISCON (PDF) → IA extrai os contratos RMC/RCC ativos e POPULA as
  // linhas (deduplicando) — NÃO cria card. Você revisa, marca quais quer e clica
  // "Gerar iniciais". Era isso que criava cards repetidos a cada upload.
  const onHiscon = async (file?: File | null) => {
    if (!file) return;
    setHiscon(true);
    try {
      const { contratos } = await legalCasesService.uploadHiscon(caseId, await fileToB64(file));
      if (!contratos?.length) { toast.info('Nenhum contrato RMC/RCC ativo encontrado no HISCON'); return; }
      const novas = mergeContratos(contratos);
      toast.success(novas ? `HISCON lido — ${novas} contrato(s) adicionado(s). Marque os que quer e clique em Gerar iniciais.` : 'HISCON lido — nada novo além do que já estava listado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao processar o HISCON');
    } finally { setHiscon(false); }
  };
  // Upload do HISCRE (PDF) — complementar. Mesma lógica: popula+deduplica, não cria.
  const onHiscre = async (file?: File | null) => {
    if (!file) return;
    setHiscre(true);
    try {
      const { contratos } = await legalCasesService.uploadHiscre(caseId, await fileToB64(file));
      if (!contratos?.length) { toast.info('Nenhuma consignação RMC/RCC ativa encontrada no HISCRE'); return; }
      const novas = mergeContratos(contratos);
      toast.success(novas ? `HISCRE lido — ${novas} consignação(ões) adicionada(s) para revisão` : 'HISCRE lido — nada novo além do que já estava listado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao processar o HISCRE');
    } finally { setHiscre(false); }
  };
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Contratos a impugnar</p>
        <div className="flex items-center gap-3">
          <label className={`inline-flex items-center gap-1 text-xs font-medium text-[#005efc] hover:underline ${hiscon ? 'opacity-50' : 'cursor-pointer'}`} title="Lê o HISCON e POPULA os contratos RMC/RCC nas linhas (deduplicando). Não cria card nenhum — é só a lista de contratos do cliente.">
            <Upload className="h-3.5 w-3.5" /> {hiscon ? 'Lendo HISCON…' : 'Upar HISCON'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={hiscon}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onHiscon(f); }} />
          </label>
          <label className={`inline-flex items-center gap-1 text-xs font-medium text-[#005efc] hover:underline ${hiscre ? 'opacity-50' : 'cursor-pointer'}`} title="HISCRE (complementar): lê e ADICIONA as consignações nas linhas (deduplicando) — não cria card.">
            <Upload className="h-3.5 w-3.5" /> {hiscre ? 'Lendo HISCRE…' : 'Upar HISCRE'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={hiscre}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onHiscre(f); }} />
          </label>
          <button onClick={sugerir} disabled={sug} className="inline-flex items-center gap-1 text-xs font-medium text-[#7048e8] hover:underline disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> {sug ? 'Lendo a conversa…' : 'Sugerir com IA'}
          </button>
        </div>
      </div>
      <div className="mt-1.5 space-y-2">
        {rows.length === 0 && <p className="text-xs italic text-zinc-400">Liste cada banco × produto (RMC/RCC), ou upe o HISCON/HISCRE. Esses contratos alimentam o cálculo e a petição inicial.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-1.5">
            <input value={r.reu} onChange={(e) => setRow(r.id, { reu: e.target.value })} placeholder="Banco (réu)" className={INPUT + ' flex-1'} />
            <select value={r.produto} onChange={(e) => setRow(r.id, { produto: e.target.value })} className={INPUT + ' w-28 shrink-0'}>
              {PRODUTOS_IMPUGNAR.map((p) => <option key={p} value={p}>{p}</option>)}
              {r.produto && !PRODUTOS_IMPUGNAR.includes(r.produto) && <option value={r.produto}>{r.produto}</option>}
            </select>
            <input value={r.valor} onChange={(e) => setRow(r.id, { valor: maskCurrencyBR(e.target.value) })} placeholder="Valor" inputMode="decimal" className={INPUT + ' w-24 shrink-0'} />
            <button onClick={() => rmRow(r.id)} title="Remover" className="shrink-0 rounded p-1 text-zinc-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={addRow} className="inline-flex items-center gap-1 rounded border border-dashed border-[#cfe0ed] px-2.5 py-1 text-xs font-medium text-[#005efc] hover:bg-[#005efc]/5 dark:border-zinc-700"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
        <button onClick={salvar} disabled={sav} className="rounded px-2.5 py-1 text-xs font-semibold text-[#005efc] hover:bg-[#005efc]/5 disabled:opacity-50">{sav ? 'Salvando…' : 'Salvar'}</button>
        <span className="ml-auto text-[11px] text-zinc-400">A petição inicial é gerada no bloco “Cálculo RMC/RCC” abaixo.</span>
      </div>
    </div>
  );
}

// Ações da inicial: upar o JG (justiça gratuita → renda) e GERAR a petição inicial
// (base no timbrado preenchida com cliente/réu/contrato/cálculo/JG; baixa o .docx).
// A base (QUITADO/EM ABERTO) é escolhida pelo cálculo.
function InicialActions({ caseId, jg, onChanged }: { caseId: string; jg: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [jgBusy, setJgBusy] = useState(false);
  const fmtBRL = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

  const onJg = async (file?: File | null) => {
    if (!file) return;
    setJgBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('falha')); fr.readAsDataURL(file); });
      const { jg: r } = await legalCasesService.uploadJg(caseId, b64);
      toast.success(`JG lido — líquido ${fmtBRL(r.liquido)}${r.anual != null ? `, anual ${fmtBRL(r.anual)}` : ''}`);
      onChanged();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao ler o JG'); } finally { setJgBusy(false); }
  };

  const gerar = async () => {
    setBusy(true);
    try {
      const r = await legalCasesService.gerarInicial(caseId);
      onChanged(); // recarrega a ficha → a inicial aparece na aba Anexos
      toast.success(`Inicial gerada (base ${r.base === 'quitado' ? 'QUITADO' : 'EM ABERTO'}) — anexada na aba Anexos. Confira as lacunas “[ • ]” antes do protocolo.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao gerar a inicial');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#48626f] dark:text-zinc-400">
          {jg?.liquido != null ? <>Justiça gratuita: líquido <b>{fmtBRL(jg.liquido)}</b>{jg.anual != null ? <> · anual {fmtBRL(jg.anual)}</> : ''}</> : 'JG: upe o Histórico de Créditos / IR para a renda'}
        </span>
        <label className={`inline-flex items-center gap-1 text-xs font-medium text-[#005efc] hover:underline ${jgBusy ? 'opacity-50' : 'cursor-pointer'}`} title="Lê o Histórico de Créditos do INSS (líquido do último mês) e a declaração de IR (anual) para a seção de justiça gratuita.">
          <Upload className="h-3.5 w-3.5" /> {jgBusy ? 'Lendo JG…' : 'Upar JG'}
          <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={jgBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onJg(f); }} />
        </label>
      </div>
      <button onClick={gerar} disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#005efc] px-3 py-1.5 text-xs font-semibold text-[#005efc] hover:bg-[#005efc]/5 disabled:opacity-50">
        <FileText className="h-3.5 w-3.5" /> {busy ? 'Gerando inicial…' : 'Gerar petição inicial (.docx)'}
      </button>
    </div>
  );
}

// Resumo do atendimento: a IA lê a conversa do cliente (WhatsApp) e cola na ficha.
function ResumoAtendimento({ caseId, resumo, geradoEm, onDone }: { caseId: string; resumo: string | null; geradoEm: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const gerar = async () => {
    setBusy(true);
    try { await legalCasesService.resumoAtendimento(caseId); toast.success('Resumo do atendimento gerado'); onDone(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao gerar resumo'); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Resumo do atendimento (IA)</p>
        <button onClick={gerar} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-[#7048e8] hover:underline disabled:opacity-50">
          <Sparkles className="h-3.5 w-3.5" /> {busy ? 'Lendo a conversa…' : resumo ? 'Atualizar' : 'Gerar resumo'}
        </button>
      </div>
      {resumo ? (
        <article className="mt-1.5 rounded border border-[#cfe0ed] bg-[#f8fbff] p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#101820] dark:text-zinc-200">{resumo}</p>
          {geradoEm && <p className="mt-2 text-[10px] text-zinc-400">Gerado em {new Date(geradoEm).toLocaleString('pt-BR')}</p>}
        </article>
      ) : (
        <p className="mt-1.5 text-xs italic text-zinc-400">Sem resumo. Clique em “Gerar resumo” — a IA lê a conversa do cliente no WhatsApp e destaca bancos, benefício, valores e pendências.</p>
      )}
    </div>
  );
}

// Aba "Dados" com modo de edição (CNJ, valor, tribunal, comarca, área, protocolo).
function DadosForm({ c, pf, showJuizo, onSaved }: { c: CaseDetail; pf: any; showJuizo: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [cnj, setCnj] = useState(c.cnjNumber ?? '');
  const [valor, setValor] = useState(currencyToInput(c.value));
  const [court, setCourt] = useState(c.court ?? '');
  const [comarca, setComarca] = useState(c.jurisdiction ?? '');
  const [area, setArea] = useState(c.area ?? '');
  const [dataProt, setDataProt] = useState(c.distributedAt ? c.distributedAt.slice(0, 10) : '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCnj(c.cnjNumber ?? ''); setValor(currencyToInput(c.value)); setCourt(c.court ?? '');
    setComarca(c.jurisdiction ?? ''); setArea(c.area ?? ''); setDataProt(c.distributedAt ? c.distributedAt.slice(0, 10) : '');
  }, [c.id]);

  const save = async () => {
    setBusy(true);
    try {
      await legalCasesService.update(c.id, {
        cnjNumber: cnj.trim() || undefined,
        value: valor.trim() ? Number(String(valor).replace(/\./g, '').replace(',', '.')) : undefined,
        court: court.trim() || undefined,
        jurisdiction: comarca.trim() || undefined,
        area: area.trim() || undefined,
        distributedAt: dataProt || undefined,
      });
      toast.success('Dados atualizados'); setEditing(false); onSaved();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-bold text-black dark:text-zinc-100">Formulário Inicial</p>
        {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>}
      </div>
      {editing ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <EditField label="Número do processo"><input value={cnj} onChange={(e) => setCnj(e.target.value)} className={INPUT} placeholder="0000000-00.0000.0.00.0000" /></EditField>
          <EditField label="Valor da causa"><input value={valor} onChange={(e) => setValor(maskCurrencyBR(e.target.value))} className={INPUT} placeholder="0,00" inputMode="decimal" /></EditField>
          <EditField label="Tribunal"><input value={court} onChange={(e) => setCourt(e.target.value)} className={INPUT} placeholder="TJSP…" /></EditField>
          <EditField label="Comarca"><input value={comarca} onChange={(e) => setComarca(e.target.value)} className={INPUT} /></EditField>
          <EditField label="Área"><input value={area} onChange={(e) => setArea(e.target.value)} className={INPUT} placeholder="Bancário…" /></EditField>
          <EditField label="Data do protocolo"><input type="date" value={dataProt} onChange={(e) => setDataProt(e.target.value)} className={INPUT} /></EditField>
          <div className="col-span-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={save} disabled={busy} className="rounded bg-[#005efc] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {c.area && <Field label="Área / produto" value={cleanArea(c.area)} />}
            {c.cnjNumber && <Field label="Número do processo" value={c.cnjNumber} mono />}
            {c.value != null && Number(c.value) > 0 && <Field label="Valor da causa" value={fmtMoney(c.value)} strong />}
            {c.court && <Field label="Tribunal" value={c.court} />}
            {c.jurisdiction && <Field label="Comarca" value={c.jurisdiction} />}
            {c.distributedAt && <Field label="Data do protocolo" value={fmtDate(c.distributedAt)} />}
            {pf.polo && <Field label="Polo do cliente" value={pf.polo} />}
            {showJuizo && <Field label="Juízo" value={pf.juizo} />}
            {pf.sistema && <Field label="Sistema" value={pf.sistema} />}
            {pf.exito && <Field label="Êxito" value={pf.exito} />}
            {pf.honorarios && <Field label="Honorários" value={pf.honorarios} />}
          </div>
          {!c.cnjNumber && !c.court && !c.jurisdiction && !(c.value != null && Number(c.value) > 0) && !c.distributedAt && (
            <p className="mt-2 text-xs italic text-zinc-400">Os dados processuais (CNJ, tribunal, comarca, valor…) aparecem após o protocolo — ou clique em “Editar” para preencher antes.</p>
          )}
        </>
      )}
    </>
  );
}

function Atividades({ movements }: { movements: MovementItem[] }) {
  if (movements.length === 0) return <Empty t="Nenhum andamento" />;
  return (
    <>
      <p className="mb-3 text-base font-bold text-black dark:text-zinc-100">Histórico</p>
      <ol className="relative space-y-3 border-l border-[#cfe0ed] pl-4 dark:border-zinc-800">
        {movements.map((m) => {
          const lb = movLabel(m.source);
          const isPhase = /^Fase:/.test(m.description);
          return (
            <li key={m.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#228BE6] dark:border-zinc-950" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400">{fmtDate(m.date)}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${lb.c}`}>{lb.t}</span>
              </div>
              <p className={`mt-0.5 text-sm ${isPhase ? 'font-medium text-[#101820] dark:text-zinc-100' : 'text-[#48626f] dark:text-zinc-400'}`}>
                {m.description.length > 320 ? m.description.slice(0, 320) + '…' : m.description}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function PubItem({ p }: { p: PublicationRef }) {
  const [open, setOpen] = useState(false);
  const label = (p.classification as any)?.label as string | undefined;
  const txt = p.rawContent ?? '';
  return (
    <li className="rounded border border-[#cfe0ed] p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-[#228BE6]" />
        <span className="text-xs font-medium text-zinc-500">{fmtDate(p.publishedAt)}</span>
        {label && <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1971c2] dark:text-[#74c0fc]">{label}</span>}
        <span className="ml-auto text-[10px] uppercase text-zinc-400">{p.status}</span>
      </div>
      <p className={`mt-1.5 text-xs text-[#48626f] dark:text-zinc-400 ${open ? '' : 'line-clamp-3'}`} style={{ textAlign: 'justify' }}>{txt}</p>
      {txt.length > 180 && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-medium text-[#228BE6] hover:underline">{open ? 'Ver menos' : 'Ver mais'}</button>
      )}
    </li>
  );
}

function Empty({ t }: { t: string }) {
  return <p className="rounded-lg border border-dashed border-[#cfe0ed] py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">{t}</p>;
}
