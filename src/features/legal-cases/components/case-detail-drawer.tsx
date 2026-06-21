'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Scale, Phone, ExternalLink, Clock, AlarmClock, CalendarClock, Newspaper, Paperclip, User, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService, type KanbanPhase, type MovementItem, type PublicationRef,
} from '@/features/legal-cases/services/legal-cases.service';

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
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const TABS = [
  { key: 'atividades', label: 'Atividades' },
  { key: 'prazos', label: 'Prazos' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'anexos', label: 'Anexos' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const movLabel = (s: string | null) =>
  s === 'auto:djen' ? { t: 'Automático', c: 'bg-[#e11970]/10 text-[#e11970]' }
  : s === 'DJEN' ? { t: 'DJEN', c: 'bg-[#228BE6]/10 text-[#1971c2] dark:text-[#74c0fc]' }
  : { t: 'Manual', c: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' };

export function CaseDetailDrawer({
  caseId, phases, onClose,
}: {
  caseId: string; phases: KanbanPhase[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('atividades');

  const { data: c, isLoading } = useQuery({
    queryKey: ['legal-cases', 'detail', caseId],
    queryFn: () => legalCasesService.get(caseId),
  });

  const pf = (c?.metadata as any)?.pipefy ?? {};
  const cliente = c?.parties?.find((p) => p.role === 'CLIENT') ?? null;
  const adversa = c?.parties?.find((p) => p.role === 'OPPONENT') ?? null;
  const faseLabel = phases.find((p) => p.key === (c as any)?.legalPhase)?.label ?? '—';

  const onMove = async (phase: string) => {
    if (!c) return;
    try {
      await legalCasesService.movePhase(c.id, phase);
      toast.success('Fase atualizada');
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
    } catch {
      toast.error('Erro ao mover');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[680px] flex-col bg-white shadow-2xl dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[#dbeaf5] px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {c?.area && <span className="rounded-full bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1971c2] dark:text-[#74c0fc]">{c.area}</span>}
              <span className="rounded bg-[#edeff3] px-1.5 py-0.5 text-[10px] font-semibold text-[#48626f] dark:bg-zinc-800 dark:text-zinc-300">{faseLabel}</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-[#101820] dark:text-zinc-100">{cliente?.name ?? c?.title ?? '…'}</h2>
            {adversa && <p className="truncate text-sm text-[#48626f] dark:text-zinc-400">× {adversa.name}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mover para fase */}
        <div className="flex items-center gap-2 border-b border-[#eef2f8] px-5 py-2.5 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500">Mover para fase:</span>
          <select
            value={(c as any)?.legalPhase ?? ''}
            onChange={(e) => onMove(e.target.value)}
            disabled={!c}
            className="h-8 flex-1 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm text-[#101820] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {phases.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {pf.recordUrl && (
            <a href={pf.recordUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#228BE6] hover:underline">
              Pipefy <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-5 text-sm text-zinc-400">Carregando…</p>}
          {c && (
            <>
              {/* Dados do processo */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
                <Field label="Número do processo" value={c.cnjNumber} icon={<Scale className="h-3.5 w-3.5" />} mono />
                <Field label="Valor da causa" value={fmtMoney(c.value)} strong />
                <Field label="Tribunal" value={c.court} />
                <Field label="Comarca" value={c.jurisdiction} />
                <Field label="Data do protocolo" value={fmtDate(c.distributedAt)} />
                <Field label="Responsável" value={c.responsible?.name ?? null} />
                {pf.polo && <Field label="Polo do cliente" value={pf.polo} />}
                {pf.juizo && <Field label="Juízo" value={pf.juizo} />}
                {pf.sistema && <Field label="Sistema" value={pf.sistema} />}
                {pf.exito && <Field label="Êxito" value={pf.exito} />}
                {pf.honorarios && <Field label="Honorários" value={pf.honorarios} />}
              </div>

              {/* Partes */}
              <div className="border-t border-[#eef2f8] px-5 py-4 dark:border-zinc-800">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">Partes</p>
                {cliente && (
                  <div className="mb-2 rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#228BE6]" />
                      <span className="text-sm font-semibold text-[#101820] dark:text-zinc-100">{cliente.name}</span>
                      <span className="ml-auto rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1971c2] dark:text-[#74c0fc]">CLIENTE</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#48626f] dark:text-zinc-400">
                      {cliente.document && <span>CPF/CNPJ: {cliente.document}</span>}
                      {cliente.contact?.phone && (
                        <a href={`https://wa.me/${cliente.contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400">
                          <Phone className="h-3 w-3" /> {fmtPhone(cliente.contact.phone)}
                        </a>
                      )}
                      {cliente.contact?.conversations?.[0] && (
                        <a href={`/inbox?conversation=${cliente.contact.conversations[0].id}`} className="inline-flex items-center gap-1 text-[#228BE6] hover:underline">
                          Abrir conversa <ArrowRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {adversa && (
                  <div className="rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#101820] dark:text-zinc-100">{adversa.name}</span>
                      <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">PARTE ADVERSA</span>
                    </div>
                    {adversa.document && <p className="mt-1 text-xs text-[#48626f] dark:text-zinc-400">CNPJ: {adversa.document}</p>}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="sticky top-0 z-10 flex gap-1 border-y border-[#eef2f8] bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
                {TABS.map((t) => {
                  const n = t.key === 'atividades' ? c.movements.length
                    : t.key === 'prazos' ? c.deadlines.length
                    : t.key === 'agenda' ? c.events.length
                    : t.key === 'publicacoes' ? c.publications.length
                    : c.documents.length;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                        tab === t.key ? 'text-[#e11970]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}>
                      {t.label} <span className="text-xs text-zinc-400">{n}</span>
                      {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#e11970]" />}
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-4">
                {tab === 'atividades' && <Atividades movements={c.movements} />}
                {tab === 'prazos' && (
                  c.deadlines.length === 0 ? <Empty t="Nenhum prazo aberto" />
                  : <ul className="space-y-2">{c.deadlines.map((d) => (
                      <li key={d.id} className="rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <AlarmClock className="h-4 w-4 text-[#228BE6]" />
                          <span className="text-sm font-medium text-[#101820] dark:text-zinc-100">{d.title}</span>
                          {d.type === 'FATAL' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">fatal</span>}
                        </div>
                        <p className="mt-1 text-xs text-[#48626f] dark:text-zinc-400">
                          Segurança: <b>{fmtDate(d.safeDate)}</b> · Fatal: <b className="text-red-600 dark:text-red-400">{fmtDate(d.dueDate)}</b>
                          {d.assignedTo && <> · {d.assignedTo.name}</>}
                        </p>
                      </li>
                    ))}</ul>
                )}
                {tab === 'agenda' && (
                  c.events.length === 0 ? <Empty t="Nenhum evento na agenda" />
                  : <ul className="space-y-2">{c.events.map((e) => (
                      <li key={e.id} className="rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-[#228BE6]" />
                          <span className="text-sm font-medium text-[#101820] dark:text-zinc-100">{e.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#48626f] dark:text-zinc-400">{fmtDateTime(e.startsAt)}{e.location && <> · {e.location}</>}</p>
                      </li>
                    ))}</ul>
                )}
                {tab === 'publicacoes' && (
                  c.publications.length === 0 ? <Empty t="Nenhuma publicação vinculada" />
                  : <ul className="space-y-2">{c.publications.map((p) => <PubItem key={p.id} p={p} />)}</ul>
                )}
                {tab === 'anexos' && (
                  c.documents.length === 0 ? <Empty t="Nenhum anexo" />
                  : <ul className="space-y-2">{c.documents.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
                        <Paperclip className="h-4 w-4 text-[#48626f]" />
                        <span className="flex-1 truncate text-sm text-[#101820] dark:text-zinc-100">{d.name}</span>
                        <span className="text-xs text-zinc-400">{fmtSize(d.sizeBytes)}</span>
                      </li>
                    ))}</ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, icon, mono, strong }: { label: string; value: string | null; icon?: React.ReactNode; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-sm text-[#101820] dark:text-zinc-200 ${mono ? 'font-mono text-[13px]' : ''} ${strong ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}`}>
        {icon}{value || '—'}
      </p>
    </div>
  );
}

function Atividades({ movements }: { movements: MovementItem[] }) {
  if (movements.length === 0) return <Empty t="Nenhum andamento" />;
  return (
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
              {m.description.length > 360 ? m.description.slice(0, 360) + '…' : m.description}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function PubItem({ p }: { p: PublicationRef }) {
  const [open, setOpen] = useState(false);
  const label = (p.classification as any)?.label as string | undefined;
  const txt = p.rawContent ?? '';
  return (
    <li className="rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-[#228BE6]" />
        <span className="text-xs font-medium text-zinc-500">{fmtDate(p.publishedAt)}</span>
        {label && <span className="rounded bg-[#228BE6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1971c2] dark:text-[#74c0fc]">{label}</span>}
        <span className="ml-auto text-[10px] uppercase text-zinc-400">{p.status}</span>
      </div>
      <p className={`mt-1.5 text-xs text-[#48626f] dark:text-zinc-400 ${open ? '' : 'line-clamp-3'}`} style={{ textAlign: 'justify' }}>{txt}</p>
      {txt.length > 180 && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-medium text-[#228BE6] hover:underline">
          {open ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </li>
  );
}

function Empty({ t }: { t: string }) {
  return <p className="rounded-lg border border-dashed border-[#cfe0ed] py-8 text-center text-sm text-zinc-400 dark:border-zinc-800">{t}</p>;
}
