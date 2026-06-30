'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MessageSquare,
  CalendarCheck,
  Folder,
  Newspaper,
  Users,
  BarChart3,
  ArrowRight,
  CalendarClock,
  AlarmClock,
  Briefcase,
  Mail,
  Phone,
  Quote,
  CheckCircle2,
  Lightbulb,
  ClipboardList,
  Clock,
  Gavel,
  PartyPopper,
  Send,
  Inbox,
  CornerUpLeft,
  Sparkles,
  Loader2,
  ExternalLink,
  ChevronDown,
  X,
  CalendarPlus,
  ListChecks,
  Wallet,
  TrendingUp,
  CircleDollarSign,
  HandCoins,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { tasksService } from '@/features/tasks/services/tasks.service';
import { deadlinesService } from '@/features/deadlines/services/deadlines.service';
import { calendarService } from '@/features/calendar/services/calendar.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService, type Conversation } from '@/features/inbox/services/inbox.service';
import { dashboardService, type HubNewsItem } from '@/features/dashboard/services/dashboard.service';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { formatPhone } from '@/lib/brazil-states';

// ── Honorífico (Dr./Dra.) por heurística de nome — sem campo de gênero no banco ──
const FEMALE_FIRST = new Set([
  'kauani', 'julia', 'jullia', 'maria', 'ana', 'valeska', 'jaqueline', 'michele',
  'michelle', 'raquel', 'isis', 'ester', 'esther', 'beatriz', 'ines', 'carmen',
  'miriam', 'rute', 'rachel', 'agnes', 'isabel', 'isabela', 'leticia', 'eliane',
  'eliana', 'sara', 'liz', 'mercedes', 'pilar', 'flor', 'consuelo',
]);
const MALE_ENDS_A = new Set(['joshua', 'josua', 'luca', 'noa', 'aha', 'juba']);
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function firstNameOf(name?: string, email?: string) {
  const n = (name || '').replace(/^\s*(admin|administrador|adm)\s*[-–:]\s*/i, '').trim();
  const toks = n.split(/\s+/).filter((t) => t && !/^(dr|dra|doutor|doutora)\.?$/i.test(t));
  let first = toks[0] || '';
  if (!first || /^admin/i.test(first)) first = (email || '').split('@')[0].split(/[._-]/)[0] || '';
  if (!first) return 'Doutor(a)';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
function honorificOf(first: string): 'Dr.' | 'Dra.' {
  const f = norm(first);
  if (FEMALE_FIRST.has(f)) return 'Dra.';
  if (f.endsWith('a') && !MALE_ENDS_A.has(f)) return 'Dra.';
  return 'Dr.';
}

const DOW_MSG: Record<number, string> = {
  0: 'Domingo e você firme aqui — que dedicação! 🙌',
  1: 'Começo de semana: energia lá no topo! 🔋',
  2: 'Terça a todo vapor. Bora pra cima! 🚂',
  3: 'Quarta — metade do caminho já é sua. 💪',
  4: 'Quinta: a vitória da semana está logo ali. 🎯',
  5: 'Sexta-feira — reta final, feche com chave de ouro! 🏁',
  6: 'Sábado de guerreiro(a). Respeito! 👏',
};

const GREET_EMOJI = ['👋', '🚀', '⚖️', '✨', '🔥', '💪', '🌟', '🎯'];

// Saudação granular pelo horário do dia.
function saudacaoFor(h: number): string {
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 13) return 'Bom início de tarde';
  if (h < 17) return 'Boa tarde';
  if (h < 19) return 'Bom final de tarde';
  return 'Boa noite';
}

// Frases instigantes por contexto (horário + dia da semana). {dr}=Dr./Dra., {nome}=primeiro nome.
// d: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb.
const CTX_PHRASES: { when: (h: number, d: number) => boolean; t: string }[] = [
  // Madrugada (0–5)
  { when: (h) => h < 5, t: 'Trabalhando de madrugada, {dr}? O escritório nunca dorme. 🌙' },
  { when: (h) => h < 5, t: 'Queimando as pestanas hoje, {dr}? Cuidado pra não virar coruja. 🦉' },
  { when: (h) => h < 5, t: 'Madrugada é prazo apertado ou inspiração batendo, {dr}?' },
  // Manhã cedo (5–8)
  { when: (h) => h >= 5 && h < 8, t: 'Começou cedo hoje, hein, {dr}? É assim que se constrói um escritório. ☕' },
  { when: (h) => h >= 5 && h < 8, t: 'Bom e cedo, {dr} — o cliente madrugador agradece.' },
  { when: (h) => h >= 5 && h < 8, t: 'Café na mão e pra cima, {dr}? Bora atacar a lista.' },
  // Manhã (8–12)
  { when: (h) => h >= 8 && h < 12, t: 'Voltando ao trabalho, {dr}? A manhã rende. 💪' },
  { when: (h) => h >= 8 && h < 12, t: 'Manhã é hora de atacar os prazos mais cabeludos, {dr}.' },
  { when: (h) => h >= 8 && h < 12, t: 'Bom dia produtivo, {dr} — qual processo cai primeiro hoje?' },
  // Pós-almoço (12–14)
  { when: (h) => h >= 12 && h < 14, t: 'Hora de dar o gás após o almoço, {dr}. 🚀' },
  { when: (h) => h >= 12 && h < 14, t: 'Pós-almoço é teste de foco — segura o sono e bora, {dr}.' },
  { when: (h) => h >= 12 && h < 14, t: 'Tarde começando: um café e a gente decola, {dr}.' },
  // Tarde (14–17)
  { when: (h) => h >= 14 && h < 17, t: 'Tarde rendendo, {dr}? Mantém o ritmo.' },
  { when: (h) => h >= 14 && h < 17, t: 'Reta da tarde — foco total nos prazos de hoje, {dr}.' },
  // Final de tarde (17–19)
  { when: (h) => h >= 17 && h < 19, t: 'Final de tarde, {dr} — fechando o dia com chave de ouro?' },
  { when: (h) => h >= 17 && h < 19, t: 'Últimos protocolos antes de encerrar, {dr}?' },
  // Começo de noite (19–22)
  { when: (h) => h >= 19 && h < 22, t: 'Ainda no batente, {dr}? Dedicação nível advogado.' },
  { when: (h) => h >= 19 && h < 22, t: 'Começo de noite produtivo, {dr}? Não esquece de jantar.' },
  // Final de noite (22–24)
  { when: (h) => h >= 22, t: 'Trabalhando até tarde, {dr}? O cliente nem imagina o esforço.' },
  { when: (h) => h >= 22, t: 'Vira-noite jurídico, {dr}? Descansar também é estratégia. 😴' },
  // Segunda
  { when: (_h, d) => d === 1, t: 'Segunda é dia de planejar a semana, {dr}. Bora com tudo!' },
  { when: (_h, d) => d === 1, t: 'Começo de semana, {dr} — o tom que você dá hoje vale os cinco dias.' },
  // Quarta (brincadeira do rosa)
  { when: (_h, d) => d === 3, t: 'Às quartas a gente usa rosa 💗 (e fecha uns acordos também).' },
  { when: (_h, d) => d === 3, t: 'Quarta-feira: metade do caminho já é sua, {dr}. Segura firme.' },
  // Sexta
  { when: (_h, d) => d === 5, t: 'Sextou! Mas o cliente não espera, né, {dr}? 😄' },
  { when: (_h, d) => d === 5, t: 'Sexta-feira: limpa a mesa e entra no fim de semana mais leve, {dr}.' },
  // Fim de semana
  { when: (_h, d) => d === 6, t: 'Sábado de escritório, {dr}? Quem joga no detalhe ganha a causa.' },
  { when: (_h, d) => d === 0, t: 'Domingo no batente, {dr}? Foco raro — aproveita o silêncio.' },
];

