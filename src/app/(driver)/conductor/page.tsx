import { AppHeader } from '@/components/AppHeader';
import { DriverConsole } from '@/features/driver/DriverConsole';
import { fetchTodayTrips } from '@/features/trips/query';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function DriverHome() {
  const { supabase, profile } = await requireRole(['driver']);
  await ensureDemoDay();
  const trips = await fetchTodayTrips(supabase, { driverId: profile.id });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <AppHeader name={profile.full_name} subtitle="Conductor" />
      <DriverConsole trips={trips} />
    </main>
  );
}
