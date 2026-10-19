import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente de Supabase con la sesión del usuario: todo lo que lee pasa por RLS. */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: el middleware ya refresca la sesión.
          }
        },
      },
    },
  );
}
