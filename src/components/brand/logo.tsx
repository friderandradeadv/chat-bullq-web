import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Logomarca OFICIAL "Frider Andrade — Advogados" (arquivo em
 * public/frider-andrade-logo.png, fundo transparente, 917×272). Horizontal:
 * "FriderAndrade" + quadrado vermelho + "ADVOGADOS" espaçado embaixo.
 *
 * O wordmark é escuro, então no modo claro fica perfeito sobre a sidebar
 * branca. No modo escuro aplicamos uma área de respiro branca (safe-area) pra
 * manter a marca exata (com o vermelho) legível — sem inverter cor.
 */
const RATIO = 917 / 272;
const HEIGHTS: Record<'sm' | 'md' | 'lg', number> = { sm: 44, md: 56, lg: 76 };

export function Logo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const h = HEIGHTS[size];
  const w = Math.round(h * RATIO);
  return (
    <Image
      src="/frider-andrade-logo.png"
      alt="Frider Andrade Advogados"
      width={w}
      height={h}
      priority
      className={cn(
        'select-none object-contain dark:rounded-md dark:bg-white dark:px-2 dark:py-1',
        className,
      )}
    />
  );
}
