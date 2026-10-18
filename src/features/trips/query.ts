import type { SupabaseClient } from '@supabase/supabase-js';
import { caracasDayRange } from '@/lib/time';
import { TRIP_SELECT, type Trip } from './types';

/** Salidas de hoy (hora de Caracas) de rutas activas, en orden de salida. */
export async function fetchTodayTrips(supabase: SupabaseClient, opts: { driverId?: string } = {}) {
  const { from, to } = caracasDayRange();
  let q = supabase.from('trips').select(TRIP_SELECT).gte('scheduled_at', from).lt('scheduled_at', to);
  if (opts.driverId) q = q.eq('driver_id', opts.driverId);
  const { data, error } = await q.order('scheduled_at');
  if (error) throw error;
  return ((data ?? []) as unknown as Trip[]).filter((t) => t.routes?.active !== false);
}
