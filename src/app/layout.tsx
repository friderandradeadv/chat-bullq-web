import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';

const inter = Inter({ subsets: ['latin'] });
// Serifada elegante usada só na wordmark "Frider Andrade Advogados".
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-brand-serif',
});

export const metadata: Metadata = {
  title: 'Hub | Frider Andrade',
  description: 'Plataforma de atendimento e gestão jurídica do escritório Frider Andrade.',
  // Favicon do navegador (monograma "FA.") acompanha o tema do SO.
  icons: {
    icon: [
      { url: '/favicon-light.png', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.png', media: '(prefers-color-scheme: dark)' },
    ],
    // Ícone da tela inicial no iOS (dark: cinza escuro, "FA." clara centralizada).
    // ?v=3 força o iOS a buscar o novo ao re-adicionar à tela inicial.
    apple: '/apple-touch-icon.png?v=4',
  },
  // iOS: abre em tela cheia ("standalone") quando adicionado à tela inicial.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hub',
  },
  // Meta legada do iOS antigo (Safari < 16.4) para o modo tela cheia — o Next
  // emite a moderna `mobile-web-app-capable`, esta cobre os iPhones antigos.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // O conteúdo se estende sob a notch/ilha e a barra inferior; cada barra do
  // app compensa com env(safe-area-inset-*). Sem isto o layout ficava "cortado"
  // no iPhone (cara de web espremida). maximumScale/userScalable travam o zoom
  // acidental por duplo-toque, deixando com toque de app nativo.
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  // Cor da barra de status/tema no PWA instalado — acompanha o tema do SO.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1b1e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${playfair.variable} bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`}
    >
      <body className={inter.className}>
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
