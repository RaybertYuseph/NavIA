'use client';
import { useMemo, useState } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Icon } from '@/components/icons';
import { Tabs } from '@/components/Tabs';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { nextStop } from '@/features/driver/state';
import { HOW_TO_MARK, fareInfo, minutesUntil, studentTip, whenNext, whereIsBus } from '@/features/guide/answers';
import { useGuide } from '@/features/guide/GuideProvider';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { NaviaSays } from '@/features/guide/NaviaSays';
import { BusMap } from '@/features/map/BusMap';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { formatHour, timeAgo } from '@/lib/time';
import { useLiveTrips } from './useLiveTrips';
import { WaitAtStop } from './WaitAtStop';
import { atStartStop, groupByRoute, nextDeparture, stopsForMap } from './derive';
import { STATUS_LABEL, STATUS_STYLE, currentStop, isLive, liveLabel, sortedStops, type Trip } from './types';

const STALE_MS = 5 * 60_000;

/** Vista del estudiante en tres pestañas: Inicio (próxima salida y parada), En vivo y Horarios. */
export function StudentHome({ initial, comingSoon = [] }: { initial: Trip[]; comingSoon?: string[] }) {
  const { trips, now, online } = useLiveTrips(initial);
  const { tab, setTab } = useGuide();
  const live = trips.filter(isLive);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = live.find((t) => t.id === selectedId) ?? live[0] ?? null;
  const demo = process.env.NEXT_PUBLIC_DEMO === '1';
  const next = nextDeparture(trips, now, demo);
  const tip = studentTip(live, next, now);

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner online={online} />
      <Tabs
        tabs={[
          { id: 'inicio', label: 'Inicio', icon: 'home' },
          { id: 'envivo', label: 'En vivo', icon: 'map', badge: live.length },
          { id: 'horarios', label: 'Horarios', icon: 'clock' },
        ]}
      />

      {tab === 'inicio' && (
        <>
          <NaviaSays text={tip} />

          <section aria-labelledby="proxima" data-tour="proxima">
            <h2 id="proxima" className="section-title">Próxima salida</h2>
            {next ? (
              <div className="brand-hero relative overflow-hidden rounded-[1.75rem] p-5 text-white">
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex-1">
                    <BigHour iso={next.scheduled_at} />
                    <p className="mt-1 font-semibold">{next.routes?.name}</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">
                      <Icon name="clock" className="h-4 w-4" />{' '}
                      {atStartStop(next, now)
                        ? `Saliendo pronto · en la parada de salida desde ${formatHour(next.scheduled_at)}`
                        : minutesUntil(next.scheduled_at, now)}
                    </span>
                  </div>
                  <VehiclePhoto vehicle={next.vehicles} />
                </div>
              </div>
            ) : (
              <Empty text="Aún no hay salidas. Aparecen apenas un conductor esté en la parada de salida." />
            )}
          </section>

          {live.length > 0 && (
            <button type="button" onClick={() => setTab('envivo')} className="card flex items-center gap-3 rounded-3xl p-4 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Icon name="bus" />
              </span>
              <span className="flex-1">
                <span className="block font-bold">{live.length === 1 ? '1 camioneta en camino' : `${live.length} camionetas en camino`}</span>
                <span className="text-sm text-slate-600">Mira por dónde vienen en el mapa</span>
              </span>
              <Icon name="chevron" className="h-5 w-5 text-slate-400" />
            </button>
          )}

          <section aria-labelledby="espera" data-tour="espera">
            <h2 id="espera" className="section-title">Estoy en la parada</h2>
            <WaitAtStop trips={trips} preferredTripId={selected?.id ?? next?.id ?? null} />
          </section>
        </>
      )}

      {tab === 'envivo' && (
        <section aria-labelledby="en-camino" className="flex flex-col gap-3">
          <h2 id="en-camino" className="section-title">En camino ahora</h2>
          {live.length === 0 ? (
            <Empty text="Ninguna camioneta va en camino en este momento. Te aviso apenas arranque una." />
          ) : (
            <>
              <BusMap
                className="h-72"
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
            </>
          )}
        </section>
      )}

      {tab === 'horarios' && (
        <section aria-labelledby="rutas">
          <h2 id="rutas" className="section-title">Salidas confirmadas de hoy</h2>
          {/* Solo las que un conductor confirmó (con unidad) y no han terminado: no hay horario fijo. */}
          <RoutesSchedule trips={trips.filter((t) => t.vehicle_id && (t.status === 'scheduled' || isLive(t)))} />
          {comingSoon.length > 0 && (
            <div className="card mt-3 rounded-3xl p-4">
              <h3 className="font-bold">Próximamente</h3>
              <p className="text-sm text-slate-500">Rutas que NavIA va a cubrir pronto.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {comingSoon.map((name) => (
                  <li key={name} className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <NaviaFab
        raised
        tip={tip}
        questions={[
          { q: '¿Dónde viene la camioneta?', answer: () => whereIsBus(live, next, now) },
          { q: '¿Cuándo sale la próxima?', answer: () => whenNext(next, now) },
          { q: '¿Cómo marco mi parada?', answer: () => HOW_TO_MARK },
          { q: '¿Cuánto es el pasaje?', answer: () => fareInfo(trips) },
        ]}
      />
    </div>
  );
}

/** "11:30 p. m." con la hora grande y "p. m." pequeño, para que no se parta en dos líneas. */
function BigHour({ iso }: { iso: string }) {
  const [, hour, suffix] = formatHour(iso).match(/^(\S+)\s*(.*)$/) ?? [];
  return (
    <p className="font-extrabold tracking-tight whitespace-nowrap">
      <span className="text-5xl">{hour}</span> <span className="text-xl">{suffix}</span>
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card flex items-center gap-3 rounded-3xl p-4">
      <NaviaAgent size={44} compact className="shrink-0" />
      <p className="text-slate-600">{text}</p>
    </div>
  );
}

function LiveTripCard({ trip, now, selected, onSelect }: { trip: Trip; now: number; selected: boolean; onSelect: () => void }) {
  const stops = sortedStops(trip);
  const here = currentStop(trip);
  const upcoming = nextStop(stops, trip.current_stop_id);
  return (
    <button type="button" onClick={onSelect} className={`card flex gap-3 rounded-3xl p-3 text-left ${selected ? 'ring-2 ring-brand-400' : ''}`}>
      <VehiclePhoto vehicle={trip.vehicles} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">{trip.routes?.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[trip.status]}`}>{STATUS_LABEL[trip.status]}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm font-medium">
          <Icon name="pin" className="h-4 w-4 text-brand-500" />
          {trip.status === 'en_parada' && here ? `Cargando en ${here.name}` : upcoming ? `Va hacia ${upcoming.name}` : 'Llegando a destino'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {trip.started_at ? `Salió ${formatHour(trip.started_at)}` : `Sale ${formatHour(trip.scheduled_at)}`} · ubicación {timeAgo(trip.last_seen_at, now)}
        </p>
      </div>
    </button>
  );
}

function RoutesSchedule({ trips }: { trips: Trip[] }) {
  const routes = useMemo(() => groupByRoute(trips), [trips]);
  if (routes.length === 0) return <Empty text="Sin salidas confirmadas por ahora. Aparecen apenas un conductor esté en la parada de salida." />;
  return (
    <div className="flex flex-col gap-3">
      {routes.map(({ route, trips: rt }) => {
        const stops = sortedStops(rt[0]);
        return (
          <article key={rt[0].route_id} className="card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{route.name}</h3>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
                {Number(route.fare_usd).toFixed(2).replace('.', ',')} USD
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{stops.map((s) => s.name).join(' → ')}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rt.map((t) => (
                <li key={t.id} className={`rounded-xl px-2.5 py-1 text-sm font-semibold ${STATUS_STYLE[t.status]}`} title={STATUS_LABEL[t.status]}>
                  {formatHour(t.scheduled_at)}
                  {isLive(t) && ` · ${liveLabel(t)}`}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
