import { AppHeader } from '@/components/AppHeader';
import { LiveTrips } from '@/features/trips/LiveTrips';
import { TRIP_SELECT, type Trip } from '@/features/trips/types';
import { requireRole } from '@/lib/profile';
import { caracasDayRange } from '@/lib/time';

// Corte 1: el coordinador ve las salidas en vivo. Aprobaciones, rutas y conciliación llegan en los sprints 3 a 5.
export default async function CoordinatorHome() {
  const { supabase, profile } = await requireRole(['coordinator', 'admin']);
  const { from, to } = caracasDayRange();
  const { data } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)
    .order('scheduled_at');

  return (
    <main className="mx-auto max-w-2xl p-4">
      <AppHeader name={profile.full_name} subtitle="Panel del coordinador" />
      <LiveTrips initial={(data ?? []) as unknown as Trip[]} />
    </main>
  );
}
