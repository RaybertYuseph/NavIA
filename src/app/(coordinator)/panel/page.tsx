import { AppShell } from '@/components/AppShell';
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
    <AppShell profile={profile} wide>
      <FiscalPanel
        initialTrips={trips}
        initialVehicles={(vehicles.data ?? []) as Vehicle[]}
        drivers={Object.fromEntries((drivers.data ?? []).map((d) => [d.id, d.full_name]))}
      />
    </AppShell>
  );
}
