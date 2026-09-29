'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PenLine, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Aguardando = {
  caseId: string;
  titulo: string;
  estado?: 'aguardando_assinatura' | 'aguardando_protocolo';
  sistema: string | null;
  tribunal: string | null;
  url: string | null;
  documentos: number | null;
  desde: string | null;
};

/**
 * A FAIXA QUE AVISA QUE UMA PEÇA ESPERA A SUA ASSINATURA.
 *
 * 🚨 POR QUE COM SOM. No protocolo com certificado A3 a rotina monta o processo
 * inteiro no sistema do tribunal e PARA na assinatura, porque o token e o PIN
 * são do advogado. Pedido do escritório em 28/09/2026, no primeiro protocolo
 * PJe/TJCE: "preciso que o hub dispare um aviso, algo até com som, para eu saber
 * que preciso assinar, ou abrir a tela direto". Sem isso, automatizar o
 * protocolo só troca "digitar tudo" por "ficar olhando a tela".
 *
 * O aviso já sai também por notificação (websocket + Web Push, que alcança o
 * celular com o hub fechado) — quem cuida disso é `ProtocoloAssinaturaService`
 * na API. Esta faixa é o canal de quem está COM o hub aberto, e é a única que
 * toca som: push com som depende do sistema operacional.
 *
 * 🚨 O NAVEGADOR SÓ DEIXA TOCAR DEPOIS DE UM CLIQUE NA PÁGINA. Por isso o
 * AudioContext é destravado no primeiro gesto do usuário, e não na montagem: sem
 * isso o primeiro bipe do dia sairia mudo, sem erro nenhum.
 */

/** Bipe curto de dois tons. Sem arquivo: nada para baixar, nada para faltar. */
function usarBipe() {
  const ctxRef = useRef<AudioContext | null>(null);

  // destrava no primeiro gesto (política de autoplay)
  useEffect(() => {
    const destravar = () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return;
        if (!ctxRef.current) ctxRef.current = new Ctx();
        void ctxRef.current.resume();
      } catch {
        /* navegador sem áudio: a faixa continua valendo, só não toca */
      }
    };
    window.addEventListener('pointerdown', destravar, { once: true });
    window.addEventListener('keydown', destravar, { once: true });
    return () => {
      window.removeEventListener('pointerdown', destravar);
      window.removeEventListener('keydown', destravar);
    };
  }, []);

  return useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const agora = ctx.currentTime;
    [0, 0.22].forEach((atraso, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1174; // lá → ré
      vol.gain.setValueAtTime(0.0001, agora + atraso);
      vol.gain.exponentialRampToValueAtTime(0.18, agora + atraso + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.18);
      osc.connect(vol).connect(ctx.destination);
      osc.start(agora + atraso);
      osc.stop(agora + atraso + 0.2);
    });
  }, []);
}

function haQuantoTempo(iso: string | null): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
}

export function AssinaturaBanner() {
  const user = useAuthStore((s) => s.user);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const bipar = usarBipe();
  const [mudo, setMudo] = useState(false);
  const jaAvisado = useRef<string>('');

  const { data } = useQuery({
    queryKey: ['legal-cases', 'protocolo', 'aguardando', activeOrgId],
    queryFn: async (): Promise<Aguardando[]> => {
      const { data } = await api.get('/legal-cases/protocolo/aguardando');
      return (data?.data ?? data ?? []) as Aguardando[];
    },
    enabled: !!user && !!activeOrgId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const itens = useMemo(() => data ?? [], [data]);
  const chave = useMemo(() => itens.map((i) => i.caseId).join(','), [itens]);

  // Peça NOVA na fila volta a tocar mesmo se você tinha silenciado a anterior:
  // silenciar vale para o que você já viu, não para o que chegou depois.
  useEffect(() => {
    if (chave && chave !== jaAvisado.current) {
      jaAvisado.current = chave;
      setMudo(false);
    }
  }, [chave]);

  // Toca na hora e repete enquanto ninguém assina. 25s é insistente sem virar
  // tortura — e a faixa continua na tela de qualquer jeito.
  useEffect(() => {
    if (itens.length === 0 || mudo) return;
    bipar();
    const t = setInterval(bipar, 25_000);
    return () => clearInterval(t);
  }, [itens.length, mudo, bipar]);

  if (itens.length === 0) return null;

  const primeiro = itens[0];
  const onde = [primeiro.sistema, primeiro.tribunal].filter(Boolean).join('/');

  // 🚨 DOIS ESTADOS, DOIS RECADOS. Com um só, a faixa pedia assinatura de peça
  // já assinada — e recado errado é pior que recado nenhum, porque ensina a
  // ignorar a faixa. Pedido do escritório em 29/09/2026.
  const pronta = primeiro.estado === 'aguardando_protocolo';
  const titulo = itens.length === 1
    ? (pronta ? 'Pronta para protocolar' : 'Assinar para protocolar')
    : `${itens.length} peças esperando você`;
  const acao = pronta ? 'Protocolar' : 'Abrir a tela';

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-6 py-2.5 dark:border-amber-800/60 dark:bg-amber-900/25">
      <div className="flex items-center gap-3">
        <PenLine className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-400" />

        <div className="flex-1 text-sm text-amber-900 dark:text-amber-100">
          <span className="font-semibold">{titulo}</span>
          <span className="ml-2 text-amber-800 dark:text-amber-200">
            · {primeiro.titulo}
            {onde ? ` · ${onde}` : ''}
            {primeiro.documentos ? ` · ${primeiro.documentos} documentos` : ''}
            {primeiro.desde ? ` · ${haQuantoTempo(primeiro.desde)}` : ''}
          </span>
        </div>

        {primeiro.url && (
          <a
            href={primeiro.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {acao}
          </a>
        )}

        <button
          type="button"
          onClick={() => setMudo((m) => !m)}
          title={mudo ? 'Voltar a tocar' : 'Silenciar (a faixa continua)'}
          className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
        >
          {mudo ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
