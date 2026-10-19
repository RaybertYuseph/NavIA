import type { Vehicle } from '@/features/trips/types';

/** Foto de identificación de la unidad con su placa; si no hay foto, un dibujo genérico. */
export function VehiclePhoto({ vehicle, size = 'md' }: { vehicle: Vehicle | null; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-12 w-16', md: 'h-20 w-28', lg: 'h-40 w-full' }[size];
  return (
    <figure className="flex shrink-0 flex-col items-center gap-1">
      <div className={`${box} overflow-hidden rounded-xl bg-brand-50`}>
        {vehicle?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto pública de Storage, sin optimizador
          <img src={vehicle.photo_url} alt={`Unidad ${vehicle.plate}`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <BusDrawing />
        )}
      </div>
      {vehicle?.plate && (
        <figcaption className="rounded border border-slate-300 bg-white px-1.5 font-mono text-slate-900 text-xs font-semibold tracking-wider">
          {vehicle.plate}
        </figcaption>
      )}
    </figure>
  );
}

function BusDrawing() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full p-2 text-brand-400" aria-hidden="true">
      <rect x="4" y="6" width="56" height="24" rx="5" fill="currentColor" />
      <rect x="9" y="10" width="10" height="8" rx="1.5" fill="white" />
      <rect x="22" y="10" width="10" height="8" rx="1.5" fill="white" />
      <rect x="35" y="10" width="10" height="8" rx="1.5" fill="white" />
      <rect x="48" y="10" width="8" height="12" rx="1.5" fill="white" />
      <circle cx="16" cy="31" r="4.5" fill="#334155" />
      <circle cx="48" cy="31" r="4.5" fill="#334155" />
    </svg>
  );
}
