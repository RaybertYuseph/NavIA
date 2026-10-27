'use client';
import { useEffect, useState } from 'react';
import { readAudience, type Audience } from '@/features/auth/demoAccess';
import { onProgress, readSurvey, readTour, tourPercent, type SurveyProgress, type TourProgress } from './demoProgress';
import { useGuide } from './GuideProvider';
import { SURVEYS, visibleQuestions } from './surveys';

/**
 * En un enlace de demo, arriba de la pantalla: cuánto del tour vio y cuánto de la encuesta respondió,
 * con un botón para retomar cada uno donde quedó. Desaparece cuando las dos cosas están completas.
 */
export function DemoProgress() {
  const { view, startTour, openSurvey } = useGuide();
  const [state, setState] = useState<{ audience: Audience; tour: TourProgress | null; survey: SurveyProgress | null } | null>(null);

  useEffect(() => {
    const load = () => {
      const audience = readAudience();
      setState(audience ? { audience, tour: readTour(view), survey: readSurvey(audience) } : null);
    };
    load();
    return onProgress(load);
  }, [view]);

  if (!state) return null;
  const { audience, tour, survey } = state;
  const pct = tourPercent(tour);
  const shown = visibleQuestions(SURVEYS[audience], survey?.answers ?? {});
  // La última pregunta es el correo: cuenta al enviar.
  const answered = survey?.sent ? shown.length : shown.filter((q) => q.kind !== 'contact' && survey?.answers[q.id]).length;
  const surveyPct = Math.round((answered / shown.length) * 100);
  if (pct === 100 && survey?.sent) return null;

  return (
    <section className="card mb-4 rounded-3xl p-3.5" aria-label="Tu avance en la demo">
      <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Tu avance en la demo</p>
      <Row
        label="Recorrido"
        pct={pct}
        detail={pct === 100 ? 'Completo' : `${pct} %`}
        action={pct === 100 ? null : tour ? 'Continuar' : 'Empezar'}
        onAction={() => startTour(false, tour && !tour.done ? tour.at : 0)}
      />
      <Row
        label="Encuesta"
        pct={surveyPct}
        detail={survey?.sent ? 'Enviada' : `${answered} de ${shown.length}`}
        action={survey?.sent ? null : answered ? 'Continuar' : 'Responder'}
        onAction={openSurvey}
      />
    </section>
  );
}

function Row({ label, pct, detail, action, onAction }: { label: string; pct: number; detail: string; action: string | null; onAction: () => void }) {
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-bold">{label}</span>
          <span className={`text-xs font-semibold tabular-nums ${pct === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{detail}</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {action && (
        <button type="button" onClick={onAction} className="shrink-0 rounded-full bg-brand-500 px-3.5 py-2 text-sm font-bold text-white shadow-sm shadow-brand-500/30 transition active:scale-95">
          {action}
        </button>
      )}
    </div>
  );
}
