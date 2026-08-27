'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Handshake,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import { membersService } from '@/features/settings/services/members.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import {
  partnershipsService,
  type Partnership,
} from '@/features/partnerships/services/partnerships.service';
import { LEGAL_AREAS } from '@/features/settings/services/area-assignment.service';

/** Quadros do kanban jurídico que uma parceria pode abrir para o parceiro. */
const BOARDS = [
  { key: 'plan', label: 'Planejamento Previdenciário' },
  { key: 'pre', label: 'Pré-processual' },
  { key: 'judicial', label: 'Fase Judicial' },
  { key: 'banco', label: 'Fase Bancária' },
  { key: 'execucao', label: 'Execução' },
];

export default function ParceriasSettingsPage() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const { data: parcerias, isLoading } = useQuery({
    queryKey: ['parcerias'],
    queryFn: () => partnershipsService.list(),
  });

  const atual = parcerias?.find((p) => p.id === selecionada) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-white">
            <Handshake className="size-5 text-zinc-400" />
            Parcerias
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Um recorte do hub para trabalhar com um parceiro externo. Ele entra com login
            próprio e enxerga <strong>só</strong> os processos que você marcar aqui — com as
            conversas, o kanban, os prazos e o acerto financeiro correspondentes. Nada do
            resto do escritório.
          </p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="size-4" />
          Nova parceria
        </button>
      </div>

      {criando && (
        <NovaParceria
          onFechar={() => setCriando(false)}
          onCriada={(p) => {
            qc.invalidateQueries({ queryKey: ['parcerias'] });
            setCriando(false);
            setSelecionada(p.id);
          }}
        />
      )}

      <div className="mt-6 space-y-2">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !parcerias?.length ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <Handshake className="mx-auto size-8 text-zinc-300 dark:text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">Nenhuma parceria ainda.</p>
          </div>
        ) : (
          parcerias.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelecionada(selecionada === p.id ? null : p.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                selecionada === p.id
                  ? 'border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/50'
                  : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40'
              }`}
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-zinc-900 dark:text-white">
                  {p.name}
                  {!p.active && (
                    <span className="ml-2 text-xs font-normal text-zinc-400">encerrada</span>
                  )}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {p.nCasos} processo{p.nCasos === 1 ? '' : 's'} ·{' '}
                  {p.membros.length} membro{p.membros.length === 1 ? '' : 's'} ·{' '}
                  parceiro fica com {p.partnerPct}%
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      {atual && <DetalheParceria parceria={atual} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function NovaParceria({
  onFechar,
  onCriada,
}: {
  onFechar: () => void;
  onCriada: (p: Partnership) => void;
}) {
  const [name, setName] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>(['plan']);
  const [partnerPct, setPartnerPct] = useState(50);

  const criar = useMutation({
    mutationFn: () =>
      partnershipsService.create({ name, areas, boards, partnerPct }),
    onSuccess: (p) => {
      toast.success('Parceria criada.');
      onCriada(p);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Não deu para criar a parceria.'),
  });

  return (
    <div className="mt-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Nova parceria</h2>
        <button onClick={onFechar} className="text-zinc-400 hover:text-zinc-600">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Campo label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Planejamento Previdenciário"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Campo>

        <Campo label="Áreas (rótulo e default ao marcar processo)">
          <div className="flex flex-wrap gap-1.5">
            {LEGAL_AREAS.map((a) => (
              <Chip
                key={a}
                ativo={areas.includes(a)}
                onClick={() =>
                  setAreas((v) => (v.includes(a) ? v.filter((x) => x !== a) : [...v, a]))
                }
              >
                {a}
              </Chip>
            ))}
          </div>
        </Campo>

        <Campo label="Quadros do kanban liberados">
          <div className="flex flex-wrap gap-1.5">
            {BOARDS.map((b) => (
              <Chip
                key={b.key}
                ativo={boards.includes(b.key)}
                onClick={() =>
                  setBoards((v) =>
                    v.includes(b.key) ? v.filter((x) => x !== b.key) : [...v, b.key],
                  )
                }
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </Campo>

        <Campo label="Percentual do parceiro sobre o líquido">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={partnerPct}
              onChange={(e) => setPartnerPct(Number(e.target.value))}
              className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
            <Percent className="size-4 text-zinc-400" />
            <span className="text-xs text-zinc-500">
              escritório fica com {100 - partnerPct}%
            </span>
          </div>
        </Campo>
      </div>

      <button
        disabled={!name.trim() || criar.isPending}
        onClick={() => criar.mutate()}
        className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
      >
        {criar.isPending ? 'Criando…' : 'Criar parceria'}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function DetalheParceria({ parceria }: { parceria: Partnership }) {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['parcerias'] });
    qc.invalidateQueries({ queryKey: ['parceria', parceria.id] });
  };

  const { data: membros } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersService.list(),
  });
  const { data: casos } = useQuery({
    queryKey: ['parceria', parceria.id, 'casos'],
    queryFn: () => partnershipsService.casos(parceria.id),
  });

  const addMembro = useMutation({
    mutationFn: (userId: string) => partnershipsService.addMember(parceria.id, { userId }),
    onSuccess: () => {
      toast.success('Membro incluído na parceria.');
      invalidar();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Não deu para incluir o membro.'),
  });

  const removeMembro = useMutation({
    mutationFn: (memberId: string) => partnershipsService.removeMember(parceria.id, memberId),
    onSuccess: () => {
      toast.success('Membro removido.');
      invalidar();
    },
  });

  const desmarcar = useMutation({
    mutationFn: (caseId: string) => partnershipsService.desmarcarCasos(parceria.id, [caseId]),
    onSuccess: () => {
      toast.success('Processo removido da parceria.');
      invalidar();
    },
  });

  const jaMembro = new Set(parceria.membros.map((m) => m.userId));
  const candidatos = (membros ?? []).filter((m) => !jaMembro.has(m.userId));

  return (
    <div className="mt-6 space-y-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {/* Membros */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Quem participa</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Um membro <strong>PARCEIRO</strong> fica travado no recorte. Sócio do escritório
          entra sempre como interno — ele continua vendo o hub inteiro.
        </p>

        <div className="mt-3 space-y-1.5">
          {parceria.membros.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {m.nome ?? m.email}
                </span>
                <span className="block truncate text-xs text-zinc-500">{m.email}</span>
              </span>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                  m.role === 'PARTNER'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {m.role === 'PARTNER' ? 'Parceiro (travado)' : 'Escritório'}
              </span>
              <button
                onClick={() => removeMembro.mutate(m.id)}
                className="shrink-0 text-zinc-400 hover:text-rose-500"
                title="Remover da parceria"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {candidatos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <UserPlus className="size-4 text-zinc-400" />
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) addMembro.mutate(e.target.value);
                e.target.value = '';
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Incluir membro…</option>
              {candidatos.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name} ({m.role})
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-400">
              O parceiro precisa ser membro da organização antes (Configurações › Membros).
            </span>
          </div>
        )}
      </section>

      {/* Processos */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Processos da parceria
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Só o que estiver aqui é visível ao parceiro — conversas, prazos, agenda e
          financeiro seguem esta lista.
        </p>

        <MarcarProcessos parceria={parceria} onMarcado={invalidar} />

        <div className="mt-3 space-y-1.5">
          {!casos?.length ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Nenhum processo marcado. Enquanto estiver assim, o parceiro entra e não vê nada.
            </p>
          ) : (
            casos.map((c) => (
              <div
                key={c.caseId}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900 dark:text-white">
                    {c.cliente ?? c.title}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {c.cnj ?? 'sem CNJ'} · {c.area ?? 'sem área'}
                  </span>
                </span>
                <button
                  onClick={() => desmarcar.mutate(c.caseId)}
                  className="shrink-0 text-zinc-400 hover:text-rose-500"
                  title="Tirar da parceria"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function MarcarProcessos({
  parceria,
  onMarcado,
}: {
  parceria: Partnership;
  onMarcado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const area = parceria.areas[0];

  const { data: todos } = useQuery({
    queryKey: ['legal-cases', 'picker', area],
    queryFn: () => legalCasesService.list(area ? { area } : {}),
  });

  const marcar = useMutation({
    mutationFn: (caseId: string) => partnershipsService.marcarCasos(parceria.id, [caseId]),
    onSuccess: (r) => {
      if (r.conflitos.length) {
        toast.error(
          `Já está na parceria "${r.conflitos[0].parceria}". Tire de lá antes — um processo só pode estar em uma.`,
        );
      } else {
        toast.success('Processo marcado.');
      }
      setBusca('');
      onMarcado();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Não deu para marcar o processo.'),
  });

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return (todos ?? [])
      .filter((c) => {
        const cliente = c.parties?.find((p) => p.role === 'CLIENT')?.name ?? '';
        return (
          c.title.toLowerCase().includes(q) ||
          cliente.toLowerCase().includes(q) ||
          (c.cnjNumber ?? '').includes(q)
        );
      })
      .slice(0, 8);
  }, [busca, todos]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <Search className="size-4 shrink-0 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={
            area ? `Buscar processo de ${area}…` : 'Buscar processo por cliente ou CNJ…'
          }
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {busca.trim().length >= 2 && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          {!resultados.length ? (
            <p className="px-3 py-3 text-xs text-zinc-500">Nada encontrado.</p>
          ) : (
            resultados.map((c) => {
              const cliente = c.parties?.find((p) => p.role === 'CLIENT')?.name ?? c.title;
              return (
                <button
                  key={c.id}
                  onClick={() => marcar.mutate(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <Plus className="size-3.5 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate">{cliente}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{c.cnjNumber ?? '—'}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {!area && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Sem área definida na parceria, a busca varre a carteira inteira.
        </p>
      )}
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        ativo
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
          : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400'
      }`}
    >
      {children}
    </button>
  );
}
