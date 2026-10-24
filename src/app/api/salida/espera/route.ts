import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

/** Conteo de estudiantes en espera por parada de una salida (para el conductor, sin supabase-js en su bundle). */
export async function GET(req: Request) {
  const trip = z.guid().safeParse(new URL(req.url).searchParams.get('trip'));
  if (!trip.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const { data, error } = await supabase.from('trips').select('waiting').eq('id', trip.data).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'No encontrada' }, { status: 404 });
  return Response.json({ waiting: data.waiting ?? {} }, { headers: { 'Cache-Control': 'no-store' } });
}
