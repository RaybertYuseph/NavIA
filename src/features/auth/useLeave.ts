'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { readAudience } from './demoAccess';

/**
 * Salir desde el navegador, con respuesta inmediata ("Saliendo…") en vez de esperar al
 * servidor. `local` solo borra la sesión de este navegador (la demo, que no tiene nada que
 * revocar); `global` además cierra la sesión en Supabase.
 */
export function useLeave(scope: 'local' | 'global') {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leave = useCallback(async () => {
    setLeaving(true);
    try {
      await createClient().auth.signOut({ scope });
    } catch {
      /* sin red: igual se vuelve al inicio; la sesión local ya se borró */
    }
    // Quien entró por un enlace de demo vuelve a ese enlace, no a la entrada con los tres roles.
    const audience = process.env.NEXT_PUBLIC_DEMO === '1' ? readAudience() : null;
    router.replace(audience ? `/demo/${audience}` : '/login');
    router.refresh();
  }, [router, scope]);
  return { leaving, leave };
}
