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
          Tu registro está pendiente: el fiscal de la línea lo revisa con tu cédula. Cuando te apruebe, este aviso desaparece al volver a abrir la app.
        </p>
      )}
      {profile.status === 'rejected' && (
        <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
          El fiscal no pudo confirmar tu registro. Habla con él en la parada o en el grupo de la línea para revisarlo.
        </p>
      )}
      <StudentHome initial={trips} comingSoon={(soon.data ?? []).map((r: { name: string }) => r.name)} />
    </AppShell>
  );
}
