import { createClient } from '@/lib/supabase/client';

export type ErrorKind = 'js' | 'promesa' | 'pantalla';
type Report = { kind: ErrorKind; message: string; stack: string | null; path: string; online: boolean };

const MAX_PER_PAGE = 10;
// Ruido que no es de NavIA: extensiones del navegador, scripts de otros sitios, avisos del navegador.
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i, /Non-Error promise rejection/i];

const seen = new Set<string>();
let pending: Report[] = [];
let sent = 0;

/** Convierte lo que llegó (Error, texto, lo que sea) en un reporte, o null si es ruido o repetido. */
export function toReport(kind: ErrorKind, err: unknown, path: string, online: boolean): Report | null {
  const e = err instanceof Error ? err : null;
  const message = (e ? `${e.name}: ${e.message}` : String(err ?? '')).trim();
  const stack = e?.stack ?? null;
  if (!message || NOISE.some((r) => r.test(message) || (stack && r.test(stack)))) return null;
  const key = `${kind}|${message}`;
  if (seen.has(key)) return null;
  seen.add(key);
  // Sin la parte después de "?": puede traer el código de un enlace de recuperar contraseña.
  return { kind, message, stack, path: path.split('?')[0], online };
}

/** Reporta un error a Supabase (tabla client_errors). Nunca lanza: reportar no puede romper la app. */
export function reportError(kind: ErrorKind, err: unknown) {
  try {
    if (typeof window === 'undefined' || sent + pending.length >= MAX_PER_PAGE) return;
    const report = toReport(kind, err, window.location.pathname, navigator.onLine);
    if (!report) return;
    pending.push(report);
    if (navigator.onLine) void flushErrors();
  } catch {
    /* nada */
  }
}

async function flushErrors() {
  const batch = pending;
  pending = [];
  for (const r of batch) {
    sent++;
    try {
      await createClient().rpc('log_client_error', {
        p_kind: r.kind,
        p_message: r.message,
        p_stack: r.stack,
        p_path: r.path,
        p_user_agent: navigator.userAgent,
        p_online: r.online,
      });
    } catch {
      /* sin señal o sin la migración 0018: se pierde, no se reintenta */
    }
  }
}

let installed = false;
/** Escucha los errores que nadie atrapó en toda la app; al volver la señal envía los guardados. */
export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => reportError('js', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError('promesa', e.reason));
  window.addEventListener('online', () => void flushErrors());
}
