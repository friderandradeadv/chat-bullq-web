'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export type Progresso = {
  op: 'documentos' | 'inicial' | 'protocolo' | 'coleta' | string;
  passo: string;
  n: number | null;
  total: number | null;
  pct: number | null;
  status: 'rodando' | 'ok' | 'erro' | string;
  erro: string | null;
  em: string;
};

/**
 * OPERAÇÕES CUJO `ok` É ESPERA, NÃO FIM.
 *
 * 🚨 A barra é ESTADO do card, não histórico. Terminou bem e nada mais depende
 * de ninguém? Não há o que mostrar — some. O escritório apontou em 30/09/2026
 * dois cards da ANTÔNIA parados em MONTAR INICIAL exibindo "100% · passo 5 de 5"
 * com tique verde, de uma montagem do dia anterior: "não pedi pra montar e ficou
 * com o card de progresso". Barra acesa em card em que ninguém clicou faz o
 * quadro mentir sobre o que o robô está fazendo AGORA.
 *
 * O PROTOCOLO é a exceção, e é por isso que esta lista existe em vez de um
 * simples `status !== 'ok'`: lá o `ok` quer dizer "esperando sua assinatura"
 * (frider-protocolo/hub.js), ou seja, a bola está com o advogado e o aviso tem
 * de ficar à vista até ele assinar — pode levar horas.
 *
 * Distinguir pela OPERAÇÃO, nunca pelo texto do passo: a frase muda, e casar
 * por substring quebraria calado no dia em que alguém a reescrevesse.
 */
const OK_QUE_ESPERA = new Set(['protocolo']);

/**
 * Por quanto tempo um `ok` que não espera ninguém continua na tela.
 *
 * 🚨 NÃO ESCONDER O `ok` DE VEZ (30/09/2026, mesma noite). Esconder sempre
 * apagou a barra no trecho mais longo da montagem: `gerarInicial` fecha em "ok"
 * e a cópia da pasta no Drive leva MINUTOS depois disso. O escritório rodou dois
 * cards e perguntou "cadê o cardzinho de progresso" — com o robô trabalhando.
 *
 * O fantasma que motivou o esconde-`ok` era de OUTRO tipo: um `ok` do dia
 * anterior, num card arrastado de volta para MONTAR INICIAL. Esse caso hoje é
 * impossível por outra via — mudar de fase apaga o registro, na API. Sobra só o
 * `ok` de um card que termina e NÃO se move (a fase falhou), e é esse que a
 * janela cobre: aparece, cumpre o papel de dizer que acabou, e sai.
 */
const JANELA_DO_OK_MS = 2 * 60 * 1000;

const NOME: Record<string, string> = {
  documentos: 'Preparando documentos',
  inicial: 'Montando a inicial',
  protocolo: 'Protocolando',
  coleta: 'Coletando no Meu INSS',
  // 🚨 'Protocolando' É PALAVRA SÉRIA — protocolar é ato do advogado, nunca da
  // máquina. Em 30/09/2026 a recusa de um PDF na conferência foi gravada como
  // `op: 'protocolo'` e o card exibiu "Protocolando · na cidade de" em
  // vermelho. O escritório leu que o robô estava peticionando sozinho. Nada
  // estava: era conferência. Rótulo que assusta é defeito, ainda que o dado
  // por baixo esteja certo.
  conferencia: 'Conferência da peça',
};

/**
 * BARRA DE PROGRESSO DAS OPERAÇÕES LONGAS.
 *
 * 🚨 POR QUE EXISTE. Antes, entre o clique e o resultado o card ficava imóvel
 * por minutos — e imóvel não distingue "trabalhando" de "travado". A coleta já
 * narrava por texto num toast; o escritório pediu em 29/09/2026 barra com
 * porcentagem, e nas TRÊS operações (documentos, inicial, protocolo).
 *
 * 🚨 SEM `pct` A BARRA NÃO FINGE. Quando a operação não sabe quantos passos tem,
 * mostra-se uma faixa em movimento, não uma barra parada em número inventado:
 * barra que mente sobre "quanto falta" é pior que barra nenhuma.
 *
 * Ela se atualiza sozinha enquanto está rodando (3s), e para de consultar assim
 * que termina — não fica batendo no servidor à toa.
 */
