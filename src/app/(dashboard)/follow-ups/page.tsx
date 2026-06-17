'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X, Clock, MessageCircleHeart, Zap, MoonStar, Mic2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import {
  followUpService,
  humanCadence,
  FOLLOW_UP_TONES,
  FOLLOW_UP_TONE_LABELS,
  FOLLOW_UP_TONE_HINTS,
  type FollowUpConfig,
  type FollowUpTone,
  type FollowUpStatusConfig,
} from '@/features/follow-ups/services/follow-up.service';
import { contactStatusesService } from '@/features/settings/services/contact-statuses.service';
import { useOrgId } from '@/hooks/use-org-query-key';

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'agora';
  const h = ms / 3_600_000;
  if (h < 1) return `em ${Math.max(1, Math.round(ms / 60_000))}min`;
  if (h < 48) return `em ${Math.round(h)}h`;
  return `em ${Math.round(h / 24)}d`;
}

export default function FollowUpsPage() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups-overview'],
    queryFn: () => followUpService.getOverview(),
    refetchInterval: 30_000,
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ['contact-statuses', orgId],
    queryFn: () => contactStatusesService.list(),
  });

  const [cfg, setCfg] = useState<FollowUpConfig | null>(null);
  const [newStep, setNewStep] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    if (data?.config) setCfg(data.config);
  }, [data?.config]);

  const persist = async (patch: Partial<FollowUpConfig>, silent = false) => {
    setSavingCfg(true);
    try {
      const saved = await followUpService.updateConfig(patch);
      setCfg(saved);
      qc.invalidateQueries({ queryKey: ['follow-ups-overview'] });
      if (!silent) toast.success('Follow-ups atualizados');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSavingCfg(false);
    }
  };

  const toggleEnabled = () => cfg && persist({ enabled: !cfg.enabled });

  const removeStep = (i: number) => {
    if (!cfg) return;
    const cadenceHours = cfg.cadenceHours.filter((_, idx) => idx !== i);
    persist({ cadenceHours }, true);
  };

  const addStep = () => {
    if (!cfg) return;
    const raw = newStep.trim().toLowerCase();
    const m = raw.match(/^(\d+)\s*(h|d)?$/);
    if (!m) {
      toast.error('Use ex: "6h" ou "2d"');
      return;
    }
    const hours = Number(m[1]) * (m[2] === 'd' ? 24 : 1);
    if (hours < 1) return;
    const cadenceHours = [...cfg.cadenceHours, hours].sort((a, b) => a - b);
    setNewStep('');
    persist({ cadenceHours }, true);
  };

  // ─── Config por status do funil ──────────────────────────────────
  const statusCfg = (
    statusId: string,
  ): { enabled: boolean; count: number; tone: FollowUpTone } => {
    const ov = cfg?.perStatus?.find((s) => s.statusId === statusId);
    return {
      enabled: ov?.enabled !== false,
      count: typeof ov?.count === 'number' ? ov.count : (cfg?.cadenceHours.length ?? 0),
      tone: ov?.tone ?? cfg?.defaultTone ?? 'padrao',
    };
  };
  const setStatusCfg = (statusId: string, patch: Partial<FollowUpStatusConfig>) => {
    if (!cfg) return;
    const others = (cfg.perStatus ?? []).filter((s) => s.statusId !== statusId);
    const cur = (cfg.perStatus ?? []).find((s) => s.statusId === statusId) ?? { statusId };
    const merged: FollowUpStatusConfig = { ...cur, ...patch, statusId };
    persist({ perStatus: [...others, merged] }, true);
  };

  if (isLoading || !cfg) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Carregando follow-ups…</span>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircleHeart className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Follow-ups</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            A IA reengaja sozinha quem parou de responder — mensagens naturais, na hora certa, sem ser robótico.
          </p>
        </div>
      </div>

      {/* Toggle principal */}
      <div className={`rounded-2xl border p-5 transition-colors ${cfg.enabled ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-900/15' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className={`h-5 w-5 ${cfg.enabled ? 'text-emerald-600' : 'text-zinc-400'}`} />
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Follow-ups automáticos {cfg.enabled ? 'ligados' : 'desligados'}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {cfg.enabled
                  ? 'A IA está reengajando os leads silenciosos conforme a régua abaixo.'
                  : 'Nada é disparado. Ligue quando quiser começar a reengajar automaticamente.'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={savingCfg}
            role="switch"
            aria-checked={cfg.enabled}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0 transition-colors disabled:opacity-50 ${cfg.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${cfg.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Régua de cadência */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Régua de cadência</h2>
        </div>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Tempo de silêncio até cada toque. Cada etapa reinicia se o cliente responder.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {cfg.cadenceHours.map((h, i) => (
            <span
              key={`${h}-${i}`}
              className="group inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              <span className="text-[11px] opacity-60">{i + 1}º</span>
              {humanCadence(h)}
              <button onClick={() => removeStep(i)} className="rounded-full p-0.5 opacity-50 hover:bg-primary/20 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
              placeholder="6h / 2d"
              className="w-20 rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-primary/60 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button onClick={addStep} className="rounded-full bg-zinc-100 p-1.5 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
              <Plus className="h-4 w-4" />
            </button>
          </span>
        </div>

        {/* Janela de silêncio */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <MoonStar className="h-4 w-4 text-zinc-500" />
          <span className="text-zinc-600 dark:text-zinc-300">Não manda entre</span>
          <input
            type="number" min={0} max={23}
            value={cfg.quietStartHour}
            onChange={(e) => setCfg({ ...cfg, quietStartHour: Number(e.target.value) })}
            onBlur={() => persist({ quietStartHour: cfg.quietStartHour }, true)}
            className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-zinc-600 dark:text-zinc-300">h e</span>
          <input
            type="number" min={0} max={23}
            value={cfg.quietEndHour}
            onChange={(e) => setCfg({ ...cfg, quietEndHour: Number(e.target.value) })}
            onBlur={() => persist({ quietEndHour: cfg.quietEndHour }, true)}
            className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-zinc-600 dark:text-zinc-300">h (horário {data?.timezone?.split('/')[1]?.replace('_', ' ') ?? 'local'}).</span>
        </div>

        {/* Tom global */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <Mic2 className="h-4 w-4 text-zinc-500" />
          <span className="text-zinc-600 dark:text-zinc-300">Tom padrão das mensagens:</span>
          <select
            value={cfg.defaultTone}
            onChange={(e) => persist({ defaultTone: e.target.value as FollowUpTone })}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {FOLLOW_UP_TONES.map((t) => (
              <option key={t} value={t}>{FOLLOW_UP_TONE_LABELS[t]}</option>
            ))}
          </select>
          <span className="text-[12px] text-zinc-400">{FOLLOW_UP_TONE_HINTS[cfg.defaultTone]}</span>
        </div>
      </div>

      {/* Personalização por status do funil */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-1 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-zinc-500" />
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Por status do funil</h2>
        </div>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Ajuste quantos toques e o tom para cada etapa do atendimento. Sem ajuste, o status segue o padrão acima.
        </p>
        {statuses.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-400 dark:bg-zinc-900/60">
            Nenhum status cadastrado. Crie status do funil em Configurações → Contatos.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {statuses.map((s) => {
              const sc = statusCfg(s.id);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="inline-flex min-w-[140px] items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  {/* Liga/desliga follow-up neste status */}
                  <button
                    onClick={() => setStatusCfg(s.id, { enabled: !sc.enabled })}
                    role="switch"
                    aria-checked={sc.enabled}
                    title={sc.enabled ? 'Follow-up ligado neste status' : 'Follow-up desligado neste status'}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${sc.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sc.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <div className={`flex flex-wrap items-center gap-3 transition-opacity ${sc.enabled ? '' : 'pointer-events-none opacity-40'}`}>
                    {/* Quantos toques */}
                    <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                      Toques
                      <input
                        type="number" min={0} max={10}
                        value={sc.count}
                        onChange={(e) => setStatusCfg(s.id, { count: Math.max(0, Math.min(10, Number(e.target.value))) })}
                        className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    {/* Tom */}
                    <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                      Tom
                      <select
                        value={sc.tone}
                        onChange={(e) => setStatusCfg(s.id, { tone: e.target.value as FollowUpTone })}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {FOLLOW_UP_TONES.map((t) => (
                          <option key={t} value={t}>{FOLLOW_UP_TONE_LABELS[t]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aguardando resposta */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Aguardando o cliente</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{data?.total ?? 0} na fila</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {data?.dueNow ?? 0} vencidos
            </span>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-400">
            Nenhuma conversa aguardando resposta no momento.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((it) => (
              <div key={it.conversationId} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-[12px] font-semibold text-white">
                  {(it.contactName ?? '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {it.contactName || it.phone || 'Sem nome'}
                  </p>
                  <p className="flex items-center gap-2 text-[12px] text-zinc-400">
                    {it.statusName && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: it.statusColor ?? '#a1a1aa' }} />
                        {it.statusName}
                      </span>
                    )}
                    <span>calado há {it.silenceHours}h</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">
                    {it.attempts > 0 ? `tentativa ${it.attempts}/${it.maxAttempts}` : 'aguardando 1º toque'}
                  </p>
                  <p className={`text-[12px] ${it.due ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`}>
                    {it.due ? 'vencido — no próximo scan' : `próximo ${relTime(it.nextAt)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
