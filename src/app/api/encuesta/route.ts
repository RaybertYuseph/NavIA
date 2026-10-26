import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const body = z.object({
  audiencia: z.enum(['estudiante', 'conductor-fiscal']),
  vista: z.enum(['student', 'driver', 'fiscal']),
  respuestas: z.record(z.string().max(40), z.string().max(120)),
  contacto: z.string().trim().max(200).optional(),
});

/** Solo en la demo: guarda una respuesta de la encuesta del final del tour (tabla encuestas). */
export async function POST(req: Request) {
  if (!DEMO) return new Response('No encontrado', { status: 404 });
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { contacto, ...rest } = parsed.data;
  const { error } = await supabase.from('encuestas').insert({ ...rest, contacto: contacto || null });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
