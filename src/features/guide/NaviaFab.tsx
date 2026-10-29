'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import type { NaviaAnswer } from './answers';
import { useGuide } from './GuideProvider';
import { useTypewriter } from './useTypewriter';

export type NaviaQuestion = { q: string; answer: () => NaviaAnswer };

type Msg = { from: 'navia' | 'me'; text: string; tab?: string; actionLabel?: string };

/**
 * NavIA dentro de la app: la gota flotando en una esquina abre una conversación corta con
 * preguntas frecuentes de la vista. Las respuestas salen de los datos en vivo de la pantalla y
 * NavIA las va diciendo (mueve la boca mientras se escriben; sonríe si empiezan con "¡").
 */
/**
 * `inline`: en vez de flotar, va como una fila al final de la vista (el conductor tiene botones
 * grandes en toda la pantalla y una gota flotante los taparía).
 */
export function NaviaFab({ tip, questions, raised = false, inline = false }: { tip: string; questions: NaviaQuestion[]; raised?: boolean; inline?: boolean }) {
  const { setTab, startTour, touring } = useGuide();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const lastNavia = [...log].reverse().find((m) => m.from === 'navia');

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [log, typing, speaking]);
  // Un "¿Te ayudo?" breve al abrir la vista, para que se note que NavIA está ahí. Se va al primer
  // toque o scroll: no debe quedar encima de un botón que la persona quiere usar.
  useEffect(() => {
    const show = setTimeout(() => setHint(true), 2500);
    const hide = setTimeout(() => setHint(false), 7000);
    const dismiss = () => {
      clearTimeout(show);
      setHint(false);
    };
    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('scroll', dismiss, { once: true, passive: true });
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', dismiss);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function show() {
    setHint(false);
    setLog([{ from: 'navia', text: tip }]);
    setSpeaking(true);
    setOpen(true);
  }

  function ask(q: NaviaQuestion) {
    setLog((l) => [...l, { from: 'me', text: q.q }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setSpeaking(true);
      setLog((l) => [...l, { from: 'navia', ...q.answer() }]);
    }, 450);
  }

  return (
    <>
      {inline ? (
        <button type="button" data-tour="navia-fab" onClick={show} aria-label="Hablar con NavIA" className="card flex w-full items-center gap-3 rounded-3xl p-3 text-left transition active:scale-[0.99]">
          <NaviaAgent size={48} animated compact className="shrink-0" />
          <span className="flex-1">
            <span className="block font-bold">¿Dudas? Pregúntame</span>
            <span className="text-sm text-slate-600">Qué hago ahora, cuántos me esperan, qué pasa sin señal</span>
          </span>
          <Icon name="chevron" className="h-5 w-5 text-slate-400" />
        </button>
      ) : (
      <button
        type="button"
        data-tour="navia-fab"
        data-fixed
        onClick={show}
        aria-label="Hablar con NavIA"
        className={`fixed right-3 z-30 transition active:scale-95 md:bottom-4 ${raised ? 'bottom-20' : 'bottom-4'} ${open || touring ? 'pointer-events-none opacity-0' : ''}`}
      >
        {hint && (
          <span className="tour-pop pointer-events-none absolute right-full bottom-12 mr-1 rounded-2xl rounded-br-md bg-white px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink shadow-lg ring-1 ring-slate-200/70">
            ¿Te ayudo?
          </span>
        )}
        <NaviaAgent size={60} animated mood={hint ? 'happy' : 'idle'} className="drop-shadow-[0_10px_14px_rgb(14_116_233/0.35)]" />
      </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-end sm:justify-end sm:p-6" role="dialog" aria-modal="true" aria-label="NavIA">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <section className="sheet-up relative flex max-h-[80dvh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:max-w-sm sm:rounded-[2rem]">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <NaviaAgent size={52} animated compact talking={speaking} mood={!speaking && lastNavia?.text.startsWith('¡') ? 'happy' : 'idle'} />
              <div className="flex-1">
                <p className="font-bold">NavIA</p>
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Tu copiloto de ruta
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
                <Icon name="close" />
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
              {log.map((m, n) =>
                m.from === 'me' ? (
                  <p key={n} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-3 py-2 text-sm text-white">
                    {m.text}
                  </p>
                ) : (
                  <div key={n} className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm">
                    {n === log.length - 1 ? <Typed text={m.text} onDone={() => setSpeaking(false)} /> : <p>{m.text}</p>}
                    {m.tab && (n < log.length - 1 || !speaking) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab(m.tab!);
                          setOpen(false);
                        }}
                        className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700"
                      >
                        {m.actionLabel ?? 'Ver'} <Icon name="chevron" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ),
              )}
              {typing && (
                <p className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-3 py-3" aria-label="NavIA está escribiendo">
                  <span className="typing-dot" />
                  <span className="typing-dot [animation-delay:150ms]" />
                  <span className="typing-dot [animation-delay:300ms]" />
                </p>
              )}
              <div ref={end} />
            </div>

            <footer className="border-t border-slate-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-wrap gap-2">
                {questions.map((q) => (
                  <button key={q.q} type="button" disabled={typing || speaking} onClick={() => ask(q)} className="chip">
                    {q.q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTour(false);
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500"
              >
                <Icon name="sparkle" className="h-4 w-4" /> Ver el recorrido otra vez
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

/** La respuesta en curso, escrita letra a letra mientras NavIA habla. */
function Typed({ text, onDone }: { text: string; onDone: () => void }) {
  const { shown, done } = useTypewriter(text, { cps: 75 });
  const done$ = useRef(onDone);
  done$.current = onDone;
  useEffect(() => {
    if (done) done$.current();
  }, [done]);
  return (
    <p>
      {shown}
      {!done && <span className="sr-only">{text.slice(shown.length)}</span>}
    </p>
  );
}
