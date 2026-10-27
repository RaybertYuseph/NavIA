'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { askResumeSurvey, pendingSurvey } from '@/features/guide/demoProgress';
import { forgetDemoTour } from '@/features/guide/demoSim';
import { SURVEYS, visibleQuestions } from '@/features/guide/surveys';
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
  // Encuesta empezada en este navegador y sin enviar: se ofrece continuarla (se lee tras montar).
  const [pending, setPending] = useState<{ answered: number; total: number } | null>(null);
  useEffect(() => {
    const p = audience ? pendingSurvey(audience) : null;
    if (!audience || !p) return;
    const shown = visibleQuestions(SURVEYS[audience], p.answers);
    setPending({ answered: shown.filter((q) => q.kind !== 'contact' && p.answers[q.id]).length, total: shown.length });
  }, [audience]);

  async function enter(email: string, resume = false) {
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
    if (resume) askResumeSurvey();
    // Cada entrada a un rol de la demo vuelve a ofrecer el tour (no al recargar dentro del rol).
    forgetDemoTour();
    router.replace('/');
    router.refresh();
  }

  return (
    <section aria-labelledby="demo" className="flex flex-col gap-2.5">
      {pending && (
        <div className="card mb-2 rounded-3xl p-3.5 ring-2 ring-brand-300">
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Tu encuesta quedó a medias</p>
          <p className="mt-1 text-sm text-slate-600">
            Respondiste {pending.answered} de {pending.total} preguntas. Sigue donde quedaste.
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((pending.answered / pending.total) * 100)}%` }} />
          </div>
          <button type="button" disabled={busy !== null} onClick={() => enter(roles[0].email, true)} className="btn-primary mt-3 w-full disabled:opacity-60">
            {busy === roles[0].email ? 'Entrando…' : 'Continuar encuesta'}
          </button>
        </div>
      )}
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
