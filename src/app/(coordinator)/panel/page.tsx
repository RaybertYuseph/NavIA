import { AppShell } from '@/components/AppShell';
import { FiscalPanel } from '@/features/panel/FiscalPanel';
import { fetchTodayTrips } from '@/features/trips/query';
import type { RouteInfo, Vehicle } from '@/features/trips/types';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

const VEHICLE_COLS = 'id, plate, capacity, photo_url, available';
const ROUTE_COLS = 'id, name, direction, stops(id, seq, name, lat, lng)';

export default async function FiscalPage() {
  // La preparación del día de demo corre a la par de la sesión: no depende de ella.
  const [{ supabase, profile }] = await Promise.all([requireRole(['coordinator', 'admin']), ensureDemoDay()]);

  // route_id, corridor y coming_soon llegan con la migración 0007; sin ella, el panel funciona igual
  // (sin filtro por corredor ni asignación).
  const vehiclesQuery = async () => {
    const q = (cols: string) => supabase.from('vehicles').select(cols).eq('active', true).order('plate');
    const full = await q(`${VEHICLE_COLS}, route_id`);
    return (full.error ? (await q(VEHICLE_COLS)).data : full.data) as Vehicle[] | null;
  };
  const routesQuery = async () => {
    const q = (cols: string) => supabase.from('routes').select(cols).eq('active', true).order('name');
    const full = await q(`${ROUTE_COLS}, corridor, coming_soon`);
    const rows = (full.error ? (await q(ROUTE_COLS)).data : full.data) as Partial<RouteInfo>[] | null;
    return (rows ?? []).map((r) => ({ corridor: null, coming_soon: false, ...r }) as RouteInfo);
  };

  const [trips, vehicles, routes, drivers] = await Promise.all([
    fetchTodayTrips(supabase),
    vehiclesQuery(),
    routesQuery(),
    supabase.from('profiles').select('id, full_name').eq('role', 'driver'),
  ]);

  return (
    <AppShell profile={profile} wide>
      <FiscalPanel
        initialTrips={trips}
        initialVehicles={vehicles ?? []}
        routes={routes}
        drivers={Object.fromEntries((drivers.data ?? []).map((d) => [d.id, d.full_name]))}
      />
    </AppShell>
  );
}
