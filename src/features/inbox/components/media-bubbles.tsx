'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Download,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileIcon,
  MapPin,
  X,
} from 'lucide-react';
import { useResolvedMedia } from '../hooks/use-resolved-media';
import { inboxService, type Message, type TranscriptionResult } from '../services/inbox.service';

/**
 * One file, all media bubbles. They share three concerns: lazy-resolve a
 * playable URL via /messages/:id/media, fall back gracefully when the
 * provider's URL expires, and keep visual styling consistent with the
 * surrounding chat bubble.
 */

interface MediaProps {
  message: Message;
  isOutbound: boolean;
}

export function MediaImage({ message, isOutbound }: MediaProps) {
  // Eager: imagem aparece assim que a mensagem renderiza, sem precisar de
  // clique pra disparar o resolve.
  const { url, loading, error, retry } = useResolvedMedia(message, { mode: 'eager' });
  const [zoomOpen, setZoomOpen] = useState(false);
  const caption = message.content?.caption as string | undefined;

  return (
    <div>
      <div
        className={`group relative overflow-hidden rounded-lg ${
          isOutbound ? 'bg-black/5 dark:bg-white/10' : 'bg-zinc-100 dark:bg-zinc-700/40'
        }`}
        style={{ minHeight: '120px', minWidth: '160px' }}
      >
        {url ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="block max-w-full"
            aria-label="Abrir imagem"
          >
            <img
              src={url}
              alt={caption || 'Imagem'}
              className="max-h-72 max-w-full rounded-lg object-contain"
              onError={() => void retry()}
              loading="lazy"
            />
          </button>
        ) : (
          <MediaSkeleton
            label={loading ? 'Carregando imagem…' : error || 'Imagem'}
            error={!!error}
            isOutbound={isOutbound}
            onRetry={() => void retry()}
          />
        )}
      </div>
      {caption && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
      <ImageTranscription message={message} isOutbound={isOutbound} />
      {zoomOpen && url && (
        <ImageLightbox url={url} alt={caption || 'Imagem'} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}

/**
 * On-demand OCR/vision transcription for an image bubble (Gemini). Mirrors the
 * audio player's inline "Transcrever" UX. The extracted text is cached on the
 * message and also feeds the AI document/data extraction (ZapSign).
 */
function ImageTranscription({ message, isOutbound }: MediaProps) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptionResult | null>(
    message.metadata?.transcription ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Sync with socket-pushed metadata updates.
  useEffect(() => {
    if (message.metadata?.transcription) setTranscript(message.metadata.transcription);
  }, [message.metadata?.transcription]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    setError(null);
    try {
      const result = await inboxService.transcribeMessage(message.id);
      setTranscript(result);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Erro ao transcrever');
    } finally {
      setTranscribing(false);
    }
  };

  const muted = isOutbound ? 'text-zinc-500 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400';
  const text = transcript?.text;
  const isLong = !!text && text.length > 280;

  return (
    <div
      className={`mt-1.5 max-w-[360px] border-t pt-1.5 ${
        isOutbound ? 'border-black/10 dark:border-white/20' : 'border-zinc-200 dark:border-zinc-700'
      }`}
    >
      {text ? (
        <>
          <div className={`mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
            <FileText className="h-3 w-3" /> Transcrição
          </div>
          <p
            className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${
              isOutbound ? 'text-zinc-700 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-200'
            } ${isLong && !expanded ? 'line-clamp-6' : ''}`}
          >
            {text}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`mt-1 text-[11px] font-medium hover:underline ${
                isOutbound ? 'text-zinc-600 dark:text-zinc-200' : 'text-primary'
              }`}
            >
              {expanded ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </>
      ) : transcribing ? (
        <span className={`inline-flex items-center gap-1.5 text-[12px] ${muted}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcrevendo imagem…
        </span>
      ) : (
        <button
          type="button"
          onClick={handleTranscribe}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-[12px] font-medium transition-colors ${
            isOutbound
              ? 'text-zinc-600 hover:bg-black/10 dark:text-zinc-200 dark:hover:bg-white/15'
              : 'text-primary hover:bg-primary/10 dark:text-primary'
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> Transcrever imagem
        </button>
      )}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </div>
  );
}

export function MediaVideo({ message, isOutbound }: MediaProps) {
  const { url, mimeType, loading, error, retry } = useResolvedMedia(message, { mode: 'eager' });
  const caption = message.content?.caption as string | undefined;

  return (
    <div>
      <div
        className={`overflow-hidden rounded-lg ${
          isOutbound ? 'bg-black/5 dark:bg-white/10' : 'bg-zinc-100 dark:bg-zinc-700/40'
        }`}
      >
        {url ? (
          <video
            src={url}
            controls
            preload="metadata"
            className="max-h-72 w-full rounded-lg"
            onError={() => void retry()}
          >
            {mimeType && <source src={url} type={mimeType} />}
          </video>
        ) : (
          <MediaSkeleton
            label={loading ? 'Carregando vídeo…' : error || 'Vídeo'}
            error={!!error}
            isOutbound={isOutbound}
            onRetry={() => void retry()}
          />
        )}
      </div>
      {caption && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
    </div>
  );
}

export function MediaDocument({ message, isOutbound }: MediaProps) {
  const { url, loading, error, retry } = useResolvedMedia(message);
  const filename = (message.content?.fileName as string | undefined) || 'Documento';
  const mimeType = (message.content?.mimeType as string | undefined) || '';
  const caption = message.content?.caption as string | undefined;
  const Icon = pickDocIcon(mimeType, filename);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!url) {
      e.preventDefault();
      void retry();
    }
  };

  return (
    <div>
      <a
        href={url || '#'}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        download={filename}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
          isOutbound
            ? 'border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15'
            : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            isOutbound
              ? 'bg-black/10 dark:bg-white/15'
              : 'bg-white shadow-sm dark:bg-zinc-700'
          }`}
        >
          <Icon className="h-5 w-5 opacity-80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className={`truncate text-[11px] ${isOutbound ? 'opacity-70' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {loading ? 'Preparando download…' : error ? 'Falhou — toque pra tentar de novo' : (mimeType || 'Arquivo')}
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
        ) : (
          <Download className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </a>
      {caption && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
    </div>
  );
}

export function MediaSticker({ message, isOutbound }: MediaProps) {
  const { url, loading, error, retry } = useResolvedMedia(message, { mode: 'eager' });

  if (url) {
    return (
      <img
        src={url}
        alt="Sticker"
        className="h-32 w-32 object-contain"
        onError={() => void retry()}
        loading="lazy"
      />
    );
  }
  return (
    <MediaSkeleton
      label={loading ? 'Carregando sticker…' : error || 'Sticker'}
      error={!!error}
      isOutbound={isOutbound}
      onRetry={() => void retry()}
      compact
    />
  );
}

export function MediaLocation({ message, isOutbound }: MediaProps) {
  const lat = message.content?.latitude as number | undefined;
  const lng = message.content?.longitude as number | undefined;
  const label = (message.content?.text as string | undefined) || 'Localização';
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return <p className="text-sm italic opacity-70">📍 {label}</p>;
  }
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isOutbound
          ? 'border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15'
          : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800'
      }`}
    >
      <MapPin className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <p className="truncate font-medium">{label}</p>
        <p className="truncate text-[11px] opacity-70 tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </div>
    </a>
  );
}

function MediaSkeleton({
  label,
  error,
  isOutbound,
  onRetry,
  compact,
}: {
  label: string;
  error: boolean;
  isOutbound: boolean;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={`flex w-full items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-6'} text-xs ${
        isOutbound ? 'text-zinc-500 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'
      }`}
    >
      {error ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ImageLightbox({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  // Close on ESC; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function pickDocIcon(mime: string, filename: string) {
  const m = (mime || '').toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
    return FileImage;
  }
  if (m.startsWith('video/') || ['mp4', 'mov', '3gp', 'webm'].includes(ext)) {
    return FileVideo;
  }
  if (m.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) {
    return FileAudio;
  }
  if (m === 'application/pdf' || ext === 'pdf') return FileText;
  if (m === 'application/zip' || ['zip', 'rar', '7z'].includes(ext)) return FileArchive;
  if (
    ['xlsx', 'xls', 'csv'].includes(ext) ||
    m === 'text/csv' ||
    m.includes('spreadsheet') ||
    m.includes('excel')
  ) {
    return FileSpreadsheet;
  }
  if (m.startsWith('text/') || ['txt', 'md', 'doc', 'docx'].includes(ext)) {
    return FileText;
  }
  return FileIcon;
}
