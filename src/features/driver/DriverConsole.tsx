'use client';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { NO_SIGNAL, driverTip, waitingAhead } from '@/features/guide/answers';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { db } from '@/lib/offline/db';
import { enqueue, onPendingChange, startAutoSync } from '@/lib/offline/sync';
import { AvailabilityToggle } from './AvailabilityToggle';
import type { TripEventType } from '@/lib/offline/types';
import { formatHour } from '@/lib/time';
import { STATUS_LABEL, STATUS_STYLE, sortedStops, type Trip } from '@/features/trips/types';
import { applyEvent, nextStop, primaryAction, type DriverState } from './state';
import { useGps, type GpsState } from './useGps';
import { useWaiting } from './useWaiting';
import { useWakeLock } from './useWakeLock';

const GPS_LABEL: Record<GpsState, string> = {
  off: 'GPS en espera',
  waiting: 'Buscando GPS…',
  ok: 'GPS activo',
  denied: 'Activa la ubicación en el navegador',
  unavailable: 'GPS no disponible',
};

const storageKey = (tripId: string) => `navia:trip:${tripId}`;

/**
 * Estado al abrir: el del servidor, salvo que este teléfono tenga botones tocados sin señal
 * que aún no llegan (eventos en la cola). Así un reinicio de la demo no queda tapado por
 * un estado viejo guardado en el teléfono.
 */
async function loadInitialState(trip: Trip): Promise<DriverState> {
  const server: DriverState = { status: trip.status, currentStopId: trip.current_stop_id };
  try {
    const pending = await db.queue.where('trip_id').equals(trip.id).filter((i) => i.kind === 'event').count();
    const raw = localStorage.getItem(storageKey(trip.id));
    if (!pending || !raw) {
      localStorage.removeItem(storageKey(trip.id));
      return server;
    }
    return JSON.parse(raw) as DriverState;
  } catch {
    return server;
  }
}

