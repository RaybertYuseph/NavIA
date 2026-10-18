import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const body = z.object({ vehicle_id: z.string().uuid(), available: z.boolean() });

/** El conductor marca su unidad disponible. La regla (solo su unidad de hoy) vive en la BD. */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const { error } = await supabase.rpc('set_vehicle_available', {
    p_vehicle_id: parsed.data.vehicle_id,
    p_available: parsed.data.available,
  });
  if (error) return Response.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  return Response.json({ ok: true });
}
