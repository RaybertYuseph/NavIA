import type { Audience } from '@/features/auth/demoAccess';

/**
 * Encuestas de la demo: 7 preguntas por público, lo más concreto posible. `id` es la clave
 * que se guarda en encuestas.respuestas (no cambiarla sin migrar el análisis de las respuestas).
 * El correo (obligatorio, para trazar cada respuesta) va en encuestas.contacto, y `piloto`
 * guarda «Sí» o «No» según la persona marque que quiere entrar al piloto.
 *
 * Qué KPI mide cada una (fichas «Prueba NavIA 7 días», tablero en /encuestas):
 * - Principal, intención de adopción: `usaria` (≥60% «Sí, seguro» o «Probablemente») y `piloto` (≥40% «Sí»).
 * - A, valor percibido (estudiantes): `util` (≥4/5), `facil` (≥4/5) y `whatsapp` (≥60% «Sí»).
 * - B, conductores y asociación: `usaria` del enlace conductor-fiscal (≥3 de 5 conductores).
 * - C, precio: `precio` en los dos enlaces (≥50% acepta al menos el 2,5% del pasaje) y `reparto`
 *   (≥3 de 5 conductores aceptan 50/50).
 * - Diagnóstico: `favorita`, `rol`, `facil`, `preocupa` y `falta`.
 *
 * `falta` (abierta) solo aparece a quien responde «No sé» o «No» en `usaria`: si no se llega al
 * umbral de adopción, es lo que dice qué construir o cambiar antes de replantear el MVP.
 */
type ShowIf = { showIf?: { id: string; in: string[] } };
export type Question = (
  | { id: string; kind: 'choice'; text: string; options: string[] }
  | { id: string; kind: 'scale'; text: string; low: string; high: string }
  | { id: string; kind: 'open'; text: string; placeholder: string }
  /** Montos en Bs al `percents` del pasaje, más uno libre; se guarda el monto en Bs. */
  | { id: string; kind: 'price'; text: string; percents: number[] }
  | { id: string; kind: 'contact'; text: string; pilot: string }
) &
  ShowIf;

/** Pasaje actual de la ruta Guarenas/Guatire → USM (Bs). */
export const PASAJE = 1180;
export const PRICE_PERCENTS = [2.5, 3.5, 5.5, 7.5];
export const priceFor = (pct: number) => Math.round(PASAJE * pct) / 100;
export const pctOf = (bs: number) => (bs / PASAJE) * 100;
export const fmtBs = (n: number) => `${n.toLocaleString('es-VE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}\u00a0Bs`;
export const fmtPct = (n: number) => `${n.toLocaleString('es-VE', { maximumFractionDigits: 1 })} %`;

const NO_ADOPTA = { id: 'usaria', in: ['No sé', 'No'] };

export const SURVEYS: Record<Audience, Question[]> = {
  estudiante: [
    { id: 'usaria', kind: 'choice', text: 'Si NavIA estuviera en tu ruta, ¿la usarías en cada viaje?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'util', kind: 'scale', text: '¿Qué tan útil te pareció lo que viste?', low: 'Nada útil', high: 'Muy útil' },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció usar NavIA?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'whatsapp', kind: 'choice', text: 'Con NavIA, ¿dejarías de preguntar en el grupo de WhatsApp dónde viene la camioneta?', options: ['Sí', 'A veces', 'No'] },
    { id: 'precio', kind: 'price', percents: PRICE_PERCENTS, text: 'Respuesta honesta: tomando en cuenta estos beneficios, ¿cuál sería el valor adicional sumado al pasaje que estarías dispuesto a pagar?' },
    { id: 'favorita', kind: 'choice', text: '¿Qué te sirvió más?', options: ['Ver la camioneta en el mapa', 'El aviso cuando llega', '«Estoy aquí» en mi parada', 'Preguntarle a NavIA'] },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en cada viaje?', placeholder: 'Ej.: que funcione sin datos, que avise antes, que sea gratis…' },
    { id: 'piloto', kind: 'contact', text: 'Para terminar, déjanos tu correo.', pilot: 'Quiero entrar al piloto cuando NavIA llegue a mi ruta' },
  ],
  'conductor-fiscal': [
    { id: 'rol', kind: 'choice', text: '¿Cuál es tu rol en la línea?', options: ['Conductor', 'Fiscal o coordinador', 'Directiva de la asociación', 'Otro'] },
    { id: 'usaria', kind: 'choice', text: 'Si la asociación lo aprueba, ¿usarías NavIA en cada salida o para coordinar la línea?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció de usar?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'preocupa', kind: 'choice', text: '¿Qué es lo que más te preocupa de usarla?', options: ['Gasto de datos o batería', 'Que me rastreen', 'Distraerme al manejar', 'Nada'] },
    { id: 'precio', kind: 'price', percents: PRICE_PERCENTS, text: 'Respuesta honesta: viendo lo que integraría la app, ¿cuál consideras que es el valor adecuado por pasaje por concepto de comisión para NavIA?' },
    { id: 'reparto', kind: 'choice', text: 'La comisión de NavIA es 5% por pasaje (59 Bs de 1.180 Bs). ¿Cómo preferirías pagarla?', options: ['La absorbo yo (recibo 1.121 Bs)', '50/50 con el estudiante (recibo 1.150,50 Bs)', 'Que la pague el estudiante', 'No pagaría comisión'] },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en tu línea?', placeholder: 'Ej.: que gaste menos datos, que la apruebe la asociación, sin comisión…' },
    { id: 'piloto', kind: 'contact', text: 'Para terminar, déjanos tu correo.', pilot: 'Quiero que mi unidad o mi línea esté en el piloto' },
  ],
};

export const FALTA_MAX = 300;
export const CORREO_MAX = 200;

/** Las preguntas que ve esta persona según lo que ya respondió. */
export function visibleQuestions(questions: Question[], answers: Record<string, string>): Question[] {
  return questions.filter((q) => !q.showIf || q.showIf.in.includes(answers[q.showIf.id] ?? ''));
}
