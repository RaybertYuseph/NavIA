import type { Audience } from '@/features/auth/demoAccess';

/**
 * Encuestas de la demo: 7 preguntas por público, lo más concreto posible. `id` es la clave
 * que se guarda en encuestas.respuestas (no cambiarla sin migrar el análisis de las respuestas).
 *
 * Qué KPI mide cada una (fichas «Prueba NavIA 7 días»):
 * - Principal, intención de adopción: `usaria` (≥60% «Sí, seguro» o «Probablemente») y `piloto` (≥40% deja contacto).
 * - A, valor percibido (estudiantes): `util` (≥4/5), `decepcion` (≥40% «Muy») y `whatsapp` (≥60% «Sí»).
 * - B, conductores y asociación: `usaria` del enlace conductor-fiscal (≥3 de 5 conductores).
 * - C, precio: `pagaria_30` (≥50% de estudiantes) y `reparto` (≥3 de 5 conductores aceptan 50/50).
 * - Diagnóstico: `favorita`, `rol`, `facil`, `preocupa`, `cara_desde` y `falta`.
 *
 * `falta` (abierta) solo aparece a quien responde «No sé» o «No» en `usaria`: si no se llega al
 * umbral de adopción, es lo que dice qué construir o cambiar antes de replantear el MVP.
 */
type ShowIf = { showIf?: { id: string; in: string[] } };
export type Question = (
  | { id: string; kind: 'choice'; text: string; options: string[] }
  | { id: string; kind: 'scale'; text: string; low: string; high: string }
  | { id: string; kind: 'open'; text: string; placeholder: string }
  | { id: string; kind: 'contact'; text: string; placeholder: string }
) &
  ShowIf;

const NO_ADOPTA = { id: 'usaria', in: ['No sé', 'No'] };

export const SURVEYS: Record<Audience, Question[]> = {
  estudiante: [
    { id: 'usaria', kind: 'choice', text: 'Si NavIA estuviera en tu ruta, ¿la usarías en cada viaje?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'util', kind: 'scale', text: '¿Qué tan útil te pareció lo que viste?', low: 'Nada útil', high: 'Muy útil' },
    { id: 'decepcion', kind: 'choice', text: '¿Qué tan decepcionado estarías si NavIA no existiera?', options: ['Muy decepcionado', 'Algo decepcionado', 'Nada decepcionado'] },
    { id: 'whatsapp', kind: 'choice', text: 'Con NavIA, ¿dejarías de preguntar en el grupo de WhatsApp dónde viene la camioneta?', options: ['Sí', 'A veces', 'No'] },
    { id: 'pagaria_30', kind: 'choice', text: 'Si NavIA sumara 30 Bs al pasaje (de 1.180 a 1.210 Bs), ¿la seguirías usando?', options: ['Sí', 'Tal vez', 'No'] },
    { id: 'favorita', kind: 'choice', text: '¿Qué te sirvió más?', options: ['Ver la camioneta en el mapa', 'El aviso cuando llega', '«Estoy aquí» en mi parada', 'Preguntarle a NavIA'] },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en cada viaje?', placeholder: 'Ej.: que funcione sin datos, que avise antes, que sea gratis…' },
    { id: 'piloto', kind: 'contact', text: '¿Quieres entrar al piloto cuando llegue a tu ruta? Déjanos tu correo o WhatsApp.', placeholder: 'Correo o WhatsApp (opcional)' },
  ],
  'conductor-fiscal': [
    { id: 'rol', kind: 'choice', text: '¿Cuál es tu rol en la línea?', options: ['Conductor', 'Fiscal o coordinador', 'Directiva de la asociación', 'Otro'] },
    { id: 'usaria', kind: 'choice', text: 'Si la asociación lo aprueba, ¿usarías NavIA en cada salida o para coordinar la línea?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció de usar?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'preocupa', kind: 'choice', text: '¿Qué es lo que más te preocupa de usarla?', options: ['Gasto de datos o batería', 'Que me rastreen', 'Distraerme al manejar', 'Nada'] },
    { id: 'reparto', kind: 'choice', text: 'La comisión de NavIA es 5% por pasaje (59 Bs de 1.180 Bs). ¿Cómo preferirías pagarla?', options: ['La absorbo yo (recibo 1.121 Bs)', '50/50 con el estudiante (recibo 1.150,50 Bs)', 'Que la pague el estudiante', 'No pagaría comisión'] },
    { id: 'cara_desde', kind: 'choice', text: '¿Desde qué porcentaje por pasaje te parecería cara la comisión?', options: ['1%', '3%', '5%', '8% o más'] },
    { id: 'falta', kind: 'open', showIf: NO_ADOPTA, text: '¿Qué le faltaría a NavIA para que la usaras en tu línea?', placeholder: 'Ej.: que gaste menos datos, que la apruebe la asociación, sin comisión…' },
    { id: 'piloto', kind: 'contact', text: '¿Quieres que tu unidad o tu línea esté en el piloto? Déjanos tu nombre y WhatsApp.', placeholder: 'Nombre y WhatsApp (opcional)' },
  ],
};

export const FALTA_MAX = 300;

/** Las preguntas que ve esta persona según lo que ya respondió. */
export function visibleQuestions(questions: Question[], answers: Record<string, string>): Question[] {
  return questions.filter((q) => !q.showIf || q.showIf.in.includes(answers[q.showIf.id] ?? ''));
}
