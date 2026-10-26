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

/** La próxima salida que no ha arrancado y cuya hora no pasó hace más de 10 minutos. */
// En la demo, pasada la última salida del día se muestra la primera programada para que el tour no quede vacío.
export function nextDeparture(trips: Trip[], now: number, demo = false) {
  const scheduled = trips.filter((t) => t.status === 'scheduled');
  const upcoming = scheduled.find((t) => new Date(t.scheduled_at).getTime() > now - 10 * 60_000);
  return upcoming ?? (demo ? scheduled[0] : undefined) ?? null;
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
