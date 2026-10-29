import { sortedStops, type Trip } from './types';

export function groupByRoute(trips: Trip[]) {
  const byRoute = new Map<string, { route: NonNullable<Trip['routes']>; trips: Trip[] }>();
  for (const t of trips) {
    if (!t.routes) continue;
    const entry = byRoute.get(t.route_id) ?? { route: t.routes, trips: [] };
    entry.trips.push(t);
    byRoute.set(t.route_id, entry);
  }
  return [...byRoute.values()];
}

export function stopsForMap(trip: Trip) {
  const stops = sortedStops(trip);
  const idx = stops.findIndex((s) => s.id === trip.current_stop_id);
  return stops.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, seq: i + 1, done: idx >= 0 && i <= idx }));
}

/**
 * La próxima salida confirmada: la que ya tiene unidad y no ha arrancado. Si el conductor ya está
 * en la parada de salida su hora pudo pasar, y sigue siendo la próxima hasta que arranque (0010).
 */
// En la demo, pasada la última salida del día se muestra la primera programada para que el tour no quede vacío.
export function nextDeparture(trips: Trip[], now: number, demo = false) {
  const scheduled = trips.filter((t) => t.status === 'scheduled' && t.vehicle_id);
  const upcoming = scheduled.find((t) => t.vehicles?.available || new Date(t.scheduled_at).getTime() > now - 10 * 60_000);
  return upcoming ?? (demo ? scheduled[0] : undefined) ?? null;
}

/** Si la salida confirmada ya está en la parada de salida (su hora llegó y no ha arrancado). */
export function atStartStop(trip: Trip, now: number) {
  return trip.status === 'scheduled' && !!trip.vehicle_id && new Date(trip.scheduled_at).getTime() <= now + 60_000;
}

/** Salidas que el fiscal programó y todavía esperan unidad (las de las próximas horas). */
// En la demo, si ya pasaron todas, se muestran igual para que se vea el flujo.
export function pendingDepartures(trips: Trip[], now: number, demo = false) {
  const pending = trips.filter((t) => t.status === 'scheduled' && !t.vehicle_id);
  const upcoming = pending.filter((t) => new Date(t.scheduled_at).getTime() > now - 10 * 60_000);
  return upcoming.length || !demo ? upcoming : pending;
}

/** Paradas que el estudiante aún puede marcar: las que el bus todavía no alcanza. */
export function pendingStops(trip: Trip) {
  const stops = sortedStops(trip);
  if (trip.status === 'finalizada' || trip.status === 'cancelada') return [];
  const i = stops.findIndex((s) => s.id === trip.current_stop_id);
  return i < 0 ? stops : stops.slice(i + 1);
}

/** Estudiantes en espera por ruta y por parada, sumando todas las salidas de hoy de esa ruta. */
export function waitingByRoute(trips: Trip[]) {
  return groupByRoute(trips).map(({ route, trips: rt }) => {
    const stops = sortedStops(rt[0]).map((s) => ({ id: s.id, name: s.name, n: rt.reduce((a, t) => a + (t.waiting?.[s.id] ?? 0), 0) }));
    return { routeId: rt[0].route_id, name: route.name, total: stops.reduce((a, s) => a + s.n, 0), stops };
  });
}
