import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from 'serwist';
import { ExpirationPlugin, NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Página que ve quien abre la app sin señal y sin una copia guardada de esa pantalla. Antes el
 * service worker respondía con un error ("no-response") y el navegador se quedaba en blanco o en
 * la pantalla anterior sin avanzar. Esta se recarga sola cuando vuelve la conexión.
 */
const OFFLINE_HTML = `<!doctype html><html lang="es-VE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>NavIA · Sin conexión</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,sans-serif;background:#f0f9ff;color:#0f172a;text-align:center;padding:24px}
main{max-width:22rem}h1{font-size:1.4rem;margin:.5rem 0}p{color:#475569}
button{margin-top:1rem;border:0;border-radius:1rem;padding:.9rem 1.4rem;font-weight:700;font-size:1rem;
background:#0ea5e9;color:#fff}</style></head><body><main>
<h1>No pude conectarme</h1>
<p>Tu señal está fallando o es muy lenta. Apenas vuelva, abro la página solo.</p>
<button onclick="location.reload()">Reintentar</button></main>
<script>addEventListener('online',function(){location.reload()});setTimeout(function(){location.reload()},15000)</script>
</body></html>`;

const offlineFallback: SerwistPlugin = {
  handlerDidError: async () =>
    new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
};

// Supabase (sesión, datos en vivo, fotos) va siempre directo a la red y el service worker no lo
// toca: así no se sirven datos o sesiones viejas de caché ni se corta una consulta lenta a los 10 s.
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
const isSupabase = (url: URL) => url.hostname.endsWith('.supabase.co') || (SUPABASE_HOST !== '' && url.hostname === SUPABASE_HOST);

const runtimeCaching: RuntimeCaching[] = [
  // Abrir una pantalla: red primero, copia guardada si no hay señal y, si no hay copia, la página
  // de "sin conexión" en vez de un error.
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
    handler: new NetworkFirst({
      cacheName: 'pages',
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }), offlineFallback],
    }),
  },
  // Las reglas por defecto de Serwist, menos dos: la que interceptaba cualquier otro dominio
  // (incluida la API de Supabase) y la de cierre que interceptaba todo lo demás sin cachear.
  // Lo que no coincide con ninguna regla lo maneja el navegador como si no hubiera service worker.
  ...defaultCache
    .filter((entry) => !(entry.matcher instanceof RegExp && entry.matcher.source === '.*'))
    .map((entry): RuntimeCaching => {
      if (typeof entry.matcher !== 'function') return entry;
      const original = entry.matcher;
      return {
        ...entry,
        matcher: (opts) => !(opts.sameOrigin === false && isSupabase(opts.url)) && original(opts),
      };
    }),
];

// App shell en caché: la PWA abre sin señal después de la primera visita.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
