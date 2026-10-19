import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NavIA · Tu copiloto de ruta',
    short_name: 'NavIA',
    description: 'Estado en vivo del transporte universitario.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f1f5f9',
    theme_color: '#4f46e5',
    lang: 'es-VE',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
