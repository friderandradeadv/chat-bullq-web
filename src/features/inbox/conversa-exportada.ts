import { api } from '@/lib/api';

/** Espelho do retorno de GET /conversations/:id/export. */
export interface MensagemExportada {
  id: string;
  at: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  author: string;
  authorKind: 'cliente' | 'humano' | 'robo' | 'sistema';
  text: string | null;
  caption: string | null;
  fileName: string | null;
  mimeType: string | null;
  mediaUrl: string | null;
  mediaError: string | null;
  transcription: string | null;
  transcriptionKind: 'audio' | 'image' | null;
  transcriptionError: string | null;
  location: { latitude: number; longitude: number; label: string | null } | null;
  contactCard: { name: string | null; phone: string | null } | null;
  revoked: boolean;
  edited: boolean;
  status: string;
  conversationId: string;
  channelName: string;
}

export interface ConversaExportada {
  contact: { name: string; phone: string | null };
  isGroup: boolean;
  channels: Array<{ name: string; phoneNumber: string | null }>;
  conversationCount: number;
  generatedAt: string;
  stats: { messages: number; audios: number; audiosTranscribed: number; mediaMissing: number };
  messages: MensagemExportada[];
}

export async function buscarConversaExportada(
  conversationId: string,
  opts: { transcrever: boolean },
): Promise<ConversaExportada> {
  const { data } = await api.get(`/conversations/${conversationId}/export`, {
    params: { transcribe: opts.transcrever ? '1' : '0' },
    // Transcrever dezenas de áudios leva minutos — o timeout padrão (15 s)
    // abortaria no meio, com a transcrição já paga.
    timeout: 10 * 60 * 1000,
  });
  return (data.data ?? data) as ConversaExportada;
}

const FUSO = 'America/Sao_Paulo';

export function dataHora(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }),
  };
}

export function dataPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: FUSO,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function linkMapa(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** Só URL de verdade vai para o .txt — `data:` é a mídia inteira em base64. */
function linkPublico(url: string | null) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** Corpo de uma mensagem no .txt, em linhas (a 1ª vai na linha do cabeçalho). */
function corpoTxt(m: MensagemExportada): string[] {
  if (m.revoked) return ['Mensagem apagada'];
  const link = linkPublico(m.mediaUrl);
  const linhas: string[] = [];
  switch (m.type) {
    case 'AUDIO':
      linhas.push('🎤 Áudio (arquivo anexado)');
      if (m.transcription) linhas.push(`[Transcrição] ${m.transcription}`);
      else linhas.push('[Áudio não transcrito]');
      break;
    case 'IMAGE':
      linhas.push('📷 Imagem (arquivo anexado)');
      if (m.caption) linhas.push(m.caption);
      if (m.transcription) linhas.push(`[Conteúdo da imagem] ${m.transcription}`);
      break;
    case 'VIDEO':
      linhas.push('🎥 Vídeo (arquivo anexado)');
      if (m.caption) linhas.push(m.caption);
      break;
    case 'DOCUMENT':
      linhas.push(`📄 ${m.fileName || 'Documento'} (arquivo anexado)`);
      if (m.caption) linhas.push(m.caption);
      break;
    case 'STICKER':
      linhas.push('figurinha omitida');
      break;
    case 'LOCATION':
      linhas.push(
        m.location
          ? `📍 Localização${m.location.label ? ` (${m.location.label})` : ''}: ${linkMapa(m.location.latitude, m.location.longitude)}`
          : '📍 Localização',
      );
      break;
    case 'CONTACT':
      linhas.push(
        `👤 Contato: ${[m.contactCard?.name, m.contactCard?.phone].filter(Boolean).join(' — ') || 'cartão de contato'}`,
      );
      break;
    default:
      linhas.push(m.text || m.caption || `[${m.type.toLowerCase()}]`);
  }
  if (link && ['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(m.type)) linhas.push(`🔗 ${link}`);
  if (m.edited) linhas[linhas.length - 1] += ' <Mensagem editada>';
  return linhas.flatMap((l) => l.split('\n'));
}

/** O .txt no formato do "Exportar conversa" do WhatsApp:
 *  `dd/mm/aaaa hh:mm - Autor: mensagem`, linhas seguintes continuam a mensagem. */
export function montarTxt(c: ConversaExportada): string {
  const linhas: string[] = [];
  const agora = dataHora(c.generatedAt);
  linhas.push(
    `Conversa do WhatsApp com ${c.contact.name}${c.contact.phone ? ` (${c.contact.phone})` : ''}`,
    `Exportada do Hub Frider Andrade em ${agora.data} às ${agora.hora}`,
    `${c.stats.messages} mensagens · ${c.stats.audios} áudios (${c.stats.audiosTranscribed} transcritos)` +
      (c.conversationCount > 1 ? ` · ${c.conversationCount} conversas (${c.channels.map((x) => x.name).join(', ')})` : ''),
    '',
  );
  let canal: string | null = null;
  for (const m of c.messages) {
    const { data, hora } = dataHora(m.at);
    if (c.conversationCount > 1 && m.channelName !== canal) {
      canal = m.channelName;
      linhas.push(`${data} ${hora} - Conversa pelo número ${canal}`);
    }
    const [primeira, ...resto] = corpoTxt(m);
    linhas.push(`${data} ${hora} - ${m.author}: ${primeira}`, ...resto);
  }
  return linhas.join('\n') + '\n';
}

export function nomeDoArquivo(c: ConversaExportada, ext: string) {
  const nome = c.contact.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'cliente';
  return `Conversa do WhatsApp com ${nome}.${ext}`;
}
