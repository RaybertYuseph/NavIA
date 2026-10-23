import { AppHeader } from '@/components/AppHeader';
import { FiscalPanel } from '@/features/panel/FiscalPanel';
import { fetchTodayTrips } from '@/features/trips/query';
import type { Vehicle } from '@/features/trips/types';
import { ensureDemoDay } from '@/lib/demoDay';
import { requireRole } from '@/lib/profile';

export default async function FiscalPage() {
  const { supabase, profile } = await requireRole(['coordinator', 'admin']);
  await ensureDemoDay();
  const [trips, vehicles, drivers] = await Promise.all([
    fetchTodayTrips(supabase),
    supabase.from('vehicles').select('id, plate, capacity, photo_url, available').eq('active', true).order('plate'),
    supabase.from('profiles').select('id, full_name').eq('role', 'driver'),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-4">
      <AppHeader name={profile.full_name} subtitle="Fiscal de la línea" />
      <FiscalPanel
        initialTrips={trips}
        initialVehicles={(vehicles.data ?? []) as Vehicle[]}
        drivers={Object.fromEntries((drivers.data ?? []).map((d) => [d.id, d.full_name]))}
      />
    </main>
  );
}
