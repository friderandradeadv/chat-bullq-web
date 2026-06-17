// Avatar com iniciais coloridas — cor derivada do nome (estável por contato),
// estilo WhatsApp/LíderHub. Usado como fallback quando não há foto.

const AVATAR_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#a855f7', // purple
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
];

export function avatarColor(name: string | null | undefined): string {
  if (!name) return '#a1a1aa'; // zinc fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Cor de texto legível para um chip preenchido com `bgHex`: branco em fundos
 * escuros, cinza-escuro em fundos claros (amarelo, cinza claro, etc.). Usa
 * luminância perceptual (sRGB) com limiar calibrado pros chips do app.
 */
export function chipTextColor(bgHex: string | null | undefined): string {
  if (!bgHex) return '#ffffff';
  const h = bgHex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#ffffff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#27272a' : '#ffffff'; // claro → zinc-800; escuro → branco
}

export function avatarInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
