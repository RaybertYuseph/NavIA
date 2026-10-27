import type { Audience } from '@/features/auth/demoAccess';

/**
 * Encuestas de la demo: 8 preguntas por público, lo más concreto posible. `id` es la clave
 * que se guarda en encuestas.respuestas (no cambiarla sin migrar el análisis de las respuestas).
 * El correo (obligatorio, para trazar cada respuesta) va en encuestas.contacto, y `piloto`
 * guarda «Sí» o «No» según la persona marque que quiere entrar al piloto.
 *
 * Qué KPI mide cada una (fichas «Prueba NavIA 7 días» v2, tablero en /encuestas):
 * - Filtro de segmento: `ruta` va primero; los KPI se calculan con quien viaja o trabaja en la ruta
 *   Guarenas/Guatire → USM (SEGMENTO) y el resto se ve aparte.
 * - Principal, intención de adopción: `usaria` (≥60% «Sí, seguro» o «Probablemente») y `piloto` (≥40% «Sí»).
 * - A, valor percibido (estudiantes): `util` (≥4/5), `facil` (≥4/5) y `whatsapp` (≥60% «Sí»).
 * - B, conductores y asociación: `usaria` del enlace conductor-fiscal (≥3 de 5 conductores).
 * - C, precio: `precio` en los dos enlaces (≥50% acepta al menos el 2,5% del pasaje) y `reparto`
 *   (≥3 de 5 conductores aceptan 50/50). `none` permite decir que no pagaría nada (se guarda «0»),
 *   para que la meta pueda fallar.
 * - Diagnóstico: `favorita`, `rol`, `facil`, `preocupa` y `falta`.
 *
 * `falta` (abierta) solo aparece a quien responde «No sé» o «No» en `usaria`: si no se llega al
 * umbral de adopción, es lo que dice qué construir o cambiar antes de replantear el MVP.
 */
type ShowIf = { showIf?: { id: string; in: string[] } };
export type Question = (
  /** `other`: última opción con texto libre (`hint` de ejemplo); se guarda como «Otra: <texto>». */
  | { id: string; kind: 'choice'; text: string; options: string[]; other?: string; hint?: string }
  | { id: string; kind: 'scale'; text: string; low: string; high: string }
  | { id: string; kind: 'open'; text: string; placeholder: string }
  /** Montos en Bs (cada uno con su % del pasaje), «nada» (`none`, se guarda «0») y uno libre; se guarda el monto en Bs. */
  | { id: string; kind: 'price'; text: string; amounts: number[]; none: string }
  | { id: string; kind: 'contact'; text: string; pilot: string }
) &
  ShowIf;

/** Pasaje actual de la ruta Guarenas/Guatire → USM (Bs). */
export const PASAJE = 1180;
/** Comisión decidida por lado; el KPI C mide cuántos aceptan pagar al menos esto. */
export const COMISION_LADO = 2.5;
/** Montos que ve el estudiante, en % del pasaje (sin el 2,5 %: el KPI cuenta igual las respuestas libres). */
export const PRICE_PERCENTS = [3.5, 5.5, 7.5, 10];
/**
 * Conductor: montos más altos que los del estudiante, de mayor a menor, porque con el 50/50
 * (pregunta siguiente) solo aporta la mitad de lo que elija.
 */
export const DRIVER_AMOUNTS = [190, 130, 90, 60];
export const priceFor = (pct: number) => Math.round(PASAJE * pct) / 100;
export const pctOf = (bs: number) => (bs / PASAJE) * 100;
export const fmtBs = (n: number) => `${n.toLocaleString('es-VE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}\u00a0Bs`;
export const fmtPct = (n: number) => `${n.toLocaleString('es-VE', { maximumFractionDigits: 1 })} %`;

const NO_ADOPTA = { id: 'usaria', in: ['No sé', 'No'] };

/** Rutas que se ofrecen en la primera pregunta; «Otra» abre texto libre. */
export const RUTAS = ['California', 'Guarenas', 'Guatire', 'Concresa', 'La Guaira', 'Los Teques', 'Plaza Venezuela / Chacaíto'];
/** El segmento de la prueba: la ruta Guarenas/Guatire → USM. */
export const SEGMENTO = ['Guarenas', 'Guatire'];

