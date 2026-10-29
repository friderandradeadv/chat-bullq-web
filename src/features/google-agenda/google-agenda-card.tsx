'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, Plus, Unplug } from 'lucide-react';
import {
  googleAgendaService as svc,
  type AgendaDisponivel,
  type AgendaEscolhida,
  type ContaGoogle,
  type PapelAgenda,
} from './google-agenda.service';

// Conexão POR USUÁRIO: cada um liga as próprias contas Google (o advogado liga
// duas: a do escritório e a pessoal). Nada aqui é configuração da organização.

const RETORNO: Record<string, [string, 'ok' | 'erro']> = {
  conectada: ['Conta Google conectada. Agora escolha as agendas.', 'ok'],
  reconectada: ['Conta Google reconectada.', 'ok'],
  cancelado: ['Conexão cancelada na tela do Google.', 'erro'],
  'sem-permissao': ['A permissão da agenda ficou desmarcada na tela do Google. Conecte de novo e deixe a caixa marcada.', 'erro'],
  expirado: ['O link de conexão venceu (10 min). Clique em conectar de novo.', 'erro'],
  erro: ['Não consegui concluir a conexão com o Google.', 'erro'],
};

type Escolha = PapelAgenda | 'nao';

const OPCOES: Array<[Escolha, string]> = [
  ['nao', 'Não mostrar'],
  ['leitura', 'Só mostrar no hub'],
  ['escritorio', 'Escritório (recebe audiências, prazos…)'],
  ['pessoal', 'Pessoal (recebe compromissos pessoais)'],
];

export function GoogleAgendaCard() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const contasQ = useQuery({ queryKey: ['google-agenda', 'contas'], queryFn: svc.contas });
  const [conectando, setConectando] = useState(false);

  useEffect(() => {
    const r = params.get('gagenda');
    if (!r || !RETORNO[r]) return;
    const [msg, tom] = RETORNO[r];
    if (tom === 'ok') toast.success(msg);
    else toast.error(msg);
    qc.invalidateQueries({ queryKey: ['google-agenda'] });
  }, [params, qc]);

  async function conectar() {
    setConectando(true);
    try {
      const { url } = await svc.conectar();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui abrir a conexão com o Google.');
      setConectando(false);
    }
  }

  const contas = contasQ.data ?? [];

  return (
    <div id="google-agenda" className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Google Agenda</p>
            <p className="text-xs text-zinc-500">Só suas: as contas que você ligar aqui não valem para mais ninguém.</p>
          </div>
        </div>
        <button
          onClick={conectar}
          disabled={conectando}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {contas.length ? 'Conectar outra conta' : 'Conectar Google'}
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {contasQ.isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}
        {!contasQ.isLoading && contas.length === 0 && (
          <p className="text-sm text-zinc-500">
            Nenhuma conta ligada. Conecte a do escritório e, se quiser, a pessoal: o Google pergunta qual conta usar a cada vez.
          </p>
        )}
        {contas.map((c) => (
          <Conta key={c.id} conta={c} onChange={() => qc.invalidateQueries({ queryKey: ['google-agenda'] })} />
        ))}
        <p className="text-xs text-zinc-400">
          Nada é apagado em lado nenhum: compromisso removido no hub ganha “[CANCELADO NO HUB]” no Google, e o que você apagar no Google não volta.
          Compromissos das agendas pessoais aparecem para a equipe só como “Ocupado”.
        </p>
      </div>
    </div>
  );
}

function Conta({ conta, onChange }: { conta: ContaGoogle; onChange: () => void }) {
  const agendasQ = useQuery({ queryKey: ['google-agenda', 'agendas', conta.id], queryFn: () => svc.agendas(conta.id) });
  const [escolha, setEscolha] = useState<Record<string, Escolha>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const m: Record<string, Escolha> = {};
    for (const a of conta.calendars) m[a.id] = a.papel;
    setEscolha(m);
  }, [conta.calendars]);

  async function salvar(disponiveis: AgendaDisponivel[]) {
    const calendars: AgendaEscolhida[] = disponiveis
      .filter((a) => escolha[a.id] && escolha[a.id] !== 'nao')
      .map((a) => ({ id: a.id, summary: a.summary, papel: escolha[a.id] as PapelAgenda, color: a.color }));
    for (const papel of ['escritorio', 'pessoal'] as const) {
      if (calendars.filter((c) => c.papel === papel).length > 1) {
        return toast.error(`Só uma agenda pode ser ${papel === 'escritorio' ? 'de escritório' : 'pessoal'}.`);
      }
    }
    setSalvando(true);
    try {
      await svc.salvarAgendas(conta.id, calendars);
      toast.success('Agendas salvas');
      onChange();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function desconectar() {
    if (!confirm(`Desconectar ${conta.googleEmail}? Os eventos já enviados ficam no Google como estão.`)) return;
    try {
      await svc.desconectar(conta.id);
      onChange();
    } catch {
      toast.error('Não consegui desconectar.');
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {conta.googleEmail}
        </p>
        <button onClick={desconectar} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-600">
          <Unplug className="h-3.5 w-3.5" /> Desconectar
        </button>
      </div>
      {conta.lastError && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {conta.lastError}
        </p>
      )}
      {conta.lastSyncAt && (
        <p className="mt-1 text-xs text-zinc-400">Última conciliação: {new Date(conta.lastSyncAt).toLocaleString('pt-BR')}</p>
      )}

      {agendasQ.isLoading && <p className="mt-3 text-sm text-zinc-500">Lendo as agendas desta conta…</p>}
      {agendasQ.isError && <p className="mt-3 text-sm text-red-600">O Google não listou as agendas. Tente reconectar.</p>}
      {agendasQ.data && (
        <>
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {agendasQ.data.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color ?? '#94a3b8' }} />
                  <span className="truncate">{a.summary}</span>
                  {a.primaria && <span className="text-xs text-zinc-400">(principal)</span>}
                </span>
                <select
                  value={escolha[a.id] ?? 'nao'}
                  onChange={(e) => setEscolha((s) => ({ ...s, [a.id]: e.target.value as Escolha }))}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {OPCOES.filter(([v]) => a.podeEscrever || v === 'nao' || v === 'leitura').map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => salvar(agendasQ.data!)}
              disabled={salvando}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar agendas'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
