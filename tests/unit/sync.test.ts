import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/offline/db';
import { flush } from '@/lib/offline/sync';
import type { QueueItem } from '@/lib/offline/types';

const trip = '11111111-1111-4111-8111-111111111111';
const ev = (n: number): QueueItem => ({
  kind: 'event',
  id: `00000000-0000-4000-8000-00000000000${n}`,
  trip_id: trip,
  type: 'en_camino',
  stop_id: null,
  occurred_at: new Date(2026, 9, 18, 6, n).toISOString(),
});

beforeEach(async () => {
  await db.queue.clear();
});

describe('cola offline', () => {
  it('sin señal no pierde nada', async () => {
    await db.queue.bulkAdd([ev(1), ev(2)]);
    const offline = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await flush(offline)).toBe(2);
  });

  it('envía en orden y borra lo confirmado', async () => {
    await db.queue.bulkAdd([ev(1), ev(2), ev(3)]);
    const sent: string[] = [];
    const ok = vi.fn(async (_url: string, init: RequestInit) => {
      const ids = JSON.parse(init.body as string).items.map((i: QueueItem) => i.id);
      sent.push(...ids);
      return new Response(JSON.stringify({ done: ids, rejected: [] }));
    });
    expect(await flush(ok as unknown as typeof fetch)).toBe(0);
    expect(sent).toEqual([ev(1).id, ev(2).id, ev(3).id]);
  });

  it('si el servidor se detiene a mitad, conserva el resto para reintentar', async () => {
    await db.queue.bulkAdd([ev(1), ev(2), ev(3)]);
    const partial = vi.fn(async () => new Response(JSON.stringify({ done: [ev(1).id], rejected: [] })));
    expect(await flush(partial as unknown as typeof fetch)).toBe(2);
    expect(partial).toHaveBeenCalledTimes(1);
  });
});

describe('ids sembrados a mano', () => {
  it('la cola acepta ids que no son UUID v4 (p. ej. 00000000-…-000000000020)', async () => {
    const { queueItem } = await import('@/lib/offline/types');
    const id = '00000000-0000-0000-0000-000000000020';
    expect(queueItem.safeParse({ kind: 'event', id, trip_id: id, type: 'en_camino', stop_id: id, occurred_at: new Date().toISOString() }).success).toBe(true);
  });
});
