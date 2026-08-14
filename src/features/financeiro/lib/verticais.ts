// ── FONTE ÚNICA das verticais (centros de custo / frentes do escritório) ──────
// Usada em TODO lugar: Financeiro, RH, Meu Espaço, Estrutura. Mudou aqui, muda em todos.
// O "Bancário" foi desdobrado nas frentes reais: RMC/RCC e REPB. Dativos = causas por nomeação.
export const VERTICAIS_PADRAO = ['RMC/RCC', 'REPB', 'Previdenciário', 'Trabalhista', 'Consumidor', 'Criminal', 'Cível', 'Dativos'];

// Cor por vertical (para chips/badges consistentes entre telas).
export const CORES_VERTICAL: Record<string, string> = {
  'RMC/RCC': '#7048E8', 'REPB': '#9C36B5', 'Previdenciário': '#228BE6', 'Trabalhista': '#E8590C',
  'Consumidor': '#0CA678', 'Criminal': '#C92A2A', 'Cível': '#F08C00', 'Dativos': '#495057', 'Escritório': '#868E96',
};
export const corVertical = (a: string) => CORES_VERTICAL[a] ?? '#15AABF';
