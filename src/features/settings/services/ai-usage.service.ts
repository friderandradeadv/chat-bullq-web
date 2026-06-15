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

export const aiUsageService = {
  async get(range: UsageRange = {}): Promise<UsageReport> {
    const { data } = await api.get('/ai-usage', { params: range });
    return (data.data ?? data) as UsageReport;
  },
};
