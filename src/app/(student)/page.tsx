import { AppHeader } from '@/components/AppHeader';
import { LiveTrips } from '@/features/trips/LiveTrips';
import { TRIP_SELECT, type Trip } from '@/features/trips/types';
import { requireRole } from '@/lib/profile';
import { caracasDayRange } from '@/lib/time';

export default async function StudentHome() {
  const { supabase, profile } = await requireRole(['student']);
  const { from, to } = caracasDayRange();
  const { data } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)
    .order('scheduled_at');

  return (
    <main className="mx-auto max-w-md p-4">
      <AppHeader name={profile.full_name} subtitle="Salidas de hoy" />
      {profile.status === 'pending' && (
        <p className="mb-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
          Tu registro está pendiente de aprobación. Ya puedes ver el estado de las rutas.
        </p>
      )}
      <LiveTrips initial={(data ?? []) as unknown as Trip[]} />
    </main>
  );
}
