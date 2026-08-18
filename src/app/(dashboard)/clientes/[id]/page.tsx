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
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  MapPin,
  KeyRound,
  IdCard,
  Loader2,
  Paperclip,
  ReceiptText,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientsService } from '@/features/legal-cases/services/clients.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { financeiroService, anexoHref } from '@/features/financeiro/services/financeiro.service';
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

// Cadastro migrado do Pipefy (gravado em contact.metadata.cadastro). O tipo do
// service só declara alguns campos; login/senha (gov.br/Meu INSS) vêm no runtime.
type Cadastro = {
  cpf?: string | null; cnpj?: string | null; rg?: string | null;
  estadoCivil?: string | null; profissao?: string | null; endereco?: string | null;
  login?: string | null; senha?: string | null;
};

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
    queryKey: ['legal-cases', 'judicial'],
    queryFn: () => legalCasesService.list({ hasCnj: true }),
  });

  // O id da URL pode ser QUALQUER party CLIENT do cliente (o link da aba Processos usa
  // o partyId daquele processo, não o representativo) ou o id do contato (links antigos).
  const cliente =
    clientes.find((c) => c.partyIds?.includes(id ?? '')) ??
    clientes.find((c) => c.partyId === id) ??
    clientes.find((c) => c.contact?.id === id) ??
    null;
  const contact = cliente?.contact ?? null;

  const meusCasos = useMemo(() => {
    if (!cliente) return [];
    const key = norm(cliente.name);
    return cases.filter((c) => c.parties.some((p) => norm(p.name) === key));
  }, [cases, cliente]);

  // Agrupa os processos por DESFECHO — visão visual "vencidos / em andamento / perdidos / arquivados".
  const gruposCasos = useMemo(() => {
    const arqPhases = new Set(['arquivado', 'abandonado', 'arq_provisorio', 'perdidos_valeska']);
    const g: Record<string, typeof meusCasos> = { vencidos: [], parcial: [], andamento: [], perdidos: [], arquivados: [] };
    for (const c of meusCasos) {
      if (c.resultado === 'vencemos') g.vencidos.push(c);
      else if (c.resultado === 'parcial') g.parcial.push(c);
      else if (c.resultado === 'perdemos') g.perdidos.push(c);
      else if (c.status === 'ARCHIVED' || arqPhases.has(c.faseKey || '')) g.arquivados.push(c);
      else g.andamento.push(c);
    }
    return g;
  }, [meusCasos]);

  // Cadastro migrado do Pipefy (CPF/RG/endereço/login/senha gov) vive na party do
  // detalhe do caso — puxa o 1º processo do cliente e extrai a party CLIENT dele.
  const repCaseId = meusCasos[0]?.id;
  const { data: caseDetail } = useQuery({
    queryKey: ['legal-case', repCaseId],
    queryFn: () => legalCasesService.get(repCaseId!),
    enabled: !!repCaseId,
  });
  const cadastro: Cadastro | null = useMemo(() => {
    if (!caseDetail || !cliente) return null;
    const key = norm(cliente.name);
    const party = caseDetail.parties.find((p) => p.role === 'CLIENT' && norm(p.name) === key)
      ?? caseDetail.parties.find((p) => p.role === 'CLIENT');
    // Contato tem prioridade; se não houver (cliente sem contato vinculado), lê do próprio party
    // (é onde a varredura das procurações grava o cadastro, casado por CPF).
    return (party?.contact?.metadata?.cadastro as Cadastro | undefined)
      ?? ((party?.metadata as any)?.cadastro as Cadastro | undefined)
      ?? null;
  }, [caseDetail, cliente]);

  if (!id) return null;
  if (isLoading)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Carregando…</div>;
  if (!cliente)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Cliente não encontrado.</div>;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="px-4 pt-3 lg:px-6">
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

      <div className="grid flex-1 gap-5 px-4 py-5 lg:grid-cols-3 lg:px-6">
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

          {/* Dados cadastrais migrados do Pipefy — CPF/senha copiáveis */}
          {cadastro && (cadastro.cpf || cadastro.cnpj || cadastro.rg || cadastro.endereco || cadastro.login || cadastro.senha || cadastro.estadoCivil || cadastro.profissao) && (
            <Card title="Dados cadastrais" icon={IdCard}>
              <dl className="space-y-3 text-sm">
                <DataRow icon={Fingerprint} label="CPF" value={cadastro.cpf} copyable />
                <DataRow icon={IdCard} label="CNPJ" value={cadastro.cnpj} copyable />
                <DataRow icon={IdCard} label="RG" value={cadastro.rg} copyable />
                <DataRow icon={User} label="Estado civil" value={cadastro.estadoCivil} />
                <DataRow icon={User} label="Profissão" value={cadastro.profissao} />
                <DataRow icon={MapPin} label="Endereço" value={cadastro.endereco} copyable />
                <DataRow icon={KeyRound} label="Login gov.br / Meu INSS" value={cadastro.login} copyable />
                <DataRow icon={KeyRound} label="Senha gov.br / Meu INSS" value={cadastro.senha} copyable secret />
              </dl>
            </Card>
          )}

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
              <div className="space-y-4">
                {([
                  { key: 'vencidos', label: 'Vencidos', cor: '#2F9E44', bg: 'bg-emerald-50 dark:bg-emerald-900/15', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
                  { key: 'parcial', label: 'Recebimento parcial', cor: '#F59F00', bg: 'bg-amber-50 dark:bg-amber-900/15', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
                  { key: 'andamento', label: 'Em andamento', cor: '#228BE6', bg: 'bg-blue-50 dark:bg-blue-900/15', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                  { key: 'perdidos', label: 'Perdidos', cor: '#E03131', bg: 'bg-rose-50 dark:bg-rose-900/15', dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
                  { key: 'arquivados', label: 'Arquivados / encerrados', cor: '#868E96', bg: 'bg-zinc-50 dark:bg-zinc-800/40', dot: 'bg-zinc-400', chip: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
                ] as const).map((grp) => {
                  const lista = gruposCasos[grp.key] ?? [];
                  if (lista.length === 0) return null;
                  return (
                    <div key={grp.key} className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800">
                      <div className={`flex items-center gap-2 px-3 py-2 ${grp.bg}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${grp.dot}`} />
                        <span className="text-sm font-bold" style={{ color: grp.cor }}>{grp.label}</span>
                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums dark:bg-zinc-900/60" style={{ color: grp.cor }}>{lista.length}</span>
                      </div>
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {lista.map((c) => (
                          <li key={c.id} className="flex items-start gap-2 px-3 py-2.5">
                            <span title={c.cnjNumber ? 'Monitorado via DJEN' : 'Sem nº CNJ'} className="mt-0.5 shrink-0">
                              <Rss className={`h-3.5 w-3.5 ${c.cnjNumber ? 'text-emerald-500' : 'text-zinc-300'}`} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <Link href={`/processos/${c.id}`} className="block truncate text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline dark:text-zinc-200" title={c.title}>{c.title}</Link>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                                {c.faseLabel && <span className={`rounded px-1.5 py-0.5 font-medium ${grp.chip}`}>{c.faseLabel}</span>}
                                <span>{c.area ?? 'Processo'}</span>
                                {c.cnjNumber ? <span>· <CnjNumber value={c.cnjNumber} /></span> : null}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Financeiro do cliente — honorários vinculados aos lançamentos */}
          <div className="mt-5">
            <ClienteFinanceiroCard nome={cliente.name} cases={meusCasos} />
          </div>

          {/* Cobrança ASAAS — gera boleto/pix e concilia com o caixa */}
          <div className="mt-5">
            <CobrancaAsaasCard
              nome={cliente.name}
              documento={cadastro?.cpf || cadastro?.cnpj || cliente.document || ''}
              email={contact?.email || ''}
              telefone={contact?.phone || ''}
              contactId={contact?.id || undefined}
            />
          </div>

          {/* Pipefy: Fase 3 — falta o valor da causa por processo */}
          <div className="mt-5 rounded-lg border border-dashed border-[#DEE2E6] bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
            Valor da causa por processo (cruzamento com o <strong className="font-medium text-zinc-500">Pipefy</strong>) — em breve.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resumo de honorários do cliente (recebidos, pagamentos, status) — casa por nome. */
function ClienteFinanceiroCard({ nome, cases = [] }: { nome: string; cases?: { id: string; title: string; cnjNumber: string | null }[] }) {
  const casoLabel = (caseId: string) => cases.find((c) => c.id === caseId) ?? null;
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

  // Registro dos ALVARÁS/PRESTAÇÕES do cliente: agrupa por processo os lançamentos de êxito
  // (têm o rateio bruto→cliente/sucumbência/honorário) + junta os anexos (alvará, comprovante) e o
  // status do repasse. Fonte: as transações do dashboard já filtradas pelo nome do cliente.
  const alvaras = useMemo(() => {
    const txs = dash?.transacoes ?? [];
    type An = { key: string; url: string; name: string; mime: string };
    const byCase = new Map<string, { caseId: string; rateio: any; prestacaoTxId: string; data: string; anexos: An[]; comprovantes: An[]; repasseStatus?: string }>();
    for (const t of txs) {
      if (!t.caseId) continue;
      if (norm(t.party || t.recebedor || t.pagador || '') !== norm(nome)) continue;
      let g = byCase.get(t.caseId);
      if (!g) { g = { caseId: t.caseId, rateio: null, prestacaoTxId: t.id!, data: t.data, anexos: [], comprovantes: [] }; byCase.set(t.caseId, g); }
      if (t.rateio) { g.rateio = t.rateio; g.prestacaoTxId = t.id!; g.data = t.data; }
      const ehRepasse = /repasse ao cliente/i.test(t.categoria || '');
      if (ehRepasse) g.repasseStatus = t.status ?? undefined;
      // Anexo do REPASSE = comprovante do Pix ao cliente (prova de pagamento); dos demais = alvará/docs.
      const alvo = ehRepasse ? g.comprovantes : g.anexos;
      const outro = ehRepasse ? g.anexos : g.comprovantes;
      for (const an of (t.anexos ?? [])) if (an?.key && !alvo.some((x) => x.key === an.key) && !outro.some((x) => x.key === an.key)) alvo.push(an as any);
    }
    return [...byCase.values()].filter((g) => g.rateio);
  }, [dash, nome]);

  const [prestBusy, setPrestBusy] = useState<string | null>(null);
  const gerarPrest = async (txId: string) => {
    setPrestBusy(txId);
    try {
      const dados = await financeiroService.prestacaoDados(txId);
      const { gerarPrestacaoPdf } = await import('@/features/financeiro/lib/prestacao-pdf');
      const blob = await gerarPrestacaoPdf(dados);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Erro ao gerar a prestação de contas'); }
    finally { setPrestBusy(null); }
  };

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

      {/* REGISTRO DOS ALVARÁS / PRESTAÇÃO DE CONTAS — valores e anexos por processo. */}
      {alvaras.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400"><ReceiptText className="h-3.5 w-3.5" /> Alvarás e prestação de contas ({alvaras.length})</p>
          <div className="space-y-2">
            {alvaras.map((a) => {
              const bruto = Number(a.rateio.bruto) || 0; const suc = Number(a.rateio.sucumbencia) || 0;
              const hon = Number(a.rateio.honorarios) || 0; const cli = Number(a.rateio.cliente) || 0;
              const nosso = hon + suc;
              const pago = a.repasseStatus === 'pago';
              const proc = casoLabel(a.caseId);
              return (
                <div key={a.caseId} className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Alvará {brlc(bruto)}</span>
                      {proc ? <Link href={`/processos/${proc.id}`} className="mt-0.5 block truncate text-[11px] text-[#228BE6] hover:underline" title={proc.title}>{proc.title}{proc.cnjNumber ? ` · ${proc.cnjNumber}` : ''}</Link> : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
                      <span className="text-zinc-400">{a.data}</span>
                      {a.repasseStatus && <span className={`rounded-full px-1.5 py-0.5 font-semibold ${pago ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{pago ? 'repasse pago' : 'repasse a pagar'}</span>}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
                    <div><span className="text-zinc-400">Bruto</span><br /><b className="tabular-nums text-zinc-700 dark:text-zinc-200">{brlc(bruto)}</b></div>
                    <div><span className="text-zinc-400">Sucumbência</span><br /><b className="tabular-nums text-zinc-600 dark:text-zinc-300">{brlc(suc)}</b></div>
                    <div><span className="text-zinc-400">Nossa parte</span><br /><b className="tabular-nums text-emerald-600">{brlc(nosso)}</b></div>
                    <div><span className="text-zinc-400">Parte do cliente</span><br /><b className="tabular-nums text-[#228BE6]">{brlc(cli)}</b></div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button onClick={() => gerarPrest(a.prestacaoTxId)} disabled={prestBusy === a.prestacaoTxId} className="inline-flex items-center gap-1 rounded-md bg-[#7048E8]/10 px-2 py-1 text-[11px] font-semibold text-[#7048E8] transition hover:bg-[#7048E8]/20 disabled:opacity-50">
                      {prestBusy === a.prestacaoTxId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ReceiptText className="h-3 w-3" />} Prestação de contas (PDF)
                    </button>
                    {a.anexos.map((an, k) => (
                      <a key={k} href={anexoHref(an as any)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-[#7048E8] hover:text-[#7048E8] dark:border-zinc-700 dark:text-zinc-300" title="Documento (alvará/prova)">
                        <Paperclip className="h-3 w-3" /> <span className="max-w-[140px] truncate">{an.name}</span>
                      </a>
                    ))}
                    {a.comprovantes.map((an, k) => (
                      <a key={`c${k}`} href={anexoHref(an as any)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300" title="Comprovante do repasse (Pix ao cliente)">
                        <Check className="h-3 w-3" /> comprovante <span className="max-w-[110px] truncate">{an.name}</span>
                      </a>
                    ))}
                    {a.anexos.length === 0 && a.comprovantes.length === 0 && <span className="text-[10px] text-zinc-400">sem anexos — suba o alvará/comprovante no clipe do lançamento no financeiro</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

/** Botão de copiar com feedback de check. */
function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title="Copiar"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* clipboard bloqueado */ }
      }}
      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Card de cobrança ASAAS: gera boleto/pix pro cliente e concilia com o caixa. */
function CobrancaAsaasCard({
  nome, documento, email, telefone, contactId,
}: { nome: string; documento: string; email: string; telefone: string; contactId?: string }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(documento || '');
  const [valor, setValor] = useState('');
  const hoje = new Date();
  const venc0 = new Date(hoje.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  const [vencimento, setVencimento] = useState(venc0);
  const [billingType, setBillingType] = useState<'UNDEFINED' | 'BOLETO' | 'PIX'>('UNDEFINED');
  const [parcelas, setParcelas] = useState('1');
  const [descricao, setDescricao] = useState('Honorários advocatícios');

  const { data: statusAsaas } = useQuery({
    queryKey: ['financeiro', 'asaas-status'],
    queryFn: () => financeiroService.asaasStatus(),
    staleTime: 300_000,
  });

  const gerar = useMutation({
    mutationFn: () =>
      financeiroService.criarCobrancaAsaas({
        name: nome,
        cpfCnpj: doc,
        email: email || undefined,
        phone: telefone || undefined,
        value: Number(String(valor).replace(',', '.')),
        dueDate: vencimento,
        billingType,
        description: descricao || undefined,
        parcelas: Number(parcelas) > 1 ? Number(parcelas) : undefined,
        contactId,
      }),
  });

  const res = gerar.data;
  const semDoc = doc.replace(/\D+/g, '').length < 11;

  return (
    <Card title="Cobrança (ASAAS)" icon={CircleDollarSign}>
      {statusAsaas && !statusAsaas.configurado ? (
        <p className="text-sm text-zinc-400">
          Integração ASAAS não configurada (falta a chave <code>ASAAS_API_KEY</code> no servidor).
        </p>
      ) : !open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">Gere um boleto ou pix para este cliente — cai direto no caixa.</p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c7ed6]"
          >
            <Plus className="h-4 w-4" /> Gerar cobrança
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {semDoc && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Este cliente está sem CPF/CNPJ na ficha — preencha o campo abaixo (obrigatório para emitir).
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-xs text-zinc-500">
              CPF/CNPJ
              <input
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder="Somente números"
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Valor (R$)
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Vencimento
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Forma
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as 'UNDEFINED' | 'BOLETO' | 'PIX')}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="UNDEFINED">Boleto + Pix (cliente escolhe)</option>
                <option value="BOLETO">Boleto</option>
                <option value="PIX">Pix</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-500">
              Parcelas
              <input
                type="number"
                min={1}
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="col-span-2 block text-xs text-zinc-500">
              Descrição
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
          </div>

          {gerar.isError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {(gerar.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Falha ao gerar a cobrança.'}
            </p>
          )}

          {res?.ok ? (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">✅ Cobrança gerada e lançada no caixa.</p>
              {res.invoiceUrl && (
                <div className="flex items-center gap-2">
                  <a href={res.invoiceUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[#228BE6] hover:underline">
                    Link da fatura (boleto/pix)
                  </a>
                  <CopyBtn value={res.invoiceUrl} />
                </div>
              )}
              {res.bankSlipUrl && (
                <div className="flex items-center gap-2">
                  <a href={res.bankSlipUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[#228BE6] hover:underline">
                    Boleto em PDF
                  </a>
                  <CopyBtn value={res.bankSlipUrl} />
                </div>
              )}
              {res.pix?.payload && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">Pix copia-e-cola</span>
                  <CopyBtn value={res.pix.payload} />
                </div>
              )}
              <button onClick={() => { gerar.reset(); setValor(''); }} className="text-xs text-zinc-500 hover:text-[#228BE6]">
                Gerar outra
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Cancelar
              </button>
              <button
                onClick={() => gerar.mutate()}
                disabled={gerar.isPending || !valor || semDoc}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c7ed6] disabled:opacity-50"
              >
                {gerar.isPending ? 'Gerando…' : 'Gerar cobrança'}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Linha de dado cadastral com copiar e, p/ senha, mostrar/ocultar. */
function DataRow({ icon: Icon, label, value, copyable, secret }: { icon?: React.ElementType; label: string; value?: string | null; copyable?: boolean; secret?: boolean }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  const masked = secret && !show ? '•'.repeat(Math.min(value.length, 12)) : value;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-zinc-400">{label}</dt>
        <dd className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <span className="min-w-0 break-all">{masked}</span>
          {secret && (
            <button type="button" onClick={() => setShow((v) => !v)} title={show ? 'Ocultar' : 'Mostrar'} className="shrink-0 rounded p-1 text-zinc-400 hover:text-[#228BE6]">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
          {copyable && <CopyBtn value={value} />}
        </dd>
      </div>
    </div>
  );
}
