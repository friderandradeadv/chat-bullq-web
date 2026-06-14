import { cn } from '@/lib/utils';

/**
 * Wordmark "Frider Andrade — Advogados" recriado tipograficamente: serif
 * empilhado (Frider / Andrade), quadrado vermelho de acento e "ADVOGADOS"
 * espaçado embaixo. Theme-aware (no dark o texto clareia, o vermelho fica).
 *
 * Recriação fiel pra não depender de asset binário. Se quiser fidelidade
 * pixel-perfect com a fonte oficial, dropar o SVG em `public/logo-frider.svg`
 * e trocar este componente por <img src="/logo-frider.svg" />.
 *
 * O tamanho tudo escala a partir do `fontSize` base (em unidades em), então
 * basta mudar `size` que proporções, quadrado e tracking acompanham.
 */
export function Logo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const base = size === 'sm' ? 20 : size === 'lg' ? 44 : 30;
  return (
    <div
      className={cn('select-none font-serif', className)}
      style={{ fontSize: base, lineHeight: 0.92 }}
      aria-label="Frider Andrade Advogados"
    >
      <div className="font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
        Frider
      </div>
      <div className="flex items-end gap-[0.16em]">
        <span className="font-semibold tracking-tight text-zinc-900 dark:text-white">
          Andrade
        </span>
        <span
          aria-hidden
          className="inline-block bg-[#C8402E]"
          style={{ width: '0.2em', height: '0.2em', marginBottom: '0.14em' }}
        />
      </div>
      <div
        className="font-medium text-zinc-400 dark:text-zinc-500"
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          fontSize: '0.3em',
          letterSpacing: '0.42em',
          marginTop: '0.45em',
          marginLeft: '0.08em',
        }}
      >
        ADVOGADOS
      </div>
    </div>
  );
}