const HYPE: string[] = [
  'O fórum que se prepare: chegou {dr} {nome}, a mente mais afiada do escritório. ⚖️',
  'Cada processo seu é a esperança de uma família inteira. Bora mudar vidas hoje, {dr} {nome}? 💪',
  'Não existe causa difícil pra você — existe causa que ainda não conheceu o seu talento, {dr} {nome}. 🔥',
  'O mundo precisa de advogados como você, {dr} {nome}. Vamos fazer história hoje. 🚀',
  'Tem cliente dormindo tranquilo essa noite por saber que {dr} {nome} cuida do caso. Isso é grandioso. 🌟',
  'Justiça não se entrega sozinha — ela precisa de gente brilhante como você. Simbora, {dr} {nome}! ✊',
  'Hoje é dia de transformar petição em vitória. E ninguém faz isso como {dr} {nome}. 🏆',
  'Cada despacho que você lê hoje é um passo pra mudar a vida de alguém. Capricha, {dr} {nome}! 💙',
  '{dr} {nome}, sua dedicação é o que separa um bom escritório de um escritório lendário. 🦁',
  'Respira fundo, sorri: {dr} {nome} está prestes a fazer um dia incrível acontecer. ✨',
  'O talento abre portas, mas a sua garra escancara o futuro. Vamos com tudo, {dr} {nome}! 🚪➡️',
  'Banco grande, advogado maior. Hoje a razão tem nome: {dr} {nome}. ⚔️',
  'Você não trabalha com processos — você devolve dignidade às pessoas. Orgulho de você, {dr} {nome}. 🤝',
  'A toga mais elegante do dia é a sua determinação, {dr} {nome}. Bora brilhar! 🌞',
  'Disciplina vence talento quando o talento não tem disciplina — e você tem os dois, {dr} {nome}. 📚🔥',
  'Que tal começar pelo prazo mais urgente e sentir aquele gostinho de dever cumprido, {dr} {nome}? ✅',
  '{dr} {nome}, lembra: causas ganhas começam com um clique corajoso. O primeiro é agora. 🖱️⚡',
  'O sucesso ama quem aparece todos os dias. E olha quem apareceu de novo: {dr} {nome}! 👏',
  'Grandes advogados não esperam o dia perfeito — eles fazem o dia ser perfeito. Sua vez, {dr} {nome}. 🌈',
  'A próxima sentença favorável já está a caminho. Vamos buscá-la, {dr} {nome}? 🏃‍♂️💨',
  'Os bancos têm advogados de terno caro. Os clientes têm algo melhor: {dr} {nome}. 💼⚡',
  'Café na mão, autos na tela, coragem no peito — {dr} {nome} entrou no modo imparável. ☕🔥',
  'Existe um silêncio que vale ouro: o do adversário quando lê a petição de {dr} {nome}. 🤫📜',
  'Toda grande tese um dia foi só uma boa ideia teimosa. Qual é a sua de hoje, {dr} {nome}? 💡',
  'A balança da justiça pende pra quem estuda mais. Spoiler: hoje pende pra você, {dr} {nome}. ⚖️',
  'Não é sorte, é repertório — e o seu é gigante, {dr} {nome}. 📚',
  'O juiz lê centenas de peças por semana. Faça a sua ser a que ele lembra, {dr} {nome}. ✍️',
  'Cada "intimado" que aparece é um convite pra você brilhar. Aceita, {dr} {nome}? 🔔',
  'Tem advogado que conta os anos de carreira; você faz os anos contarem, {dr} {nome}. ⏳',
  'A toga não cai do céu — conquista-se despacho por despacho. Bora pro próximo, {dr} {nome}. 👩‍⚖️',
  'Hoje alguém vai dormir aliviado porque você assumiu o caso. Isso não tem preço, {dr} {nome}. 🌙',
  'Prazo apertado é adrenalina disfarçada — e você corre bem sob pressão, {dr} {nome}. 🏎️💨',
  'O Direito muda todo dia; ainda bem que estudar é o seu esporte favorito, {dr} {nome}. 🥇',
  'Grandes vitórias começam com um "vou ler esse processo agora". Sua vez, {dr} {nome}. 📂',
  'Você não é mais um(a) no fórum — é referência. Aja como tal hoje, {dr} {nome}. 🌟',
  'A melhor defesa de um cliente é ter {dr} {nome} do lado dele. Simples assim. 🛡️',
  'Transforme o "não tem jurisprudência" em "agora tem". Faça história, {dr} {nome}. 🏛️',
  'Respira. Foca. Domina. O dia é uma audiência e você é o(a) protagonista, {dr} {nome}. 🎬',
  'Quem madruga no Direito não pega só a minhoca — pega o melhor argumento. Bom dia, {dr} {nome}! 🐦',
  'A justiça pode ser lenta, mas a sua determinação é expressa. Acelera, {dr} {nome}! 🚄',
  'Cada cliente é uma história que você ajuda a ter final feliz. Capricha no enredo, {dr} {nome}. 📖',
  'Há petições que informam e petições que convencem — as suas convencem, {dr} {nome}. 🎯',
  'O segredo dos grandes não é só talento: é aparecer e caprichar todo dia, como você, {dr} {nome}. 🔁',
  'Você carrega um superpoder raro: fazer o complicado virar justiça. Usa hoje, {dr} {nome}. 🦸',
  'A caneta de {dr} {nome} pesa mais que qualquer martelo. Escreve essa história. 🖋️',
  'Disciplina é liberdade: quanto mais você organiza hoje, mais leve fica amanhã, {dr} {nome}. 🗂️',
  'O mundo tem problemas demais e gente disposta de menos — ainda bem que tem você, {dr} {nome}. 💙',
  'Se fosse fácil, não precisaria de alguém do seu calibre. Que bom que é você, {dr} {nome}. 💪',
  'Tem gente esperando há anos por justiça. Hoje você encurta essa espera, {dr} {nome}. ⏱️',
  'O nervosismo antes da audiência é só o seu talento pedindo passagem. Deixa ele brilhar, {dr} {nome}. ✨',
  'Petição protocolada é semente plantada. Hoje é dia de plantar bastante, {dr} {nome}. 🌱',
  'Davi também era o azarão — até abrir a boca (ou a petição). Vai com tudo, {dr} {nome}! 🪨',
  'O melhor argumento ainda não foi escrito porque você ainda não sentou pra escrever. Bora, {dr} {nome}. ⌨️',
  'Calma de monge, foco de atleta, garra de leão — esse é o combo {dr} {nome}. 🧘🦁',
  'A toga combina com você de um jeito que intimida o adversário. Veste o dia, {dr} {nome}. 🥋',
];

