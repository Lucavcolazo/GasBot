interface Props {
  className?: string;
}

// Billete con alas, animado en CSS (ver .flying-bill* en index.css).
// Se mantiene en blanco/negro puro para no romper el tema monocromo.
export function FlyingBillIcon({ className = "h-6 w-9" }: Props) {
  return (
    <svg viewBox="0 0 48 28" className={className} aria-hidden="true">
      <g className="flying-bill-wing-left" stroke="currentColor" strokeWidth="1.3" fill="none">
        <path d="M17 14 C 10 4, 2 6, 3 14 C 2 22, 10 24, 17 14 Z" />
        <path d="M17 14 C 12 8, 6 9, 6 14" strokeWidth="0.8" opacity="0.6" />
      </g>
      <g className="flying-bill-wing-right" stroke="currentColor" strokeWidth="1.3" fill="none">
        <path d="M31 14 C 38 4, 46 6, 45 14 C 46 22, 38 24, 31 14 Z" />
        <path d="M31 14 C 36 8, 42 9, 42 14" strokeWidth="0.8" opacity="0.6" />
      </g>
      <g className="flying-bill-body">
        <rect x="17" y="7" width="14" height="14" rx="1.5" fill="black" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="24" cy="14" r="3" stroke="currentColor" strokeWidth="0.8" fill="none" />
        <text x="24" y="16" fontSize="4.5" textAnchor="middle" fill="currentColor" fontFamily="JetBrains Mono, monospace">
          $
        </text>
      </g>
    </svg>
  );
}
