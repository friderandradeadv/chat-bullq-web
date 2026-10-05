'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { setEtiquetaCores } from '@/features/legal-cases/lib/etiqueta-cores';

/**
 * Carrega as CORES ESCOLHIDAS À MÃO das etiquetas e as entrega ao módulo de cor.
 *
 * 🚨 POR QUE UM PROVEDOR, E NÃO UM HOOK EM CADA CARD. `produtoColor` é função
 * pura, chamada em 15 lugares de 8 arquivos (os seis quadros, a ficha e o
 * seletor). Virar hook obrigaria a mexer em todos, e o ganho seria zero: o mapa
 * é um só para o escritório inteiro. Então o mapa vive no módulo e isto aqui o
 * preenche uma vez, no layout do painel, antes de os quadros desenharem.
 *
 * 🚨 O `tick` NÃO É ENFEITE. Preencher um módulo não re-renderiza nada: sem ele,
 * o primeiro desenho sairia com as cores da regra e só trocaria quando algo
 * mais, por acaso, re-renderizasse — ou seja, o card apareceria cinza e
 * "consertaria sozinho" depois, que é o tipo de comportamento que ninguém
 * consegue reproduzir para relatar. Mudando o estado aqui, a árvore abaixo
 * redesenha UMA vez, quando o mapa chega.
 *
 * Falhar aqui não quebra nada: sem mapa, vale a regra de sempre.
 */
export function EtiquetaCoresProvider({ children }: { children: React.ReactNode }) {
  const [, setTick] = useState(0);
  const { data } = useQuery({
    queryKey: ['etiqueta-cores'],
    queryFn: () => legalCasesService.etiquetaCores(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!data) return;
    setEtiquetaCores(data);
    setTick((v) => v + 1);
  }, [data]);

  return <>{children}</>;
}
