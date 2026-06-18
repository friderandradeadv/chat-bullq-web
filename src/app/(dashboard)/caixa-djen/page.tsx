'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, RefreshCw, Link2, X, Scale } from 'lucide-react';
import { toast } from 'sonner';
import {
  djenService,
  type Publication,
  type PublicationStatus,
} from '@/features/djen/services/djen.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { CnjNumber } from '../processos/page';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const URGENCY_STYLE: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixa: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export default function CaixaDjenPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PublicationStatus | 'ALL'>('CLASSIFIED');
  const [running, setRunning] = useState(false);

  const { data: pubs = [], isLoading } = useQuery({
    queryKey: ['djen', { status }],
    queryFn: () =>
      djenService.list(status === 'ALL' ? {} : { status }),
  });

  const run = async () => {
    setRunning(true);
    try {
      const s = await djenService.run({});
      toast.success(`Scan: ${s.novas} novas, ${s.vinculadas} vinculadas, ${s.prazosCriados} prazos`);
      qc.invalidateQueries({ queryKey: ['djen'] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao rodar o scan');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f5f6f8] dark:bg-zinc-950 p-6 text-zinc-800 dark:text-zinc-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Mail className="h-5 w-5 text-primary" />
            Publicações
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Publicações capturadas do Diário · classificação + vínculo ao processo
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Buscando…' : 'Rodar agora'}
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        {(['CLASSIFIED', 'LINKED', 'DISMISSED', 'ALL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === s
                ? 'bg-primary text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {{ CLASSIFIED: 'A triar', LINKED: 'Vinculadas', DISMISSED: 'Descartadas', ALL: 'Todas' }[s]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto">
        {isLoading && <p className="text-sm text-zinc-400">Carregando…</p>}
        {!isLoading && pubs.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhuma publicação.</p>
        )}
        {pubs.map((p) => (
          <PublicationCard key={p.id} p={p} onChange={() => qc.invalidateQueries({ queryKey: ['djen'] })} />
        ))}
      </div>
    </div>
  );
}

function PublicationCard({ p, onChange }: { p: Publication; onChange: () => void }) {
  const [linking, setLinking] = useState(false);
  const cls = p.classification;

  const dismiss = async () => {
    try {
      await djenService.dismiss(p.id);
      toast.success('Publicação descartada');
      onChange();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    }
  };

  return (
    <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {p.case?.cnjNumber ? (
              <CnjNumber value={p.case.cnjNumber} className="text-sm font-medium" />
            ) : (
              <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {cls?.tribunal ?? p.oab}
              </span>
            )}
            {cls?.tipoComunicacao && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {cls.tipoComunicacao}
              </span>
            )}
            {cls?.urgency && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${URGENCY_STYLE[cls.urgency]}`}>
                {cls.urgency}
              </span>
            )}
            {cls?.fatal && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                prazo fatal
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {fmt(p.publishedAt)} · OAB {p.oab}
            {cls?.label ? ` · ${cls.label}` : ''}
            {cls?.prazoFatal ? ` · fatal ${fmt(cls.prazoFatal)}` : ''}
          </p>
          {p.case && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <Scale className="h-3 w-3" /> {p.case.title}
            </p>
          )}
        </div>
        {p.status !== 'DISMISSED' && (
          <div className="flex shrink-0 items-center gap-1">
            {!p.caseId && (
              <button
                onClick={() => setLinking((v) => !v)}
                title="Vincular a processo"
                className="rounded-md p-1.5 text-primary hover:bg-primary/10"
              >
                <Link2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={dismiss}
              title="Descartar"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{p.rawContent}</p>

      {linking && <LinkToCase publicationId={p.id} onDone={() => { setLinking(false); onChange(); }} />}
    </div>
  );
}

function LinkToCase({ publicationId, onDone }: { publicationId: string; onDone: () => void }) {
  const [caseId, setCaseId] = useState('');
  const { data: cases = [] } = useQuery({
    queryKey: ['legal-cases', 'select'],
    queryFn: () => legalCasesService.list({ status: 'ACTIVE' }),
  });

  const link = async () => {
    if (!caseId) return;
    try {
      await djenService.link(publicationId, caseId);
      toast.success('Publicação vinculada (andamento criado)');
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao vincular');
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-800/50">
      <select
        value={caseId}
        onChange={(e) => setCaseId(e.target.value)}
        className="h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Selecione o processo…</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title} {c.cnjNumber ? `(${c.cnjNumber})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={link}
        disabled={!caseId}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        Vincular
      </button>
    </div>
  );
}
