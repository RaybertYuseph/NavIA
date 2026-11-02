import { AppShell } from '@/components/AppShell';
import { FiscalPanel } from '@/features/panel/FiscalPanel';
import type { StudentToReview } from '@/features/panel/StudentsReview';
import { fetchTodayTrips } from '@/features/trips/query';
import { ensureDemoDay } from '@/lib/demoDay';
import { fetchRoutes, fetchVehicles } from '@/lib/lineData';
import { requireRole } from '@/lib/profile';

export default async function FiscalPage() {
  // La preparación del día de demo corre a la par de la sesión: no depende de ella.
  const [{ supabase, profile }] = await Promise.all([requireRole(['coordinator', 'admin']), ensureDemoDay()]);
  const [trips, vehicles, routes, drivers, students] = await Promise.all([
    fetchTodayTrips(supabase),
    fetchVehicles(supabase, { retired: true }),
    fetchRoutes(supabase),
    supabase.from('profiles').select('id, full_name').eq('role', 'driver'),
    // Sin la migración 0017 la función no existe: el panel lo avisa en la pestaña Estudiantes.
    supabase.rpc('students_to_review'),
  ]);

  return (
    <AppShell profile={profile} wide>
      <FiscalPanel
        initialTrips={trips}
        initialVehicles={vehicles}
        routes={routes}
        drivers={Object.fromEntries((drivers.data ?? []).map((d) => [d.id, d.full_name]))}
        initialStudents={students.error ? null : ((students.data ?? []) as StudentToReview[])}
      />
    </AppShell>
  );
}
