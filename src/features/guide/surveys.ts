import type { Audience } from '@/features/auth/demoAccess';

/**
 * Encuestas de la demo: 7 preguntas por público, lo más concreto posible. `id` es la clave
 * que se guarda en encuestas.respuestas (no cambiarla sin migrar el análisis de las respuestas).
 */
export type Question =
  | { id: string; kind: 'choice'; text: string; options: string[] }
  | { id: string; kind: 'scale'; text: string; low: string; high: string }
  | { id: string; kind: 'contact'; text: string; placeholder: string };

export const SURVEYS: Record<Audience, Question[]> = {
  estudiante: [
    { id: 'usaria', kind: 'choice', text: 'Si NavIA estuviera en tu ruta, ¿la usarías en cada viaje?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'util', kind: 'scale', text: '¿Qué tan útil te pareció lo que viste?', low: 'Nada útil', high: 'Muy útil' },
    { id: 'decepcion', kind: 'choice', text: '¿Qué tan decepcionado estarías si NavIA no existiera?', options: ['Muy decepcionado', 'Algo decepcionado', 'Nada decepcionado'] },
    { id: 'whatsapp', kind: 'choice', text: 'Con NavIA, ¿dejarías de preguntar en el grupo de WhatsApp dónde viene la camioneta?', options: ['Sí', 'A veces', 'No'] },
    { id: 'pagaria_30', kind: 'choice', text: 'Si NavIA sumara 30 Bs al pasaje (de 1.180 a 1.210 Bs), ¿la seguirías usando?', options: ['Sí', 'Tal vez', 'No'] },
    { id: 'favorita', kind: 'choice', text: '¿Qué te sirvió más?', options: ['Ver la camioneta en el mapa', 'El aviso cuando llega', '«Estoy aquí» en mi parada', 'Preguntarle a NavIA'] },
    { id: 'piloto', kind: 'contact', text: '¿Quieres entrar al piloto cuando llegue a tu ruta? Déjanos tu correo o WhatsApp.', placeholder: 'Correo o WhatsApp (opcional)' },
  ],
  'conductor-fiscal': [
    { id: 'rol', kind: 'choice', text: '¿Cuál es tu rol en la línea?', options: ['Conductor', 'Fiscal o coordinador', 'Directiva de la asociación', 'Otro'] },
    { id: 'usaria', kind: 'choice', text: 'Si la asociación lo aprueba, ¿usarías NavIA en cada salida o para coordinar la línea?', options: ['Sí, seguro', 'Probablemente', 'No sé', 'No'] },
    { id: 'facil', kind: 'scale', text: '¿Qué tan fácil te pareció de usar?', low: 'Muy difícil', high: 'Muy fácil' },
    { id: 'preocupa', kind: 'choice', text: '¿Qué es lo que más te preocupa de usarla?', options: ['Gasto de datos o batería', 'Que me rastreen', 'Distraerme al manejar', 'Nada'] },
    { id: 'reparto', kind: 'choice', text: 'La comisión de NavIA es 5% por pasaje (59 Bs de 1.180 Bs). ¿Cómo preferirías pagarla?', options: ['La absorbo yo (recibo 1.121 Bs)', '50/50 con el estudiante (recibo 1.150,50 Bs)', 'Que la pague el estudiante', 'No pagaría comisión'] },
    { id: 'cara_desde', kind: 'choice', text: '¿Desde qué porcentaje por pasaje te parecería cara la comisión?', options: ['1%', '3%', '5%', '8% o más'] },
    { id: 'piloto', kind: 'contact', text: '¿Quieres que tu unidad o tu línea esté en el piloto? Déjanos tu nombre y WhatsApp.', placeholder: 'Nombre y WhatsApp (opcional)' },
  ],
};
