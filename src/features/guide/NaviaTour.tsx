'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { DEFAULT_TAB, TOURS, type View } from './tours';
import { useTypewriter } from './useTypewriter';

const seenKey = (userId: string) => `navia:tour:v1:${userId}`;
const NAV_W = 84;
const NAV_H = Math.round((NAV_W * 522) / 430);
const WALK_MS = 900;
/** Alto aproximado de la tarjeta del paso: decide de qué lado del elemento hay espacio. */
const CARD_H = 190;

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
type Spot = { x: number; y: number; card: React.CSSProperties };

/**
 * Dónde se para NavIA: junto al elemento, del lado con más espacio, y la tarjeta a su lado
 * como un globo de diálogo. Sin elemento (o sin espacio), abajo a la derecha de la pantalla.
 */
function placeNavia(box: Box | null): Spot {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(340, vw - NAV_W - 24);
  const clampX = (x: number) => Math.max(8, Math.min(vw - NAV_W - 8, x));
  if (!box) {
    const x = clampX(vw / 2 + cardW / 2 - NAV_W / 2);
    const y = vh / 2 - NAV_H / 2;
    return { x, y, card: { left: Math.max(12, x - cardW + 4), top: y - 24, width: cardW } };
  }
  const below = vh - (box.top + box.height);
  const above = box.top;
  const x = clampX(box.left + box.width - NAV_W + 6);
  const cardLeft = Math.max(12, x - cardW - 4);
  const need = Math.max(NAV_H, CARD_H) + 16;
  if (below >= need) {
    const y = box.top + box.height - 6;
    return { x, y, card: { left: cardLeft, top: y + 12, width: cardW } };
  }
  if (above >= need) {
    const y = box.top - NAV_H + 6;
    return { x, y, card: { left: cardLeft, bottom: vh - (y + NAV_H) + 12, width: cardW } };
  }
  const y = vh - NAV_H - 16;
  return { x, y, card: { left: cardLeft, bottom: 24, width: cardW } };
}

/**
 * Tour de NavIA. La primera vez que alguien entra a su vista le pregunta "¿Primera vez que me
 * usas?"; si dice que sí, NavIA camina hasta cada parte, la señala con su pin y la explica.
 * Se puede repetir desde el menú o desde el chat de NavIA.
 */
