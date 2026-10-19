import { AppHeader } from '@/components/AppHeader';
import { fetchTodayTrips } from '@/features/trips/query';
import { StudentHome } from '@/features/trips/StudentHome';
import { requireRole } from '@/lib/profile';

export default async function StudentPage() {
  const { supabase, profile } = await requireRole(['student']);
  const trips = await fetchTodayTrips(supabase);

  return (
    <main className="mx-auto max-w-md p-4">
      <AppHeader name={profile.full_name} subtitle="Estudiante" />
      {profile.status === 'pending' && (
        <p className="mb-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 ring-1 ring-brand-100">
          Tu registro está pendiente de aprobación. Ya puedes ver el estado de las rutas.
        </p>
      )}
      <StudentHome initial={trips} />
    </main>
  );
}
