'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  Scale,
  MessageCircle,
  Rss,
  Plus,
  X,
  Check,
  Tag as TagIcon,
  FileText,
  CircleDollarSign,
} from 'lucide-react';
import { clientsService } from '@/features/legal-cases/services/clients.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { clienteFinanceiro, STATUS_FIN } from '@/features/financeiro/lib/clientes';
import { formatPhone } from '@/lib/brazil-states';
import { CnjNumber, ASTREA_BLUE } from '../../processos/page';

const brlc = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['legal-clients'],
    queryFn: () => clientsService.list(),
  });
  const { data: cases = [] } = useQuery({
    queryKey: ['legal-cases', 'all'],
    queryFn: () => legalCasesService.list({}),
  });

  // O id da URL é a party representativa; aceita também o id do contato (links antigos).
  const cliente =
    clientes.find((c) => c.partyId === id) ?? clientes.find((c) => c.contact?.id === id) ?? null;
  const contact = cliente?.contact ?? null;

  const meusCasos = useMemo(() => {
    if (!cliente) return [];
    const key = norm(cliente.name);
    return cases.filter((c) => c.parties.some((p) => norm(p.name) === key));
  }, [cases, cliente]);

  if (!id) return null;
  if (isLoading)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Carregando…</div>;
  if (!cliente)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Cliente não encontrado.</div>;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="px-6 pt-6">
        <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#228BE6]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#228BE6]/10 text-lg font-semibold text-[#228BE6]">
            {cliente.name.trim().slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-medium text-[#202124] dark:text-zinc-100">{cliente.name}</h1>
            <p className="text-sm text-zinc-500">
              Cliente · {meusCasos.length} processo(s) conosco
              {cliente.document ? ` · ${cliente.document}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-5 px-6 py-5 lg:grid-cols-3">
        {/* Ficha cadastral + etiquetas */}
        <div className="space-y-5">
          <Card title="Ficha cadastral" icon={User}>
            {contact ? (
              <>
                <dl className="space-y-3 text-sm">
                  <Row icon={Phone} label="Telefone" value={formatPhone(contact.phone)} />
                  <Row icon={Mail} label="E-mail" value={contact.email} />
                  {contact.notes && <Row icon={FileText} label="Observações" value={contact.notes} />}
                  {contact.status && (
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: contact.status.color }} />
                      <span className="text-zinc-600 dark:text-zinc-300">{contact.status.name}</span>
                    </div>
                  )}
                </dl>
                {contact.conversationId && (
                  <Link
                    href={`/inbox?conversationId=${contact.conversationId}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Abrir conversa
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                Cliente ainda sem ficha no Comercial. Quando houver um contato com o mesmo nome (ou ao
                vincular), a ficha cadastral e as etiquetas aparecem aqui.
              </p>
            )}
          </Card>

          {/* Etiquetas interativas (iguais ao Comercial) */}
          <Card title="Etiquetas" icon={TagIcon}>
            {contact ? (
              <TagsEditor
                contactId={contact.id}
                tags={contact.tags}
                onChanged={() => qc.invalidateQueries({ queryKey: ['legal-clients'] })}
              />
            ) : (
              <p className="text-sm text-zinc-400">Disponível após vincular o cliente a um contato do Comercial.</p>
            )}
          </Card>
        </div>

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

          {/* Financeiro do cliente — honorários vinculados aos lançamentos */}
          <div className="mt-5">
            <ClienteFinanceiroCard nome={cliente.name} />
          </div>

          {/* Pipefy: Fase 3 */}
          <div className="mt-5 rounded-lg border border-dashed border-[#DEE2E6] bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
            Cruzamento com o <strong className="font-medium text-zinc-500">Pipefy</strong> (cards, status do funil, valor da causa) — em breve.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resumo de honorários do cliente (recebidos, pagamentos, status) — casa por nome. */
function ClienteFinanceiroCard({ nome }: { nome: string }) {
  const { data: dash, isLoading } = useQuery({
    queryKey: ['financeiro', 'dashboard'],
    queryFn: () => financeiroService.dashboard(),
    staleTime: 60_000,
  });
  const { data: cobrancas = [] } = useQuery({
    queryKey: ['financeiro', 'cobrancas'],
    queryFn: () => financeiroService.listCobrancas(),
    staleTime: 60_000,
  });
  const fin = useMemo(() => clienteFinanceiro(dash, nome), [dash, nome]);
  const cob = useMemo(() => cobrancas.find((c) => norm(c.cliente) === norm(nome)) ?? null, [cobrancas, nome]);

  const blocoCobranca = cob ? (
    <div className={`mt-3 rounded-lg border px-3 py-2.5 ${cob.statusCalc === 'atrasada' ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-900/10' : cob.statusCalc === 'quitada' ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10' : 'border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cobrança parcelada</span>
        <span className="text-[11px] font-semibold" style={{ color: cob.statusCalc === 'atrasada' ? '#E03131' : cob.statusCalc === 'quitada' ? '#2F9E44' : '#228BE6' }}>{cob.pagas}/{cob.nParcelas} pagas</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-xl font-bold tabular-nums ${cob.saldoDevedor > 0.01 ? 'text-[#228BE6]' : 'text-emerald-600'}`}>{brlc(cob.saldoDevedor)}</span>
        <span className="text-xs text-zinc-400">de saldo devedor · total {brlc(cob.valorTotal)}</span>
      </div>
      {cob.valorAtrasado > 0 && <p className="mt-0.5 text-xs font-medium text-rose-600">⚠ {brlc(cob.valorAtrasado)} vencido ({cob.nAtrasadas} parcela{cob.nAtrasadas > 1 ? 's' : ''})</p>}
      {cob.proximaParcela && cob.saldoDevedor > 0.01 && <p className="mt-0.5 text-[11px] text-zinc-400">próxima parcela: {brlc(cob.proximaParcela.valor)} em {cob.proximaParcela.vencimento}</p>}
    </div>
  ) : (
    <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-[11px] text-zinc-400 dark:border-zinc-700">
      Sem cobrança parcelada cadastrada. Crie uma na aba <strong className="font-medium text-zinc-500">Cobranças</strong> do Financeiro para acompanhar o saldo devedor.
    </p>
  );

  return (
    <Card title="Financeiro do cliente" icon={CircleDollarSign}>
      {isLoading ? (
        <p className="text-sm text-zinc-400">Carregando honorários…</p>
      ) : !fin ? (
        <>
          <p className="text-sm text-zinc-400">
            Nenhum honorário lançado para este cliente ainda. Quando houver pagamentos vinculados ao nome
            dele nos lançamentos, o histórico aparece aqui.
          </p>
          {blocoCobranca}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Recebido</p><p className="text-lg font-bold tabular-nums text-emerald-600">{brlc(fin.recebido)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Pagamentos</p><p className="text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-200">{fin.n}{fin.recorrente ? <span className="ml-1 text-xs font-normal text-violet-500">recorrente</span> : null}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Ticket médio</p><p className="text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-200">{brlc(fin.medio)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Situação</p><span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${STATUS_FIN[fin.status].cor}1A`, color: STATUS_FIN[fin.status].cor }}>{STATUS_FIN[fin.status].label}</span></div>
          </div>
          {fin.repassado > 0 && <p className="mt-2 text-xs text-zinc-500">Repassado/estornado: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{brlc(fin.repassado)}</span></p>}
          <p className="mt-3 mb-1.5 text-[11px] text-zinc-400">{STATUS_FIN[fin.status].dica}. Histórico:</p>
          <div className="max-h-48 space-y-0.5 overflow-y-auto scrollbar-thin">
            {fin.pagamentos.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded px-2 py-1 text-sm odd:bg-zinc-50/70 dark:odd:bg-zinc-800/30">
                <span className="tabular-nums text-zinc-500">{p.data}</span>
                <span className="font-semibold tabular-nums text-emerald-600">{brlc(p.valor)}</span>
              </div>
            ))}
          </div>
          {blocoCobranca}
        </>
      )}
    </Card>
  );
}

/** Editor de etiquetas do contato — mesmo mecanismo do Comercial (tagsService). */
function TagsEditor({
  contactId,
  tags,
  onChanged,
}: {
  contactId: string;
  tags: { id: string; name: string; color: string }[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsService.list(),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: (tagId: string) => tagsService.addToContact(contactId, tagId),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: (tagId: string) => tagsService.removeFromContact(contactId, tagId),
    onSuccess: onChanged,
  });

  const has = (id: string) => tags.some((t) => t.id === id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${t.color}22`, color: t.color }}
          >
            {t.name}
            <button
              onClick={() => remove.mutate(t.id)}
              className="opacity-60 hover:opacity-100"
              title="Remover etiqueta"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-600"
          >
            <Plus className="h-3 w-3" /> Etiqueta
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {allTags.length === 0 && (
                  <div className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta cadastrada.</div>
                )}
                {allTags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => (has(t.id) ? remove.mutate(t.id) : add.mutate(t.id))}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                    {has(t.id) && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {tags.length === 0 && <p className="mt-2 text-xs text-zinc-400">Nenhuma etiqueta. Clique em “Etiqueta” para adicionar.</p>}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
