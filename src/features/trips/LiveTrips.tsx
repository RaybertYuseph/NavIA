'use client';
import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { caracasDayRange, formatHour, timeAgo } from '@/lib/time';
import { STATUS_LABEL, STATUS_STYLE, TRIP_SELECT, sortedStops, type Trip } from './types';

const POLL_MS = 30_000;

/**
 * Salidas de hoy con su estado en vivo (E5-H1): Supabase Realtime empuja cada cambio de
 * trips y, si el WebSocket cae con la red, se vuelve a consultar cada 30 s.
 */
export function LiveTrips({ initial }: { initial: Trip[] }) {
  const [trips, setTrips] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const refetch = async () => {
      const { from, to } = caracasDayRange();
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_SELECT)
        .gte('scheduled_at', from)
        .lt('scheduled_at', to)
        .order('scheduled_at');
      if (!error && data) setTrips(data as unknown as Trip[]);
    };

    const channel = supabase
      .channel('trips-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload: RealtimePostgresChangesPayload<Trip>) => {
        const row = payload.new as Partial<Trip> & { id: string };
        setTrips((prev) => prev.map((t) => (t.id === row.id ? { ...t, ...row, routes: t.routes } : t)));
      })
      .subscribe();

    const poll = setInterval(() => {
      if (navigator.onLine) void refetch();
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const onOnline = () => {
      setOnline(true);
      void refetch();
    };
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (trips.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center text-slate-600">No hay salidas programadas hoy.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {!online && (
        <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
          Sin conexión. Lo que ves puede estar desactualizado.
        </p>
      )}
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} now={now} />
      ))}
    </div>
  );
}

function TripCard({ trip, now }: { trip: Trip; now: number }) {
  const stops = sortedStops(trip);
  const currentIdx = stops.findIndex((s) => s.id === trip.current_stop_id);
  const live = trip.status === 'en_camino' || trip.status === 'en_parada';

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{trip.routes?.name}</h2>
          <p className="text-sm text-slate-600">Salida {formatHour(trip.scheduled_at)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[trip.status]}`}>
          {STATUS_LABEL[trip.status]}
        </span>
      </div>

      {live && (
        <p className="mt-2 text-sm text-slate-700">
          {currentIdx >= 0 ? `Última parada: ${stops[currentIdx].name}` : 'Aún no llega a la primera parada'}
          {' · '}
          <span className="text-slate-500">ubicación {timeAgo(trip.last_seen_at, now)}</span>
        </p>
      )}

      <ol className="mt-3 flex flex-col gap-1">
        {stops.map((s, i) => {
          const passed = currentIdx >= 0 && i < currentIdx;
          const here = i === currentIdx;
          return (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  here ? 'bg-amber-500' : passed ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              />
              <span className={passed ? 'text-slate-400 line-through' : here ? 'font-medium' : ''}>{s.name}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
