/**
 * Consultas periódicas que no gastan datos de más: no corren con la app minimizada o sin señal,
 * y al volver a la app (o recuperar la señal) consultan de inmediato.
 *
 * `delay` se pide en cada vuelta, así el ritmo puede cambiar en caliente (por ejemplo, más lento
 * mientras Realtime está conectado y más rápido si se cae).
 */
export function startPolling(load: () => unknown, delay: () => number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    // ±10 % al azar: miles de teléfonos no consultan todos en el mismo segundo.
    timer = setTimeout(wake, delay() * (0.9 + Math.random() * 0.2));
  };
  const wake = () => {
    if (canPoll()) void load();
    schedule();
  };
  // Cuando vuelve la señal de una zona entera, todos se reconectan a la vez: se reparte en 0-3 s.
  const onOnline = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(wake, Math.random() * 3_000);
  };

  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', onOnline);
  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', onOnline);
  };
}

export function canPoll() {
  return document.visibilityState !== 'hidden' && navigator.onLine;
}

/** Con Realtime conectado la consulta es solo un respaldo por si se perdió un evento. */
export const LIVE_BACKUP_MS = 60_000;
export const NO_LIVE_MS = 10_000;
export const liveDelay = (live: boolean) => (live ? LIVE_BACKUP_MS : NO_LIVE_MS);
