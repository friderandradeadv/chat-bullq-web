import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // /settings agora é resolvido por papel na página-índice (associado → perfil,
  // sócio → Escritório), então não redirecionamos estaticamente aqui.

  // ⚠️ Sem isso, o Next servia o HTML das páginas com `Cache-Control: s-maxage=31536000`
  // (1 ANO) — depois de cada deploy, usuários com o hub aberto (é PWA, ficam com aba
  // aberta por dias) continuavam recebendo o HTML antigo (com referências aos chunks JS
  // da build anterior), então feature nova "não aparecia" mesmo já publicada no servidor.
  // Página é autenticada e sempre dinâmica (dados por usuário) — nunca deveria cachear.
  // Os assets em /_next/static/* continuam com cache longo (são hasheados por conteúdo,
  // então cachear "para sempre" neles é seguro e intencional — só as PÁGINAS mudam aqui.
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|icon-|manifest.json|sw.js).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
