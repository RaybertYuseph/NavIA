'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { DEFAULT_TAB, TOURS, type View } from './tours';

const seenKey = (userId: string) => `navia:tour:v1:${userId}`;

function readSeen(userId: string) {
  try {
    return localStorage.getItem(seenKey(userId)) === '1';
  } catch {
    return true; // Sin almacenamiento no se puede recordar: mejor no insistir en cada visita.
  }
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), '1');
  } catch {
    /* sin almacenamiento: el tour sigue disponible desde el menú */
  }
}

/** El primer elemento visible con ese data-tour (las pestañas existen en móvil y en escritorio). */
function findTarget(name: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find((el) => el.getClientRects().length > 0) ?? null;
}

type Phase = 'ask' | number | null;
type Box = { top: number; left: number; width: number; height: number };

/**
 * Tour de NavIA. La primera vez que alguien entra a su vista le pregunta "¿Primera vez que me
 * usas?"; si dice que sí, recorre lo esencial resaltando cada parte. Se puede repetir desde el menú.
 */
export function NaviaTour(props: {
  view: View;
  userId: string;
  firstName: string;
  manual: { ask: boolean } | null;
  onTab: (tab: string) => void;
  onClose: () => void;
}) {
  const { view, userId, firstName, manual, onTab, onClose } = props;
  const steps = TOURS[view];
  const [phase, setPhase] = useState<Phase>(manual ? (manual.ask ? 'ask' : 0) : null);
  const [box, setBox] = useState<Box | null>(null);

  // Automático: solo la primera vez de esta cuenta en este teléfono.
  useEffect(() => {
    if (manual || readSeen(userId)) return;
    const t = setTimeout(() => setPhase('ask'), 700);
    return () => clearTimeout(t);
  }, [manual, userId]);

  const step = typeof phase === 'number' ? steps[phase] : null;

  useLayoutEffect(() => {
    if (!step) return setBox(null);
    if (step.tab) onTab(step.tab);
    if (!step.target) return setBox(null);
    let frame = 0;
    const measure = () => {
      const el = findTarget(step.target!);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
    };
    const settle = setTimeout(() => {
      const el = findTarget(step.target!);
      const fixed = el && getComputedStyle(el.closest('[data-fixed]') ?? el).position === 'fixed';
      if (el && !fixed) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      measure();
      setTimeout(measure, 400);
    }, 60);
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [step, onTab]);

  useEffect(() => {
    if (phase === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function finish() {
    markSeen(userId);
    if (typeof phase === 'number') onTab(DEFAULT_TAB[view]);
    setPhase(null);
    onClose();
  }

  if (phase === null) return null;

  if (phase === 'ask') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tour-ask">
        <div className="tour-pop w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl">
          <NaviaAgent size={132} animated className="mx-auto -mt-2" />
          <h2 id="tour-ask" className="mt-1 text-2xl font-extrabold tracking-tight">
            ¡Epa{firstName ? `, ${firstName}` : ''}! Soy NavIA
          </h2>
          <p className="mt-1 text-slate-600">Tu copiloto de ruta. ¿Primera vez que me usas?</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" autoFocus onClick={() => setPhase(0)} className="btn-primary">
              ¡Sí, enséñame!
            </button>
            <button type="button" onClick={finish} className="btn-ghost">
              No, ya me la sé
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Puedes ver el recorrido cuando quieras desde tu menú.</p>
        </div>
      </div>
    );
  }

  const i = phase;
  const last = i === steps.length - 1;
  const cardOnTop = box ? box.top + box.height / 2 > window.innerHeight * 0.55 : false;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? (
        <div
          className="pointer-events-none fixed rounded-3xl ring-4 ring-brand-300 transition-all duration-300"
          style={{ ...box, boxShadow: '0 0 0 9999px rgb(11 27 58 / 0.55)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/55" />
      )}
      <div className={`fixed inset-x-0 flex justify-center p-4 ${!box ? 'top-1/2 -translate-y-1/2' : cardOnTop ? 'top-0' : 'bottom-0'}`}>
        <div key={i} className="tour-pop w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl">
          <div className="flex gap-3">
            <NaviaAgent size={52} animated compact className="shrink-0" />
            <div className="min-w-0">
              <h2 id="tour-title" className="text-lg font-bold">{steps[i].title}</h2>
              <p className="mt-0.5 text-sm text-slate-600">{steps[i].body}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-label={`Paso ${i + 1} de ${steps.length}`}>
              {steps.map((_, n) => (
                <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-200'}`} />
              ))}
            </div>
            {!last && (
              <button type="button" onClick={finish} className="px-2 py-2 text-sm font-medium text-slate-500">
                Saltar
              </button>
            )}
            {i > 0 && (
              <button type="button" onClick={() => setPhase(i - 1)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                Atrás
              </button>
            )}
            <button type="button" autoFocus onClick={() => (last ? finish() : setPhase(i + 1))} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-brand-500/30">
              {last ? '¡Listo!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
