'use client';
import { useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Tabs } from '@/components/Tabs';
import { fiscalTip, lineStatus, mostWaiting, staleUnits, type LineSummary } from '@/features/guide/answers';
import { useGuide } from '@/features/guide/GuideProvider';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { NewDepartureSheet, StartQueue } from './Departures';
import { UnitsManager, type Unit, type UnitState } from './UnitsManager';
import { BusMap } from '@/features/map/BusMap';
import { groupByRoute, waitingByRoute } from '@/features/trips/derive';
import { useLiveTrips } from '@/features/trips/useLiveTrips';
import { STATUS_LABEL, STATUS_STYLE, currentStop, isLive, routeKey, totalWaiting, type RouteInfo, type Trip, type Vehicle } from '@/features/trips/types';
import { createClient } from '@/lib/supabase/client';
import { subscribeWithSession } from '@/lib/supabase/realtime';
import { formatHour } from '@/lib/time';

const CORRIDOR_KEY = 'navia:fiscal:corredor';
const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

/**
 * Vista del fiscal de la línea: unidades, mapa en vivo y salidas de hoy. Las fichas de arriba
 * filtran todo por corredor (ida y regreso de una misma ruta) y se recuerdan en este teléfono.
 */
export function FiscalPanel(props: { initialTrips: Trip[]; initialVehicles: Vehicle[]; routes: RouteInfo[]; drivers: Record<string, string> }) {
  const { trips: allTrips, now, online, refetch } = useLiveTrips(props.initialTrips);
  const [vehicles, setVehicles] = useLiveVehicles(props.initialVehicles);
  const { tab } = useGuide();
  const corridors = useMemo(() => corridorsOf(props.routes), [props.routes]);
  const [corridor, setCorridor] = useCorridor(corridors.map((c) => c.key));
  const routeIds = corridor ? new Set(props.routes.filter((r) => routeKey(r) === corridor).map((r) => r.id)) : null;
  const trips = routeIds ? allTrips.filter((t) => routeIds.has(t.route_id)) : allTrips;
  const [creating, setCreating] = useState(false);
  const shownRoutes = routeIds ? props.routes.filter((r) => routeIds.has(r.id)) : props.routes;

  const units: Unit[] = vehicles
    .filter((v) => v.active !== false)
    .map((v) => {
      const trip = allTrips.find((t) => t.vehicle_id === v.id && isLive(t)) ?? null;
      const state: UnitState = trip ? 'en_ruta' : v.in_service === false ? 'taller' : v.available ? 'disponible' : 'no_disponible';
      return { vehicle: v, trip, state };
    })
    .filter((u) => !routeIds || (u.vehicle.route_id && routeIds.has(u.vehicle.route_id)) || (u.trip && routeIds.has(u.trip.route_id)));
  const mapRoute = corridor ? (props.routes.find((r) => routeKey(r) === corridor && !r.coming_soon) ?? props.routes.find((r) => routeKey(r) === corridor)) : null;
  const comingSoon = !!corridor && props.routes.filter((r) => routeKey(r) === corridor).every((r) => r.coming_soon);
  const counts = {
    en_ruta: units.filter((u) => u.state === 'en_ruta').length,
    disponible: units.filter((u) => u.state === 'disponible').length,
    fuera: units.filter((u) => u.state === 'no_disponible' || u.state === 'taller').length,
  };
  const done = trips.filter((t) => t.status === 'finalizada').length;
  const live = trips.filter((t) => isLive(t) && t.last_lat != null && t.last_lng != null);
  const waiting = trips.reduce((a, t) => a + totalWaiting(t), 0);
  const summary: LineSummary = { enRuta: counts.en_ruta, disponibles: counts.disponible, fuera: counts.fuera, done, total: trips.length, waiting };

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner online={online} />
      <Tabs
        tabs={[
          { id: 'resumen', label: 'Resumen', icon: 'grid' },
          { id: 'unidades', label: 'Unidades', icon: 'bus', badge: counts.en_ruta },
          { id: 'salidas', label: 'Salidas', icon: 'list' },
        ]}
      />

      {corridors.length > 1 && (
        <nav aria-label="Filtrar por ruta" data-tour="rutas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ key: null, soon: false }, ...corridors].map((c) => {
            const active = c.key === corridor;
            return (
              <button
                key={c.key ?? 'todas'}
                type="button"
                aria-pressed={active}
                onClick={() => setCorridor(c.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                  active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
                }`}
              >
                {c.key ?? 'Todas las rutas'}
                {c.soon && <span className={`ml-1.5 text-xs font-medium ${active ? 'text-white/70' : 'text-amber-600'}`}>Próximamente</span>}
              </button>
            );
          })}
        </nav>
      )}
      {comingSoon && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          Esta ruta está por abrir: todavía no tiene salidas. Ya puedes asignarle unidades en la pestaña Unidades.
        </p>
      )}

      {tab === 'resumen' && (
      <>
      <section data-tour="kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="En ruta" value={counts.en_ruta} tone="text-emerald-700" />
        <Kpi label="Disponibles" value={counts.disponible} tone="text-sky-700" />
        <Kpi label="No disponibles" value={counts.fuera} tone="text-slate-600" />
        <Kpi label="Salidas completadas" value={`${done}/${trips.length}`} tone="text-indigo-600" />
        <Kpi label="Estudiantes en espera" value={waiting} tone="text-cyan-600" wide />
      </section>

      <StartQueue routes={shownRoutes} trips={trips} vehicles={vehicles} drivers={props.drivers} onNew={() => setCreating(true)} />

      <WaitingByStop trips={trips} />

      <section aria-labelledby="mapa" data-tour="mapa">
        <h2 id="mapa" className="section-title">Mapa en vivo</h2>
        {live.length === 0 && !mapRoute ? (
          <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad está enviando ubicación ahora.</p>
        ) : (
          <BusMap
            key={corridor ?? 'todas'}
            className="h-80"
            stops={mapRoute ? [...mapRoute.stops].sort((a, b) => a.seq - b.seq).map((s, i) => ({ ...s, seq: i + 1 })) : []}
            buses={live.map((t) => ({
              id: t.id,
              lat: t.last_lat!,
              lng: t.last_lng!,
              label: `${t.vehicles?.plate ?? ''} · ${formatHour(t.scheduled_at)}`,
              stale: !t.last_seen_at || now - new Date(t.last_seen_at).getTime() > 5 * 60_000,
            }))}
          />
        )}
      </section>

      {DEMO && <ResetDemo onDone={refetch} />}
      </>
      )}

      {tab === 'unidades' && (
        <UnitsManager
          units={units}
          retired={vehicles.filter((v) => v.active === false)}
          routes={props.routes}
          drivers={props.drivers}
          trips={allTrips}
          now={now}
          setVehicles={setVehicles}
          onTripsChanged={() => void refetch()}
        />
      )}

      {tab === 'salidas' && (
      <section aria-labelledby="salidas">
        <div className="flex items-end justify-between gap-2">
          <h2 id="salidas" className="section-title">Salidas de hoy por ruta</h2>
          <button type="button" onClick={() => setCreating(true)} className="chip mb-2 py-1.5 text-sm">
            + Nueva salida
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {trips.length === 0 && <p className="card rounded-3xl p-4 text-slate-600">Esta ruta no tiene salidas hoy.</p>}
          {groupByRoute(trips).map(({ route, trips: rt }) => (
            <article key={rt[0].route_id} className="card overflow-x-auto rounded-3xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{route.name}</h3>
                {rt.some((t) => totalWaiting(t) > 0) && (
                  <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                    {rt.reduce((a, t) => a + totalWaiting(t), 0)} en espera
                  </span>
                )}
              </div>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Hora</th>
                    <th className="py-1 pr-3 font-medium">Unidad</th>
                    <th className="py-1 pr-3 font-medium">Conductor</th>
                    <th className="py-1 pr-3 font-medium">Estado</th>
                    <th className="py-1 pr-3 font-medium">Última parada</th>
                    <th className="py-1 font-medium">En espera</th>
                  </tr>
                </thead>
                <tbody>
                  {rt.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                        {formatHour(t.scheduled_at)}
                        {t.started_at && <span className="block text-xs font-normal text-slate-500">Salió {formatHour(t.started_at)}</span>}
                      </td>
                      <td className="py-1.5 pr-3 font-mono">
                        {t.vehicles?.plate ??
                          (t.status === 'scheduled' ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-sans text-xs font-semibold whitespace-nowrap text-amber-800">Por confirmar unidad</span>
                          ) : (
                            '—'
                          ))}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{(t.driver_id && props.drivers[t.driver_id]) || '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      </td>
                      <td className="py-1.5 pr-3">{currentStop(t)?.name ?? '—'}</td>
                      <td className="py-1.5">{totalWaiting(t) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </section>
      )}

      {creating && <NewDepartureSheet routes={shownRoutes} onClose={() => setCreating(false)} onCreated={() => void refetch()} />}

      <NaviaFab
        raised
        tip={fiscalTip(summary)}
        questions={[
          { q: '¿Cómo va la línea?', answer: () => lineStatus(summary) },
          { q: '¿Alguna unidad sin señal?', answer: () => staleUnits(trips, now) },
          { q: '¿Dónde esperan más?', answer: () => mostWaiting(trips) },
        ]}
      />
    </div>
  );
}

/** Por ruta: total en espera y cuántos hay en cada parada (suma de las salidas de hoy). */
function WaitingByStop({ trips }: { trips: Trip[] }) {
  const routes = waitingByRoute(trips);
  if (routes.length === 0) return null;
  return (
    <section aria-labelledby="espera-paradas">
      <h2 id="espera-paradas" className="section-title">Estudiantes en espera por parada</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {routes.map((r) => (
          <article key={r.routeId} className="card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{r.name}</h3>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${r.total > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                {r.total} en espera
              </span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {r.stops.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className={s.n > 0 ? 'font-medium' : 'text-slate-500'}>{s.name}</span>
                  <span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold ${s.n > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'}`}>
                    {s.n}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Kpi({ label, value, tone, wide }: { label: string; value: number | string; tone: string; wide?: boolean }) {
  return (
    <div className={`card rounded-3xl p-4 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className={`text-3xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function useLiveVehicles(initial: Vehicle[]) {
  const [vehicles, setVehicles] = useState(initial);
  useEffect(() => {
    const supabase = createClient();
    return subscribeWithSession(supabase, () =>
      supabase
        .channel('navia-vehicles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (p: RealtimePostgresChangesPayload<Vehicle>) => {
          const v = p.new as Vehicle;
          setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...v } : x)));
        }),
    );
  }, []);
  return [vehicles, setVehicles] as const;
}

/** Corredores para las fichas: primero los que tienen salidas, luego los "Próximamente". */
function corridorsOf(routes: RouteInfo[]) {
  const byKey = new Map<string, boolean>();
  for (const r of routes) byKey.set(routeKey(r), (byKey.get(routeKey(r)) ?? true) && r.coming_soon);
  return [...byKey].map(([key, soon]) => ({ key, soon })).sort((a, b) => Number(a.soon) - Number(b.soon));
}

/** Corredor elegido, recordado en este teléfono (si ya no existe, vuelve a "Todas"). */
function useCorridor(keys: string[]) {
  const [corridor, setCorridor] = useState<string | null>(null);
  const known = keys.join('|');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CORRIDOR_KEY);
      if (saved && known.split('|').includes(saved)) setCorridor(saved);
    } catch {
      /* sin almacenamiento: queda en "Todas" */
    }
  }, [known]);
  const choose = (key: string | null) => {
    setCorridor(key);
    try {
      if (key) localStorage.setItem(CORRIDOR_KEY, key);
      else localStorage.removeItem(CORRIDOR_KEY);
    } catch {
      /* sin almacenamiento: el filtro dura mientras la página esté abierta */
    }
  };
  return [corridor, choose] as const;
}

