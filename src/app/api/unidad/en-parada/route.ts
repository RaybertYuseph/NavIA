import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const body = z.object({ vehicle_id: z.guid(), route_id: z.guid() });

/**
 * El conductor se activa disponible en la parada de salida de una ruta. La BD le asigna la salida
 * pendiente más próxima de esa ruta o crea una para ahora (set_available_at_stop, 0008).
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const { data, error } = await supabase.rpc('set_available_at_stop', {
    p_vehicle_id: parsed.data.vehicle_id,
    p_route_id: parsed.data.route_id,
  });
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'PGRST202' ? 501 : error.code === '55000' ? 409 : 500;
    return Response.json({ error: error.message, code: error.code, hint: error.hint }, { status });
  }
  return Response.json({ trip_id: data });
}
