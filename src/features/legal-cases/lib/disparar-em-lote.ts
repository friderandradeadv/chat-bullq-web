/**
 * 🚨🚨 O DISPARO EM LOTE DA CAMPANHA (09/11/2026).
 *
 * Ordem do escritório: *"faz o botão, propõe o ritmo e o teto"*, depois de
 * medido que são 107 ofertas e que cada uma sai em 6 a 7 bolhas — cerca de 650
 * saídas de um número só, se tudo for clicado no mesmo dia.
 *
 * ⚠️⚠️ LEIA ANTES DE MEXER — E A VERSÃO CURTA JÁ CORRIGIDA (09/11/2026).
 *
 * O cabeçalho do `refin-board.tsx`, de 28/10/2026, dizia que "a inicial contra
 * a Meta afirma ao juízo que os scripts de envio em lote saíram de operação".
 * **Conferido nas peças: a inicial não afirma isso.** O que a réplica de
 * 03/11/2026 afirma, rebatendo a hipótese "envio de mensagens em massa não
 * autorizadas", é: *"conversas iniciadas pelo cliente em 86,3% e 89,6% dos
 * casos; 45 iniciadas pela Autora ao todo"* — números do painel da própria
 * Meta, das contas da API oficial (portfólio 417858283638509, número
 * (44) 99157-4212, `quality_rating` GREEN).
 *
 * Este laço dispara pelo canal **RMC/RCC, número 554491747315**, em Evolution,
 * sem `appId` e sem `accessToken`: não é conta da plataforma da Meta e não
 * gera registro no painel dela. O risco de disparar aqui não é processual — é
 * perder esse número, que é o que a base de clientes tem salvo, e que é
 * exatamente o perfil que a Meta derruba. Daí o teto e a pausa.
 *
 * O aviso também está na confirmação que o advogado lê antes de cada disparo,
 * de propósito: regra que só vive em comentário não protege ninguém.
 *
 * O que este laço NÃO é, e isso importa para a diferença:
 *   • não é robô: cada rodada começa num clique do advogado, na sessão dele;
 *   • não busca contato: fala só com cliente da casa que já tem conversa aberta;
 *   • não escreve mensagem: manda o texto que já estava no card, revisado;
 *   • não ignora teto: para sozinho no limite do dia que o escritório configurou;
 *   • para na hora, e retoma de onde parou sem repetir ninguém;
 *   • roda NA ABA DO ADVOGADO, e por isso a aba precisa ficar na frente:
 *     fora dela o navegador congela o relógio. Desde 09/11 o laço percebe
 *     isso e **para dizendo**, em vez de arrastar calado — ver
 *     `decidirParada` aqui embaixo e `decidirParadaPorJejum` no servidor.
 *
 * 🚨 O RITMO E O TETO VÊM DO SERVIDOR (`regime-do-disparo.ts`), nunca daqui.
 * Constante de ritmo copiada para o front seria a mesma regra em duas pontas, e
 * a ponta que fala com o cliente é a que decide.
 */
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService } from '@/features/inbox/services/inbox.service';

export type AlvoDoDisparo = {
  caseId: string;
  cliente: string;
};

export type RegimeDoDisparo = {
  teto: number; escada: number; campanha: number; sobra: number;
  pausaMinMs: number; pausaMaxMs: number;
  /**
   * As réguas com que o laço mede o PRÓPRIO relógio, vindas do servidor
   * (`regime-do-disparo.ts`, `decidirParadaPorJejum`). Opcionais de propósito:
   * servidor antigo não manda, e a resposta certa aí NÃO é inventar um número
   * aqui — é ficar só com a metade que não precisa de número nenhum, o
   * `document.hidden`. Constante de ritmo cravada no front é a mesma regra em
   * duas pontas, que é o defeito que esta campanha mais repetiu.
   */
  jejumFator?: number;
  jejumMsMin?: number;
  jejunsParaParar?: number;
};

export type AndamentoDoDisparo = {
  feitos: number;
  total: number;
  pulados: number;
  /** Quando a próxima sai, em ms restantes. `null` enquanto manda. */
  esperandoMs: number | null;
  cliente: string | null;
};

export type ResultadoDoDisparo = {
  enviados: number;
  pulados: Array<{ cliente: string; motivo: string }>;
  parado: boolean;
  /** Quantos ficaram de fora por não caberem no teto do dia. */
  foraDoTeto: number;
  /**
   * POR QUE parou, quando parou sozinho. `null` quando foi o advogado no botão
   * "parar" ou quando a fila acabou inteira. Parada sem recado foi exatamente o
   * defeito de 09/11: a tela seguiu dizendo "enviando" com o laço morto.
   */
  motivoDaParada: string | null;
};

