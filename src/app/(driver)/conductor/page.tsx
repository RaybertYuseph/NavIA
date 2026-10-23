import { AppShell } from '@/components/AppShell';
import { DriverConsole } from '@/features/driver/DriverConsole';
import { fetchTodayTrips } from '@/features/trips/query';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function DriverHome() {
  const { supabase, profile } = await requireRole(['driver']);
  await ensureDemoDay();
  const trips = await fetchTodayTrips(supabase, { driverId: profile.id });
  return (
    <AppShell profile={profile}>
      <DriverConsole trips={trips} />
    </AppShell>
  );
}
