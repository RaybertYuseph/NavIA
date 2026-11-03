import { redirect } from 'next/navigation';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { NewPassword } from '@/features/auth/NewPassword';
import { createServerClient } from '@/lib/supabase/server';

/** Se llega desde el enlace del correo, ya con sesión: aquí se elige la contraseña nueva. */
export default async function NewPasswordPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect('/login?aviso=enlace-vencido');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center text-center">
        <NaviaAgent size={120} animated mood="happy" />
        <h1 className="mt-2 text-2xl font-extrabold">Elige tu contraseña nueva</h1>
        <p className="mt-1 text-sm text-slate-600">La usarás desde ahora para entrar a NavIA.</p>
      </div>
      <NewPassword />
    </main>
  );
}
