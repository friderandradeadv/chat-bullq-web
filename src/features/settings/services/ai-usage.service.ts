import { api } from '@/lib/api';

/**
 * "Uso da IA" (Task C — paridade LíderHub). Consome o relatório agregado do
 * backend (`GET /ai-usage`): totais de tokens + custo em USD/BRL, quebra por
 * modelo e por origem, e série diária. O custo é gravado em USD no banco; a
 * conversão pra BRL usa a taxa configurável retornada em `usdBrlRate`.
 */

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
  costBrl: number;
  calls: number;
}

export interface UsageBreakdown extends UsageTotals {
  key: string;
}

export interface UsageDailyPoint {
  date: string;
  costUsd: number;
  costBrl: number;
  totalTokens: number;
  calls: number;
}

export interface UsageReport {
  range: { from: string; to: string };
  usdBrlRate: number;
  totals: UsageTotals;
  byModel: UsageBreakdown[];
  bySource: UsageBreakdown[];
  daily: UsageDailyPoint[];
}

export interface UsageRange {
  from?: string;
  to?: string;
}

/** Rótulos amigáveis pras origens (`source`) que o backend grava. */
export const USAGE_SOURCE_LABELS: Record<string, string> = {
  'agent-run': 'Atendimento (agentes)',
  classifier: 'Classificador de intenção',
  'inbox-summary': 'Resumo de conversa',
  'zapsign-extract': 'Extração de dados (ZapSign)',
  'agent-generate': 'Criação de agente por IA',
  'agent-test': 'Teste de agente',
};

/** Saúde do saldo da IA (Anthropic). A API não expõe saldo, então o "restante" é
 *  estimado do saldo declarado (registerReload) menos o gasto rastreado; o campo
 *  `exhausted` vem do erro real de "credit balance too low". */
export type AiCreditStatus = 'ok' | 'low' | 'empty' | 'unset';

export interface AiCreditHealth {
  status: AiCreditStatus;
  loadedUsd: number | null;
  loadedAt: string | null;
  spentUsd: number;
  remainingUsd: number | null;
  remainingPct: number | null;
  usdBrlRate: number;
  exhausted: boolean;
  exhaustedAt: string | null;
}

export const aiUsageService = {
  async get(range: UsageRange = {}): Promise<UsageReport> {
    const { data } = await api.get('/ai-usage', { params: range });
    return (data.data ?? data) as UsageReport;
  },

  async creditHealth(): Promise<AiCreditHealth> {
    const { data } = await api.get('/ai-usage/credit-health');
    return (data.data ?? data) as AiCreditHealth;
  },

  async registerReload(loadedUsd: number): Promise<AiCreditHealth> {
    const { data } = await api.post('/ai-usage/credit-reload', { loadedUsd });
    return (data.data ?? data) as AiCreditHealth;
  },
};
