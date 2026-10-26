'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { forgetDemoTour } from '@/features/guide/demoSim';
import { AUDIENCES, DEMO_ROLES, demoSignIn, rememberAudience, type Audience } from './demoAccess';
import { FormError } from './FormError';

/**
 * Entrada de demo: un toque y se entra con una de las cuentas públicas de prueba. Solo aparece
 * con NEXT_PUBLIC_DEMO=1; la contraseña es pública a propósito (va en el navegador), así que
 * esas cuentas no deben tener datos reales. Sin `audience` muestra los tres roles (/login).
 */
export function DemoLogin({ audience = null }: { audience?: Audience | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roles = (audience ? AUDIENCES[audience].views : (['student', 'driver', 'fiscal'] as const)).map((v) => DEMO_ROLES[v]);

  async function enter(email: string) {
    setBusy(email);
    setError(null);
    const message = await demoSignIn(email);
    setBusy(null);
    if (message) {
      console.error('Entrada de demo', email, message);
      // El detalle permite saber si es la contraseña, la clave de Supabase o la red.
      return setError(`No se pudo entrar a la demo: ${message}`);
    }
    rememberAudience(audience);
    // Cada entrada a un rol de la demo vuelve a ofrecer el tour (no al recargar dentro del rol).
    forgetDemoTour();
    router.replace('/');
    router.refresh();
  }

  return (
    <section aria-labelledby="demo" className="flex flex-col gap-2.5">
      <h2 id="demo" className="text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Prueba la demo · entra como</h2>
      {roles.map((r) => (
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
