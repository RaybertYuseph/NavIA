import { AppHeader } from '@/components/AppHeader';
import { DriverConsole } from '@/features/driver/DriverConsole';
import { TRIP_SELECT, type Trip } from '@/features/trips/types';
import { requireRole } from '@/lib/profile';
import { caracasDayRange } from '@/lib/time';

export default async function DriverHome() {
  const { supabase, profile } = await requireRole(['driver']);
  const { from, to } = caracasDayRange();
  const { data } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('driver_id', profile.id)
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)
    .order('scheduled_at');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <AppHeader name={profile.full_name} subtitle="Conductor" />
      <DriverConsole trips={(data ?? []) as unknown as Trip[]} />
    </main>
  );
}
