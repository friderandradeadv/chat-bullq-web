/**
 * ETIQUETAS (produto/área) dos cards — lista ÚNICA do hub.
 *
 * 🚨 ESTA LISTA JÁ EXISTIU EM DUAS CÓPIAS, E A SEGUNDA DIVERGIU (05/10/2026).
 * O card tinha 16 presets; o diálogo de "Novo processo" tinha OUTROS 9, com
 * grafias diferentes — `BPC-LOAS` contra `BPC/LOAS`, `Revisional` contra
 * `Revisional Consignado`, `Aposentadoria` contra `por Idade`/`por Invalidez` —
 * e sem Churning, Portabilidade, Contribuições, Tarifas/Seguros, Cível e
 * Família. Quem criava processo pelo diálogo nascia com etiqueta escrita de um
 * jeito, e quem etiquetava pelo card, de outro: o filtro por etiqueta passa a
 * ver dois produtos onde há um.
 *
 * É a mesma doença que `etiqueta-cores.ts` descreve para as CORES (seis cópias
 * divergidas, mais uma sétima que escapou). A regra que fica é igual:
 * preset de etiqueta se acrescenta AQUI, num lugar só.
 *
 * 🚨 A LISTA É SUGESTÃO, NÃO CERCA. Os dois campos aceitam TEXTO LIVRE: pode-se
 * criar etiqueta nova digitando. Ela ganha cor pela regra de `produtoColor`, que
 * casa por pedaço do nome — etiqueta nova sem regra sai cinza, e aí a cor se
 * acrescenta no arquivo de cores, não aqui.
 */
export const PRODUTO_PRESETS = [
  'RMC', 'RCC', 'Churning', 'Revisional Consignado', 'Portabilidade', 'Contribuições',
  'Tarifas/Seguros', 'BPC/LOAS', 'BPC/LOAS - Doença', 'Auxílio-doença',
  'Aposentadoria por Idade', 'Aposentadoria por Invalidez', 'Trabalhista',
  'Consumidor', 'Cível', 'Família',
];
