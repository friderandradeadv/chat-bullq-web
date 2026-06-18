'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { profileService } from '@/features/settings/services/profile.service';
import { inboxService } from '@/features/inbox/services/inbox.service';

export default function PerfilPage() {
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const initials = (user?.name || '??').trim().slice(0, 2).toUpperCase();

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem.'); return; }
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

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('O nome não pode ficar vazio.'); return; }
    const trimmedPhone = phone.trim();
    setSavingName(true);
    try {
      await profileService.updateProfile({ name: trimmed, phone: trimmedPhone });
      setUser({ name: trimmed, phone: trimmedPhone });
      toast.success('Perfil atualizado!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar o perfil.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePwd = async () => {
    if (newPwd.length < 6) { toast.error('A nova senha precisa ter ao menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { toast.error('A confirmação não bate com a nova senha.'); return; }
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

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Meu perfil</h1>
        <p className="mt-1 text-sm text-zinc-500">Foto, nome e senha da sua conta.</p>

        {/* Foto + nome */}
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
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 text-xs font-medium text-primary hover:underline disabled:opacity-50">
                {uploading ? 'Enviando…' : 'Trocar foto'}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Nome</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="mt-3 space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Telefone</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 (44) 99999-9999" maxLength={30} />
          </div>
          <div className="mt-3 space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">E-mail</label>
            <input className={`${inputCls} opacity-60`} value={user?.email ?? ''} disabled />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              className={btnCls}
              onClick={handleSaveName}
              disabled={savingName || (name.trim() === (user?.name ?? '') && phone.trim() === (user?.phone ?? ''))}
            >
              {savingName && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alterar senha</h2>
          <div className="mt-4 space-y-3">
            <input type="password" autoComplete="current-password" className={inputCls} placeholder="Senha atual" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
            <input type="password" autoComplete="new-password" className={inputCls} placeholder="Nova senha (mín. 6)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <input type="password" autoComplete="new-password" className={inputCls} placeholder="Confirmar nova senha" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
          <div className="mt-4 flex justify-end">
            <button className={btnCls} onClick={handleChangePwd} disabled={savingPwd || !curPwd || !newPwd || !confirmPwd}>
              {savingPwd && <Loader2 className="h-4 w-4 animate-spin" />} Alterar senha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
