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
    // ?v=3 = ícone dark (cinza escuro #26262a, "FA." clara centralizada pelas
    // letras). O sufixo força navegador/instalação a rebaixar o cache anterior.
    icons: [
      { src: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