export function BarraProgresso({
  caseId,
  inicial,
  compacta = false,
}: {
  caseId: string;
  inicial?: Progresso | null;
  compacta?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['legal-cases', caseId, 'progresso'],
    queryFn: async (): Promise<Progresso | null> => {
      const { data } = await api.get(`/legal-cases/${caseId}`);
      const c = data?.data ?? data;
      return ((c?.metadata as any)?.progresso ?? null) as Progresso | null;
    },
    // 🚨 `initialData: null` NÃO É "sem dado inicial": para o react-query, null é
    // um dado já carregado e fresco, então a primeira busca NUNCA acontece. O
    // sintoma medido em 29/09/2026: a barra só aparecia no card depois que o
    // advogado abria o card uma vez (o que remonta o componente). `undefined` é
    // o valor que significa "não tenho nada, vá buscar".
    initialData: inicial ?? undefined,
    // 🚨 E PRECISA INSISTIR MESMO PARADA. Antes só repetia com status
    // 'rodando' — ou seja, uma operação que COMEÇASSE depois da tela aberta
    // jamais apareceria, que é justo o caso de quem pede "quero ver trabalhando".
    // Também não é terminal o 'ok' em "esperando sua assinatura": o vigia muda
    // esse estado minutos depois, quando o advogado assina.
    refetchInterval: (q) => {
      const d = q.state.data as Progresso | null | undefined;
      if (d?.status === 'rodando') return 3000;
      // 🚨 8s SEM DADO, não 20s: é a janela em que o advogado acabou de clicar e
      // está olhando a tela esperando o agente aparecer.
      return d ? 10000 : 8000;
    },
    staleTime: 1500,
  });

  const p = data;
  if (!p) return null;
  // Concluído, sem ninguém esperando e já VELHO → a barra não tem o que dizer.
  // (O erro FICA: recusa tem de sobreviver ao recarregamento, que é o motivo de
  // ela existir em vermelho.)
  if (p.status === 'ok' && !OK_QUE_ESPERA.has(p.op)) {
    const quando = Date.parse(p.em ?? '');
    if (!Number.isFinite(quando) || Date.now() - quando > JANELA_DO_OK_MS) return null;
  }

  const titulo = NOME[p.op] ?? 'Trabalhando';
  const rodando = p.status === 'rodando';
  const erro = p.status === 'erro';
  const pct = typeof p.pct === 'number' ? p.pct : null;

  const cor = erro
    ? 'bg-red-500'
    : p.status === 'ok'
      ? 'bg-emerald-500'
      : 'bg-blue-500';

  return (
    <div
      className={
        compacta
          ? 'rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900/60'
          : 'rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60'
      }
    >
      <div className="flex items-center gap-2">
        {erro ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
        ) : p.status === 'ok' ? (
          <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-blue-500" />
        )}

        <span className={`${compacta ? 'text-[11px]' : 'text-xs'} font-medium text-neutral-800 dark:text-neutral-100`}>
          {titulo}
        </span>

        <span className={`${compacta ? 'text-[11px]' : 'text-xs'} flex-1 truncate text-neutral-600 dark:text-neutral-400`}>
          · {erro ? p.erro || 'falhou' : p.passo}
        </span>

        {pct != null && (
          <span className={`${compacta ? 'text-[11px]' : 'text-xs'} tabular-nums font-semibold text-neutral-700 dark:text-neutral-200`}>
            {pct}%
          </span>
        )}
        {pct == null && p.total == null && p.n != null && (
          <span className="text-[11px] tabular-nums text-neutral-500">{p.n}</span>
        )}
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        {pct != null ? (
          <div
            className={`h-full rounded-full ${cor} transition-[width] duration-500 ease-out`}
            style={{ width: `${pct}%` }}
          />
        ) : (
          // sem total conhecido: faixa pulsando, sem número inventado
          <div className={`h-full w-1/3 rounded-full ${cor} ${rodando ? 'animate-pulse' : ''}`} />
        )}
      </div>

      {p.n != null && p.total != null && (
        <div className="mt-1 text-[11px] tabular-nums text-neutral-500">
          passo {p.n} de {p.total}
        </div>
      )}

    </div>
  );
}
