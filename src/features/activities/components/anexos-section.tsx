'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, X, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { activitiesService, anexoHref, type ActivityAnexo } from '../services/activities.service';
import { DropZone } from '@/components/drop-zone';

const MAX_ARQUIVOS = 10;

const fmtTam = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Anexos da atividade (tarefa/prazo/evento) — guardados no metadata da própria
 * atividade e servidos pelo /uploads da API. Serve pra deixar o documento junto
 * do prazo (ex.: o acórdão no prazo de embargos) e usar depois.
 */
export function AnexosSection({ entityType, entityId }: { entityType: string; entityId: string }) {
  const q = useQuery({
    queryKey: ['activity-anexos', entityType, entityId],
    queryFn: () => activitiesService.listAnexos(entityType, entityId),
  });
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const anexos: ActivityAnexo[] = q.data ?? [];

  const subir = async (files: File[] | FileList | null) => {
    const todos = files ? Array.from(files) : [];
    if (!todos.length) return;
    const envio = todos.slice(0, MAX_ARQUIVOS);
    if (todos.length > MAX_ARQUIVOS) toast.info(`Muitos arquivos — enviei os primeiros ${MAX_ARQUIVOS}.`);
    setSubindo(true);
    try {
      await activitiesService.uploadAnexos(entityType, entityId, envio);
      toast.success(envio.length > 1 ? `${envio.length} anexos enviados` : 'Anexo enviado');
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui subir o anexo.');
    } finally {
      setSubindo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remover = async (a: ActivityAnexo) => {
    try {
      await activitiesService.removeAnexo(entityType, entityId, a.id);
      toast.success('Anexo removido');
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover o anexo');
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => subir(e.target.files)} />
      <DropZone onFiles={subir} disabled={subindo} overlayLabel="Solte os arquivos aqui">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={subindo}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#7048e8]/50 bg-[#7048e8]/5 px-3 py-2.5 text-sm font-medium text-[#7048e8] transition-colors hover:bg-[#7048e8]/10 disabled:opacity-60"
        >
          {subindo ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> enviando…</>
          ) : (
            <><Paperclip className="h-4 w-4" /> Anexar arquivo (ou arraste aqui)</>
          )}
        </button>
      </DropZone>

      {anexos.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-[#DEE2E6] px-2.5 py-1.5 dark:border-zinc-700"
            >
              <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
              <a
                href={anexoHref(a)}
                target="_blank"
                rel="noreferrer"
                title={a.name}
                className="min-w-0 flex-1 truncate text-sm text-[#228BE6] hover:underline"
              >
                {a.name}
              </a>
              <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{fmtTam(a.size)}</span>
              <button
                type="button"
                onClick={() => remover(a)}
                title="Remover anexo"
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !subindo && <p className="mt-2 text-xs text-zinc-400">Nenhum anexo ainda.</p>
      )}
    </div>
  );
}
