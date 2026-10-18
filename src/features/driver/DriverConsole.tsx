'use client';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/offline/db';
import { enqueue, onPendingChange, startAutoSync } from '@/lib/offline/sync';
import { AvailabilityToggle } from './AvailabilityToggle';
import type { TripEventType } from '@/lib/offline/types';
import { formatHour } from '@/lib/time';
import { STATUS_LABEL, STATUS_STYLE, sortedStops, type Trip } from '@/features/trips/types';
import { allowedActions, applyEvent, nextStop, type DriverState } from './state';
import { useGps, type GpsState } from './useGps';
import { useWakeLock } from './useWakeLock';

const GPS_LABEL: Record<GpsState, string> = {
  off: 'GPS apagado',
  waiting: 'Buscando GPS…',
  ok: 'GPS activo',
  denied: 'Sin permiso de ubicación: actívalo en el navegador',
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
    return <p className="p-6 text-center text-lg text-slate-600">No tienes salidas asignadas hoy.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {trips.length > 1 && (
        <select
          className="rounded-xl border border-slate-300 bg-white p-3 text-lg"
          value={trip.id}
          onChange={(e) => setTripId(e.target.value)}
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {formatHour(t.scheduled_at)} · {t.routes?.name}
            </option>
          ))}
        </select>
      )}
      <TripControls key={trip.id} trip={trip} />
    </div>
  );
}

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

  const actions = allowedActions(state, stops);
  const upcoming = nextStop(stops, state.currentStopId);
  const current = stops.find((s) => s.id === state.currentStopId);
  const currentIdx = stops.findIndex((s) => s.id === state.currentStopId);

  async function send(type: TripEventType, stopId: string | null = null) {
    const next = applyEvent(state, type, stopId);
    const at = new Date().toISOString();
    setState(next);
    localStorage.setItem(storageKey(trip.id), JSON.stringify({ ...next, at }));
    navigator.vibrate?.(80);
    await enqueue({ kind: 'event', id: crypto.randomUUID(), trip_id: trip.id, type, stop_id: stopId, occurred_at: at });
  }

  return (
    <>
      {trip.vehicles && <AvailabilityToggle vehicle={trip.vehicles} />}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{trip.routes?.name}</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[state.status]}`}>
            {STATUS_LABEL[state.status]}
          </span>
        </div>
        <p className="mt-1 text-slate-600">
          Salida {formatHour(trip.scheduled_at)}
          {current && ` · Última parada: ${current.name}`}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {GPS_LABEL[gps]}
          {pending > 0 ? ` · ${pending} por enviar (se envían al tener señal)` : ' · Todo enviado'}
        </p>
        <ol className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
          {stops.map((s, i) => {
            const done = state.status === 'finalizada' || (currentIdx >= 0 && (i < currentIdx || (i === currentIdx && state.status !== 'en_parada')));
            const here = i === currentIdx && state.status === 'en_parada';
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${
                    done ? 'bg-emerald-600' : here ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={done ? 'text-slate-500' : here ? 'font-semibold' : ''}>{s.name}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <BigButton color="bg-emerald-600" disabled={!actions.enCamino} onClick={() => send('en_camino')}>
        {state.status === 'en_parada' ? 'Parada completada · seguir' : 'En camino'}
      </BigButton>
      <BigButton
        color="bg-amber-500"
        disabled={!actions.enParada}
        onClick={() => upcoming && send('en_parada', upcoming.id)}
      >
        {upcoming ? `Llegué a: ${upcoming.name}` : 'Sin más paradas'}
      </BigButton>
      <BigButton
        color="bg-slate-800"
        disabled={!actions.finDeRuta}
        onClick={() => {
          if (confirm('¿Terminar la ruta?')) void send('fin_de_ruta');
        }}
      >
        Fin de ruta
      </BigButton>

      {active && (
        <p className="text-center text-sm text-slate-500">
          Deja el teléfono en el soporte con la pantalla encendida y cargando.
        </p>
      )}
    </>
  );
}

function BigButton(props: { color: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`${props.color} min-h-24 rounded-2xl px-4 text-2xl font-bold text-white shadow active:scale-[0.98] disabled:opacity-30`}
    >
      {props.children}
    </button>
  );
}
