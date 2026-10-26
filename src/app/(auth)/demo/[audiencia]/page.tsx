import { notFound, redirect } from 'next/navigation';
import { DemoLogin } from '@/features/auth/DemoLogin';
import { AUDIENCES, isAudience } from '@/features/auth/demoAccess';
import { NaviaAgent } from '@/features/brand/NaviaAgent';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

/** Enlace de demo para un público: /demo/estudiante o /demo/conductor-fiscal. */
export default async function DemoAudiencePage({ params }: { params: Promise<{ audiencia: string }> }) {
  const { audiencia } = await params;
  if (!DEMO) redirect('/login');
  if (!isAudience(audiencia)) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center text-center">
        <NaviaAgent size={150} animated mood="happy" />
        <h1 className="brand-text mt-1 text-5xl font-extrabold tracking-tight">NavIA</h1>
        <p className="mt-1 text-lg font-bold">¡Epa! Soy tu copiloto de ruta</p>
        <p className="mt-1 text-sm text-slate-600">{AUDIENCES[audiencia].intro}</p>
      </div>
      <DemoLogin audience={audiencia} />
      <p className="text-center text-xs text-slate-500">Es una demo con datos de ejemplo. Al final del recorrido te pido tu opinión en 2 minutos.</p>
    </main>
  );
}
