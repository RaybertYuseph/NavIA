import { AppShell } from '@/components/AppShell';
import { DriverConsole } from '@/features/driver/DriverConsole';
import { fetchTodayTrips } from '@/features/trips/query';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function DriverHome() {
  // La preparación del día de demo corre a la par de la sesión: no depende de ella.
  const [{ supabase, profile }] = await Promise.all([requireRole(['driver']), ensureDemoDay()]);
  const trips = await fetchTodayTrips(supabase, { driverId: profile.id });
  return (
    <AppShell profile={profile}>
      <DriverConsole trips={trips} />
    </AppShell>
  );
}
