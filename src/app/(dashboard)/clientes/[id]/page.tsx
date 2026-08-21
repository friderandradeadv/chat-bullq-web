'use client';

import { useMemo, useRef, useState } from 'react';
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
  FolderOpen,
  Download,
  RefreshCw,
  Trash2,
  FileSignature,
  ExternalLink,
  ClipboardCheck,
  History,
  Gavel,
  Landmark,
  Banknote,
  FileCheck2,
  CircleDot,
  Folder,
  ChevronRight,
  HardDrive,
  FolderPlus,
  Upload,
  Stamp,
  X,
  Pencil,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { clientsService } from '@/features/legal-cases/services/clients.service';
import {
  clientDocumentsService,
  CATEGORIA_LABEL,
  type ClientDocument,
} from '@/features/legal-cases/services/client-documents.service';
import {
  driveBrowserService,
  type ItemDrive,
} from '@/features/legal-cases/services/drive-browser.service';
import { useAuthStore } from '@/stores/auth-store';
import { ArquivarPecaModal } from '@/features/legal-cases/components/arquivar-peca-modal';
import {
  clientTimelineService,
  type Marco,
  type MarcoTipo,
} from '@/features/legal-cases/services/client-timeline.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { tagsService } from '@/features/settings/services/tags.service';
import { financeiroService, anexoHref } from '@/features/financeiro/services/financeiro.service';
import { clienteFinanceiro, STATUS_FIN } from '@/features/financeiro/lib/clientes';
import { formatPhone } from '@/lib/brazil-states';
import { titleCaseName } from '@/lib/names';
import { StateFlag } from '@/components/ui/state-flag';
import { CnjNumber, ASTREA_BLUE, LegalTagChip } from '../../processos/page';

const brlc = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
};

/** Abas da ficha. A tela única empilhava ficha + processos + documentos +
 *  financeiro numa rolagem só; separadas, cada assunto abre onde se procura. */
const ABAS = [
  { key: 'dados', label: 'Dados', icon: User },
  { key: 'documentos', label: 'Documentos', icon: FolderOpen },
  { key: 'processos', label: 'Processos', icon: Scale },
  { key: 'historico', label: 'Histórico', icon: History },
  { key: 'financeiro', label: 'Financeiro', icon: CircleDollarSign },
] as const;
type AbaKey = (typeof ABAS)[number]['key'];

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Cadastro migrado do Pipefy (gravado em contact.metadata.cadastro). O tipo do
// service só declara alguns campos; login/senha (gov.br/Meu INSS) vêm no runtime.
type Cadastro = {
  cpf?: string | null; cnpj?: string | null; rg?: string | null;
  estadoCivil?: string | null; profissao?: string | null; endereco?: string | null;
  login?: string | null; senha?: string | null;
  /** DD/MM/AAAA — lida do RG/CNH pelo extrator. Alimenta idade e aniversário. */
  nascimento?: string | null;
};

