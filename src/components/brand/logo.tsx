import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Logomarca OFICIAL "Frider Andrade — Advogados" (horizontal, fundo
 * transparente). Duas variantes:
 *  - modo CLARO: wordmark escuro (public/frider-andrade-logo.png)
 *  - modo ESCURO: wordmark claro/cinza (public/frider-andrade-logo-dark.png)
 * Troca por CSS (`dark:`), sem hack de fundo branco.
 */
const HEIGHTS: Record<'sm' | 'md' | 'lg', number> = { sm: 52, md: 72, lg: 92 };
const RATIO_LIGHT = 864 / 244; // logo HD (modo claro)
const RATIO_DARK = 907 / 275;

export function Logo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const h = HEIGHTS[size];
  return (
    <>
      {/* Modo claro: wordmark escuro */}
      <Image
        src="/frider-andrade-logo.png"
        alt="Frider Andrade Advogados"
        width={Math.round(h * RATIO_LIGHT)}
        height={h}
        priority
        className={cn('select-none object-contain dark:hidden', className)}
      />
      {/* Modo escuro: wordmark claro/cinza */}
      <Image
        src="/frider-andrade-logo-dark.png"
        alt="Frider Andrade Advogados"
        width={Math.round(h * RATIO_DARK)}
        height={h}
        priority
        className={cn('hidden select-none object-contain dark:block', className)}
      />
    </>
  );
}
