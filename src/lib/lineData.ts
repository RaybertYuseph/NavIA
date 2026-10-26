import type { SupabaseClient } from '@supabase/supabase-js';
import type { RouteInfo, Vehicle } from '@/features/trips/types';

const VEHICLE_COLS = 'id, plate, capacity, photo_url, available';
const ROUTE_COLS = 'id, name, direction, stops(id, seq, name, lat, lng)';

// route_id, corridor y coming_soon llegan con la migración 0007; sin ella, se leen las columnas
// de antes y las pantallas funcionan igual (sin corredores ni asignación). Lo mismo con las
// columnas de "disponible en la parada de salida" de 0008 y con las del gestor de unidades de 0009.

/**
 * Unidades de la línea, con la ruta que cubre cada una y dónde esperan salida. Por defecto solo
 * las activas; el fiscal pide también las desincorporadas para poder reincorporarlas.
 */
export async function fetchVehicles(supabase: SupabaseClient, opts: { retired?: boolean } = {}) {
  const q = (cols: string) => {
    const query = supabase.from('vehicles').select(cols).order('plate');
    return opts.retired ? query : query.eq('active', true);
  };
  for (const cols of [
    `${VEHICLE_COLS}, active, in_service, available_at, route_id, available_route_id, available_driver_id`,
    `${VEHICLE_COLS}, available_at, route_id, available_route_id, available_driver_id`,
    `${VEHICLE_COLS}, route_id`,
  ]) {
    const { data, error } = await q(cols);
    if (!error) return (data ?? []) as unknown as Vehicle[];
  }
  return ((await q(VEHICLE_COLS)).data ?? []) as unknown as Vehicle[];
}

/** Rutas activas con sus paradas, su corredor y si están por abrir. */
export async function fetchRoutes(supabase: SupabaseClient) {
  const q = (cols: string) => supabase.from('routes').select(cols).eq('active', true).order('name');
  const full = await q(`${ROUTE_COLS}, corridor, coming_soon`);
  const rows = ((full.error ? (await q(ROUTE_COLS)).data : full.data) ?? []) as unknown as Partial<RouteInfo>[];
  return rows.map((r) => ({ corridor: null, coming_soon: false, ...r }) as RouteInfo);
}