const QUOTES: { t: string; a: string }[] = [
  { t: 'A justiça atrasada nada mais é do que a injustiça manifesta.', a: 'Rui Barbosa' },
  { t: 'O direito é a arte do bom e do equânime.', a: 'Ulpiano' },
  { t: 'Onde não há justiça, é perigoso ter razão.', a: 'Francisco de Quevedo' },
  { t: 'A injustiça num lugar qualquer é uma ameaça à justiça em todos os lugares.', a: 'Martin Luther King' },
  { t: 'Lutar pelo direito é um dever de quem o tem para com a sociedade.', a: 'Rudolf von Ihering' },
  { t: 'A persistência é o caminho do êxito.', a: 'Charles Chaplin' },
  { t: 'De tanto ver triunfar as nulidades, o homem chega a desanimar da virtude. Não desanime.', a: 'Rui Barbosa' },
  { t: 'Que os vossos esforços desafiem as impossibilidades.', a: 'Charles Chaplin' },
  { t: 'Justiça é a constante e perpétua vontade de dar a cada um o que é seu.', a: 'Justiniano' },
  { t: 'Não basta saber, é preciso também aplicar; não basta querer, é preciso também agir.', a: 'Goethe' },
  { t: 'A advocacia não é profissão de covardes.', a: 'Sobral Pinto' },
  { t: 'O direito não socorre a quem dorme.', a: 'Brocardo (Dormientibus non succurrit jus)' },
  { t: 'A toga é o símbolo da igualdade de todos perante a lei.', a: 'Piero Calamandrei' },
  { t: 'Onde está a sociedade, está o direito.', a: 'Ubi societas, ibi jus' },
  { t: 'A cada um o que é seu.', a: 'Suum cuique tribuere' },
  { t: 'A coragem é a primeira das qualidades humanas, porque garante todas as outras.', a: 'Aristóteles' },
  { t: 'O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.', a: 'Winston Churchill' },
  { t: 'A disciplina é a ponte entre metas e realizações.', a: 'Jim Rohn' },
  { t: 'Ninguém é tão grande que não possa aprender, nem tão pequeno que não possa ensinar.', a: 'Ésquilo' },
  { t: 'O advogado deve ser o primeiro a acreditar na causa que defende.', a: 'Evaristo de Moraes' },
  { t: 'A esperança é o sonho do homem acordado.', a: 'Aristóteles' },
  { t: 'Tudo o que um sonho precisa para ser realizado é alguém que acredite que ele possa ser realizado.', a: 'Roberto Shinyashiki' },
  { t: 'A justiça é a verdade em ação.', a: 'Joseph Joubert' },
];

const DICAS: string[] = [
  'Comece pelo prazo mais urgente: a sensação de dever cumprido turbina o resto do dia.',
  'Responda o cliente antes que ele pergunte — confiança se constrói no detalhe.',
  'Revise a petição em voz alta: o ouvido pega o que o olho deixa passar.',
  'Bloqueie 1h sem notificações pra peça importante. Foco profundo vale por três horas distraídas.',
  'Antes de protocolar, releia o pedido: 80% das emendas nascem de um pedido mal redigido.',
  'Agende o follow-up no mesmo instante em que pensa nele — memória é traiçoeira, agenda não.',
  'Um resumo de 3 linhas no topo do processo economiza 10 minutos toda vez que você reabri-lo.',
  'Comemore as pequenas vitórias: cada prazo cumprido é combustível pro próximo.',
  'Cliente bem informado reclama menos e indica mais. Atualize antes que ele cobre.',
  'Termine o dia anotando as 3 prioridades de amanhã. Você acorda no comando, não no susto.',
  'Salve modelos das suas melhores peças: o "você do passado" é seu melhor estagiário.',
  'Antes da audiência, escreva as 3 perguntas que você NÃO quer ouvir — e prepare as respostas.',
  'Lance o prazo fatal e o de segurança na agenda no mesmo minuto em que recebe a intimação.',
  'Releia a peça da contraparte caçando o ponto fraco: ele quase sempre mora no pedido.',
  'Devolva a ligação do cliente no mesmo dia — confiança se mede em horas, não em petições.',
  'Feche cada processo do dia com a anotação do próximo passo. O "futuro você" agradece.',
  'Beba água e levante a cada hora: foco também depende do corpo, não só do café.',
  'Acordo melhor que a melhor sentença provável é vitória. Pragmatismo também é estratégia.',
  'Separe 15 min no fim da semana pra ler um informativo do STJ. Repertório se constrói pingando.',
  'Nomeie bem os arquivos do cliente hoje: você economiza horas de garimpo no futuro.',
];

const QUICK = [
  { href: '/inbox', icon: MessageSquare, label: 'Conversas', desc: 'Atender clientes', color: '#228BE6' },
  { href: '/agenda', icon: CalendarCheck, label: 'Agenda', desc: 'Prazos & audiências', color: '#02883C' },
  { href: '/processos', icon: Folder, label: 'Processos', desc: 'Carteira jurídica', color: '#7048E8' },
  { href: '/caixa-djen', icon: Newspaper, label: 'Publicações', desc: 'Intimações do dia', color: '#F76707' },
  { href: '/clientes', icon: Users, label: 'Clientes', desc: 'Quem você defende', color: '#E64980' },
  { href: '/juridico/jurimetria', icon: BarChart3, label: 'Jurimetria', desc: 'Seus números', color: '#15AABF' },
];

