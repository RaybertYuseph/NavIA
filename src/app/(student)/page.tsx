import { AppShell } from '@/components/AppShell';
import { fetchTodayTrips } from '@/features/trips/query';
import { StudentHome } from '@/features/trips/StudentHome';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function StudentPage() {
  const { supabase, profile } = await requireRole(['student']);
  await ensureDemoDay();
  const trips = await fetchTodayTrips(supabase);

  return (
    <AppShell profile={profile}>
      {profile.status === 'pending' && (
        <p className="mb-4 rounded-2xl bg-brand-50 p-3 text-sm text-brand-700 ring-1 ring-brand-100">
          Tu registro está pendiente de aprobación. Mientras tanto ya puedes ver las rutas.
        </p>
      )}
      <StudentHome initial={trips} />
    </AppShell>
  );
}
