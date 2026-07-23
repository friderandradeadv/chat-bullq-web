'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { profileService } from '@/features/settings/services/profile.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { SimpleBarSettings } from '@/features/settings/components/simple-bar-settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PerfilPage() {
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const initials = (user?.name || '??').trim().slice(0, 2).toUpperCase();
  const dirty =
    name.trim() !== (user?.name ?? '') ||
    phone.trim() !== (user?.phone ?? '') ||
    email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem.'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Imagem muito grande (máx. 8MB).'); return; }
    setUploading(true);
    try {
      const { url } = await inboxService.uploadMedia(file);
      await profileService.updateProfile({ avatarUrl: url });
      setUser({ avatarUrl: url });
      toast.success('Foto atualizada!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao enviar a foto.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.avatarUrl) return;
    setUploading(true);
    try {
      await profileService.updateProfile({ avatarUrl: '' });
      setUser({ avatarUrl: null });
      toast.success('Foto removida.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao remover a foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInfo = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { toast.error('O nome não pode ficar vazio.'); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) { toast.error('Informe um e-mail válido.'); return; }
    const trimmedPhone = phone.trim();
    setSaving(true);
    try {
      await profileService.updateProfile({ name: trimmedName, phone: trimmedPhone, email: trimmedEmail });
      setUser({ name: trimmedName, phone: trimmedPhone, email: trimmedEmail });
      toast.success('Perfil atualizado!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePwd = async () => {
    if (!curPwd) { toast.error('Informe a senha atual.'); return; }
    if (newPwd.length < 6) { toast.error('A nova senha precisa ter ao menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { toast.error('A confirmação não bate com a nova senha.'); return; }
    if (newPwd === curPwd) { toast.error('A nova senha precisa ser diferente da atual.'); return; }
    setSavingPwd(true);
    try {
      await profileService.changePassword({ currentPassword: curPwd, newPassword: newPwd });
      toast.success('Senha alterada!');
      setCurPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao alterar a senha (confira a senha atual).');
    } finally {
      setSavingPwd(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-200 bg-white py-2.5 px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
  const btnCls =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50';
  const labelCls = 'text-xs font-medium text-zinc-500';

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Meu perfil</h1>
        <p className="mt-1 text-sm text-zinc-500">Foto, nome, e-mail, telefone e senha da sua conta.</p>

        {/* Foto + dados */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              title="Trocar foto"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-500">{initials}</span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.name}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
              <div className="mt-1 flex items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
                  {uploading ? 'Enviando…' : 'Trocar foto'}
                </button>
                {user?.avatarUrl && (
                  <button type="button" onClick={handleRemovePhoto} disabled={uploading} className="text-xs font-medium text-zinc-400 hover:text-red-500 hover:underline disabled:opacity-50">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="mt-3 space-y-1.5">
            <label className={labelCls}>E-mail</label>
            <input type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escritorio.com.br" maxLength={180} />
            <p className="text-[11px] text-zinc-400">É o e-mail que você usa para entrar no sistema.</p>
          </div>
          <div className="mt-3 space-y-1.5">
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 (44) 99999-9999" maxLength={30} />
          </div>
          <div className="mt-4 flex justify-end">
            <button className={btnCls} onClick={handleSaveInfo} disabled={saving || !dirty}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alterar senha</h2>
          <div className="mt-4 space-y-3">
            <input type="password" autoComplete="current-password" className={inputCls} placeholder="Senha atual" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                tabIndex={-1}
                title={showPwd ? 'Ocultar' : 'Mostrar'}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input type={showPwd ? 'text' : 'password'} autoComplete="new-password" className={inputCls} placeholder="Confirmar nova senha" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            {confirmPwd.length > 0 && newPwd !== confirmPwd && (
              <p className="text-[11px] text-red-500">As senhas não conferem.</p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button className={btnCls} onClick={handleChangePwd} disabled={savingPwd || !curPwd || !newPwd || !confirmPwd}>
              {savingPwd && <Loader2 className="h-4 w-4 animate-spin" />} Alterar senha
            </button>
          </div>
        </div>

        {/* Barra de atalhos do modo simples (o que exibir + ordem) */}
        <SimpleBarSettings />
      </div>
    </div>
  );
}
