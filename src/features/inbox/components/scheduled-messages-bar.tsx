'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, X, ChevronDown, Pencil, Trash2, Loader2, CalendarClock, Paperclip, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  scheduledMessagesService,
  scheduledAnexoHref,
  type ScheduledAnexo,
  type ScheduledMessage,
} from '../services/scheduled-messages.service';

/** Conta o tempo restante até `iso` no formato "8h 56min 46s". */
function countdown(iso: string, now: number): string {
  let ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'agora';
  const dias = Math.floor(ms / 86_400_000);
  ms -= dias * 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const min = Math.floor(ms / 60_000);
  ms -= min * 60_000;
  const s = Math.floor(ms / 1000);
  if (dias > 0) return `${dias}d ${h}h ${min}min`;
  if (h > 0) return `${h}h ${min}min ${s}s`;
  if (min > 0) return `${min}min ${s}s`;
  return `${s}s`;
}

function fullStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Diz se a agendada leva arquivo e QUAL — quem lê "segue em anexo a prestação de
 * contas" precisa conferir que o PDF está mesmo junto antes da hora do envio.
 * Sem anexo o aviso é discreto, mas explícito: a ausência também é informação.
 */
export function ScheduledAnexos({ anexos, tom = 'claro' }: { anexos?: ScheduledAnexo[]; tom?: 'claro' | 'escuro' }) {
  const lista = anexos ?? [];
  if (lista.length === 0) {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        <Paperclip className="h-3 w-3 shrink-0" /> Sem anexo
      </p>
    );
  }
  return (
    <div className="mt-1.5 space-y-1">
      {lista.map((a) => (
        <a
          key={a.url}
          href={scheduledAnexoHref(a)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Abrir ${a.nome}`}
          className={`flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            tom === 'escuro'
              ? 'bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15'
              : 'bg-white/70 text-zinc-700 hover:bg-white dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15'
          }`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          <span className="truncate">{a.nome}</span>
        </a>
      ))}
    </div>
  );
}

export function ScheduledMessagesBar({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data } = useQuery({
    queryKey: ['scheduled-messages', conversationId],
    queryFn: () => scheduledMessagesService.list(conversationId),
    refetchInterval: 30_000,
  });

  const pending = useMemo(
    () =>
      (data ?? [])
        .filter((m) => m.status === 'PENDING')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [data],
  );

  // Tick de 1s só enquanto houver agendamento (pro contador ao vivo).
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending.length]);

  if (pending.length === 0) return null;

  const next = pending[0];

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-sky-50 px-4 py-2 text-[13px] dark:border-sky-900/40 dark:bg-sky-950/30">
        <span className="flex min-w-0 items-center gap-2 text-sky-700 dark:text-sky-300">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Sua próxima mensagem será enviada em{' '}
            <strong className="tabular-nums">{countdown(next.scheduledAt, now)}</strong>
            {(next.anexos?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 align-middle" title={next.anexos!.map((a) => a.nome).join(', ')}>
                <Paperclip className="h-3.5 w-3.5" />
                {next.anexos!.length === 1 ? next.anexos![0].nome : `${next.anexos!.length} anexos`}
              </span>
            )}
          </span>
        </span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-[12px] font-semibold text-sky-700 transition-colors hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60"
        >
          Agendamentos {pending.length}
        </button>
      </div>

      {open && (
        <ScheduledMessagesModal
          items={pending}
          onClose={() => setOpen(false)}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ['scheduled-messages', conversationId] })
          }
        />
      )}
    </>
  );
}

function ScheduledMessagesModal({
  items,
  onClose,
  onChanged,
}: {
  items: ScheduledMessage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Mensagens Agendadas ({items.length})
            </h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {items.map((m) => (
            <ScheduledBubble key={m.id} item={m} onChanged={onChanged} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduledBubble({ item, onChanged }: { item: ScheduledMessage; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content?.text ?? '');
  const [when, setWhen] = useState(toLocalInput(item.scheduledAt));
  const [busy, setBusy] = useState(false);
  /**
   * Template aprovado tem conteúdo fixo pela Meta: dá para remarcar a data, não
   * para reescrever o texto. E mandar `text` no update sobrescreveria
   * `content.template`, deixando a agendada sem HSM para disparar.
   */
  const isTemplate = item.type === 'TEMPLATE';

  const cancel = async () => {
    setBusy(true);
    try {
      await scheduledMessagesService.cancel(item.id);
      toast.success('Envio cancelado');
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao cancelar');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const trimmed = text.trim();
    if (!isTemplate && !trimmed) {
      toast.error('A mensagem não pode ficar vazia.');
      return;
    }
    const d = new Date(when);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      toast.error('Escolha um horário no futuro.');
      return;
    }
    setBusy(true);
    try {
      await scheduledMessagesService.update(
        item.id,
        isTemplate ? { scheduledAt: d.toISOString() } : { text: trimmed, scheduledAt: d.toISOString() },
      );
      toast.success('Agendamento atualizado');
      setEditing(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        {isTemplate ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Template {item.content?.template?.name ?? ''}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-300">
              {item.content?.text}
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              O texto vem do template aprovado e não pode ser editado aqui. Dá para remarcar a data.
            </p>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        )}
        <ScheduledAnexos anexos={item.anexos} tom="escuro" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]"
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); setText(item.content?.text ?? ''); setWhen(toLocalInput(item.scheduledAt)); }}
              className="rounded-md px-2.5 py-1 text-[12px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/15">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100">
            {item.type === 'TEMPLATE' && (
              <span className="mr-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                Template
              </span>
            )}
            {item.content?.text}
          </p>
          <ScheduledAnexos anexos={item.anexos} tom="escuro" />
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-zinc-300"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  onClick={() => { setMenuOpen(false); setEditing(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                  Editar mensagem
                </button>
                <button
                  onClick={() => { setMenuOpen(false); cancel(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancelar envio
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
        <Clock className="h-3 w-3" />
        {fullStamp(item.scheduledAt)}
      </div>
    </div>
  );
}
