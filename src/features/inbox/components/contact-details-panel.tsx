'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import {
  User,
  Star,
  Image as ImageIcon,
  CheckSquare,
  FileSignature,
  Activity,
  Heart,
  Tag as TagIcon,
  Film,
  File,
  Cloud,
  Plus,
  Loader2,
  Sparkles,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDot,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bot,
  Wrench,
  AlertTriangle,
  ExternalLink,
  Columns3,
  Building2,
  LayoutGrid,
  Mail,
  StickyNote,
  Check,
  X,
  RefreshCw,
  Pencil,
  Trash2,
  Scale,
  Copy,
  KeyRound,
  Eye,
  EyeOff,
  IdCard,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  legalCasesService,
  type ClientCaseRow,
  type ClientCaseSuggestion,
} from '@/features/legal-cases/services/legal-cases.service';
import { inboxService, type Conversation, type Message } from '../services/inbox.service';
import {
  scheduledMessagesService,
  type ScheduledMessage,
} from '../services/scheduled-messages.service';
import { ScheduledAnexos } from './scheduled-messages-bar';
import {
  zapSignService,
  type ZapSignTemplate,
  type ZapSignDocument,
} from '@/features/settings/services/zapsign.service';
import { aiAgentsService, type FeedRun } from '@/features/ai-agents/services/ai-agents.service';
import { AssignmentPopover } from './assignment-popover';
import { departmentsService } from '@/features/settings/services/departments.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { tasksService } from '@/features/tasks/services/tasks.service';
import { useAuthStore } from '@/stores/auth-store';
import { useComposerDraftStore } from '../stores/composer-draft-store';
import { tagsService } from '@/features/settings/services/tags.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { contactsService } from '@/features/contacts/services/contacts.service';
import { useOrgId } from '@/hooks/use-org-query-key';
import { useSocket } from '../hooks/use-socket';
import { cn } from '@/lib/utils';
import { getBrazilState, formatPhone } from '@/lib/brazil-states';
import { avatarColor, avatarInitials, chipTextColor } from '@/lib/avatar';
import { StateFlag } from '@/components/ui/state-flag';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Atendimento humano',
  PENDING: 'Pendente',
  BOT: 'Bot / IA',
  CLOSED: 'Encerrado',
  WAITING: 'Aguardando',
};

const STATUS_DOT: Record<string, string> = {
  OPEN: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  BOT: 'bg-blue-500',
  CLOSED: 'bg-zinc-400',
  WAITING: 'bg-violet-500',
};

// ─── Avatar ──────────────────────────────────────────────────────────────────

