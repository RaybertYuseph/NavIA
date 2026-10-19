'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatHour } from '@/lib/time';
import { pendingStops } from './derive';
import { isLive, sortedStops, type Trip } from './types';

type MyWait = { trip_id: string; stop_id: string };

/**
 * "Estoy en la parada": el estudiante marca dónde espera una salida de hoy. El conteo llega en
 * trips.waiting por Realtime; cuando el bus pasa por esa parada la espera se da por recogida.
 */
export function WaitAtStop({ trips, preferredTripId }: { trips: Trip[]; preferredTripId: string | null }) {
  const open = trips.filter((t) => pendingStops(t).length > 0 || isLive(t));
  const [wait, setWait] = useState<MyWait | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = trips.map((t) => t.id);
    if (ids.length === 0) return;
    void createClient()
      .from('stop_waits')
      .select('trip_id, stop_id')
      .in('trip_id', ids)
      .is('picked_at', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: MyWait | null }) => data && setWait(data));
    // Solo al abrir: después la espera cambia por lo que toca el propio estudiante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trip = trips.find((t) => t.id === (wait?.trip_id ?? tripId ?? preferredTripId)) ?? open[0] ?? null;
  if (!trip) return null;

  async function save(next: MyWait | null) {
    if (!trip) return;
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc('set_my_wait', {
      p_trip_id: next?.trip_id ?? trip.id,
      p_stop_id: next?.stop_id ?? null,
    });
    setBusy(false);
    if (e) return setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    setWait(next);
  }

  if (wait) {
    const stops = sortedStops(trip);
    const mine = stops.find((s) => s.id === wait.stop_id);
    const myIdx = stops.findIndex((s) => s.id === wait.stop_id);
    const busIdx = stops.findIndex((s) => s.id === trip.current_stop_id);
    const picked = (busIdx >= 0 && busIdx >= myIdx) || trip.status === 'finalizada';
    const others = Math.max(0, (trip.waiting?.[wait.stop_id] ?? 1) - 1);

    if (picked) {
      return (
        <Card>
          <p className="text-lg font-semibold">🚌 El bus llegó a {mine?.name}</p>
          <p className="text-sm text-slate-600">¡Buen viaje!</p>
          <button type="button" onClick={() => setWait(null)} className="mt-3 text-sm font-medium text-sky-700 underline">
            Marcar otra parada
          </button>
        </Card>
      );
    }
    const stopsAway = busIdx < 0 ? null : myIdx - busIdx;
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Esperas en</p>
            <p className="text-xl font-bold">{mine?.name}</p>
            <p className="text-sm text-slate-600">
              Salida {formatHour(trip.scheduled_at)} · {trip.routes?.name}
            </p>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
            {others === 0 ? 'Solo tú' : `Tú y ${others} más`}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {!isLive(trip)
            ? 'El bus aún no sale.'
            : stopsAway === null
              ? 'El bus ya va en camino.'
              : stopsAway === 1
                ? 'Tu parada es la siguiente.'
                : `El bus está a ${stopsAway} paradas.`}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(null)}
          className="mt-3 text-sm font-medium text-slate-600 underline disabled:opacity-50"
        >
          Ya no espero
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Card>
    );
  }

  const choices = pendingStops(trip);
  return (
    <Card>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (stopId) void save({ trip_id: trip.id, stop_id: stopId });
        }}
      >
        <label className="text-sm text-slate-600">
          Salida
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
            value={trip.id}
            onChange={(e) => {
              setTripId(e.target.value);
              setStopId('');
            }}
          >
            {open.map((t) => (
              <option key={t.id} value={t.id}>
                {formatHour(t.scheduled_at)} · {t.routes?.name}
                {isLive(t) ? ' · en camino' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          ¿En qué parada estás?
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
            value={stopId}
            onChange={(e) => setStopId(e.target.value)}
            required
          >
            <option value="">Elige tu parada</option>
            {choices.map((s) => {
              const n = trip.waiting?.[s.id] ?? 0;
              return (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {n > 0 ? ` · ${n} esperando` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy || !stopId}
          className="mt-1 rounded-xl bg-sky-500 px-4 py-3 text-lg font-bold text-white shadow active:scale-[0.98] disabled:opacity-40"
        >
          📍 Estoy aquí
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card rounded-2xl p-4">{children}</div>;
}
