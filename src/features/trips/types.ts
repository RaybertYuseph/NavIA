export type TripStatus = 'scheduled' | 'en_camino' | 'en_parada' | 'finalizada' | 'cancelada';

export type Stop = { id: string; seq: number; name: string; lat: number; lng: number };

export type Trip = {
  id: string;
  route_id: string;
  scheduled_at: string;
  status: TripStatus;
  current_stop_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  routes: { name: string; direction: 'ida' | 'regreso'; stops: Stop[] } | null;
};

/** Columnas que leen las pantallas (una sola consulta con ruta y paradas). */
export const TRIP_SELECT =
  'id, route_id, scheduled_at, status, current_stop_id, last_lat, last_lng, last_seen_at, routes(name, direction, stops(id, seq, name, lat, lng))';

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