const dorme = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A pausa desta volta. Sorteada: intervalo fixo é assinatura de robô. */
function pausa(regime: RegimeDoDisparo): number {
  const min = Math.max(0, regime.pausaMinMs ?? 0);
  const max = Math.max(min, regime.pausaMaxMs ?? min);
  return Math.round(min + (max - min) * Math.random());
}

/** A aba saiu da frente? Fora do navegador (teste, SSR) ninguém está escondido. */
function abaEscondida(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * 🚨🚨 O LAÇO PERCEBE QUE ESTÁ SENDO ESTRANGULADO E PARA DIZENDO ISSO.
 *
 * Medido no primeiro lote real (09/11): o advogado clicou "Disparar 10", trocou
 * de aba, e o Chrome passou a acordar esta aba **1 vez por minuto**. A oferta 3
 * levou 905s contra um teto de ~98s; a 4 nunca saiu. Saíram 3 de 10 e a tela
 * continuou escrita "enviando 2/10 · próxima em 46s".
 *
 * 🚨 QUEM DENUNCIA É O RELÓGIO MEDIDO, não o `document.hidden`. Aba escondida é
 * só uma das causas: janela minimizada, outro app na frente e aba ocluída
 * estrangulam igual, e em parte delas `visibilityState` continua "visible".
 * O tempo que o passo levou contra o que pediu pega todas, inclusive as que
 * ninguém previu.
 *
 * A REGRA é do servidor — `decidirParadaPorJejum`, em `regime-do-disparo.ts`,
 * com os controles. Daqui saem só os números que ela manda no regime, e quando
 * o servidor não manda nenhum, esta função não inventa limiar: fica com o
 * `document.hidden`, que não precisa de número.
 */
function decidirParada(e: {
  regime: RegimeDoDisparo;
  pedidoMs: number;
  gastoMs: number;
  jejunsSeguidos: number;
}): { parar: boolean; jejunsSeguidos: number; motivo: string | null } {
  if (abaEscondida()) {
    return { parar: true, jejunsSeguidos: e.jejunsSeguidos, motivo: 'a aba saiu da frente' };
  }
  const fator = e.regime.jejumFator;
  const piso = e.regime.jejumMsMin;
  const limite = e.regime.jejunsParaParar;
  if (!fator || !piso || !limite) {
    // Servidor antigo: sem réguas, sem palpite. Metade da trava é melhor que
    // uma constante cravada aqui que amanhã diverge da do servidor.
    return { parar: false, jejunsSeguidos: 0, motivo: null };
  }
  const jejum = e.gastoMs >= Math.max(piso, e.pedidoMs * fator);
  if (!jejum) return { parar: false, jejunsSeguidos: 0, motivo: null };
  const jejunsSeguidos = Math.max(0, e.jejunsSeguidos) + 1;
  if (jejunsSeguidos < limite) return { parar: false, jejunsSeguidos, motivo: null };
  return { parar: true, jejunsSeguidos, motivo: 'o navegador congelou o relógio desta aba' };
}

/**
 * Manda a oferta de cada alvo, um de cada vez, no ritmo do servidor.
 *
 * `conferir` roda ANTES do envio: o portão da oferta repetida precisa recusar a
 * MENSAGEM, não só a marca do card. `registrar` é o que muda entre os dois
 * quadros, e é por isso que entra como argumento em vez de este arquivo saber
 * se é refin ou churning.
 */
export async function dispararEmLote(opcoes: {
  alvos: AlvoDoDisparo[];
  regime: RegimeDoDisparo;
  conferir: (caseId: string) => Promise<{ ok: boolean; motivo: string | null }>;
  /**
   * De onde sai o texto, no caso que o laço já buscou. Muda entre os quadros
   * (`ofertaRefin.mensagem` × `ofertaChurning.mensagem`) e por isso entra como
   * argumento. O laço NÃO escreve nem reescreve mensagem nenhuma: manda o que
   * está gravado no card, que é o que o advogado revisou.
   */
  lerTexto: (caso: any) => string;
  registrar: (caseId: string, mensagem: string) => Promise<unknown>;
  onAndamento: (a: AndamentoDoDisparo) => void;
  /** O advogado mandou parar. Lido a cada volta, inclusive durante a pausa. */
  parar: { current: boolean };
}): Promise<ResultadoDoDisparo> {
  const cabem = Number.isFinite(opcoes.regime.sobra)
    ? Math.max(0, Math.min(Math.floor(opcoes.regime.sobra), opcoes.alvos.length))
    : opcoes.alvos.length;
  const fila = opcoes.alvos.slice(0, cabem);
  const foraDoTeto = opcoes.alvos.length - fila.length;

  const pulados: Array<{ cliente: string; motivo: string }> = [];
  let enviados = 0;

  for (let i = 0; i < fila.length; i++) {
    if (opcoes.parar.current) {
      return { enviados, pulados, parado: true, foraDoTeto, motivoDaParada: null };
    }
    // A aba saiu da frente entre um card e outro: para AQUI, na fronteira
    // segura, antes de qualquer coisa chegar ao cliente.
    if (abaEscondida()) {
      return {
        enviados, pulados, parado: true, foraDoTeto,
        motivoDaParada: 'a aba saiu da frente',
      };
    }
    const alvo = fila[i];
    opcoes.onAndamento({
      feitos: enviados + pulados.length, total: fila.length,
      pulados: pulados.length, esperandoMs: null, cliente: alvo.cliente,
    });

    try {
      // 1. O portão, ANTES de qualquer coisa chegar ao cliente.
      const veredito = await opcoes.conferir(alvo.caseId);
      if (!veredito.ok) {
        pulados.push({ cliente: alvo.cliente, motivo: veredito.motivo ?? 'o portão recusou' });
        continue;
      }

      // 2. O caso: dá a conversa E o texto gravado, numa ida só.
      const caso: any = await legalCasesService.get(alvo.caseId);
      const conversationId = caso?.clienteConversa?.conversationId;
      if (!conversationId) {
        pulados.push({ cliente: alvo.cliente, motivo: 'sem WhatsApp vinculado' });
        continue;
      }
      const texto = String(opcoes.lerTexto(caso) ?? '').trim();
      // 🚨 MENSAGEM VAZIA NÃO SE MANDA. Card sem texto gravado é card que não
      // foi revisado: pular é o lado seguro, e o motivo fica dito.
      if (!texto) {
        pulados.push({ cliente: alvo.cliente, motivo: 'o card está sem mensagem gravada' });
        continue;
      }

      // 3. A mensagem, em bolhas, no ritmo do servidor.
      const enviada: any = await inboxService.sendMessage({
        conversationId,
        type: 'TEXT',
        content: { text: texto },
        oneOff: true,
        emBolhas: true,
      });

      // 4. A marca no card. Depois do envio, porque é o envio que ela afirma.
      await opcoes.registrar(alvo.caseId, texto);
      enviados++;

      // 5. A espera: o atraso das bolhas que AINDA estão na fila de saída, mais
      //    a pausa humana. Sem o primeiro, as bolhas da próxima oferta se
      //    embaralhariam com as desta na mesma conversa — o número vem do
      //    servidor (`atrasoTotalMs`) para não existir cópia da fórmula aqui.
      if (i < fila.length - 1) {
        const atrasoDasBolhas = Number(enviada?.atrasoTotalMs ?? enviada?.data?.atrasoTotalMs ?? 0) || 0;
        let resta = atrasoDasBolhas + pausa(opcoes.regime);
        let jejunsSeguidos = 0;
        while (resta > 0) {
          if (opcoes.parar.current) {
            return { enviados, pulados, parado: true, foraDoTeto, motivoDaParada: null };
          }
          const passo = Math.min(1000, resta);
          opcoes.onAndamento({
            feitos: enviados + pulados.length, total: fila.length,
            pulados: pulados.length, esperandoMs: resta, cliente: null,
          });
          // 🚨 O RELÓGIO DE PAREDE, não o que o passo pediu. `resta` tem de
          // descontar o tempo que de fato passou: quando o navegador estica um
          // passo de 1s para 60s, descontar 1s faria a espera durar horas.
          const antes = Date.now();
          await dorme(passo);
          const gastoMs = Math.max(0, Date.now() - antes);
          resta -= Math.max(passo, gastoMs);

          const d = decidirParada({
            regime: opcoes.regime, pedidoMs: passo, gastoMs, jejunsSeguidos,
          });
          jejunsSeguidos = d.jejunsSeguidos;
          if (d.parar) {
            return {
              enviados, pulados, parado: true, foraDoTeto, motivoDaParada: d.motivo,
            };
          }
        }
      }
    } catch (e: any) {
      // Uma falha não derruba a fila: anota o motivo e segue para o próximo.
      pulados.push({
        cliente: alvo.cliente,
        motivo: e?.response?.data?.message || e?.message || 'não consegui enviar',
      });
    }
  }

  opcoes.onAndamento({
    feitos: enviados + pulados.length, total: fila.length,
    pulados: pulados.length, esperandoMs: null, cliente: null,
  });
  return { enviados, pulados, parado: false, foraDoTeto, motivoDaParada: null };
}
