import { createServerClient } from '@/lib/supabase/server';
import { syncRequest, type QueueItem, type SyncResponse } from '@/lib/offline/types';

// Errores que no se arreglan reintentando: RLS, FK inexistente, dato inválido.
const PERMANENT = new Set(['42501', '23503', '22P02', '23514', '22007']);

/**
 * Recibe la cola offline del conductor y la aplica en el orden en que ocurrió.
 * Es idempotente: reenviar lo mismo no duplica (client_event_id y (trip_id, recorded_at) únicos).
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = syncRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const out: SyncResponse = { done: [], rejected: [] };
  const items = parsed.data.items;

  for (let i = 0; i < items.length; ) {
    // Pings consecutivos de la misma salida van en un solo insert.
    const group: QueueItem[] = [items[i]];
    if (items[i].kind === 'ping') {
      while (i + group.length < items.length) {
        const next = items[i + group.length];
        if (next.kind !== 'ping' || next.trip_id !== items[i].trip_id) break;
        group.push(next);
      }
    }

    const { error } = await insertGroup(supabase, user.id, group);
    if (error && !PERMANENT.has(error.code ?? '')) break; // falla temporal: el teléfono reintenta
    for (const item of group) {
      out.done.push(item.id);
      if (error) out.rejected.push({ id: item.id, reason: error.message });
    }
    i += group.length;
  }

  return Response.json(out);
}

async function insertGroup(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  actorId: string,
  group: QueueItem[],
) {
  const first = group[0];
  if (first.kind === 'event') {
    return supabase.from('trip_events').upsert(
      {
        trip_id: first.trip_id,
        type: first.type,
        stop_id: first.stop_id,
        actor_id: actorId,
        client_event_id: first.id,
        occurred_at: first.occurred_at,
        ...(first.restore && { restore_status: first.restore.status, restore_stop_id: first.restore.stop_id }),
      },
      { onConflict: 'client_event_id', ignoreDuplicates: true },
    );
  }
  const rows = group.flatMap((p) =>
    p.kind === 'ping'
      ? [{ trip_id: p.trip_id, lat: p.lat, lng: p.lng, speed_kmh: p.speed_kmh, recorded_at: p.recorded_at }]
      : [],
  );
  return supabase.from('location_pings').upsert(rows, { onConflict: 'trip_id,recorded_at', ignoreDuplicates: true });
}
