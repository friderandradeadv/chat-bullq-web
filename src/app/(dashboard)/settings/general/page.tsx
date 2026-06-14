'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  officeProfileService,
  OFFICE_PROFILE_FIELDS,
  type OfficeProfile,
} from '@/features/settings/services/office-profile.service';

export default function SettingsGeneralPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['office-profile'],
    queryFn: () => officeProfileService.get(),
  });

  const [profile, setProfile] = useState<OfficeProfile>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setProfile(data);
  }, [data]);

  const setField = (key: keyof OfficeProfile, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await officeProfileService.update(profile);
      setProfile(saved);
      qc.invalidateQueries({ queryKey: ['office-profile'] });
      toast.success('Dados do escritório salvos');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao salvar';
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
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Geral</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Dados do escritório. Alimentam as variáveis dos agentes (
            <code className="rounded bg-zinc-100 px-1 text-[12px] dark:bg-zinc-800">@Nome do escritório</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 text-[12px] dark:bg-zinc-800">@CNPJ</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 text-[12px] dark:bg-zinc-800">@OAB</code>…).
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        {OFFICE_PROFILE_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {f.label}
            </span>
            <input
              value={profile[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {f.hint && <span className="mt-1 block text-[12px] text-zinc-400">{f.hint}</span>}
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
