'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readAudience } from '@/features/auth/demoAccess';
import { takeResumeSurvey } from './demoProgress';
import { DEMO, DemoTicker } from './demoSim';
import { DemoSurvey } from './DemoSurvey';
import { IntroVideo, introSeen } from './IntroVideo';
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
  /** En un enlace de demo, abre la encuesta de 8 preguntas de ese público. */
  openSurvey: () => void;
  /** En el enlace de estudiantes, el video en que NavIA se presenta (null si no hay video para esta vista). */
  openVideo: (() => void) | null;
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
  const [video, setVideo] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const openSurvey = useCallback(() => setSurvey(true), []);
  const openVideo = useCallback(() => setVideo(true), []);
  // Quien entró con «Continuar encuesta» la ve de inmediato, sin el tour encima. Si no, en el enlace
  // de estudiantes el video de bienvenida va primero (una vez por pestaña) y el tour espera.
  useEffect(() => {
    if (!DEMO) return;
    const students = view === 'student' && readAudience() === 'estudiante';
    setHasVideo(students);
    if (takeResumeSurvey()) setSurvey(true);
    else if (students && !introSeen()) setVideo(true);
  }, [view]);

  const setTab = useCallback((next: string) => {
    setTabState(next);
    window.scrollTo({ top: 0 });
  }, []);
  const startTour = useCallback((ask = false, from?: number) => setTour({ ask, from, key: Date.now() }), []);
  const closeVideo = useCallback(() => setVideo(false), []);

  return (
    <GuideContext.Provider value={{ view, firstName, tab, setTab, startTour, touring, openSurvey, openVideo: hasVideo ? openVideo : null }}>
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
        hold={survey || video}
      />
      {survey && <SurveyModal view={view} onClose={() => setSurvey(false)} />}
      {video && (
        <IntroVideo
          onClose={closeVideo}
          onTour={() => {
            setVideo(false);
            startTour(false);
          }}
        />
      )}
    </GuideContext.Provider>
  );
}

function SurveyModal({ view, onClose }: { view: View; onClose: () => void }) {
  const audience = DEMO ? readAudience() : null;
  return audience ? <DemoSurvey audience={audience} view={view} onClose={onClose} /> : null;
}