/** Idade em anos a partir de DD/MM/AAAA. null se a data não for utilizável. */
function idadeDe(nascimento?: string | null): number | null {
  const m = (nascimento ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - Number(m[3]);
  const jaFez =
    hoje.getMonth() + 1 > Number(m[2]) ||
    (hoje.getMonth() + 1 === Number(m[2]) && hoje.getDate() >= Number(m[1]));
  if (!jaFez) anos--;
  return anos >= 0 && anos < 130 ? anos : null;
}

/**
 * "Cidade/UF" tirada do endereço completo. O trecho vem como "…, na cidade de
 * Volta Redonda/RJ, CEP …" e o "na cidade de" é linguagem de peça — no
 * cabeçalho da ficha ele só atrapalha, então sai aqui e fica só na qualificação.
 */
function cidadeDe(endereco?: string | null): { cidade: string; uf: string } | null {
  const m = (endereco ?? '').match(/([^,\/]+)\/([A-Z]{2})\b/);
  if (!m) return null;
  const cidade = m[1].replace(/^\s*na cidade de\s+/i, '').trim();
  return cidade ? { cidade, uf: m[2] } : null;
}

/** Endereço enxuto para a ficha: "Rua, Nº, Bairro, Cidade/CEP" — sem juridiquês. */
function enderecoCurto(endereco?: string | null): string | null {
  const e = (endereco ?? '').trim();
  if (!e) return null;
  return e
    .replace(/,?\s*na cidade de\s+/i, ', ')
    .replace(/\s*,\s*CEP\s+/i, ' · CEP ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Ano em que a ação foi ajuizada, lido do número CNJ. O formato é
 * NNNNNNN-DD.AAAA.J.TR.OOOO — o `AAAA` é o ano de distribuição, e é o dado mais
 * confiável que temos quando o processo veio de migração sem data preenchida.
 */
function anoDoCnj(cnj?: string | null): number | null {
  const m = (cnj ?? '').match(/^\d{7}-\d{2}\.(\d{4})\./);
  if (!m) return null;
  const ano = Number(m[1]);
  return ano >= 1990 && ano <= new Date().getFullYear() ? ano : null;
}

/** "há 2 anos", "há 8 meses" — tempo desde o primeiro vínculo com o escritório. */
function tempoDeCasa(desde?: string | Date | null): string | null {
  if (!desde) return null;
  const d = new Date(desde);
  if (isNaN(d.getTime())) return null;
  const meses = Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (meses < 1) return 'há poucos dias';
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;
  const [aba, setAba] = useState<AbaKey>('dados');
  // Navegar no Drive TOMA a aba inteira: dentro de um cartão a lista rolava numa
  // caixinha e não dava para trabalhar. Fora dela, é uma tela de arquivos.
  const [navegandoDrive, setNavegandoDrive] = useState(false);
  const [editando, setEditando] = useState(false);

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

  // Badge da aba Documentos. Mesma chave do card, então o React Query serve a
  // resposta já em cache em vez de repetir a chamada.
  const { data: docsDoCliente = [] } = useQuery({
    queryKey: ['client-documents', cliente?.partyId, contact?.id ?? null, cadastro?.cpf || cadastro?.cnpj || cliente?.document || null],
    queryFn: () =>
      clientDocumentsService.list({
        partyId: cliente!.partyId,
        contactId: contact?.id ?? undefined,
        cliente: cliente!.name,
        documento: (cadastro?.cpf || cadastro?.cnpj || cliente!.document) ?? undefined,
      }),
    enabled: !!cliente,
  });
  const qtdDocs = docsDoCliente.length;
  const temContrato = docsDoCliente.some((d) => d.categoria === 'CONTRATO');
  const docPrincipal = cadastro?.cpf || cadastro?.cnpj || cliente?.document || null;
  const idade = idadeDe(cadastro?.nascimento);
  const cidade = cidadeDe(cadastro?.endereco);
  // Há quanto tempo é cliente. Em ordem de confiança:
  //   1. assinatura do contrato (ZapSign) — a data exata;
  //   2. data do arquivo do contrato no Drive — proxy da assinatura;
  //   3. ANO do número CNJ mais antigo — quando o processo veio de migração sem
  //      data, o `AAAA` do CNJ ainda diz o ano do ajuizamento.
  // O `createdAt` do processo NUNCA entra: é quando o caso foi cadastrado no
  // hub, e dizia "há 2 meses" de um cliente que está conosco desde 2024.
  const conosco = useMemo(() => {
    const contrato = docsDoCliente.find((d) => d.categoria === 'CONTRATO');
    const doContrato = contrato?.assinadoEm ?? contrato?.driveModifiedAt ?? null;
    if (doContrato) return tempoDeCasa(doContrato);

    const anos = meusCasos.map((c) => anoDoCnj(c.cnjNumber)).filter((a): a is number => a != null);
    if (!anos.length) return null;
    // Só o ANO é conhecido — dizer "há 2 anos e 7 meses" seria precisão falsa.
    return `conosco desde ${Math.min(...anos)}`;
  }, [docsDoCliente, meusCasos]);

  // Resumo financeiro para a faixa de indicadores. Mesma chave do cartão da aba
  // Financeiro, então o React Query serve do cache em vez de buscar duas vezes.
  const { data: dashFin } = useQuery({
    queryKey: ['financeiro', 'dashboard'],
    queryFn: () => financeiroService.dashboard(),
    staleTime: 60_000,
  });
  const fin = useMemo(
    () => (cliente ? clienteFinanceiro(dashFin, cliente.name) : null),
    [dashFin, cliente],
  );

  if (!id) return null;
  if (isLoading)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Carregando…</div>;
  if (!cliente)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Cliente não encontrado.</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F6F7F9] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* ── Topo fixo: quem é o cliente não some ao rolar a aba ── */}
      <div className="shrink-0 border-b border-zinc-200/80 bg-white px-4 pt-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:px-6 dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
        <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#228BE6]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ClienteAvatar
              nome={titleCaseName(cliente.name)}
              avatarUrl={contact?.avatarUrl ?? null}
              contactId={contact?.id ?? null}
              onSynced={() => qc.invalidateQueries({ queryKey: ['legal-clients'] })}
            />
            <div className="min-w-0">
              {/* No CADASTRO o nome do cliente é "Primeira Letra Maiúscula".
                  Título de processo continua em caixa alta — é a praxe forense,
                  e são coisas diferentes que não devem se contaminar. */}
              <h1 className="truncate text-2xl font-medium text-[#202124] dark:text-zinc-100">
                {titleCaseName(cliente.name)}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
                {/* Quem é, em uma linha: idade, de onde e há quanto tempo é do
                    escritório. CPF e telefone saíram daqui — estão logo abaixo,
                    nos cartões de Qualificação e Contato. */}
                <span>Cliente</span>
                {idade != null && (<><span>·</span><span>{idade} anos</span></>)}
                {cidade && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <StateFlag uf={cidade.uf} className="h-2.5 w-4 shrink-0 rounded-[1px] object-cover ring-1 ring-black/10" />
                      {cidade.cidade}/{cidade.uf}
                    </span>
                  </>
                )}
                {conosco && (
                  <>
                    <span>·</span>
                    <span title="pela assinatura do contrato; sem ela, pelo ano do número CNJ">
                      {conosco.startsWith('conosco desde') ? conosco : `${conosco} conosco`}
                    </span>
                  </>
                )}
              </div>


              {/* Etiquetas logo abaixo do nome — mesma lógica da ficha do processo */}
              <div className="mt-2">
                {contact ? (
                  <TagsEditor
                    contactId={contact.id}
                    tags={contact.tags}
                    onChanged={() => qc.invalidateQueries({ queryKey: ['legal-clients'] })}
                  />
                ) : (
                  <span className="text-xs text-zinc-400">
                    Etiquetas disponíveis após vincular o cliente a um contato do Comercial
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Faixa de indicadores: clicar leva à aba correspondente ── */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Indicador
            label="Processos"
            valor={String(meusCasos.length)}
            detalhe={gruposCasos.andamento.length ? `${gruposCasos.andamento.length} em andamento` : 'nenhum em andamento'}
            icon={Scale}
            cor="#228BE6"
            onClick={() => setAba('processos')}
          />
          <Indicador
            label="Documentos"
            valor={String(qtdDocs)}
            detalhe={temContrato ? 'contrato na ficha' : 'sem contrato ainda'}
            icon={FolderOpen}
            cor={temContrato ? '#2F9E44' : '#868E96'}
            onClick={() => setAba('documentos')}
          />
          <Indicador
            label="Recebido"
            valor={fin ? brlc(fin.recebido) : '—'}
            detalhe={fin ? `${fin.n} pagamento(s)` : 'sem lançamentos'}
            icon={CircleDollarSign}
            cor="#2F9E44"
            onClick={() => setAba('financeiro')}
          />
          <Indicador
            label="Situação"
            valor={fin ? STATUS_FIN[fin.status].label : '—'}
            detalhe={fin ? STATUS_FIN[fin.status].dica : 'sem histórico financeiro'}
            icon={CircleDollarSign}
            cor={fin ? STATUS_FIN[fin.status].cor : '#868E96'}
            onClick={() => setAba('financeiro')}
          />
        </div>

        {/* ── Abas ── */}
        <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {ABAS.map((a) => {
            const ativa = aba === a.key;
            const n = a.key === 'processos' ? meusCasos.length : a.key === 'documentos' ? qtdDocs : null;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setAba(a.key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                  ativa
                    ? 'border-[#228BE6] text-[#228BE6]'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <a.icon className="h-4 w-4" />
                {a.label}
                {n !== null && n > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    ativa ? 'bg-[#228BE6]/10 text-[#228BE6]' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        {aba === 'dados' &&
          (editando ? (
            <EditarCliente
              partyId={cliente.partyId}
              nome={cliente.name}
              cadastro={cadastro}
              contato={contact}
              onFechar={() => setEditando(false)}
              onSalvo={() => {
                setEditando(false);
                qc.invalidateQueries({ queryKey: ['legal-clients'] });
                qc.invalidateQueries({ queryKey: ['legal-case'] });
              }}
            />
          ) : (
            <div>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DEE2E6] bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar ficha
                </button>
              </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* QUALIFICAÇÃO — o que identifica a pessoa numa petição (CPF, RG,
                estado civil, profissão, endereço). Vem do cadastro extraído da
                procuração / migrado do Pipefy. */}
            <div className="space-y-5">
              <Card title="Qualificação" icon={IdCard}>
                {cadastro && (cadastro.cpf || cadastro.cnpj || cadastro.rg || cadastro.endereco || cadastro.estadoCivil || cadastro.profissao) ? (
                  <>
                    <dl className="space-y-3 text-sm">
                      <DataRow icon={Fingerprint} label="CPF" value={cadastro.cpf} copyable />
                      <DataRow icon={IdCard} label="CNPJ" value={cadastro.cnpj} copyable />
                      <DataRow icon={IdCard} label="RG" value={cadastro.rg} copyable />
                      <DataRow icon={User} label="Estado civil" value={cadastro.estadoCivil} />
                      <DataRow icon={User} label="Profissão" value={cadastro.profissao} />
                      <EnderecoRow endereco={cadastro.endereco} />
                    </dl>
                    <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <CopiarQualificacao nome={cliente.name} cadastro={cadastro} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Sem qualificação cadastrada. Ela é extraída da procuração assinada ou veio da
                    migração do Pipefy.
                  </p>
                )}
              </Card>

            </div>

            {/* CONTATO — como se fala com a pessoa. Vem do Comercial (Contact),
                fonte diferente da qualificação. */}
            <div className="space-y-5">
              <Card title="Contato" icon={MessageCircle}>
                {contact ? (
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
                ) : (
                  <p className="text-sm text-zinc-400">
                    Cliente ainda sem ficha no Comercial. Quando houver um contato com o mesmo nome
                    (ou ao vincular), telefone, e-mail e etiquetas aparecem aqui.
                  </p>
                )}
              </Card>

              {/* ACESSOS — credencial de terceiro (gov.br / Meu INSS). Separada de
                  propósito: é o dado mais sensível da ficha e não deve ficar
                  misturado com telefone e e-mail. */}
              {(cadastro?.login || cadastro?.senha) && (
                <Card title="Acessos gov.br / Meu INSS" icon={KeyRound}>
                  <dl className="space-y-3 text-sm">
                    <DataRow icon={KeyRound} label="Login" value={cadastro.login} copyable />
                    <DataRow icon={KeyRound} label="Senha" value={cadastro.senha} copyable secret />
                  </dl>
                </Card>
              )}
            </div>
          </div>
            </div>
          ))}

        {aba === 'documentos' &&
          (navegandoDrive ? (
            <PastaNoDrive partyId={cliente.partyId} onFechar={() => setNavegandoDrive(false)} />
          ) : (
            <div className="space-y-5">
              <DocumentosCard
                nome={cliente.name}
                partyId={cliente.partyId}
                contactId={contact?.id ?? null}
                documento={docPrincipal}
              />
              <Card title="Pasta no Google Drive" icon={HardDrive}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-400">
                    A pasta do cliente como está agora — inclusive o que ainda não foi indexado.
                  </p>
                  <button
                    type="button"
                    onClick={() => setNavegandoDrive(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#DEE2E6] px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <HardDrive className="h-3.5 w-3.5" /> Abrir a pasta
                  </button>
                </div>
              </Card>
            </div>
          ))}

        {aba === 'processos' && (
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
        )}

        {aba === 'historico' && <LinhaDoTempo partyId={cliente.partyId} />}

        {aba === 'financeiro' && (
          <div className="space-y-5">
            <ClienteFinanceiroCard nome={cliente.name} cases={meusCasos} />
            <CobrancaAsaasCard
              nome={cliente.name}
              documento={docPrincipal || ''}
              email={contact?.email || ''}
              telefone={contact?.phone || ''}
              contactId={contact?.id || undefined}
            />
            {/* Pipefy: Fase 3 — falta o valor da causa por processo */}
            <div className="rounded-lg border border-dashed border-[#DEE2E6] bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
              Valor da causa por processo (cruzamento com o <strong className="font-medium text-zinc-500">Pipefy</strong>) — em breve.
            </div>
          </div>
        )}
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
        {/* Mesmo chip da aba Processos (LegalTagChip): fundo na cor real da
            etiqueta, texto em caixa alta. A pílula clara daqui destoava. */}
        {tags.map((t) => (
          <LegalTagChip
            key={t.id}
            label={t.name}
            color={t.color}
            onRemove={() => remove.mutate(t.id)}
          />
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
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-4px_rgba(16,24,40,0.08)] transition-shadow hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_20px_-6px_rgba(16,24,40,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
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

/**
 * Foto do cliente no cabeçalho da ficha. A foto vem do WhatsApp, já re-hospedada
 * no nosso domínio pelo enricher (o link cru do WhatsApp é CDN de curta duração
 * e quebra depois). Sem foto: iniciais, com um botão discreto pra buscar agora.
 */
function ClienteAvatar({
  nome,
  avatarUrl,
  contactId,
  onSynced,
}: {
  nome: string;
  avatarUrl: string | null;
  contactId: string | null;
  onSynced: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [quebrou, setQuebrou] = useState(false);
  const temFoto = !!avatarUrl && !quebrou;

  const buscar = async () => {
    if (!contactId) return;
    setBusy(true);
    try {
      const { avatarUrl: nova } = await inboxService.syncContactAvatar(contactId);
      if (nova) {
        setQuebrou(false);
        toast.success('Foto atualizada do WhatsApp.');
        onSynced();
      } else {
        toast.info('Esse cliente não tem foto de perfil pública no WhatsApp.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui buscar a foto no WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative h-12 w-12 shrink-0">
      {temFoto ? (
        <img
          src={avatarUrl!}
          alt={nome}
          onError={() => setQuebrou(true)}
          className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#228BE6]/10 text-lg font-semibold text-[#228BE6]">
          {nome.trim().slice(0, 2).toUpperCase()}
        </span>
      )}
      {contactId && (
        <button
          type="button"
          onClick={buscar}
          disabled={busy}
          title={temFoto ? 'Atualizar a foto pelo WhatsApp' : 'Buscar a foto no WhatsApp'}
          className="absolute -bottom-0.5 -right-0.5 rounded-full border border-zinc-200 bg-white p-1 text-zinc-400 opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-[#228BE6] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

/** Ícone e cor por categoria — contrato salta à vista, o resto fica sóbrio. */
const ESTILO_CATEGORIA: Record<string, { cor: string; chip: string }> = {
  CONTRATO: { cor: '#2F9E44', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  PROCURACAO: { cor: '#228BE6', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  HIPOSSUFICIENCIA: { cor: '#7048E8', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  RENUNCIA: { cor: '#7048E8', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  RESIDENCIA: { cor: '#F59F00', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  PESSOAL: { cor: '#F59F00', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  KIT: { cor: '#868E96', chip: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  PROCESSO: { cor: '#868E96', chip: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  OUTRO: { cor: '#868E96', chip: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
};

const tamanhoLegivel = (b: number | null) => {
  if (!b) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Documentos do cliente que moram no Google Drive — contrato de honorários,
 * procuração, hipossuficiência e os documentos pessoais (RG/CNH/comprovante).
 *
 * O arquivo NÃO é copiado pro hub: a ficha guarda o ponteiro e a API baixa do
 * Drive na hora, atrás da autenticação. Por isso "Excluir" tira só daqui — no
 * Drive o arquivo continua.
 */
function DocumentosCard({
  nome,
  partyId,
  contactId,
  documento,
}: {
  nome: string;
  partyId: string;
  contactId: string | null;
  documento: string | null;
}) {
  const qc = useQueryClient();
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const chave = ['client-documents', partyId, contactId, documento] as const;
  const { data: docs = [], isLoading } = useQuery({
    queryKey: chave,
    queryFn: () =>
      clientDocumentsService.list({
        partyId,
        contactId: contactId ?? undefined,
        cliente: nome,
        documento: documento ?? undefined,
      }),
  });

  // Contrato e afins em cima; documentos pessoais logo abaixo, separados —
  // é como o advogado procura (primeiro o que assina, depois o que qualifica).
  const { escritorio, pessoais } = useMemo(() => {
    const pes = new Set(['PESSOAL', 'RESIDENCIA']);
    return {
      escritorio: docs.filter((d) => !pes.has(d.categoria)),
      pessoais: docs.filter((d) => pes.has(d.categoria)),
    };
  }, [docs]);

  const abrir = async (d: ClientDocument) => {
    setAbrindo(d.id);
    try {
      const { url } = await clientDocumentsService.abrir(d.id);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui abrir o documento.');
    } finally {
      setAbrindo(null);
    }
  };

  const importar = async () => {
    setImportando(true);
    try {
      const r = await clientDocumentsService.importar({ apenasCliente: nome });
      await qc.invalidateQueries({ queryKey: ['client-documents'] });
      if (!r.pastasVarridas) toast.info(`Nenhuma pasta de "${nome}" encontrada em 01.CLIENTES.`);
      else if (r.indexados) toast.success(`${r.indexados} documento(s) importado(s) do Drive.`);
      else toast.info('Nada novo — os documentos do Drive já estavam na ficha.');
      if (r.erros.length) toast.warning(r.erros[0]);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao importar do Drive.');
    } finally {
      setImportando(false);
    }
  };

  const remover = async (d: ClientDocument) => {
    if (!confirm(`Tirar "${d.nome}" da ficha?\n\nO arquivo CONTINUA no Google Drive — some só daqui.`))
      return;
    try {
      await clientDocumentsService.remover(d.id);
      await qc.invalidateQueries({ queryKey: ['client-documents'] });
      toast.success('Removido da ficha (o arquivo continua no Drive).');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao remover.');
    }
  };

  const Linha = ({ d }: { d: ClientDocument }) => {
    const est = ESTILO_CATEGORIA[d.categoria] ?? ESTILO_CATEGORIA.OUTRO;
    const tam = tamanhoLegivel(d.tamanho);
    return (
      <li className="flex items-start gap-2 px-3 py-2.5">
        <FileSignature className="mt-0.5 h-4 w-4 shrink-0" style={{ color: est.cor }} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => abrir(d)}
            disabled={abrindo === d.id}
            className="block max-w-full truncate text-left text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline disabled:opacity-60 dark:text-zinc-200"
            title={d.nome}
          >
            {abrindo === d.id && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
            {d.nome}
          </button>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            <span className={`rounded px-1.5 py-0.5 font-medium ${est.chip}`}>
              {CATEGORIA_LABEL[d.categoria] ?? 'Documento'}
            </span>
            {d.origem === 'ZAPSIGN' && <span title="Assinado pelo ZapSign">· assinado</span>}
            {d.assinadoEm && <span>· {new Date(d.assinadoEm).toLocaleDateString('pt-BR')}</span>}
            {tam && <span>· {tam}</span>}
            {d.drivePath && <span className="truncate">· {d.drivePath}</span>}
          </p>
          {d.tambemEm.length > 0 && (
            <p
              className="mt-0.5 truncate text-[11px] text-zinc-400"
              title={`O mesmo arquivo também está em: ${d.tambemEm.join(' | ')}`}
            >
              cópia idêntica também em {d.tambemEm.join(', ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => abrir(d)}
            title="Abrir / baixar"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {d.driveWebViewLink && (
            <a
              href={d.driveWebViewLink}
              target="_blank"
              rel="noreferrer"
              title="Abrir no Google Drive"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-[#228BE6] dark:hover:bg-zinc-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => remover(d)}
            title="Tirar da ficha (não apaga no Drive)"
            className="rounded p-1.5 text-zinc-300 hover:bg-rose-50 hover:text-rose-500 dark:text-zinc-600 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  };

  const Bloco = ({ titulo, lista }: { titulo: string; lista: ClientDocument[] }) =>
    lista.length === 0 ? null : (
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)] dark:border-zinc-800 dark:bg-transparent dark:shadow-none">
        <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/40">
          <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{titulo}</span>
          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-zinc-500 dark:bg-zinc-900/60">
            {lista.length}
          </span>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {lista.map((d) => (
            <Linha key={d.id} d={d} />
          ))}
        </ul>
      </div>
    );

  return (
    <Card title={`Documentos (${docs.length})`} icon={FolderOpen}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          Os arquivos ficam no Google Drive — a ficha só mostra e abre. Remover aqui não apaga lá.
        </p>
        <button
          type="button"
          onClick={importar}
          disabled={importando}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#DEE2E6] px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
        >
          {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Importar do Drive
        </button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-zinc-400">Carregando…</p>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          Nenhum documento na ficha. Clique em <strong className="font-medium">Importar do Drive</strong> para
          trazer o contrato de honorários e os documentos pessoais da pasta deste cliente.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Pessoais primeiro: RG, CNH e comprovante são o que se abre no dia a
              dia (juntar em petição, conferir endereço). O contrato assinado se
              consulta uma vez e fica. */}
          <Bloco titulo="Documentos pessoais" lista={pessoais} />
          <Bloco titulo="Contrato e documentos assinados" lista={escritorio} />
        </div>
      )}
    </Card>
  );
}


/**
 * Cartão de indicador do topo. Clicar leva à aba correspondente — a faixa é
 * atalho, não enfeite: quem abre um cliente quer saber em quantos processos ele
 * está, se o contrato já está na ficha e quanto já entrou.
 */
function Indicador({
  label,
  valor,
  detalhe,
  icon: Icon,
  cor,
  onClick,
}: {
  label: string;
  valor: string;
  detalhe: string;
  icon: React.ElementType;
  cor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 pl-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-4px_rgba(16,24,40,0.08)] transition-all hover:-translate-y-px hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_10px_24px_-8px_rgba(16,24,40,0.16)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
    >
      {/* Faixa na cor do indicador: o que dá leitura imediata no modo claro,
          onde caixa branca sobre fundo branco não tinha nenhum relevo. */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: cor }} />
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
        <Icon className="h-3.5 w-3.5" style={{ color: cor }} />
        {label}
      </span>
      <span className="mt-0.5 block truncate text-lg font-semibold tabular-nums" style={{ color: cor }}>
        {valor}
      </span>
      <span className="block truncate text-[11px] text-zinc-400">{detalhe}</span>
    </button>
  );
}

/**
 * Monta e copia a QUALIFICAÇÃO da parte no formato que vai no preâmbulo da
 * petição. É o dado que mais se copia à mão da ficha, campo por campo — aqui sai
 * pronto, na ordem do costume forense.
 *
 * Só usa o que está cadastrado: campo em branco é OMITIDO da frase e listado
 * como pendência embaixo do botão, para o advogado ver o que falta antes de
 * colar. A nacionalidade não existe no cadastro e vai como "brasileiro(a)" —
 * está avisado no aviso de pendências, porque é o único trecho presumido.
 */
function montarQualificacao(nome: string, c: Cadastro | null): { texto: string; faltando: string[] } {
  const partes: string[] = [nome.trim().toUpperCase()];
  const faltando: string[] = ['nacionalidade (presumida "brasileiro(a)")'];

  partes.push('brasileiro(a)');
  if (c?.estadoCivil) partes.push(c.estadoCivil.toLowerCase());
  else faltando.push('estado civil');
  if (c?.profissao) partes.push(c.profissao.toLowerCase());
  else faltando.push('profissão');
  if (c?.rg) partes.push(`portador(a) da cédula de identidade RG nº ${c.rg.trim()}`);
  else faltando.push('RG');
  if (c?.cpf) partes.push(`inscrito(a) no CPF sob o nº ${c.cpf.trim()}`);
  else if (c?.cnpj) partes.push(`inscrito(a) no CNPJ sob o nº ${c.cnpj.trim()}`);
  else faltando.push('CPF');
  if (c?.endereco) partes.push(`residente e domiciliado(a) na ${c.endereco.trim()}`);
  else faltando.push('endereço');

  return { texto: partes.join(', '), faltando };
}

function CopiarQualificacao({ nome, cadastro }: { nome: string; cadastro: Cadastro | null }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);
  const { faltando } = useMemo(() => montarQualificacao(nome, cadastro), [nome, cadastro]);

  const gerar = () => {
    setTexto(montarQualificacao(nome, cadastro).texto);
    setAberto(true);
    setCopiado(false);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Qualificação copiada.');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não consegui copiar.');
    }
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={gerar}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#DEE2E6] px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:text-zinc-300"
      >
        <FileSignature className="h-3.5 w-3.5" /> Gerar qualificação completa
      </button>
    );
  }

  return (
    <div>
      {/* Editável de propósito: o cadastro nunca cobre todo caso (nacionalidade,
          união estável, nome social, endereço com complemento). Melhor ajustar
          aqui, ver o resultado e só então copiar, do que colar e corrigir na peça. */}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        spellCheck={false}
        className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1c7ed6]"
        >
          {copiado ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={gerar}
          title="Descarta as edições e refaz a partir do cadastro"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refazer
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Fechar
        </button>
        {faltando.length > 0 && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            confira: {faltando.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}


/**
 * Endereço na ficha, enxuto: "Rua, Nº, Bairro, Cidade/UF · CEP". O "na cidade
 * de" é linguagem de peça — fica na qualificação, não aqui. A bandeirinha do
 * estado é a mesma do chat, para a ficha e o atendimento falarem a mesma língua.
 */
function EnderecoRow({ endereco }: { endereco?: string | null }) {
  const curto = enderecoCurto(endereco);
  const uf = cidadeDe(endereco)?.uf;
  if (!curto) return null;
  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-zinc-400">Endereço</dt>
        <dd className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
          {uf && <StateFlag uf={uf} className="mt-1 h-2.5 w-4 shrink-0 rounded-[1px] object-cover ring-1 ring-black/10" />}
          <span className="min-w-0 flex-1">{curto}</span>
          <CopyBtn value={curto} />
        </dd>
      </div>
    </div>
  );
}


/** Cada tipo de marco tem ícone e cor próprios — a linha se lê de relance. */
const ESTILO_MARCO: Record<MarcoTipo, { icon: React.ElementType; cor: string; rotulo: string }> = {
  contrato:     { icon: FileCheck2,       cor: '#2F9E44', rotulo: 'Contrato' },
  documento:    { icon: FileText,         cor: '#868E96', rotulo: 'Documento' },
  distribuicao: { icon: Landmark,         cor: '#228BE6', rotulo: 'Distribuição' },
  andamento:    { icon: CircleDot,        cor: '#ADB5BD', rotulo: 'Andamento' },
  sentenca:     { icon: Gavel,            cor: '#7048E8', rotulo: 'Sentença' },
  recurso:      { icon: Scale,            cor: '#F59F00', rotulo: 'Recurso' },
  alvara:       { icon: Banknote,         cor: '#2F9E44', rotulo: 'Alvará' },
  honorario:    { icon: CircleDollarSign, cor: '#228BE6', rotulo: 'Honorários' },
  repasse:      { icon: Banknote,         cor: '#12B886', rotulo: 'Repasse' },
  fase:         { icon: CircleDot,        cor: '#868E96', rotulo: 'Fase' },
};

/**
 * Histórico do cliente, UM BLOCO POR PROCESSO.
 *
 * A primeira versão era uma lista única com tudo misturado, e não contava
 * história nenhuma: "juiz pediu documento" de um caso encostava em "sentença" do
 * outro. Cada processo agora tem a sua narrativa em ordem, e o que é do CLIENTE
 * (contrato, documentos) fica num bloco à parte, no topo.
 *
 * O filtro "só marcos" nasce LIGADO: um processo antigo tem centenas de
 * despachos e o bloco viraria log de cartório.
 */
function LinhaDoTempo({ partyId }: { partyId: string }) {
  const [soMarcos, setSoMarcos] = useState(true);
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-timeline', partyId],
    queryFn: () => clientTimelineService.get(partyId),
  });

  const grupos = useMemo(() => {
    const gs = data?.grupos ?? [];
    if (!soMarcos) return gs;
    return gs
      .map((g) => ({ ...g, marcos: g.marcos.filter((m) => m.destaque) }))
      .filter((g) => g.marcos.length > 0);
  }, [data, soMarcos]);

  const total = data?.marcos.length ?? 0;
  const mostrando = grupos.reduce((n, g) => n + g.marcos.length, 0);

  if (isLoading)
    return <Card title="Histórico" icon={History}><p className="py-6 text-center text-sm text-zinc-400">Montando o histórico…</p></Card>;
  if (error)
    return <Card title="Histórico" icon={History}><p className="py-6 text-center text-sm text-rose-500">{(error as Error).message}</p></Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          Cada processo com a sua história: distribuição, andamentos, sentença, alvará e repasse.
        </p>
        <button
          type="button"
          onClick={() => setSoMarcos((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {soMarcos ? `Mostrar tudo (${total - mostrando} a mais)` : 'Só os marcos'}
        </button>
      </div>

      {grupos.length === 0 ? (
        <Card title="Histórico" icon={History}>
          <p className="py-6 text-center text-sm text-zinc-400">Nada registrado ainda para este cliente.</p>
        </Card>
      ) : (
        grupos.map((g) => (
          <div
            key={g.caseId ?? 'relacionamento'}
            className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-4px_rgba(16,24,40,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              {g.caseId ? <Scale className="h-4 w-4 text-[#228BE6]" /> : <User className="h-4 w-4 text-[#868E96]" />}
              {g.caseId ? (
                <Link href={`/processos/${g.caseId}`} className="text-sm font-semibold text-zinc-800 hover:text-[#228BE6] hover:underline dark:text-zinc-100">
                  {g.titulo}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{g.titulo}</span>
              )}
              {g.area && <span className="text-xs text-zinc-400">· {g.area}</span>}
              {g.cnjNumber && <span className="text-xs text-zinc-400">· <CnjNumber value={g.cnjNumber} /></span>}
              <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-zinc-500 dark:bg-zinc-900">
                {g.marcos.length}
              </span>
            </div>
            <ol className="relative px-4 py-2">
              {/* Trilho vertical: é ele que faz a sequência ser lida como história */}
              <span className="absolute bottom-4 left-[31px] top-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              {g.marcos.map((m, i) => (
                <MarcoItem key={`${m.data}-${i}`} m={m} />
              ))}
            </ol>
          </div>
        ))
      )}
    </div>
  );
}

function MarcoItem({ m }: { m: Marco }) {
  const est = ESTILO_MARCO[m.tipo] ?? ESTILO_MARCO.andamento;
  const Icon = est.icon;
  const data = new Date(m.data);
  return (
    <li className="relative flex gap-3 py-2.5">
      <span
        className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900"
        style={{
          backgroundColor: m.destaque ? est.cor : 'transparent',
          border: m.destaque ? 'none' : `1.5px solid ${est.cor}`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: m.destaque ? '#fff' : est.cor }} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-sm ${m.destaque ? 'font-semibold text-zinc-800 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'}`}>
            {m.titulo}
          </span>
          {m.valor != null && (
            <span className="text-sm font-semibold tabular-nums" style={{ color: est.cor }}>
              {brlc(m.valor)}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
          <span className="tabular-nums">{data.toLocaleDateString('pt-BR')}</span>
          <span className="rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: `${est.cor}1a`, color: est.cor }}>
            {est.rotulo}
          </span>
          {m.detalhe && <span className="truncate">· {m.detalhe}</span>}
        </p>
      </div>
    </li>
  );
}


/**
 * Pasta do cliente no Google Drive, AO VIVO — tela de arquivos, no estilo do
 * Finder: barra com Voltar, trilha clicável e a lista ocupando a altura toda.
 *
 * Complementa o índice, não o substitui: o índice é o que o hub SABE
 * (contadores, categorias, deduplicação das cópias por produto, linha do tempo)
 * — perguntas sobre o conjunto, que uma pasta não responde. Esta é a pasta como
 * está AGORA, e garante que a ficha nunca esconda um arquivo que existe.
 *
 * Desde 20/08/2026 também ESCREVE: cria pasta, sobe arquivo, manda para a
 * lixeira e arquiva peça protocolada na fase certa. O que era só vitrine virou
 * a pasta de verdade — sem sair do hub e sem abrir o Drive ao lado.
 */
function PastaNoDrive({ partyId, onFechar }: { partyId: string; onFechar: () => void }) {
  const [caminho, setCaminho] = useState<string[]>([]);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [novaPasta, setNovaPasta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arquivarAberto, setArquivarAberto] = useState(false);
  const inputArquivos = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Remover é destrutivo: só sócio, como todo destrutivo do hub. A rota também
  // trava — isto aqui é só não mostrar um botão que ia dar 403.
  const activeOrg = useAuthStore((st) => st.organizations.find((o) => o.id === st.activeOrgId));
  const podeRemover = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  const { data, isFetching, error } = useQuery({
    queryKey: ['drive-pasta', partyId, caminho.join('/')],
    queryFn: () => driveBrowserService.listar(partyId, caminho),
    // Sempre fresco: o sentido desta visão é justamente não guardar estado.
    staleTime: 0,
    gcTime: 0,
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ['drive-pasta', partyId] });

  const abrirArquivo = async (it: ItemDrive) => {
    setAbrindo(it.id);
    try {
      const url = await driveBrowserService.abrir(partyId, caminho, it.id);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui abrir o arquivo.');
    } finally {
      setAbrindo(null);
    }
  };

  const criarPasta = async () => {
    const nome = (novaPasta ?? '').trim();
    if (!nome) return setNovaPasta(null);
    setOcupado('pasta');
    try {
      await driveBrowserService.criarPasta(partyId, caminho, nome);
      setNovaPasta(null);
      await recarregar();
      toast.success(`Pasta "${nome}" criada.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui criar a pasta.');
    } finally {
      setOcupado(null);
    }
  };

  const enviarArquivos = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setOcupado('enviar');
    try {
      const r = await driveBrowserService.enviar(partyId, caminho, arquivos);
      await recarregar();
      if (r.pulados?.length)
        toast.warning(
          `${r.enviados.length} enviado(s). Já existiam e não foram sobrescritos: ${r.pulados.join(', ')}`,
        );
      else toast.success(`${r.enviados.length} arquivo(s) na pasta.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui enviar.');
    } finally {
      setOcupado(null);
      if (inputArquivos.current) inputArquivos.current.value = '';
    }
  };

  const remover = async (it: ItemDrive) => {
    const oQue = it.pasta ? 'a pasta' : 'o arquivo';
    if (!window.confirm(`Mandar ${oQue} "${it.nome}" para a lixeira do Drive?`)) return;
    setOcupado(it.id);
    try {
      await driveBrowserService.excluir(partyId, caminho, it.id);
      await recarregar();
      toast.success(`"${it.nome}" foi para a lixeira do Drive.`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      // Pasta com conteúdo: a rota recusa e diz quantos itens vão junto. Quem
      // decide é o advogado, com o número na frente.
      if (/item\(ns\) dentro/.test(msg)) {
        if (window.confirm(`${msg}\n\nMandar tudo para a lixeira?`)) {
          try {
            await driveBrowserService.excluir(partyId, caminho, it.id, true);
            await recarregar();
            toast.success(`"${it.nome}" foi para a lixeira do Drive.`);
          } catch (e2: any) {
            toast.error(e2?.response?.data?.message || 'Não consegui remover.');
          }
        }
      } else toast.error(msg || 'Não consegui remover.');
    } finally {
      setOcupado(null);
    }
  };

  const subir = () => setCaminho((c) => c.slice(0, -1));
  const naRaiz = caminho.length === 0;

  return (
    <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-4px_rgba(16,24,40,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      {/* Barra de navegação — Voltar sobe um nível, como no Finder */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200/80 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
        <button
          type="button"
          onClick={subir}
          disabled={naRaiz}
          title={naRaiz ? 'Você está na pasta do cliente' : `Voltar para ${caminho[caminho.length - 2] ?? data?.cliente ?? 'a pasta anterior'}`}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        <HardDrive className="h-4 w-4 shrink-0 text-zinc-400" />
        {/* Trilha clicável: qualquer nível volta direto, sem subir de um em um */}
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setCaminho([])}
            className={`rounded px-1.5 py-0.5 font-medium ${naRaiz ? 'text-zinc-500' : 'text-[#228BE6] hover:underline'}`}
          >
            {data?.cliente ?? 'Cliente'}
          </button>
          {caminho.map((nome, i) => (
            <span key={`${nome}-${i}`} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-zinc-300" />
              <button
                type="button"
                onClick={() => setCaminho(caminho.slice(0, i + 1))}
                className={`truncate rounded px-1.5 py-0.5 font-medium ${i === caminho.length - 1 ? 'text-zinc-500' : 'text-[#228BE6] hover:underline'}`}
              >
                {nome}
              </button>
            </span>
          ))}
          {isFetching && <Loader2 className="ml-1 h-3 w-3 animate-spin text-zinc-400" />}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {data?.webViewLink && (
            <a
              href={data.webViewLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#228BE6]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> abrir no Drive
            </a>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" /> Fechar
          </button>
        </div>
      </div>

      {/* Ações de escrita. "Arquivar peça" é a porta do protocolo: leva a peça
          para a fase, na subpasta datada, com os PDFs numerados. As outras duas
          são a pasta crua — um documento pessoal, um comprovante. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setArquivarAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1c7ed6]"
        >
          <Stamp className="h-3.5 w-3.5" /> Arquivar peça
        </button>
        <button
          type="button"
          onClick={() => inputArquivos.current?.click()}
          disabled={ocupado === 'enviar'}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {ocupado === 'enviar' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Enviar arquivos
        </button>
        <button
          type="button"
          onClick={() => setNovaPasta('')}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
        </button>
        <input
          ref={inputArquivos}
          type="file"
          multiple
          hidden
          onChange={(e) => enviarArquivos(e.target.files)}
        />
        <span className="ml-auto text-[11px] text-zinc-400">
          {naRaiz ? 'raiz do cliente' : `em ${caminho[caminho.length - 1]}`}
        </span>
      </div>

      {/* Lista: rola com a aba, não dentro de uma caixinha */}
      <div className="flex-1">
        {novaPasta !== null && (
          <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
            <FolderPlus className="h-4 w-4 shrink-0 text-[#228BE6]" />
            <input
              autoFocus
              value={novaPasta}
              onChange={(e) => setNovaPasta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') criarPasta();
                if (e.key === 'Escape') setNovaPasta(null);
              }}
              placeholder="Nome da pasta (ex.: 10. COBRANÇAS)"
              className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={criarPasta}
              disabled={ocupado === 'pasta'}
              className="rounded-md bg-[#228BE6] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {ocupado === 'pasta' ? 'Criando…' : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => setNovaPasta(null)}
              className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancelar
            </button>
          </div>
        )}

        {error ? (
          <p className="px-4 py-10 text-center text-sm text-rose-500">{(error as Error).message}</p>
        ) : !data ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-400">Lendo a pasta no Drive…</p>
        ) : data.itens.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-400">Pasta vazia.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.itens.map((it) => (
              <li key={it.id} className="group relative">
                <button
                  type="button"
                  onDoubleClick={() => it.pasta && setCaminho([...caminho, it.nome])}
                  onClick={() => (it.pasta ? setCaminho([...caminho, it.nome]) : abrirArquivo(it))}
                  disabled={abrindo === it.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800/50"
                >
                  {it.pasta ? (
                    <Folder className="h-4.5 w-4.5 shrink-0 text-[#228BE6]" />
                  ) : abrindo === it.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {it.nome}
                  </span>
                  {!it.pasta && it.categoria && it.categoria !== 'OUTRO' && (
                    <span className="hidden shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline dark:bg-zinc-800 dark:text-zinc-400">
                      {CATEGORIA_LABEL[it.categoria] ?? it.categoria}
                    </span>
                  )}
                  {!it.pasta && it.tamanho != null && (
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                      {tamanhoLegivel(it.tamanho)}
                    </span>
                  )}
                  {it.modificadoEm && (
                    <span className="hidden w-20 shrink-0 text-right text-[11px] tabular-nums text-zinc-400 sm:inline">
                      {new Date(it.modificadoEm).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${it.pasta ? 'text-zinc-300' : 'invisible'}`} />
                </button>

                {podeRemover && (
                  <button
                    type="button"
                    onClick={() => remover(it)}
                    disabled={ocupado === it.id}
                    title="Mandar para a lixeira do Drive"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                  >
                    {ocupado === it.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && (
        <div className="shrink-0 border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
          {data.itens.filter((i) => i.pasta).length} pasta(s) ·{' '}
          {data.itens.filter((i) => !i.pasta).length} arquivo(s) · lido do Drive agora
        </div>
      )}

      {arquivarAberto && (
        <ArquivarPecaModal
          partyId={partyId}
          onFechar={() => setArquivarAberto(false)}
          onPronto={(r) => {
            setArquivarAberto(false);
            setCaminho(r.caminho);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

/** Campo do formulário de edição — rótulo em cima, input embaixo. */
function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
      />
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}

/**
 * Edição da ficha do cliente direto na aba — qualificação, contato e acessos.
 *
 * Só os campos que MUDARAM sobem: uma edição parcial não pode apagar o resto do
 * cadastro, e boa parte dele foi extraída da procuração com trabalho de IA.
 *
 * O nome é gravado em Title Case pelo servidor (padrão do cadastro), e ao
 * renomear os documentos já indexados são reetiquetados — senão sumiriam da
 * ficha, porque foram indexados sob a chave do nome antigo.
 */
function EditarCliente({
  partyId,
  nome,
  cadastro,
  contato,
  onFechar,
  onSalvo,
}: {
  partyId: string;
  nome: string;
  cadastro: Cadastro | null;
  contato: { phone: string | null; email: string | null } | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const inicial = useMemo(
    () => ({
      nome: titleCaseName(nome),
      telefone: contato?.phone ?? '',
      email: contato?.email ?? '',
      cpf: cadastro?.cpf ?? '',
      cnpj: cadastro?.cnpj ?? '',
      rg: cadastro?.rg ?? '',
      estadoCivil: cadastro?.estadoCivil ?? '',
      profissao: cadastro?.profissao ?? '',
      endereco: cadastro?.endereco ?? '',
      nascimento: cadastro?.nascimento ?? '',
      login: cadastro?.login ?? '',
      senha: cadastro?.senha ?? '',
    }),
    [nome, cadastro, contato],
  );

  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const alterados = useMemo(
    () => (Object.keys(form) as (keyof typeof form)[]).filter((k) => form[k] !== inicial[k]),
    [form, inicial],
  );

  const salvar = async () => {
    if (!alterados.length) {
      onFechar();
      return;
    }
    if (form.nascimento && !/^\d{2}\/\d{2}\/\d{4}$/.test(form.nascimento)) {
      toast.error('Data de nascimento deve estar em DD/MM/AAAA.');
      return;
    }
    setSalvando(true);
    try {
      // Só o que mudou — o resto do cadastro fica intacto.
      const patch: Record<string, string | null> = {};
      for (const k of alterados) patch[k] = form[k] || null;
      await clientsService.atualizar(partyId, patch);
      toast.success('Ficha atualizada.');
      onSalvo();
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          {alterados.length
            ? `${alterados.length} campo(s) alterado(s) — só eles serão gravados.`
            : 'Altere o que precisar e salve.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1c7ed6] disabled:opacity-60"
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card title="Qualificação" icon={IdCard}>
            <div className="space-y-3">
              <Campo label="Nome" value={form.nome} onChange={set('nome')}
                hint="Gravado em Primeira Letra Maiúscula — padrão do cadastro." />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="CPF" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
                <Campo label="CNPJ" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
                <Campo label="RG" value={form.rg} onChange={set('rg')} />
                <Campo label="Nascimento" value={form.nascimento} onChange={set('nascimento')} placeholder="DD/MM/AAAA" />
                <Campo label="Estado civil" value={form.estadoCivil} onChange={set('estadoCivil')} />
                <Campo label="Profissão" value={form.profissao} onChange={set('profissao')} />
              </div>
              <Campo label="Endereço" value={form.endereco} onChange={set('endereco')}
                placeholder="Rua, Nº, Bairro, Cidade/UF, CEP 00000-000" />
            </div>
          </Card>

          <Card title="Acessos gov.br / Meu INSS" icon={KeyRound}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Login" value={form.login} onChange={set('login')} />
              <Campo label="Senha" value={form.senha} onChange={set('senha')} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Contato" icon={MessageCircle}>
            {contato ? (
              <div className="space-y-3">
                <Campo label="Telefone" value={form.telefone} onChange={set('telefone')} placeholder="+55 (00) 00000-0000" />
                <Campo label="E-mail" value={form.email} onChange={set('email')} type="email" />
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Cliente sem contato no Comercial. Telefone e e-mail passam a ser editáveis depois de
                vincular um contato — é nele que o chat lê esses dados.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
