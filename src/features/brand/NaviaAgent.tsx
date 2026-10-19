/**
 * NavIA, el agente y copiloto (variante C1 "Copiloto pulido"): una esfera azul claro con ojos
 * luminosos, audífonos con micrófono, orbes flotantes y una base holográfica.
 * - `animated`: flota, parpadea, los orbes orbitan y las luces laten (saludo de entrada).
 * - `headset`: audífonos y micrófono; están en un solo grupo para poder quitarlos fácil.
 * - `compact`: solo el personaje, sin base ni orbes; para el encabezado y tamaños pequeños.
 * Los ids de los degradados llevan prefijo `nv-` para no chocar con otros SVG de la página.
 */
export function NaviaAgent({
  size = 96,
  animated = false,
  headset = true,
  compact = false,
  className = '',
}: {
  size?: number;
  animated?: boolean;
  headset?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const a = (cls: string) => (animated ? cls : undefined);
  return (
    <svg
      viewBox={compact ? '30 22 140 140' : '0 0 200 200'}
      width={size}
      height={size}
      role="img"
      aria-label="NavIA, tu copiloto de ruta"
      className={`${animated ? 'agent-float' : ''} ${className}`}
    >
      <defs>
        <radialGradient id="nv-body" cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#F7FDFF" />
          <stop offset=".3" stopColor="#B5ECFF" />
          <stop offset=".7" stopColor="#4FC3F7" />
          <stop offset="1" stopColor="#1F7BE0" />
        </radialGradient>
        <radialGradient id="nv-shade" cx="70%" cy="85%" r="55%">
          <stop offset="0" stopColor="#1243A8" stopOpacity=".45" />
          <stop offset="1" stopColor="#1243A8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nv-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CBD5E1" />
          <stop offset=".45" stopColor="#7DF9FF" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="nv-headset" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B3A8F" />
          <stop offset="1" stopColor="#121A4D" />
        </linearGradient>
        <linearGradient id="nv-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67E8F9" stopOpacity="0" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity=".5" />
        </linearGradient>
        <radialGradient id="nv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#67E8F9" stopOpacity=".9" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity="0" />
        </radialGradient>
        <filter id="nv-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base holográfica */}
      {!compact && (
        <g>
          <path d="M76 146 L62 178 L138 178 L124 146 Z" fill="url(#nv-beam)" />
          <ellipse cx="100" cy="180" rx="48" ry="10" fill="url(#nv-glow)" />
          <ellipse cx="100" cy="180" rx="36" ry="5.5" fill="none" stroke="#22D3EE" strokeWidth="2.5" filter="url(#nv-blur)" className={a('agent-pulse')} />
          <ellipse cx="100" cy="180" rx="22" ry="3" fill="none" stroke="#A5F3FC" strokeWidth="1.5" opacity=".8" />
        </g>
      )}

      {/* Cuerpo */}
      <circle cx="100" cy="90" r="58" fill="url(#nv-rim)" />
      <circle cx="100" cy="90" r="54.5" fill="url(#nv-body)" />
      <circle cx="100" cy="90" r="54.5" fill="url(#nv-shade)" />
      <ellipse cx="78" cy="58" rx="20" ry="9" fill="#fff" opacity=".75" transform="rotate(-32 78 58)" />
      <circle cx="64" cy="70" r="3" fill="#fff" opacity=".9" />

      {/* Cara */}
      <g filter="url(#nv-blur)" className={a('agent-blink')} style={{ transformOrigin: '100px 88px' }}>
        <ellipse cx="80" cy="88" rx="8" ry="11" fill="#0B1440" />
        <ellipse cx="120" cy="88" rx="8" ry="11" fill="#0B1440" />
        <ellipse cx="82" cy="84" rx="3" ry="3.5" fill="#7DF9FF" />
        <ellipse cx="122" cy="84" rx="3" ry="3.5" fill="#7DF9FF" />
      </g>
      <ellipse cx="66" cy="106" rx="8" ry="4.5" fill="#E0F2FE" opacity=".4" />
      <ellipse cx="134" cy="106" rx="8" ry="4.5" fill="#E0F2FE" opacity=".4" />
      <path d="M90 107 Q100 117 110 107" stroke="#0B1440" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Audífonos con micrófono */}
      {headset && (
        <g>
          <path d="M44 82 A57 57 0 0 1 156 82" stroke="url(#nv-headset)" strokeWidth="7" fill="none" strokeLinecap="round" />
          <rect x="148" y="72" width="18" height="30" rx="9" fill="url(#nv-headset)" />
          <rect x="153" y="79" width="8" height="16" rx="4" fill="#67E8F9" filter="url(#nv-blur)" className={a('agent-pulse')} />
          <rect x="34" y="72" width="18" height="30" rx="9" fill="url(#nv-headset)" />
          <path d="M154 100 Q152 120 128 122" stroke="url(#nv-headset)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="116" y="117" width="14" height="9" rx="4.5" fill="url(#nv-headset)" />
          <circle cx="118" cy="121.5" r="2.5" fill="#67E8F9" filter="url(#nv-blur)" className={a('agent-pulse')} />
        </g>
      )}

      {/* Orbes y destellos */}
      {!compact && (
        <>
          <g className={a('agent-orbit')}>
            <circle cx="26" cy="112" r="12" fill="url(#nv-body)" stroke="url(#nv-rim)" strokeWidth="2" />
            <ellipse cx="23" cy="108" rx="4" ry="2.5" fill="#fff" opacity=".7" />
          </g>
          <g className={a('agent-orbit agent-orbit-late')}>
            <circle cx="176" cy="50" r="12" fill="url(#nv-body)" stroke="url(#nv-rim)" strokeWidth="2" />
            <ellipse cx="173" cy="46" rx="4" ry="2.5" fill="#fff" opacity=".7" />
          </g>
          <path transform="translate(192 30)" d={SPARKLE} fill="#CBD5E1" filter="url(#nv-blur)" />
          <path transform="translate(18 86) scale(0.6)" d={SPARKLE} fill="#7DF9FF" filter="url(#nv-blur)" />
        </>
      )}
    </svg>
  );
}

const SPARKLE = 'M0 -9 l2.2 6.8 6.8 2.2 -6.8 2.2 -2.2 6.8 -2.2 -6.8 -6.8 -2.2 6.8 -2.2z';

/** Logotipo: el agente NavIA + la palabra "NavIA" con el degradado de la marca. */
export function NaviaLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <NaviaAgent size={size} compact />
      <span className="brand-text text-xl font-extrabold tracking-tight">NavIA</span>
    </span>
  );
}
