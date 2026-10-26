import { z } from 'zod';
import { withDemoFiscal } from '@/lib/demoDay';
import { createServerClient } from '@/lib/supabase/server';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const body = z.object({ action: z.enum(['start', 'tick']) });

/**
 * Solo en la demo. `start` crea las salidas de ejemplo de hoy (si aún no hay); lo hace el fiscal de
 * la demo, y si quien pide es conductor, una de esas salidas es suya. `tick` mueve las simuladas.
 */
export async function POST(req: Request) {
  if (!DEMO) return new Response('No encontrado', { status: 404 });
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  if (parsed.data.action === 'tick') {
    const { data, error } = await supabase.rpc('demo_tick');
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ moved: data });
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const driver = me?.role === 'driver' ? user.id : null;
  try {
    const created = await withDemoFiscal(async (fiscal) => {
      const { data, error } = await fiscal.rpc('simulate_demo_day', { p_driver_id: driver });
      if (error) throw error;
      return data as number;
    });
    return Response.json({ created });
  } catch (e) {
    return Response.json({ error: (e as { message?: string }).message ?? 'No se pudo simular' }, { status: 500 });
  }
}
