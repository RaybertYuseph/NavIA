import { db, type StoredItem } from './db';
import type { QueueItem, SyncResponse } from './types';

const BATCH = 100;
let flushing: Promise<number> | null = null;
const listeners = new Set<(pending: number) => void>();

async function notify() {
  const pending = await db.queue.count();
  listeners.forEach((l) => l(pending));
}

/** Se suscribe al número de envíos pendientes (para el indicador "sin señal"). */
export function onPendingChange(cb: (pending: number) => void) {
  listeners.add(cb);
  void notify();
  return () => void listeners.delete(cb);
}

/** Guarda primero en el teléfono; luego intenta enviar. Nunca lanza por falta de red. */
export async function enqueue(item: QueueItem) {
  await db.queue.add(item);
  await notify();
  void flush();
}

/**
 * Envía la cola en orden. Si falla la red, se detiene y reintenta en el próximo flush.
 * Devuelve cuántos quedan pendientes.
 */
export function flush(fetchImpl: typeof fetch = fetch): Promise<number> {
  flushing ??= (async () => {
    try {
      for (;;) {
        const batch = await db.queue.orderBy('seq').limit(BATCH).toArray();
        if (batch.length === 0) break;
        let res: SyncResponse;
        try {
          const r = await fetchImpl('/api/sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ items: batch.map(stripSeq) }),
          });
          if (!r.ok) break;
          res = await r.json();
        } catch {
          break; // sin señal
        }
        const done = new Set(res.done);
        const seqs = batch.filter((i) => done.has(i.id)).map((i) => i.seq!);
        await db.queue.bulkDelete(seqs);
        if (res.rejected.length) console.warn('NavIA: envíos rechazados', res.rejected);
        if (seqs.length < batch.length) break; // el servidor se detuvo a mitad: reintentar luego
      }
    } finally {
      flushing = null;
      await notify();
    }
    return db.queue.count();
  })();
  return flushing;
}

let started = false;
/** Reintenta al recuperar señal y cada 15 s mientras la app esté abierta. */
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flush());
  setInterval(() => {
    if (navigator.onLine) void flush();
  }, 15_000);
  void flush();
}

function stripSeq(stored: StoredItem): QueueItem {
  const item = { ...stored };
  delete item.seq;
  return item;
}
