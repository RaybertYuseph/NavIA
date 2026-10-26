'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AUDIENCES, DEMO_ROLES, demoSignIn, type Audience } from '@/features/auth/demoAccess';
import { FormError } from '@/features/auth/FormError';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { forgetDemoTour } from './demoSim';
import type { View } from './tours';
import { useTypewriter } from './useTypewriter';

const SEEN_KEY = 'navia:demo:vistas';

/** Vistas de la demo que este navegador ya recorrió (para sugerir la que falta antes de la encuesta). */
function markViewSeen(view: View): View[] {
  try {
    const seen = new Set<View>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]'));
    seen.add(view);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    return [...seen];
  } catch {
    return [view];
  }
}

/**
 * Cierre del tour en un enlace de demo: invita a la encuesta de ese público y, en el de conductor
 * y fiscal, ofrece pasar a la otra vista antes de responder.
 */
export function DemoSurveyCard(props: { view: View; audience: Audience; onAnswer: () => void; onClose: () => void }) {
  const { view, audience, onAnswer, onClose } = props;
  const router = useRouter();
  const [seen] = useState(() => markViewSeen(view));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { views } = AUDIENCES[audience];
  const other = views.find((v) => v !== view && !seen.includes(v));
  const otherRole = other ? DEMO_ROLES[other] : null;

  const text = otherRole
    ? `¡Eso es todo por aquí! ¿Te muestro ahora la vista del ${otherRole.title.toLowerCase()}?`
    : '¡Listo! ¿Me regalas un minuto? Son 7 preguntas y con tu opinión decidimos cómo llega NavIA a la ruta.';
  const { shown, done, skip } = useTypewriter(text);

  async function goOther() {
    if (!otherRole) return;
    setBusy(true);
    setError(null);
    const message = await demoSignIn(otherRole.email);
    if (message) {
      setBusy(false);
      return setError(`No pude cambiar de vista: ${message}`);
    }
    forgetDemoTour();
    router.replace('/');
    router.refresh();
  }

  const answer = (
    <button type="button" autoFocus={!otherRole} onClick={onAnswer} className={otherRole ? 'btn-ghost' : 'btn-primary'}>
      {otherRole ? 'Responder la encuesta ya' : 'Responder (7 preguntas)'}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Cierre del recorrido">
      <div className="tour-pop w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl" onClick={skip}>
        <NaviaAgent size={140} animated talking={!done} mood={done ? 'happy' : 'idle'} pointing={done} className="mx-auto -mt-20" />
        <p className="mt-2 min-h-[4.5rem] text-xl leading-snug font-extrabold tracking-tight" aria-live="polite">
          {shown}
          {!done && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-brand-400 align-middle" />}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {otherRole && (
            <button type="button" autoFocus disabled={busy} onClick={() => void goOther()} className="btn-primary">
              {busy ? 'Cambiando…' : `Ver la vista del ${otherRole.title.toLowerCase()}`}
            </button>
          )}
          {answer}
          <button type="button" onClick={onClose} className="btn-ghost">
            Ahora no
          </button>
        </div>
        <FormError message={error} />
      </div>
    </div>
  );
}