function ResetDemo({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function reset() {
    setAsking(false);
    setBusy(true);
    const { data, error } = await createClient().rpc('reset_demo_today');
    setBusy(false);
    // El detalle del error ayuda a saber qué migración falta en Supabase.
    setMessage(error ? `No se pudo reiniciar: ${error.message}` : `Listo: día reiniciado (${data} ${data === 1 ? 'salida borrada' : 'salidas borradas'}).`);
    await onDone();
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-slate-300 p-4">
      <p className="flex-1 text-sm text-slate-600">Demo: borra las salidas de hoy para repetir el recorrido desde cero.</p>
      <button type="button" disabled={busy} onClick={() => setAsking(true)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">
        {busy ? 'Reiniciando…' : 'Reiniciar demo'}
      </button>
      {message && <p className="w-full text-sm font-medium text-slate-700">{message}</p>}
      {asking && (
        <ConfirmSheet
          title="¿Reiniciar la demo?"
          body="Se borran las salidas de hoy y las esperas marcadas. El día empieza vacío: cada salida aparece cuando un conductor se activa en la parada."
          confirmLabel="Sí, reiniciar"
          cancelLabel="Cancelar"
          onConfirm={() => void reset()}
          onCancel={() => setAsking(false)}
        />
      )}
    </section>
  );
}
