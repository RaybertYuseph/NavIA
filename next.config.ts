import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // En desarrollo el service worker estorba (caché vieja); solo en build.
  disable: process.env.NODE_ENV === 'development',
});

// Supabase (API, Realtime y fotos) y las teselas del mapa (Esri y, de respaldo, OpenStreetMap).
const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '') || 'https://*.supabase.co';
const tiles = 'https://server.arcgisonline.com https://tile.openstreetmap.org';

// Next.js mete scripts en línea al hidratar: sin nonces, 'unsafe-inline' es el mínimo que funciona.
// Lo que sí cierra: scripts de otros dominios, la página dentro de un iframe ajeno y formularios
// que envíen a otro sitio.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} ${tiles}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, 'wss:')} ${tiles}`,
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // GPS solo para la propia app (conductor y "Estoy aquí"); cámara para subir la foto de la unidad.
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSerwist(nextConfig);
