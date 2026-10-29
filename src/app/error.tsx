'use client';
import { useEffect } from 'react';
import { useLeave } from '@/features/auth/useLeave';
import { NaviaAgent } from '@/features/brand/NaviaAgent';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

/** Si una vista falla en el servidor: un mensaje claro y dos salidas, en vez de la página de error en blanco. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { leaving, leave } = useLeave('local');
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
      <NaviaAgent size={120} animated />
      <h1 className="text-2xl font-extrabold tracking-tight">Uy, se me trancó la ruta</h1>
      <p className="text-slate-600">No pude cargar esta pantalla. Puede ser la conexión; prueba otra vez.</p>
      {error.digest && <p className="text-xs text-slate-400">Código: {error.digest}</p>}
      <div className="mt-2 flex w-full flex-col gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Reintentar
        </button>
        <button type="button" onClick={() => void leave()} disabled={leaving} className="btn-ghost disabled:opacity-60">
          {leaving ? 'Saliendo…' : DEMO ? 'Volver al inicio de la demo' : 'Volver al inicio'}
        </button>
      </div>
    </main>
  );
}
