'use client';

import { useEffect } from 'react';

/**
 * 🚨 QUEM OCUPA O CANTO DE BAIXO AVISA, E O QUE FLUTUA SOBE (09/11/2026).
 *
 * MEDIDO: respondendo dois clientes no Inbox, três cliques no botão "Enviar
 * mensagem" não surtiram efeito nenhum — sem erro, sem aviso, o texto parado no
 * campo. O `VisorProgresso` estava aberto com o erro de uma montagem
 * ("MIGUEL INGLES x PARANA BANCO S/A · o agente parou") e, sendo
 * `fixed right-4 bottom-4 z-40`, caía em cima do botão e engolia o clique. Só
 * depois de fechar o cartão no "×" a mensagem saiu. Quem não desconfiar conclui
 * que o hub não envia.
 *
 * ⚠️ POR QUE NÃO É Z-INDEX. Subir o compositor por cima resolve o clique e cria
 * o defeito que o visor já levou em 20/10/2026: metade do cartão escondida, e a
 * queixa foi exatamente *"está bugando aquele aviso ali cortando"*. O cartão
 * precisa ficar INTEIRO à vista, só que acima do que já ocupa o canto.
 *
 * ⚠️ POR QUE NÃO É UM NÚMERO FIXO. A altura do compositor muda o tempo todo:
 * cresce com o texto, com anexo pendente, com a faixa de nota interna, com o
 * agendamento. Recuo cravado acerta numa altura e erra em todas as outras — e
 * erra calado, que é como este defeito nasceu.
 *
 * Então se MEDE, e se publica, do mesmo jeito que `useDockSafeArea` faz com o
 * Dock do macOS: a tela que toma o rodapé diz quanto tomou, e quem flutua
 * desconta. Qualquer tela futura com barra inferior própria usa o mesmo gancho;
 * o visor não precisa saber que o Inbox existe.
 *
 * O que se mede é o quanto o elemento avança sobre a borda de baixo da JANELA
 * (`innerHeight - top`), não a altura dele: assim vale mesmo quando ele não
 * está colado no rodapé.
 */
export const VAR_RODAPE_OCUPADO = '--rodape-ocupado';

/** Teto são: o visor nunca sobe mais que isto, por mais estranha que seja a medida. */
const TETO_FRACAO_DA_TELA = 0.6;

/**
 * Recebe o ELEMENTO, não um ref: o compositor do Inbox troca de raiz conforme o
 * modo (normal, gravando, prévia do áudio, conversa encerrada), e um ref estável
 * deixaria o observador preso no nó antigo, já fora da tela. Com o nó na
 * dependência, trocar de modo volta a medir o que está realmente desenhado.
 * Do lado de quem chama, isso é um `ref={setRodape}` com `useState`.
 */
export function useRodapeOcupado(el: HTMLElement | null) {
  useEffect(() => {
    const root = document.documentElement;
    const medir = () => {
      if (!el) {
        root.style.setProperty(VAR_RODAPE_OCUPADO, '0px');
        return;
      }
      const r = el.getBoundingClientRect();
      // Elemento escondido (display:none) devolve tudo zero: não ocupa nada.
      if (r.height === 0 && r.width === 0) {
        root.style.setProperty(VAR_RODAPE_OCUPADO, '0px');
        return;
      }
      const avanco = window.innerHeight - r.top;
      const teto = window.innerHeight * TETO_FRACAO_DA_TELA;
      const px = Number.isFinite(avanco) ? Math.min(Math.max(0, avanco), teto) : 0;
      root.style.setProperty(VAR_RODAPE_OCUPADO, `${Math.round(px)}px`);
    };

    medir();

    // ResizeObserver pega o compositor crescendo com o texto; o resize da
    // janela pega a mudança de viewport. O scroll não entra: o compositor não
    // rola com o conteúdo.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver(medir);
      ro.observe(el);
    }
    window.addEventListener('resize', medir);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', medir);
      // 🚨 LIMPAR AO SAIR é metade da regra. Sem isto, trocar o Inbox por
      // qualquer outra tela deixaria o visor flutuando alto para sempre, e o
      // defeito trocaria de lugar em vez de acabar.
      root.style.setProperty(VAR_RODAPE_OCUPADO, '0px');
    };
  }, [el]);
}
