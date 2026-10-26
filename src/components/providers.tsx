'use client';

import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { makeQueryClient } from '@/lib/query-client';

/** A barra de status do iPhone (PWA) pinta com o `theme-color`. O layout declara
 *  as cores por `prefers-color-scheme` — o tema do SISTEMA —, mas o hub escolhe o
 *  tema pelo botão sol/lua (`enableSystem={false}`): iPhone no claro + hub no
 *  escuro dava uma faixa branca no topo. Aqui a meta passa a seguir o tema do hub.
 *
 *  🚨 NUNCA remover as metas: elas são do React (vêm do `themeColor` do layout).
 *  Arrancar uma fazia o React quebrar (`removeChild` de null) na 1ª troca de
 *  página, e a navegação abortava: a URL mudava e a tela ficava a antiga —
 *  "tenho que clicar duas vezes" em todo o hub (26/10/2026). Só se mexe nos
 *  atributos, em todas elas. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const cor = resolvedTheme === 'dark' ? '#15181A' : '#ffffff';
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color', content: cor }));
      return;
    }
    metas.forEach((m) => {
      m.removeAttribute('media');
      m.content = cor;
    });
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
