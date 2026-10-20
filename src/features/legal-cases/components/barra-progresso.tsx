'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, AlertTriangle, Square } from 'lucide-react';
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
export const OK_QUE_ESPERA = new Set(['protocolo']);

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
export const JANELA_DO_OK_MS = 2 * 60 * 1000;

/**
 * Por quanto tempo uma RECUSA fica na tela.
 *
 * 🚨 ERRO TAMBÉM ENVELHECE (01/10/2026). A regra era "o erro FICA", para a
 * recusa sobreviver ao recarregamento — e sobreviveu demais: o card da LINDOMAR
 * exibia barra vermelha "Protocolando · esta peça é de CRUZEIRO DO OESTE/PR" de
 * 29/09, dois dias depois, sem nada rodando. O advogado apontou: "lindomar não
 * iniciamos nada, não é pra ter barra de progresso".
 *
 * Um dia é tempo de sobra para quem clicou ver por que não saiu. Passado isso,
 * barra vermelha num card parado só mente sobre atividade — e o motivo não se
 * perde: cada recusa vira movimento no histórico do card.
 */
export const JANELA_DO_ERRO_MS = 24 * 60 * 60 * 1000;

/**
 * QUANTO TEMPO SEM NOTÍCIA ANTES DE CHAMAR DE TRAVADO.
 *
 * 🚨 "TRAVADO É INDISTINGUÍVEL DE TRABALHANDO" era o defeito que a barra veio
 * resolver, e ela o reintroduziu por outro caminho (20/10/2026): outra sessão
 * reiniciou a API no meio de uma montagem, o `catch` que marca erro nunca
 * rodou, e o card do JOSÉ BATISTA ficou girando em "organizando a pasta no
 * Drive" para sempre. Processo morto não escreve "erro": simplesmente para de
 * escrever.
 *
 * Então o silêncio passa a ser o sinal. Três minutos é folgado de propósito: a
 * cópia da pasta no Drive é o passo mais longo e narra pouco, e chamar de
 * travado o que ainda trabalha seria o erro inverso.
 */
export const SEM_NOTICIA_MS = 3 * 60 * 1000;

export function pareceTravado(p: Progresso): boolean {
  if (p.status !== 'rodando') return false;
  const quando = Date.parse(p.em ?? '');
  return Number.isFinite(quando) && Date.now() - quando > SEM_NOTICIA_MS;
}

export const NOME: Record<string, string> = {
  documentos: 'Preparando documentos',
  inicial: 'Montando a inicial',
  protocolo: 'Protocolando',
  coleta: 'Coletando no Meu INSS',
  // Ler os autos é leitura, não peticionamento — o rótulo diz exatamente isso.
  replica: 'Lendo os autos',
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
  useRelogio(!!p);
  if (!p || !aindaTemOQueDizer(p)) return null;
  return <BarraProgressoView p={p} compacta={compacta} caseId={caseId} />;
}

/**
 * UM RELÓGIO QUE REDESENHA.
 *
 * 🚨 SEM ELE, A BARRA NUNCA SOME SOZINHA — e foi o que ele apontou em
 * 20/10/2026: *"o aviso ainda não some sozinho, só se eu clico no x"*.
 *
 * A regra de esconder depende do TEMPO (o `ok` vale 2 minutos), mas quem
 * decide redesenhar é o React. O react-query refaz a consulta a cada 15s e,
 * vindo o MESMO dado, ele mantém a referência (structural sharing) e **não**
 * re-renderiza. Resultado: `aindaTemOQueDizer` só era reavaliado quando algo
 * mudava no servidor — e um `ok` parado não muda nunca.
 *
 * Então o componente passa a ter batida própria enquanto tem algo na tela.
 * Parada quando não há o que mostrar: relógio que bate em tela vazia é gasto
 * sem dono.
 */
function useRelogio(ativo: boolean, ms = 15000) {
  const [, bater] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => bater((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ativo, ms]);
}


/**
 * A BARRA AINDA TEM O QUE DIZER?
 *
 * 🚨 ESTA REGRA ERA SOLTA DENTRO DO COMPONENTE, e o visor flutuante precisaria
 * repeti-la — duas cópias da mesma decisão envelhecem separadas, e um dia uma
 * mostra o que a outra esconde. Está aqui para ter um dono só.
 */
export { useRelogio };

export function aindaTemOQueDizer(p: Progresso): boolean {
  if (p.status === 'ok' && !OK_QUE_ESPERA.has(p.op)) {
    const quando = Date.parse(p.em ?? '');
    return Number.isFinite(quando) && Date.now() - quando <= JANELA_DO_OK_MS;
  }
  if (p.status === 'erro') {
    const quando = Date.parse(p.em ?? '');
    return Number.isFinite(quando) && Date.now() - quando <= JANELA_DO_ERRO_MS;
  }
  return true;
}

/**
 * O DESENHO DA BARRA, SEM BUSCAR NADA.
 *
 * 🚨 SEPARADO DA BUSCA de propósito (19/10/2026): o visor flutuante recebe os
 * dados de UMA consulta da organização inteira e desenha com este mesmo
 * componente. Se ele tivesse o próprio desenho, o hub passaria a ter duas
 * barras parecidas e diferentes — que é justo o que o comentário lá em cima
 * manda não fazer.
 */
