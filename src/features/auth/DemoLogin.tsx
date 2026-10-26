'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/icons';
import { forgetDemoTour } from '@/features/guide/demoSim';
import { FormError } from './FormError';

/**
 * Entrada de demo para la presentación: un toque y se entra con una de las tres cuentas
 * públicas de prueba. Solo aparece con NEXT_PUBLIC_DEMO=1; la contraseña es pública a
 * propósito (va en el navegador), así que esas cuentas no deben tener datos reales.
 */
const ROLES = [
  { email: 'estudiante@navia.test', title: 'Estudiante', detail: 'Próxima salida, camioneta en el mapa y «Estoy aquí»', icon: 'pin', color: 'from-brand-400 to-indigo-500' },
  { email: 'conductor@navia.test', title: 'Conductor', detail: 'Un botón por paso y quién espera en cada parada', icon: 'bus', color: 'from-emerald-400 to-teal-500' },
  { email: 'fiscal@navia.test', title: 'Fiscal de la línea', detail: 'Unidades, mapa en vivo y salidas por ruta', icon: 'grid', color: 'from-ink to-indigo-700' },
] as const;

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
    // Cada entrada a un rol de la demo vuelve a ofrecer el tour (no al recargar dentro del rol).
    forgetDemoTour();
    router.replace('/');
    router.refresh();
  }

  return (
    <section aria-labelledby="demo" className="flex flex-col gap-2.5">
      <h2 id="demo" className="text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Prueba la demo · entra como</h2>
      {ROLES.map((r) => (
        <button
          key={r.email}
          type="button"
          disabled={busy !== null}
          onClick={() => enter(r.email)}
          className="card flex items-center gap-3 rounded-3xl p-3 text-left transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className={`${r.color} flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md`}>
            <Icon name={r.icon} className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-bold">{busy === r.email ? 'Entrando…' : r.title}</span>
            <span className="block text-sm text-slate-500">{r.detail}</span>
          </span>
          <Icon name="chevron" className="h-5 w-5 text-slate-400" />
        </button>
      ))}
      <FormError message={error} />
    </section>
  );
}
