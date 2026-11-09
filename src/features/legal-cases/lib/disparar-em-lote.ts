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
 *   • para na hora, e retoma de onde parou sem repetir ninguém.
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
};

const dorme = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A pausa desta volta. Sorteada: intervalo fixo é assinatura de robô. */
function pausa(regime: RegimeDoDisparo): number {
  const min = Math.max(0, regime.pausaMinMs ?? 0);
  const max = Math.max(min, regime.pausaMaxMs ?? min);
  return Math.round(min + (max - min) * Math.random());
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
      return { enviados, pulados, parado: true, foraDoTeto };
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
        while (resta > 0) {
          if (opcoes.parar.current) {
            return { enviados, pulados, parado: true, foraDoTeto };
          }
          const passo = Math.min(1000, resta);
          opcoes.onAndamento({
            feitos: enviados + pulados.length, total: fila.length,
            pulados: pulados.length, esperandoMs: resta, cliente: null,
          });
          await dorme(passo);
          resta -= passo;
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
  return { enviados, pulados, parado: false, foraDoTeto };
}
