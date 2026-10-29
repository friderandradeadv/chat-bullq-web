'use client';

import { Suspense, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Loader2, MapPin, Mic, Printer, UserRound, Video } from 'lucide-react';
import {
  buscarConversaExportada,
  dataHora,
  dataPorExtenso,
  linkMapa,
  type ConversaExportada,
  type MensagemExportada,
} from '@/features/inbox/conversa-exportada';

/** ABA PRÓPRIA da versão de impressão da conversa: o "print" da conversa
 *  inteira do cliente, no visual do WhatsApp, com as mídias na página e os
 *  áudios transcritos. A URL carrega só o id da conversa (`?id=…&t=1`). */

export default function ConversaParaImpressaoPage() {
  return (
    <Suspense fallback={<Aviso texto="Carregando…" />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const [conversa, setConversa] = useState<ConversaExportada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [transcrevendo, setTranscrevendo] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('id');
    if (!id) return setErro('Link sem referência da conversa.');
    const transcrever = q.get('t') !== '0';
    setTranscrevendo(transcrever);
    buscarConversaExportada(id, { transcrever })
      .then(setConversa)
      .catch((err) => setErro(err?.response?.data?.message || 'Não consegui carregar a conversa.'));
  }, []);

  useEffect(() => {
    if (conversa) document.title = `Conversa do WhatsApp com ${conversa.contact.name}`;
  }, [conversa]);

  if (erro) return <Aviso texto={erro} />;
  if (!conversa) {
    return (
      <Aviso
        carregando
        texto={
          transcrevendo
            ? 'Montando a conversa e transcrevendo os áudios… com muitos áudios leva alguns minutos.'
            : 'Montando a conversa…'
        }
      />
    );
  }
  return <Conversa c={conversa} />;
}

