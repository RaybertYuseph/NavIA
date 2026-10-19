/**
 * Norbit, la mascota de NavIA: una bolita azul claro con cara, bracitos y piernitas, y una
 * antena que "escucha" la ruta. Diseño propio. `animated` la hace flotar, parpadear y saludar.
 */
export function Norbit({ size = 96, animated = false, className = '' }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-label="Norbit, el copiloto de NavIA"
      className={`${animated ? 'norbit-float' : ''} ${className}`}
    >
      <defs>
        <radialGradient id="nb-body" cx="40%" cy="32%" r="75%">
          <stop offset="0" stopColor="#e0f7ff" />
          <stop offset="0.45" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0ea5e9" />
        </radialGradient>
        <linearGradient id="nb-limb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
        <radialGradient id="nb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#a5f3fc" />
          <stop offset="0.5" stopColor="#22d3ee" stopOpacity="0.8" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="64" cy="120" rx="26" ry="4" fill="#0c4a6e" opacity="0.15" />

      {/* Piernitas */}
      <rect x="47" y="96" width="11" height="20" rx="5.5" fill="url(#nb-limb)" />
      <rect x="70" y="96" width="11" height="20" rx="5.5" fill="url(#nb-limb)" />
      <ellipse cx="51" cy="116" rx="8" ry="4" fill="#0369a1" />
      <ellipse cx="77" cy="116" rx="8" ry="4" fill="#0369a1" />

      {/* Bracitos: el derecho saluda */}
      <rect x="15" y="62" width="22" height="10" rx="5" fill="url(#nb-limb)" transform="rotate(25 26 67)" />
      <g className={animated ? 'norbit-wave' : ''} style={{ transformOrigin: '96px 60px' }}>
        <rect x="92" y="40" width="10" height="24" rx="5" fill="url(#nb-limb)" transform="rotate(30 97 60)" />
        <circle cx="105" cy="40" r="6" fill="#38bdf8" />
      </g>

      {/* Antena */}
      <path d="M64 24 Q64 14 70 8" stroke="#0284c7" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="71" cy="7" r="9" fill="url(#nb-glow)" className={animated ? 'norbit-pulse' : ''} />
      <circle cx="71" cy="7" r="3.5" fill="#cffafe" />

      {/* Cuerpo */}
      <circle cx="64" cy="62" r="40" fill="url(#nb-body)" />
      <ellipse cx="48" cy="40" rx="12" ry="7" fill="#fff" opacity="0.55" transform="rotate(-25 48 40)" />

      {/* Cara */}
      <g className={animated ? 'norbit-blink' : ''} style={{ transformOrigin: '64px 60px' }}>
        <ellipse cx="51" cy="60" rx="8" ry="10" fill="#fff" />
        <ellipse cx="77" cy="60" rx="8" ry="10" fill="#fff" />
        <circle cx="53" cy="62" r="5" fill="#0b1b3a" />
        <circle cx="79" cy="62" r="5" fill="#0b1b3a" />
        <circle cx="55" cy="59.5" r="1.8" fill="#fff" />
        <circle cx="81" cy="59.5" r="1.8" fill="#fff" />
      </g>
      <circle cx="41" cy="74" r="4.5" fill="#f472b6" opacity="0.35" />
      <circle cx="87" cy="74" r="4.5" fill="#f472b6" opacity="0.35" />
      <path d="M55 77 Q64 85 73 77" stroke="#0b1b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Logotipo: Norbit + "NavIA" con el degradado de la marca. */
export function NaviaLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Norbit size={size} />
      <span className="brand-text text-xl font-extrabold tracking-tight">NavIA</span>
    </span>
  );
}
