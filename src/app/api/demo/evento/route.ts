import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const body = z.object({
  audiencia: z.enum(['estudiante', 'conductor-fiscal']),
  evento: z.enum(['visita', 'entrada', 'tour', 'video', 'encuesta']),
  canal: z.string().regex(/^[a-z0-9-]{1,24}$/),
  visitante: z.uuid(),
});

/** Solo en la demo: anota un paso del embudo de la prueba (tabla demo_eventos). Sin sesión también: la visita es antes de entrar. */
export async function POST(req: Request) {
  if (!DEMO) return new Response('No encontrado', { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const supabase = await createServerClient();
  const { error } = await supabase.from('demo_eventos').insert(parsed.data);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
