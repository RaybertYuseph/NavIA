import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

/** Avisos sin leer del usuario (por ejemplo, "Tu unidad ahora cubre…"). Sin la migración 0009, ninguno. */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const { data } = await supabase
    .from('notifications')
    .select('id, body, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  return Response.json({ notices: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

const body = z.object({ ids: z.array(z.guid()).min(1).max(20) });

/** Marca avisos como leídos. La política de la tabla solo deja tocar los propios. */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', parsed.data.ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
