import {
  MessageSquare,
  UserRoundCheck,
  Tag,
  Users,
  Share2,
  CornerUpLeft,
  Package,
  Gift,
  KeyRound,
  CircleDot,
  Building2,
  UserCog,
  PencilLine,
  Zap,
  Bell,
  PowerOff,
  FileSignature,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Rótulos PT-BR + ícones para as ferramentas built-in do agente (o backend
 * expõe nome real + descrição em inglês via /ai-catalog/builtin-tools). Mapeado
 * pelo `name` real (o mesmo que o LLM enxerga e que vira chip @ no prompt).
 * Se aparecer uma tool nova sem entrada aqui, o componente cai no nome/descrição
 * crus do backend — nunca quebra.
 */
export interface BuiltinToolMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Agrupamento visual. */
  group: 'Atendimento' | 'Roteamento' | 'Dados do contato' | 'Vendas' | 'Integrações';
}

export const BUILTIN_TOOL_META: Record<string, BuiltinToolMeta> = {
  replyToConversation: {
    label: 'Responder a conversa',
    description: 'Envia a resposta ao cliente no WhatsApp.',
    icon: MessageSquare,
    group: 'Atendimento',
  },
  transferToHuman: {
    label: 'Transferir para humano',
    description: 'Passa a conversa para um atendente e pausa a IA.',
    icon: UserRoundCheck,
    group: 'Atendimento',
  },
  disableAi: {
    label: 'Desativar IA na conversa',
    description: 'Pausa as respostas automáticas nesta conversa.',
    icon: PowerOff,
    group: 'Atendimento',
  },
  tagConversation: {
    label: 'Etiquetar conversa',
    description: 'Aplica etiquetas à conversa ou ao contato.',
    icon: Tag,
    group: 'Atendimento',
  },
  sendQuickReply: {
    label: 'Enviar mensagem rápida',
    description: 'Dispara uma resposta pronta cadastrada nas mensagens rápidas.',
    icon: Zap,
    group: 'Atendimento',
  },
  listAvailableAgents: {
    label: 'Listar agentes disponíveis',
    description: 'Consulta quais agentes existem para poder delegar.',
    icon: Users,
    group: 'Roteamento',
  },
  delegateToAgent: {
    label: 'Delegar para outro agente',
    description: 'Encaminha o atendimento a um subagente especializado.',
    icon: Share2,
    group: 'Roteamento',
  },
  handBackToOrchestrator: {
    label: 'Devolver ao orquestrador',
    description: 'Retorna o controle ao agente principal (triagem).',
    icon: CornerUpLeft,
    group: 'Roteamento',
  },
  setDepartment: {
    label: 'Definir departamento',
    description: 'Direciona a conversa para um setor (ex.: Jurídico, Comercial).',
    icon: Building2,
    group: 'Roteamento',
  },
  assignResponsible: {
    label: 'Atribuir responsável',
    description: 'Define o atendente responsável pela conversa.',
    icon: UserCog,
    group: 'Roteamento',
  },
  notifyMember: {
    label: 'Notificar membro da equipe',
    description: 'Avisa internamente um membro sobre a conversa.',
    icon: Bell,
    group: 'Roteamento',
  },
  setContactStatus: {
    label: 'Definir status do contato',
    description: 'Move o contato no funil (ex.: Em atendimento, Fechado).',
    icon: CircleDot,
    group: 'Dados do contato',
  },
  saveContactName: {
    label: 'Salvar nome do contato',
    description: 'Atualiza o nome do contato a partir da conversa.',
    icon: PencilLine,
    group: 'Dados do contato',
  },
  lookupOffering: {
    label: 'Consultar oferta / produto',
    description: 'Busca preço, condições e link oficiais — evita inventar valores.',
    icon: Package,
    group: 'Vendas',
  },
  checkBonusEligibility: {
    label: 'Checar elegibilidade de bônus',
    description: 'Calcula de forma determinística se o cliente tem direito ao bônus.',
    icon: Gift,
    group: 'Vendas',
  },
  checkMembersAccess: {
    label: 'Verificar acesso na área de membros',
    description: 'Confere se o cliente já tem acesso à entrega/área de membros.',
    icon: KeyRound,
    group: 'Vendas',
  },
  generateZapSignDocument: {
    label: 'Gerar contrato (ZapSign)',
    description: 'Cria e envia o contrato para assinatura digital.',
    icon: FileSignature,
    group: 'Integrações',
  },
};

/** Fallback pra qualquer tool sem entrada no mapa. */
export const FALLBACK_TOOL_META = (name: string, description: string): BuiltinToolMeta => ({
  label: name,
  description,
  icon: Wrench,
  group: 'Integrações',
});

export const TOOL_GROUP_ORDER: BuiltinToolMeta['group'][] = [
  'Atendimento',
  'Roteamento',
  'Dados do contato',
  'Vendas',
  'Integrações',
];
