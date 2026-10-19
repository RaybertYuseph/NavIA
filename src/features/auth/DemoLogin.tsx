'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FormError } from './FormError';

/**
 * Entrada de demo para la presentación: un toque y se entra con una de las tres cuentas
 * públicas de prueba. Solo aparece con NEXT_PUBLIC_DEMO=1; la contraseña es pública a
 * propósito (va en el navegador), así que esas cuentas no deben tener datos reales.
 */
const ROLES = [
  { email: 'fiscal@navia.test', title: 'Fiscal de la línea', detail: 'Unidades, mapa en vivo y salidas por ruta', icon: '🛰️', color: 'from-ink to-indigo-700' },
  { email: 'conductor@navia.test', title: 'Conductor', detail: 'Disponible, paradas y estudiantes en espera', icon: '🚌', color: 'from-teal-500 to-cyan-500' },
  { email: 'estudiante@navia.test', title: 'Estudiante', detail: 'Próxima salida, bus en el mapa y "Estoy en la parada"', icon: '🎓', color: 'from-brand-500 to-indigo-500' },
];

export function DemoLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(email: string) {
    setBusy(email);
    setError(null);
    // trim(): un espacio o salto de línea pegado al guardar la variable en Vercel rompe la contraseña.
    const password = (process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '').trim();
    if (!password) {
      setBusy(null);
      return setError('Falta NEXT_PUBLIC_DEMO_PASSWORD en esta publicación.');
    }
    let message: string | null = null;
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) message = `${error.message}${error.status ? ` (${error.status})` : ''}`;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    setBusy(null);
    if (message) {
      console.error('Entrada de demo', email, message);
      // El detalle permite saber si es la contraseña, la clave de Supabase o la red.
      return setError(`No se pudo entrar a la demo: ${message}`);
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <section aria-labelledby="demo" className="flex flex-col gap-2">
      <h2 id="demo" className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">Tour de la demo · entra como</h2>
      {ROLES.map((r) => (
        <button
          key={r.email}
          type="button"
          disabled={busy !== null}
          onClick={() => enter(r.email)}
          className={`${r.color} flex items-center gap-3 rounded-2xl bg-linear-to-r p-4 text-left text-white shadow-lg shadow-brand-500/20 transition active:scale-[0.98] disabled:opacity-60`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl" aria-hidden="true">
            {r.icon}
          </span>
          <span>
            <span className="block text-lg font-semibold">{busy === r.email ? 'Entrando…' : r.title}</span>
            <span className="block text-sm opacity-90">{r.detail}</span>
          </span>
        </button>
      ))}
      <FormError message={error} />
    </section>
  );
}
