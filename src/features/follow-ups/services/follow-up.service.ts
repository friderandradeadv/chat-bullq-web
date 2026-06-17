import { api } from '@/lib/api';

export type FollowUpTone =
  | 'padrao'
  | 'imediatista'
  | 'consultivo'
  | 'amigavel'
  | 'formal';

export const FOLLOW_UP_TONES: FollowUpTone[] = [
  'padrao',
  'imediatista',
  'consultivo',
  'amigavel',
  'formal',
];

export const FOLLOW_UP_TONE_LABELS: Record<FollowUpTone, string> = {
  padrao: 'Padrão',
  imediatista: 'Imediatista',
  consultivo: 'Consultivo',
  amigavel: 'Amigável',
  formal: 'Formal',
};

export const FOLLOW_UP_TONE_HINTS: Record<FollowUpTone, string> = {
  padrao: 'Mensagem natural e direta (comportamento padrão).',
  imediatista: 'Cria urgência leve e honesta, convida à ação agora.',
  consultivo: 'Postura de especialista — esclarece e mostra o próximo passo.',
  amigavel: 'Descontraído e próximo, como quem quer ajudar.',
  formal: 'Profissional e sóbrio, sem gírias.',
};

/** Override de follow-up por status do funil (quantos toques + tom). */
export interface FollowUpStatusConfig {
  statusId: string;
  enabled?: boolean;
  count?: number;
  tone?: FollowUpTone;
}

export interface FollowUpConfig {
  enabled: boolean;
  /** Horas de silêncio até cada tentativa: [4, 24, 72, 168, 336]. */
  cadenceHours: number[];
  quietStartHour: number;
  quietEndHour: number;
  /** Tom global padrão. */
  defaultTone: FollowUpTone;
  /** Overrides por status do funil. */
  perStatus: FollowUpStatusConfig[];
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
