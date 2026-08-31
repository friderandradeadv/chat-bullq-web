'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  MoreVertical,
  Plus,
  MessageSquare,
  CheckSquare,
  Square,
  FileText,
  Clock,
  Users,
  Rss,
  Trash2,
  Tag,
  Check,
  X,
  Pencil,
  Archive,
  FilePlus2,
  Link2Off,
  Paperclip,
  CalendarClock,
  AlertTriangle,
  Gavel,
  Columns3,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { titleCaseName } from '@/lib/names';
import {
  legalCasesService,
  type ApensoRef,
  type CaseDetail,
  type PartyRole,
} from '@/features/legal-cases/services/legal-cases.service';
import { activitiesService } from '@/features/activities/services/activities.service';
import { ClientCombobox } from '@/features/legal-cases/components/client-combobox';
import { OpponentCombobox } from '@/features/legal-cases/components/opponent-combobox';
import {
  deadlinesService,
  type Deadline,
} from '@/features/deadlines/services/deadlines.service';
import { tasksService, type Task } from '@/features/tasks/services/tasks.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import {
  recursosService,
  type Recurso,
  type JulgamentoRecurso,
  JULGAMENTO_LABEL,
  PARTE_RECORRENTE_LABEL,
} from '@/features/recursos/services/recursos.service';
import { inputCls, Field, ASTREA_BLUE, LegalTagChip, CnjNumber } from '../page';

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
// Badge de status: encerrado/arquivado = "Baixado" (mesma linguagem da aba Processos).
const statusBadgeLabel = (s: string) => (s === 'CLOSED' || s === 'ARCHIVED' ? 'Baixado' : STATUS_LABEL[s] ?? s);
// Datas só-data (distribuição, prazos, andamentos) são gravadas em UTC meia-noite
// → formatar em UTC pra não exibir o dia anterior em fusos negativos (BRT). Datas
// legais precisam bater com o que está no banco. Eventos (com hora real) usam local.
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
const fmtDateLong = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        timeZone: 'UTC',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const fmtMoney = (v?: string | null) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Instância (1º/2º grau): preferência ao valor mantido pelo DJEN (instanciaAtual),
// caindo no que veio do import do Astrea ('Instância Atual' do raw). O Astrea
// grava só o número ("1"/"2"/"3") → normaliza pra "Nº Grau".
const labelInstancia = (v?: string | null): string | null => {
  if (!v) return null;
  const m = String(v).match(/(\d)/);
  return m ? `${m[1]}º Grau` : String(v);
};
const getInstancia = (c: CaseDetail): string | null => {
  const a = (c.metadata as { astrea?: { instanciaAtual?: string; raw?: Record<string, string> } } | null)?.astrea;
  return labelInstancia(a?.instanciaAtual ?? a?.raw?.['Instância Atual']);
};

/**
 * Polo do CLIENTE na execução — o eixo do toggle "Exequente × Executado" do quadro
 * Execução & Repasse. Espelha `poloExecucao` da API: a escolha do advogado
 * (metadata.poloExecucao) manda sobre o "Papel do cliente" importado do Astrea.
 * Papel RECURSAL (Agravado/Recorrido/Apelado) NÃO é polo passivo — o cliente é
 * agravado porque o banco recorreu da vitória DELE.
 */
const PAPEL_EXECUTADO = /^(r[eé]u|requerid[oa]|executad[oa]|reclamad[oa]|embargad[oa]|impugnad[oa]|denunciad[oa]|suscitad[oa])$/i;
/**
 * Tipo do título: execução é PROCESSO autônomo (título extrajudicial,
 * honorários, monitória — CPC 771 e ss.); cumprimento de sentença é FASE do
 * processo que já existe (CPC 513-538). Espelha `tipoExecucao` da API: a escolha
 * do advogado manda sobre a dedução pela classe — que não acerta quando a classe
 * não nomeia o rito (ex.: "Dativo" numa execução de título extrajudicial).
 */
const CLASSE_EXECUCAO = /(execu[çc][ãa]o\s+(de\s+)?(t[ií]tulo|honor[áa]rio|fiscal|extrajudicial)|t[ií]tulo\s+extrajudicial|monit[óo]ria)/i;
const getTipo = (c: CaseDetail): 'cumprimento' | 'execucao' => {
  const m = (c.metadata as { tipoExecucao?: string; astrea?: { raw?: Record<string, string> } } | null) ?? {};
  if (m.tipoExecucao === 'execucao' || m.tipoExecucao === 'cumprimento') return m.tipoExecucao;
  const classe = (m.astrea?.raw?.['Ação'] ?? c.area ?? '').trim();
  return CLASSE_EXECUCAO.test(classe) ? 'execucao' : 'cumprimento';
};

const getPolo = (c: CaseDetail): 'exequente' | 'executado' => {
  const m = (c.metadata as { poloExecucao?: string; astrea?: { raw?: Record<string, string> } } | null) ?? {};
  if (m.poloExecucao === 'executado' || m.poloExecucao === 'exequente') return m.poloExecucao;
  return PAPEL_EXECUTADO.test((m.astrea?.raw?.['Papel do cliente'] ?? '').trim()) ? 'executado' : 'exequente';
};

// Raia do card no kanban: fases pré-judiciais vivem no quadro Pré-Processual;
// o resto no quadro Fase Judicial. Ambos abrem a ficha via ?case=<id>.
const PRE_PHASES = new Set(['novos_clientes', 'reuniao_agendada', 'info_faltantes', 'montar_inicial', 'revisao_inicial', 'para_correcao', 'revisao_final', 'protocolo', 'inss_admin']);
const kanbanHref = (c: CaseDetail): string => {
  const base = c.legalPhase?.startsWith('repb_')
    ? '/juridico/repb'
    : c.legalPhase?.startsWith('plan_')
      ? '/juridico/planejamento'
      : c.legalPhase?.startsWith('banco_')
        ? '/juridico/fase-bancaria'
        : c.legalPhase && PRE_PHASES.has(c.legalPhase) ? '/juridico/pre-processual' : '/juridico/kanban';
  return `${base}?case=${c.id}`;
};

type Tab = 'resumo' | 'atividades' | 'recursos' | 'historico';

