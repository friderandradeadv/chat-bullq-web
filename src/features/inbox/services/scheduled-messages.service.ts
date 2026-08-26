import { api } from '@/lib/api';

export type ScheduledMessageStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'CANCELED'
  | 'FAILED';

/** Arquivo que vai junto com a agendada (hoje: o PDF da prestação de contas). */
export interface ScheduledAnexo {
  nome: string;
  /** caminho relativo à base da API (ex.: /uploads/prestacao/...) */
  url: string;
}

/**
 * Template HSM agendado. Existe porque cliente FORA da janela de 24h só recebe
 * template aprovado: agendar texto puro pra ele falha no disparo (131047).
 * O backend já roteava `type: 'TEMPLATE'` pro `sendManualTemplate`; o que
 * faltava era a web oferecer a opção.
 */
export interface ScheduledTemplate {
  name: string;
  language: string;
  parameters: string[];
  previewText: string;
}

export interface ScheduledMessage {
  id: string;
  conversationId: string;
  channelId: string;
  type: string;
  content: { text?: string; template?: ScheduledTemplate };
  /** Resolvido pelo backend: vazio = a mensagem vai sem anexo. */
  anexos?: ScheduledAnexo[];
  scheduledAt: string;
  status: ScheduledMessageStatus;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
}

/** URL completa pra abrir/baixar o anexo (a API serve o /uploads). */
export function scheduledAnexoHref(a: ScheduledAnexo): string {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '');
  return a.url.startsWith('http') ? a.url : `${base}${a.url}`;
}

export const scheduledMessagesService = {
  async list(conversationId?: string): Promise<ScheduledMessage[]> {
    const { data } = await api.get('/scheduled-messages', {
      params: conversationId ? { conversationId } : undefined,
    });
    return data.data;
  },

  /**
   * Agenda texto simples ou template aprovado. Passando `template`, sai como
   * `type: 'TEMPLATE'` e o worker entrega pelo caminho do HSM, que é o único
   * que atravessa a janela de 24h. O `previewText` também vai em `content.text`
   * porque é dele que a barra de agendadas monta a prévia.
   */
  async create(payload: {
    conversationId: string;
    text?: string;
    scheduledAt: string;
    template?: ScheduledTemplate;
  }): Promise<ScheduledMessage> {
    const { data } = await api.post('/scheduled-messages', {
      conversationId: payload.conversationId,
      type: payload.template ? 'TEMPLATE' : 'TEXT',
      content: payload.template
        ? { text: payload.template.previewText, template: payload.template }
        : { text: payload.text ?? '' },
      scheduledAt: payload.scheduledAt,
    });
    return data.data;
  },

  async update(
    id: string,
    payload: { text?: string; scheduledAt?: string },
  ): Promise<ScheduledMessage> {
    const body: Record<string, unknown> = {};
    if (payload.text !== undefined) body.content = { text: payload.text };
    if (payload.scheduledAt !== undefined) body.scheduledAt = payload.scheduledAt;
    const { data } = await api.patch(`/scheduled-messages/${id}`, body);
    return data.data;
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/scheduled-messages/${id}`);
  },
};
