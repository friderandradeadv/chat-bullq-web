'use client';

import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { makeQueryClient } from '@/lib/query-client';

/** A barra de status do iPhone (PWA) pinta com o `theme-color`. O layout declara
 *  as cores por `prefers-color-scheme` — o tema do SISTEMA —, mas o hub escolhe o
 *  tema pelo botão sol/lua (`enableSystem={false}`): iPhone no claro + hub no
 *  escuro dava uma faixa branca no topo. Aqui a meta passa a seguir o tema do hub. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const cor = resolvedTheme === 'dark' ? '#15181A' : '#ffffff';
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m, i) => { if (i > 0) m.remove(); });
    const meta = metas[0] ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    meta.removeAttribute('media');
    meta.content = cor;
  }, [resolvedTheme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <ThemeColorSync />
        {children}
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
