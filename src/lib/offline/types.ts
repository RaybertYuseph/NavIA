import { z } from 'zod';

export const tripEventType = z.enum(['en_camino', 'en_parada', 'parada_completada', 'fin_de_ruta', 'cancelada', 'correccion']);
const tripStatus = z.enum(['scheduled', 'en_camino', 'en_parada', 'finalizada', 'cancelada']);
export type TripEventType = z.infer<typeof tripEventType>;

/** Lo que el teléfono del conductor guarda y envía. El id es el client_event_id. */
export const queueItem = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('event'),
    id: z.guid(),
    trip_id: z.guid(),
    type: tripEventType,
    stop_id: z.guid().nullable(),
    occurred_at: z.string().datetime({ offset: true }),
    /** Solo en 'correccion' (Deshacer): el estado al que vuelve la salida. */
    restore: z.object({ status: tripStatus, stop_id: z.guid().nullable() }).optional(),
  }),
  z.object({
    kind: z.literal('ping'),
    id: z.guid(),
    trip_id: z.guid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed_kmh: z.number().nullable(),
    recorded_at: z.string().datetime({ offset: true }),
  }),
]);
export type QueueItem = z.infer<typeof queueItem>;

export const syncRequest = z.object({ items: z.array(queueItem).max(200) });

/** done: ids que el teléfono puede borrar (aceptados o rechazados para siempre). */
export type SyncResponse = { done: string[]; rejected: { id: string; reason: string }[] };
