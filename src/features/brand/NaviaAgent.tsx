'use client';
import { useEffect, useRef } from 'react';

/**
 * NavIA, la gota copiloto: cuerpo azul con audífonos y zapatos (imagen), la mano con el pin en
 * capa aparte para moverla, y una cara LED en SVG que parpadea, sonríe y habla.
 * - `animated`: respira, parpadea y mueve el pin.
 * - `talking`: mueve la boca (al escribir una respuesta). `mood="happy"`: ojos felices.
 * - `walking`: rebote de caminata. `pointing`: levanta el pin para señalar. `flip`: mira a la izquierda.
 * - `compact`: encuadre de la cabeza y el pin, para tamaños pequeños.
 * Las animaciones se apagan con prefers-reduced-motion (globals.css).
 */
export function NaviaAgent({
  size = 96,
  animated = false,
  compact = false,
  talking = false,
  mood = 'idle',
  walking = false,
  pointing = false,
  flip = false,
  className = '',
}: {
  size?: number;
  animated?: boolean;
  compact?: boolean;
  talking?: boolean;
  mood?: 'idle' | 'happy';
  walking?: boolean;
  pointing?: boolean;
  flip?: boolean;
  className?: string;
}) {
  const mouth = useRef<SVGPathElement>(null);
  const inner = useRef<SVGPathElement>(null);

  useEffect(() => {
    const draw = (o: number, w: number) => {
      const d = mouthD(o, w);
      mouth.current?.setAttribute('d', d.outer);
      inner.current?.setAttribute('d', d.inner);
    };
    if (!talking || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(mood === 'happy' ? 0.35 : 0.1, mood === 'happy' ? 1 : 0.9);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const s = (t - start) / 1000;
      // Sílabas: dos senos desfasados dan una apertura irregular, más natural que un vaivén fijo.
      const o = 0.15 + 0.75 * Math.abs(Math.sin(s * 13) * Math.sin(s * 4.7 + 0.6));
      draw(o, 0.82 + 0.14 * Math.sin(s * 6.1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [talking, mood]);

  const [vx, vy, vw, vh] = compact ? [90, 15, 330, 330] : [0, 0, 430, 522];
  const happy = mood === 'happy';
  const motion = walking ? 'gota-walk' : animated ? 'gota-bob' : '';
  const hand = pointing ? 'gota-point' : animated || walking ? 'gota-hand' : '';

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      width={size}
      height={Math.round((size * vh) / vw)}
      role="img"
      aria-label="NavIA, tu copiloto de ruta"
      className={className}
      style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <defs>
        <radialGradient id="nv-eye" cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor="#F2FFFF" />
          <stop offset=".45" stopColor="#9FF6FF" />
          <stop offset="1" stopColor="#3FD8F5" />
        </radialGradient>
        <radialGradient id="nv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#7DF3FF" stopOpacity=".55" />
          <stop offset="1" stopColor="#7DF3FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0B1533" stopOpacity=".3" />
          <stop offset="1" stopColor="#0B1533" stopOpacity="0" />
        </radialGradient>
      </defs>

      {!compact && <ellipse className={animated || walking ? 'gota-shadow' : ''} cx="215" cy="505" rx="140" ry="16" fill="url(#nv-shadow)" />}
      <g className={motion}>
        <image href="/brand/gota/base.webp" x="0" y="0" width="430" height="522" />
        <g className={hand}>
          <image href="/brand/gota/mano.webp" x="0" y="0" width="430" height="522" />
        </g>
        <g transform="rotate(-9 236 200)">
          <ellipse cx="203" cy="194" rx="26" ry="26" fill="url(#nv-glow)" />
          <ellipse cx="268" cy="194" rx="26" ry="26" fill="url(#nv-glow)" />
          <g className={animated || walking ? 'gota-blink' : ''} opacity={happy ? 0 : 1}>
            <rect x="191" y="178" width="24" height="31" rx="12" fill="url(#nv-eye)" />
            <rect x="256" y="178" width="24" height="31" rx="12" fill="url(#nv-eye)" />
          </g>
          <path
            d="M190 196 Q203 180 216 196 M255 196 Q268 180 281 196"
            stroke="#A8F7FF"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            opacity={happy ? 1 : 0}
          />
          <ellipse cx="236" cy="230" rx="44" ry="22" fill="url(#nv-glow)" />
          <path ref={mouth} d={mouthD(0.1, 0.9).outer} fill="url(#nv-eye)" />
          <path ref={inner} d="" fill="#0A1C66" />
        </g>
      </g>
    </svg>
  );
}

/** Boca LED: `o` es la apertura (0 cerrada, 1 abierta) y `w` el ancho relativo. */
function mouthD(o: number, w: number) {
  const cx = 236;
  const y = 222;
  const W = 30 * w;
  const top = 3 + o * 2;
  const bot = 13 + o * 19;
  return {
    outer: `M${cx - W} ${y} Q${cx} ${y + top} ${cx + W} ${y} Q${cx + W * 0.9} ${y + bot * 0.9} ${cx} ${y + bot} Q${cx - W * 0.9} ${y + bot * 0.9} ${cx - W} ${y} Z`,
    inner:
      o > 0.18
        ? `M${cx - W * 0.72} ${y + top + 2} Q${cx} ${y + top + 4} ${cx + W * 0.72} ${y + top + 2} Q${cx + W * 0.6} ${y + bot * 0.8} ${cx} ${y + bot - 3.5} Q${cx - W * 0.6} ${y + bot * 0.8} ${cx - W * 0.72} ${y + top + 2} Z`
        : '',
  };
}

/** Logotipo: la cabeza de NavIA + la palabra "NavIA" con el degradado de la marca. */
export function NaviaLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <NaviaAgent size={size} compact />
      <span className="brand-text text-xl font-extrabold tracking-tight">NavIA</span>
    </span>
  );
}
