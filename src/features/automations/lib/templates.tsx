import { Hand, Clock, UserCheck, KanbanSquare, type LucideIcon } from 'lucide-react';
import type { AutomationTemplateSeed } from '../components/automation-builder';

/**
 * Modelos prontos de automação. Pré-preenchem o builder (gatilho + ação) já
 * estruturados; o usuário só escolhe os detalhes (tag, usuário, texto) e salva.
 * Começam desativados — nada dispara sem o usuário ligar.
 */
export interface AutomationTemplate {
  id: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  seed: AutomationTemplateSeed;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'welcome',
    title: 'Boas-vindas automática',
    blurb: 'Responde toda nova mensagem com uma saudação enquanto um atendente assume.',
    icon: Hand,
    seed: {
      name: 'Boas-vindas automática',
      trigger: 'MESSAGE_RECEIVED',
      actions: [
        {
          type: 'send_message',
          params: {
            body: 'Olá! 👋 Recebemos sua mensagem e já vamos te atender. Enquanto isso, pode nos adiantar como podemos ajudar?',
          },
        },
      ],
    },
  },
  {
    id: 'away',
    title: 'Resposta fora do horário',
    blurb: 'Avisa que está fora do expediente. Dica: adicione uma condição de horário.',
    icon: Clock,
    seed: {
      name: 'Resposta fora do horário',
      trigger: 'MESSAGE_RECEIVED',
      actions: [
        {
          type: 'send_message',
          params: {
            body: 'Olá! No momento estamos fora do horário de atendimento. Deixe sua mensagem que retornamos no próximo dia útil. 🙏',
          },
        },
      ],
    },
  },
  {
    id: 'assign-vip',
    title: 'Atribuir conversas VIP',
    blurb: 'Quando uma etiqueta (ex.: VIP) é aplicada, atribui a conversa a um responsável.',
    icon: UserCheck,
    seed: {
      name: 'Atribuir conversas VIP',
      trigger: 'TAG_ADDED',
      actions: [{ type: 'assign_user', params: { userId: '' } }],
    },
  },
  {
    id: 'pipeline-on-status',
    title: 'Mover no funil por status',
    blurb: 'Quando o status da conversa muda, move o card para o estágio certo do funil.',
    icon: KanbanSquare,
    seed: {
      name: 'Mover no funil por status',
      trigger: 'CONVERSATION_STATUS_CHANGED',
      actions: [{ type: 'move_pipeline_stage', params: { pipelineId: '', toStageId: '' } }],
    },
  },
];
