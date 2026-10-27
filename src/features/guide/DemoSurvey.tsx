'use client';
import { useState } from 'react';
import type { Audience } from '@/features/auth/demoAccess';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { CORREO_MAX, FALTA_MAX, SURVEYS, PASAJE, fmtBs, fmtPct, pctOf, priceFor, visibleQuestions } from './surveys';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
import type { View } from './tours';

/**
 * Encuesta de 7 preguntas al final del tour de un enlace de demo, una pregunta por pantalla.
 * Tocar una opción pasa a la siguiente; la abierta es opcional y el correo del final, obligatorio.
 * Quien no la usaría ve además «¿Qué le faltaría?» (ver surveys.ts).
 */
export function DemoSurvey({ audience, view, onClose }: { audience: Audience; view: View; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = visibleQuestions(SURVEYS[audience], answers);
  const [contact, setContact] = useState('');
  const [pilot, setPilot] = useState(false);
  const [custom, setCustom] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const q = questions[i];
  const customBs = custom.trim() ? Number(custom.replace(',', '.')) : NaN;

  function pick(value: string) {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    const last = visibleQuestions(SURVEYS[audience], next).length - 1;
    setTimeout(() => setI((n) => Math.min(n + 1, last)), 220);
  }

  /** Solo lo que se ve: si alguien vuelve y cambia «No» por «Sí», su «¿qué le faltaría?» no se envía. */
  function shownAnswers() {
    const shown = Object.fromEntries(questions.map((x) => [x.id, answers[x.id]?.trim()]).filter(([, v]) => v));
    return { ...shown, piloto: pilot ? 'Sí' : 'No' };
  }

  async function send() {
    if (!CORREO.test(contact.trim())) {
      setError('Escribe un correo válido para enviar la encuesta.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const r = await fetch('/api/encuesta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audiencia: audience, vista: view, respuestas: shownAnswers(), contacto: contact.trim() }),
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
              {q.kind === 'open' && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setI((n) => Math.min(n + 1, questions.length - 1));
                  }}
                >
                  <textarea
                    id="encuesta-abierta"
                    className="field min-h-24 resize-none"
                    value={answers[q.id] ?? ''}
                    maxLength={FALTA_MAX}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                  />
                  <button type="submit" className="btn-primary">
                    {answers[q.id]?.trim() ? 'Siguiente' : 'Saltar'}
                  </button>
                </form>
              )}
              {q.kind === 'price' && (
                <>
                  {q.percents.map((pct) => {
                    const bs = priceFor(pct);
                    const on = answers[q.id] === String(bs) && !custom;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setCustom('');
                          pick(String(bs));
                        }}
                        className={`flex items-baseline justify-between rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98] ${
                          on ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                        }`}
                      >
                        <span className="text-base font-extrabold">{fmtBs(bs)}</span>
                        <span className="text-xs font-semibold text-slate-500">{fmtPct(pct)} del pasaje</span>
                      </button>
                    );
                  })}
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (Number.isFinite(customBs)) pick(String(customBs));
                    }}
                  >
                    <label className="relative flex-1">
                      <span className="sr-only">Otro valor en Bs</span>
                      <input
                        id="encuesta-precio"
                        className="field pr-10"
                        inputMode="decimal"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8))}
                        placeholder="Otro valor"
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-slate-400">Bs</span>
                    </label>
                    <button type="submit" disabled={!Number.isFinite(customBs)} className="btn-primary px-4 disabled:opacity-50">
                      OK
                    </button>
                  </form>
                  <p className="text-xs text-slate-500">
                    {Number.isFinite(customBs)
                      ? `${fmtBs(customBs)} es el ${fmtPct(pctOf(customBs))} del pasaje actual (${fmtBs(PASAJE)}).`
                      : `El porcentaje es sobre el pasaje actual de ${fmtBs(PASAJE)}.`}
                  </p>
                </>
              )}
              {q.kind === 'contact' && (
                <form
                  className="flex flex-col gap-2"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <input
                    id="encuesta-contacto"
                    type="email"
                    className="field"
                    value={contact}
                    maxLength={CORREO_MAX}
                    required
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                  />
                  <label className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm font-semibold ring-1 ring-slate-200">
                    <input type="checkbox" checked={pilot} onChange={(e) => setPilot(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
                    {q.pilot}
                  </label>
                  <button type="submit" disabled={state === 'sending' || !contact.trim()} className="btn-primary disabled:opacity-50">
                    {state === 'sending' ? 'Enviando…' : 'Enviar'}
                  </button>
                  <p className="text-xs text-slate-500">Solo lo usamos para contactarte sobre NavIA.</p>
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
