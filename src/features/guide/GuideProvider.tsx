'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { readAudience } from '@/features/auth/demoAccess';
import { DEMO, DemoTicker } from './demoSim';
import { DemoSurvey } from './DemoSurvey';
import { NaviaTour } from './NaviaTour';
import { DEFAULT_TAB, type View } from './tours';

type Guide = {
  view: View;
  firstName: string;
  tab: string;
  setTab: (tab: string) => void;
  /** Abre el recorrido de la vista; `ask` empieza por la pregunta "¿Primera vez que me usas?" y `from` retoma en ese paso. */
  startTour: (ask?: boolean, from?: number) => void;
  /** El tour está abierto y NavIA camina por la pantalla (el botón flotante se oculta). */
  touring: boolean;
  /** En un enlace de demo, abre la encuesta de 7 preguntas de ese público. */
  openSurvey: () => void;
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
  const [tour, setTour] = useState<{ ask: boolean; from?: number; key: number } | null>(null);
  const [touring, setTouring] = useState(false);
  const [survey, setSurvey] = useState(false);
  const openSurvey = useCallback(() => setSurvey(true), []);

  const setTab = useCallback((next: string) => {
    setTabState(next);
    window.scrollTo({ top: 0 });
  }, []);
  const startTour = useCallback((ask = false, from?: number) => setTour({ ask, from, key: Date.now() }), []);

  return (
    <GuideContext.Provider value={{ view, firstName, tab, setTab, startTour, touring, openSurvey }}>
      {children}
      {DEMO && <DemoTicker />}
      <NaviaTour
        key={tour?.key ?? 'auto'}
        view={view}
        userId={userId}
        firstName={firstName}
        manual={tour}
        onTab={setTabState}
        onTouring={setTouring}
        onClose={() => setTour(null)}
        onSurvey={openSurvey}
      />
      {survey && <SurveyModal view={view} onClose={() => setSurvey(false)} />}
    </GuideContext.Provider>
  );
}

function SurveyModal({ view, onClose }: { view: View; onClose: () => void }) {
  const audience = DEMO ? readAudience() : null;
  return audience ? <DemoSurvey audience={audience} view={view} onClose={onClose} /> : null;
}
