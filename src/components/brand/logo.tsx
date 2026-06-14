import { cn } from '@/lib/utils';

/**
 * Wordmark "Frider Andrade — Advogados": serifada elegante (Playfair Display,
 * via --font-brand-serif) empilhada (Frider / Andrade), quadrado vermelho de
 * acento e "ADVOGADOS" espaçado embaixo. Theme-aware (no dark o texto clareia,
 * o vermelho fica). Tudo escala a partir do fontSize base (unidades em).
 *
 * Recriação fiel pra não depender de asset binário. Pra fidelidade pixel-perfect
 * com a fonte oficial, dropar o arquivo em public/logo-frider.svg|png e trocar
 * por <img>.
 */
export function Logo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const base = size === 'sm' ? 23 : size === 'lg' ? 46 : 32;
  return (
    <div
      className={cn('select-none', className)}
      style={{
        fontFamily: 'var(--font-brand-serif), Georgia, "Times New Roman", serif',
        fontSize: base,
        lineHeight: 1.0,
      }}
      aria-label="Frider Andrade Advogados"
    >
      <div
        className="text-zinc-700 dark:text-zinc-300"
        style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
      >
        Frider
      </div>
      <div className="flex items-baseline" style={{ gap: '0.12em' }}>
        <span
          className="text-zinc-900 dark:text-white"
          style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          Andrade
        </span>
        <span
          aria-hidden
          className="inline-block bg-[#C8402E]"
          style={{ width: '0.17em', height: '0.17em' }}
        />
      </div>
      <div
        className="text-zinc-400 dark:text-zinc-500"
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: '0.265em',
          fontWeight: 500,
          letterSpacing: '0.5em',
          marginTop: '0.55em',
          marginLeft: '0.1em',
        }}
      >
        ADVOGADOS
      </div>
    </div>
  );
}