export function DriverConsole({ trips }: { trips: Trip[] }) {
  const firstOpen = trips.find((t) => t.status !== 'finalizada' && t.status !== 'cancelada') ?? trips[0];
  const [tripId, setTripId] = useState(firstOpen?.id);
  const trip = trips.find((t) => t.id === tripId);

  useEffect(() => startAutoSync(), []);

  if (!trip) {
    return (
      <div className="card mt-6 flex flex-col items-center gap-2 rounded-3xl p-6 text-center">
        <NaviaAgent size={96} animated />
        <p className="text-lg font-bold">Hoy no tienes salidas asignadas</p>
        <p className="text-sm text-slate-600">Cuando el fiscal te asigne una, aparece aquí.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {trip.vehicles && <AvailabilityToggle key={trip.vehicles.id} vehicle={trip.vehicles} />}
      {trips.length > 1 && (
        <section data-tour="salidas" aria-label="Tus salidas de hoy">
          <h2 className="section-title">Tus salidas de hoy</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {trips.map((t) => {
              const active = t.id === trip.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTripId(t.id)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-2xl px-3.5 py-2 text-left transition ${
                    active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'card text-slate-700'
                  } ${t.status === 'finalizada' && !active ? 'opacity-50' : ''}`}
                >
                  <span className="block text-lg leading-tight font-extrabold">{formatHour(t.scheduled_at)}</span>
                  <span className={`block max-w-36 truncate text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>
                    {t.status === 'finalizada' ? '✓ ' : ''}
                    {t.routes?.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <TripControls key={trip.id} trip={trip} />
    </div>
  );
}

const ACTION_STYLE = {
  en_camino: 'from-emerald-500 to-teal-500 shadow-emerald-500/40',
  en_parada: 'from-amber-400 to-orange-500 shadow-amber-500/40',
  fin_de_ruta: 'from-ink to-indigo-800 shadow-ink/30',
} as const;

function TripControls({ trip }: { trip: Trip }) {
  const stops = useMemo(() => sortedStops(trip), [trip]);
  const [state, setState] = useState<DriverState>({ status: trip.status, currentStopId: trip.current_stop_id });
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadInitialState(trip).then((s) => !cancelled && setState(s));
    return () => {
      cancelled = true;
    };
  }, [trip]);
  useEffect(() => onPendingChange(setPending), []);

  const active = state.status === 'en_camino' || state.status === 'en_parada';
  const gps = useGps(trip.id, active);
  useWakeLock(active);

  const action = primaryAction(state, stops);
  const upcoming = nextStop(stops, state.currentStopId);
  const currentIdx = stops.findIndex((s) => s.id === state.currentStopId);
  const waiting = useWaiting(trip.id, trip.waiting, state.status !== 'finalizada' && state.status !== 'cancelada');
  const waitingAt = (stopId: string | undefined) => (stopId ? (waiting[stopId] ?? 0) : 0);
  const totalAhead = stops.slice(currentIdx + 1).reduce((a, s) => a + waitingAt(s.id), 0);

  async function send(type: TripEventType, stopId: string | null = null) {
    if (type === 'fin_de_ruta' && !confirm('¿Terminar la ruta?')) return;
    const next = applyEvent(state, type, stopId);
    const at = new Date().toISOString();
    setState(next);
    localStorage.setItem(storageKey(trip.id), JSON.stringify({ ...next, at }));
    navigator.vibrate?.(80);
    await enqueue({ kind: 'event', id: crypto.randomUUID(), trip_id: trip.id, type, stop_id: stopId, occurred_at: at });
  }

  const label = !action
    ? null
    : action.type === 'en_parada'
      ? { top: 'Llegué a', main: action.stop?.name ?? '' }
      : action.type === 'fin_de_ruta'
        ? { top: 'Última parada lista', main: 'Terminar ruta' }
        : state.status === 'en_parada'
          ? { top: 'Ya subieron todos', main: 'Seguir ruta' }
          : { top: 'Cuando arranques', main: '¡En camino!' };

  return (
    <>
      <section className="card rounded-3xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">Salida {formatHour(trip.scheduled_at)}</p>
            <h2 className="text-lg leading-tight font-extrabold">{trip.routes?.name}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[state.status]}`}>{STATUS_LABEL[state.status]}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${gps === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name="pin" className="h-3.5 w-3.5" /> {GPS_LABEL[gps]}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name={pending > 0 ? 'signal' : 'check'} className="h-3.5 w-3.5" />
            {pending > 0 ? `${pending} por enviar` : 'Todo enviado'}
          </span>
        </div>
        {state.status !== 'finalizada' && state.status !== 'cancelada' && (
          <p className={`mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 font-bold ${totalAhead > 0 ? 'bg-cyan-50 text-cyan-900' : 'bg-slate-50 text-slate-600'}`}>
            <Icon name="users" className="h-5 w-5" />
            {totalAhead === 0
              ? 'Nadie ha marcado su parada todavía'
              : `${totalAhead} ${totalAhead === 1 ? 'estudiante esperando' : 'estudiantes esperando'} en tu ruta`}
          </p>
        )}
      </section>

      <div data-tour="accion" className="flex flex-col gap-2">
        {action && label ? (
          <button
            type="button"
            onClick={() => void send(action.type, action.stop?.id ?? null)}
            className={`${ACTION_STYLE[action.type]} min-h-28 rounded-[1.75rem] bg-linear-to-br px-5 py-4 text-left text-white shadow-xl transition active:scale-[0.98]`}
          >
            <span className="block text-sm font-semibold opacity-90">{label.top}</span>
            <span className="block text-3xl leading-tight font-extrabold">{label.main}</span>
            {action.type === 'en_parada' && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-sm font-bold">
                <Icon name="users" className="h-4 w-4" />
                {waitingAt(action.stop?.id) === 0 ? 'Nadie marcó esta parada' : `${waitingAt(action.stop?.id)} esperando aquí`}
              </span>
            )}
          </button>
        ) : (
          <p className="card rounded-3xl p-4 text-center font-semibold text-slate-600">
            {state.status === 'finalizada' ? '¡Ruta terminada! Buen trabajo.' : 'Esta salida fue cancelada.'}
          </p>
        )}
        {active && action?.type !== 'fin_de_ruta' && (
          <button type="button" onClick={() => void send('fin_de_ruta')} className="self-center px-3 py-2 text-sm font-semibold text-slate-500">
            Terminar la ruta antes
          </button>
        )}
      </div>

      <section data-tour="paradas" className="card rounded-3xl p-4" aria-label="Paradas">
        <h3 className="section-title">Paradas</h3>
        <ol className="relative flex flex-col">
          {stops.map((s, i) => {
            const done = state.status === 'finalizada' || (currentIdx >= 0 && (i < currentIdx || (i === currentIdx && state.status !== 'en_parada')));
            const here = i === currentIdx && state.status === 'en_parada';
            const isNext = !here && s.id === upcoming?.id && active;
            return (
              <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done ? 'bg-emerald-500 text-white' : here ? 'bg-amber-400 text-white ring-4 ring-amber-100' : isNext ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={done ? 'text-slate-400 line-through decoration-slate-300' : here || isNext ? 'font-bold' : 'font-medium'}>{s.name}</span>
                {!done && (
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${waitingAt(s.id) > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'}`}
                    aria-label={`${waitingAt(s.id)} esperando`}
                  >
                    <Icon name="users" className="h-3.5 w-3.5" /> {waitingAt(s.id)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {active && <p className="text-center text-xs text-slate-500">Deja el teléfono en el soporte, con la pantalla encendida y cargando.</p>}

      <NaviaFab
        tip={driverTip(state.status, upcoming)}
        questions={[
          { q: '¿Qué hago ahora?', answer: () => ({ text: driverTip(state.status, upcoming) }) },
          { q: '¿Cuántos me esperan?', answer: () => waitingAhead(stops, waiting, currentIdx) },
          { q: '¿Y si se va la señal?', answer: () => NO_SIGNAL },
        ]}
      />
    </>
  );
}
