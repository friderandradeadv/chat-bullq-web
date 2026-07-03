import type { MetadataRoute } from 'next';

// Web App Manifest (Next App Router gera /manifest.webmanifest e injeta o <link>).
// URLs relativas de propósito: o app é servido em hub. e chat.friderandrade.com.br,
// então tudo resolve no host de onde foi instalado.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hub | Frider Andrade',
    short_name: 'Hub',
    description:
      'Plataforma de atendimento e gestão jurídica do escritório Frider Andrade.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'pt-BR',
    dir: 'ltr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
