import type { Audience } from '@/features/auth/demoAccess';
import type { View } from './tours';

/**
 * Avance de la demo en este navegador (sessionStorage, como la marca de tour visto): hasta qué paso
 * llegó el tour de cada vista y qué lleva respondido de la encuesta. Con esto, quien sale a mitad
 * ve su avance y retoma donde quedó (DemoProgress). Se avisa con un evento para refrescar la tarjeta.
 */
export type TourProgress = { at: number; max: number; total: number; done: boolean };
export type SurveyProgress = { i: number; answers: Record<string, string>; contact: string; pilot: boolean; sent: boolean };

const EVENT = 'navia:progreso';
// El prefijo navia:tour: hace que forgetDemoTour (entrada nueva a la demo) borre también el avance.
const tourKey = (view: View) => `navia:tour:progreso:${view}`;
const surveyKey = (audience: Audience) => `navia:demo:encuesta:${audience}`;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: no hay avance que retomar */
  }
  window.dispatchEvent(new Event(EVENT));
}

export const readTour = (view: View) => read<TourProgress>(tourKey(view));
export const readSurvey = (audience: Audience) => read<SurveyProgress>(surveyKey(audience));

/** Paso `at` de `total` a la vista; `done` cuando llegó al final con «Listo». */
export function saveTour(view: View, at: number, total: number, done = false) {
  const prev = readTour(view);
  write(tourKey(view), { at, total, max: Math.max(at, prev?.max ?? 0), done: done || !!prev?.done });
}

export const saveSurvey = (audience: Audience, p: SurveyProgress) => write(surveyKey(audience), p);

/** Porcentaje del tour visto: cuenta el paso más lejano al que llegó; el 100 % solo al terminarlo. */
export const tourPercent = (p: TourProgress | null) => (!p ? 0 : p.done ? 100 : Math.min(99, Math.round(((p.max + 1) / p.total) * 100)));

export function onProgress(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
