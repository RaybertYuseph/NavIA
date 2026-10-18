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
  { email: 'fiscal@navia.test', title: 'Fiscal de la línea', detail: 'Unidades, mapa en vivo y salidas por ruta', color: 'bg-slate-800' },
  { email: 'conductor@navia.test', title: 'Conductor', detail: 'Disponible, En camino y paradas completadas', color: 'bg-emerald-600' },
  { email: 'estudiante@navia.test', title: 'Estudiante', detail: 'Próxima salida, bus en el mapa y foto de la unidad', color: 'bg-indigo-600' },
];

export function DemoLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(email: string) {
    setBusy(email);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '',
    });
    setBusy(null);
    if (error) return setError('No se pudo entrar a la demo. Revisa tu conexión.');
    router.replace('/');
    router.refresh();
  }

  return (
    <section aria-labelledby="demo" className="flex flex-col gap-2">
      <h2 id="demo" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tour de la demo · entra como</h2>
      {ROLES.map((r) => (
        <button
          key={r.email}
          type="button"
          disabled={busy !== null}
          onClick={() => enter(r.email)}
          className={`${r.color} rounded-2xl p-4 text-left text-white shadow disabled:opacity-60`}
        >
          <span className="block text-lg font-semibold">{busy === r.email ? 'Entrando…' : r.title}</span>
          <span className="block text-sm opacity-90">{r.detail}</span>
        </button>
      ))}
      <FormError message={error} />
    </section>
  );
}
