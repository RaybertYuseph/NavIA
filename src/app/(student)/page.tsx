import { AppShell } from '@/components/AppShell';
import { fetchTodayTrips } from '@/features/trips/query';
import { StudentHome } from '@/features/trips/StudentHome';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function StudentPage() {
  // La preparación del día de demo corre a la par de la sesión: no depende de ella.
  const [{ supabase, profile }] = await Promise.all([requireRole(['student']), ensureDemoDay()]);
  const [trips, soon] = await Promise.all([
    fetchTodayTrips(supabase),
    // Sin la migración 0007 la columna no existe y la lista queda vacía.
    supabase.from('routes').select('name').eq('active', true).eq('coming_soon', true).order('name'),
  ]);

  return (
    <AppShell profile={profile}>
      {profile.status === 'pending' && (
        <p className="mb-4 rounded-2xl bg-brand-50 p-3 text-sm text-brand-700 ring-1 ring-brand-100">
          Tu registro está pendiente de aprobación. Mientras tanto ya puedes ver las rutas.
        </p>
      )}
      <StudentHome initial={trips} comingSoon={(soon.data ?? []).map((r: { name: string }) => r.name)} />
    </AppShell>
  );
}
