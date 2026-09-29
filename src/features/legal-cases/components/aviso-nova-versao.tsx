'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * AVISA QUANDO O HUB FOI ATUALIZADO E A ABA ESTÁ COM A VERSÃO VELHA.
 *
 * 🚨 POR QUE EXISTE. Pergunta do escritório em 29/09/2026: "Como eu vou saber
 * que o deploy subiu?". Naquela madrugada isso custou caro três vezes: eu
 * publicava uma correção, ele continuava vendo o defeito, e nós dois
 * diagnosticávamos um problema que já estava resolvido — porque a aba dele
 * seguia rodando o JavaScript antigo. Foi o caso da barra de progresso que "não
 * aparecia" e do aviso que "continuava apitando".
 *
 * Um deploy do Next troca os nomes dos pacotes em `/_next/static/chunks/`. Então
 * basta comparar a lista de pacotes que ESTA aba carregou com a lista que o
 * servidor manda agora para a MESMA rota: se diferem, há versão nova.
 *
 * 🚨 A ROTA É A DA MONTAGEM, não `location.pathname` do momento. Navegar dentro
 * do hub troca o caminho sem recarregar a página, e comparar o HTML de outra
 * rota com os pacotes desta acusaria "versão nova" toda vez que o advogado
 * trocasse de tela — alarme falso que ensina a ignorar o alarme.
 *
 * Nunca recarrega sozinho: uma peça pode estar sendo escrita na tela. Quem
 * decide é o advogado.
 */
function assinatura(texto: string): string {
  const achados = texto.match(/\/_next\/static\/chunks\/[^"'\s)]+?\.js/g) || [];
  return [...new Set(achados)].sort().join('|');
}

export function AvisoNovaVersao() {
  const [nova, setNova] = useState(false);
  const minha = useRef<string>('');
  const rota = useRef<string>('');

  useEffect(() => {
    rota.current = window.location.pathname;
    minha.current = assinatura(
      Array.from(document.querySelectorAll('script[src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .join(' '),
    );
    if (!minha.current) return; // sem pacotes para comparar: não invento aviso

    let vivo = true;
    const olhar = async () => {
      try {
        const r = await fetch(rota.current, { cache: 'no-store' });
        if (!r.ok) return;
        const deles = assinatura(await r.text());
        if (vivo && deles && deles !== minha.current) setNova(true);
      } catch {
        /* rede oscilou: silêncio é a resposta certa, não um alarme */
      }
    };
    void olhar();
    const t = setInterval(olhar, 120_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const recarregar = useCallback(() => window.location.reload(), []);

  if (!nova) return null;

  return (
    <div className="flex items-center gap-3 border-b border-sky-300 bg-sky-50 px-6 py-2 dark:border-sky-800/60 dark:bg-sky-900/25">
      <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 text-sky-700 dark:text-sky-400" />
      <span className="flex-1 text-sm text-sky-900 dark:text-sky-100">
        <span className="font-semibold">Hub atualizado.</span>
        <span className="ml-2 text-sky-800 dark:text-sky-200">
          Esta aba ainda roda a versão anterior.
        </span>
      </span>
      <button
        type="button"
        onClick={recarregar}
        className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
      >
        Atualizar
      </button>
    </div>
  );
}
