import { NaviaLogo } from '@/features/brand/NaviaAgent';

export function AppHeader({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <header className="flex items-center justify-between gap-2 pb-4">
      <div>
        <NaviaLogo size={34} />
        <h1 className="mt-1 text-xl font-bold">{subtitle}</h1>
        <p className="text-sm text-slate-500">{name}</p>
      </div>
      <form action="/auth/salir" method="post">
        <button className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-brand-100">Salir</button>
      </form>
    </header>
  );
}