export const SURVEYS: Record<Audience, Question[]> = {
  estudiante: [
    { id: 'ruta', kind: 'choice', text: '¿Qué ruta usas para llegar a la USM?', options: RUTAS, other: 'Otra', hint: 'Escribe tu ruta' },
    { id: 'usaria', kind: 'choice', text: 'Si NavIA estuviera en tu ruta, ¿la usarías en cada viaje?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'util', kind: 'scale', text: '¿Qué tan útil te pareció lo que viste?', low: 'Nada útil', high: 'Muy útil' },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció usar NavIA?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'whatsapp', kind: 'choice', text: 'Con NavIA, ¿dejarías de preguntar en el grupo de WhatsApp dónde viene la camioneta?', options: ['Sí', 'A veces', 'No'] },
    { id: 'precio', kind: 'price', amounts: PRICE_PERCENTS.map((p) => priceFor(p)), none: 'No pagaría nada adicional', text: 'Respuesta honesta: tomando en cuenta estos beneficios, ¿qué porcentaje adicional sobre tu pasaje estarías dispuesto a pagar?' },
    { id: 'favorita', kind: 'choice', text: '¿Qué te sirvió más?', options: ['Ver la camioneta en el mapa', 'El aviso cuando llega', '«Estoy aquí» en mi parada', 'Preguntarle a NavIA'] },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en cada viaje?', placeholder: 'Ej.: que funcione sin datos, que avise antes, que sea gratis…' },
    { id: 'piloto', kind: 'contact', text: 'Para terminar, déjanos tu correo.', pilot: 'Quiero entrar al piloto cuando NavIA llegue a mi ruta' },
  ],
  'conductor-fiscal': [
    { id: 'ruta', kind: 'choice', text: '¿En qué ruta trabajas?', options: RUTAS, other: 'Otra', hint: 'Escribe tu ruta' },
    { id: 'rol', kind: 'choice', text: '¿Cuál es tu rol en la línea?', options: ['Conductor', 'Fiscal o coordinador', 'Directiva de la asociación', 'Otro'] },
    { id: 'usaria', kind: 'choice', text: 'Si la asociación lo aprueba, ¿usarías NavIA en cada salida o para coordinar la línea?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció de usar?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'preocupa', kind: 'choice', text: '¿Qué es lo que más te preocupa de usarla?', options: ['Gasto de datos o batería', 'Que me rastreen', 'Distraerme al manejar', 'Nada'] },
    { id: 'precio', kind: 'price', amounts: DRIVER_AMOUNTS, none: 'NavIA no debería cobrar comisión', text: 'Respuesta honesta: viendo lo que integraría la app, ¿qué porcentaje de cada pasaje consideras adecuado como comisión para NavIA?' },
    { id: 'reparto', kind: 'choice', text: 'Sea cual sea el monto, ¿quién debería pagar la comisión de NavIA por cada pasaje?', options: ['La absorbo yo (sale de mi pasaje)', '50/50 con el estudiante (mitad y mitad)', 'Que la pague completa el estudiante'], other: 'Otra alternativa', hint: 'Cuéntanos cómo preferirías que se cobre' },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en tu línea?', placeholder: 'Ej.: que gaste menos datos, que la apruebe la asociación, sin comisión…' },
    { id: 'piloto', kind: 'contact', text: 'Para terminar, déjanos tu correo.', pilot: 'Quiero que mi unidad o mi línea esté en el piloto' },
  ],
};

export const FALTA_MAX = 300;
export const OTRA = 'Otra: ';
export const CORREO_MAX = 200;

/** Las preguntas que ve esta persona según lo que ya respondió. */
export function visibleQuestions(questions: Question[], answers: Record<string, string>): Question[] {
  return questions.filter((q) => !q.showIf || q.showIf.in.includes(answers[q.showIf.id] ?? ''));
}