function Conversa({ c }: { c: ConversaExportada }) {
  const primeira = c.messages[0];
  const ultima = c.messages[c.messages.length - 1];
  const gerada = dataHora(c.generatedAt);
  const faltam = c.stats.audios - c.stats.audiosTranscribed;

  let diaAnterior = '';
  let canalAnterior = '';
  let autorAnterior = '';

  return (
    <div className="conversa-impressao min-h-screen" style={{ background: '#efeae2', color: '#111b21' }}>
      <style>{`
        .conversa-impressao, .conversa-impressao * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { size: A4; margin: 12mm; }
          .nao-imprime { display: none !important; }
          .bolha { break-inside: avoid; }
        }
      `}</style>

      <div className="nao-imprime sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white/95 px-4 py-2.5 backdrop-blur">
        <p className="text-sm text-zinc-600">
          {c.stats.messages} mensagens
          {faltam > 0 && <span className="ml-2 text-amber-700">· {faltam} áudio(s) sem transcrição</span>}
          {c.stats.mediaMissing > 0 && (
            <span className="ml-2 text-amber-700">· {c.stats.mediaMissing} mídia(s) não recuperada(s)</span>
          )}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Printer className="h-4 w-4" /> Imprimir / salvar em PDF
        </button>
      </div>

      <div className="mx-auto max-w-[760px] px-4 py-6">
        <header className="bolha mb-5 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Conversa do WhatsApp</p>
              <h1 className="mt-0.5 text-xl font-bold">{c.contact.name}</h1>
              {c.contact.phone && <p className="text-sm text-zinc-600">{c.contact.phone}</p>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/frider-andrade-logo.png" alt="Frider Andrade Advogados" className="h-10 w-auto" />
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-600 sm:grid-cols-2">
            {primeira && (
              <div>
                <dt className="inline font-medium text-zinc-800">Período: </dt>
                <dd className="inline">
                  {dataHora(primeira.at).data} a {dataHora(ultima.at).data}
                </dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium text-zinc-800">Mensagens: </dt>
              <dd className="inline">
                {c.stats.messages} · {c.stats.audios} áudios ({c.stats.audiosTranscribed} transcritos)
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-zinc-800">Número(s) do escritório: </dt>
              <dd className="inline">
                {c.channels.map((ch) => ch.phoneNumber || ch.name).join(', ')}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-zinc-800">Exportada em: </dt>
              <dd className="inline">
                {gerada.data} às {gerada.hora}
              </dd>
            </div>
          </dl>
        </header>

        {c.messages.length === 0 && <p className="text-center text-sm text-zinc-500">Nenhuma mensagem.</p>}

        {c.messages.map((m) => {
          const dia = dataPorExtenso(m.at);
          const novoDia = dia !== diaAnterior;
          const novoCanal = c.conversationCount > 1 && m.channelName !== canalAnterior;
          const mostraAutor = novoDia || novoCanal || m.author !== autorAnterior;
          diaAnterior = dia;
          canalAnterior = m.channelName;
          autorAnterior = m.author;
          return (
            <div key={m.id}>
              {novoCanal && (
                <Separador texto={`Conversa pelo número ${m.channelName}`} />
              )}
              {novoDia && <Separador texto={dia} />}
              <Bolha m={m} mostraAutor={mostraAutor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Separador({ texto }: { texto: string }) {
  return (
    <div className="bolha my-3 flex justify-center">
      <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600 shadow-sm">
        {texto}
      </span>
    </div>
  );
}

const COR_AUTOR: Record<MensagemExportada['authorKind'], string> = {
  cliente: '#1f7aec',
  humano: '#008069',
  robo: '#7c3aed',
  sistema: '#667781',
};

function Bolha({ m, mostraAutor }: { m: MensagemExportada; mostraAutor: boolean }) {
  const saida = m.direction === 'OUTBOUND';
  return (
    <div className={`bolha flex ${saida ? 'justify-end' : 'justify-start'} ${mostraAutor ? 'mt-2' : 'mt-0.5'}`}>
      <div
        className="max-w-[78%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14px] leading-snug"
        style={{
          background: saida ? '#d9fdd3' : '#ffffff',
          boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
        }}
      >
        {mostraAutor && (
          <p className="mb-0.5 text-[12.5px] font-semibold" style={{ color: COR_AUTOR[m.authorKind] }}>
            {m.author}
            {m.authorKind === 'robo' && <span className="ml-1 font-normal text-zinc-500">(assistente virtual)</span>}
          </p>
        )}
        <Corpo m={m} />
        <p className="mt-0.5 text-right text-[11px]" style={{ color: '#667781' }}>
          {m.edited && <span className="mr-1 italic">editada</span>}
          {dataHora(m.at).hora}
        </p>
      </div>
    </div>
  );
}

function Texto({ children }: { children: string }) {
  return <p className="whitespace-pre-wrap break-words">{children}</p>;
}

function Transcricao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mt-1 rounded-md border-l-[3px] px-2 py-1" style={{ borderColor: '#25d366', background: 'rgba(0,0,0,.04)' }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="whitespace-pre-wrap break-words text-[13.5px] italic">{texto}</p>
    </div>
  );
}

function MidiaIndisponivel({ m }: { m: MensagemExportada }) {
  return (
    <p className="text-[12px] italic text-zinc-500">
      Mídia não recuperada{m.mediaError ? ` (${m.mediaError})` : ''}
    </p>
  );
}

function Corpo({ m }: { m: MensagemExportada }) {
  if (m.revoked) return <p className="italic text-zinc-500">🚫 Mensagem apagada</p>;

  switch (m.type) {
    case 'IMAGE':
    case 'STICKER':
      return (
        <div>
          {m.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.mediaUrl}
              alt={m.caption || 'Imagem'}
              className={`rounded-md ${m.type === 'STICKER' ? 'max-h-32' : 'max-h-[420px]'} max-w-full`}
            />
          ) : (
            <MidiaIndisponivel m={m} />
          )}
          {m.caption && <div className="mt-1"><Texto>{m.caption}</Texto></div>}
          {m.transcription && m.type === 'IMAGE' && <Transcricao titulo="Conteúdo da imagem" texto={m.transcription} />}
        </div>
      );
    case 'AUDIO':
      return (
        <div className="min-w-[220px]">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
            <Mic className="h-4 w-4 text-emerald-600" /> Áudio
          </p>
          {m.transcription ? (
            <Transcricao titulo="Transcrição" texto={m.transcription} />
          ) : (
            <p className="mt-0.5 text-[12px] italic text-zinc-500">
              Não transcrito{m.transcriptionError ? ` (${m.transcriptionError})` : ''}
            </p>
          )}
        </div>
      );
    case 'VIDEO':
      return (
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
            <Video className="h-4 w-4" /> Vídeo
          </p>
          {m.mediaUrl && /^https?:/i.test(m.mediaUrl) ? (
            <a href={m.mediaUrl} className="break-all text-[11.5px] text-sky-700 underline">{m.mediaUrl}</a>
          ) : (
            !m.mediaUrl && <MidiaIndisponivel m={m} />
          )}
          {m.caption && <div className="mt-1"><Texto>{m.caption}</Texto></div>}
        </div>
      );
    case 'DOCUMENT':
      return (
        <div>
          <div className="flex items-center gap-2 rounded-md bg-black/5 px-2.5 py-2">
            <FileText className="h-6 w-6 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="break-words text-[13px] font-medium">{m.fileName || 'Documento'}</p>
              {m.mediaUrl && /^https?:/i.test(m.mediaUrl) ? (
                <a href={m.mediaUrl} className="break-all text-[11px] text-sky-700 underline">abrir arquivo</a>
              ) : (
                !m.mediaUrl && <MidiaIndisponivel m={m} />
              )}
            </div>
          </div>
          {m.caption && <div className="mt-1"><Texto>{m.caption}</Texto></div>}
        </div>
      );
    case 'LOCATION':
      return m.location ? (
        <a href={linkMapa(m.location.latitude, m.location.longitude)} className="flex items-center gap-1.5 text-sky-700 underline">
          <MapPin className="h-4 w-4" /> {m.location.label || 'Localização'} ({m.location.latitude}, {m.location.longitude})
        </a>
      ) : (
        <Texto>📍 Localização</Texto>
      );
    case 'CONTACT':
      return (
        <p className="flex items-center gap-1.5">
          <UserRound className="h-4 w-4 text-zinc-500" />
          {[m.contactCard?.name, m.contactCard?.phone].filter(Boolean).join(' — ') || 'Cartão de contato'}
        </p>
      );
    default:
      return <Texto>{m.text || m.caption || `[${m.type.toLowerCase()}]`}</Texto>;
  }
}

function Aviso({ texto, carregando }: { texto: string; carregando?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-8">
      <div className="flex max-w-md items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600">
        {carregando ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        {texto}
      </div>
    </div>
  );
}
