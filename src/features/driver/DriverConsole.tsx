'use client';
import { useEffect, useMemo, useState } from 'react';
import { enqueue, onPendingChange, startAutoSync } from '@/lib/offline/sync';
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

const RANK = { scheduled: 0, en_camino: 1, en_parada: 1, finalizada: 2, cancelada: 2 } as const;

/**
 * Estado al abrir: el del servidor, salvo que este teléfono tenga uno igual o más avanzado
 * (botones tocados sin señal que aún no llegan).
 */
function loadLocal(trip: Trip): DriverState {
  const server: DriverState = { status: trip.status, currentStopId: trip.current_stop_id };
  try {
    const raw = localStorage.getItem(storageKey(trip.id));
    if (!raw) return server;
    const local = JSON.parse(raw) as DriverState;
    return RANK[local.status] >= RANK[server.status] ? local : server;
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

  useEffect(() => setState(loadLocal(trip)), [trip]);
  useEffect(() => onPendingChange(setPending), []);

  const active = state.status === 'en_camino' || state.status === 'en_parada';
  const gps = useGps(trip.id, active);
  useWakeLock(active);

  const actions = allowedActions(state, stops);
  const upcoming = nextStop(stops, state.currentStopId);
  const current = stops.find((s) => s.id === state.currentStopId);

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
      </section>

      <BigButton color="bg-emerald-600" disabled={!actions.enCamino} onClick={() => send('en_camino')}>
        {state.status === 'en_parada' ? 'Seguir en camino' : 'En camino'}
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
