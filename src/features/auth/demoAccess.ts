import { createClient } from '@/lib/supabase/client';
import type { IconName } from '@/components/icons';
import type { View } from '@/features/guide/tours';

/**
 * Accesos de la demo. /login muestra los tres roles (presentación); cada enlace de
 * /demo/<audiencia> muestra solo los suyos y termina el tour con su propia encuesta.
 */
export type DemoRole = { email: string; view: View; title: string; detail: string; icon: IconName; color: string };

export const DEMO_ROLES: Record<View, DemoRole> = {
  student: { email: 'estudiante@navia.test', view: 'student', title: 'Estudiante', detail: 'Próxima salida, camioneta en el mapa y «Estoy aquí»', icon: 'pin', color: 'from-brand-400 to-indigo-500' },
  driver: { email: 'conductor@navia.test', view: 'driver', title: 'Conductor', detail: 'Un botón por paso y quién espera en cada parada', icon: 'bus', color: 'from-emerald-400 to-teal-500' },
  fiscal: { email: 'fiscal@navia.test', view: 'fiscal', title: 'Fiscal de la línea', detail: 'Unidades, mapa en vivo y salidas por ruta', icon: 'grid', color: 'from-ink to-indigo-700' },
};

export type Audience = 'estudiante' | 'conductor-fiscal';

export const AUDIENCES: Record<Audience, { views: View[]; intro: string; survey: string | undefined }> = {
  estudiante: {
    views: ['student'],
    intro: 'Entra como estudiante y te enseño en 3 minutos cómo saber dónde viene tu camioneta.',
    survey: process.env.NEXT_PUBLIC_ENCUESTA_ESTUDIANTE_URL?.trim() || undefined,
  },
  'conductor-fiscal': {
    views: ['driver', 'fiscal'],
    intro: 'Mira cómo se ve la línea desde el volante y desde la oficina del fiscal.',
    survey: process.env.NEXT_PUBLIC_ENCUESTA_CONDUCTOR_FISCAL_URL?.trim() || undefined,
  },
};

export const isAudience = (v: string): v is Audience => v in AUDIENCES;

const AUDIENCE_KEY = 'navia:demo:audiencia';

/** El enlace por el que entró este navegador: "Inicio demo" y la encuesta final dependen de él. */
export function readAudience(): Audience | null {
  try {
    const v = localStorage.getItem(AUDIENCE_KEY);
    return v && isAudience(v) ? v : null;
  } catch {
    return null;
  }
}

export function rememberAudience(audience: Audience | null) {
  try {
    if (audience) localStorage.setItem(AUDIENCE_KEY, audience);
    else localStorage.removeItem(AUDIENCE_KEY);
  } catch {
    /* sin almacenamiento: "Inicio demo" vuelve a /login */
  }
}

/** Entra con una de las cuentas públicas de la demo. Devuelve el error para mostrarlo, o null. */
export async function demoSignIn(email: string): Promise<string | null> {
  // trim(): un espacio o salto de línea pegado al guardar la variable en Vercel rompe la contraseña.
  const password = (process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '').trim();
  if (!password) return 'Falta NEXT_PUBLIC_DEMO_PASSWORD en esta publicación.';
  try {
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) return `${error.message}${error.status ? ` (${error.status})` : ''}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
}
