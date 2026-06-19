'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  Scale,
  MessageCircle,
  Rss,
} from 'lucide-react';
import { contactsService } from '@/features/contacts/services/contacts.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CnjNumber, ASTREA_BLUE } from '../../processos/page';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  // Carrega os casos e resolve o cliente pela party (o id da URL é party.id ou contactId).
  // Os clientes importados do Astrea ainda não têm contato vinculado — então agrupamos por nome.
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['legal-cases', 'all'],
    queryFn: () => legalCasesService.list({}),
  });
  const refParty = cases.flatMap((c) => c.parties).find((p) => p.id === id || p.contactId === id);
  const clientName = refParty?.name ?? null;
  const contactId = refParty?.contactId ?? null;

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsService.getById(contactId!),
    enabled: !!contactId,
  });

  if (!id) return null;
  if (isLoading)
    return <div className="bg-[#f5f6f8] dark:bg-zinc-950 p-6 text-sm text-zinc-400">Carregando…</div>;
  if (!clientName)
    return <div className="bg-[#f5f6f8] dark:bg-zinc-950 p-6 text-sm text-zinc-400">Cliente não encontrado.</div>;

  const meusCasos = cases.filter((c) => c.parties.some((p) => p.name === clientName));
  const displayName = contact?.name ?? clientName;
  const conv = contact?.channels?.[0];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <div className="px-6 pt-6">
        <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#228BE6]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#228BE6]/10 text-lg font-semibold text-[#228BE6]">
            {displayName.trim().slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-medium text-[#202124] dark:text-zinc-100">{displayName}</h1>
            <p className="text-sm text-zinc-500">Cliente · {meusCasos.length} processo(s) conosco</p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-5 px-6 py-5 lg:grid-cols-3">
        {/* Ficha cadastral */}
        <Card title="Ficha cadastral" icon={User}>
          {contact ? (
            <>
              <dl className="space-y-3 text-sm">
                <Row icon={Phone} label="Telefone" value={contact.phone} />
                <Row icon={Mail} label="E-mail" value={contact.email} />
                {contact.notes && <Row label="Observações" value={contact.notes} />}
                {contact.status && (
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: contact.status.color }} />
                    <span className="text-zinc-600 dark:text-zinc-300">{contact.status.name}</span>
                  </div>
                )}
              </dl>
              {conv && (
                <Link
                  href={`/inbox?conversationId=${conv.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Abrir conversa
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-400">
              Cliente ainda não vinculado a um contato. A ficha cadastral completa virá ao vincular o cadastro
              (e cruzar com o Pipefy).
            </p>
          )}
        </Card>

        {/* Processos do cliente conosco */}
        <div className="lg:col-span-2">
          <Card title={`Processos conosco (${meusCasos.length})`} icon={Scale}>
            {meusCasos.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">Nenhum processo deste cliente.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {meusCasos.map((c) => {
                  const monitorado = !!c.cnjNumber;
                  return (
                    <li key={c.id} className="flex items-start gap-2 py-3">
                      <span title={monitorado ? 'Monitorado via DJEN' : 'Sem nº CNJ'} className="mt-0.5 shrink-0">
                        <Rss className={`h-3.5 w-3.5 ${monitorado ? 'text-emerald-500' : 'text-zinc-300'}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/processos/${c.id}`} className="text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline dark:text-zinc-200">
                          {c.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {c.area ?? 'Processo'} {STATUS_LABEL[c.status] ? `· ${STATUS_LABEL[c.status].toLowerCase()}` : ''}
                          {c.cnjNumber ? <> · <CnjNumber value={c.cnjNumber} /></> : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Pipefy: Fase 3 */}
          <div className="mt-5 rounded-lg border border-dashed border-[#DEE2E6] bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
            Cruzamento com o <strong className="font-medium text-zinc-500">Pipefy</strong> (cards, status do funil) — em breve.
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#6C757D]">
        <Icon className="h-4 w-4" style={{ color: ASTREA_BLUE }} /> {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />}
      <div>
        <dt className="text-xs text-zinc-400">{label}</dt>
        <dd className="text-zinc-700 dark:text-zinc-300">{value}</dd>
      </div>
    </div>
  );
}
