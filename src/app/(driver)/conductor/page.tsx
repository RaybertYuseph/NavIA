import { AppShell } from '@/components/AppShell';
import { DriverConsole } from '@/features/driver/DriverConsole';
import { fetchTodayTrips } from '@/features/trips/query';
import { ensureDemoDay } from '@/lib/demoDay';
import { fetchRoutes, fetchVehicles } from '@/lib/lineData';
import { requireRole } from '@/lib/profile';

export default async function DriverHome() {
  // La preparación del día de demo corre a la par de la sesión: no depende de ella.
  const [{ supabase, profile }] = await Promise.all([requireRole(['driver']), ensureDemoDay()]);
  const [trips, vehicles, routes, last] = await Promise.all([
    fetchTodayTrips(supabase, { driverId: profile.id }),
    fetchVehicles(supabase),
    fetchRoutes(supabase),
    // Su unidad de siempre: la de su última salida.
    supabase.from('trips').select('vehicle_id').eq('driver_id', profile.id).not('vehicle_id', 'is', null)
      .order('scheduled_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <AppShell profile={profile}>
      <DriverConsole
        trips={trips}
        vehicles={vehicles}
        routes={routes.filter((r) => !r.coming_soon && r.stops.length > 0)}
        myVehicleId={(last.data as { vehicle_id: string } | null)?.vehicle_id ?? null}
      />
    </AppShell>
  );
}
