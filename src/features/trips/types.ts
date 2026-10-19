export type TripStatus = 'scheduled' | 'en_camino' | 'en_parada' | 'finalizada' | 'cancelada';

export type Stop = { id: string; seq: number; name: string; lat: number; lng: number };

export type Vehicle = {
  id: string;
  plate: string;
  capacity: number;
  photo_url: string | null;
  available: boolean;
};

export type Trip = {
  id: string;
  route_id: string;
  scheduled_at: string;
  status: TripStatus;
  current_stop_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  started_at: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  /** Estudiantes esperando por parada: { stop_id: n }. */
  waiting: Record<string, number>;
  routes: { name: string; direction: 'ida' | 'regreso'; active: boolean; fare_usd: number; stops: Stop[] } | null;
  vehicles: Vehicle | null;
};

/** Columnas que leen las pantallas (una sola consulta con ruta y paradas). */
export const TRIP_SELECT =
  'id, route_id, vehicle_id, driver_id, scheduled_at, started_at, status, current_stop_id, last_lat, last_lng, last_seen_at, waiting, ' +
  'routes(name, direction, active, fare_usd, stops(id, seq, name, lat, lng)), ' +
  'vehicles(id, plate, capacity, photo_url, available)';

export const STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: 'Programada',
  en_camino: 'En camino',
  en_parada: 'En parada',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export const STATUS_STYLE: Record<TripStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-700',
  en_camino: 'bg-emerald-100 text-emerald-800',
  en_parada: 'bg-amber-100 text-amber-800',
  finalizada: 'bg-slate-200 text-slate-500',
  cancelada: 'bg-red-100 text-red-700',
};

export function sortedStops(trip: Pick<Trip, 'routes'>) {
  return [...(trip.routes?.stops ?? [])].sort((a, b) => a.seq - b.seq);
}

export function isLive(t: Pick<Trip, 'status'>) {
  return t.status === 'en_camino' || t.status === 'en_parada';
}

export function currentStop(trip: Trip) {
  return sortedStops(trip).find((s) => s.id === trip.current_stop_id) ?? null;
}

export function totalWaiting(trip: Pick<Trip, 'waiting'>) {
  return Object.values(trip.waiting ?? {}).reduce((a, n) => a + n, 0);
}
