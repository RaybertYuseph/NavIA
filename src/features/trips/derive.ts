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
  return stops.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, done: idx >= 0 && i <= idx }));
}

/** La próxima salida que no ha arrancado y cuya hora no pasó hace más de 10 minutos. */
export function nextDeparture(trips: Trip[], now: number) {
  return trips.find((t) => t.status === 'scheduled' && new Date(t.scheduled_at).getTime() > now - 10 * 60_000) ?? null;
}
