import { api } from '@/lib/api';

/**
 * Textos de NEGÓCIO editáveis pela tela (Configurações → Textos do Sistema),
 * persistidos em `organization.settings.systemTexts`. Cada campo vazio faz o
 * backend cair no texto-padrão embutido no código — nunca fica sem texto.
 */
export interface SystemTexts {
  /** Mensagem que envia o link do contrato ao cliente. `{link}` vira a URL. */
  contractLinkMessage?: string;
  /** Opções de honorários usadas na extração do cadastro (ex.: "10x + 30%…"). */
  honorariosOptions?: string;
  /** Aviso anti-golpe enviado quando a conversa é transferida de número. */
  transferFarewell?: string;
}

export const systemTextsService = {
  async get(): Promise<SystemTexts> {
    const { data } = await api.get('/organizations/system-texts');
    return (data.data ?? data) as SystemTexts;
  },

  async update(texts: SystemTexts): Promise<SystemTexts> {
    const { data } = await api.patch('/organizations/system-texts', texts);
    return (data.data ?? data) as SystemTexts;
  },
};

/** Campos da tela, com rótulo, ajuda e placeholder (= texto atual padrão). */
export const SYSTEM_TEXT_FIELDS: Array<{
  key: keyof SystemTexts;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: 'contractLinkMessage',
    label: 'Mensagem do link do contrato',
    hint: 'Enviada ao cliente com o link de assinatura. Use {link} onde a URL deve aparecer; se não usar, o link é colado no final.',
    placeholder:
      'Olá! 👋 Aqui está o link para você assinar seu contrato com o escritório *Frider Andrade - Advogados*:\n\n{link}\n\n✍️ É só clicar e seguir o passo a passo — leva menos de 1 minutinho, é 100% digital e seguro. Qualquer dúvida, é só chamar aqui. 🙏',
    rows: 6,
  },
  {
    key: 'honorariosOptions',
    label: 'Opções de honorários',
    hint: 'Exemplos usados quando a IA extrai o cadastro/honorários combinados da conversa. Atualize quando a política de preço mudar.',
    placeholder:
      '"entrada de 10x de R$ 47,00 mais 30% sobre o valor recuperado" (Opção 1) ou "sem entrada; 50% do valor recuperado, somente em caso de êxito" (Opção 2)',
    rows: 4,
  },
  {
    key: 'transferFarewell',
    label: 'Aviso de transferência (anti-golpe)',
    hint: 'Enviado no número de origem quando a conversa passa para o número exclusivo do cliente.',
    placeholder:
      'A partir de agora, o atendimento do seu caso continua pelo nosso número exclusivo para clientes — a advogada responsável já vai te chamar por lá. 🙏 Por favor, siga a conversa SOMENTE por esse novo número daqui pra frente.\n\n⚠️ Se alguém falar em nome do escritório por QUALQUER outro número, prometendo causa ganha ou pedindo depósito, ignore e bloqueie — é golpe.',
    rows: 6,
  },
];
