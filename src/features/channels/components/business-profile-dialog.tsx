'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X, Camera } from 'lucide-react';
import {
  channelsService,
  type BusinessProfile,
  type Channel,
} from '../services/channels.service';

interface Props {
  channel: Channel | null;
  onClose: () => void;
}

const inputCls =
  'flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
const labelCls = 'text-sm font-medium text-zinc-700 dark:text-zinc-300';

// Categorias aceitas pela Cloud API (as mais comuns; advocacia = PROF_SERVICES).
const VERTICALS: { value: string; label: string }[] = [
  { value: 'PROF_SERVICES', label: 'Serviços profissionais' },
  { value: 'FINANCE', label: 'Finanças' },
  { value: 'EDU', label: 'Educação' },
  { value: 'HEALTH', label: 'Saúde' },
  { value: 'GOVT', label: 'Governo' },
  { value: 'NONPROFIT', label: 'Sem fins lucrativos' },
  { value: 'OTHER', label: 'Outro' },
];

export function BusinessProfileDialog({ channel, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [p, setP] = useState<BusinessProfile>({});
  const [site1, setSite1] = useState('');
  const [site2, setSite2] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!channel) return;
    setLoading(true);
    channelsService
      .getBusinessProfile(channel.id)
      .then((prof) => {
        setP(prof || {});
        setSite1(prof?.websites?.[0] ?? '');
        setSite2(prof?.websites?.[1] ?? '');
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : 'Erro ao carregar o perfil',
        ),
      )
      .finally(() => setLoading(false));
  }, [channel]);

  if (!channel) return null;

  const set = (k: keyof BusinessProfile, v: string) =>
    setP((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const websites = [site1.trim(), site2.trim()].filter(Boolean);
      const updated = await channelsService.updateBusinessProfile(channel.id, {
        about: p.about || undefined,
        address: p.address || undefined,
        description: p.description || undefined,
        email: p.email || undefined,
        vertical: p.vertical || undefined,
        websites: websites.length ? websites : undefined,
      });
      setP(updated);
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const updated = await channelsService.uploadBusinessProfilePicture(
        channel.id,
        file,
      );
      setP(updated);
      toast.success('Foto atualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar a foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Perfil comercial
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {channel.name} · {channel.config?.phoneNumber ?? channel.type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Foto */}
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                {p.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.profile_picture_url}
                    alt="Foto do perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  Trocar foto
                </button>
                <p className="mt-1 text-xs text-zinc-400">
                  JPG/PNG, quadrada, até 5MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhoto(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Recado (sobre)</label>
              <input
                className={inputCls}
                maxLength={139}
                value={p.about ?? ''}
                onChange={(e) => set('about', e.target.value)}
                placeholder="Ex.: Direito Bancário · Previdenciário · Trabalhista"
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Endereço</label>
              <input
                className={inputCls}
                value={p.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Rua, número, sala, cidade, CEP"
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Descrição</label>
              <textarea
                className={inputCls + ' h-24 py-2'}
                maxLength={512}
                value={p.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Sobre o escritório, áreas de atuação…"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelCls}>E-mail</label>
                <input
                  className={inputCls}
                  type="email"
                  value={p.email ?? ''}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="contato@escritorio.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Categoria</label>
                <select
                  className={inputCls}
                  value={p.vertical ?? ''}
                  onChange={(e) => set('vertical', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {VERTICALS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Site / link 1</label>
                <input
                  className={inputCls}
                  value={site1}
                  onChange={(e) => setSite1(e.target.value)}
                  placeholder="https://friderandrade.com.br"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Site / link 2</label>
                <input
                  className={inputCls}
                  value={site2}
                  onChange={(e) => setSite2(e.target.value)}
                  placeholder="https://instagram.com/…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Fechar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
