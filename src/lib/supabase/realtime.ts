import type { RealtimeChannel } from '@supabase/supabase-js';
import type { createClient } from './client';

/**
 * Se suscribe a Realtime con la sesión del usuario. Al recargar la página el socket puede
 * conectar antes de leer la sesión de las cookies y quedar como anónimo, y entonces RLS le
 * oculta las filas y no llega ningún cambio. Devuelve la función para cancelar.
 */
export function subscribeWithSession(supabase: ReturnType<typeof createClient>, makeChannel: () => RealtimeChannel) {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (!cancelled) channel = makeChannel().subscribe();
  })();
  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
