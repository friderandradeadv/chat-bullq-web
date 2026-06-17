'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  MoreVertical,
  Plus,
  MessageSquare,
  CheckSquare,
  FileText,
  Clock,
  Users,
  Rss,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  legalCasesService,
  type PartyRole,
} from '@/features/legal-cases/services/legal-cases.service';
import { inputCls, Field, ASTREA_BLUE } from '../page';

const ROLE_LABEL: Record<PartyRole, string> = {
  CLIENT: 'Cliente',
  OPPONENT: 'Parte contrária',
  THIRD_PARTY: 'Terceiro',
  LAWYER: 'Advogado',
  WITNESS: 'Testemunha',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const fmtMoney = (v?: string | null) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Tab = 'resumo' | 'andamentos' | 'prazos';

export default function ProcessoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;
  const [tab, setTab] = useState<Tab>('resumo');

  const { data: c, isLoading } = useQuery({
    queryKey: ['legal-case', id],
    queryFn: () => legalCasesService.get(id!),
    enabled: !!id,
  });
  const refetch = () => qc.invalidateQueries({ queryKey: ['legal-case', id] });

  if (!id) return null;
  if (isLoading)
    return <div className="bg-[#f5f6f8] p-6 text-sm text-zinc-400">Carregando…</div>;
  if (!c)
    return <div className="bg-[#f5f6f8] p-6 text-sm text-zinc-400">Processo não encontrado.</div>;

  const tags = [c.area, STATUS_LABEL[c.status]].filter(Boolean) as string[];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f5f6f8] text-zinc-800">
      {/* Cabeçalho */}
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-normal text-zinc-700">{c.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconBtn title="Voltar" onClick={() => router.push('/processos')}>
              <ArrowLeft className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Favoritar">
              <Star className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Mais">
              <MoreVertical className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>

        {/* Metadados */}
        <dl className="mt-4 space-y-1 text-sm">
          <MetaRow label="Processo">
            {c.cnjNumber ? <span className="font-mono text-[#1488d6]">{c.cnjNumber}</span> : '—'}
          </MetaRow>
          <MetaRow label="Cliente">
            {c.parties.find((p) => p.role === 'CLIENT')?.name ?? '—'}
          </MetaRow>
          <MetaRow label="Status">
            <span className="inline-flex items-center gap-1">
              {STATUS_LABEL[c.status]} <Rss className="h-3 w-3 text-emerald-400" />
            </span>
          </MetaRow>
          <MetaRow label="Responsável">{c.responsible?.name ?? '—'}</MetaRow>
        </dl>

        {/* Abas */}
        <div className="mt-5 flex gap-6 border-b border-zinc-200">
          {([
            ['resumo', 'Resumo'],
            ['andamentos', 'Andamentos'],
            ['prazos', 'Prazos'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
                tab === key
                  ? 'border-[#1488d6] text-[#1488d6]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 px-6 py-5">
        {tab === 'resumo' && <ResumoTab c={c} />}
        {tab === 'andamentos' && (
          <MovementsTab caseId={id} movements={c.movements} onChange={refetch} />
        )}
        {tab === 'prazos' && <DeadlinesTab deadlines={c.deadlines} />}
      </div>
    </div>
  );
}

function ResumoTab({ c }: { c: any }) {
  const clientParty = c.parties.find((p: any) => p.role === 'CLIENT' && p.contact);
  const clientConv = clientParty?.contact?.conversations?.[0];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Esquerda: Dados do Processo + Partes */}
      <div className="space-y-5 lg:col-span-2">
        <Card title="Dados do Processo" icon={FileText}>
          <dl className="divide-y divide-zinc-100">
            <DefRow label="Ação" value={c.area ?? '—'} />
            <DefRow label="Número" value={c.cnjNumber ?? '—'} mono />
            <DefRow label="Juízo" value={c.court ?? '—'} />
            <DefRow label="Comarca / Foro" value={c.jurisdiction ?? '—'} />
            <DefRow label="Valor da causa" value={fmtMoney(c.value)} />
            <DefRow label="Distribuído em" value={fmtDate(c.distributedAt)} />
            <DefRow label="Criado em" value={fmtDate(c.createdAt)} />
          </dl>
        </Card>

        <PartiesCard
          caseId={c.id}
          parties={c.parties.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.role,
          }))}
        />
      </div>

      {/* Direita: widgets */}
      <div className="space-y-5">
        <Card title="Cliente / Conversa" icon={MessageSquare}>
          {clientParty?.contact ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-800">
                {clientParty.contact.name ?? clientParty.name}
              </p>
              {clientParty.contact.phone && (
                <p className="text-xs text-zinc-500">{clientParty.contact.phone}</p>
              )}
              {clientConv ? (
                <Link
                  href={`/inbox?conversationId=${clientConv.id}`}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Abrir conversa
                </Link>
              ) : (
                <p className="text-xs text-zinc-400">Sem conversa vinculada.</p>
              )}
            </div>
          ) : (
            <EmptyState>Nenhum cliente vinculado a um contato.</EmptyState>
          )}
        </Card>

        <Card title="Próximas atividades" icon={CheckSquare}>
          {c.events.length === 0 ? (
            <EmptyState>Este processo não possui atividades pendentes.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {c.events.map((e: any) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium text-zinc-700">{e.title}</span>
                  <span className="block text-xs text-zinc-400">
                    {e.kind} · {new Date(e.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Prazos abertos" icon={Clock}>
          {c.deadlines.length === 0 ? (
            <EmptyState>Nenhum prazo aberto.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {c.deadlines.slice(0, 4).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{d.title}</span>
                  <span className={`text-xs font-medium ${d.type === 'FATAL' ? 'text-rose-600' : 'text-zinc-500'}`}>
                    {fmtDate(d.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function MovementsTab({
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
    <Card
      title="Andamentos"
      icon={FileText}
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: ASTREA_BLUE }}
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      }
    >
      {adding && (
        <div className="mb-4 space-y-2 rounded-md bg-zinc-50 p-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Descrição do andamento…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1488d6]"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500">Cancelar</button>
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: ASTREA_BLUE }}
            >
              {saving ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
      {movements.length === 0 ? (
        <EmptyState>Nenhum andamento.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {movements.map((m) => (
            <li key={m.id} className="border-l-2 border-zinc-200 pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">{fmtDate(m.date)}</span>
                {m.source === 'DJEN' && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">DJEN</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-zinc-700">{m.description}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeadlinesTab({ deadlines }: { deadlines: any[] }) {
  return (
    <Card title="Prazos do processo" icon={Clock}>
      {deadlines.length === 0 ? (
        <EmptyState>Nenhum prazo aberto.</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {deadlines.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm text-zinc-800">
                  {d.title}
                  {d.type === 'FATAL' && (
                    <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">FATAL</span>
                  )}
                </p>
                <p className="text-xs text-zinc-400">
                  Fatal {fmtDate(d.dueDate)} · segurança {fmtDate(d.safeDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PartiesCard({
  caseId,
  parties,
}: {
  caseId: string;
  parties: { id: string; name: string; role: PartyRole }[];
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<PartyRole>('OPPONENT');
  const qc = useQueryClient();

  const add = async () => {
    if (!name.trim()) return;
    try {
      await legalCasesService.addParty(caseId, { name: name.trim(), role });
      toast.success('Parte adicionada');
      setName('');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  const remove = async (partyId: string) => {
    try {
      await legalCasesService.removeParty(partyId);
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  return (
    <Card
      title="Partes"
      icon={Users}
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: ASTREA_BLUE }}
        >
          <Plus className="h-3.5 w-3.5" /> Nova
        </button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2 rounded-md bg-zinc-50 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da parte" className={inputCls} />
          <select value={role} onChange={(e) => setRole(e.target.value as PartyRole)} className={inputCls}>
            {(Object.keys(ROLE_LABEL) as PartyRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500">Cancelar</button>
            <button onClick={add} className="rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: ASTREA_BLUE }}>
              Adicionar
            </button>
          </div>
        </div>
      )}
      {parties.length === 0 ? (
        <EmptyState>Sem partes.</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {parties.map((p) => (
            <li key={p.id} className="group flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-700">
                {p.name} <span className="ml-1 text-xs text-zinc-400">{ROLE_LABEL[p.role]}</span>
              </span>
              <button
                onClick={() => remove(p.id)}
                className="opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Primitivos visuais estilo Astrea ────────────────────────────────

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <Icon className="h-4 w-4" style={{ color: ASTREA_BLUE }} />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-zinc-400">{label}:</dt>
      <dd className="text-zinc-700">{children}</dd>
    </div>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-2.5">
      <dt className="w-36 shrink-0 text-sm text-zinc-400">{label}</dt>
      <dd className={`text-sm text-zinc-700 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-400">{children}</p>;
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
    >
      {children}
    </button>
  );
}
