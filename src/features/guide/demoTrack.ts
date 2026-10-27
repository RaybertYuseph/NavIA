import { readAudience, type Audience } from '@/features/auth/demoAccess';

/**
 * Embudo de la prueba de 7 días (fichas v2): cuántas personas abren el enlace, entran a la demo,
 * terminan el tour, ven el video completo y envían la encuesta, y por qué canal llegaron.
 * Cada navegador lleva un id al azar (no identifica a nadie) para contar personas y no clics.
 * Se guarda en la tabla demo_eventos (migración 0015); si falla, la demo sigue igual.
 */
export type DemoEvento = 'visita' | 'entrada' | 'tour' | 'video' | 'encuesta';

const CANAL_KEY = 'navia:demo:canal';
const VISITANTE_KEY = 'navia:demo:visitante';
const CANAL = /^[a-z0-9-]{1,24}$/;

/** Canal del enlace (?canal=whatsapp, ?canal=usm…): se recuerda en este navegador. */
export function rememberCanal(raw: string | null) {
  try {
    const canal = raw?.trim().toLowerCase() ?? '';
    if (CANAL.test(canal)) localStorage.setItem(CANAL_KEY, canal);
    else if (!localStorage.getItem(CANAL_KEY)) localStorage.setItem(CANAL_KEY, 'directo');
  } catch {
    /* sin almacenamiento: la respuesta queda sin canal */
  }
}

export function readCanal(): string | null {
  try {
    return localStorage.getItem(CANAL_KEY);
  } catch {
    return null;
  }
}

function visitante(): string | null {
  try {
    let id = localStorage.getItem(VISITANTE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITANTE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Anota un paso del embudo. `audience` por defecto: el enlace por el que entró este navegador. */
export function trackDemo(evento: DemoEvento, audience: Audience | null = readAudience()) {
  const id = visitante();
  if (!audience || !id) return;
  void fetch('/api/demo/evento', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audiencia: audience, evento, canal: readCanal() ?? 'directo', visitante: id }),
    keepalive: true,
  }).catch(() => undefined);
}
