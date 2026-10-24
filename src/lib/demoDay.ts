import { createClient } from '@supabase/supabase-js';
import { caracasDayRange } from '@/lib/time';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const DEMO_FISCAL = 'fiscal@navia.test';

/** Día (inicio en UTC) ya preparado por esta instancia del servidor. */
let readyDay: string | null = null;

/**
 * Solo en modo demo: si hoy todavía no hay salidas, entra como el fiscal de la demo y llama a
 * reset_demo_today(), que copia el horario del último día con salidas. Así el conductor y el
 * estudiante tienen salidas cada mañana sin que nadie pulse "Reiniciar demo". Si hoy ya hay
 * salidas no toca nada, para no borrar una demo en curso. Si algo falla, la página sigue igual.
 */
export async function ensureDemoDay() {
  const password = (process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '').trim();
  if (!DEMO || !password) return;
  const { from, to } = caracasDayRange();
  if (readyDay === from) return;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: authError } = await supabase.auth.signInWithPassword({ email: DEMO_FISCAL, password });
    if (authError) throw authError;
    const { count, error: countError } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', from)
      .lt('scheduled_at', to);
    if (countError) throw countError;
    if (!count) {
      const { error: resetError } = await supabase.rpc('reset_demo_today');
      if (resetError) throw resetError;
    }
    await supabase.auth.signOut({ scope: 'local' });
    readyDay = from;
  } catch (e) {
    console.error('No se pudo preparar el día de la demo', e);
  }
}
