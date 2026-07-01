import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // /settings agora é resolvido por papel na página-índice (associado → perfil,
  // sócio → Escritório), então não redirecionamos estaticamente aqui.
};

export default nextConfig;
