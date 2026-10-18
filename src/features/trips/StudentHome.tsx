'use client';
import { useMemo, useState } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { BusMap } from '@/features/map/BusMap';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { formatHour, timeAgo } from '@/lib/time';
import { nextStop } from '@/features/driver/state';
import { useLiveTrips } from './useLiveTrips';
import { groupByRoute, nextDeparture, stopsForMap } from './derive';
import { STATUS_LABEL, STATUS_STYLE, currentStop, isLive, sortedStops, type Trip } from './types';

const STALE_MS = 5 * 60_000;

/** Vista del estudiante: próxima salida, unidades en camino con mapa y foto, y rutas con horarios. */
export function StudentHome({ initial }: { initial: Trip[] }) {
  const { trips, now, online } = useLiveTrips(initial);
  const live = trips.filter(isLive);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = live.find((t) => t.id === selectedId) ?? live[0] ?? null;
  const next = nextDeparture(trips, now);

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner online={online} />

      <section aria-labelledby="proxima">
        <h2 id="proxima" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Próxima salida</h2>
        {next ? (
          <div className="flex items-center gap-4 rounded-2xl bg-indigo-600 p-4 text-white shadow">
            <div className="flex-1">
              <p className="text-4xl font-bold">{formatHour(next.scheduled_at)}</p>
              <p className="mt-1 font-medium">{next.routes?.name}</p>
              <p className="text-sm text-indigo-100">{minutesUntil(next.scheduled_at, now)}</p>
            </div>
            <VehiclePhoto vehicle={next.vehicles} />
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-4 text-slate-600">No hay más salidas programadas hoy.</p>
        )}
      </section>

      <section aria-labelledby="en-camino">
        <h2 id="en-camino" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          En camino ahora {live.length > 0 && `(${live.length})`}
        </h2>
        {live.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-slate-600">Ninguna unidad va en camino en este momento.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <BusMap
              buses={live
                .filter((t) => t.last_lat != null && t.last_lng != null)
                .map((t) => ({
                  id: t.id,
                  lat: t.last_lat!,
                  lng: t.last_lng!,
                  label: t.vehicles?.plate ?? formatHour(t.scheduled_at),
                  stale: !t.last_seen_at || now - new Date(t.last_seen_at).getTime() > STALE_MS,
                }))}
              stops={selected ? stopsForMap(selected) : []}
            />
            {live.map((t) => (
              <LiveTripCard key={t.id} trip={t} now={now} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="rutas">
        <h2 id="rutas" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rutas y horarios de hoy</h2>
        <RoutesSchedule trips={trips} />
      </section>
    </div>
  );
}

function LiveTripCard({ trip, now, selected, onSelect }: { trip: Trip; now: number; selected: boolean; onSelect: () => void }) {
  const stops = sortedStops(trip);
  const here = currentStop(trip);
  const upcoming = nextStop(stops, trip.current_stop_id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ${selected ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <VehiclePhoto vehicle={trip.vehicles} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{trip.routes?.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[trip.status]}`}>
            {STATUS_LABEL[trip.status]}
          </span>
        </div>
        <p className="text-sm text-slate-600">Salió {formatHour(trip.started_at ?? trip.scheduled_at)}</p>
        <p className="mt-1 text-sm">
          {trip.status === 'en_parada' && here ? `En ${here.name}` : upcoming ? `Próxima parada: ${upcoming.name}` : 'Llegando a destino'}
        </p>
        <p className="text-xs text-slate-500">Ubicación {timeAgo(trip.last_seen_at, now)}</p>
      </div>
    </button>
  );
}

function RoutesSchedule({ trips }: { trips: Trip[] }) {
  const routes = useMemo(() => groupByRoute(trips), [trips]);
  if (routes.length === 0) {
    return <p className="rounded-2xl bg-white p-4 text-slate-600">No hay salidas programadas hoy.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {routes.map(({ route, trips: rt }) => {
        const stops = sortedStops(rt[0]);
        return (
          <article key={rt[0].route_id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{route.name}</h3>
              <span className="shrink-0 text-sm text-slate-600">{Number(route.fare_usd).toFixed(2)} USD</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{stops.map((s) => s.name).join(' → ')}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rt.map((t) => (
                <li key={t.id} className={`rounded-lg px-2 py-1 text-sm font-medium ${STATUS_STYLE[t.status]}`} title={STATUS_LABEL[t.status]}>
                  {formatHour(t.scheduled_at)}
                  {isLive(t) && ' · en camino'}
                  {t.status === 'finalizada' && ' ✓'}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function minutesUntil(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (m <= 0) return 'Sale en cualquier momento';
  if (m < 60) return `Sale en ${m} min`;
  return `Sale en ${Math.floor(m / 60)} h ${m % 60} min`;
}
