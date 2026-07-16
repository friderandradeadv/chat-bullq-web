'use client';

import { useCallback, useRef, useState } from 'react';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Channel, LiveStatus } from '../services/channels.service';
import { channelsService } from '../services/channels.service';

/** Lado do quadro de recorte na tela e do arquivo final gerado. */
const CROP = 260;
const OUT = 512;

interface Props {
  channel: Channel | null;
  currentPicUrl?: string | null;
  onClose: () => void;
  onSaved: (live: LiveStatus) => void;
}

/**
 * Troca a foto de perfil do WhatsApp da conexão com recorte CIRCULAR (igual
 * WhatsApp): arrasta pra posicionar, slider pra dar zoom, e salva um quadrado
 * (o círculo inscrito) — o WhatsApp exibe redondo. Sem lib externa: só canvas.
 */
export function ProfilePictureDialog({ channel, currentPicUrl, onClose, onSaved }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const baseScale = nat ? Math.max(CROP / nat.w, CROP / nat.h) : 1;
  const dispW = nat ? nat.w * baseScale * zoom : CROP;
  const dispH = nat ? nat.h * baseScale * zoom : CROP;

  const clamp = useCallback(
    (o: { x: number; y: number }, w: number, h: number) => ({
      x: Math.min(0, Math.max(CROP - w, o.x)),
      y: Math.min(0, Math.max(CROP - h, o.y)),
    }),
    [],
  );

  function pickFile(f: File) {
    if (!f.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.');
      return;
    }
    const url = URL.createObjectURL(f);
    setSrc(url);
    setZoom(1);
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setNat({ w, h });
    const bs = Math.max(CROP / w, CROP / h);
    const dw = w * bs;
    const dh = h * bs;
    setOffset({ x: (CROP - dw) / 2, y: (CROP - dh) / 2 });
  }

  function onZoom(nz: number) {
    if (!nat) return;
    const oldW = dispW;
    const oldH = dispH;
    const newW = nat.w * baseScale * nz;
    const newH = nat.h * baseScale * nz;
    const cx = CROP / 2;
    const cy = CROP / 2;
    const fx = (cx - offset.x) / oldW;
    const fy = (cy - offset.y) / oldH;
    const next = clamp({ x: cx - fx * newW, y: cy - fy * newH }, newW, newH);
    setZoom(nz);
    setOffset(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!src) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, dispW, dispH));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function handleSave() {
    if (!channel || !src || !nat || !imgRef.current) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUT, OUT);
      const s = OUT / CROP;
      ctx.drawImage(imgRef.current, offset.x * s, offset.y * s, dispW * s, dispH * s);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.92),
      );
      const live = await channelsService.updateProfilePicture(channel.id, blob);
      toast.success('Foto de perfil atualizada.');
      onSaved(live);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra atualizar a foto.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setNat(null);
    setZoom(1);
    onClose();
  }

  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Foto de perfil
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {channel.name} — arraste e dê zoom pra enquadrar.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {/* Área de recorte circular */}
          <div
            className="relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
            style={{ width: CROP, height: CROP, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  onLoad={onImgLoad}
                  draggable={false}
                  className="absolute max-w-none select-none"
                  style={{ left: offset.x, top: offset.y, width: dispW, height: dispH }}
                />
                {/* Máscara: escurece fora do círculo (igual WhatsApp) */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    borderRadius: '9999px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    border: '2px solid rgba(255,255,255,0.9)',
                  }}
                />
              </>
            ) : currentPicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPicUrl}
                alt=""
                className="h-full w-full rounded-full object-cover p-2"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
                <ImagePlus className="h-8 w-8" />
                <span className="text-xs">Nenhuma imagem escolhida</span>
              </div>
            )}
          </div>

          {/* Zoom */}
          {src && (
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="mt-4 w-full accent-zinc-900 dark:accent-zinc-100"
            />
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ImagePlus className="h-4 w-4" />
            {src ? 'Trocar imagem' : 'Escolher imagem'}
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!src || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
