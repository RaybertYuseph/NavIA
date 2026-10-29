import { NaviaAgent } from '@/features/brand/NaviaAgent';

/** Mientras el servidor prepara la vista: NavIA y el esqueleto de la pantalla, nunca un blanco. */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6" aria-busy="true">
      <div className="flex items-center gap-3">
        <NaviaAgent size={56} animated compact talking />
        <p className="font-semibold text-slate-600">Un momentico, estoy cargando la ruta…</p>
      </div>
      <div className="h-11 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-40 animate-pulse rounded-[1.75rem] bg-brand-100/80" />
      <div className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
    </main>
  );
}
