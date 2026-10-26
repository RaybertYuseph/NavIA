import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const body = z.object({ vehicle_id: z.guid(), route_id: z.guid(), depart_in: z.number().int().min(0).max(120).optional() });

/**
 * El conductor se activa disponible en la parada de salida de una ruta y dice en cuántos minutos
 * sale. La BD crea la salida a esa hora o toma la que el fiscal anunció cerca de ella (0010).
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const args = { p_vehicle_id: parsed.data.vehicle_id, p_route_id: parsed.data.route_id };
  let { data, error } = await supabase.rpc('set_available_at_stop', { ...args, p_depart_in: parsed.data.depart_in ?? 0 });
  // Sin la migración 0010 la función no recibe la hora: sale ahora.
  if (error?.code === 'PGRST202') ({ data, error } = await supabase.rpc('set_available_at_stop', args));
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'PGRST202' ? 501 : error.code === '55000' ? 409 : 500;
    return Response.json({ error: error.message, code: error.code, hint: error.hint }, { status });
  }
  return Response.json({ trip_id: data });
}
