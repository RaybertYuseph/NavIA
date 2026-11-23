'use client';
import { useEffect, useState } from 'react';
import { DEMO_ROLES, demoSignIn } from '@/features/auth/demoAccess';
import type { View } from '@/features/guide/tours';
import { createClient } from '@/lib/supabase/client';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const CHECK_MS = 3000;

/** Salir desde esta misma pestaña no es "perder la sesión": se avisa para no mostrar el aviso. */
let leavingHere = false;
export function markLeavingHere() {
  leavingHere = true;
}

/**
 * Un navegador guarda UNA sola sesión para todas sus pestañas. Si en otra pestaña se entra con
 * otro rol (o se sale), esta pestaña seguiría mostrando su vista vieja y todo lo que guarde
 * fallaría ("No se pudo guardar") o, peor, se guardaría con la otra cuenta. Aquí se detecta y se
 * bloquea la vista con una explicación y un botón para volver a entrar con este rol.
 */
export function SessionGuard({ userId, view, roleLabel }: { userId: string; view: View; roleLabel: string }) {
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data } = await createClient().auth.getSession();
        if (alive && !leavingHere) setLost((data.session?.user.id ?? null) !== userId);
      } catch {
        /* sin lectura de sesión: no se bloquea */
      }
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const { data: sub } = createClient().auth.onAuthStateChange(() => void check());
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      sub.subscription.unsubscribe();
    };
  }, [userId]);

  if (!lost) return null;

  async function reenter() {
    setBusy(true);
    setError(null);
    const message = await demoSignIn(DEMO_ROLES[view].email);
    if (message) {
      setBusy(false);
      return setError(message);
    }
    window.location.reload();
  }

  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="card w-full max-w-sm rounded-3xl bg-white p-5">
        <p className="text-lg font-extrabold">Esta pestaña ya no está como {roleLabel}</p>
        <p className="mt-1 text-sm text-slate-600">
          En otra pestaña de este navegador se entró con otro rol o se salió de la demo. El navegador guarda una sola sesión
          para todas sus pestañas, así que aquí no se puede guardar nada.
        </p>
        {DEMO ? (
          <button type="button" disabled={busy} onClick={() => void reenter()} className="btn-primary mt-4 w-full disabled:opacity-60">
            {busy ? 'Entrando…' : `Volver a entrar como ${roleLabel}`}
          </button>
        ) : (
          <button type="button" onClick={() => window.location.assign('/login')} className="btn-primary mt-4 w-full">
            Volver a entrar
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        {DEMO && (
          <p className="mt-3 text-xs text-slate-500">
            Para mostrar dos roles a la vez usa una ventana normal y otra de incógnito, dos navegadores distintos o dos teléfonos.
          </p>
        )}
      </div>
    </div>
  );
}