export function NaviaTour(props: {
  view: View;
  userId: string;
  firstName: string;
  manual: { ask: boolean } | null;
  onTab: (tab: string) => void;
  onTouring: (on: boolean) => void;
  onClose: () => void;
}) {
  const { view, userId, firstName, manual, onTab, onTouring, onClose } = props;
  const steps = TOURS[view];
  const [phase, setPhase] = useState<Phase>(manual ? (manual.ask ? 'ask' : 0) : null);
  const [box, setBox] = useState<Box | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [walking, setWalking] = useState(false);
  const [flip, setFlip] = useState(false);
  const [spoken, setSpoken] = useState(-1);
  const last = useRef<{ x: number } | null>(null);

  // Automático: solo la primera vez de esta cuenta en este teléfono.
  useEffect(() => {
    if (manual || readSeen(userId)) return;
    const t = setTimeout(() => setPhase('ask'), 700);
    return () => clearTimeout(t);
  }, [manual, userId]);

  const step = typeof phase === 'number' ? steps[phase] : null;

  // Una sola NavIA en pantalla: mientras camina, el botón flotante se oculta (vuelve al final).
  useEffect(() => {
    onTouring(phase !== null);
    return () => onTouring(false);
  }, [phase, onTouring]);

  const walkTo = useCallback((next: Box | null) => {
    const s = placeNavia(next);
    const from = last.current;
    last.current = { x: s.x };
    setSpot(s);
    if (from && Math.abs(from.x - s.x) > 4) setFlip(s.x < from.x);
    setWalking(true);
    setTimeout(() => {
      setWalking(false);
      setFlip(false);
    }, WALK_MS);
  }, []);

  useLayoutEffect(() => {
    if (!step) return;
    if (step.tab) onTab(step.tab);
    let frame = 0;
    const measure = (walk: boolean) => {
      const el = step.target ? findTarget(step.target) : null;
      const r = el?.getBoundingClientRect();
      const b = r ? { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 } : null;
      setBox(b);
      if (walk) walkTo(b);
      else setSpot(placeNavia(b));
    };
    const settle = setTimeout(() => {
      const el = step.target ? findTarget(step.target) : null;
      const fixed = el && getComputedStyle(el.closest('[data-fixed]') ?? el).position === 'fixed';
      if (el && !fixed) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => measure(true), el && !fixed ? 380 : 40);
    }, 60);
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [step, onTab, walkTo]);

  const finish = useCallback(() => {
    markSeen(userId);
    if (typeof phase === 'number') onTab(DEFAULT_TAB[view]);
    setPhase(null);
    onClose();
  }, [userId, phase, onTab, view, onClose]);

  useEffect(() => {
    if (phase === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finish]);

  if (phase === null) return null;
  if (phase === 'ask') return <AskCard firstName={firstName} onYes={() => setPhase(0)} onNo={finish} />;

  const i = phase;
  const isLast = i === steps.length - 1;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? (
        <div
          className="pointer-events-none fixed rounded-3xl ring-4 ring-brand-300 transition-all duration-500"
          style={{ ...box, boxShadow: '0 0 0 9999px rgb(11 27 58 / 0.55)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/55" />
      )}

      {spot && (
        <div
          className="pointer-events-none fixed top-0 left-0 transition-transform ease-[cubic-bezier(.45,1.3,.55,1)]"
          style={{ transform: `translate(${spot.x}px, ${spot.y}px)`, transitionDuration: `${WALK_MS}ms` }}
        >
          <NaviaAgent size={NAV_W} animated walking={walking} pointing={!walking} flip={flip} talking={!walking && spoken !== phase} />
        </div>
      )}

      {spot && !walking && (
        <StepCard
          key={i}
          style={spot.card}
          title={steps[i].title}
          body={steps[i].body}
          index={i}
          total={steps.length}
          onBack={i > 0 ? () => setPhase(i - 1) : undefined}
          onNext={() => (isLast ? finish() : setPhase(i + 1))}
          onSkip={isLast ? undefined : finish}
          isLast={isLast}
          onDone={() => setSpoken(i)}
        />
      )}
    </div>
  );
}

function AskCard({ firstName, onYes, onNo }: { firstName: string; onYes: () => void; onNo: () => void }) {
  const question = `¡Epa${firstName ? `, ${firstName}` : ''}! Soy NavIA, tu copiloto de ruta. ¿Primera vez que me usas?`;
  const { shown, done, skip } = useTypewriter(question);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Bienvenida de NavIA">
      <div className="tour-pop w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl" onClick={skip}>
        <NaviaAgent size={150} animated talking={!done} mood={done ? 'happy' : 'idle'} pointing={done} className="mx-auto -mt-20" />
        <p className="mt-2 min-h-[4.5rem] text-xl leading-snug font-extrabold tracking-tight" aria-live="polite">
          {shown}
          {!done && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-brand-400 align-middle" />}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" autoFocus onClick={onYes} className="btn-primary">
            ¡Sí, enséñame!
          </button>
          <button type="button" onClick={onNo} className="btn-ghost">
            No, ya me la sé
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Puedes ver el recorrido cuando quieras desde tu menú.</p>
      </div>
    </div>
  );
}

function StepCard(props: {
  style: React.CSSProperties;
  title: string;
  body: string;
  index: number;
  total: number;
  isLast: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onDone: () => void;
}) {
  const { shown, done, skip } = useTypewriter(props.body, { cps: 70 });
  const onDone = useRef(props.onDone);
  onDone.current = props.onDone;
  useEffect(() => {
    if (done) onDone.current();
  }, [done]);
  return (
    <div className="tour-pop fixed rounded-3xl bg-white p-4 shadow-2xl" style={props.style} onClick={skip}>
      <h2 id="tour-title" className="text-lg font-bold">
        {props.title}
      </h2>
      <p className="mt-0.5 min-h-[3.75rem] text-sm text-slate-600" aria-live="polite">
        {shown}
        {!done && <span className="sr-only">{props.body.slice(shown.length)}</span>}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex flex-1 gap-1" aria-label={`Paso ${props.index + 1} de ${props.total}`}>
          {Array.from({ length: props.total }, (_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === props.index ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>
        {props.onSkip && (
          <button type="button" onClick={props.onSkip} className="px-1.5 py-2 text-sm font-medium text-slate-500">
            Saltar
          </button>
        )}
        {props.onBack && (
          <button type="button" onClick={props.onBack} className="rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            Atrás
          </button>
        )}
        <button
          type="button"
          autoFocus
          onClick={(e) => {
            e.stopPropagation();
            props.onNext();
          }}
          className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-bold text-white shadow-md shadow-brand-500/30"
        >
          {props.isLast ? '¡Listo!' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}
