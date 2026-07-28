'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  systemTextsService,
  SYSTEM_TEXT_FIELDS,
  type SystemTexts,
} from '@/features/settings/services/system-texts.service';

export default function SettingsSystemTextsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['system-texts'],
    queryFn: () => systemTextsService.get(),
  });

  const [texts, setTexts] = useState<SystemTexts>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setTexts(data);
  }, [data]);

  const setField = (key: keyof SystemTexts, value: string) =>
    setTexts((t) => ({ ...t, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await systemTextsService.update(texts);
      setTexts(saved);
      qc.invalidateQueries({ queryKey: ['system-texts'] });
      toast.success('Textos do sistema salvos');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Carregando…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <MessageSquareText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Textos do Sistema
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Mensagens automáticas do dia a dia. Editou e salvou, vale na próxima
            vez — sem depender de deploy. Deixe em branco para usar o texto
            padrão (mostrado em cinza no campo).
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        {SYSTEM_TEXT_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {f.label}
            </span>
            <textarea
              value={texts[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.rows}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <span className="mt-1 block text-[12px] text-zinc-400">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