export function BarraProgressoView({
  p,
  compacta = false,
  caseId,
}: {
  p: Progresso;
  compacta?: boolean;
  /** Sem ele não há botão de parar: a view continua servindo para só desenhar. */
  caseId?: string;
}) {
  const titulo = NOME[p.op] ?? 'Trabalhando';
  const rodando = p.status === 'rodando';
  const travado = pareceTravado(p);
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

        {/* 🚨 ERRO NÃO CABE EM UMA LINHA, E CORTADO NÃO ENSINA NADA (01/10/2026).
            O advogado fechou o Chrome de propósito para testar e o card mostrou
            "PAREI: SESSAO_CAIDA: a janela do agente não a…" — truncado no meio,
            em dialeto de máquina, sem dizer o que fazer. Pedido dele: "você tem
            que me mostrar no hub como recuperar, entrar o acesso".
            O passo normal continua truncado (é uma linha de progresso); o ERRO
            sai inteiro, abaixo, com espaço para a instrução. */}
        <span className={`${compacta ? 'text-[11px]' : 'text-xs'} flex-1 truncate text-neutral-600 dark:text-neutral-400`}>
          · {erro ? 'o agente parou' : p.passo}
        </span>

        {pct != null && (
          <span className={`${compacta ? 'text-[11px]' : 'text-xs'} tabular-nums font-semibold text-neutral-700 dark:text-neutral-200`}>
            {pct}%
          </span>
        )}
        {pct == null && p.total == null && p.n != null && (
          <span className="text-[11px] tabular-nums text-neutral-500">{p.n}</span>
        )}

        {rodando && caseId && <BotaoParar caseId={caseId} travado={travado} />}
      </div>

      {/* 🚨 DIZER QUE PARECE TRAVADO, EM VEZ DE SEGUIR GIRANDO. Girar para
          sempre é mentira sobre atividade, e foi o que aconteceu quando a API
          reiniciou no meio da montagem. */}
      {travado && (
        <p className={`${compacta ? 'text-[11px]' : 'text-xs'} mt-1 leading-snug text-amber-700 dark:text-amber-400`}>
          Sem notícia há alguns minutos. Pode ter parado sozinho: use Parar para
          destravar o card e montar de novo.
        </p>
      )}

      {erro && p.erro && (
        <p className={`${compacta ? 'text-[11px]' : 'text-xs'} mt-1 whitespace-pre-line leading-snug text-red-700 dark:text-red-300`}>
          {p.erro}
        </p>
      )}

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

/**
 * O BOTÃO DE PARAR.
 *
 * 🚨 DOIS CLIQUES, E NÃO UM MODAL. Parar no meio custa os minutos da montagem
 * inteira, e um clique sem querer na barra de um card é fácil demais. O
 * segundo clique confirma na própria barra, sem abrir caixa de diálogo, que no
 * meio de uma esteira é mais atrapalho que proteção.
 *
 * 🚨 E O QUE ELE NÃO FAZ. Não apaga a peça anterior do card, não desfaz pasta
 * no Drive e não mata passo pela metade: a API grava o pedido e a montagem
 * para sozinha no próximo ponto de checagem, entre passos. Quando a operação
 * já morreu por fora, não há quem leia o pedido, e aí o efeito é justamente o
 * que se quer: a barra sai e o card destrava.
 */
function BotaoParar({ caseId, travado }: { caseId: string; travado: boolean }) {
  const [armado, setArmado] = useState(false);
  const qc = useQueryClient();

  const parar = useMutation({
    mutationFn: async () => {
      // 🚨 `parar-operacao`, NÃO `progresso/parar` (20/10/2026). Aquela rota
      // vive no controller guardado por chave de API, que é a porta do agente
      // do Mac: do navegador ela responde 401. O clique "não fazia nada", e
      // sem o aviso de erro aqui embaixo ninguém descobriria por quê.
      const { data } = await api.post(`/legal-cases/${caseId}/parar-operacao`);
      return data;
    },
    onSuccess: () => setArmado(false),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['legal-cases', caseId, 'progresso'] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      qc.invalidateQueries({ queryKey: ['progresso-ativos'] });
    },
  });

  if (parar.isPending) {
    return <span className="text-[11px] text-neutral-500">parando…</span>;
  }

  // 🚨 BOTÃO QUE FALHA CALADO É BOTÃO QUEBRADO. A primeira versão engolia o
  // erro no `onSettled` e voltava a desenhar "Parar": clicar e nada acontecer
  // é indistinguível de botão que não existe.
  if (parar.isError) {
    const st = (parar.error as any)?.response?.status;
    return (
      <button
        type="button"
        onClick={() => parar.reset()}
        title={String((parar.error as any)?.message ?? '')}
        className="flex flex-shrink-0 items-center gap-1 rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        <AlertTriangle className="h-3 w-3" />
        não consegui parar{st ? ` (${st})` : ''}
      </button>
    );
  }

  if (armado) {
    return (
      <span className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => parar.mutate()}
          className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setArmado(false)}
          className="rounded px-1 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          não
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      title="Parar esta operação e destravar o card"
      onClick={() => setArmado(true)}
      className={`flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
        travado
          ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
          : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
      }`}
    >
      <Square className="h-3 w-3" />
      Parar
    </button>
  );
}
