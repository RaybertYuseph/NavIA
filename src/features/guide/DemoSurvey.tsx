'use client';
import { useState } from 'react';
import type { Audience } from '@/features/auth/demoAccess';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { SURVEYS } from './surveys';
import type { View } from './tours';

/**
 * Encuesta de 7 preguntas al final del tour de un enlace de demo, una pregunta por pantalla.
 * Tocar una opción pasa a la siguiente; la última (contacto) es opcional.
 */
export function DemoSurvey({ audience, view, onClose }: { audience: Audience; view: View; onClose: () => void }) {
  const questions = SURVEYS[audience];
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const q = questions[i];

  function pick(value: string) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    setTimeout(() => setI((n) => Math.min(n + 1, questions.length - 1)), 220);
  }

  async function send() {
    setState('sending');
    setError(null);
    try {
      const r = await fetch('/api/encuesta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audiencia: audience, vista: view, respuestas: answers, contacto: contact.trim() || undefined }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `Error ${r.status}`);
      setState('sent');
    } catch (e) {
      setState('idle');
      setError(navigator.onLine ? `No se pudo enviar: ${e instanceof Error ? e.message : e}` : 'Sin conexión. Intenta de nuevo cuando vuelva la señal.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="encuesta-q">
      <div className="tour-pop w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-2xl">
        {state === 'sent' ? (
          <div className="text-center">
            <NaviaAgent size={130} animated mood="happy" className="mx-auto -mt-16" />
            <p className="mt-2 text-xl font-extrabold">¡Gracias!</p>
            <p className="mt-1 text-sm text-slate-600">Con tu opinión decidimos cómo llega NavIA a la ruta.</p>
            <button type="button" autoFocus onClick={onClose} className="btn-primary mt-4 w-full">
              Seguir explorando
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <NaviaAgent size={36} compact />
              <span className="flex flex-1 gap-1" aria-label={`Pregunta ${i + 1} de ${questions.length}`}>
                {questions.map((x, n) => (
                  <span key={x.id} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-brand-500' : 'bg-slate-200'}`} />
                ))}
              </span>
              <button type="button" onClick={onClose} className="px-1 text-sm font-medium text-slate-500">
                Cerrar
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Pregunta {i + 1} de {questions.length}
            </p>
            <p id="encuesta-q" key={q.id} className="tour-pop mt-1 text-lg leading-snug font-extrabold">
              {q.text}
            </p>
            <div key={`${q.id}-a`} className="tour-pop mt-3 flex flex-col gap-2">
              {q.kind === 'choice' &&
                q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => pick(o)}
                    className={`rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] ${
                      answers[q.id] === o ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              {q.kind === 'scale' && (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    {['1', '2', '3', '4', '5'].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => pick(n)}
                        className={`rounded-2xl py-3 text-lg font-extrabold transition active:scale-95 ${answers[q.id] === n ? 'bg-brand-500 text-white' : 'bg-slate-50 ring-1 ring-slate-200'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="flex justify-between text-xs text-slate-500">
                    <span>{q.low}</span>
                    <span>{q.high}</span>
                  </span>
                </>
              )}
              {q.kind === 'contact' && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <input
                    id="encuesta-contacto"
                    className="field"
                    value={contact}
                    maxLength={200}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={q.placeholder}
                    autoComplete="off"
                  />
                  <button type="submit" disabled={state === 'sending'} className="btn-primary">
                    {state === 'sending' ? 'Enviando…' : contact.trim() ? 'Enviar y anotarme' : 'Enviar sin anotarme'}
                  </button>
                  {error && (
                    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="mt-3 text-sm font-semibold text-slate-500">
                ← Atrás
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
