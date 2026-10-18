export function AppHeader({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <header className="flex items-center justify-between gap-2 pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">NavIA</p>
        <h1 className="text-xl font-bold">{subtitle}</h1>
        <p className="text-sm text-slate-500">{name}</p>
      </div>
      <form action="/auth/salir" method="post">
        <button className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">Salir</button>
      </form>
    </header>
  );
}
