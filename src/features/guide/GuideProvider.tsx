'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { NaviaTour } from './NaviaTour';
import { DEFAULT_TAB, type View } from './tours';

type Guide = {
  view: View;
  firstName: string;
  tab: string;
  setTab: (tab: string) => void;
  /** Abre el recorrido de la vista; `ask` empieza por la pregunta "¿Primera vez que me usas?". */
  startTour: (ask?: boolean) => void;
};

const GuideContext = createContext<Guide | null>(null);

export function useGuide() {
  const guide = useContext(GuideContext);
  if (!guide) throw new Error('useGuide fuera de GuideProvider');
  return guide;
}

/** Estado compartido de la vista: pestaña abierta y el tour de NavIA. */
export function GuideProvider({ view, userId, firstName, children }: { view: View; userId: string; firstName: string; children: React.ReactNode }) {
  const [tab, setTabState] = useState(DEFAULT_TAB[view]);
  const [tour, setTour] = useState<{ ask: boolean; key: number } | null>(null);

  const setTab = useCallback((next: string) => {
    setTabState(next);
    window.scrollTo({ top: 0 });
  }, []);
  const startTour = useCallback((ask = false) => setTour({ ask, key: Date.now() }), []);

  return (
    <GuideContext.Provider value={{ view, firstName, tab, setTab, startTour }}>
      {children}
      <NaviaTour
        key={tour?.key ?? 'auto'}
        view={view}
        userId={userId}
        firstName={firstName}
        manual={tour}
        onTab={setTabState}
        onClose={() => setTour(null)}
      />
    </GuideContext.Provider>
  );
}