function PanelAvatar({
  name,
  avatarUrl,
  size = 'lg',
}: {
  name: string | null;
  avatarUrl: string | null;
  size?: 'lg' | 'sm';
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === 'lg' ? 'h-16 w-16' : 'h-7 w-7';
  const textSize = size === 'lg' ? 'text-xl' : 'text-[11px]';

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'avatar'}
        onError={() => setFailed(true)}
        className={`${dim} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`flex ${dim} items-center justify-center rounded-full ${textSize} font-semibold text-white`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitials(name)}
    </div>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

// ─── Processos do cliente (vínculo chat ↔ jurídico) ──────────────────────────
const CASE_STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  SUSPENDED: 'bg-amber-500',
  CLOSED: 'bg-zinc-400',
  ARCHIVED: 'bg-zinc-400',
};

/** Dados cadastrais do cliente (CPF/RG/endereço/estado civil/profissão) —
 *  a mesma ficha `contact.metadata.cadastro` que a inicial usa na qualificação.
 *  A conversa da lista não traz o `metadata`, então buscamos o contato completo
 *  por id. Traz também um atalho pra abrir a ficha na aba Contatos. */
function ClientRegistrationSection({
  contactId,
  phone,
  name,
}: {
  contactId: string;
  phone: string | null;
  name: string | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { on } = useSocket();
  const [showSenha, setShowSenha] = useState(false);
  const { data: full } = useQuery({
    queryKey: ['contact-full', contactId],
    queryFn: () => contactsService.getById(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });

  // Captura automática de login/senha gov.br: o backend grava em
  // contact.metadata.cadastro e emite 'conversation:updated' com cadastroUpdated.
  // Invalida a ficha na hora pra o campo Meu INSS aparecer sem F5.
  useEffect(() => {
    const unsub = on('conversation:updated', (payload: any) => {
      if (payload?.contactId === contactId && payload?.cadastroUpdated) {
        qc.invalidateQueries({ queryKey: ['contact-full', contactId] });
      }
    });
    return () => unsub();
  }, [on, qc, contactId]);

  const cad = ((full?.metadata as any)?.cadastro ?? {}) as {
    login?: string | null;
    senha?: string | null;
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  // "Nos Contatos" — abre a ficha cadastral COMPLETA do cliente (CPF/RG/endereço/
  // profissão…) já filtrada (a página lê ?search= do URL). No chat deixamos só o
  // acesso ao Meu INSS pra não poluir. Prioriza o telefone e cai no nome.
  const goToContacts = () => {
    const q = phone || name || '';
    router.push(`/contacts${q ? `?search=${encodeURIComponent(q)}` : ''}`);
  };

  // Sem login/senha salvos → nada aqui (painel limpo pra leads).
  if (!cad.login && !cad.senha) return null;

  return (
    <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <p className="flex-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Meu INSS / gov.br
        </p>
        <button
          onClick={goToContacts}
          title="Abrir a ficha cadastral completa do cliente na aba Contatos"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          Ficha completa <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1.5">
        {cad.login && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[11px] text-zinc-400">Login</span>
            <span className="inline-flex items-center gap-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span className="truncate">{cad.login}</span>
              <button
                onClick={() => copy(cad.login!, 'Login')}
                title="Copiar login"
                className="shrink-0 text-zinc-300 transition-colors hover:text-primary"
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        {cad.senha && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[11px] text-zinc-400">Senha</span>
            <span className="inline-flex items-center gap-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span className="truncate">
                {showSenha ? cad.senha : '•'.repeat(Math.min(cad.senha.length, 12))}
              </span>
              <button
                onClick={() => setShowSenha((v) => !v)}
                title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="shrink-0 text-zinc-300 transition-colors hover:text-primary"
              >
                {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button
                onClick={() => copy(cad.senha!, 'Senha')}
                title="Copiar senha"
                className="shrink-0 text-zinc-300 transition-colors hover:text-primary"
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Cliente da casa que escreve de um número NOVO entra como contato zerado: a
 *  parte do processo continua amarrada ao contato antigo e a trava anti-homônimo
 *  (correta) impede o match por nome — o painel fica vazio e a triagem trata
 *  cliente como lead. Aqui mostramos os CANDIDATOS (mesmo nome, cadastro do
 *  processo à vista pra conferir) e o vínculo só acontece no clique do humano.
 *  Depois de vinculado, TODOS os processos daquela pessoa aparecem, o robô
 *  também os enxerga, e não se pergunta o CPF de novo. */
function ClientCaseSuggestionsSection({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['cases-by-contact-sugestoes', contactId],
    queryFn: () => legalCasesService.casesByContactSuggestions(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  const vincular = useMutation({
    mutationFn: (partyId: string) => legalCasesService.vincularContato(contactId, partyId),
    onSuccess: (res) => {
      toast.success(
        res.cases.length === 1
          ? 'Contato vinculado ao cliente — 1 processo'
          : `Contato vinculado ao cliente — ${res.cases.length} processos`,
      );
      qc.invalidateQueries({ queryKey: ['cases-by-contact', contactId] });
      qc.invalidateQueries({ queryKey: ['cases-by-contact-sugestoes', contactId] });
      qc.invalidateQueries({ queryKey: ['contact-full', contactId] });
    },
    onError: () => toast.error('Não foi possível vincular'),
  });
  const sugestoes = data?.sugestoes ?? [];
  if (sugestoes.length === 0) return null;

  return (
    <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Pode ser cliente da casa
        </p>
      </div>
      <p className="mb-2 text-[11px] leading-snug text-zinc-400">
        Mesmo nome, mas o processo está em outro contato (número antigo). Confira o
        cadastro e vincule — o processo só aparece depois da sua confirmação.
      </p>
      <div className="space-y-1.5">
        {sugestoes.map((s: ClientCaseSuggestion) => (
          <div
            key={s.partyId}
            className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {s.produto || s.area || 'Processo'}
              </span>
              {s.faseLabel && (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  {s.faseLabel.replace(/^\d+(\.\d+)?\.?\s*/, '')}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              {s.title}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-400">
              {s.cnjNumber || 'sem nº'}
            </p>
            <div className="mt-1 space-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <p className="truncate">
                Cliente no processo: <span className="font-medium">{s.clienteNoProcesso}</span>
              </p>
              {s.cpfNoProcesso && <p className="truncate">CPF do cadastro: {s.cpfNoProcesso}</p>}
              {s.outroContato?.phone && (
                <p className="truncate">Número antigo: {formatPhone(s.outroContato.phone)}</p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                disabled={vincular.isPending}
                onClick={() => vincular.mutate(s.partyId)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {vincular.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                É o mesmo cliente · vincular
              </button>
              <button
                type="button"
                onClick={() => window.open(`/processos/${s.caseId}`, '_blank', 'noopener')}
                title="Abrir o processo para conferir"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:text-primary dark:border-zinc-700 dark:text-zinc-400"
              >
                <ExternalLink className="h-3 w-3" />
                Conferir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Atalho pra FICHA DO CLIENTE (/clientes/[partyId]) — a aba com cadastro,
 *  processos conosco e etiquetas. Abre em GUIA NOVA: quem está atendendo não
 *  pode perder a conversa de vista. Só aparece pra quem já é cliente do jurídico
 *  (tem processo fora do pré-judicial); lead segue com o painel limpo.
 *  Reusa a query de casesByContact (mesmo cache das outras seções). */
function OpenClientRecordButton({ contactId }: { contactId: string }) {
  const { data } = useQuery({
    queryKey: ['cases-by-contact', contactId],
    queryFn: () => legalCasesService.casesByContact(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  const partyId = data?.clientePartyId;
  if (!partyId) return null;
  return (
    <button
      type="button"
      onClick={() => window.open(`/clientes/${partyId}`, '_blank', 'noopener')}
      title="Abrir a ficha do cliente em outra guia (cadastro, processos e etiquetas)"
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <IdCard className="h-3.5 w-3.5" />
      Abrir ficha do cliente
    </button>
  );
}

function ClientCasesSection({ contactId }: { contactId: string }) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['cases-by-contact', contactId],
    queryFn: () => legalCasesService.casesByContact(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  // Advogados atribuíveis, pra escolher o responsável PELO PROCESSO (Case.responsibleId).
  const { data: members = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    staleTime: 300_000,
  });
  const cases = data?.cases ?? [];
  const clientePartyId = data?.clientePartyId ?? null;

  const copyCnj = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Número do processo copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  // Painel limpo p/ leads: só aparece quando há processo vinculado. Sem
  // processo, ainda pode haver CANDIDATO (cliente da casa escrevendo de número
  // novo) — aí entra o bloco de vínculo, que exige confirmação humana.
  if (isLoading) return null;
  if (cases.length === 0) return <ClientCaseSuggestionsSection contactId={contactId} />;

  return (
    <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-zinc-400" />
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Processos do cliente
        </p>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {cases.length}
        </span>
        {clientePartyId && (
          <button
            type="button"
            onClick={() => window.open(`/clientes/${clientePartyId}`, '_blank', 'noopener')}
            title="Abrir a ficha do cliente em outra guia (cadastro, processos e etiquetas)"
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Ficha do cliente <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {cases.map((c: ClientCaseRow) => (
          <div key={c.id} className="group relative">
          {/* Card clicável (div, não button) pra permitir o botão de copiar
              o nº do processo aninhado sem <button> dentro de <button>. */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => window.open(`/processos/${c.id}`, '_blank', 'noopener')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.open(`/processos/${c.id}`, '_blank', 'noopener');
              }
            }}
            title="Abrir processo em outra guia"
            className="block w-full cursor-pointer rounded-lg border border-zinc-200/70 bg-white px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', CASE_STATUS_DOT[c.status] ?? 'bg-zinc-400')} />
                {c.produto || c.area || 'Processo'}
              </span>
              {c.faseLabel && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {c.faseLabel.replace(/^\d+(\.\d+)?\.?\s*/, '')}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              {c.title}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span className="truncate font-mono">{c.cnjNumber || (c.lane === 'pre' ? 'pré-processual' : 'sem nº')}</span>
              {c.cnjNumber && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCnj(c.cnjNumber!);
                  }}
                  title="Copiar número do processo"
                  className="shrink-0 text-zinc-300 transition-colors hover:text-primary dark:text-zinc-600"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {/* Responsável PELO PROCESSO (advogado dono do caso) — editável. É quem
              o robô aciona quando precisa transferir, e por onde o advogado sabe
              que aquele cliente é dele. */}
          <div className="mt-1 flex items-center gap-1.5 pl-1">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Responsável
            </span>
            <CaseResponsibleChip
              caseId={c.id}
              contactId={contactId}
              responsavelId={c.responsavelId}
              responsavel={c.responsavel}
              members={members}
            />
          </div>
          {/* Ação no hover: ver no Kanban. O ↗ "abrir em nova guia" saiu — o
              próprio card já abre em guia nova. */}
          <div className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const board = c.legalPhase?.startsWith('repb_')
                  ? '/juridico/repb'
                  : c.legalPhase?.startsWith('plan_')
                    ? '/juridico/planejamento'
                    : c.legalPhase?.startsWith('banco_')
                      ? '/juridico/fase-bancaria'
                      : c.lane === 'pre' ? '/juridico/pre-processual' : '/juridico/kanban';
                window.open(`${board}?case=${c.id}`, '_blank', 'noopener');
              }}
              title="Ver no Kanban"
              className="rounded bg-white/90 p-1 text-zinc-400 shadow-sm hover:text-primary dark:bg-zinc-900/90"
            >
              <Columns3 className="h-3 w-3" />
            </button>
          </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chip editável do responsável PELO PROCESSO (Case.responsibleId). Mesmo modelo
 *  do responsável da conversa, mas grava no caso — é o que o robô usa pra
 *  transferir e o que diz a cada advogado quais clientes são dele. */
function CaseResponsibleChip({
  caseId,
  contactId,
  responsavelId,
  responsavel,
  members,
}: {
  caseId: string;
  contactId: string;
  responsavelId: string | null;
  responsavel: string | null;
  members: Member[];
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const assignable = members.filter(
    (m) => m.assignable !== false && m.user?.isActive !== false,
  );

  const setResponsible = async (userId: string | null, close: () => void) => {
    if ((userId ?? null) === (responsavelId ?? null)) {
      close();
      return;
    }
    setSaving(true);
    try {
      // '' faz o backend limpar (responsibleId || null); assertResponsible ignora vazio.
      await legalCasesService.update(caseId, { responsibleId: userId ?? '' });
      qc.invalidateQueries({ queryKey: ['cases-by-contact', contactId] });
      qc.invalidateQueries({ queryKey: ['legal-clients'] });
      toast.success(userId ? 'Responsável do processo atualizado' : 'Responsável removido');
      close();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao definir responsável');
    } finally {
      setSaving(false);
    }
  };

  const label = saving
    ? 'Salvando…'
    : responsavel
      ? responsavel.split(' ').slice(0, 2).join(' ')
      : 'Definir';

  return (
    <Popover className="relative">
      <PopoverButton
        disabled={saving}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60',
          responsavel
            ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
            : 'border-dashed border-zinc-300 text-zinc-500 hover:border-primary/40 hover:text-primary dark:border-zinc-600',
        )}
      >
        <User className="h-3 w-3 shrink-0" />
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </PopoverButton>
      <PopoverPanel className="absolute right-0 z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {({ close }) => (
          <>
            {assignable.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-400">
                Nenhum advogado disponível.
              </div>
            )}
            {assignable.map((m) => {
              const active = m.user.id === responsavelId;
              return (
                <button
                  key={m.id}
                  onClick={() => setResponsible(m.user.id, close)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="truncate text-zinc-700 dark:text-zinc-200">
                    {m.user.name}
                  </span>
                  {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
            {responsavelId && (
              <>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                <button
                  onClick={() => setResponsible(null, close)}
                  className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Remover responsável
                </button>
              </>
            )}
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

/** Bloco de topo "Responsável pelo cliente": mostra/edita o advogado dono do
 *  processo principal (o mais recente). Some quando o cliente não tem processo.
 *  Reusa a mesma query de casesByContact (cache compartilhado com a seção de
 *  processos, sem fetch duplicado). */
function ClientResponsibleSection({ contactId }: { contactId: string }) {
  const { data } = useQuery({
    queryKey: ['cases-by-contact', contactId],
    queryFn: () => legalCasesService.casesByContact(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    staleTime: 300_000,
  });
  const cases = data?.cases ?? [];
  if (cases.length === 0) return null; // sem processo vinculado → nada a mostrar
  const principal = cases[0]; // casesByContact já ordena (mais recente primeiro)
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <p
        className="shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
        title={cases.length > 1 ? 'Responsável pelo processo principal — os demais você ajusta em “Processos do cliente”.' : 'Responsável pelo processo do cliente'}
      >
        Responsável
      </p>
      <div className="min-w-0 flex-1">
        <CaseResponsibleChip
          caseId={principal.id}
          contactId={contactId}
          responsavelId={principal.responsavelId}
          responsavel={principal.responsavel}
          members={members}
        />
      </div>
    </div>
  );
}

/** Cria uma tarefa na Agenda direto do painel do cliente — opcionalmente
 *  vinculada a um dos processos dele (ex.: "juntar documento no processo X"). */
function QuickTaskSection({
  contactId,
  conversationId,
}: {
  contactId: string;
  conversationId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { data } = useQuery({
    queryKey: ['cases-by-contact', contactId],
    queryFn: () => legalCasesService.casesByContact(contactId),
    enabled: !!contactId,
    staleTime: 60_000,
  });
  const cases = data?.cases ?? [];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  // Prazo padrão = HOJE. A agenda ignora tarefa sem data (não tem onde plotar),
  // então nascer com data garante que ela apareça no calendário.
  const [dueAt, setDueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  const criar = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      await tasksService.create({
        title: t,
        // 9h como a criação de tarefa da própria agenda (evita virar "dia todo").
        dueAt: dueAt ? new Date(dueAt + 'T09:00:00').toISOString() : null,
        // Atribui a VOCÊ (quem cria) — senão a tarefa fica sem dono e não aparece
        // na "sua" agenda. Dá pra reatribuir depois na agenda/tarefas.
        assigneeId: currentUserId || undefined,
        contactId,
        conversationId,
        caseId: caseId || undefined,
      });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada na agenda');
      setTitle('');
      setDueAt(new Date().toISOString().slice(0, 10));
      setCaseId('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao criar tarefa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Tarefas</p>
        <button
          onClick={() => router.push('/tarefas')}
          className="text-[11px] text-zinc-400 hover:text-primary"
        >
          Ver tarefas
        </button>
      </div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-zinc-600"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') criar(); }}
            placeholder="O que fazer? (ex.: juntar documento no processo)"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-zinc-500">
              Prazo
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-[11px] text-zinc-500">
              Processo
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">— nenhum —</option>
                {cases.map((c: ClientCaseRow) => (
                  <option key={c.id} value={c.id}>
                    {(c.produto || c.area || 'Processo')}{c.cnjNumber ? ` · ${c.cnjNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setTitle(''); }}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={criar}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Criando…' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Botão "pedir resposta do robô": força o agente a reprocessar a ÚLTIMA
 *  mensagem do cliente agora. Útil quando o robô já tinha passado a vez (ex.:
 *  não achou o processo antes de corrigirmos o nome do contato). */
function AskBotButton({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false);
  const setDraft = useComposerDraftStore((s) => s.setDraft);
  const run = async () => {
    setLoading(true);
    try {
      // Modo RASCUNHO: o robô gera a resposta mas NÃO envia — cai na caixa de
      // mensagem pra você revisar/editar/enviar (seguro pra cliente irritado).
      const r = await inboxService.aiRun(conversationId, { draft: true });
      if (r?.ok && r.draft && r.draft.trim()) {
        setDraft(conversationId, r.draft);
        toast.success('Rascunho do robô na caixa de mensagem — revise e envie.');
      } else if (r?.ok) {
        toast.message('O robô não gerou uma resposta (pode ter decidido transferir para um humano ou não ter o que dizer).');
      } else {
        toast.error(
          r?.reason === 'no-inbound'
            ? 'Não há mensagem do cliente para o robô responder.'
            : r?.reason === 'already-running'
              ? 'O robô já está respondendo…'
              : 'O robô não conseguiu gerar o rascunho agora.',
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao acionar o robô');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={loading}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
      {loading ? 'Gerando…' : 'Gerar resposta do robô'}
    </button>
  );
}

function ProfileTab({ conversation }: { conversation: Conversation }) {
  const contact = conversation.contact;
  const state = getBrazilState(contact.phone);
  const [showMore, setShowMore] = useState(false);
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [savingDept, setSavingDept] = useState(false);
  const [savingContactStatus, setSavingContactStatus] = useState(false);
  const [syncingAvatar, setSyncingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [movingWorkspace, setMovingWorkspace] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: () => departmentsService.list(),
    staleTime: 60_000,
  });

  const { data: allAvailableTags = [] } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: () => tagsService.list(),
    staleTime: 60_000,
  });

  const { data: contactStatuses = [] } = useQuery({
    queryKey: ['contact-statuses', orgId],
    queryFn: () => contactStatusesService.list(),
    staleTime: 60_000,
  });

  const handleSetContactStatus = async (
    statusId: string | null,
    close: () => void,
  ) => {
    if (statusId === (contact.status?.id ?? null)) {
      close();
      return;
    }
    setSavingContactStatus(true);
    try {
      await contactStatusesService.setContactStatus(contact.id, statusId);
      // Reflete na hora: escreve o novo status no cache do detalhe. cancelQueries
      // antes evita que um poll de 5s já em voo (com dado antigo) sobrescreva.
      const newStatus = statusId
        ? (contactStatuses.find((s) => s.id === statusId) ?? null)
        : null;
      await queryClient.cancelQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.setQueryData(['conversation', conversation.id], (old: any) =>
        old ? { ...old, contact: { ...old.contact, status: newStatus } } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contact-statuses', orgId] });
      close();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao alterar status do contato');
    } finally {
      setSavingContactStatus(false);
    }
  };

  const handleSetDepartment = async (deptId: string | null, close: () => void) => {
    setSavingDept(true);
    try {
      await inboxService.updateConversation(conversation.id, { departmentId: deptId });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      close();
    } catch {
      // silent — header will show error if needed
    } finally {
      setSavingDept(false);
    }
  };

  const startEditName = () => {
    setNameValue(contact.name ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const next = nameValue.trim();
    if (!next || next === contact.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await inboxService.renameContact(contact.id, next);
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Nome atualizado');
      setEditingName(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar nome');
    } finally {
      setSavingName(false);
    }
  };

  const handleSyncAvatar = async () => {
    if (syncingAvatar) return;
    setSyncingAvatar(true);
    try {
      const { avatarUrl } = await inboxService.syncContactAvatar(contact.id);
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(avatarUrl ? 'Foto de perfil atualizada' : 'Sem foto pública no WhatsApp');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao sincronizar foto');
    } finally {
      setSyncingAvatar(false);
    }
  };

  // Toggle ciente de ONDE a tag está: remove de onde ela estiver (contato
  // e/ou conversa — cobre o caso duplicado) ou adiciona ao CONTATO (o painel
  // é das propriedades do contato; tag durável entre conversas). Antes só
  // tags de conversa tinham X — tag de contato ficava "fixa" no painel.
  const handleToggleTag = async (tagId: string, close?: () => void) => {
    const onConversation = (conversation.tags ?? []).some((t) => t.tag.id === tagId);
    const onContact = (contact.tags ?? []).some((t) => t.tag.id === tagId);
    setPendingTagId(tagId);
    try {
      if (onConversation) {
        await tagsService.removeFromConversation(conversation.id, tagId);
      }
      if (onContact) {
        await tagsService.removeFromContact(contact.id, tagId);
      }
      if (!onConversation && !onContact) {
        await tagsService.addToContact(contact.id, tagId);
      }
      // Reflete na hora no cache do detalhe. cancelQueries evita que um poll de
      // 5s já em voo (com dado antigo) desfaça a alteração antes do refetch.
      const removing = onConversation || onContact;
      const tagObj = allAvailableTags.find((t) => t.id === tagId);
      await queryClient.cancelQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.setQueryData(['conversation', conversation.id], (old: any) => {
        if (!old) return old;
        const drop = (arr: any[]) => (arr ?? []).filter((t) => t.tag.id !== tagId);
        return {
          ...old,
          contact: {
            ...old.contact,
            tags: removing
              ? drop(old.contact?.tags)
              : [...(old.contact?.tags ?? []), ...(tagObj ? [{ tag: tagObj }] : [])],
          },
          tags: removing ? drop(old.tags) : (old.tags ?? []),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      close?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao alterar tag');
    } finally {
      setPendingTagId(null);
    }
  };

  // Um chip por tag (dedupe contato × conversa). `onContact` define o visual:
  // sólido = tag do contato; tracejado = só da conversa.
  const allTags = (() => {
    const map = new Map<
      string,
      { tag: { id: string; name: string; color: string }; onContact: boolean; onConversation: boolean }
    >();
    for (const { tag } of contact.tags ?? []) {
      map.set(tag.id, { tag, onContact: true, onConversation: false });
    }
    for (const { tag } of conversation.tags ?? []) {
      const cur = map.get(tag.id);
      if (cur) cur.onConversation = true;
      else map.set(tag.id, { tag, onContact: false, onConversation: true });
    }
    return [...map.values()];
  })();

  // ── Workspace switcher ────────────────────────────────────────────
  // Workspaces (inbox-views) são definidas por TAG. "Mover de workspace"
  // = trocar a tag de área. Estes ids batem com os tagIds das views de
  // área/Clientes/Outros (e com o excludeTagIds da Recepção). Single-tenant:
  // se criar/alterar uma workspace, atualize esta lista.
  const WORKSPACES: { tagId: string; label: string }[] = [
    { tagId: 'lhtag_rmc_rcc', label: 'RMC/RCC' },
    { tagId: 'lhtag_trabalhista', label: 'Trabalhista' },
    { tagId: 'cmqbqd3dd000a2cbfk6zj6wfa', label: 'Previdenciário' },
    { tagId: 'lhtag_bpc_loas', label: 'BPC/LOAS' },
    { tagId: 'lhtag_salario_maternidade', label: 'Salário-Maternidade' },
    { tagId: 'cmqbqd3f5000b2cbff83zxs93', label: 'REPB' },
    { tagId: 'tag_outros', label: 'Parceiros / Outros' },
  ];
  // "Clientes" é uma workspace especial: definida pelo STATUS do contato
  // (lhst_cliente), NÃO por tag. Também é escolhível aqui no switcher (além do
  // pill de status), porque a equipe pensa em "Clientes" como uma área — mover
  // pra cá = marcar o contato como Cliente, o que já o tira das views de lead
  // (todas as áreas têm excludeContactStatusIds: [lhst_cliente]).
  const wsColor = (tagId: string) =>
    allAvailableTags.find((t) => t.id === tagId)?.color ?? '#a1a1aa';
  const currentWorkspace =
    WORKSPACES.find((w) => allTags.some((t) => t.tag.id === w.tagId)) ?? null;
  const CLIENTE_STATUS_ID = 'lhst_cliente';
  const clienteStatus =
    contactStatuses.find((s) => s.id === CLIENTE_STATUS_ID) ??
    contactStatuses.find((s) => (s.name ?? '').toLowerCase() === 'cliente') ??
    null;
  const isCliente = !!clienteStatus && contact.status?.id === clienteStatus.id;

  // Move a conversa entre workspaces = TROCA a tag de área: remove todas as
  // outras tags de workspace (da conversa E do contato) e aplica a do destino.
  // Alvo null = "Recepção (sem área)": só remove, volta pro firehose.
  const handleMoveWorkspace = async (
    targetTagId: string | null,
    close?: () => void,
  ) => {
    setMovingWorkspace(true);
    try {
      for (const ws of WORKSPACES) {
        if (ws.tagId === targetTagId) continue;
        if ((conversation.tags ?? []).some((t) => t.tag.id === ws.tagId))
          await tagsService.removeFromConversation(conversation.id, ws.tagId);
        if ((contact.tags ?? []).some((t) => t.tag.id === ws.tagId))
          await tagsService.removeFromContact(contact.id, ws.tagId);
      }
      if (targetTagId && !allTags.some((t) => t.tag.id === targetTagId)) {
        await tagsService.addToConversation(conversation.id, targetTagId);
      }
      // Reflete na hora: tira as tags de workspace e aplica a do destino no
      // cache do detalhe. cancelQueries evita sobrescrita por poll em voo.
      const wsIds = new Set(WORKSPACES.map((w) => w.tagId));
      const targetTag = targetTagId ? allAvailableTags.find((t) => t.id === targetTagId) : null;
      await queryClient.cancelQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.setQueryData(['conversation', conversation.id], (old: any) => {
        if (!old) return old;
        const stripWs = (arr: any[]) =>
          (arr ?? []).filter((t) => !wsIds.has(t.tag.id) || t.tag.id === targetTagId);
        const convTags = stripWs(old.tags);
        if (targetTag && !convTags.some((t: any) => t.tag.id === targetTagId)) {
          convTags.push({ tag: targetTag });
        }
        return { ...old, contact: { ...old.contact, tags: stripWs(old.contact?.tags) }, tags: convTags };
      });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      close?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao mover de workspace');
    } finally {
      setMovingWorkspace(false);
    }
  };

  // Ring do avatar = cor do STATUS do contato (não mais da etiqueta) —
  // mesma regra da lista de conversas.
  const ringColor = contact.status?.color ?? '#a1a1aa';

  return (
    <div className="flex flex-col items-center px-5 py-7">
      {/* Avatar with dynamic ring (tag color) + sync-photo button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => contact.avatarUrl && setPhotoExpanded(true)}
          className={cn('block rounded-full p-[3px]', contact.avatarUrl && 'cursor-zoom-in')}
          style={{ border: `3px solid ${ringColor}` }}
          title={contact.avatarUrl ? 'Ampliar foto' : undefined}
        >
          <PanelAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="lg" />
        </button>
        <button
          onClick={handleSyncAvatar}
          disabled={syncingAvatar}
          title="Atualizar foto de perfil do WhatsApp"
          className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-zinc-500 shadow-sm transition-colors hover:bg-primary hover:text-white disabled:opacity-60 dark:border-zinc-950 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <RefreshCw className={cn('h-3 w-3', syncingAvatar && 'animate-spin')} />
        </button>
      </div>

      {/* Lightbox — foto ampliada */}
      {photoExpanded && contact.avatarUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPhotoExpanded(false)}
        >
          <img
            src={contact.avatarUrl}
            alt={contact.name || 'foto'}
            className="h-[min(80vw,520px)] w-[min(80vw,520px)] rounded-2xl object-cover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPhotoExpanded(false)}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Name — click to edit */}
      {editingName ? (
        <div className="mt-3 flex items-center gap-1">
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            onBlur={handleSaveName}
            disabled={savingName}
            className="w-44 rounded-md border border-primary/40 bg-white px-2 py-1 text-center text-[15px] font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {savingName && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        </div>
      ) : (
        <button
          onClick={startEditName}
          title="Clique para editar o nome"
          className="group/name mt-3 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[15px] font-bold text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {contact.name || contact.phone || 'Desconhecido'}
          <Pencil className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover/name:opacity-100" />
        </button>
      )}

      {/* Phone com a bandeira do ESTADO ao lado (igual LíderHub). Hover na
          bandeira mostra o nome do estado. */}
      {contact.phone && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500">
          {state && (
            <StateFlag
              uf={state.uf}
              title={`${state.name} (${state.uf})`}
              className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
            />
          )}
          <span className="tracking-tight">{formatPhone(contact.phone)}</span>
          <span
            title={STATUS_LABELS[conversation.status] ?? conversation.status}
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[conversation.status] ?? 'bg-zinc-400'}`}
          />
        </p>
      )}

      {/* Email */}
      {contact.email && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{contact.email}</span>
        </p>
      )}

      {/* Atalho pra ficha do cliente (aba Clientes) */}
      <OpenClientRecordButton contactId={contact.id} />

      {/* Responsável PELO CLIENTE (advogado dono do caso) — fica acima do
          responsável da CONVERSA. É o que o robô usa pra transferir. */}
      <ClientResponsibleSection contactId={contact.id} />

      {/* Atendimento — clicar no card abre a troca de responsável */}
      <div className="mt-5 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Atendimento</p>
        <AssignmentPopover
          conversation={conversation}
          variant="card"
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }}
        />
        <AskBotButton conversationId={conversation.id} />
      </div>

      {/* Propriedades */}
      <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Propriedades</p>

        <div className="flex flex-col gap-2">
          {/* Status do contato (funil) — editable */}
          <div className="order-2 flex min-h-6 items-center gap-2.5">
            <CircleDot className="h-4 w-4 shrink-0 text-zinc-400" />
            <Popover className="relative flex items-center">
              <PopoverButton
                disabled={savingContactStatus}
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium leading-none outline-none transition-opacity hover:opacity-80 disabled:opacity-50',
                  !contact.status &&
                    'border-zinc-200 bg-zinc-50 italic text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500',
                )}
                style={
                  contact.status
                    ? {
                        backgroundColor: contact.status.color,
                        color: chipTextColor(contact.status.color),
                        borderColor: contact.status.color,
                      }
                    : undefined
                }
              >
                {savingContactStatus && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {contact.status?.name ?? 'Sem status'}
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </PopoverButton>
              <PopoverPanel
                anchor="bottom start"
                transition
                className="z-50 mt-1 w-52 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
              >
                {({ close }) => (
                  <>
                    {contact.status && (
                      <button
                        onClick={() => handleSetContactStatus(null, close)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Remover status
                      </button>
                    )}
                    {contactStatuses.map((s) => {
                      const isActive = s.id === contact.status?.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleSetContactStatus(s.id, close)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                            isActive
                              ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="flex-1 truncate">{s.name}</span>
                          {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                    {contactStatuses.length === 0 && (
                      <p className="px-3 py-2 text-center text-[11px] text-zinc-400">
                        Nenhum status criado — crie em Configurações → Status
                      </p>
                    )}
                  </>
                )}
              </PopoverPanel>
            </Popover>
          </div>

          {/* Workspace — move a conversa entre workspaces (troca a tag de área) */}
          <div className="order-4 flex min-h-6 items-center gap-2.5">
            <LayoutGrid className="h-4 w-4 shrink-0 text-zinc-400" />
            <Popover className="relative flex items-center">
              <PopoverButton
                disabled={movingWorkspace}
                title="Mover para outra workspace"
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium leading-none outline-none transition-opacity hover:opacity-80 disabled:opacity-50',
                  !currentWorkspace &&
                    !isCliente &&
                    'border-zinc-200 bg-zinc-50 italic text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500',
                )}
                style={
                  currentWorkspace
                    ? {
                        backgroundColor: wsColor(currentWorkspace.tagId),
                        color: chipTextColor(wsColor(currentWorkspace.tagId)),
                        borderColor: wsColor(currentWorkspace.tagId),
                      }
                    : isCliente && clienteStatus
                      ? {
                          backgroundColor: clienteStatus.color,
                          color: chipTextColor(clienteStatus.color),
                          borderColor: clienteStatus.color,
                        }
                      : undefined
                }
              >
                {movingWorkspace && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {currentWorkspace
                  ? currentWorkspace.label
                  : isCliente
                    ? 'Clientes'
                    : 'Recepção (sem área)'}
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </PopoverButton>
              <PopoverPanel
                anchor="bottom start"
                transition
                className="z-50 mt-1 w-56 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
              >
                {({ close }) => (
                  <>
                    <button
                      onClick={() => handleMoveWorkspace(null, close)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      Recepção (sem área)
                    </button>
                    {WORKSPACES.map((ws) => {
                      const isActive = currentWorkspace?.tagId === ws.tagId;
                      return (
                        <button
                          key={ws.tagId}
                          onClick={() => handleMoveWorkspace(ws.tagId, close)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                            isActive
                              ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: wsColor(ws.tagId) }}
                          />
                          <span className="flex-1 truncate">{ws.label}</span>
                          {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                    {clienteStatus && (
                      <>
                        <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                        <button
                          onClick={() =>
                            handleSetContactStatus(clienteStatus.id, close)
                          }
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                            isCliente
                              ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: clienteStatus.color }}
                          />
                          <span className="flex-1 truncate">Clientes</span>
                          {isCliente && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      </>
                    )}
                  </>
                )}
              </PopoverPanel>
            </Popover>
          </div>

          {/* Department — editable (pill colorida, mesmo estilo de status/tags) */}
          <div className="order-4 flex min-h-6 items-center gap-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
            <Popover className="relative flex items-center">
              {(() => {
                const deptColor = conversation.department
                  ? departments.find((d) => d.id === conversation.department?.id)
                      ?.color ?? '#71717a'
                  : null;
                return (
                  <PopoverButton
                    disabled={savingDept}
                    className={cn(
                      'inline-flex h-5 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium leading-none outline-none transition-opacity hover:opacity-80 disabled:opacity-50',
                      !conversation.department &&
                        'border-zinc-200 bg-zinc-50 italic text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500',
                    )}
                    style={
                      deptColor
                        ? {
                            backgroundColor: deptColor,
                            color: chipTextColor(deptColor),
                            borderColor: deptColor,
                          }
                        : undefined
                    }
                  >
                    {savingDept && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {conversation.department ? conversation.department.name : 'Sem departamento'}
                    <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                  </PopoverButton>
                );
              })()}
              <PopoverPanel
                anchor="bottom start"
                transition
                className="z-50 mt-1 w-52 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
              >
                {({ close }) => (
                  <>
                    {conversation.department && (
                      <button
                        onClick={() => handleSetDepartment(null, close)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Remover departamento
                      </button>
                    )}
                    {departments.map((dept) => {
                      const isActive = dept.id === conversation.department?.id;
                      return (
                        <button
                          key={dept.id}
                          onClick={() => handleSetDepartment(dept.id, close)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                            isActive
                              ? 'bg-primary/[0.06] font-medium text-primary dark:bg-primary/10'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: dept.color || '#a1a1aa' }}
                          />
                          <span className="flex-1 truncate">{dept.name}</span>
                          {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                    {departments.length === 0 && (
                      <p className="px-3 py-2 text-center text-[11px] text-zinc-400">
                        Nenhum departamento
                      </p>
                    )}
                  </>
                )}
              </PopoverPanel>
            </Popover>
          </div>

          {/* Tags — editable */}
          <div className="order-3 flex min-h-6 items-center gap-2.5">
            <TagIcon className="h-4 w-4 shrink-0 text-zinc-400" />
            <div className="flex flex-wrap items-center gap-1.5">
              {allTags.map(({ tag, onContact }) => (
                <span
                  key={tag.id}
                  title={onContact ? 'Tag do contato' : 'Tag desta conversa'}
                  style={{
                    backgroundColor: onContact ? tag.color : `${tag.color}18`,
                    color: onContact ? chipTextColor(tag.color) : tag.color,
                    borderColor: onContact ? 'transparent' : `${tag.color}55`,
                  }}
                  className={cn(
                    'inline-flex h-5 items-center rounded-full border px-2.5 text-[11px] font-medium leading-none',
                    onContact ? 'border-transparent' : 'border-dashed',
                  )}
                >
                  {tag.name}
                  <button
                    onClick={() => handleToggleTag(tag.id)}
                    disabled={pendingTagId === tag.id}
                    title="Remover tag"
                    className="-mr-0.5 ml-1 rounded-full opacity-50 transition-opacity hover:opacity-100"
                  >
                    {pendingTagId === tag.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <X className="h-2.5 w-2.5" />
                    )}
                  </button>
                </span>
              ))}
              {/* Add tag popover */}
              <Popover className="relative flex items-center">
                <PopoverButton className="inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 text-[11px] font-medium leading-none text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:hover:border-zinc-500">
                  <Plus className="h-2.5 w-2.5" />
                  Tag
                </PopoverButton>
                <PopoverPanel
                  anchor="bottom start"
                  transition
                  className="z-50 mt-1 w-48 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 [--anchor-gap:0.25rem]"
                >
                  {({ close }) => (
                    <div className="max-h-48 overflow-y-auto scrollbar-thin">
                      {allAvailableTags.length === 0 ? (
                        <p className="px-3 py-2 text-center text-[11px] text-zinc-400">
                          Nenhuma tag disponível
                        </p>
                      ) : (
                        allAvailableTags.map((tag) => {
                          const isOn = allTags.some((t) => t.tag.id === tag.id);
                          const isPending = pendingTagId === tag.id;
                          return (
                            <button
                              key={tag.id}
                              onClick={() => handleToggleTag(tag.id)}
                              disabled={isPending}
                              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="flex-1 truncate">{tag.name}</span>
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                              ) : isOn ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </PopoverPanel>
              </Popover>
            </div>
          </div>
        </div>

        {/* Ver mais toggle */}
        <button
          onClick={() => setShowMore((p) => !p)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')}
          />
          {showMore ? 'Ver menos' : 'Ver mais'}
        </button>

        {showMore && (
          <div className="mt-2 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Canal</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {conversation.channel.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Protocolo</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {conversation.protocol || '—'}
              </span>
            </div>
            {conversation.subject && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Assunto</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                  {conversation.subject}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Grupo</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {conversation.isGroup ? 'Sim' : 'Não'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Criado em</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {new Date(conversation.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Dados cadastrais (CPF/RG/endereço) + atalho pra ficha nos Contatos */}
      <ClientRegistrationSection
        contactId={contact.id}
        phone={contact.phone}
        name={contact.name}
      />

      {/* Processos do cliente — vínculo chat ↔ jurídico */}
      <ClientCasesSection contactId={contact.id} />

      {/* Criar tarefa na agenda direto daqui (opcionalmente ligada a um processo) */}
      <QuickTaskSection contactId={contact.id} conversationId={conversation.id} />

      {/* Notes */}
      {contact.notes && (
        <div className="mt-4 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="h-3.5 w-3.5 text-zinc-400" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Notas do contato</p>
          </div>
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 whitespace-pre-wrap">
            {contact.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Favorites tab ────────────────────────────────────────────────────────────

function FavoritesTab({ conversationId }: { conversationId: string }) {
  const [subTab, setSubTab] = useState<'favorites' | 'notes'>('favorites');
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-zinc-100 dark:border-zinc-800">
        {(['favorites', 'notes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              'flex-1 py-2.5 text-[13px] font-medium transition-colors',
              subTab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {t === 'favorites' ? 'Favoritos' : 'Notas'}
          </button>
        ))}
      </div>
      {subTab === 'favorites' ? (
        <FavoritesPanel conversationId={conversationId} />
      ) : (
        <NotesPanel conversationId={conversationId} />
      )}
    </div>
  );
}

// ─── Favoritos (mensagens favoritadas) ───────────────────────────────────────
function FavoritesPanel({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => inboxService.getMessages(conversationId, 1, 300),
    staleTime: 5_000,
  });
  const favorites = useMemo(
    () => (data?.messages ?? []).filter((m) => (m.metadata as Record<string, any>)?.favorited),
    [data],
  );

  const unfavorite = async (id: string) => {
    try {
      await inboxService.toggleFavorite(id);
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
    } catch {
      toast.error('Erro ao remover dos favoritos');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>;
  }
  if (favorites.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <Star className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
        <p className="mt-3 text-sm font-medium text-zinc-400 dark:text-zinc-500">Nenhuma mensagem favorita</p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          Clique com o botão direito numa mensagem → Favoritar
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
      {favorites.map((m) => {
        const text = (m.content as Record<string, any>)?.text ?? (m.content as Record<string, any>)?.caption ?? `[${m.type.toLowerCase()}]`;
        return (
          <div key={m.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 whitespace-pre-wrap text-[13px] text-zinc-700 dark:text-zinc-300">{text}</p>
              <button
                onClick={() => unfavorite(m.id)}
                title="Remover dos favoritos"
                className="shrink-0 text-amber-400 hover:text-amber-500"
              >
                <Star className="h-4 w-4 fill-current" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-400">
              {new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Notas da conversa (aba Notas + onde o resumo de IA é salvo) ───────────────
function NotesPanel({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', conversationId],
    queryFn: () => inboxService.getNotes(conversationId),
    staleTime: 15_000,
  });

  const addNote = async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      await inboxService.createNote(conversationId, content);
      setDraft('');
      qc.invalidateQueries({ queryKey: ['notes', conversationId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar nota');
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (id: string) => {
    setDeletingId(id);
    try {
      await inboxService.deleteNote(conversationId, id);
      qc.invalidateQueries({ queryKey: ['notes', conversationId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir nota');
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex h-full flex-col">
      {/* Compositor de nota */}
      <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
          }}
          rows={2}
          placeholder="Adicione uma nota sobre este contato…"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={!draft.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar nota
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <StickyNote className="h-9 w-9 text-zinc-200 dark:text-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-400 dark:text-zinc-500">Nenhuma nota</p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              Adicione notas ou gere um resumo da conversa — eles aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notes.map((n) => (
              <div
                key={n.id}
                className="group rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/40 dark:bg-amber-900/15"
              >
                <p className="whitespace-pre-wrap break-words text-[13px] text-zinc-700 dark:text-zinc-200">
                  {n.content}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
                  <span>
                    {n.authorName} · {fmt(n.createdAt)}
                  </span>
                  <button
                    onClick={() => removeNote(n.id)}
                    disabled={deletingId === n.id}
                    title="Excluir nota"
                    className="invisible rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 group-hover:visible disabled:opacity-50 dark:hover:bg-red-900/20"
                  >
                    {deletingId === n.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Media tab ────────────────────────────────────────────────────────────────

type MediaSubTab = 'images' | 'videos' | 'docs' | 'cloud';
const MEDIA_TYPE_MAP: Record<MediaSubTab, string[]> = {
  images: ['IMAGE', 'STICKER'],
  videos: ['VIDEO'],
  docs: ['DOCUMENT', 'AUDIO'],
  cloud: [],
};

function MediaTab({ conversationId }: { conversationId: string }) {
  const [subTab, setSubTab] = useState<MediaSubTab>('images');

  const { data, isLoading } = useQuery({
    queryKey: ['messages-all', conversationId],
    queryFn: () => inboxService.getMessages(conversationId, 1, 300),
    staleTime: 60_000,
  });

  const mediaMessages = useMemo(() => {
    if (!data?.messages) return [];
    const types = MEDIA_TYPE_MAP[subTab];
    if (types.length === 0) return [];
    return data.messages.filter((m) => types.includes(m.type));
  }, [data, subTab]);

  const byDate = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const m of mediaMessages) {
      const key = new Date(m.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].map(([date, messages]) => ({ date, messages }));
  }, [mediaMessages]);

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-100 px-1 dark:border-zinc-800">
        {(
          [
            ['images', 'Imagens'],
            ['videos', 'Vídeos'],
            ['docs', 'Docs'],
            ['cloud', 'Nuvem'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              'px-2.5 py-2.5 text-[12px] font-medium transition-colors',
              subTab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : subTab === 'cloud' ? (
          <EmptyState icon={Cloud} text="Nenhum arquivo na nuvem" />
        ) : byDate.length === 0 ? (
          <EmptyState
            icon={subTab === 'images' ? ImageIcon : subTab === 'videos' ? Film : File}
            text={`Nenhum${subTab === 'images' ? 'a imagem' : subTab === 'videos' ? ' vídeo' : ' documento'}`}
          />
        ) : (
          <div className="py-2">
            {byDate.map(({ date, messages }) => (
              <div key={date} className="mb-4">
                <div className="mb-2 text-center">
                  <span className="rounded-full bg-zinc-50 px-3 py-1 text-[11px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                    {date}
                  </span>
                </div>
                {subTab === 'images' ? (
                  <div className="grid grid-cols-3 gap-0.5 px-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="aspect-square overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
                      >
                        {m.content?.url ? (
                          <img
                            src={m.content.url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-zinc-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1 px-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2.5 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                      >
                        <File className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="flex-1 truncate text-[12px] text-zinc-700 dark:text-zinc-300">
                          {m.content?.filename ?? m.content?.caption ?? 'Arquivo'}
                        </span>
                        {m.content?.url && (
                          <a
                            href={m.content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-400 hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tarefas</span>
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <EmptyState
        icon={CheckSquare}
        text="Nenhuma tarefa vinculada a este chat."
        subText={
          <button className="mt-2 text-sm font-semibold text-primary hover:underline">
            Criar primeira tarefa
          </button>
        }
      />
    </div>
  );
}

// ─── Documents tab (ZapSign inline) ──────────────────────────────────────────

const ZSMAP: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending: { label: 'Pendente', icon: Clock, cls: 'text-amber-500' },
  signed: { label: 'Assinado', icon: CheckCircle2, cls: 'text-emerald-500' },
  refused: { label: 'Recusado', icon: XCircle, cls: 'text-red-500' },
  expired: { label: 'Expirado', icon: XCircle, cls: 'text-zinc-400' },
};

function DocCard({ doc }: { doc: ZapSignDocument }) {
  const [open, setOpen] = useState(false);
  const s = ZSMAP[doc.status] ?? ZSMAP.pending;
  const Icon = s.icon;
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
          {doc.name}
        </span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', s.cls)} title={s.label} />
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <p className="mb-1 text-[10px] text-zinc-400">
            {new Date(doc.createdAt).toLocaleDateString('pt-BR')} · {s.label}
          </p>
          {doc.signingUrl && (
            <a
              href={doc.signingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir link de assinatura
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ conversationId, contact }: { conversationId: string; contact: Conversation['contact'] }) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const { on } = useSocket();
  const [subTab, setSubTab] = useState<'send' | 'docs'>('send');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ZapSignTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [signerName, setSignerName] = useState('');
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Extração de verdade: lê a conversa inteira (texto + áudio transcrito +
  // imagens via visão) e preenche TODOS os campos do template de uma vez.
  const handleExtractAI = async () => {
    if (!selected) return;
    setExtracting(true);
    try {
      const res = await zapSignService.extractWithAI(conversationId, selected.token);
      setVars((prev) => ({ ...prev, ...res.variables }));
      if (res.signerName && !signerName) setSignerName(res.signerName);
      const total = Object.keys(res.variables).length;
      const filled = Object.values(res.variables).filter((v) => v && v.trim()).length;
      toast.success(`IA preencheu ${filled} de ${total} campo(s) a partir da conversa`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao extrair com IA');
    } finally {
      setExtracting(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const result = await zapSignService.syncTemplates();
      qc.invalidateQueries({ queryKey: ['zapsign-templates', orgId] });
      toast.success(`${result.synced} modelo${result.synced !== 1 ? 's' : ''} sincronizado${result.synced !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Erro ao sincronizar modelos ZapSign');
    } finally {
      setSyncing(false);
    }
  };

  const { data: status } = useQuery({
    queryKey: ['zapsign-status', orgId],
    queryFn: () => zapSignService.getStatus(),
  });
  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ['zapsign-templates', orgId],
    queryFn: () => zapSignService.getTemplates(),
    enabled: !!status?.connected,
  });
  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['zapsign-docs', conversationId],
    queryFn: () => zapSignService.getConversationDocuments(conversationId),
    refetchInterval: subTab === 'docs' ? 15_000 : false,
  });

  // Quando o cliente assina, a ZapSign chama nosso webhook, que emite
  // 'zapsign:doc-updated' na sala da conversa. Invalida a lista na hora pra o
  // contrato virar "assinado" sem precisar esperar o refetch de 15s nem F5.
  useEffect(() => {
    const unsub = on('zapsign:doc-updated', (payload: any) => {
      if (payload?.conversationId && payload.conversationId !== conversationId) {
        return;
      }
      qc.invalidateQueries({ queryKey: ['zapsign-docs', conversationId] });
    });
    return () => unsub();
  }, [on, qc, conversationId]);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectTemplate = (t: ZapSignTemplate) => {
    setSelected(t);
    const initial: Record<string, string> = {};
    (t.inputs as Array<{ variable: string }>).forEach((inp) => {
      initial[inp.variable] = '';
    });
    setVars(initial);
    setSignerName(contact.name ?? '');
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      // Nome do signatário sai dos próprios campos do ZapSign (NOME COMPLETO),
      // sem campo manual. Fallback: extração / nome do contato.
      const nomeKey = Object.keys(vars).find((k) => /nome\s*completo|^.*nome/i.test(k.replace(/[{}]/g, '')));
      const derivedSigner =
        (nomeKey && vars[nomeKey]?.trim()) || signerName || contact.name || undefined;
      const doc = await zapSignService.createDocument(conversationId, {
        templateToken: selected.token,
        variables: vars,
        signerName: derivedSigner,
      });
      qc.invalidateQueries({ queryKey: ['zapsign-docs', conversationId] });
      qc.invalidateQueries({ queryKey: ['notes', conversationId] });
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      setSelected(null);
      setSubTab('docs');
      if (doc.sentToClient) {
        toast.success('Contrato gerado, link salvo nas notas e enviado ao cliente ✅');
      } else {
        toast.success('Contrato gerado e link salvo nas notas.');
        if (doc.signingUrl) {
          await navigator.clipboard.writeText(doc.signingUrl).catch(() => undefined);
          toast.info('Link copiado para a área de transferência');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar documento');
    } finally {
      setSending(false);
    }
  };

  if (!status?.connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FileSignature className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
        <p className="text-sm text-zinc-500">ZapSign não configurado</p>
        <a href="/settings/integrations" className="text-xs text-primary hover:underline">
          Configurar em Integrações →
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-100 px-3 dark:border-zinc-800">
        {(['send', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              'mr-3 border-b-2 py-2.5 text-[12px] font-medium transition-colors',
              subTab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {t === 'send' ? 'Enviar documento' : `Enviados (${docs.length})`}
          </button>
        ))}
      </div>

      {subTab === 'send' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar modelo..."
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSyncTemplates}
                  disabled={syncing}
                  title="Sincronizar modelos ZapSign"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-400 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
                {tplLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-md border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                    />
                  ))
                ) : filtered.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-400">Nenhum modelo encontrado</p>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="w-full rounded-md border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-zinc-800"
                    >
                      <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                        {t.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {(t.inputs as unknown[]).length} variáveis
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  ← Voltar
                </button>
                <span className="flex-1 truncate text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                  {selected.name}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin">
                <button
                  type="button"
                  onClick={handleExtractAI}
                  disabled={extracting}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                >
                  {extracting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {extracting ? 'Lendo a conversa…' : 'Extrair com IA'}
                </button>
                <p className="text-center text-[10px] text-zinc-400">
                  Lê texto, áudios e imagens (RG/CPF) da conversa e preenche os campos. Confira antes de gerar.
                </p>
                {selected.inputs.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      Campos do documento ({selected.inputs.length})
                    </p>
                    {selected.inputs.map((inp) => {
                      const variable = inp.variable;
                      const display = (inp.label || variable).replace(/[{}]/g, '');
                      return (
                        <div key={variable}>
                          <label className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                            {display}
                            {inp.required && <span className="text-red-400">*</span>}
                          </label>
                          <input
                            value={vars[variable] ?? ''}
                            onChange={(e) =>
                              setVars((prev) => ({ ...prev, [variable]: e.target.value }))
                            }
                            placeholder={inp.help_text || display}
                            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                          {inp.help_text && (
                            <p className="mt-0.5 text-[10px] text-zinc-400">{inp.help_text}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    Este modelo não tem campos editáveis sincronizados. Clique no ↻ pra sincronizar.
                  </p>
                )}
              </div>
              <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Criando...' : 'Gerar Contrato'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
          {docsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-md border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <FileSignature className="h-8 w-8 text-zinc-200 dark:text-zinc-700" />
              <p className="mt-2 text-xs text-zinc-400">Nenhum documento enviado</p>
            </div>
          ) : (
            docs.map((doc) => <DocCard key={doc.id} doc={doc} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Logs tab (Agent Runs inline) ─────────────────────────────────────────────

function isToolFailure(tc: FeedRun['toolCalls'][number]) {
  return tc.error != null;
}

function ToolCallRow({ tc }: { tc: FeedRun['toolCalls'][number] }) {
  const failed = isToolFailure(tc);
  return (
    <div className={cn('flex items-start gap-1.5 py-1', failed && 'text-red-500')}>
      {failed ? (
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
      )}
      <span className="truncate text-[11px]">{tc.toolName}</span>
    </div>
  );
}

function RunCard({
  run,
  expanded,
  onToggle,
}: {
  run: FeedRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isRunning = run.status === 'RUNNING';
  const failed = run.status === 'FAILED' || run.hasFailedToolCalls === true;
  return (
    <div className="border-b border-zinc-100 dark:border-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
      >
        <span className="mt-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          )}
        </span>
        <span className="shrink-0">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          ) : failed ? (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
              {run.agent.name}
            </span>
            {isRunning && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-blue-500">
                rodando
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400">
            {new Date(run.startedAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {run.toolCalls.length} ferramenta{run.toolCalls.length !== 1 ? 's' : ''}
          </p>
        </div>
      </button>
      {expanded && run.toolCalls.length > 0 && (
        <div className="border-t border-zinc-50 px-9 pb-2 dark:border-zinc-900">
          {run.toolCalls.map((tc) => (
            <ToolCallRow key={tc.id} tc={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogsTab({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const queryKey = useMemo(
    () => ['agent-runs', conversationId] as const,
    [conversationId],
  );

  const { data: runs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => aiAgentsService.feed({ conversationId, period: 'all', limit: 30 }),
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (runs.length === 0) return;
    setExpandedIds((prev) => (prev.size > 0 ? prev : new Set([runs[0].id])));
  }, [runs]);

  useEffect(() => {
    const unsubStart = on('ai:run:start', (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      queryClient.setQueryData<FeedRun[]>(queryKey, (prev) => {
        const list = prev ?? [];
        if (list.some((r) => r.id === payload.runId)) return list;
        const fresh: FeedRun = {
          id: payload.runId,
          agentId: payload.agent?.id ?? '',
          conversationId,
          modelId: payload.modelId ?? '',
          status: 'RUNNING',
          finalAction: null,
          errorMessage: null,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: '0',
          durationMs: null,
          startedAt: payload.startedAt ?? new Date().toISOString(),
          finishedAt: null,
          agent: payload.agent ?? { id: '', name: 'Agent', kind: 'WORKER' },
          toolCalls: [],
          failedToolCalls: 0,
          hasFailedToolCalls: false,
        };
        return [fresh, ...list];
      });
      setExpandedIds((prev) => new Set([payload.runId, ...prev]));
    });

    const unsubTool = on('ai:run:tool-call', (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      queryClient.setQueryData<FeedRun[]>(queryKey, (prev) => {
        if (!prev) return prev;
        return prev.map((r) => {
          if (r.id !== payload.runId) return r;
          if (r.toolCalls.some((t) => t.id === payload.toolCall?.id)) return r;
          const tc: FeedRun['toolCalls'][number] = payload.toolCall;
          const failed = isToolFailure(tc);
          return {
            ...r,
            toolCalls: [...r.toolCalls, tc],
            failedToolCalls: (r.failedToolCalls ?? 0) + (failed ? 1 : 0),
            hasFailedToolCalls: r.hasFailedToolCalls || failed,
          };
        });
      });
    });

    const unsubEnd = on('ai:run:end', (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      queryClient.setQueryData<FeedRun[]>(queryKey, (prev) => {
        if (!prev) return prev;
        return prev.map((r) =>
          r.id === payload.runId
            ? {
                ...r,
                status: payload.status,
                finalAction: payload.finalAction ?? null,
                errorMessage: payload.errorMessage ?? null,
                finishedAt: payload.finishedAt ?? null,
                durationMs: payload.durationMs ?? r.durationMs,
                inputTokens: payload.inputTokens ?? r.inputTokens,
                outputTokens: payload.outputTokens ?? r.outputTokens,
              }
            : r,
        );
      });
    });

    return () => {
      unsubStart?.();
      unsubTool?.();
      unsubEnd?.();
    };
  }, [conversationId, on, queryClient, queryKey]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        text="Nenhum agente rodou nessa conversa ainda"
        subText={
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            Os logs vão aparecer aqui em tempo real assim que a IA executar.
          </p>
        }
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {runs.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          expanded={expandedIds.has(run.id)}
          onToggle={() => toggleExpanded(run.id)}
        />
      ))}
    </div>
  );
}

// ─── Shared empty state ───────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  text,
  subText,
}: {
  icon: React.ElementType;
  text: string;
  subText?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
      <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">{text}</p>
      {subText}
    </div>
  );
}

// ─── Panel tab definition ─────────────────────────────────────────────────────

type PanelTab = 'profile' | 'favorites' | 'media' | 'tasks' | 'documents' | 'scheduled' | 'logs';

const TABS: { id: PanelTab; icon: React.ElementType; label: string }[] = [
  { id: 'profile', icon: User, label: 'Perfil' },
  { id: 'favorites', icon: Star, label: 'Favoritos' },
  { id: 'media', icon: ImageIcon, label: 'Mídias' },
  { id: 'tasks', icon: CheckSquare, label: 'Tarefas' },
  { id: 'documents', icon: FileSignature, label: 'Documentos' },
  { id: 'scheduled', icon: Clock, label: 'Agendadas' },
  { id: 'logs', icon: Activity, label: 'Logs do agente' },
];

// ─── Aba "Agendadas" (Onda 4) ────────────────────────────────────────────────

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduledStatusBadge({ status }: { status: ScheduledMessage['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    SENT: { label: 'Enviada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
    CANCELED: { label: 'Cancelada', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
    FAILED: { label: 'Falhou', cls: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
    SENDING: { label: 'Enviando', cls: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400' },
    PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  };
  const s = map[status] ?? map.PENDING;
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}

function ScheduledTab({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages', conversationId],
    queryFn: () => scheduledMessagesService.list(conversationId),
    refetchInterval: 30_000,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const pending = items.filter((i) => i.status === 'PENDING');
  const history = items.filter((i) => i.status !== 'PENDING');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['scheduled-messages', conversationId] });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const startEdit = (m: ScheduledMessage) => {
    setEditingId(m.id);
    setEditText(m.content?.text ?? '');
    setEditWhen(toLocalInput(m.scheduledAt));
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim() || !editWhen) return;
    setBusy(id);
    try {
      await scheduledMessagesService.update(id, {
        text: editText.trim(),
        scheduledAt: new Date(editWhen).toISOString(),
      });
      toast.success('Agendamento atualizado');
      setEditingId(null);
      invalidate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await scheduledMessagesService.cancel(id);
      toast.success('Agendamento cancelado');
      invalidate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao cancelar');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <Clock className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-2 text-[13px] font-medium text-zinc-400">Nenhuma mensagem agendada</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">Use o relógio no compositor para agendar um envio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Próximas ({pending.length})</p>
          {pending.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              {editingId === m.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    type="datetime-local"
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:[color-scheme:dark]"
                  />
                  <ScheduledAnexos anexos={m.anexos} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(m.id)}
                      disabled={busy === m.id}
                      className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded-md px-2.5 py-1 text-[12px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <Clock className="h-3 w-3" /> {fmt(m.scheduledAt)}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{m.content?.text}</p>
                  <ScheduledAnexos anexos={m.anexos} />
                  <div className="mt-1.5 flex gap-3">
                    <button onClick={() => startEdit(m)} className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                      Editar
                    </button>
                    <button
                      onClick={() => cancel(m.id)}
                      disabled={busy === m.id}
                      className="text-[11px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Histórico</p>
          {history.map((m) => (
            <div key={m.id} className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400">{fmt(m.scheduledAt)}</span>
                <ScheduledStatusBadge status={m.status} />
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-500 dark:text-zinc-400">{m.content?.text}</p>
              <ScheduledAnexos anexos={m.anexos} />
              {m.error && <p className="mt-1 text-[11px] text-red-500">{m.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ContactDetailsPanel({
  conversation,
  onCloseMobile,
}: {
  conversation: Conversation;
  /** Celular: fecha o painel de detalhes (overlay) e volta pro chat. */
  onCloseMobile?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<PanelTab>('profile');

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-l border-zinc-200 bg-white lg:w-80 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Tab bar — same height as the conversation header so the icons line up
          on the same horizontal row (LíderHub style) */}
      <div className="flex h-[67px] items-center border-b border-zinc-200 dark:border-zinc-800">
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar detalhes"
            title="Fechar"
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {TABS.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex h-full flex-1 items-center justify-center border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'profile' && <ProfileTab conversation={conversation} />}
        {activeTab === 'favorites' && <FavoritesTab conversationId={conversation.id} />}
        {activeTab === 'media' && <MediaTab conversationId={conversation.id} />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'documents' && (
          <DocumentsTab conversationId={conversation.id} contact={conversation.contact} />
        )}
        {activeTab === 'scheduled' && <ScheduledTab conversationId={conversation.id} />}
        {activeTab === 'logs' && <LogsTab conversationId={conversation.id} />}
      </div>
    </div>
  );
}
