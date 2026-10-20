'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { BarraProgressoView, aindaTemOQueDizer, useRelogio, type Progresso } from './barra-progresso';

type Ativo = { caseId: string; titulo: string | null; cnj: string | null; progresso: Progresso };

/**
 * O VISOR FLUTUANTE: o que o agente está executando AGORA, em qualquer tela.
 *
 * 🚨 POR QUE EXISTE. A barra do card já mostrava o passo, mas só onde o card
 * está desenhado — fechada a tarefa na agenda, o advogado perdia de vista o
 * trabalho em curso. Pedido dele em 19/10/2026: *"quero um visorzinho com
 * barra de progresso, quando fechar a tarefa, para eu saber o que está sendo
 * executado, igual é nos kanbans"*.
 *
 * 🚨 É A MESMA BARRA, NÃO UMA SEGUNDA. Desenha com `BarraProgressoView` e
 * esconde pela mesma regra (`aindaTemOQueDizer`). Duas linguagens para a mesma
 * coisa fariam o hub dizer, em dois cantos da tela, coisas diferentes sobre o
 * mesmo trabalho.
 *
 * 🚨 UMA CONSULTA, NÃO UMA POR CARD. A barra de cada card pergunta pelo seu
 * processo; o visor pergunta pela organização inteira numa rota só
 * (`/legal-cases/progresso/ativos`). Com vinte cards na tela, a diferença é
 * entre 1 e 20 requisições a cada 3 segundos para, quase sempre, não mostrar
 * nada.
 *
 * 🚨 NÃO INTERROMPE — regra da casa. Não abre nada, não rouba foco, não pisca:
 * aparece no canto quando há trabalho, sai sozinho quando acaba, e o advogado
 * pode fechar. Fechado, só volta quando surgir um trabalho NOVO (a dispensa é
 * por chave do que está rodando, não para sempre).
 */
export function VisorProgresso({ acimaDaBarra = false }: { acimaDaBarra?: boolean }) {
  const [dispensado, setDispensado] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['legal-cases', 'progresso', 'ativos'],
    queryFn: async (): Promise<Ativo[]> => {
      const { data } = await api.get('/legal-cases/progresso/ativos');
      const d = data?.data ?? data;
      return (d?.itens ?? []) as Ativo[];
    },
    // 3s enquanto há algo rodando; 15s quando a tela está quieta.
    refetchInterval: (q) => {
      const itens = (q.state.data ?? []) as Ativo[];
      return itens.some((x) => x.progresso?.status === 'rodando') ? 3000 : 15000;
    },
    staleTime: 1500,
  });

  // 🚨 O VISOR TAMBÉM PRECISA DA BATIDA. Mesmo defeito, mesma causa: o dado
  // volta igual do servidor, o React não redesenha, e o cartão de "pronto"
  // ficava na tela até o advogado fechar no X.
  useRelogio((data ?? []).length > 0);
  const vivos = (data ?? []).filter((x) => x.progresso && aindaTemOQueDizer(x.progresso));
  if (!vivos.length) return null;

  // a chave muda quando entra ou sai trabalho: dispensar não esconde o próximo
  const chave = vivos.map((x) => `${x.caseId}:${x.progresso.op}:${x.progresso.em}`).join('|');
  if (dispensado === chave) return null;

  return (
    /* 🚨 O ÚLTIMO CARTÃO SUMIA ATRÁS DA BARRA DE ABAS (20/10/2026). O visor
       estava em `bottom-4` (16px) e a barra inferior do hub ocupa `4rem` mais
       o `--dock-safe` do Dock do macOS, que é a mesma conta que o layout já faz
       no padding do conteúdo. Com três operações em curso o terceiro cartão
       ficava cortado pela metade, e ele apontou: "está bugando aquele aviso
       ali cortando".

       No mobile a barra existe sempre (`MobileTabBar`); no desktop só no modo
       Simples, e por isso o recuo de `lg` vem por prop em vez de ser chutado
       aqui. As classes vão escritas por inteiro de propósito: o Tailwind não
       enxerga nome de classe montado por interpolação.

       E `max-h` com rolagem porque empilhar quatro cartões também estoura a
       tela em janela baixa, e cortar por cima é o mesmo defeito do outro lado. */
    <div
      className={`pointer-events-auto fixed right-4 z-40 flex max-h-[calc(100vh-9rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] ${
        acimaDaBarra
          ? 'lg:bottom-[calc(4rem+var(--dock-safe,0px)+0.75rem)]'
          : 'lg:bottom-4'
      }`}
    >
      {vivos.slice(0, 4).map((x) => (
        <div
          key={x.caseId}
          className="shrink-0 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-start gap-2 px-2.5 pt-2">
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-700 dark:text-neutral-200">
              {x.titulo ?? 'Processo'}
              {x.cnj ? <span className="font-normal text-neutral-400"> · {x.cnj}</span> : null}
            </p>
            <button
              type="button"
              onClick={() => setDispensado(chave)}
              aria-label="Esconder o visor"
              className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="px-2 pb-2 pt-1">
            <BarraProgressoView p={x.progresso} compacta caseId={x.caseId} />
          </div>
        </div>
      ))}
      {vivos.length > 4 && (
        <p className="text-right text-[11px] text-neutral-500">+{vivos.length - 4} em andamento</p>
      )}
    </div>
  );
}
