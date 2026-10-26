import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export type Role = 'student' | 'driver' | 'coordinator' | 'admin';

export const HOME_BY_ROLE: Record<Role, string> = {
  student: '/',
  driver: '/conductor',
  coordinator: '/panel',
  admin: '/panel',
};

/** Perfil de quien está conectado; si su rol no puede ver esta zona, lo lleva a la suya. */
export async function requireRole(allowed: Role[]) {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, status')
    .eq('id', userId)
    .single();
  if (!profile) redirect('/login');

  const role = profile.role as Role;
  if (!allowed.includes(role)) redirect(HOME_BY_ROLE[role]);
  return { supabase, profile: { ...profile, role } };
}
