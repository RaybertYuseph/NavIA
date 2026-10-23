'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import type { NaviaAnswer } from './answers';
import { useGuide } from './GuideProvider';

export type NaviaQuestion = { q: string; answer: () => NaviaAnswer };

type Msg = { from: 'navia' | 'me'; text: string; tab?: string; actionLabel?: string };

/**
 * NavIA dentro de la app: un botón flotante que abre una conversación corta con preguntas
 * frecuentes de la vista. Las respuestas salen de los datos en vivo que ya tiene la pantalla.
 */
export function NaviaFab({ tip, questions, raised = false }: { tip: string; questions: NaviaQuestion[]; raised?: boolean }) {
  const { setTab, startTour } = useGuide();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [log, typing]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function show() {
    setLog([{ from: 'navia', text: tip }]);
    setOpen(true);
  }

  function ask(q: NaviaQuestion) {
    setLog((l) => [...l, { from: 'me', text: q.q }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setLog((l) => [...l, { from: 'navia', ...q.answer() }]);
    }, 450);
  }

  return (
    <>
      <button
        type="button"
        data-tour="navia-fab"
        data-fixed
        onClick={show}
        aria-label="Hablar con NavIA"
        className={`fixed right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl shadow-brand-500/30 ring-2 ring-brand-200 transition active:scale-95 md:bottom-6 ${
          raised ? 'bottom-24' : 'bottom-6'
        } ${open ? 'pointer-events-none opacity-0' : ''}`}
      >
        <NaviaAgent size={52} compact />
        <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white agent-pulse" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-end sm:justify-end sm:p-6" role="dialog" aria-modal="true" aria-label="NavIA">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <section className="sheet-up relative flex max-h-[80dvh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:max-w-sm sm:rounded-[2rem]">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <NaviaAgent size={44} animated compact />
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
                    <p>{m.text}</p>
                    {m.tab && (
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
                  <button key={q.q} type="button" disabled={typing} onClick={() => ask(q)} className="chip">
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
