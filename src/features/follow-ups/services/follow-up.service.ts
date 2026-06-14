import { api } from '@/lib/api';

export interface FollowUpConfig {
  enabled: boolean;
  /** Horas de silêncio até cada tentativa: [4, 24, 72, 168, 336]. */
  cadenceHours: number[];
  quietStartHour: number;
  quietEndHour: number;
}

export interface FollowUpItem {
  conversationId: string;
  contactName: string | null;
  phone: string | null;
  statusName: string | null;
  statusColor: string | null;
  attempts: number;
  maxAttempts: number;
  silenceHours: number;
  nextAt: string | null;
  due: boolean;
}

export interface FollowUpOverview {
  config: FollowUpConfig;
  timezone: string;
  total: number;
  dueNow: number;
  items: FollowUpItem[];
}

export const followUpService = {
  async getOverview(): Promise<FollowUpOverview> {
    const { data } = await api.get('/follow-ups/overview');
    return data.data ?? data;
  },
  async getConfig(): Promise<FollowUpConfig> {
    const { data } = await api.get('/follow-ups/config');
    return data.data ?? data;
  },
  async updateConfig(input: Partial<FollowUpConfig>): Promise<FollowUpConfig> {
    const { data } = await api.patch('/follow-ups/config', input);
    return data.data ?? data;
  },
};

/** "4h", "24h"→"1d", "168h"→"7d". Pra exibir a régua de forma humana. */
export function humanCadence(hours: number): string {
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `${d}d`;
  }
  return `${hours}h`;
}
