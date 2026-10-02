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

/**
 * Bipe curto de dois tons. Sem arquivo: nada para baixar, nada para faltar.
 *
 * 🚨 O DESTRAVE NÃO PODE SER `once`. A política de autoplay exige um gesto do
 * usuário antes de tocar — mas se o gesto acontecer ANTES desta faixa montar,
 * um ouvinte `{ once: true }` nunca dispara e o som fica mudo para sempre, sem
 * erro nenhum. Medido em 29/09/2026: o advogado nunca ouviu o bipe.
 * Aqui o contexto é criado na montagem (nasce suspenso, o que é permitido) e
 * QUALQUER interação depois o retoma — e cada bipe tenta retomar de novo.
 */
function usarBipe() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    const Ctx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : null;
    if (!Ctx) return;
    try {
      ctxRef.current = new Ctx();
      setLigado(ctxRef.current.state === 'running');
    } catch {
      return;
    }
    const destravar = () => {
      const c = ctxRef.current;
      if (!c) return;
      void c.resume().then(() => setLigado(c.state === 'running')).catch(() => undefined);
    };
    // 🚨 SEM `once`: o usuário pode interagir muitas vezes antes de existir som
    // para tocar, e qualquer uma delas serve para destravar.
    const eventos = ['pointerdown', 'keydown', 'click', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, destravar, { passive: true }));
    destravar();
    return () => eventos.forEach((e) => window.removeEventListener(e, destravar));
  }, []);

  const tocar = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const soar = () => {
      const agora = ctx.currentTime;
      [0, 0.22].forEach((atraso, i) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1174; // lá → ré
        vol.gain.setValueAtTime(0.0001, agora + atraso);
        vol.gain.exponentialRampToValueAtTime(0.25, agora + atraso + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.2);
        osc.connect(vol).connect(ctx.destination);
        osc.start(agora + atraso);
        osc.stop(agora + atraso + 0.22);
      });
    };
    if (ctx.state === 'running') { soar(); return; }
    // suspenso: tenta retomar AGORA e tocar em seguida
    void ctx.resume().then(() => { setLigado(true); soar(); }).catch(() => undefined);
  }, []);

  return { tocar, ligado };
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
  const { tocar: bipar, ligado: somLiberado } = usarBipe();
  const [mudo, setMudo] = useState(false);

  // 🚨 O SILÊNCIO TEM DE GRUDAR. A versão anterior religava o som sozinha toda
  // vez que a lista mudava ("peça nova merece tocar"), o que na prática desfazia
  // o botão de silenciar do advogado minutos depois de ele apertá-lo. Botão que
  // não obedece é pior que botão nenhum. Agora: silenciou, fica silenciado, e
  // atravessa recarregamento de página.
  useEffect(() => {
    try { setMudo(window.localStorage.getItem('faixa-assinatura-mudo') === '1'); } catch { /* sem storage: segue com som */ }
  }, []);
  const alternarMudo = useCallback(() => {
    setMudo((m) => {
      const novo = !m;
      try { window.localStorage.setItem('faixa-assinatura-mudo', novo ? '1' : '0'); } catch { /* ok */ }
      return novo;
    });
  }, []);

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

  // 🚨 TOCA UMA VEZ POR PEÇA NOVA, E SÓ — E "NOVA" É POR IDENTIDADE, NÃO POR
  // "A LISTA MUDOU". A primeira versão repetia a cada 25s enquanto houvesse peça
  // esperando: com quatro peças na fila virou um bipe a cada 25 segundos, a
  // noite inteira ("o hub fica apitando o tempo todo", 29/09/2026). A segunda
  // tocava quando a CHAVE mudava — mas a chave é a lista de ids concatenada, de
  // modo que uma peça mudando de estado, entrando ou saindo refazia a chave e
  // tocava de novo, ainda que nada de novo tivesse chegado.
  // Aqui a conta é a certa: guardo os ids que já tocaram e só bipo por id que
  // nunca tocou. Id que sai da lista é esquecido, para que a MESMA peça, se
  // voltar depois de uma remontagem, volte a avisar.
  const jaTocou = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (mudo) return;
    const atuais = new Set(itens.map((i) => i.caseId));
    jaTocou.current.forEach((id) => { if (!atuais.has(id)) jaTocou.current.delete(id); });
    const novos = itens.filter((i) => !jaTocou.current.has(i.caseId));
    if (novos.length === 0) return;
    novos.forEach((i) => jaTocou.current.add(i.caseId));
    bipar();
  }, [itens, mudo, bipar]);

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
  // 🚨 O BOTÃO ABRE NO NAVEGADOR PADRÃO, E ISSO TEM DE ESTAR NO NOME
  // (01/10/2026). Ele se chamava "Abrir a tela", e o advogado leu, com razão,
  // que levaria à tela ONDE O AGENTE ESTÁ TRABALHANDO. Não leva: página web não
  // dá foco à janela de outro aplicativo, então o clique cai no navegador
  // padrão — que não tem a sessão do PJe e mostra a tela de login.
  //
  // Quem resolve a tela certa é o agente, que traz a própria janela para a
  // frente ao pedir a assinatura. Este botão continua útil para olhar o
  // processo de OUTRA máquina, e agora o nome promete só isso.
  // 🚨 O NOME DO SISTEMA VEM DA PEÇA, NÃO DO MEU HÁBITO (02/10/2026). Cravei
  // "PJe" aqui ontem à noite, quando só existia PJe. Hoje Minas protocola no
  // eproc, e a faixa ficou dizendo "eproc/TJMG" de um lado e "Ver no PJe" do
  // outro — o mesmo erro de cravar tribunal que já tinha mandado o advogado
  // para o foro errado uma vez. Quem sabe o sistema é o item.
  const ondeNome = primeiro.sistema || 'PJe';
  const acao = pronta ? `Protocolar no ${ondeNome}` : `Ver no ${ondeNome}`;
  const explicacao = 'Abre no seu navegador padrão, onde pode ser preciso entrar de novo. '
    + 'Na máquina do agente a janela certa já vem para a frente sozinha.';

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
            title={explicacao}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {acao}
          </a>
        )}

        <button
          type="button"
          onClick={alternarMudo}
          title={
            mudo
              ? 'Som desligado — clique para ligar'
              : somLiberado
                ? 'Som ligado — clique para silenciar'
                : 'O navegador ainda não liberou o som; clique em qualquer lugar da página'
          }
          className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
        >
          {mudo || !somLiberado ? (
            <VolumeX className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
