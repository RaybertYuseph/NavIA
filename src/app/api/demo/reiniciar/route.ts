import { withDemoFiscal } from '@/lib/demoDay';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

/**
 * Solo en la demo: borra las salidas y esperas de hoy con la sesión del fiscal de la demo, para
 * poder reiniciar desde la pantalla de entrada o el menú de cualquier vista (las cuentas de la demo
 * son públicas, así que no hace falta sesión). Fuera de la demo no existe.
 */
export async function POST() {
  if (!DEMO) return new Response('No encontrado', { status: 404 });
  try {
    const deleted = await withDemoFiscal(async (fiscal) => {
      const { data, error } = await fiscal.rpc('reset_demo_today');
      if (error) throw error;
      return data as number;
    });
    return Response.json({ deleted: deleted ?? 0 });
  } catch (e) {
    return Response.json({ error: (e as { message?: string }).message ?? 'No se pudo reiniciar' }, { status: 500 });
  }
}