const CONFETTI_COLORS = ['#228BE6', '#15AABF', '#7048E8', '#F76707', '#F59F00', '#2F9E44', '#E64980', '#FA5252'];
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "Sacola embaralhada" persistida (localStorage): sorteia um índice do pool
// SEM repetir até esgotar todos — e nunca devolve o mesmo dois sorteios
// seguidos (nem na virada de ciclo). O estado vive entre cliques E acessos,
// então cada novo acesso/clique surpreende com algo ainda não visto.
function nextFromBag(key: string, length: number): number {
  if (length <= 1) return 0;
  let seen: number[] = [];
  let last = -1;
  try {
    const raw = localStorage.getItem(`bag:${key}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) seen = parsed;
    const l = Number(localStorage.getItem(`bag:last:${key}`));
    if (Number.isInteger(l)) last = l;
  } catch { /* storage indisponível — segue sem persistência */ }
  seen = seen.filter((n) => Number.isInteger(n) && n >= 0 && n < length);
  let pool: number[] = [];
  for (let i = 0; i < length; i++) if (!seen.includes(i) && i !== last) pool.push(i);
  if (pool.length === 0) {
    // ciclo completo — reembaralha, mas evita emendar com o último mostrado
    seen = [];
    for (let i = 0; i < length; i++) if (i !== last) pool.push(i);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  seen.push(chosen);
  try {
    localStorage.setItem(`bag:${key}`, JSON.stringify(seen));
    localStorage.setItem(`bag:last:${key}`, String(chosen));
  } catch { /* ignore */ }
  return chosen;
}

// ── Mensagens pendentes no chat (bloco interativo do Hub) ──
const MEDIA_PREVIEW: Record<string, string> = {
  IMAGE: '📷 Foto', AUDIO: '🎤 Áudio', VIDEO: '🎥 Vídeo', DOCUMENT: '📄 Documento',
  STICKER: 'Figurinha', LOCATION: '📍 Localização', CONTACT: '👤 Contato',
  TEMPLATE: 'Mensagem', INTERACTIVE: 'Mensagem', REACTION: 'Reação',
};
const lastPreview = (c: Conversation) => {
  const last = c.messages?.[0];
  if (!last) return 'Sem mensagens';
  return (last.content?.text as string) || MEDIA_PREVIEW[last.type] || 'Mensagem';
};
const contactLabel = (c: Conversation) =>
  c.contact?.name || (c.contact?.phone ? formatPhone(c.contact.phone) : 'Cliente');

// Respostas rápidas prontas — um toque preenche o campo (bem ágil no corre-corre).
const QUICK_REPLIES: { emoji: string; text: string }[] = [
  { emoji: '👀', text: 'Olá! Já estou verificando o seu caso e retorno em instantes. 🙏' },
  { emoji: '✅', text: 'Recebido! Obrigado pela mensagem, vou analisar e já te respondo.' },
  { emoji: '📞', text: 'Oi! Podemos falar por aqui ou prefere que eu te ligue?' },
  { emoji: '⏳', text: 'Estou cuidando do andamento do seu processo. Assim que houver novidade, te aviso por aqui.' },
  { emoji: '🙂', text: 'Bom dia! Como posso te ajudar hoje?' },
];

function relTime(iso: string | null | undefined, now: Date | null): string {
  if (!iso || !now) return '';
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Vencimento amigável (futuro): Hoje / Amanhã / Ontem / "qua, 25/06".
function relDay(iso: string | null | undefined, now: Date | null): string {
  if (!iso || !now) return '';
  const today = localDay(now);
  const diff = Math.round((new Date(iso.slice(0, 10) + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const sameLocalDay = (iso: string | null | undefined, now: Date) => !!iso && localDay(new Date(iso)) === localDay(now);

function MsgAvatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt={name} onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ backgroundColor: avatarColor(name) }}>
      {avatarInitials(name)}
    </div>
  );
}

function PendingMessages({ now, onCelebrate }: { now: Date | null; onCelebrate: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // "Esperando você" = (a) conversas atribuídas a mim, não lidas +
  // (b) conversas PENDING não lidas — quando o cliente reabre, o resolver zera o
  // assignedToId, então ninguém é "dono" e elas não cairiam no filtro de (a),
  // mas são justamente as que mais precisam de resposta.
  const qMine = useQuery({
    queryKey: ['hub', 'pending-msgs', 'mine', user?.id],
    queryFn: () => inboxService.getConversations({ limit: '40', unread: 'true', archived: 'exclude', groups: 'exclude', assignedToId: user!.id }),
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 60_000,
  });
  const qPending = useQuery({
    queryKey: ['hub', 'pending-msgs', 'pending', user?.id],
    queryFn: () => inboxService.getConversations({ limit: '40', unread: 'true', archived: 'exclude', groups: 'exclude', status: 'PENDING' }),
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 60_000,
  });
  const isLoading = qMine.isLoading || qPending.isLoading;

  const pending = useMemo(() => {
    const myId = user?.id;
    const byId = new Map<string, Conversation>();
    // (a) minhas atribuídas — entram todas.
    // (b) PENDING — só as sem dono ou já minhas (nunca a pendência de outro advogado).
    const add = (list: Conversation[], onlyMineOrUnclaimed: boolean) => {
      for (const c of list) {
        if (c.messages?.[0]?.direction !== 'INBOUND' || handled.has(c.id)) continue;
        if (onlyMineOrUnclaimed && c.assignedToId && c.assignedToId !== myId) continue;
        byId.set(c.id, c);
      }
    };
    add(qMine.data?.conversations ?? [], false);
    add(qPending.data?.conversations ?? [], true);
    return [...byId.values()].sort(
      (a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''),
    );
  }, [qMine.data, qPending.data, handled, user?.id]);

  const shown = showAll ? pending.slice(0, 12) : pending.slice(0, 5);

  const send = async (conv: Conversation) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await inboxService.sendMessage({ conversationId: conv.id, type: 'TEXT', content: { text: body } });
      await inboxService.markAsRead(conv.id).catch(() => undefined);
      setHandled((s) => new Set(s).add(conv.id));
      setOpenId(null);
      setText('');
      onCelebrate();
      toast.success(`Resposta enviada para ${contactLabel(conv)} 🚀`);
      qc.invalidateQueries({ queryKey: ['hub', 'pending-msgs'] });
    } catch {
      toast.error('Não consegui enviar daqui. Abra a conversa e responda por lá.');
    } finally {
      setSending(false);
    }
  };

  const toggleReply = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    setText('');
  };

  return (
    <div className="welcome-pop flex w-full flex-col rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60" style={{ animationDelay: '0.21s' }}>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <MessageSquare className="h-3.5 w-3.5 text-[#228BE6]" />
          Mensagens esperando você
          {pending.length > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E03131] px-1.5 text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </p>
        <Link href="/inbox" className="text-[11px] font-semibold text-[#228BE6] hover:underline">abrir chat →</Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-2 py-6 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Procurando mensagens novas…
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-6 text-center">
          <Inbox className="h-7 w-7 text-[#02883C]" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Tudo respondido! 🎉</p>
          <p className="text-xs text-zinc-400">Nenhum cliente seu esperando resposta. Suas conversas estão em dia — manda ver no resto do dia!</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {shown.map((conv) => {
            const name = contactLabel(conv);
            const isOpen = openId === conv.id;
            const unread = conv.unreadCount ?? 0;
            return (
              <div key={conv.id} className={`rounded-xl transition ${isOpen ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}`}>
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <Link href={`/inbox?conversationId=${conv.id}`} className="group flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="relative">
                      <MsgAvatar name={name} url={conv.contact?.avatarUrl ?? null} />
                      {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E03131] px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-zinc-800 group-hover:text-[#228BE6] dark:text-zinc-100">{name}</span>
                        <span className="shrink-0 text-[11px] font-medium text-zinc-400">· {relTime(conv.lastMessageAt, now)}</span>
                      </div>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{lastPreview(conv)}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => toggleReply(conv.id)}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${isOpen ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-[#228BE6]/10 text-[#228BE6] hover:bg-[#228BE6]/20'}`}
                  >
                    {isOpen ? <X className="h-3.5 w-3.5" /> : <CornerUpLeft className="h-3.5 w-3.5" />}
                    {isOpen ? 'Fechar' : 'Responder'}
                  </button>
                </div>

                {isOpen && (
                  <div className="welcome-pop space-y-2 px-2 pb-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_REPLIES.map((r) => (
                        <button
                          key={r.text}
                          onClick={() => setText(r.text)}
                          className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition hover:border-[#228BE6]/40 hover:text-[#228BE6] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {r.emoji} {r.text.length > 28 ? r.text.slice(0, 28) + '…' : r.text}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-end gap-2">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(conv); } }}
                        rows={2}
                        autoFocus
                        placeholder={`Responder ${name}…`}
                        className="min-h-9 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => send(conv)}
                        disabled={!text.trim() || sending}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#228BE6] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1c7ed6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar
                      </button>
                    </div>
                    <p className="px-0.5 text-[10px] text-zinc-400">Enter envia · Shift+Enter quebra linha · vai pelo WhatsApp do cliente</p>
                  </div>
                )}
              </div>
            );
          })}

          {pending.length > 5 && (
            <button onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-[#228BE6] hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <Sparkles className="h-3 w-3" />
              {showAll ? 'mostrar menos' : `ver mais ${pending.length - 5} aguardando`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Contador animado (count-up) — anti-tédio nos números.
function useCountUp(target: number, on: boolean, ms = 750) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) { setN(0); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on, ms]);
  return n;
}

function StatCard({ href, icon: Icon, color, value, label, on }: { href: string; icon: React.ElementType; color: string; value: number; label: string; on: boolean }) {
  const n = useCountUp(value, on);
  return (
    <Link href={href} className="group flex flex-col items-center rounded-xl border border-zinc-200/70 bg-white/70 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <Icon className="h-5 w-5" style={{ color }} />
      <span className="mt-1 text-2xl font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{on ? n : '·'}</span>
      <span className="text-center text-[11px] leading-tight text-zinc-400">{label}</span>
    </Link>
  );
}

const brlInt = (n: number) => 'R$ ' + Math.round(n || 0).toLocaleString('pt-BR');
const mesLabel = (ym: string) => {
  const [y, m] = (ym || '').split('-').map(Number);
  if (!y || !m) return ym || '';
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

function MoneyStat({ icon: Icon, color, value, label, on }: { icon: React.ElementType; color: string; value: number; label: string; on: boolean }) {
  const n = useCountUp(Math.round(value || 0), on);
  return (
    <Link href="/financeiro" className="group flex flex-col items-center rounded-xl border border-zinc-200/70 bg-white/70 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <Icon className="h-5 w-5" style={{ color }} />
      <span className="mt-1 text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{on ? 'R$ ' + n.toLocaleString('pt-BR') : '·'}</span>
      <span className="text-center text-[11px] leading-tight text-zinc-400">{label}</span>
    </Link>
  );
}

// Visão financeira pessoal do advogado (sócio e associado), no hub. Reusa GET
// /financeiro/meu (dashboardLimitado): recebido, sua parte, a receber e o
// provável dos casos em andamento + mini-histórico e melhor mês.
function MeuFinanceiro({ on, enabled }: { on: boolean; enabled: boolean }) {
  const finQ = useQuery({
    queryKey: ['hub', 'meu-financeiro'],
    queryFn: () => financeiroService.meuFinanceiro(),
    enabled,
    staleTime: 300_000,
    retry: 1,
  });
  const d = finQ.data;
  // Sem acesso / sem dado / vazio → não renderiza (mantém o hub limpo).
  if (!d || d.semAcesso || d.vazio || !d.resumo) return null;
  const r = d.resumo;
  const provavel = d.projecaoCasos?.liquidoProvavel ?? 0;
  // Nada relevante ainda (tudo zero) → também esconde.
  if ((r.recebido || 0) + (r.aReceber || 0) + (r.minhaParte || 0) + provavel + (r.nCasos || 0) === 0) return null;
  const serie = (d.serie ?? []).slice(-8);
  const maxSerie = Math.max(1, ...serie.map((s) => s.valor));
  const melhor = d.melhorMes;
  return (
    <div className="welcome-pop mt-3 w-full rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60" style={{ animationDelay: '0.205s' }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Wallet className="h-4 w-4 text-[#02883C]" /> Seu financeiro
        </p>
        <Link href="/financeiro" className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline">
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MoneyStat icon={CircleDollarSign} color="#02883C" value={r.recebido} label="recebido" on={on} />
        <MoneyStat icon={HandCoins} color="#228BE6" value={r.minhaParte} label="sua parte" on={on} />
        <MoneyStat icon={Clock} color="#F08C00" value={r.aReceber} label="a receber" on={on} />
        <MoneyStat icon={TrendingUp} color="#7048E8" value={provavel} label="provável (em processo)" on={on} />
      </div>
      {(serie.length > 0 || melhor) && (
        <div className="mt-3 flex items-end justify-between gap-4">
          {serie.length > 0 && (
            <div className="flex flex-1 items-end gap-1" style={{ height: 52 }}>
              {serie.map((s) => (
                <div key={s.mes} className="flex flex-1 flex-col items-center justify-end" title={`${s.mes}: ${brlInt(s.valor)}`}>
                  <div className="w-full rounded-t bg-[#02883C]/70" style={{ height: `${Math.max(3, (s.valor / maxSerie) * 40)}px` }} />
                  <span className="mt-1 text-[9px] text-zinc-400">{mesLabel(s.mes)}</span>
                </div>
              ))}
            </div>
          )}
          {melhor && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">Melhor mês</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{brlInt(melhor.valor)}</p>
              <p className="text-[10px] text-zinc-400">{mesLabel(melhor.mes)}</p>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-zinc-400">
        {r.nClientes} cliente(s) · {r.nCasos ?? 0} caso(s){d.projecaoCasos?.isSocio ? ' · sócio' : ''}
      </p>
    </div>
  );
}

const KIND_META: Record<string, { icon: React.ElementType; color: string }> = {
  tarefa: { icon: ClipboardList, color: '#23CBFF' },
  prazo: { icon: Clock, color: '#F59F00' },
  fatal: { icon: AlarmClock, color: '#E03131' },
  audiencia: { icon: Gavel, color: '#02883C' },
};

function NewTodayAgenda({ now }: { now: Date | null }) {
  const { user } = useAuthStore();
  const [showAll, setShowAll] = useState(false);

  // Só os itens dos quais ESTE advogado é responsável (assigneeId / assignedToId).
  const tasksQ = useQuery({
    queryKey: ['hub', 'new-tasks', user?.id],
    queryFn: () => tasksService.list({ assigneeId: user!.id }),
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: 1,
  });
  const dlQ = useQuery({
    queryKey: ['hub', 'new-deadlines', user?.id],
    queryFn: () => deadlinesService.list({ assignedToId: user!.id }),
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: 1,
  });

  type Novo = { id: string; kind: 'tarefa' | 'prazo' | 'fatal'; title: string; caso?: string | null; due?: string | null; createdAt: string };
  const items = useMemo<Novo[]>(() => {
    if (!now) return [];
    const list: Novo[] = [];
    (tasksQ.data ?? [])
      .filter((t) => (t.status === 'TODO' || t.status === 'DOING') && sameLocalDay(t.createdAt, now))
      .forEach((t) => list.push({ id: 't' + t.id, kind: 'tarefa', title: t.title, caso: t.case?.title, due: t.dueAt, createdAt: t.createdAt }));
    (dlQ.data ?? [])
      .filter((d) => d.status === 'OPEN' && sameLocalDay(d.createdAt, now))
      .forEach((d) => list.push({ id: 'd' + d.id, kind: d.type === 'FATAL' ? 'fatal' : 'prazo', title: d.title, caso: d.case?.title, due: d.safeDate || d.dueDate, createdAt: d.createdAt }));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [now, tasksQ.data, dlQ.data]);

  const loading = tasksQ.isLoading || dlQ.isLoading;
  const shown = showAll ? items.slice(0, 12) : items.slice(0, 5);

  return (
    <div className="welcome-pop w-full rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60" style={{ animationDelay: '0.215s' }}>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <CalendarPlus className="h-3.5 w-3.5 text-[#02883C]" />
          Novos na agenda hoje
          {items.length > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#02883C] px-1.5 text-[10px] font-bold text-white">
              {items.length}
            </span>
          )}
        </p>
        <Link href="/agenda" className="text-[11px] font-semibold text-[#228BE6] hover:underline">ver agenda →</Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-6 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Conferindo o que entrou hoje…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-2 py-6 text-center">
          <ListChecks className="h-7 w-7 text-zinc-300" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Nada novo hoje</p>
          <p className="text-xs text-zinc-400">Nenhum prazo ou tarefa seu foi adicionado à agenda hoje.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {shown.map((it) => {
            const m = KIND_META[it.kind];
            return (
              <Link key={it.id} href="/agenda" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.color}1A` }}>
                  <m.icon className="h-4 w-4" style={{ color: m.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-700 dark:text-zinc-200">{it.title}{it.caso ? <span className="text-zinc-400"> · {it.caso}</span> : null}</span>
                  <span className="block text-[10px] text-zinc-400">
                    {it.kind === 'fatal' ? 'Prazo fatal' : it.kind === 'prazo' ? 'Prazo' : 'Tarefa'} · adicionado {hhmm(it.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {it.due ? (
                    <span className={`text-xs font-semibold ${it.kind === 'fatal' ? 'text-[#E03131]' : 'text-zinc-500 dark:text-zinc-400'}`}>{relDay(it.due, now)}</span>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">sem data</span>
                  )}
                </span>
              </Link>
            );
          })}

          {items.length > 5 && (
            <button onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-[#228BE6] hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <Sparkles className="h-3 w-3" />
              {showAll ? 'mostrar menos' : `ver mais ${items.length - 5} de hoje`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Início: casos que pedem atenção do responsável — pré-processual (cobrar/
// acompanhar docs) e casos parados há muito tempo na fase (acelerar).
function AtencaoCard({ titulo, cor, href, itens, vazio }: { titulo: string; cor: string; href: string; itens: { id: string; nome: string; fase: string; dias: number }[]; vazio: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>{titulo}</p>
        <Link href={href} className="text-[11px] font-semibold text-[#228BE6] hover:underline">ver →</Link>
      </div>
      {itens.length === 0 ? (
        <p className="px-1 py-2 text-xs text-zinc-400">{vazio}</p>
      ) : (
        <div className="space-y-0.5">
          {itens.map((c) => (
            <Link key={c.id} href={`/processos/${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">{c.nome}<span className="text-zinc-400"> · {c.fase}</span></span>
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: c.dias >= 45 ? 'rgba(224,49,49,0.12)' : 'rgba(245,159,0,0.14)', color: c.dias >= 45 ? '#E03131' : '#B8860B' }}>{c.dias}d</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CasosParaAtencao() {
  const { user } = useAuthStore();
  const q = useQuery({
    queryKey: ['hub', 'kanban-atencao', user?.id],
    queryFn: () => legalCasesService.kanban({ responsibleId: user!.id }),
    enabled: !!user?.id, staleTime: 300_000, retry: 1,
  });
  const { pre, parados } = useMemo(() => {
    const d = q.data;
    if (!d) return { pre: [] as { id: string; nome: string; fase: string; dias: number }[], parados: [] as { id: string; nome: string; fase: string; dias: number }[] };
    const preKeys = new Set(d.phases.filter((p) => p.lane === 'pre').map((p) => p.key));
    const labelOf = (k: string) => (d.phases.find((p) => p.key === k)?.label ?? k).replace(/^\d+(\.\d+)?\.\s*/, '');
    const mk = (c: typeof d.cards[number]) => ({ id: c.id, nome: c.client || c.title, fase: labelOf(c.phase), dias: c.diasNaFase ?? 0 });
    const pre = d.cards.filter((c) => preKeys.has(c.phase)).sort((a, b) => (b.diasNaFase ?? 0) - (a.diasNaFase ?? 0)).slice(0, 6).map(mk);
    const parados = d.cards.filter((c) => !preKeys.has(c.phase) && (c.diasNaFase ?? 0) >= 25).sort((a, b) => (b.diasNaFase ?? 0) - (a.diasNaFase ?? 0)).slice(0, 6).map(mk);
    return { pre, parados };
  }, [q.data]);
  if (!q.data || (pre.length === 0 && parados.length === 0)) return null;
  return (
    <div className="welcome-pop mt-9 grid w-full gap-3 text-left sm:grid-cols-2" style={{ animationDelay: '0.23s' }}>
      <AtencaoCard titulo="Pré-processual — acompanhar" cor="#e11970" href="/juridico/pre-processual" itens={pre} vazio="Nada pendente aqui 🎉" />
      <AtencaoCard titulo="Parados — acelerar" cor="#E03131" href="/juridico/kanban" itens={parados} vazio="Tudo em movimento 🚀" />
    </div>
  );
}

// Notícias do dia (mundo + jurídico), pesquisadas pela IA e cacheadas 1×/dia.
function NewsCol({ titulo, emoji, cor, itens, loading }: { titulo: string; emoji: string; cor: string; itens: HubNewsItem[]; loading: boolean }) {
  return (
    <div className="welcome-pop w-full rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>
        <span>{emoji}</span> {titulo}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 px-2 py-5 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Buscando as notícias de hoje…</div>
      ) : itens.length === 0 ? (
        <p className="px-2 py-3 text-xs text-zinc-400">Sem novidades por aqui hoje.</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((n, i) => (
            <li key={i}>
              <a
                href={n.url || `https://www.google.com/search?q=${encodeURIComponent(n.t)}`}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <p className="flex items-start gap-1 text-sm font-semibold leading-snug text-zinc-800 group-hover:text-[#228BE6] dark:text-zinc-100 dark:group-hover:text-[#74b1f7]">
                  <span className="min-w-0 flex-1">{n.t}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-300 transition group-hover:text-[#228BE6]" />
                </p>
                {n.d && <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{n.d}</p>}
                {n.fonte && <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{n.fonte}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HojeNoMundo() {
  const q = useQuery({
    queryKey: ['hub', 'news'],
    queryFn: () => dashboardService.hubNews(),
    staleTime: 5 * 60_000,
    retry: 1,
    // Enquanto o backend está buscando (background), refaz a cada 8s até chegar.
    refetchInterval: (query) => (query.state.data?.generating ? 8000 : false),
  });
  const [open, setOpen] = useState(true);
  const mundo = q.data?.mundo ?? [];
  const juridico = q.data?.juridico ?? [];
  const loading = q.isLoading || !!q.data?.generating;
  // Esconde só quando realmente não há nada e não está gerando.
  if (!loading && !mundo.length && !juridico.length) return null;
  return (
    <div className="welcome-pop mt-9 w-full text-left" style={{ animationDelay: '0.235s' }}>
      <button onClick={() => setOpen((o) => !o)} className="mb-2 flex w-full items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200">
        <Newspaper className="h-3.5 w-3.5" /> Notícias do dia
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="grid w-full items-start gap-4 lg:grid-cols-2">
          <NewsCol titulo="Hoje no mundo" emoji="🌎" cor="#228BE6" itens={mundo} loading={loading && !mundo.length} />
          <NewsCol titulo="No jurídico hoje" emoji="⚖️" cor="#7048e8" itens={juridico} loading={loading && !juridico.length} />
        </div>
      )}
    </div>
  );
}

export default function InicioPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [dicaIdx, setDicaIdx] = useState(0);
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [ctxIdx, setCtxIdx] = useState(0);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setMounted(true);
    setMsgIdx(nextFromBag('hype', HYPE.length));
    setQuoteIdx(nextFromBag('quote', QUOTES.length));
    setDicaIdx(nextFromBag('dica', DICAS.length));
    setEmojiIdx(nextFromBag('emoji', GREET_EMOJI.length));
    setCtxIdx(nextFromBag('ctx', 64));
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const first = firstNameOf(user?.name, user?.email);
  const dr = honorificOf(first);
  const hour = now?.getHours() ?? 12;
  const saud = saudacaoFor(hour);
  const msg = HYPE[msgIdx].replace(/\{dr\}/g, dr).replace(/\{nome\}/g, first);
  const quote = QUOTES[quoteIdx];
  const dica = DICAS[dicaIdx];
  const ctxHour = now?.getHours() ?? -1;
  const ctxDay = now?.getDay() ?? -1;
  const ctxPhrase = useMemo(() => {
    if (ctxHour < 0) return '';
    const cands = CTX_PHRASES.filter((p) => p.when(ctxHour, ctxDay));
    const base = cands.length ? cands[ctxIdx % cands.length].t : (DOW_MSG[ctxDay] ?? '');
    return base.replace(/\{dr\}/g, dr).replace(/\{nome\}/g, first);
  }, [ctxHour, ctxDay, ctxIdx, dr, first]);

  const tasksQ = useQuery({ queryKey: ['hub', 'tasks', user?.id], queryFn: () => tasksService.list({ assigneeId: user!.id }), enabled: mounted && !!user?.id, staleTime: 60_000, retry: 1 });
  const dlQ = useQuery({ queryKey: ['hub', 'deadlines', user?.id], queryFn: () => deadlinesService.list({ assignedToId: user!.id }), enabled: mounted && !!user?.id, staleTime: 60_000, retry: 1 });
  const evQ = useQuery({ queryKey: ['hub', 'events', user?.id], queryFn: () => calendarService.list({ assignedToId: user!.id }), enabled: mounted && !!user?.id, staleTime: 60_000, retry: 1 });
  const casesQ = useQuery({ queryKey: ['hub', 'cases', user?.id], queryFn: () => legalCasesService.list({ responsibleId: user!.id }), enabled: mounted && !!user?.id, staleTime: 300_000, retry: 1 });

  const { stats, proximos } = useMemo(() => {
    const today = now ? localDay(now) : '';
    const same = (iso?: string | null) => !!iso && iso.slice(0, 10) === today;
    const tasks = tasksQ.data ?? [];
    const dls = dlQ.data ?? [];
    const evs = evQ.data ?? [];
    const dlsOpen = dls.filter((d) => d.status === 'OPEN');
    const hoje =
      tasks.filter((t) => t.status === 'TODO' && same(t.dueAt)).length +
      dlsOpen.filter((d) => same(d.safeDate) || same(d.dueDate)).length +
      evs.filter((e) => same(e.startsAt)).length;
    const concluidas = tasks.filter((t) => t.status === 'DONE' && same(t.completedAt)).length;
    const daysTo = (iso: string) => Math.ceil((new Date(iso.slice(0, 10) + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
    const fatais = dlsOpen.filter((d) => d.type === 'FATAL' && daysTo(d.dueDate) >= 0 && daysTo(d.dueDate) <= 7).length;

    type Up = { id: string; date: string; title: string; kind: keyof typeof KIND_META; hasTime: boolean; caso?: string | null };
    const list: Up[] = [];
    tasks.filter((t) => t.status === 'TODO' && t.dueAt).forEach((t) => list.push({ id: 't' + t.id, date: t.dueAt!, title: t.title, kind: 'tarefa', hasTime: false, caso: t.case?.title }));
    dlsOpen.forEach((d) => list.push({ id: 'd' + d.id, date: d.safeDate || d.dueDate, title: d.title, kind: d.type === 'FATAL' ? 'fatal' : 'prazo', hasTime: false, caso: d.case?.title }));
    evs.forEach((e) => list.push({ id: 'e' + e.id, date: e.startsAt, title: e.title, kind: 'audiencia', hasTime: true, caso: e.case?.title }));
    const upcoming = today
      ? list.filter((i) => i.date.slice(0, 10) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
      : [];

    return {
      stats: { hoje, fatais, concluidas, processos: (casesQ.data ?? []).length, loading: tasksQ.isLoading || dlQ.isLoading || evQ.isLoading },
      proximos: upcoming,
    };
  }, [now, tasksQ.data, dlQ.data, evQ.data, casesQ.data, tasksQ.isLoading, dlQ.isLoading, evQ.isLoading]);

  const relDate = (iso: string) => {
    const today = now ? localDay(now) : '';
    const diff = Math.round((new Date(iso.slice(0, 10) + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const confetti = useMemo(
    () =>
      Array.from({ length: 90 }, () => ({
        left: Math.random() * 100,
        bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.5,
        dur: 2.6 + Math.random() * 2.4,
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst, mounted],
  );

  const novoIncentivo = () => {
    setMsgIdx(nextFromBag('hype', HYPE.length));
    setQuoteIdx(nextFromBag('quote', QUOTES.length));
    setDicaIdx(nextFromBag('dica', DICAS.length));
    setEmojiIdx(nextFromBag('emoji', GREET_EMOJI.length));
    setCtxIdx(nextFromBag('ctx', 64));
    setBurst((b) => b + 1);
  };

  const statOn = mounted && !stats.loading;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin">
    <div className="relative flex min-h-full flex-col items-center justify-start px-6 py-8">
      <div className="welcome-gradient pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#228BE6]/10 via-[#7048E8]/10 to-[#15AABF]/10 dark:from-[#228BE6]/15 dark:via-[#7048E8]/15 dark:to-[#15AABF]/10" />

      {mounted && (
        <div key={burst} className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen overflow-hidden">
          {confetti.map((c, i) => (
            <span key={i} className="absolute top-0" style={{ left: `${c.left}%`, width: c.size, height: c.size * (c.round ? 1 : 1.6), backgroundColor: c.bg, borderRadius: c.round ? '9999px' : '2px', animation: `confetti-fall ${c.dur}s linear ${c.delay}s forwards` }} />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-5xl text-center">
        {/* Saudação */}
        <h1 className="welcome-pop text-3xl font-bold tracking-tight text-[#202124] dark:text-zinc-50 sm:text-4xl" style={{ animationDelay: '0.05s' }}>
          {saud},{' '}
          <span className="bg-gradient-to-r from-[#228BE6] via-[#7048E8] to-[#E64980] bg-clip-text text-transparent">{dr} {first}</span>{' '}
          <span className="welcome-float inline-block">{GREET_EMOJI[emojiIdx]}</span>
        </h1>
        {mounted && ctxPhrase && <p className="welcome-pop mt-2 text-sm font-medium text-zinc-400" style={{ animationDelay: '0.08s' }}>{ctxPhrase}</p>}

        {/* Incentivo rotativo */}
        <p key={msgIdx} className="welcome-pop mx-auto mt-4 max-w-2xl text-lg font-medium leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-xl" style={{ animationDelay: '0.1s' }}>
          {mounted ? msg : ' '}
        </p>

        <button onClick={novoIncentivo} className="welcome-pop mt-4 inline-flex items-center gap-2 rounded-full bg-[#228BE6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#1c7ed6] active:scale-95" style={{ animationDelay: '0.15s' }}>
          <PartyPopper className="h-4 w-4" />
          Me motiva de novo
        </button>

        {/* Seus números (com count-up) */}
        {mounted && (
          <div className="welcome-pop mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '0.2s' }}>
            <StatCard href="/agenda" icon={CalendarClock} color="#228BE6" value={stats.hoje} label="compromissos hoje" on={statOn} />
            <StatCard href="/agenda" icon={AlarmClock} color="#E03131" value={stats.fatais} label="prazos fatais (7d)" on={statOn} />
            <StatCard href="/agenda" icon={CheckCircle2} color="#02883C" value={stats.concluidas} label="concluídas hoje" on={statOn} />
            <StatCard href="/processos" icon={Briefcase} color="#7048E8" value={stats.processos} label="processos seus" on={statOn} />
          </div>
        )}

        {/* Seu financeiro (visão pessoal do advogado — sócio e associado) */}
        {mounted && <MeuFinanceiro on={statOn} enabled={!!user?.id} />}

        {/* Painel — 2 colunas em telas largas: mensagens | agenda + compromissos */}
        {mounted && (
          <div className="welcome-pop mt-4 grid w-full items-stretch gap-4 text-left lg:grid-cols-2" style={{ animationDelay: '0.21s' }}>
            <PendingMessages now={now} onCelebrate={() => setBurst((b) => b + 1)} />
            <div className="flex flex-col gap-4">
              <NewTodayAgenda now={now} />
              {proximos.length > 0 && (
                <div className="welcome-pop w-full rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60" style={{ animationDelay: '0.22s' }}>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Próximos compromissos</p>
                    <Link href="/agenda" className="text-[11px] font-semibold text-[#228BE6] hover:underline">ver agenda →</Link>
                  </div>
                  <div className="space-y-0.5">
                    {proximos.map((p) => {
                      const m = KIND_META[p.kind];
                      return (
                        <Link key={p.id} href="/agenda" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                          <m.icon className="h-4 w-4 shrink-0" style={{ color: m.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">{p.title}{p.caso ? <span className="text-zinc-400"> · {p.caso}</span> : null}</span>
                          <span className="shrink-0 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {relDate(p.date)}{p.hasTime ? ` · ${new Date(p.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Casos que pedem atenção — largura total */}
        {mounted && <CasosParaAtencao />}

        {/* Atalhos */}
        <div className="welcome-pop mt-9" style={{ animationDelay: '0.26s' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Por onde vamos começar?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK.map((q) => (
              <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-white/70 p-3.5 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-[#228BE6]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-[#228BE6]/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${q.color}1A`, color: q.color }}><q.icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">{q.label}</span>
                  <span className="block text-xs text-zinc-400">{q.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-[#228BE6]" />
              </Link>
            ))}
          </div>
        </div>

        {/* Frase + Dica do dia */}
        {mounted && (
          <div className="welcome-pop mt-9 grid gap-3 text-left sm:grid-cols-2" style={{ animationDelay: '0.3s' }}>
            <div key={'q' + quoteIdx} className="welcome-pop rounded-2xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7048E8]"><Quote className="h-3.5 w-3.5" />Frase do dia</div>
              <p className="mt-1.5 text-sm font-medium italic leading-relaxed text-zinc-600 dark:text-zinc-300">"{quote.t}"</p>
              <p className="mt-1 text-xs font-semibold text-zinc-400">— {quote.a}</p>
            </div>
            <div key={'d' + dicaIdx} className="welcome-pop rounded-2xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#F59F00]"><Lightbulb className="h-3.5 w-3.5" />Dica do dia</div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{dica}</p>
            </div>
          </div>
        )}

        {/* Notícias do dia — mundo + jurídico (no fim da página, colapsável, clicável) */}
        {mounted && <HojeNoMundo />}

        <p className="welcome-pop mt-8 text-sm text-zinc-400" style={{ animationDelay: '0.34s' }}>
          Hoje é um ótimo dia pra mudar a vida de alguém. Vamos? ⚖️✨
        </p>
      </div>
    </div>
    </div>
  );
}
