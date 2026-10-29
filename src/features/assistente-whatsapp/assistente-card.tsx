'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { channelsService } from '@/features/channels/services/channels.service';

// Assistente no WhatsApp: o advogado manda recado do PRÓPRIO celular para um
// número do escritório e o hub responde o rascunho; só cria depois do SIM.
// Configuração por usuário: cada um liga o seu celular.

interface Config { channelId: string; telefone: string; ativo: boolean }
const un = <T,>(d: any): T => (d?.data ?? d) as T;

export function AssistenteWhatsappCard() {
  const qc = useQueryClient();
  const cfgQ = useQuery({
    queryKey: ['assistente-whatsapp', 'config'],
    queryFn: async () => un<{ config: Config | null; telefoneDoPerfil: string | null }>((await api.get('/assistente-whatsapp/config')).data),
    retry: false,
  });
  const canaisQ = useQuery({ queryKey: ['channels'], queryFn: () => channelsService.list() });
  const [channelId, setChannelId] = useState('');
  const [telefone, setTelefone] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!cfgQ.data) return;
    setChannelId(cfgQ.data.config?.channelId ?? '');
    setTelefone(cfgQ.data.config?.telefone ?? cfgQ.data.telefoneDoPerfil ?? '');
    setAtivo(cfgQ.data.config?.ativo ?? true);
  }, [cfgQ.data]);

  const canais = (canaisQ.data ?? []).filter((c) => String(c.type).startsWith('WHATSAPP'));

  async function salvar() {
    if (!channelId) return toast.error('Escolha o número do escritório.');
    if (telefone.replace(/\D/g, '').length < 10) return toast.error('Informe o seu celular com DDD.');
    setSalvando(true);
    try {
      await api.put('/assistente-whatsapp/config', { channelId, telefone, ativo });
      toast.success(ativo ? 'Assistente ligado. Mande um recado para testar.' : 'Assistente desligado.');
      qc.invalidateQueries({ queryKey: ['assistente-whatsapp'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
  return (
    <div id="assistente-whatsapp" className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
          <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Assistente no WhatsApp</p>
          <p className="text-xs text-zinc-500">Mande recado, áudio ou print do seu celular; o hub responde e só cria depois do seu SIM.</p>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Número do escritório que recebe os recados
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inp}>
            <option value="">Escolha…</option>
            {canais.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          O seu celular (de onde você vai mandar)
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(87) 99999-9999" inputMode="tel" className={inp} />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ligado
        </label>
        <p className="text-xs text-zinc-400">
          Só mensagens deste celular, neste número, viram recado; clientes e os outros números seguem como sempre.
          PDF enviado por você continua indo para o recebedor de protocolo. O rascunho vale 30 minutos; responda SIM, mande a correção, ou NÃO para cancelar.
        </p>
        <div className="flex justify-end">
          <button onClick={salvar} disabled={salvando} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
