'use client';
import { useEffect, useState } from 'react';

const TABS = [
  ['encuestas', 'Encuestas'],
  ['preguntas', 'Preguntas'],
] as const;
type Tab = (typeof TABS)[number][0];

/** Las dos pestañas del tablero, en la misma página: cambian al instante y recuerdan cuál quedó abierta en la URL (#preguntas). */
export function DashboardTabs({ results, questions }: { results: React.ReactNode; questions: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('encuestas');
  useEffect(() => {
    if (window.location.hash === '#preguntas') setTab('preguntas');
  }, []);

  function pick(next: Tab) {
    setTab(next);
    history.replaceState(null, '', next === 'preguntas' ? '#preguntas' : window.location.pathname);
  }

  return (
    <>
      <div role="tablist" aria-label="Secciones del tablero" className="sticky top-[calc(env(safe-area-inset-top)+3.6rem)] z-10 flex gap-1 self-start rounded-2xl bg-white/90 p-1 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => pick(id)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${tab === id ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-4">
        {tab === 'encuestas' ? results : questions}
      </div>
    </>
  );
}
