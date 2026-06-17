'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MessageSquare,
  Plus,
  Users,
  Clock,
  CalendarDays,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type PartyRole,
} from '@/features/legal-cases/services/legal-cases.service';
import { inputCls, Field } from '../page';

const ROLE_LABEL: Record<PartyRole, string> = {
  CLIENT: 'Cliente',
  OPPONENT: 'Parte contrária',
  THIRD_PARTY: 'Terceiro',
  LAWYER: 'Advogado',
  WITNESS: 'Testemunha',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function ProcessoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;

  const { data: c, isLoading } = useQuery({
    queryKey: ['legal-case', id],
    queryFn: () => legalCasesService.get(id!),
    enabled: !!id,
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['legal-case', id] });

  if (!id) return null;
  if (isLoading) return <p className="p-6 text-sm text-zinc-400">Carregando…</p>;
  if (!c) return <p className="p-6 text-sm text-zinc-400">Processo não encontrado.</p>;

  const clientParty = c.parties.find((p) => p.role === 'CLIENT' && p.contact);
  const clientConv = clientParty?.contact?.conversations?.[0];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <button
          onClick={() => router.push('/processos')}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {c.title}
          </h1>
          <p className="text-xs text-zinc-500">
            {c.cnjNumber ?? 'sem CNJ'} · {c.court ?? '—'} · {c.area ?? '—'}
          </p>
        </div>
        {c.responsible && (
          <span className="text-xs text-zinc-500">
            Resp.: <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.responsible.name}</span>
          </span>
        )}
      </div>

      <div className="grid flex-1 gap-5 p-5 lg:grid-cols-3">
        {/* Coluna principal: andamentos */}
        <div className="lg:col-span-2 space-y-5">
          <MovementsCard caseId={id} movements={c.movements} onChange={refetch} />
          <DeadlinesCard deadlines={c.deadlines} />
        </div>

        {/* Coluna lateral: cliente/conversa, partes, agenda */}
        <div className="space-y-5">
          <Section title="Cliente / Conversa" icon={MessageSquare}>
            {clientParty?.contact ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {clientParty.contact.name ?? clientParty.name}
                </p>
                {clientParty.contact.phone && (
                  <p className="text-xs text-zinc-500">{clientParty.contact.phone}</p>
                )}
                {clientConv ? (
                  <Link
                    href={`/inbox?conversationId=${clientConv.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Abrir conversa no WhatsApp
                  </Link>
                ) : (
                  <p className="text-xs text-zinc-400">Sem conversa vinculada.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Nenhum cliente vinculado a um contato do CRM.
              </p>
            )}
          </Section>

          <PartiesCard
            caseId={id}
            parties={c.parties.map((p) => ({ id: p.id, name: p.name, role: p.role, document: p.document }))}
            roleLabel={ROLE_LABEL}
            onChange={refetch}
          />

          <Section title="Agenda" icon={CalendarDays}>
            {c.events.length === 0 ? (
              <p className="text-xs text-zinc-400">Sem compromissos.</p>
            ) : (
              <ul className="space-y-2">
                {c.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{e.title}</span>
                    <span className="block text-xs text-zinc-500">
                      {e.kind} · {fmtDateTime(e.startsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function MovementsCard({
  caseId,
  movements,
  onChange,
}: {
  caseId: string;
  movements: { id: string; date: string; description: string; source: string | null }[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      await legalCasesService.addMovement(caseId, { date, description: desc.trim() });
      toast.success('Andamento adicionado');
      setDesc('');
      setAdding(false);
      onChange();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Andamentos"
      icon={ScrollText}
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      }
    >
      {adding && (
        <div className="mb-4 space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Descrição do andamento…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {movements.length === 0 ? (
        <p className="text-xs text-zinc-400">Nenhum andamento.</p>
      ) : (
        <ul className="space-y-3">
          {movements.map((m) => (
            <li key={m.id} className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">{fmtDate(m.date)}</span>
                {m.source === 'DJEN' && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    DJEN
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-4 text-sm text-zinc-700 dark:text-zinc-300">
                {m.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DeadlinesCard({
  deadlines,
}: {
  deadlines: {
    id: string;
    title: string;
    type: string;
    dueDate: string;
    safeDate: string;
    assignedTo: { name: string } | null;
  }[];
}) {
  return (
    <Section title="Prazos abertos" icon={Clock}>
      {deadlines.length === 0 ? (
        <p className="text-xs text-zinc-400">Nenhum prazo aberto.</p>
      ) : (
        <ul className="space-y-2">
          {deadlines.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  {d.title}
                  {d.type === 'FATAL' && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      FATAL
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  Fatal {fmtDate(d.dueDate)} · segurança {fmtDate(d.safeDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PartiesCard({
  caseId,
  parties,
  roleLabel,
  onChange,
}: {
  caseId: string;
  parties: { id: string; name: string; role: PartyRole; document: string | null }[];
  roleLabel: Record<PartyRole, string>;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<PartyRole>('OPPONENT');

  const add = async () => {
    if (!name.trim()) return;
    try {
      await legalCasesService.addParty(caseId, { name: name.trim(), role });
      toast.success('Parte adicionada');
      setName('');
      setAdding(false);
      onChange();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  const remove = async (partyId: string) => {
    try {
      await legalCasesService.removeParty(partyId);
      onChange();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  return (
    <Section
      title="Partes"
      icon={Users}
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Nova
        </button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da parte"
            className={inputCls}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PartyRole)}
            className={inputCls}
          >
            {(Object.keys(roleLabel) as PartyRole[]).map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500">
              Cancelar
            </button>
            <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white">
              Adicionar
            </button>
          </div>
        </div>
      )}
      {parties.length === 0 ? (
        <p className="text-xs text-zinc-400">Sem partes.</p>
      ) : (
        <ul className="space-y-1.5">
          {parties.map((p) => (
            <li key={p.id} className="group flex items-center justify-between text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                {p.name}
                <span className="ml-2 text-xs text-zinc-400">{roleLabel[p.role]}</span>
              </span>
              <button
                onClick={() => remove(p.id)}
                className="opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                aria-label="Remover parte"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