export default function ProcessoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;
  const [tab, setTab] = useState<Tab>('resumo');
  const [editing, setEditing] = useState(false);
  const [addingHistory, setAddingHistory] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['legal-case', id],
    queryFn: () => legalCasesService.get(id!),
    enabled: !!id,
  });
  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['legal-case', id] });
    qc.invalidateQueries({ queryKey: ['legal-cases'] });
    qc.invalidateQueries({ queryKey: ['case-deadlines', id] });
  };

  if (!id) return null;
  if (isLoading)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Carregando…</div>;
  if (!c)
    return <div className="bg-white p-6 text-sm text-zinc-400 dark:bg-zinc-950">Processo não encontrado.</div>;

  const clientParty = c.parties.find((p) => p.role === 'CLIENT');
  const monitorado = !!c.cnjNumber;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {/* Cabeçalho */}
      <div className="px-4 pt-3 lg:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-medium text-[#202124] dark:text-zinc-100">{c.title}</h1>
            {/* Veio do DJEN sem partes identificáveis (nota administrativa / Projudi) → cadastro pendente.
                Só enquanto SEGUIR sem partes: assim que ganha cliente/réu (manual ou herdado do apenso),
                o badge some — antes ele ficava eterno porque a flag nunca era limpa. */}
            {(c.metadata as { djen?: { revisarCadastro?: boolean } } | null)?.djen?.revisarCadastro && c.parties.length === 0 && (
              <button
                onClick={() => setEditing(true)}
                title="Este processo entrou pelo DJEN sem partes identificáveis — clique para cadastrar cliente/réu, comarca etc."
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                ⚠️ Cadastro pendente — clique para completar
              </button>
            )}
            {/* Etiquetas com ✕ */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {c.legalTags.map((lt) => (
                <LegalTagChip
                  key={lt.id}
                  label={lt.tag.name}
                  color={lt.tag.color}
                  onRemove={async () => {
                    try {
                      await activitiesService.detachTag(lt.id);
                      refetch();
                    } catch (e: any) {
                      toast.error(e?.message || 'Erro');
                    }
                  }}
                />
              ))}
              {c.legalTags.length === 0 && (
                <span className="text-xs text-zinc-400">Sem etiquetas</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconBtn title="Voltar" onClick={() => router.push('/processos')}>
              <ArrowLeft className="h-4 w-4" />
            </IconBtn>
            <Link
              href={kanbanHref(c)}
              title="Abrir este processo no Kanban"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DEE2E6] px-2.5 py-1.5 text-sm font-medium text-[#495057] hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Columns3 className="h-4 w-4" /> Kanban
            </Link>
            <IconBtn title="Favoritar">
              <Star className="h-4 w-4" />
            </IconBtn>
            <HeaderTagPicker caseId={id} attached={c.legalTags} onChange={refetch} />
            <OptionsMenu
              c={c}
              onEdit={() => setEditing(true)}
              onAddHistory={() => setAddingHistory(true)}
              onChange={refetch}
            />
            <AddMenu
              onAddHistory={() => setAddingHistory(true)}
              onAddActivity={() => setTab('atividades')}
            />
          </div>
        </div>

        {/* Metadados */}
        <dl className="mt-4 space-y-1 text-sm">
          <MetaRow label="Processo">
            {c.cnjNumber ? <CnjNumber value={c.cnjNumber} /> : '—'}
          </MetaRow>
          {c.parent && (
            <MetaRow label="Apensado a">
              <Link
                href={`/processos/${c.parent.id}`}
                className="inline-flex items-center gap-1.5 font-medium text-[#202124] hover:text-[#228BE6] hover:underline dark:text-zinc-100"
              >
                <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
                {c.parent.cnjNumber || c.parent.title}
              </Link>
            </MetaRow>
          )}
          <MetaRow label="Cliente">
            {clientParty ? (
              <Link
                href={`/clientes/${clientParty.id}`}
                className="font-medium text-[#202124] hover:text-[#228BE6] hover:underline dark:text-zinc-100"
              >
                {titleCaseName(clientParty.name)}
              </Link>
            ) : (
              '—'
            )}
          </MetaRow>
          <MetaRow label="Status">
            <span className="inline-flex items-center gap-2">
              <span className="text-[#202124] dark:text-zinc-100">
                {statusBadgeLabel(c.status)}
                {getInstancia(c) ? ` · ${getInstancia(c)}` : ''}
              </span>
              <DjenBadge monitorado={monitorado} />
            </span>
          </MetaRow>
          <MetaRow label="Responsável">
            <ResponsibleEditor caseId={id} current={c.responsible} onChange={refetch} />
          </MetaRow>
        </dl>

        {/* Abas */}
        <div className="mt-5 flex overflow-x-auto border-b border-[#DEE2E6] dark:border-zinc-800">
          {([
            ['resumo', 'Resumo'],
            ['atividades', 'Atividades'],
            ['recursos', 'Recursos'],
            ['historico', 'Histórico'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-4 px-6 py-3 text-base font-medium transition-colors ${
                tab === key
                  ? 'border-[#228BE6] text-[#202124] dark:text-zinc-100'
                  : 'border-transparent text-[#6C757D] hover:text-[#202124] dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 px-4 py-5 lg:px-6">
        {tab === 'resumo' && <ResumoTab c={c} />}
        {tab === 'atividades' && <AtividadesTab caseId={id} events={c.events} onChange={refetch} />}
        {tab === 'recursos' && <RecursosTab caseId={id} />}
        {tab === 'historico' && (
          <HistoricoTab caseId={id} movements={c.movements} events={c.events} onAdd={() => setAddingHistory(true)} />
        )}
      </div>

      {editing && <EditCaseDialog c={c} onClose={() => setEditing(false)} onSaved={refetch} />}
      {addingHistory && (
        <ManualHistoryModal caseId={id} onClose={() => setAddingHistory(false)} onSaved={refetch} />
      )}
    </div>
  );
}

// ─── Indicador de conexão DJEN (barrinha verde) ──────────────────────

function DjenBadge({ monitorado }: { monitorado: boolean }) {
  return (
    <span
      title={
        monitorado
          ? 'Conectado ao tribunal — captando publicações via DJEN'
          : 'Sem número CNJ — não conectado ao tribunal'
      }
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        monitorado
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
      }`}
    >
      <Rss className="h-3 w-3" />
      {monitorado ? 'Conectado' : 'Sem conexão'}
    </span>
  );
}

// ─── Picker de etiquetas (🏷️ do header) ──────────────────────────────

function HeaderTagPicker({
  caseId,
  attached,
  onChange,
}: {
  caseId: string;
  attached: { tagId: string }[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: tags = [] } = useQuery({
    queryKey: ['tags-available'],
    queryFn: () => activitiesService.listAvailableTags(),
  });
  const attachedIds = new Set(attached.map((a) => a.tagId));

  const toggle = async (tagId: string) => {
    setBusy(true);
    try {
      if (attachedIds.has(tagId)) {
        const list = await activitiesService.listTags('case', caseId);
        const et = list.find((x) => x.tagId === tagId);
        if (et) await activitiesService.detachTag(et.id);
      } else {
        await activitiesService.attachTag('case', caseId, tagId);
      }
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <IconBtn title="Etiquetas" onClick={() => setOpen((v) => !v)} active={open}>
        <Tag className="h-4 w-4" />
      </IconBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 max-h-80 w-64 overflow-y-auto rounded-lg border border-[#DEE2E6] bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
              Etiquetas
            </p>
            {tags.map((t) => {
              const on = attachedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{t.name}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-[#228BE6]" />}
                </button>
              );
            })}
            {tags.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma etiqueta.</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Menu de opções ⋮ ────────────────────────────────────────────────

function OptionsMenu({
  c,
  onEdit,
  onAddHistory,
  onChange,
}: {
  c: CaseDetail;
  onEdit: () => void;
  onAddHistory: () => void;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'encerrar' | 'desvincular' | 'desapensar'>(null);
  // 'other-to-this' = escolher um processo pra apensar A ESTE;
  // 'this-to-other' = escolher o principal ao qual ESTE será apensado.
  const [apensar, setApensar] = useState<null | 'other-to-this' | 'this-to-other'>(null);

  const close = () => setOpen(false);

  const doEncerrar = async () => {
    try {
      await legalCasesService.update(c.id, { status: 'CLOSED' });
      toast.success('Processo encerrado');
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setConfirm(null);
    }
  };
  const doDesvincular = async () => {
    try {
      await legalCasesService.update(c.id, { cnjNumber: '' });
      toast.success('Processo desvinculado do tribunal');
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setConfirm(null);
    }
  };
  const doDesapensar = async () => {
    try {
      await legalCasesService.apensar(c.id, null);
      toast.success('Processo desapensado');
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="relative">
      <IconBtn title="Mais opções" onClick={() => setOpen((v) => !v)} active={open}>
        <MoreVertical className="h-4 w-4" />
      </IconBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <MenuItem
              icon={Paperclip}
              onClick={() => {
                close();
                setApensar('other-to-this');
              }}
            >
              Apensar outro processo a este
            </MenuItem>
            <MenuItem
              icon={Paperclip}
              onClick={() => {
                close();
                setApensar('this-to-other');
              }}
              disabled={!!c.parent}
            >
              Apensar este processo a outro
            </MenuItem>
            {c.parent && (
              <MenuItem
                icon={Paperclip}
                onClick={async () => {
                  close();
                  try {
                    // reapensar ao mesmo principal = backend só herda o que falta
                    await legalCasesService.apensar(c.id, c.parent!.id);
                    toast.success('Dados herdados do principal (título, etiquetas, partes…)');
                    onChange();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || e?.message || 'Erro');
                  }
                }}
              >
                Herdar dados do principal
              </MenuItem>
            )}
            {c.parent && (
              <MenuItem
                icon={Link2Off}
                onClick={() => {
                  close();
                  setConfirm('desapensar');
                }}
              >
                Desapensar do principal
              </MenuItem>
            )}
            <MenuItem
              icon={Link2Off}
              onClick={() => {
                close();
                setConfirm('desvincular');
              }}
              disabled={!c.cnjNumber}
            >
              Desvincular do tribunal
            </MenuItem>
            <Divider />
            <MenuItem
              icon={Pencil}
              onClick={() => {
                close();
                onEdit();
              }}
            >
              Editar
            </MenuItem>
            <MenuItem
              icon={FilePlus2}
              onClick={() => {
                close();
                onAddHistory();
              }}
            >
              Adicionar histórico manual
            </MenuItem>
            <MenuItem
              icon={Archive}
              danger
              onClick={() => {
                close();
                setConfirm('encerrar');
              }}
              disabled={c.status === 'CLOSED'}
            >
              Encerrar
            </MenuItem>
          </div>
        </>
      )}

      {confirm === 'encerrar' && (
        <ConfirmDialog
          title="Encerrar processo?"
          message="O processo passará para o status Encerrado. Você pode reabri-lo depois pela edição."
          confirmLabel="Encerrar"
          danger
          onConfirm={doEncerrar}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'desvincular' && (
        <ConfirmDialog
          title="Desvincular do tribunal?"
          message="O número CNJ será removido e o processo deixará de ser monitorado no DJEN. O histórico é preservado."
          confirmLabel="Desvincular"
          danger
          onConfirm={doDesvincular}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'desapensar' && (
        <ConfirmDialog
          title="Desapensar do principal?"
          message={`Este processo deixará de correr apensado a ${c.parent?.cnjNumber || c.parent?.title || 'outro processo'}. O histórico é preservado nos dois.`}
          confirmLabel="Desapensar"
          onConfirm={doDesapensar}
          onClose={() => setConfirm(null)}
        />
      )}
      {apensar && (
        <ApensarModal
          c={c}
          direction={apensar}
          onClose={() => setApensar(null)}
          onDone={() => {
            setApensar(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

// ─── Apensar: busca e vincula processo (principal ⇄ apenso) ──────────

function ApensarModal({
  c,
  direction,
  onClose,
  onDone,
}: {
  c: CaseDetail;
  direction: 'other-to-this' | 'this-to-other';
  onClose: () => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; title: string; cnjNumber: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['apensar-search', search],
    queryFn: () => legalCasesService.list({ search }),
    enabled: search.trim().length >= 2,
  });
  // Fora da lista: o próprio processo, os já apensados a ele e o principal atual.
  const excluded = new Set<string>([c.id, ...(c.apensos ?? []).map((a) => a.id), ...(c.parent ? [c.parent.id] : [])]);
  const options = results.filter((r) => !excluded.has(r.id)).slice(0, 12);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (direction === 'other-to-this') {
        await legalCasesService.apensar(selected.id, c.id);
      } else {
        await legalCasesService.apensar(c.id, selected.id);
      }
      toast.success(
        direction === 'other-to-this'
          ? `${selected.cnjNumber || selected.title} apensado a este processo`
          : `Processo apensado a ${selected.cnjNumber || selected.title}`,
      );
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao apensar');
      setSaving(false);
    }
  };

  return (
    <Modal
      title={direction === 'other-to-this' ? 'Apensar outro processo a este' : 'Apensar este processo a outro'}
      onClose={onClose}
    >
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {direction === 'other-to-this'
          ? 'Busque o processo (ex.: um agravo de instrumento) que passará a correr apensado a este.'
          : 'Busque o processo PRINCIPAL ao qual este passará a correr apensado (ex.: a ação principal do agravo).'}
      </p>
      <input
        autoFocus
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelected(null);
        }}
        placeholder="Buscar por título, nº CNJ ou código interno…"
        className={inputCls}
      />
      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {search.trim().length < 2 ? (
          <p className="px-1 py-2 text-xs text-zinc-400">Digite ao menos 2 caracteres para buscar.</p>
        ) : isFetching ? (
          <p className="px-1 py-2 text-xs text-zinc-400">Buscando…</p>
        ) : options.length === 0 ? (
          <p className="px-1 py-2 text-xs text-zinc-400">Nenhum processo encontrado.</p>
        ) : (
          options.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected({ id: r.id, title: r.title, cnjNumber: r.cnjNumber })}
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                selected?.id === r.id
                  ? 'border-[#228BE6] bg-blue-50 dark:bg-blue-500/10'
                  : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {r.title}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                {r.cnjNumber && <span>{r.cnjNumber}</span>}
                {r.area && <span>· {r.area}</span>}
                {r.legalTags?.map((lt) => (
                  <LegalTagChip key={lt.id} label={lt.tag.name} color={lt.tag.color} />
                ))}
              </span>
            </button>
          ))
        )}
      </div>
      <ModalActions
        saving={saving}
        onClose={onClose}
        onSave={save}
        saveLabel={selected ? 'Apensar' : 'Selecione um processo'}
      />
    </Modal>
  );
}

// ─── Menu + (adicionar, azul) ────────────────────────────────────────

function AddMenu({
  onAddHistory,
  onAddActivity,
}: {
  onAddHistory: () => void;
  onAddActivity: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Adicionar"
        className="flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm"
        style={{ backgroundColor: ASTREA_BLUE }}
      >
        <Plus className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-lg border border-[#DEE2E6] bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <MenuItem
              icon={CalendarClock}
              onClick={() => {
                close();
                onAddActivity();
              }}
            >
              Atividade / prazo
            </MenuItem>
            <MenuItem
              icon={FilePlus2}
              onClick={() => {
                close();
                onAddHistory();
              }}
            >
              Histórico manual
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
  muted,
  disabled,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : muted
            ? 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-[#DEE2E6] dark:border-zinc-800" />;
}

// ─── Aba: Resumo ─────────────────────────────────────────────────────

function ResumoTab({ c }: { c: CaseDetail }) {
  const clientParty = c.parties.find((p) => p.role === 'CLIENT');
  const clientConv = clientParty?.contact?.conversations?.[0];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Esquerda */}
      <div className="space-y-5 lg:col-span-2">
        <Card title="Dados do Processo" icon={FileText}>
          <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <DefRow label="Ação" value={c.area ?? '—'} />
            <DefRow label="Número" value={c.cnjNumber ? <CnjNumber value={c.cnjNumber} /> : '—'} />
            <DefRow label="Juízo" value={c.court ?? '—'} />
            <DefRow label="Comarca / Foro" value={c.jurisdiction ?? '—'} />
            <DefRow label="Valor da causa" value={fmtMoney(c.value)} />
            <DefRow label="Distribuído em" value={fmtDate(c.distributedAt)} />
            <DefRow label="Criado em" value={fmtDate(c.createdAt)} />
          </dl>
        </Card>

        {(c.parent || (c.apensos?.length ?? 0) > 0) && <ApensosCard c={c} />}

        <PartiesCard caseId={c.id} parties={c.parties} />
      </div>

      {/* Direita */}
      <div className="space-y-5">
        <Card title="Cliente / Conversa" icon={MessageSquare}>
          {clientParty?.contact ? (
            <div className="space-y-2">
              <Link
                href={`/clientes/${clientParty.id}`}
                className="text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline dark:text-zinc-100"
              >
                {titleCaseName(clientParty.contact.name ?? clientParty.name)}
              </Link>
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
          ) : clientParty ? (
            <Link
              href={`/clientes/${clientParty.id}`}
              className="text-sm font-medium text-zinc-800 hover:text-[#228BE6] hover:underline dark:text-zinc-100"
            >
              {titleCaseName(clientParty.name)}
            </Link>
          ) : (
            <EmptyState>Nenhum cliente vinculado.</EmptyState>
          )}
        </Card>

        <Card title="Próximas atividades" icon={CheckSquare}>
          {c.events.length === 0 ? (
            <EmptyState>Este processo não possui atividades pendentes.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {c.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">{e.title}</span>
                  <span className="block text-xs text-zinc-400">
                    {e.kind} ·{' '}
                    {new Date(e.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
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
              {c.deadlines.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-200">{d.title}</span>
                  <span
                    className={`text-xs font-medium ${
                      d.type === 'FATAL' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'
                    }`}
                  >
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

// ─── Card: Apensos (relação entre processos) ─────────────────────────

function ApensoRow({ p, principal }: { p: ApensoRef; principal?: boolean }) {
  return (
    <li>
      <Link
        href={`/processos/${p.id}`}
        className="group block rounded-md border border-zinc-100 px-3 py-2 hover:border-[#228BE6]/40 hover:bg-blue-50/50 dark:border-zinc-800 dark:hover:bg-blue-500/5"
      >
        <span className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 group-hover:text-[#228BE6] dark:text-zinc-100">
            {p.title}
          </span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {principal ? 'Principal' : 'Apenso'}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 pl-[22px] text-xs text-zinc-400">
          {p.cnjNumber && <span>{p.cnjNumber}</span>}
          {p.area && <span>· {p.area}</span>}
          <span>· {STATUS_LABEL[p.status] ?? p.status}</span>
          {p.legalTags.map((lt) => (
            <LegalTagChip key={lt.id} label={lt.tag.name} color={lt.tag.color} />
          ))}
        </span>
      </Link>
    </li>
  );
}

function ApensosCard({ c }: { c: CaseDetail }) {
  return (
    <Card title="Processos relacionados (apensos)" icon={Paperclip}>
      <ul className="space-y-2">
        {c.parent && <ApensoRow p={c.parent} principal />}
        {c.apensos.map((a) => (
          <ApensoRow key={a.id} p={a} />
        ))}
      </ul>
    </Card>
  );
}

// ─── Aba: Atividades ─────────────────────────────────────────────────

function AtividadesTab({
  caseId,
  events,
  onChange,
}: {
  caseId: string;
  events: CaseDetail['events'];
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ['case-deadlines', caseId],
    queryFn: () => deadlinesService.list({ caseId }),
  });

  const open = deadlines.filter((d) => d.status === 'OPEN');
  const done = deadlines.filter((d) => d.status !== 'OPEN');
  const shown = showDone ? done : open;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case-deadlines', caseId] });
    onChange();
  };

  const complete = async (d: Deadline) => {
    if (d.type === 'FATAL' && !window.confirm(`Concluir o prazo FATAL "${d.title}"?`)) return;
    try {
      await deadlinesService.complete(d.id, d.type === 'FATAL');
      toast.success('Prazo concluído');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  return (
    <div className="space-y-5">
      <TarefasCard caseId={caseId} onChange={onChange} />

      <Card
        title="Prazos"
        icon={Clock}
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: ASTREA_BLUE }}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar prazo
          </button>
        }
      >
        {/* Filtro aberta / concluída */}
        <div className="mb-4 flex items-center gap-4 text-sm">
          <button
            onClick={() => setShowDone(false)}
            className={`font-medium ${!showDone ? 'text-[#228BE6]' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            {open.length} aberta{open.length === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => setShowDone(true)}
            className={`font-medium ${showDone ? 'text-[#228BE6]' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            {done.length} concluída{done.length === 1 ? '' : 's'}
          </button>
        </div>

        {adding && (
          <AddDeadlineInline caseId={caseId} onClose={() => setAdding(false)} onCreated={refresh} />
        )}

        {isLoading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState>
            {showDone ? 'Nenhuma atividade concluída.' : 'Não há atividades em aberto neste processo.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map((d) => {
              const isDone = d.status !== 'OPEN';
              return (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => !isDone && complete(d)}
                    disabled={isDone}
                    title={isDone ? 'Concluída' : 'Concluir'}
                    className="shrink-0 text-zinc-400 hover:text-emerald-500 disabled:text-emerald-500"
                  >
                    {isDone ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Prazo
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isDone ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {d.title}
                      {d.type === 'FATAL' && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                          FATAL
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Fatal {fmtDateLong(d.dueDate)} · segurança {fmtDate(d.safeDate)}
                    </p>
                  </div>
                  {d.assignedTo && (
                    <span className="hidden shrink-0 text-xs text-zinc-400 sm:block">{d.assignedTo.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {events.length > 0 && (
        <Card title="Eventos e audiências" icon={CalendarClock}>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-zinc-800 dark:text-zinc-200">{e.title}</p>
                  <p className="text-xs text-zinc-400">
                    {e.kind}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(e.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ─── Tarefas do processo (DJEN + manuais) ────────────────────────────

function TarefasCard({ caseId, onChange }: { caseId: string; onChange: () => void }) {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['case-tasks', caseId],
    queryFn: () => tasksService.list({ caseId }),
  });
  const open = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');
  const shown = showDone ? done : open;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case-tasks', caseId] });
    onChange();
  };

  return (
    <Card title="Tarefas" icon={CheckSquare}>
      <div className="mb-4 flex items-center gap-4 text-sm">
        <button
          onClick={() => setShowDone(false)}
          className={`font-medium ${!showDone ? 'text-[#228BE6]' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          {open.length} aberta{open.length === 1 ? '' : 's'}
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={`font-medium ${showDone ? 'text-[#228BE6]' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          {done.length} concluída{done.length === 1 ? '' : 's'}
        </button>
      </div>
      {isLoading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{showDone ? 'Nenhuma tarefa concluída.' : 'Nenhuma tarefa pendente.'}</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {shown.map((t) => (
            <TaskRow key={t.id} t={t} onChange={refresh} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TaskRow({ t, onChange }: { t: Task; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [busy, setBusy] = useState(false);
  const isDone = t.status === 'DONE';

  const complete = async () => {
    try {
      await tasksService.update(t.id, { status: 'DONE' });
      toast.success('Tarefa concluída');
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };
  const rename = async () => {
    const v = title.trim();
    if (!v || v === t.title) { setEditing(false); setTitle(t.title); return; }
    setBusy(true);
    try {
      await tasksService.update(t.id, { title: v });
      toast.success('Tarefa renomeada');
      setEditing(false);
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <button
          onClick={() => !isDone && complete()}
          disabled={isDone}
          title={isDone ? 'Concluída' : 'Concluir'}
          className="mt-0.5 shrink-0 text-zinc-400 hover:text-emerald-500 disabled:text-emerald-500"
        >
          {isDone ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename();
                  if (e.key === 'Escape') { setEditing(false); setTitle(t.title); }
                }}
                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button onClick={rename} disabled={busy} className="text-xs font-medium text-[#228BE6]">Salvar</button>
              <button onClick={() => { setEditing(false); setTitle(t.title); }} className="text-xs text-zinc-400">Cancelar</button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <p className={`text-sm font-medium ${isDone ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>
                {t.title}
              </p>
              {t.priority === 'HIGH' && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  Alta
                </span>
              )}
              <button
                onClick={() => { setEditing(true); setTitle(t.title); }}
                title="Renomear tarefa"
                className="opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100 text-zinc-300"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="mt-0.5 text-xs text-zinc-400">
            {t.dueAt ? <>Agendada para {fmtDate(t.dueAt)}</> : 'Sem data'}
            {t.description && (
              <button onClick={() => setExpanded((v) => !v)} className="ml-2 text-[#228BE6] hover:underline">
                {expanded ? 'ocultar' : 'detalhes'}
              </button>
            )}
          </p>
          {expanded && t.description && (
            <pre className="mt-1.5 max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 font-sans text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
              {t.description}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}

// Criação rápida de prazo (modo calculado, igual ao /prazos).
function AddDeadlineInline({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'ORDINARY' | 'FATAL' | 'INTERNAL'>('ORDINARY');
  const [dias, setDias] = useState(15);
  const [disponibilizacao, setDisp] = useState(new Date().toISOString().slice(0, 10));
  const [dobro, setDobro] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      await deadlinesService.create({ caseId, title: title.trim(), type, dias, disponibilizacao, dobro });
      toast.success('Prazo criado');
      setTitle('');
      onClose();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/40">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ex.: Contestação"
        className={inputCls}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls}>
          <option value="ORDINARY">Comum</option>
          <option value="FATAL">Fatal</option>
          <option value="INTERNAL">Interno</option>
        </select>
        <input
          type="number"
          min={1}
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className={inputCls}
          title="Dias úteis"
        />
        <input
          type="date"
          value={disponibilizacao}
          onChange={(e) => setDisp(e.target.value)}
          className={inputCls}
          title="Disponibilização"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={dobro} onChange={(e) => setDobro(e.target.checked)} />
        Prazo em dobro (CPC 183/186/229)
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-zinc-500">
          Cancelar
        </button>
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
  );
}

// ─── Aba: Histórico ──────────────────────────────────────────────────

type HistFilter = 'all' | 'movement' | 'deadline' | 'event';
type HistEntry = {
  id: string;
  kind: 'movement' | 'deadline' | 'event';
  date: string;
  title: string;
  source?: string | null;
  deadlineType?: 'FATAL' | 'ORDINARY' | 'INTERNAL';
  meta?: string | null;
};

// Feed cronológico único: andamentos + prazos concluídos + eventos (estilo Astrea).
function HistoricoTab({
  caseId,
  movements,
  events,
  onAdd,
}: {
  caseId: string;
  movements: CaseDetail['movements'];
  events: CaseDetail['events'];
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<HistFilter>('all');

  // Prazos: só os concluídos entram no histórico (os abertos vivem na aba Atividades).
  const { data: deadlines = [] } = useQuery({
    queryKey: ['case-deadlines', caseId],
    queryFn: () => deadlinesService.list({ caseId }),
  });

  const entries: HistEntry[] = [
    ...movements.map((m) => ({
      id: `m-${m.id}`,
      kind: 'movement' as const,
      date: m.date,
      title: m.description,
      source: m.source,
    })),
    ...deadlines
      .filter((d) => d.status !== 'OPEN')
      .map((d) => ({
        id: `d-${d.id}`,
        kind: 'deadline' as const,
        date: d.dueDate,
        title: d.title,
        deadlineType: d.type,
        meta: d.status === 'DONE' ? 'Prazo cumprido' : d.status === 'EXPIRED' ? 'Prazo expirado' : 'Prazo cancelado',
      })),
    ...events.map((e) => ({
      id: `e-${e.id}`,
      kind: 'event' as const,
      date: e.startsAt,
      title: e.title,
      meta: [e.kind, e.location].filter(Boolean).join(' · ') || null,
    })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const shown = filter === 'all' ? entries : entries.filter((e) => e.kind === filter);
  const count = (k: HistFilter) => (k === 'all' ? entries.length : entries.filter((e) => e.kind === k).length);

  return (
    <Card
      title="Histórico"
      icon={FileText}
      action={
        <button onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: ASTREA_BLUE }}>
          <Plus className="h-3.5 w-3.5" /> Histórico manual
        </button>
      }
    >
      {/* Filtros por tipo */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {([
          ['all', 'Tudo'],
          ['movement', 'Andamentos'],
          ['deadline', 'Prazos'],
          ['event', 'Eventos'],
        ] as [HistFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              filter === key
                ? 'bg-[#228BE6] text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            {label} <span className="opacity-70">{count(key)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState>{filter === 'all' ? 'Nenhum registro no histórico.' : 'Nenhum registro deste tipo.'}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((e) => (
            <HistRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function HistRow({ e }: { e: HistEntry }) {
  const isDjen = (e.source ?? '').toUpperCase() === 'DJEN';
  const Icon = e.kind === 'deadline' ? CheckSquare : e.kind === 'event' ? CalendarClock : FileText;
  const iconColor =
    e.kind === 'deadline' ? 'text-emerald-500' : e.kind === 'event' ? 'text-violet-500' : 'text-sky-500';
  // Eventos têm hora real → data local; andamentos/prazos são só-data (UTC).
  const dateLabel = e.kind === 'event' ? new Date(e.date).toLocaleDateString('pt-BR') : fmtDate(e.date);
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 border-l-2 border-zinc-100 pl-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">{dateLabel}</span>
          {isDjen && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              DJEN
            </span>
          )}
          {e.kind === 'deadline' && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {e.meta}
            </span>
          )}
          {e.kind === 'event' && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              Evento
            </span>
          )}
          {e.kind === 'movement' && e.source && !isDjen && e.source !== 'manual' && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {e.source}
            </span>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
          {e.title}
          {e.kind === 'deadline' && e.deadlineType === 'FATAL' && (
            <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              FATAL
            </span>
          )}
        </p>
        {e.kind === 'event' && e.meta && <p className="mt-0.5 text-xs text-zinc-400">{e.meta}</p>}
      </div>
    </li>
  );
}

// Modal de histórico manual (texto + data) — usa POST /legal-cases/:id/movements.
function ManualHistoryModal({
  caseId,
  onClose,
  onSaved,
}: {
  caseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!desc.trim()) return toast.error('Digite o texto do histórico');
    setSaving(true);
    try {
      await legalCasesService.addMovement(caseId, { date, description: desc.trim() });
      toast.success('Histórico adicionado');
      onClose();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Adicionar histórico manual" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Texto *">
          <textarea
            autoFocus
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={5}
            placeholder="Digite seu texto aqui…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </Field>
      </div>
      <ModalActions
        saving={saving}
        onClose={onClose}
        onSave={submit}
      />
    </Modal>
  );
}

// ─── Editar processo ─────────────────────────────────────────────────

function EditCaseDialog({
  c,
  onClose,
  onSaved,
}: {
  c: CaseDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: c.title,
    cnjNumber: c.cnjNumber ?? '',
    internalCode: c.internalCode ?? '',
    area: c.area ?? '',
    court: c.court ?? '',
    jurisdiction: c.jurisdiction ?? '',
    distributedAt: c.distributedAt ? c.distributedAt.slice(0, 10) : '',
    value: c.value ?? '',
    status: c.status,
    responsibleId: c.responsible?.id ?? '',
  });
  const [saving, setSaving] = useState(false);
  // Instância editável: a detecção pelo texto da publicação erra para MENOS de
  // propósito (ver detectInstancia), então quem sabe é o advogado.
  const [instancia, setInstancia] = useState(getInstancia(c) ?? '');
  // Polo na execução: define de que lado do quadro Execução & Repasse o card cai.
  // Só o advogado sabe quando o Astrea não trouxe o papel (ficha nascida do DJEN).
  const [polo, setPolo] = useState<'exequente' | 'executado'>(getPolo(c));
  const [tipo, setTipo] = useState<'cumprimento' | 'execucao'>(getTipo(c));
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });

  // Cliente: sai daqui porque é aqui que se procura por ele. Antes só existia
  // em "Partes › Nova", e escondido atrás da troca de papel — processo sem
  // cliente ficava sem cliente, e sem cliente não há pasta no Drive.
  const clienteAtual = c.parties.find((p) => p.role === 'CLIENT');
  const [cliente, setCliente] = useState<{
    name: string;
    document?: string | null;
    contactId?: string | null;
  }>({
    // Abre no padrão do cadastro. Formatar a cada tecla brigaria com o cursor,
    // então normalizamos só o valor INICIAL — quem digita, digita livre.
    name: clienteAtual?.name ? titleCaseName(clienteAtual.name) : '',
    document: clienteAtual?.document ?? null,
    contactId: clienteAtual?.contact?.id ?? null,
  });

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      await legalCasesService.update(c.id, {
        instancia,
        polo,
        tipo,
        title: form.title.trim(),
        cnjNumber: form.cnjNumber,
        internalCode: form.internalCode,
        area: form.area,
        court: form.court,
        jurisdiction: form.jurisdiction,
        distributedAt: form.distributedAt || undefined,
        value: form.value === '' ? undefined : Number(form.value),
        status: form.status,
        responsibleId: form.responsibleId || undefined,
      });
      // Só mexe no cliente se mudou — assim salvar o processo não reescreve o
      // vínculo de quem já estava certo.
      const mudou =
        cliente.name.trim() !== (clienteAtual?.name ?? '') ||
        (cliente.contactId ?? null) !== (clienteAtual?.contact?.id ?? null) ||
        (cliente.document ?? null) !== (clienteAtual?.document ?? null);
      if (mudou && cliente.name.trim()) {
        await legalCasesService.setCliente(c.id, {
          name: cliente.name.trim(),
          document: cliente.document ?? null,
          contactId: cliente.contactId ?? null,
        });
      }
      toast.success('Processo atualizado');
      onClose();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title="Editar processo" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título *">
          <input autoFocus value={form.title} onChange={set('title')} className={inputCls} />
        </Field>
        <Field label="Cliente">
          {/* Busca os já cadastrados: escolhendo da lista, o processo entra na
              ficha daquele cliente (vínculo por contato/CPF). Digitando um nome
              que não existe, cria um cliente novo — que passa a ser o cadastro
              que os próximos processos vão encontrar. */}
          <ClientCombobox
            value={cliente.name}
            onSelect={(sel) =>
              setCliente({
                name: sel.name,
                document: sel.document ?? null,
                contactId: sel.contactId ?? null,
              })
            }
            inputClassName={`${inputCls} pl-8`}
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            {cliente.contactId || cliente.document ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ vinculado ao cadastro{cliente.document ? ` · ${cliente.document}` : ''} — os
                processos desta pessoa ficam juntos na ficha
              </span>
            ) : cliente.name.trim() ? (
              'Cliente novo, sem vínculo — confira se ele já não está na lista antes de salvar.'
            ) : (
              'Sem cliente o processo não tem pasta no Drive nem ficha.'
            )}
          </p>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nº CNJ">
            <input value={form.cnjNumber} onChange={set('cnjNumber')} className={inputCls} placeholder="0000000-00.0000.0.00.0000" />
          </Field>
          <Field label="Código interno">
            <input value={form.internalCode} onChange={set('internalCode')} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ação / Área">
            <input value={form.area} onChange={set('area')} className={inputCls} />
          </Field>
          <Field label="Vara / Juízo">
            <input value={form.court} onChange={set('court')} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Comarca / Foro">
            <input value={form.jurisdiction} onChange={set('jurisdiction')} className={inputCls} />
          </Field>
          <Field label="Valor da causa">
            {/* Máscara R$ (centavos): exibe "R$ 19.410,38"; grava numérico ("19410.38"). */}
            <input
              inputMode="numeric"
              value={form.value ? Number(form.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setForm({ ...form, value: d ? String(parseInt(d, 10) / 100) : '' }); }}
              placeholder="R$ 0,00"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Distribuído em">
            <input type="date" value={form.distributedAt} onChange={set('distributedAt')} className={inputCls} />
          </Field>
          <Field label="Instância">
          <select value={instancia} onChange={(e) => setInstancia(e.target.value)} className={inputCls}>
            <option value="">Não definida</option>
            <option value="1º Grau">1º Grau</option>
            <option value="2º Grau">2º Grau</option>
          </select>
        </Field>
        <Field label="Tipo do título">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'cumprimento' | 'execucao')} className={inputCls}>
            <option value="cumprimento">Cumprimento de sentença (fase)</option>
            <option value="execucao">Execução (processo autônomo)</option>
          </select>
        </Field>
        <Field label="Polo na execução">
          <select value={polo} onChange={(e) => setPolo(e.target.value as 'exequente' | 'executado')} className={inputCls}>
            <option value="exequente">Exequente — temos a receber</option>
            <option value="executado">Executado — somos a defesa</option>
          </select>
        </Field>
        <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Responsável">
          <select value={form.responsibleId} onChange={set('responsibleId')} className={inputCls}>
            <option value="">Sem responsável</option>
            {members.map((m: Member) => (
              <option key={m.userId} value={m.userId}>{m.user.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <ModalActions saving={saving} onClose={onClose} onSave={submit} saveLabel="Salvar" />
    </Modal>
  );
}

// ─── Partes (card do Resumo) ─────────────────────────────────────────

function PartiesCard({
  caseId,
  parties,
}: {
  caseId: string;
  parties: CaseDetail['parties'];
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [doc, setDoc] = useState('');
  const [contactId, setContactId] = useState('');
  const [role, setRole] = useState<PartyRole>('OPPONENT');
  const qc = useQueryClient();

  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-case', caseId] });

  // Troca de papel zera o vínculo (um contactId de cliente não vale como réu).
  const changeRole = (r: PartyRole) => { setRole(r); setDoc(''); setContactId(''); };

  const add = async () => {
    if (!name.trim()) return;
    try {
      await legalCasesService.addParty(caseId, {
        name: name.trim(),
        role,
        contactId: contactId || undefined,
        document: doc || undefined,
      });
      toast.success('Parte adicionada');
      setName(''); setDoc(''); setContactId('');
      setAdding(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  const remove = async (partyId: string) => {
    try {
      await legalCasesService.removeParty(partyId);
      refresh();
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
        <div className="mb-3 space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/40">
          {/* Cliente/Réu buscam os já cadastrados e vinculam por contactId/CPF; os
              demais papéis (terceiro, advogado, testemunha) seguem texto livre. */}
          {role === 'CLIENT' ? (
            <ClientCombobox
              value={name}
              onSelect={(s) => { setName(s.name); setDoc(s.document ?? ''); setContactId(s.contactId ?? ''); }}
              placeholder="Nome do cliente"
              inputClassName={`${inputCls} pl-8`}
            />
          ) : role === 'OPPONENT' ? (
            <OpponentCombobox
              value={name}
              onSelect={(s) => { setName(s.name); setDoc(s.document ?? ''); setContactId(s.contactId ?? ''); }}
              inputClassName={`${inputCls} pl-8`}
            />
          ) : (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da parte" className={inputCls} />
          )}
          {contactId && (
            <span className="block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ vinculado ao cadastro</span>
          )}
          <select value={role} onChange={(e) => changeRole(e.target.value as PartyRole)} className={inputCls}>
            {(Object.keys(ROLE_LABEL) as PartyRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500">
              Cancelar
            </button>
            <button
              onClick={add}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: ASTREA_BLUE }}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
      {parties.length === 0 ? (
        <EmptyState>Sem partes.</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {parties.map((p) => (
            <li key={p.id} className="group flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-200">
                {p.role === 'CLIENT' ? (
                  <Link href={`/clientes/${p.id}`} className="hover:text-[#228BE6] hover:underline">
                    {titleCaseName(p.name)}
                  </Link>
                ) : (
                  p.name
                )}
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {ROLE_LABEL[p.role]}
                </span>
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

// ─── Recursos (espelha o subcard + database "05. RECURSOS" do Pipefy) ────────

const JULG_BADGE: Record<JulgamentoRecurso, string> = {
  AGUARDANDO: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  PROVIDO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  NAO_PROVIDO: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  PARCIAL: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
};
const ESPECIES = ['Apelação', 'Agravo Interno', 'Agravo de Instrumento', 'Agravo em REsp', 'REsp', 'RE', 'Embargos de Declaração', 'Recurso Inominado', 'Recurso Ordinário'];

function RecursosTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: recursos = [], isLoading } = useQuery({
    queryKey: ['case-recursos', caseId],
    queryFn: () => recursosService.list({ caseId }),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case-recursos', caseId] });
    qc.invalidateQueries({ queryKey: ['recursos-stats'] });
  };

  return (
    <div className="space-y-5">
      <Card
        title="Recursos deste processo"
        icon={Gavel}
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-[#228BE6] hover:underline"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        }
      >
        {adding && (
          <RecursoForm
            caseId={caseId}
            onDone={() => { setAdding(false); refresh(); }}
            onCancel={() => setAdding(false)}
          />
        )}
        {isLoading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : recursos.length === 0 ? (
          <EmptyState>Nenhum recurso neste processo. É criado automaticamente ao mover o card para a fase de Recurso, ou quando o DJEN detecta interposição/julgamento.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recursos.map((r) => (
              <RecursoRow key={r.id} r={r} onChange={refresh} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RecursoRow({ r, onChange }: { r: Recurso; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const remove = async () => {
    if (!confirm('Excluir este recurso?')) return;
    try {
      await recursosService.remove(r.id);
      toast.success('Recurso excluído');
      onChange();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  if (editing) {
    return (
      <li className="py-3">
        <RecursoForm
          caseId={r.caseId}
          initial={r}
          onDone={() => { setEditing(false); onChange(); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#202124] dark:text-zinc-100">
              {r.especie || 'Recurso'}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${JULG_BADGE[r.julgamento]}`}>
              {JULGAMENTO_LABEL[r.julgamento]}
            </span>
            {r.parteRecorrente && (
              <span className="text-xs text-[#6C757D]">
                · recorrente: {PARTE_RECORRENTE_LABEL[r.parteRecorrente]}
              </span>
            )}
            {r.grau && <span className="text-xs text-[#6C757D]">· grau {r.grau}</span>}
          </div>
          <div className="mt-0.5 text-xs text-[#6C757D]">
            {r.parteAdversa ? `Parte adversa: ${r.parteAdversa}` : ''}
            {r.numeroRecurso ? `${r.parteAdversa ? ' · ' : ''}nº ${r.numeroRecurso}` : ''}
          </div>
          {r.motivo && (
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-medium text-[#6C757D]">Motivo:</span> {r.motivo}
            </div>
          )}
          {r.ementa && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-[#228BE6] hover:underline"
            >
              {expanded ? 'Ocultar ementa' : 'Ver ementa / tese de julgamento'}
            </button>
          )}
          {expanded && r.ementa && (
            <p className="mt-1 whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              {r.ementa}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setEditing(true)} title="Editar" className="text-zinc-400 hover:text-[#228BE6]">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={remove} title="Excluir" className="text-zinc-400 hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function RecursoForm({
  caseId,
  initial,
  onDone,
  onCancel,
}: {
  caseId: string;
  initial?: Recurso;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [especie, setEspecie] = useState(initial?.especie ?? '');
  const [parte, setParte] = useState(initial?.parteRecorrente ?? '');
  const [julgamento, setJulgamento] = useState<JulgamentoRecurso>(initial?.julgamento ?? 'AGUARDANDO');
  const [numero, setNumero] = useState(initial?.numeroRecurso ?? '');
  const [grau, setGrau] = useState(initial?.grau ?? '');
  const [parteAdversa, setParteAdversa] = useState(initial?.parteAdversa ?? '');
  const [motivo, setMotivo] = useState(initial?.motivo ?? '');
  const [ementa, setEmenta] = useState(initial?.ementa ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        especie: especie || undefined,
        parteRecorrente: (parte || undefined) as 'CLIENTE' | 'ADVERSA' | undefined,
        julgamento,
        numeroRecurso: numero,
        grau,
        parteAdversa,
        motivo,
        ementa,
      };
      if (initial) await recursosService.update(initial.id, payload);
      else await recursosService.create({ caseId, ...payload });
      toast.success(initial ? 'Recurso atualizado' : 'Recurso adicionado');
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-[#DEE2E6] bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Espécie">
          <input
            list="especies-recurso"
            value={especie}
            onChange={(e) => setEspecie(e.target.value)}
            placeholder="Apelação, Agravo Interno…"
            className={inputCls}
          />
          <datalist id="especies-recurso">
            {ESPECIES.map((e) => <option key={e} value={e} />)}
          </datalist>
        </Field>
        <Field label="Parte recorrente">
          <select value={parte} onChange={(e) => setParte(e.target.value as any)} className={inputCls}>
            <option value="">—</option>
            <option value="CLIENTE">Cliente (nós)</option>
            <option value="ADVERSA">Parte adversa</option>
          </select>
        </Field>
        <Field label="Julgamento">
          <select value={julgamento} onChange={(e) => setJulgamento(e.target.value as JulgamentoRecurso)} className={inputCls}>
            <option value="AGUARDANDO">Aguardando decisão</option>
            <option value="PROVIDO">Provido</option>
            <option value="NAO_PROVIDO">Não provido</option>
            <option value="PARCIAL">Parcialmente provido</option>
          </select>
        </Field>
        <Field label="Nº do recurso">
          <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Parte adversa">
          <input value={parteAdversa} onChange={(e) => setParteAdversa(e.target.value)} placeholder="Banco / réu" className={inputCls} />
        </Field>
        <Field label="Grau / unidade">
          <input value={grau} onChange={(e) => setGrau(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Motivo do recurso (por que recorremos)">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ex.: sentença julgou improcedente a nulidade do RMC" className={`${inputCls} !h-auto py-2`} />
      </Field>
      <Field label="Ementa / tese de julgamento">
        <textarea value={ementa} onChange={(e) => setEmenta(e.target.value)} rows={3} className={`${inputCls} !h-auto py-2`} />
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-[#6C757D] hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-[#228BE6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c7ed6] disabled:opacity-50"
        >
          {busy ? 'Salvando…' : initial ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}

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
    <div className="rounded-lg border border-[#DEE2E6] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-[#DEE2E6] px-5 py-3.5 dark:border-zinc-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#202124] dark:text-zinc-100">
          <Icon className="h-4 w-4" style={{ color: ASTREA_BLUE }} />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-[#6C757D]">{label}:</dt>
      <dd className="text-[#202124] dark:text-zinc-200">{children}</dd>
    </div>
  );
}

/** Troca o responsável do processo inline (dropdown de membros). */
function ResponsibleEditor({ caseId, current, onChange }: { caseId: string; current: { id: string; name: string } | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  const set = useMutation({
    mutationFn: (userId: string) => legalCasesService.update(caseId, { responsibleId: userId || undefined }),
    onSuccess: () => { setOpen(false); onChange(); toast.success('Responsável atualizado'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao atribuir'),
  });
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <span className="truncate">{current?.name ?? <span className="text-zinc-400">Atribuir responsável</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button onClick={() => set.mutate('')} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Sem responsável {!current && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
            </button>
            {members.map((m: Member) => (
              <button key={m.userId} onClick={() => set.mutate(m.userId)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <span className="truncate">{m.user.name}</span>
                {current?.id === m.userId && <Check className="h-3.5 w-3.5 text-[#228BE6]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <dt className="w-36 shrink-0 text-sm font-medium text-[#6C757D]">{label}</dt>
      <dd className="text-sm text-[#202124] dark:text-zinc-200">{value}</dd>
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
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md border text-zinc-500 transition-colors dark:text-zinc-400 ${
        active
          ? 'border-[#228BE6] bg-[#228BE6]/5 text-[#228BE6] dark:bg-[#228BE6]/10'
          : 'border-[#DEE2E6] bg-white hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

// Modal genérico (estilo claro Astrea, com dark).
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 text-zinc-800 shadow-2xl dark:bg-zinc-900 dark:text-zinc-200">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  saving,
  onClose,
  onSave,
  saveLabel = 'Salvar',
}: {
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: ASTREA_BLUE }}
      >
        {saving ? 'Salvando…' : saveLabel}
      </button>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-[60] w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          {danger && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">
            Cancelar
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#228BE6] hover:bg-[#1c7ed6]'
            }`}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
